# time-sched
Dumb scheduler that doesn't care about priorities and such

## Purpose
If you're looking for a fancy sorting algorithm to optimize your web appllication's behaviour to your or someone else's liking, you're in the wrong neighbourhood.

**time-sched** is strictly a requestAnimationFrame based replacement for *setTimeout* and *setInterval* functionality with just a few bits on top.

## Ugh, what?
I won't spend any time telling you how unreliable, in terms of timing, *setTimeout* and *setInterval* are. That's not always the point here. Sometimes it matters, sometimes it doesn't.

What used to caus me far greater pain in the past was the fact that there's quite of bit of housekeeping involved when dealing with multiple timers occuring once or multiple times. If only they'd made them just a little bit fancier.

That's where **time-sched** comes in.

## Features - Scheduler
  ### start/stop
  - Ability to **start** or **stop** the Scheduler at any point in time
  - If stopped, all execution is suspended. No more timers!
  - When started again, tasks that have missed their time window will be executed. Business as usual.

  ### internal tick rate
  - By default, the tick rate is set to 250ms
  - This means **time-sched** is checking for tasks to run every quarter of a second.
  - You may increase or decrease this value according to your needs.
  - I have found that 250ms is the sweet spot that doesn't affect in a meaningful way even low power devices such as phones and embedded systems.
  - **NOTE**: increasing the time between each **time-sched** tick will have an effect on recurring tasks that execute faster. Individual tasks cannot override this behaviour

## Features - Task
  ### enable/disable
  - You can **enable** or **disable** any task at any given time.
  - If a task has missed its time window will be executed while being disabled, it will be executed on first opportunity when enabled again. Business as usual.
  ### change interval time in real time
  - Recurring tasks can have their interval changed at any point in time
  - Say you want to increace/decrease the max FPS of your canvas animation based on some changing conditions
  - **NOTE**: Recurring tasks cannot execute more often than the **time-sched** instance itself.
  - Just edit the code if it's not doing what you want.

## Usage
```javascript
const Scheduler = require('time-sched');

// Create an instance: you're only supposed to have *ONE* instance

// v1 - auto start
const scheduler = new Scheduler().start()

// v2 - manual start/stop
const scheduler = new Scheduler();

// both does what they say
scheduler.start();
// scheduler.stop();

// Adding tasks
scheduler.add({
  name: 'AAA',
  interval: 1000,
  iterations: 7,
  callback: (task) => console.log(task.name, task.iteration)
});
scheduler.add({
  name: 'AAA_1',
  interval: 1500,
  callback: (task) => console.warn(task.name, task.iteration)});
scheduler.add({
  name: 'BBB',
  after: 5000,
  callback: () => console.error('OH YEAH')
});

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

## Where's the fancy?
Well, I didn't promise anything special. I fixed my own itch and problems.

If it works for you: great! If it doesn't, then my apologies :(

I am sure there's more details to add but it's not like anyone else but me is going to this tool.
