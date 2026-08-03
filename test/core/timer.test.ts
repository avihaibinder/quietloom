/**
 * MAP ENTRY #9 — THE SLEEP TIMER.
 *
 * Standing product decision 3: "The sleep timer defaults ON at 45 minutes. The
 * evidence supports sound for sleep *onset* far better than all-night noise. We
 * turn ourselves off on purpose." So this is not a convenience feature — it is
 * the mechanism by which the product keeps its central claim honest, and it is
 * the one piece of the app that must work while nobody is watching it.
 *
 * Three properties, all of them named in the map:
 *   1. DEADLINE-BASED, never accumulated ticks. The OS throttles JS timers hard
 *      once the screen is off, so counting `setInterval` firings drifts and the
 *      timer silently runs long — on a sleep app, all night.
 *   2. THE FADE ARMS EXACTLY ONCE. `tick()` arms at `remaining <= 65` and the
 *      `fadeArmed` latch stops it re-arming every second thereafter. Without
 *      the latch each tick would schedule a fresh ramp from wherever the last
 *      one had got to, and the audio would never actually reach silence.
 *   3. `cancel()` MID-FADE RESTORES MASTER. Otherwise cancelling the timer
 *      leaves the user at whatever volume the fade had reached, which reads as
 *      "the app went quiet and stayed quiet".
 *
 * HOW THE OUTCOME IS OBSERVED, AND WHY NOT A SPY.
 * `FakeEngine` below is a small working model of the audio engine's master
 * gain, not a bag of `vi.fn()`. It interpolates a real ramp, so every assertion
 * here is "what volume can the user actually hear at this moment" rather than
 * "fadeMasterTo was called" (CEO lead 5). The re-arming bug in property 2 is
 * only visible that way: a re-armed fade still decreases monotonically, so the
 * discriminating fact is the value it REACHES, not the number of calls.
 *
 * WHAT THIS CANNOT PROVE, stated so nobody cites it later: the real
 * `fadeMasterTo` runs on the AUDIO clock precisely so it survives a throttled
 * or suspended main thread. This models it with the test clock. It proves the
 * timer schedules the right fade at the right moment; it cannot prove the fade
 * survives the JS thread being frozen. That needs a device.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bus } from '../../src/core/bus';
import { SleepTimer, type TimerEngine } from '../../src/core/timer';
import { DEFAULT_SETTINGS } from '../../src/core/store';

const USER_MASTER = 0.7;

/** A working model of the engine's master gain — see the file header. */
class FakeEngine implements TimerEngine {
  master = USER_MASTER;
  running = true;
  chimesHeard = 0;

  private ramp: { from: number; to: number; startMs: number; seconds: number } | null = null;

  isRunning(): boolean {
    return this.running;
  }

  getState(): { master: number } {
    return { master: this.master };
  }

  async fadeMasterTo(v: number, seconds: number): Promise<void> {
    // A real ramp starts from wherever the output currently is, which is what
    // makes a re-armed fade observable.
    this.ramp = { from: this.audible(), to: v, startMs: Date.now(), seconds };
  }

  playChime(): void {
    this.chimesHeard += 1;
  }

  /** What the user can actually hear right now. */
  audible(): number {
    if (!this.ramp) return this.master;
    const elapsed = (Date.now() - this.ramp.startMs) / 1000;
    if (elapsed <= 0) return this.ramp.from;
    if (elapsed >= this.ramp.seconds) return this.ramp.to;
    return this.ramp.from + (this.ramp.to - this.ramp.from) * (elapsed / this.ramp.seconds);
  }
}

let engine: FakeEngine;
let offs: Array<() => void> = [];
let ticks: number[] = [];
let sets: Array<number | null> = [];
let dones = 0;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 3, 22, 30, 0, 0));

  engine = new FakeEngine();
  SleepTimer.bind(engine);

  ticks = [];
  sets = [];
  dones = 0;
  offs = [
    bus.on('timer:tick', (p) => ticks.push(p.remainingSec)),
    bus.on('timer:set', (p) => sets.push(p.minutes)),
    bus.on('timer:done', () => {
      dones += 1;
    }),
  ];
});

