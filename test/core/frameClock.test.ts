/**
 * Map entry #2 — the frame clock.
 *
 * This is the arithmetic behind the only bug class that has shipped on this
 * project TWICE: a rAF loop whose "previous frame" reference was seeded from
 * `Date.now()` while the loop was fed `performance.now()`. The first delta came
 * out at about -1.75e12 ms, the accumulator went that far negative and could
 * never climb back to a frame boundary, and the loop then ran forever without
 * painting a single frame. Nothing threw. Both builds were green. The scene was
 * a still image and the breathing circle never moved, and it took a human
 * looking at a phone to notice — which is what this file is here to replace.
 *
 * Zero mocks, zero imports beyond the subject. `src/core/frameClock.ts` cannot
 * read a clock; it can only be told the time, so every test below is the real
 * arithmetic driven by a timestamp sequence, not a fake timer and not a spy.
 * Nothing here asserts that something was called.
 *
 * NOT COVERED HERE, and it needs saying: this file proves the clock. It does
 * NOT prove that either rAF loop is cancelled on stop / bedside / background /
 * reduced motion. Both loops live in .tsx files that import react-native and
 * Skia, which the unit tier deliberately cannot load, so that guarantee is
 * still held by reading the code and by a device check. A never-stopping loop
 * is worse than the bug it replaced and is invisible to this suite.
 */
import { describe, expect, it } from 'vitest';

import { createFrameClock, type FrameClockOptions } from '../../src/core/frameClock';

/** The scene canvas's real configuration — src/scenes/SceneView.tsx. */
const SCENE: FrameClockOptions = { frameMs: 1000 / 24, maxFrameMs: 200 };
/** The breathing pacer's real configuration — src/ui/overlays/BreathingOverlay.tsx. */
const PACER: FrameClockOptions = { frameMs: 1000 / 30, maxFrameMs: 200 };

/** One frame of a 60 Hz display, the rate both loops are actually driven at. */
const DISPLAY_MS = 1000 / 60;

/** Asserts this frame painted, and hands back its dt. */
function painted(dt: number | null): number {
  if (dt === null) expect.fail('this frame did not paint — the loop is dark');
  return dt;
}

/** How many of `frames` 60 Hz frames painted, starting from `t0`. */
function paintCount(options: FrameClockOptions, t0: number, frames: number): number {
  const clock = createFrameClock(options);
  let n = 0;
  for (let f = 0; f < frames; f++) {
    if (clock.step(t0 + f * DISPLAY_MS) !== null) n++;
  }
  return n;
}

describe('the first frame of a loop', () => {
  it('measures a delta of zero, whatever epoch the first timestamp comes from', () => {
    // The sentinel seed. There is no previous frame to measure against, so the
    // first delta must be 0 and the returned dt must be the primed accumulator
    // ALONE — no part of `now` may leak into it. Four wildly different epochs
    // must therefore give one identical answer.
    for (const first of [0, 8.4, 1_728_000_000, 1_754_251_234_567]) {
      const clock = createFrameClock(SCENE);
      expect(clock.step(first)).toBe(SCENE.frameMs / 1000);
    }
  });

  it('paints immediately, rather than costing a frame of black on every start', () => {
    // The accumulator is primed to a full frame, so the very first callback
    // after startLoop() paints. Both loops relied on this before S2 and both
    // still do; a restart happens every time bedside or the app foreground
    // flips, which at 3 AM is not a rare path.
    expect(createFrameClock(SCENE).step(0)).not.toBeNull();
    expect(createFrameClock(PACER).step(0)).not.toBeNull();
  });
});

describe('a monotonic feed', () => {
  it('reports dt as the elapsed time since the previous painted frame', () => {
    const clock = createFrameClock(SCENE);
    clock.step(1000); // the primed first frame

    // 50 ms apart, which is over the 41.67 ms cap, so every frame paints.
    let t = 1000;
    for (let i = 0; i < 10; i++) {
      t += 50;
      expect(painted(clock.step(t))).toBe(0.05);
    }
  });

  it('banks sub-frame gaps and reports the whole accumulated span', () => {
    const clock = createFrameClock(SCENE);
    clock.step(0); // the primed first frame, accumulator now empty

    // A 60 Hz display against a 24 fps cap: two frames are withheld, and the
    // third reports the full 48 ms since the last paint — not 16.
    expect(clock.step(16)).toBeNull();
    expect(clock.step(32)).toBeNull();
    expect(painted(clock.step(48))).toBe(0.048);
  });
});

describe('a stall', () => {
  it('clamps a 5 second stall to maxFrameMs instead of integrating the gap', () => {
    const clock = createFrameClock(SCENE);
    clock.step(1000);

    // A GC pause, a slow native call, or an app that was in the background.
    // Handing 5 to advance() would push env.time five seconds forward in one
    // frame and teleport every particle across the screen.
    const dt = painted(clock.step(6000));
    expect(dt).toBe(SCENE.maxFrameMs / 1000);
    // Spelled out in seconds, because that is the unit advance() integrates in.
    expect(dt).toBe(0.2);
  });

  it('recovers to a normal dt on the frame after the stall', () => {
    const clock = createFrameClock(SCENE);
    clock.step(1000);
    clock.step(6000); // the stall
    expect(painted(clock.step(6050))).toBe(0.05);
  });
});

