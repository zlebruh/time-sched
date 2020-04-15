/* eslint no-console: off */

const zletools = require('zletools');
const Validator = require('json-valid-3k');

// Local stuff
const prefix = '### Scheduler';
const schemas = {
  after: {
    name: { type: 'String', optional: false },
    after: { type: 'Number', optional: false },
    callback: { type: 'Function', optional: false },
  },
  repeat: {
    name: { type: 'String', optional: false },
    interval: { type: 'Number', optional: false },
    callback: { type: 'Function', optional: false },
    iterations: { type: 'Number', optional: true },
  },
};

/** ****************************** Task *********************************** */
class Task {
  /**
   * @param {object} params
   */
  constructor(params = {}) {
    const AFTER = 'after';
    const REPEAT = 'repeat';
    const type = zletools.isNumber(params.after) ? AFTER : REPEAT;

    // The validator is kind enough to filter out every parameter that's not in the schema.
    const options = Validator.validate(params, schemas[type]);
    if (!options.valid) {
      throw new Error('Could not spawn task because the params do not match the schema');
    }

    this.type = type;
    this.name = params.name;
    this.active = true;
    this.callback = Task.spawnCallback(params.callback, this);

    const { tree } = options;
    switch (type) {
      case AFTER:
        this.on = Date.now() + params.after;
        break;
      case REPEAT:
        this.iterations = tree.iterations || 0;
        this.iteration = 0;
        this.interval = tree.interval;
        this.lastUpdate = 0;
        break;
      default: break;
    }
  }

  /**
   * Enables/resumes the task
   * @returns {Task}
   */
  enable() {
    this.active = true;
    return this;
  }

  /**
   * Disables/pauses the task
   * @returns {Task}
   */
  disable() {
    this.active = false;
    return this;
  }

  /**
   * Tells you whether a Task is ok to be executed
   * @param {number} now
   * @returns {boolean}
   */
  shouldExecute(now) {
    const on = this.on || 0;
    const interval = this.interval || 0;
    const lastUpdate = this.lastUpdate || 0;

    const diff = (now - lastUpdate >= interval);
    const afterOK = this.type === 'after' && now > on;
    const repeatOK = this.type === 'repeat' && diff;

    return this.active && (afterOK || repeatOK);
  }

  /**
   * Executes the callback
   * @returns {Task}
   */
  onCallbackTick(now = 0) {
    const iterations = this.iterations || 0;
    const _iteration = this.iteration || 0;
    const iteration = zletools.isNumber(_iteration) ? _iteration + 1 : 0;

    this.iteration = iteration;

    // Mark for automatic destruction by the Scheduler.
    // Tasks of type "after" are only executed once so we don't need any extra checks
    if (this.type === 'after' || (this.type === 'repeat' && iterations !== 0 && iteration >= iterations)) {
      Object.defineProperty(this, 'destroy', { value: true });
      this.markForDestroy();
    } else {
      this.lastUpdate = now || Date.now();
    }

    return this;
  }

  /**
   * Marks a task for destruction. Applied on the next Scheduler's tick
   * @returns {Task}
   */
  markForDestroy() {
    Object.defineProperty(this, 'destroy', { value: true });
    return this;
  }

  /**
   * Spawns a callback function
   * @param {function} fn
   * @param {Task} instance
   * @returns {Function}
   */
  static spawnCallback(fn, instance) {
    return (now) => {
      try {
        instance.onCallbackTick(now);
        fn(instance);
      } catch (err) {
        instance.markForDestroy();
        console.log(prefix, `Task "${instance.name}" seems to have failed in some way and will be destroyed\n`, err);
      }
    };
  }
}

module.exports = Task;
