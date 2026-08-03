/**
 * The full-screen scene canvas, and the app's only animation clock.
 *
 * Capped at 24fps by `src/core/frameClock.ts`: at bedtime nobody is counting
 * frames, and the difference between 24 and 60 over eight hours is battery.
 * The accumulator used to be hand-rolled here and hand-rolled again in
 * BreathingOverlay, which is precisely why the same clock bug shipped twice —
 * read that module's header before touching any of this.
 * The loop is FULLY cancelled — not just skipped — whenever the scene is
 * paused (audio stopped or bedside on), the app is backgrounded, or reduced
 * motion is on; each of those instead paints one still composition. That
 * guarantee is the whole battery story of an app that runs all night, and
 * nothing below is allowed to weaken it: the clock is still an ordinary rAF
 * loop on the JS thread, started and cancelled by exactly the same rules.
 *
 * What DID change is where the composed picture goes. It used to live in React
 * state, which meant every one of those 24 frames a second cost an app render,
 * a second full react-reconciler pass inside Skia (renderer/Canvas.js re-runs
 * `root.render(children)` whenever the children element identity changes), a
 * torn-down and rebuilt ReanimatedRecorder, a re-visit of the scene graph and
 * a runOnUI dispatch. Handing the picture to <Picture/> as a Reanimated shared
 * value instead makes Skia register it once (ReanimatedRecorder.
 * processAnimationValues) and drive it from a UI-thread mapper: writing
 * `picture.value` repaints with zero React renders.
 *
 * Two things silently undo that, so both are load-bearing here:
 *   - the <Picture/> element must be the SAME element every render. It used to
 *     be `picture ? <Picture .../> : null`; a changing tree shape forces the
 *     reconcile back. Hence the seeded empty picture and the memoized child.
 *   - nothing else inside <Canvas> may take a plain-JS prop that changes per
 *     frame, or Skia goes back to rebuilding the recorder for it.
 */

import { Canvas, createPicture, Picture, type SkPicture } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { createFrameClock } from '../core/frameClock';
import { Ctx2D } from './canvas';
import {
  advance,
  getSceneEnv,
  isPaused,
  paintFrame,
  reducedMotion,
  reportLoopRunning,
  setViewport,
  subscribeScenes,
} from './renderer';

const FRAME_MS = 1000 / 24;
/** A frame that took longer than this was a stall; do not integrate the gap. */
const MAX_FRAME_MS = 200;

/** Draws nothing. Seeds the shared value so `picture` is never null. */
function emptyPicture(): SkPicture {
  return createPicture(() => {});
}

export function SceneView() {
  const seed = useMemo(emptyPicture, []);
  const picture = useSharedValue<SkPicture>(seed);

  const rafRef = useRef(0);
  const appActiveRef = useRef(AppState.currentState === 'active');

  // One clock per mounted view, stable for its lifetime. Worst case if React
  // ever discarded this memo mid-loop is one extra painted frame, because a
  // fresh clock and a reset clock are the same state — never the bug class.
  const clock = useMemo(
    () => createFrameClock({ frameMs: FRAME_MS, maxFrameMs: MAX_FRAME_MS }),
    [],
  );

  const render = useCallback(
    (dt: number, animate: boolean) => {
      const env = getSceneEnv();
      if (!env.w || !env.h) return;
      picture.value = createPicture(
        (canvas) => {
          const ctx = new Ctx2D(canvas);
          paintFrame(ctx, dt, animate);
          // The recording has copied every paint and snapshotted every path by
          // now, so the context's two native objects are dead. The SkPicture
          // itself is NOT disposed anywhere: the shared value hands it to the
          // UI thread, which may still be reading it, and dispose() flips a
          // flag on the instance both runtimes share.
          ctx.dispose();
        },
        { width: env.w, height: env.h },
      );
    },
    [picture],
  );

  const frame = useCallback(
    (now: number) => {
      rafRef.current = requestAnimationFrame(frame);
      // `now` is whatever rAF handed us and it goes straight to the clock,
      // unexamined. null means this frame is inside the 24fps cap.
      const dt = clock.step(now);
      if (dt === null) return;
      // dt is in SECONDS, which is what advance() integrates in.
      advance(dt);
      render(dt, true);
    },
    [clock, render],
  );

  const stopLoop = useCallback(() => {
    if (!rafRef.current) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    reportLoopRunning(false);
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current) return;
    // Discards however far the clock ran while the loop was cancelled, and
    // primes it so the first frame paints immediately. There is deliberately no
    // timestamp to pass: seeding this from the wall clock is the bug that
    // shipped twice, and src/core/frameClock.ts now owns the seed.
    clock.reset();
    reportLoopRunning(true);
    rafRef.current = requestAnimationFrame(frame);
  }, [clock, frame]);

  useEffect(() => {
    const evaluate = () => {
      const env = getSceneEnv();
      if (!env.w || !env.h) return;
      if (!appActiveRef.current || isPaused() || reducedMotion()) {
        stopLoop();
        render(0, false);
      } else {
        startLoop();
      }
    };

    evaluate();
    const unsubscribe = subscribeScenes(evaluate);
    const appSub = AppState.addEventListener('change', (state) => {
      appActiveRef.current = state === 'active';
      evaluate();
    });

    return () => {
      unsubscribe();
      appSub.remove();
      stopLoop();
    };
  }, [render, startLoop, stopLoop]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewport(width, height);
  }, []);

  // Stable across every render of this component AND of everything above it —
  // Root re-renders on scroll, and an unmemoized child here would hand Skia a
  // new element each time and cost a full reconcile plus a recorder rebuild.
  const child = useMemo(() => <Picture picture={picture} />, [picture]);

  return (
    <View style={styles.fill} pointerEvents="none" onLayout={onLayout}>
      <Canvas style={styles.canvas} opaque>
        {child}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  canvas: {
    flex: 1,
  },
});
