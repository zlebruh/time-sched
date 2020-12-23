# time-sched
Dumb scheduler that doesn't care about priorities and such

<hr />

## Full example
```javascript
const Scheduler = require('time-sched');

const scheduler = new Scheduler({
  // This is how often current tasks are evaluated.
  // A task cannot be executed faster than this global interval
  heartbeat: 250,

  // requestAnimationFrame based means...
  // navigating to another tab stops the execution.
  // Use "true" if you need your tasks to run in the background
  // This is an optional parameter that defaults "false"
  keepAlive: true,
}).start();

// Repeating task
scheduler.add({
  name: 'AAA_1',
  interval: 1000,
  iterations: 7, // Optional. Task is destroyed afterwards
  callback: (task) => console.log(task.name, task.iteration)
});

// Only executed once
scheduler.add({
  name: 'BBB',
  after: 5000, // Optional. Task is executed and destroyed afterwards
  callback: () => console.error('OH YEAH')
});

// Pause the task
scheduler.disableTask('AAA_1');

// Resume the task
scheduler.enableTask('AAA_1');

// Change how often a task runs
// Again, this value cannot be lower than the global "every"
scheduler.changeTaskWait('AAA_1', 3000);

// Change it again
scheduler.changeTaskWait('AAA_1', 300);

// Remove the task manually
scheduler.remove('AAA_1');
```
<br>

## Continue reading if this works for you.

<hr />

## Purpose
If you're looking for a fancy sorting algorithm to optimize your web appllication's behaviour to your or someone else's liking, you're in the wrong neighbourhood.

`time-sched` is strictly a requestAnimationFrame based replacement for *setTimeout* and *setInterval* functionality with just a few bits on top.

## Ugh, what?
I won't spend any time telling you how unreliable, in terms of timing, *setTimeout* and *setInterval* are. That's not always the point here. Sometimes it matters, sometimes it doesn't.

What used to caus me far greater pain in the past was the fact that there's quite of bit of housekeeping involved when dealing with multiple timers occuring once or multiple times. If only they'd made them just a little bit fancier.

That's where `time-sched` comes in.

## Its true purpose
With `time-sched` you can easily **add/pause/remove** tasks based on an **interval** OR desired **date** in the future. You can also easily ***change intervals*** on repeated tasks.

It is a handy tool when you have to scale certain continous operations stretched in time due to one reason or another.

Say, you're working with canvas/svg animations and you want to update/animate an arbitrary amount of things. But what if you need to speed up or slow down each update based on demand, user focus, or something else? You can do that.

Or you're working on a web game. Nothing easier than adding your draw operations to `time-sched`. Wanna change the maximum frame? Yes, you can. Want to have a diffrent frame rate for your main screen and your mini map? Duh, it's just another task. And since `time-sched` is **requestAnimationFrame** based, you can be sure your game will not eat resources when the tab is not active.

## Features - Scheduler
  ### start/stop
  - Ability to **start** or **stop** the Scheduler at any point in time
  - If stopped, all execution is suspended. No more timers!
  - When started again, tasks that have missed their time window will be executed. Business as usual.

  ### internal tick rate
  - By default, the tick rate is now set to 0ms
  - This means `time-sched` is checking for tasks to run every quarter of a second.
  - You may increase or decrease this value according to your needs.
  - I have found that 250ms is the sweet spot that doesn't affect in a meaningful way even low power devices such as phones and embedded systems.
  - However, that's nowhere near enough for high performance tasks such as games, graph updates, animations, etc. Choose wisely based on your needs, cycles are not always free.
  - **NOTE**: increasing the time between each `time-sched` tick will have an effect on recurring tasks that execute faster. Individual tasks cannot override this behaviour

## Features - Task
  ### enable/disable
  - You can **enable** or **disable** any task at any given time.
  - If a task has missed its time window will be executed while being disabled, it will be executed on first opportunity when enabled again. Business as usual.
  ### change interval time in real time
  - Recurring tasks can have their interval changed at any point in time
  - Say you want to increace/decrease the max FPS of your canvas animation based on some changing conditions
  - **NOTE**: Recurring tasks cannot execute more often than the `time-sched` instance itself.
  - Just edit the code if it's not doing what you want.

## Internal tick rate
The default interval between each scheduler tick is 0.

You can either use **new Scheduler(1000)** forcing the scheduler to wake up once a second or skip the parameter and simply use the **changeWait** method.

## Usage
### Preferred initialization
```javascript
const Scheduler = require('time-sched');

const scheduler = new Scheduler({
  // This is how often current tasks are evaluated.
  // A task cannot be executed faster than this global interval
  heartbeat: 250,

  // requestAnimationFrame based means...
  // navigating to another tab stops the execution.
  // Use "true" if you need your tasks to run in the background
  // This is an optional parameter that defaults "false"
  keepAlive: true,
}).start();
```

### Old style initialization
```javascript
const Scheduler = require('time-sched');

const heartbeat = 250;
const scheduler = new Scheduler(heartbeat).start();
```

### Global Start / Stop
```javascript
scheduler.stop();
scheduler.start();
```

### Important
If you do not provide a `heartbeat` value, the script defaults to `0`
<br><br>

### Adding tasks
```javascript
scheduler.add({
  name: 'AAA',
  interval: 1000,
  iterations: 7, // Optional. Task is destroyed afterwards
  callback: (task) => console.log(task.name, task.iteration)
});
scheduler.add({
  name: 'AAA_1',
  interval: 1500,
  callback: (task) => console.warn(task.name, task.iteration)});
scheduler.add({
  name: 'BBB',
  after: 5000, // Optional. Task is executed and destroyed afterwards
  callback: () => console.error('OH YEAH')
});
```

### Managing tasks via the scheduler - **recommended**
```javascript
// Pause a task
scheduler.disableTask('AAA_1');

// Resume a task
scheduler.enableTask('AAA_1');

// Change how often a task runs
// Again, this value cannot be lower than the global "every"
scheduler.changeTaskWait('AAA_1', 3000);

// Change it again
scheduler.changeTaskWait('AAA_1', 300);
```

### Managing tasks directly - **not recommended**
Having references might be a really bad idea.
Complete tasks are removed from the list.<br>
If you keep reference to a task that has been destroyed (or failed)<br>
are caching garbage with
```javascript
const task_a1 = Scheduler.list['AAA_1'];

// Enable / disable task
task_a1.enable();
task_a1.disable();

// Change task interval.
// Only applies to the ones that have this property in the first place.
// If confused, look at "Adding tasks" again.
task_a1.interval = 3000; // Task is now being executed every 3 seconds
task_a1.interval = 300; // Task is now being executed every 300 ms
```

### Remove a task manually
```javascript
scheduler.remove('AAA_1');
```

## Where's the fancy?
Well, I didn't promise anything special. I fixed my own itch and problems.

If it works for you: great! If it doesn't, then my apologies :(

I am sure there's more details to add but it's not like anyone else but me is going to this tool.

## A piece of advice
I strongly encourage you to NOT cache