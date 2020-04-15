const Task = require('./Task');
const zletools = require('zletools');

// Local stuff
let running = false;
const prefix = '### Scheduler';
const regex = {
  wait: /^{to:([0-9]{3,10})}$/,
};

// Tick rate
const min = 250; // Quarter second
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

  return window.requestAnimationFrame
    || window.oRequestAnimationFrame
    || window.msRequestAnimationFrame
    || window.mozRequestAnimationFrame
    || window.webkitRequestAnimationFrame || getRAFFallback();
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
  constructor() {
    Object.defineProperties(this, {
      RAF: { get: () => RAF },
      min: { value: min },
      max: { value: max },
      wait: this.spawnWait(min),
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
      console.log(prefix, Scheduler.hasTaskText(name));
      return false;
    }

    if (!zletools.isString(name, true)) {
      console.log(prefix, zletools.textNotString(name, 'name'));
      return false;
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
      console.log(prefix, err);
    }

    return false;
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
        console.log(prefix, err);
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
      console.log(prefix, Scheduler.noTaskText(params.name));
    } catch (err) {
      console.log(prefix, err);
    }

    return false;
  }

  /**
   * @param {string} name
   * @param {boolean} [throwErr]
   * @returns {Scheduler}
   */
  remove(name = '', throwErr) {
    if (!zletools.isString(name, true)) {
      console.log(zletools.textNotString(name));
    }

    if (!this.has(name) && throwErr === true) {
      throw new Error(Scheduler.noTaskText(name));
    } else {
      delete this.list[name];
    }

    return this;
  }

  /**
   * @param {array} list
   * @returns {Scheduler}
   */
  removeList(list = []) {
    if (Array.isArray(list)) {
      list.forEach((item) => this.remove(item));
    } else {
      zletools.throwNotArray(list, 'list');
    }

    return this;
  }

  /**
   * @returns {Scheduler}
   */
  empty() {
    try {
      const { list } = this;
      Object.keys(list).forEach(key => delete list[key]);
    } catch (err) {
      console.log(prefix, err);
    }

    return this;
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
      }
    } catch (err) {
      console.log(prefix, err);
    }

    return this;
  }

  /**
   * @param {number} val
   * @returns {string}
   */
  getValidWait(val) {
    let result = '';
    if (zletools.isNumber(val)) {
      if (val === this.wait) {
        throw new Error(`The ne value [${val}] is the same as the current one [${this.wait}]`);
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
      console.log(prefix, err);
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

  throwOutOfRange() {
    throw new TypeError(`Use the "changeWait" method. Acceptable range is ${this.min}-${this.max}`);
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
            this.throwOutOfRange();
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
    return `There's already a task with name: ${name}. Use the "replace" method instead.`;
  }

  /**
   * @param {string} name
   * @returns {string}
   */
  static noTaskText(name) {
    return `There's no task with name: ${name}`;
  }
}

module.exports = Scheduler;
