/**
 * Scene controller. FROZEN CONTRACT:
 *   Scenes.setScene('rain'|'embers'|'waves'|'stars'|'moonrise')
 *   Scenes.setIntensity(0..1)
 *   Scenes.setNightMode(bool)
 *   Scenes.setHidden(bool)            (additive)
 *   Scenes.pause() / Scenes.resume()
 *   Scenes.getScene() / Scenes.isRunning()
 *   Scenes.refresh()
 *
 * This holds the scene state and composes a frame; SceneView owns the only
 * clock and calls in. That split is deliberate — the state has to be readable
 * synchronously by non-React callers (the UI's moon tap, bedside mode), and the
 * loop has to be a React effect so it can be torn down with the view.
 *
 * This runs all night on a phone, so:
 *   - the loop is capped at ~24fps with a frame-time accumulator (SceneView),
 *   - particle counts scale with viewport area,
 *   - offscreen sprites are supersampled at most 2x, not at device ratio,
 *   - the loop is fully cancelled when paused / backgrounded,
 *   - reduced motion (the setting OR the OS switch) renders one still frame.
 *
 * Unlike the web renderer this no longer pushes accent colours anywhere: the
 * per-scene palette lives in ui/theme.ts and the UI reads it with useSceneAccent.
 */

import { AccessibilityInfo, PixelRatio } from 'react-native';

import { getSettings } from '../core/store';
import type { SceneId } from '../types';
// Tokens only, and the one direction this module reads the UI's palette: the
// backdrop below is the same gradient the mixer's accent is derived from, so
// keeping a second copy here would be a colour drift waiting to happen.
// theme.ts imports nothing but types, so there is no cycle.
import { SCENE_ACCENTS } from '../ui/theme';
import type { Ctx2D, Gradient2D } from './canvas';
import { embers } from './embers';
import { moonrise } from './moonrise';
import { rain } from './rain';
import { stars } from './stars';
import type { SceneEnv, SceneModule } from './types';
import { waves } from './waves';

const SCENES: Record<SceneId, SceneModule> = { rain, embers, waves, stars, moonrise };

/** One "phone" of area — particle counts are quoted against this. */
const REFERENCE_AREA = 390 * 844;

/** Sprite supersampling ceiling. Memory, not sharpness, is the constraint. */
const MAX_SPRITE_SCALE = 2;

const env: SceneEnv = {
  w: 0,
  h: 0,
  dpr: 1,
  intensity: 0.6,
  targetIntensity: 0.6,
  night: false,
  time: 0,
  area: 1,
};

let currentName: SceneId = 'rain';
let current: SceneModule = rain;
let paused = true;
let hidden = false;
let loopRunning = false;
let systemReduceMotion = false;
let version = 0;

/**
 * The backdrop gradient, built once per scene and viewport.
 *
 * Same caching rule as every scene's own gradients: a Gradient2D is a plain
 * descriptor that builds its SkShader on first use and memoizes it, so it
 * outlives the per-frame Ctx2D and must be invalidated by hand when either the
 * colours (setScene) or the height it was measured against (setViewport)
 * change. Null means "rebuild on the next paint".
 */
let backdrop: Gradient2D | null = null;

const listeners = new Set<() => void>();

function notify(): void {
  version += 1;
  for (const fn of [...listeners]) fn();
}

/** Subscribe to anything that changes what should be on screen. */
export function subscribeScenes(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getScenesVersion(): number {
  return version;
}

export function getSceneEnv(): SceneEnv {
  return env;
}

export function isPaused(): boolean {
  return paused;
}

/**
 * Is the scene off screen entirely? True while the mixer is up: that screen
 * gets the flat backdrop below instead of a sleepscape, so there is nothing to
 * animate and SceneView cancels its loop exactly as it does for `paused`.
 */
export function isHidden(): boolean {
  return hidden;
}

/** The setting or the OS switch. Either one means completely still. */
export function reducedMotion(): boolean {
  if (systemReduceMotion) return true;
  try {
    return getSettings().reduceMotion === true;
  } catch {
    return false;
  }
}

AccessibilityInfo.isReduceMotionEnabled()
  .then((on) => {
    systemReduceMotion = on;
    notify();
  })
  .catch(() => {
    /* the query is best-effort; the in-app setting still applies */
  });

AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => {
  systemReduceMotion = on;
  notify();
});

/** Called by SceneView on layout. Rebuilds whatever depends on the viewport. */
export function setViewport(w: number, h: number): void {
  const width = Math.max(1, Math.round(w));
  const height = Math.max(1, Math.round(h));
  if (width === env.w && height === env.h) return;

  const first = env.w === 0;
  env.w = width;
  env.h = height;
  env.dpr = Math.min(PixelRatio.get(), MAX_SPRITE_SCALE);
  env.area = (width * height) / REFERENCE_AREA;
  backdrop = null; // measured against env.h

  if (first) current.init?.(env);
  else current.resize?.(env);
  notify();
}

