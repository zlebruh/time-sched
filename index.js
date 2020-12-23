const Task = require('./Task');
const zletools = require('zletools');

// Local stuff
let running = false;
const prefix = '### Scheduler';
const regex = {
  wait: /^{to:([0-9]{1,10})}$/,
};

// Tick rate
// const min = 250; // Quarter second
const min = 0; // No time to waste, only cycles
const max = 86400000; // 24 hours
let RAF = getRAF(); // eslint-disable-line

/** ************************* RequestAnimationFrame - Start ********** */
/**
 * Provides a viable alternative to RequestAnimationFrame / RAF because...
 * it has a very specific behaviour when the tab window isn't active
 * @returns {function}
 */
function getRAFFallback() {
  return (callback) => {
    setTimeout(callback, min);
  };
}

/**
 * @param {boolean} forceFallback
 * @returns {function}
 */
function getRAF(forceFallback) {
  if (forceFallback === true) {
    return getRAFFallback();
  }

  const GLOBAL = global.window || {};

  return GLOBAL.requestAnimationFrame
    || GLOBAL.oRequestAnimationFrame
    || GLOBAL.msRequestAnimationFrame
    || GLOBAL.mozRequestAnimationFrame
    || GLOBAL.webkitRequestAnimationFrame || getRAFFallback();
}

/**
 * @param {boolean} [forceFallback]
 * @returns {Function}
 */
function changeRAF(forceFallback) {
  RAF = getRAF(forceFallback);
  return RAF;
}
/** ************************* RequestAnimationFrame -  End  ********** */

class Scheduler {
  constructor(props = 1000) {
    if (zletools.isNumber(props)) {
      props = { heartbeat: props };
    }

    const { heartbeat = min, keepAlive = false } = props;
    if (heartbeat < min) {
      Scheduler.logError(`Chosen default tick rate [${heartbeat}] is less than [${min}] and will default to [${min}]`);
      heartbeat = min;
    }

    if (keepAlive === true) {
      this._subscribe();
    }

    Object.defineProperties(this, {
      RAF: { get: () => RAF },
      min: { value: heartbeat },
      max: { value: max },
      wait: this._spawnWait(heartbeat),
      keepAlive: { value: keepAlive },
      list: { value: {} },
      running: { get: () => running },
      lastTick: { value: 0, writable: true },
    });

    changeRAF();
  }

  // EVENTS
  _handleVisibilityChange() {
    changeRAF(document.hidden);
    this._loop();
  }

  _subscribe() {
    document.addEventListener('visibilitychange',
      () => this._handleVisibilityChange(),
      false,
    );
  }

