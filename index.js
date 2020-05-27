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
  constructor(minWait = min) {
    if (minWait < min) {
      Scheduler.logError(`Chosen default tick rate [${minWait}] is less than [${min}] and will default to [${min}]`);
      minWait = min;
    }

    Object.defineProperties(this, {
      RAF: { get: () => RAF },
      min: { value: minWait },
      max: { value: max },
      wait: this.spawnWait(minWait),
      list: { value: {} },
      running: { get: () => running },
      lastTick: { value: 0, writable: true },
    });

    changeRAF();
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
    return this.doTask(name, 'enable');
  }

  /**
   * @param {string} name
   * @param {boolean} [throwErr]
   * @returns {*}
   */
  disableTask(name = '', throwErr = true) {
    return this.doTask(name, 'disable', throwErr);
  }

  /**
   * @returns {Scheduler}
   */
  doTask(...args) {
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
      const value = this.getValidWait(val);
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
   * @param {number} val
   * @returns {string}
   */
  getValidWait(val) {
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

  tick(now = Date.now()) {
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

  loop() {
    /**
     * @type {Scheduler}
     */
    RAF(() => {
      const now = Date.now();
      const delta = now - this.lastTick;
      if (delta > this.wait) {
        this.tick(now);
        this.lastTick = now;
      }

      if (running) {
        this.loop();
      }
    });
  }

  start() {
    if (!running) {
      running = true;
      this.loop();
    }

    return this;
  }

  stop() {
    running = false;
    return this;
  }

  throwOutOfRange(skipMethodHint = false) {
    const textRange = `Acceptable range is ${this.min}-${this.max}ms.`;
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
  spawnWait(initWait = 250) {
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
            this.throwOutOfRange(true);
          }
        } else {
          this.throwOutOfRange();
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
