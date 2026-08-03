/**
 * The full-screen scene canvas, and the app's only animation clock.
 *
 * Capped at 24fps by a frame-time accumulator: at bedtime nobody is counting
 * frames, and the difference between 24 and 60 over eight hours is battery.
 * The loop is FULLY cancelled — not just skipped — whenever the scene is
 * paused (audio stopped or bedside on), the app is backgrounded, or reduced
 * motion is on; each of those instead paints one still composition.
 */

import { Canvas, createPicture, Picture, type SkPicture } from '@shopify/react-native-skia';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

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

export function SceneView() {
  const [picture, setPicture] = useState<SkPicture | null>(null);

  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const accRef = useRef(0);
  const appActiveRef = useRef(AppState.currentState === 'active');

  const render = useCallback((dt: number, animate: boolean) => {
    const env = getSceneEnv();
    if (!env.w || !env.h) return;
    setPicture(
      createPicture(
        (canvas) => {
          paintFrame(new Ctx2D(canvas), dt, animate);
        },
        { width: env.w, height: env.h },
      ),
    );
  }, []);

  const frame = useCallback(
    (now: number) => {
      rafRef.current = requestAnimationFrame(frame);
      // -1 is "no previous frame". The first callback of a loop has nothing to
      // measure against, and guessing costs a frame of motion at most.
      const dtMs = lastRef.current < 0 ? 0 : now - lastRef.current;
      lastRef.current = now;
      accRef.current += dtMs;
      if (accRef.current < FRAME_MS) return;
      const dt = Math.min(accRef.current, MAX_FRAME_MS) / 1000;
      accRef.current = 0;
      advance(dt);
      render(dt, true);
    },
    [render],
  );

  const stopLoop = useCallback(() => {
    if (!rafRef.current) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    reportLoopRunning(false);
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current) return;
    // NOT Date.now(). requestAnimationFrame hands `frame` performance.now() —
    // milliseconds since the app started, not since 1970 — so seeding this with
    // the wall clock made the first dtMs about -1.75e12. The accumulator went
    // that far negative and never climbed back to a frame boundary, so the loop
    // ran forever without ever painting: every scene anyone saw was a still
    // frame from the paused path, and the sheep never got to walk.
    lastRef.current = -1;
    // Prime the accumulator so the first frame paints immediately.
    accRef.current = FRAME_MS;
    reportLoopRunning(true);
    rafRef.current = requestAnimationFrame(frame);
  }, [frame]);

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

  return (
    <View style={styles.fill} pointerEvents="none" onLayout={onLayout}>
      <Canvas style={styles.canvas} opaque>
        {picture ? <Picture picture={picture} /> : null}
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