  /**
   * @param {string} name
   * @param {boolean} [throwErr]
   * @returns {boolean}
   */
  has(name = '', throwErr) {
    const hasIt = !!this.list[name];
    if (!hasIt && throwErr === true) {
      throw new Error(Scheduler.noTaskText(name));
    }

    return hasIt;
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  canAdd(name) {
    if (this.has(name)) {
      return Scheduler.logError(Scheduler.hasTaskText(name));
    } else if (!zletools.isString(name, true)) {
      return Scheduler.logError(zletools.textNotString(name, 'name'));
    }

    return true;
  }

  /**
   * @param {object} params
   * @returns {boolean}
   */
  add(params) {
    try {
      if (this.canAdd(params.name)) {
        this.list[params.name] = new Task(params);
        return true;
      }
    } catch (err) {
      return Scheduler.logError(err);
    }
  }

  /**
   * @param {string} name
   * @returns {*}
   */
  enableTask(name = '') {
    return this._doTask(name, 'enable');
  }

  /**
   * @param {string} name
   * @param {boolean} [throwErr]
   * @returns {*}
   */
  disableTask(name = '', throwErr = true) {
    return this._doTask(name, 'disable', throwErr);
  }

  /**
   * @returns {Scheduler}
   */
  _doTask(...args) {
    try {
      zletools.checkForNumberOfArguments(2, args);
      const [name, action] = args;
      if (this.has(name, true)) {
        this.list[name][action]();
      }
    } catch (err) {
      // We throw an error unless we're told not to
      if (args[2]) {
        Scheduler.logError(err);
      }
    }

    return this;
  }

  /**
   * @param {object} params
   * @returns {boolean}
   */
  replace(params) {
    try {
      if (this.has(params.name)) {
        this.list[params.name] = new Task(params);
        return true;
      }
      return Scheduler.logError(Scheduler.noTaskText(params.name));
    } catch (err) {
      return Scheduler.logError(err);
    }
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  remove(name = '') {
    if (!zletools.isString(name, true)) {
      return Scheduler.logError(zletools.textNotString(name));
    } else if (!this.has(name)) {
      return Scheduler.logError(Scheduler.noTaskText(name));
    }

    delete this.list[name];
    return true;
  }

  /**
   * @param {array} list
   * @returns {boolean}
   */
  removeList(list = []) {
    if (Array.isArray(list)) {
      list.forEach((item) => this.remove(item));
      return true;
    }

    zletools.throwNotArray(list, 'list');
    return false;
  }

  /**
   * @returns {boolean}
   */
  empty() {
    try {
      const { list } = this;
      Object.keys(list).forEach(key => delete list[key]);
      return true;
    } catch (err) {
      return Scheduler.logError(err);
    }
  }

  /**
   * @param {number} val
   * @returns {Scheduler}
   */
  changeWait(val) {
    try {
      const value = this._getValidWait(val);
      if (value) {
        this.wait = value;
        return true;
      }
      return false;
    } catch (err) {
      return Scheduler.logError(err);
    }
  }

  /**
   * @param {string} name
   * @param {number} val
   * @returns {boolean}
   */
  changeTaskWait(name, val) {
    try {
      const task = this.list[name];

      if (task) {
        task.interval = val;
        return task.interval === val;
      }

      return false;
    } catch (err) {
      return Scheduler.logError(err);
    }
  }

  /**
   * @param {number} val
   * @returns {string}
   */
  _getValidWait(val) {
    let result = '';
    if (zletools.isNumber(val)) {
      if (val === this.wait) {
        throw new Error(`The new value [${val}] is the same as the current one [${this.wait}]`);
      } else {
        result = `{to:${val}}`;
      }
    } else {
      zletools.throwNotNumber(val);
    }

    return result;
  }

  _tick(now = Date.now()) {
    let taskName = '';
    try {
      if (running) {
        const { list } = this;
        Object.keys(list).forEach((name) => {
          if (this.has(name)) {
            taskName = name;
            const task = list[name];

            // Execute the callback only if the set of parameters matches the correct Task type
            if (task.shouldExecute(now)) {
              task.callback(now);
            }

            if ((task === list[name]) && task.destroy === true) {
              this.remove(name);
            }
          }
        });
      }
    } catch (err) {
      Scheduler.logError(err);
      this.remove(taskName);
    }
  }

  _loop() {
    /**
     * @type {Scheduler}
     */
    RAF(() => {
      const now = Date.now();
      const delta = now - this.lastTick;
      if (delta > this.wait) {
        this._tick(now);
        this.lastTick = now;
      }

      if (running) {
        this._loop();
      }
    });
  }

  start() {
    if (!running) {
      running = true;
      this._loop();
    }

    return this;
  }

  stop() {
    running = false;
    return this;
  }

  _throwOutOfRange(skipMethodHint = false) {
    const textRange = `Acceptable range is ${this.min}-${this.max}ms.
    This value CANNOT be lower than the initial "heartbeat" value [${this.min}]\n`;
    const textMethodHint = 'Always use the "changeWait" method.';
    
    const text = skipMethodHint
      ? textRange
      : `${textMethodHint} ${textRange}`;
    throw new TypeError(text);
  }

  /**
   * @param {number} initWait
   * @returns {number|*}
   */
  _spawnWait(initWait = 250) {
    if (this.wait) {
      return this.wait;
    }

    let wait = initWait;
    return {
      get: () => wait,
      set: (val) => {
        const match = val.match(regex.wait);
        if (match) {
          const number = Number(match[1]);
          if ((number >= this.min && number <= this.max)) {
            wait = Number(number);
          } else {
            this._throwOutOfRange(true);
          }
        } else {
          this._throwOutOfRange();
        }

        return val;
      },
    };
  }

  /**
   * @param {string} name
   * @returns {string}
   */
  static hasTaskText(name) {
    return `There's already a task "${name}". Always use the "replace" method.`;
  }

  /**
   * @param {string} name
   * @returns {string}
   */
  static noTaskText(name) {
    return `There's no task "${name}"`;
  }

  /**
   * @param {string} name
   * @returns {false}
   */
  static logError(errorText) {
    console.error(prefix, errorText);
    return false;
  }
}

module.exports = Scheduler;