afterEach(() => {
  SleepTimer.cancel();
  for (const off of offs) off();
  vi.useRealTimers();
});

describe('standing decision 3 — we turn ourselves off on purpose', () => {
  it('defaults ON at 45 minutes', () => {
    expect(DEFAULT_SETTINGS.timerEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.timerMinutes).toBe(45);
  });

  it('defaults the chime OFF, so nothing wakes anyone at 03:00', () => {
    // Standing decision 1's neighbour: an unexpected sound on a sleep surface
    // is a real harm. Opt-in only.
    expect(DEFAULT_SETTINGS.chime).toBe(false);
  });
});

describe('the countdown is deadline-based, not accumulated', () => {
  it('tracks wall-clock time even when the OS never fires the interval', () => {
    SleepTimer.start(10);
    expect(SleepTimer.getRemaining()).toBe(600);

    // The screen goes off and the OS throttles JS: five minutes pass and NOT
    // ONE interval callback runs. An implementation that decremented a counter
    // per tick would still say 600 here and would run five minutes long.
    vi.setSystemTime(Date.now() + 5 * 60_000);

    expect(SleepTimer.getRemaining()).toBe(300);
    expect(SleepTimer.isRunning()).toBe(true);
  });

  it('never reports a negative remaining, however far the clock jumps', () => {
    SleepTimer.start(10);
    vi.setSystemTime(Date.now() + 60 * 60_000); // an hour past the deadline

    // Two-sided: clamped at the floor, and not silently wrapped to something huge.
    expect(SleepTimer.getRemaining()).toBeGreaterThanOrEqual(0);
    expect(SleepTimer.getRemaining()).toBeLessThanOrEqual(600);
    expect(SleepTimer.getRemaining()).toBe(0);
  });

  it('reports zero and not-running before it is ever started', () => {
    expect(SleepTimer.isRunning()).toBe(false);
    expect(SleepTimer.getRemaining()).toBe(0);
  });

  it('refuses a zero or negative duration instead of firing immediately', () => {
    for (const minutes of [0, -5]) {
      SleepTimer.start(minutes);
      expect(SleepTimer.isRunning(), `start(${minutes}) armed a timer`).toBe(false);
      expect(dones, `start(${minutes}) fired the timer`).toBe(0);
    }
    expect(sets.every((m) => m === null)).toBe(true);
  });

  it('restarting replaces the deadline rather than stacking a second timer', () => {
    SleepTimer.start(10);
    vi.advanceTimersByTime(60_000);
    expect(SleepTimer.getRemaining()).toBe(540);

    SleepTimer.start(30);
    expect(SleepTimer.getRemaining()).toBe(1800);

    // Two-sided: exactly one 'done' after the SECOND deadline, and none at the
    // first deadline's moment — a stacked interval would fire twice.
    vi.advanceTimersByTime(30 * 60_000);
    expect(dones).toBe(1);
  });

  it('announces the countdown on the bus while it runs', () => {
    SleepTimer.start(2);
    expect(sets.at(-1)).toBe(2);
    expect(ticks[0]).toBe(120);

    vi.advanceTimersByTime(3_000);
    // Two-sided: it is counting down, and by roughly one second per second.
    expect(ticks.at(-1)).toBeLessThanOrEqual(117);
    expect(ticks.at(-1)).toBeGreaterThanOrEqual(116);
  });
});

