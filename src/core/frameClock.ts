/**
 * The app's frame clock. There is exactly one, and that is the whole point.
 *
 * WHY THIS MODULE EXISTS
 * `requestAnimationFrame` hands its callback `performance.now()` — milliseconds
 * since the app started, not since 1970. Twice on this project a rAF loop
 * seeded its "previous frame" reference with `Date.now()` instead, so the first
 * delta came out at about -1.75e12 ms. The accumulator went that far negative
 * and could never climb back to a frame boundary at ~16 ms a frame, so the loop
 * ran forever and never painted once: every scene anyone saw was a still frame
 * from the paused path, the sheep never walked, and the breathing circle sat
 * frozen at its minimum reading "Ready". Both builds were green. Both shipped.
 *
 * It shipped twice because the accumulator was WRITTEN twice — once in
 * `src/scenes/SceneView.tsx` and once in `src/ui/overlays/BreathingOverlay.tsx`
 * — and a fix to one copy taught the other copy nothing. So the fix here is not
 * a better comment on each copy. It is that a caller can no longer seed
 * anything at all: `step(now)` takes the rAF timestamp and nothing else, the
 * previous-frame reference is private, and the only way to start or restart a
 * loop is `reset()`, which seeds the sentinel itself. There is no third site
 * for this bug to hide in, because there is no longer a second one.
 *
 * UNITS, stated once, because mixing them is the entire bug class:
 *   - `frameMs` and `maxFrameMs` are MILLISECONDS. That is what rAF speaks.
 *   - `step()` returns SECONDS. That is what the scene integrates in —
 *     `renderer.advance(dt)` does `env.time += dt` and eases intensity by
 *     `dt * 2.5` per second. The single ms-to-seconds conversion in this app
 *     happens on one line below, and it is under test.
 *
 * This module is pure: no imports, no `Date.now()`, no `performance.now()`, no
 * React, no native module. It cannot read a clock; it can only be told the time.
 */

export interface FrameClockOptions {
  /** Minimum milliseconds between painted frames. The frame-rate cap. */
  frameMs: number;
  /**
   * A gap longer than this was a stall — a GC pause, a backgrounded app, a slow
   * native call — and integrating it would teleport every particle across the
   * screen in one frame. Report this instead of the real gap.
   */
  maxFrameMs: number;
}

export interface FrameClock {
  /**
   * Feed this the timestamp `requestAnimationFrame` gave you, every frame.
   *
   * Returns the time to advance the animation by, IN SECONDS, or `null` when
   * this frame falls inside the cap and must not paint. The caller's only job
   * is `const dt = clock.step(now); if (dt === null) return;`.
   */
  step(now: number): number | null;
  /**
   * Seed the clock for a loop that is about to start. Call this in `startLoop`,
   * never anywhere else, and never with a timestamp — that is exactly the
   * mistake this module was built to make unavailable.
   *
   * A freshly created clock is already in this state, so a loop that starts
   * once and never stops need not call it. A loop that stops and restarts must:
   * it discards however far the clock ran while the loop was cancelled, and it
   * primes the accumulator so the first frame after a restart paints
   * immediately rather than costing a frame of black.
   */
  reset(): void;
}

export function createFrameClock({ frameMs, maxFrameMs }: FrameClockOptions): FrameClock {
  /**
   * The timestamp of the previous frame, or -1 for "there was no previous
   * frame". The first callback of a loop has nothing to measure against, and
   * guessing costs one frame of motion at most — whereas guessing with a clock
   * from a different epoch cost this project two shipped bugs.
   */
  let last = -1;
  /** Milliseconds banked since the last painted frame. */
  let acc = frameMs;

  return {
    step(now: number): number | null {
      const deltaMs = last < 0 ? 0 : now - last;
      last = now;
      acc += deltaMs;
      if (acc < frameMs) return null;
      const dt = Math.min(acc, maxFrameMs) / 1000;
      acc = 0;
      return dt;
    },

    reset(): void {
      last = -1;
      acc = frameMs;
    },
  };
}
