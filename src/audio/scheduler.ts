/**
 * Lookahead event scheduler.
 *
 * Android throttles background JS timers hard — with the screen off an app's
 * setInterval can be cut to one callback per minute (the same failure mode as a
 * hidden web page, and React Native's JS thread is not exempt). Anything driven
 * directly by setInterval would therefore stutter or die once the screen goes
 * off. So nothing here plays sound on the JS clock: tasks *pre-schedule* events
 * on ctx.currentTime out to a HORIZON of 90 seconds, and a 5 second interval
 * simply tops the horizon back up. Even if the interval only fires once a
 * minute, the audio thread already holds a minute and a half of scheduled work.
 *
 * A task is a callback `(time) => gapSeconds`. It schedules exactly one event at
 * the audio time it is handed, and returns how long to wait before the next one.
 * The scheduler holds one number per task, so nothing accumulates: there is no
 * event list to prune and no way for it to grow over an eight hour session.
 */

import type { BaseAudioContext } from 'react-native-audio-api';

const HORIZON_SECONDS = 90;
const TICK_MS = 5000;
const HARD_EVENT_CAP = 6000;

export type SchedulerTask = (time: number) => number;

export interface SchedulerAddOptions {
  startAt?: number;
  startDelay?: number;
  /**
   * Caps how many events a single task may hold in flight. High rate texture
   * tasks use it so an extreme setting cannot pile up tens of thousands of
   * pending nodes; it never bites at normal densities.
   */
  maxAhead?: number;
}

interface TaskEntry {
  fn: SchedulerTask;
  next: number;
  maxAhead: number;
}

export class Scheduler {
  private ctx: BaseAudioContext;
  private horizon: number;
  private tickMs: number;
  private _tasks = new Map<string, TaskEntry>();
  private _timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    ctx: BaseAudioContext,
    { horizon = HORIZON_SECONDS, tickMs = TICK_MS }: { horizon?: number; tickMs?: number } = {}
  ) {
    this.ctx = ctx;
    this.horizon = horizon;
    this.tickMs = tickMs;
  }

  start(): void {
    if (this._timer) return;
    this._timer = setInterval(() => this.pump(), this.tickMs);
    this.pump();
  }

  stop(): void {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this._tasks.clear();
  }

  isRunning(): boolean {
    return this._timer !== null;
  }

  /**
   * @param key  unique id, e.g. 'rain:drops'
   * @param fn   schedules one event, returns the gap to the next
   */
  add(key: string, fn: SchedulerTask, opts: SchedulerAddOptions = {}): void {
    const now = this.ctx.currentTime;
    const startAt = opts.startAt != null ? opts.startAt : now + (opts.startDelay || 0);
    this._tasks.set(key, {
      fn,
      next: Math.max(startAt, now),
      maxAhead: opts.maxAhead || HARD_EVENT_CAP,
    });
    if (this._timer) this._pumpTask(key);
  }

  remove(key: string): void {
    this._tasks.delete(key);
  }

  pump(): void {
    for (const key of [...this._tasks.keys()]) this._pumpTask(key);
  }

  private _pumpTask(key: string): void {
    const task = this._tasks.get(key);
    if (!task) return;
    const now = this.ctx.currentTime;
    const until = now + this.horizon;

    // After a long suspend the cursor can be far in the past. Never try to catch
    // up by firing thousands of missed events — just rejoin the present.
    if (task.next < now) task.next = now + 0.02;

    const cap = Math.min(task.maxAhead, HARD_EVENT_CAP);
    let fired = 0;
    while (task.next < until && fired < cap) {
      let gap: number;
      try {
        gap = task.fn(task.next);
      } catch (err) {
        console.error(`[scheduler] task "${key}" threw; removing`, err);
        this._tasks.delete(key);
        return;
      }
      if (!(gap > 0.002)) gap = 0.05;
      task.next += gap;
      fired++;
    }
  }
}

/**
 * Exponentially distributed gap for a Poisson process of the given rate (events
 * per second), clamped to a sane multiple of the mean so events neither clump
 * into a burst nor leave an implausible silence.
 */
export function poissonGap(rate: number, minMul = 0.12, maxMul = 3.5): number {
  const r = Math.max(0.001, rate);
  const gap = -Math.log(1 - Math.random()) / r;
  return Math.min(Math.max(gap, minMul / r), maxMul / r);
}