/** Advance the clock. Called once per rendered frame by SceneView. */
export function advance(dt: number): void {
  env.time += dt;
  // Ease intensity changes so a slider drag does not snap the scene.
  env.intensity += (env.targetIntensity - env.intensity) * Math.min(1, dt * 2.5);
}

/**
 * Bedside: multiply the whole frame down to red, then darken hard. Red
 * suppresses melatonin far less than blue or white (research.md §9).
 */
function nightPass(ctx: Ctx2D): void {
  if (!env.night) return;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = '#ff5326';
  ctx.fillRect(0, 0, env.w, env.h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(0, 0, env.w, env.h);
  ctx.restore();
}

/**
 * The mixer's background: the current scene's own top/bottom tones as a still
 * vertical gradient, and nothing else — no moon, no stars, no particles.
 *
 * It reads from SCENE_ACCENTS, which is also where the mixer's accent colour
 * comes from, so the backdrop and the play button stay the same family as the
 * preset changes underneath them.
 */
function paintBackdrop(ctx: Ctx2D): void {
  if (!backdrop) {
    const { top, bottom } = SCENE_ACCENTS[currentName];
    const g = ctx.createLinearGradient(0, 0, 0, env.h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    backdrop = g;
  }
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, env.w, env.h);
}

/** Compose one frame. `animate: false` draws the scene's still composition. */
export function paintFrame(ctx: Ctx2D, dt: number, animate: boolean): void {
  if (!env.w || !env.h) return;

  // Hidden wins over everything. The scene module is not consulted at all —
  // not draw, not drawStill — so the mixer costs one gradient rect and the
  // scene's particles, sprites and clocks sit idle until a surface that
  // actually shows them comes up.
  if (hidden) {
    paintBackdrop(ctx);
    // Unreachable while `hidden` only ever means "the mixer is up" and `night`
    // only ever means bedside. Kept so the two stay composable if that changes.
    nightPass(ctx);
    return;
  }

  ctx.save();
  if (animate) current.draw(ctx, env, dt);
  else if (current.drawStill) current.drawStill(ctx, env);
  else current.draw(ctx, env, 0);
  ctx.restore();
  nightPass(ctx);
}

/** SceneView reports whether its loop is live, so isRunning() stays honest. */
export function reportLoopRunning(running: boolean): void {
  loopRunning = running;
}

export const Scenes = {
  setScene(name: SceneId): void {
    const next = SCENES[name];
    if (!next) return;
    // Re-selecting the scene that is already on screen used to re-run init():
    // for moonrise that is nine offscreen raster surfaces, 42 shaders, 76
    // paths and four Gaussian blurs, synchronously on the JS thread, for no
    // visible change. Tapping the current preset is a normal thing to do.
    if (next === current) return;
    currentName = name;
    current = next;
    backdrop = null; // different scene, different tones
    if (env.w) next.init?.(env);
    notify();
  },

  getScene(): SceneId {
    return currentName;
  },

  setIntensity(v: number): void {
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    env.targetIntensity = Math.max(0, Math.min(1, n));
    // Nothing is easing toward the target while still, so land on it directly.
    if (paused || reducedMotion()) {
      env.intensity = env.targetIntensity;
      notify();
    }
  },

  setNightMode(on: boolean): void {
    env.night = !!on;
    notify();
  },

  /**
   * Take the scene off screen (true) or put it back (false).
   *
   * Separate from pause() on purpose, and it is not a stronger pause: paused
   * still means "the scene, held still", which is a moon and a sky full of
   * stars sitting behind the mixer. Hidden means the scene is not on that
   * screen at all — see paintFrame. The composition root sets it from
   * 'screen:changed', so welcome, bedside and breathing keep their sleepscape
   * and the mixer does not.
   */
  setHidden(on: boolean): void {
    const next = !!on;
    if (next === hidden) return;
    hidden = next;
    notify();
  },

  pause(): void {
    if (paused) return;
    paused = true;
    // Settle to a still composition rather than freezing mid-animation.
    notify();
  },

  resume(): void {
    if (!paused) return;
    paused = false;
    notify();
  },

  /**
   * Re-ask "what should be on screen?" without changing anything here.
   *
   * The in-app reduced-motion setting lives in the store, not in this module,
   * so flipping it changes the answer to reducedMotion() with nothing to
   * notify anybody. pause()/resume() cannot stand in: both early-return when
   * the state is already what was asked for, so turning reduced motion ON
   * while audio is playing left the loop running at 24fps until some unrelated
   * event happened to fire — all night, if nothing did.
   *
   * Whoever writes settings.reduceMotion must call this immediately after.
   */
  refresh(): void {
    notify();
  },

  isRunning(): boolean {
    return loopRunning;
  },
};
