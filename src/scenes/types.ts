/**
 * Scene contracts. A scene is a plain object with a draw loop — no React, no
 * timers of its own. The renderer owns the only clock there is (an all-night
 * app cannot afford a second one) and hands `dt` in.
 */

import type { SceneId } from '../types';
import type { Ctx2D } from './canvas';

export interface SceneEnv {
  /** Viewport in dp. */
  w: number;
  h: number;
  /**
   * Sprite supersampling factor. Skia renders the live canvas at native
   * resolution by itself, but an offscreen sprite is a fixed pixel buffer, so
   * anything blitted 1:1 (the moon, the meadow) is built at this scale and
   * drawn back down. Clamped — memory, not sharpness, is the binding constraint
   * on a phone that holds these all night.
   */
  dpr: number;
  intensity: number;
  targetIntensity: number;
  night: boolean;
  time: number;
  /** Viewport area in "one phone" units (390x844). Particle counts scale by it. */
  area: number;
}

export interface SceneModule {
  id: SceneId;
  init?(env: SceneEnv): void;
  resize?(env: SceneEnv): void;
  draw(ctx: Ctx2D, env: SceneEnv, dt: number): void;
  /** Reduced motion, paused, and bedside all land here. Optional: falls back to draw(dt=0). */
  drawStill?(ctx: Ctx2D, env: SceneEnv): void;
}