describe('the fade arms exactly once', () => {
  it('leaves the volume alone until the fade window opens', () => {
    SleepTimer.start(2); // 120 s; arming happens at remaining <= 65
    vi.advanceTimersByTime(50_000); // remaining 70 — still outside the window

    // Two-sided: untouched, not merely "not zero".
    expect(engine.audible()).toBeGreaterThanOrEqual(USER_MASTER);
    expect(engine.audible()).toBeLessThanOrEqual(USER_MASTER);
  });

  it('fades to exactly silence at the deadline, not to a fraction of it', () => {
    SleepTimer.start(2);

    vi.advanceTimersByTime(55_000); // remaining 65 — arms here, ramp over 65 s
    expect(engine.audible()).toBeCloseTo(USER_MASTER, 5);

    // Halfway through the ramp the user should be at roughly half volume.
    vi.advanceTimersByTime(32_500);
    expect(engine.audible()).toBeGreaterThan(0.3);
    expect(engine.audible()).toBeLessThan(0.42);

    // THE DISCRIMINATING ASSERTION. If the latch were missing, every tick from
    // remaining 65 down to 1 would schedule a NEW ramp from the current level
    // over max(5, remaining) seconds. That still decreases monotonically, so
    // monotonicity proves nothing — but the last re-arm would happen one second
    // before the deadline with a five-second ramp, leaving the user at about
    // 80% of wherever they were when the timer fired. Landing on exactly zero
    // is only possible if the ramp armed once, at 65 s, and was left alone.
    vi.advanceTimersByTime(32_500);
    expect(SleepTimer.getRemaining()).toBe(0);
    expect(engine.audible(), 'audio had not reached silence when the timer fired').toBeLessThanOrEqual(
      0.001,
    );
    expect(engine.audible()).toBeGreaterThanOrEqual(0);
    expect(dones).toBe(1);
  });

  it('falls monotonically once armed — it never gets louder on the way down', () => {
    SleepTimer.start(2);
    vi.advanceTimersByTime(55_000);

    let previous = engine.audible();
    for (let i = 0; i < 13; i++) {
      vi.advanceTimersByTime(5_000);
      const now = engine.audible();
      expect(now, 'the fade went back up').toBeLessThanOrEqual(previous + 1e-9);
      previous = now;
    }
    expect(previous).toBeLessThanOrEqual(0.001);
  });

  it('does not touch the volume at all when the engine is not running', () => {
    engine.running = false;
    SleepTimer.start(2);
    vi.advanceTimersByTime(120_000);

    expect(engine.audible()).toBe(USER_MASTER);
    expect(dones).toBe(1); // the timer still completes; it just has nothing to fade
  });
});

describe('cancel() mid-fade gives the user their volume back', () => {
  it('ramps master back to where it was', () => {
    SleepTimer.start(2);
    vi.advanceTimersByTime(55_000 + 30_000); // armed, then half-faded

    const midFade = engine.audible();
    expect(midFade).toBeGreaterThan(0.2);
    expect(midFade).toBeLessThan(USER_MASTER);

    SleepTimer.cancel();
    expect(SleepTimer.isRunning()).toBe(false);
    expect(sets.at(-1)).toBeNull();

    // The restore is itself a 1.5 s ramp, so it is not instant...
    expect(engine.audible()).toBeLessThan(USER_MASTER);
    // ...but it arrives, and at the user's level, not at the faded level.
    vi.advanceTimersByTime(1_500);
    expect(engine.audible()).toBeCloseTo(USER_MASTER, 5);
  });

  it('stops the countdown dead — no further ticks, no done', () => {
    SleepTimer.start(2);
    vi.advanceTimersByTime(10_000);
    const seen = ticks.length;

    SleepTimer.cancel();
    vi.advanceTimersByTime(300_000);

    expect(ticks.length, 'the interval survived cancel()').toBe(seen);
    expect(dones).toBe(0);
    expect(SleepTimer.getRemaining()).toBe(0);
  });

  it('leaves the volume untouched when cancelled before the fade ever armed', () => {
    SleepTimer.start(10);
    vi.advanceTimersByTime(30_000);
    SleepTimer.cancel();

    vi.advanceTimersByTime(5_000);
    expect(engine.audible()).toBe(USER_MASTER);
  });
});

describe('the chime is opt-in', () => {
  it('stays silent at the deadline by default', () => {
    SleepTimer.start(1);
    vi.advanceTimersByTime(60_000);

    expect(dones).toBe(1);
    expect(engine.chimesHeard, 'an unrequested chime sounded at the end of a sleep timer').toBe(0);
  });

  it('sounds exactly once when it was asked for', () => {
    SleepTimer.start(1, { chime: true });
    vi.advanceTimersByTime(60_000);

    // Two-sided: heard, and heard once. A chime per tick would be a nightmare.
    expect(engine.chimesHeard).toBe(1);

    vi.advanceTimersByTime(300_000);
    expect(engine.chimesHeard).toBe(1);
  });
});
