/**
 * Canvas scene renderer. FROZEN CONTRACT:
 *   Scenes.attach(canvas)
 *   Scenes.setScene('rain'|'embers'|'waves'|'stars')
 *   Scenes.setIntensity(0..1)
 *   Scenes.setNightMode(bool)
 *   Scenes.pause() / Scenes.resume()
 *
 * This runs all night on a phone, so:
 *   - the loop is capped at ~24fps with a frame-time accumulator,
 *   - devicePixelRatio is clamped to 1.5,
 *   - particle counts scale with viewport area,
 *   - the rAF loop is fully cancelled when hidden / paused,
 *   - prefers-reduced-motion (or the reduceMotion setting) renders one still frame.
 */

import { getSettings } from '../core/store.js';
import { rain } from './rain.js';
import { embers } from './embers.js';
import { waves } from './waves.js';
import { stars } from './stars.js';

const SCENES = { rain, embers, waves, stars };
const FRAME_MS = 1000 / 24;
const MAX_DPR = 1.5;

const env = {
  w: 0,
  h: 0,
  dpr: 1,
  intensity: 0.6,
  targetIntensity: 0.6,
  night: false,
  time: 0,
  area: 1,
};

let canvas = null;
let ctx = null;
let current = null;
let currentName = 'rain';
let raf = 0;
let last = 0;
let acc = 0;
let paused = true;
let attached = false;
let resizeTimer = null;
let mq = null;

/* --------------------------------------------------------------- helpers */

function reducedMotion() {
  if (mq?.matches) return true;
  try {
    return getSettings().reduceMotion === true;
  } catch {
    return false;
  }
}

function applyAccent(scene) {
  const root = document.documentElement;
  if (!scene || !root) return;
  root.style.setProperty('--accent', scene.accent);
  root.style.setProperty('--accent-soft', scene.accentSoft);
  root.style.setProperty('--scene-top', scene.top);
  root.style.setProperty('--scene-bottom', scene.bottom);
  root.dataset.scene = scene.id;
}

function sizeCanvas() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width || window.innerWidth));
  const h = Math.max(1, Math.round(rect.height || window.innerHeight));
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

  env.w = w;
  env.h = h;
  env.dpr = dpr;
  env.area = (w * h) / (390 * 844); // one "phone" of area

  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  current?.resize?.(env);
}

function onResize() {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    resizeTimer = null;
    sizeCanvas();
    if (paused || reducedMotion()) drawStill();
  }, 140);
}

function nightPass() {
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

function drawStill() {
  if (!ctx || !current) return;
  ctx.save();
  ctx.clearRect(0, 0, env.w, env.h);
  (current.drawStill || current.draw).call(current, ctx, env, 0);
  ctx.restore();
  nightPass();
}

/* ------------------------------------------------------------------ loop */

function frame(now) {
  raf = requestAnimationFrame(frame);
  const dtMs = now - last;
  last = now;
  acc += dtMs;
  if (acc < FRAME_MS) return;
  const dt = Math.min(acc, 200) / 1000;
  acc = 0;

  env.time += dt;
  // Ease intensity changes so a slider drag does not snap the scene.
  env.intensity += (env.targetIntensity - env.intensity) * Math.min(1, dt * 2.5);

  ctx.save();
  current.draw(ctx, env, dt);
  ctx.restore();
  nightPass();
}

function startLoop() {
  if (raf || !ctx || !current) return;
  if (document.hidden) return;
  if (reducedMotion()) {
    drawStill();
    return;
  }
  last = performance.now();
  acc = FRAME_MS;
  raf = requestAnimationFrame(frame);
}

function stopLoop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

/* ------------------------------------------------------------------- API */

export const Scenes = {
  attach(el) {
    if (!el) return;
    canvas = el;
    ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) return;

    if (!attached) {
      attached = true;
      mq = window.matchMedia?.('(prefers-reduced-motion: reduce)') || null;
      mq?.addEventListener?.('change', () => {
        if (reducedMotion()) {
          stopLoop();
          drawStill();
        } else if (!paused) {
          startLoop();
        }
      });
      window.addEventListener('resize', onResize, { passive: true });
      window.addEventListener('orientationchange', onResize, { passive: true });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopLoop();
        else if (!paused) startLoop();
      });
    }

    current = SCENES[currentName] || rain;
    applyAccent(current);
    sizeCanvas();
    current.init?.(env);
    drawStill();
  },

  setScene(name) {
    const next = SCENES[name];
    if (!next) return;
    currentName = name;
    current = next;
    applyAccent(next);
    if (env.w) {
      next.init?.(env);
      if (paused || reducedMotion()) drawStill();
    }
  },

  getScene() {
    return currentName;
  },

  setIntensity(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    env.targetIntensity = Math.max(0, Math.min(1, n));
    if (paused || reducedMotion()) {
      env.intensity = env.targetIntensity;
      drawStill();
    }
  },

  setNightMode(on) {
    env.night = !!on;
    if (paused || reducedMotion()) drawStill();
  },

  pause() {
    paused = true;
    stopLoop();
    // Settle to a still composition rather than freezing mid-animation.
    drawStill();
  },

  resume() {
    paused = false;
    if (reducedMotion()) {
      drawStill();
      return;
    }
    startLoop();
  },

  isRunning() {
    return raf !== 0;
  },
};
