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
 *
 * REACHING the horizon, vs HOLDING it
 * -----------------------------------
 * The 90 s horizon is not negotiable, but building all 90 s in one synchronous
 * block was. At the default preset that first block was ~1,305 droplets,
 * ~2,610 native nodes and ~61,000 JSI crossings, on the JS thread, on the play
 * tap — and again on every preset swap and every layer toggle.
 *
 * So each task now carries its own `depth`, which starts at PRIME_STEP_SECONDS
 * and is walked out to the full horizon in PRIME_STEP_SECONDS chunks, one chunk
 * per PRIME_INTERVAL_MS. Depth is per task, not global, so a layer switched on
 * at 3am primes gently from 6 s exactly like one switched on at the play tap
 * — which is what removes the freeze from layer toggles and preset swaps too.
 *
 * That leaves a window between "audio started" and "full depth reached" in
 * which the app holds less than 90 s. It is closed three ways:
 *
 *  1. It is SHORT. 6 s of depth is scheduled synchronously inside start(), and
 *     14 further chunks at 60 ms take the task to 90 s about 0.85 s later. A
 *     user cannot plausibly start playback and background the app inside one
 *     second, and the screen cannot time out that fast.
 *  2. Nothing in that window is driven by a timer. Every event a chunk creates
 *     is pre-scheduled on ctx.currentTime and survives on the audio thread
 *     whatever happens to the JS clock afterwards. A shallower horizon can only
 *     ever thin discrete events out later; it can never make audio stutter now.
 *     Continuous layers (beds, swells, 1/f) are OscillatorNode -> AudioParam and
 *     are not scheduled here at all, so they are wholly unaffected.
 *  3. If the JS clock is ALREADY being throttled, priming is abandoned and the
 *     full horizon is taken immediately — see _runPrime and pump below. A late
 *     callback is the only observable signal of throttling we get, and the
 *     asymmetry is deliberate: a false positive costs one burst (i.e. exactly
 *     today's behaviour), a false negative costs silence.
 */

import type { BaseAudioContext } from 'react-native-audio-api';

const HORIZON_SECONDS = 90;
const TICK_MS = 5000;
const HARD_EVENT_CAP = 6000;

/** How much extra audio one priming chunk may schedule. */
const PRIME_STEP_SECONDS = 6;
/** Gap between chunks. Longer than a 24 fps frame (41.7 ms), so the JS thread
 *  gets a whole frame back between chunks instead of one long block. */
const PRIME_INTERVAL_MS = 60;
/** A priming chunk this far past its due time means the JS timer is being
 *  throttled; stop ramping and take the whole horizon at once. */
const PRIME_LATE_MS = 1000;

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
  /** How far ahead of now this task is currently allowed to fill, in seconds.
   *  Starts at PRIME_STEP_SECONDS and is walked up to `horizon`. */
  depth: number;
}

export class Scheduler {
  private ctx: BaseAudioContext;
  private horizon: number;
  private tickMs: number;
  private _tasks = new Map<string, TaskEntry>();
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _primeTimer: ReturnType<typeof setTimeout> | null = null;
  private _primeDueMs = 0;
  private _lastPumpMs = 0;

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
    this._lastPumpMs = Date.now();
    this._timer = setInterval(() => this.pump(), this.tickMs);
    this.pump();
  }

  stop(): void {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    if (this._primeTimer) clearTimeout(this._primeTimer);
    this._primeTimer = null;
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
      // A new task always primes from shallow, whether it arrived at the play
      // tap or from a layer toggle four hours in. That is what keeps a toggle
      // and a preset swap off the one-big-block path as well.
      depth: Math.min(PRIME_STEP_SECONDS, this.horizon),
    });
    if (this._timer) {
      this._pumpTask(key);
      this._schedulePrime();
    }
  }

  remove(key: string): void {
    this._tasks.delete(key);
  }

  pump(): void {
    const nowMs = Date.now();
    const sinceLast = nowMs - this._lastPumpMs;
    this._lastPumpMs = nowMs;
    // A tick that arrives far late is the JS timer already being throttled
    // (screen off / Doze). Ramping is pointless once that has happened —
    // take the whole horizon while we still have a callback in hand.
    if (sinceLast > this.tickMs * 2) this._grow(this.horizon);

    for (const key of [...this._tasks.keys()]) this._pumpTask(key);
    this._schedulePrime();
  }

  /** Raise every task's fill depth, clamped to the horizon. */
  private _grow(step: number): void {
    for (const task of this._tasks.values()) {
      if (task.depth < this.horizon) task.depth = Math.min(this.horizon, task.depth + step);
    }
  }

  /** Arm the next priming chunk, if any task is still short of full depth. */
  private _schedulePrime(): void {
    if (this._primeTimer || !this._timer) return;
    let priming = false;
    for (const task of this._tasks.values()) {
      if (task.depth < this.horizon) {
        priming = true;
        break;
      }
    }
    if (!priming) return;
    this._primeDueMs = Date.now() + PRIME_INTERVAL_MS;
    this._primeTimer = setTimeout(this._runPrime, PRIME_INTERVAL_MS);
  }

  private _runPrime = (): void => {
    this._primeTimer = null;
    if (!this._timer) return;
    // Same throttling test as pump(): if a 60 ms step came back a second late,
    // the JS clock is no longer something to plan around. Take everything now.
    const lateBy = Date.now() - this._primeDueMs;
    this._grow(lateBy > PRIME_LATE_MS ? this.horizon : PRIME_STEP_SECONDS);
    for (const key of [...this._tasks.keys()]) this._pumpTask(key);
    this._schedulePrime();
  };

  private _pumpTask(key: string): void {
    const task = this._tasks.get(key);
    if (!task) return;
    const now = this.ctx.currentTime;
    const until = now + task.depth;

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