describe('the epoch bug that shipped twice', () => {
  // The regression test. Under the old arithmetic the "previous frame"
  // reference was seeded from a DIFFERENT clock than the one feeding the loop,
  // so the accumulator was wrecked by a delta of ~1e12 in one direction or the
  // other. The clock now seeds itself from a sentinel and no caller can pass a
  // timestamp in, so every epoch below has to behave identically.
  const EPOCHS: ReadonlyArray<readonly [string, number]> = [
    ['a cold-started app (performance.now, single-digit ms)', 8.4],
    ['a phone up for twenty days (performance.now, 1.7e9)', 1_728_000_000],
    ['a wall clock (Date.now magnitude, 1.75e12)', 1_754_251_234_567],
  ];

  for (const [name, t0] of EPOCHS) {
    it(`paints within one frame when the first timestamp is ${name}`, () => {
      const clock = createFrameClock(SCENE);
      const first = painted(clock.step(t0));
      expect(first).toBeGreaterThanOrEqual(0);
      expect(first).toBeLessThanOrEqual(SCENE.maxFrameMs / 1000);
    });

    it(`keeps painting for 200 frames when the feed is ${name}`, () => {
      // The shipped bug painted ZERO of these, forever, in silence. Two-sided
      // on purpose: ~1 paint in 3 at 60 Hz against a 24 fps cap. A floor alone
      // would be satisfied by a clock that had stopped capping at all.
      const n = paintCount(SCENE, t0, 200);
      expect(n).toBeGreaterThanOrEqual(60);
      expect(n).toBeLessThanOrEqual(70);
    });

    it(`never returns a negative dt when the feed is ${name}`, () => {
      const clock = createFrameClock(SCENE);
      let seen = 0;
      for (let f = 0; f < 200; f++) {
        const dt = clock.step(t0 + f * DISPLAY_MS);
        if (dt !== null) {
          expect(dt).toBeGreaterThanOrEqual(0);
          seen++;
        }
      }
      // MEASURED, not decorative: without this line the test above passes
      // VACUOUSLY against the shipped bug. A dark loop returns null on every
      // frame, so "no dt was ever negative" is trivially true when no dt was
      // ever produced. I reverted frameClock.ts to the old arithmetic and
      // watched exactly these three tests stay green while fifteen went red.
      // "dt >= 0" is a one-sided bound and silence satisfies it — the same
      // shape as a level assertion that passes on a silent render.
      expect(seen).toBeGreaterThan(0);
    });
  }
});

describe('units', () => {
  it('returns SECONDS, so a simulated second of frames sums to 1 and not to 1000', () => {
    // This is the unit contract with renderer.advance(dt), which does
    // `env.time += dt` and eases intensity by `dt * 2.5` per second. Feeding it
    // milliseconds would run the scene 1000x fast rather than throw.
    const clock = createFrameClock(SCENE);
    clock.step(0); // the primed first frame is not elapsed time; exclude it

    let sum = 0;
    let frames = 0;
    for (let f = 1; f <= 60; f++) {
      const dt = clock.step(f * DISPLAY_MS);
      if (dt !== null) {
        sum += dt;
        frames++;
      }
    }

    expect(sum).toBeCloseTo(1, 10);
    // 20 paints, not 24: the accumulator resets to 0 rather than subtracting a
    // frame, so a 60 Hz display yields 20 fps. That cadence issue is REAL and
    // was ruled out of scope in FASTER; this line characterises it so the next
    // person sees it, and does not endorse it. If you fix it, this becomes 24
    // and the sum above stays 1.
    expect(frames).toBe(20);
  });
});

describe('reset', () => {
  it('re-primes, so a loop restarted after bedside or background paints at once', () => {
    const clock = createFrameClock(SCENE);
    clock.step(1000);
    expect(clock.step(1010)).toBeNull(); // mid-accumulation when the loop stops

    clock.reset();
    // The loop was cancelled for a minute. The clock jumped 60 seconds, and
    // reset() must discard that rather than clamp-and-integrate it.
    expect(clock.step(61_000)).toBe(SCENE.frameMs / 1000);
  });
});

describe('one clock, two rates', () => {
  it('gates the pacer at 30 fps and the scene at 24, from the same feed', () => {
    const scene = createFrameClock(SCENE);
    const pacer = createFrameClock(PACER);
    scene.step(0);
    pacer.step(0);

    // 34 ms is past the pacer's 33.33 ms frame but inside the scene's 41.67 ms.
    expect(scene.step(16)).toBeNull();
    expect(pacer.step(16)).toBeNull();
    expect(scene.step(34)).toBeNull();
    expect(painted(pacer.step(34))).toBe(0.034);
  });
});
