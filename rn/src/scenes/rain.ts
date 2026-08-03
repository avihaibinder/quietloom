/**
 * Rain — three parallax layers of streaks, a slow wind slant, and an
 * occasional lightning tint. Each layer is stroked as a single path so the
 * whole scene costs four draw calls a frame.
 */

import { Gradient2D, type Ctx2D } from './canvas';
import type { SceneEnv, SceneModule } from './types';

interface LayerSpec {
  base: number;
  speed: number;
  len: [number, number];
  width: number;
  alpha: number;
  slant: number;
}

const LAYER_SPEC: LayerSpec[] = [
  { base: 90, speed: 210, len: [7, 15], width: 0.7, alpha: 0.1, slant: 0.1 },
  { base: 54, speed: 370, len: [15, 27], width: 1.0, alpha: 0.17, slant: 0.13 },
  { base: 24, speed: 620, len: [26, 50], width: 1.5, alpha: 0.26, slant: 0.16 },
];

interface Drop {
  x: number;
  y: number;
  len: number;
  v: number;
}

interface DropLayer {
  spec: LayerSpec;
  drops: Drop[];
}

let layers: DropLayer[] = [];
let bg: Gradient2D | null = null;
let mist: Gradient2D | null = null;
let flash = 0;
let flashHue = 0;
let nextFlash = 12;

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function makeDrop(spec: LayerSpec, env: SceneEnv, seeded: boolean): Drop {
  return {
    x: Math.random() * (env.w + 120) - 60,
    y: seeded ? Math.random() * env.h : -rand(20, env.h * 0.4),
    len: rand(spec.len[0], spec.len[1]),
    v: spec.speed * rand(0.82, 1.18),
  };
}

function resetGradients(): void {
  bg = null;
  mist = null;
}

function ensureGradients(ctx: Ctx2D, env: SceneEnv): { bg: Gradient2D; mist: Gradient2D } {
  if (bg && mist) return { bg, mist };

  const b = ctx.createLinearGradient(0, 0, 0, env.h);
  b.addColorStop(0, '#0b1524');
  b.addColorStop(0.45, '#080e19');
  b.addColorStop(1, '#04060b');
  bg = b;

  const m = ctx.createLinearGradient(0, env.h * 0.45, 0, env.h);
  m.addColorStop(0, 'rgba(96,140,196,0)');
  m.addColorStop(1, 'rgba(96,140,196,0.10)');
  mist = m;

  return { bg: b, mist: m };
}

export const rain: SceneModule = {
  id: 'rain',

  init(env) {
    flash = 0;
    nextFlash = rand(6, 16);
    resetGradients();
    this.resize?.(env);
  },

  resize(env) {
    resetGradients();
    const scale = Math.max(0.45, Math.min(2.2, env.area));
    layers = LAYER_SPEC.map((spec) => {
      const count = Math.round(spec.base * scale);
      const drops: Drop[] = [];
      for (let i = 0; i < count; i += 1) drops.push(makeDrop(spec, env, true));
      return { spec, drops };
    });
  },

  draw(ctx, env, dt) {
    const grads = ensureGradients(ctx, env);

    ctx.fillStyle = grads.bg;
    ctx.fillRect(0, 0, env.w, env.h);

    // lightning bookkeeping
    nextFlash -= dt;
    if (nextFlash <= 0) {
      flash = 1;
      flashHue = rand(0.85, 1.15);
      nextFlash = rand(11, 30);
    }
    if (flash > 0) flash = Math.max(0, flash - dt * 2.4);

    if (flash > 0) {
      const a = flash * flash * 0.16;
      ctx.fillStyle = `rgba(${Math.round(150 * flashHue)}, ${Math.round(176 * flashHue)}, 224, ${a})`;
      ctx.fillRect(0, 0, env.w, env.h);
    }

    const density = 0.3 + 0.7 * env.intensity;
    const boost = 1 + flash * 0.9;

    for (const layer of layers) {
      const { spec, drops } = layer;
      const shown = Math.max(1, Math.round(drops.length * density));
      ctx.beginPath();
      for (let i = 0; i < shown; i += 1) {
        const d = drops[i];
        d.y += d.v * dt * (0.6 + 0.6 * env.intensity);
        d.x += d.v * spec.slant * dt;
        if (d.y - d.len > env.h || d.x > env.w + 60) {
          d.x = Math.random() * (env.w + 120) - 60;
          d.y = -rand(10, 120);
          d.len = rand(spec.len[0], spec.len[1]);
        }
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.len * spec.slant, d.y - d.len);
      }
      ctx.strokeStyle = `rgba(178, 206, 240, ${Math.min(0.6, spec.alpha * boost)})`;
      ctx.lineWidth = spec.width;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    ctx.fillStyle = grads.mist;
    ctx.fillRect(0, env.h * 0.45, env.w, env.h * 0.55);
  },

  drawStill(ctx, env) {
    const grads = ensureGradients(ctx, env);
    ctx.fillStyle = grads.bg;
    ctx.fillRect(0, 0, env.w, env.h);

    // a soft, still veil of falling light instead of frozen droplets
    const veil = ctx.createLinearGradient(0, 0, env.w * 0.35, env.h);
    veil.addColorStop(0, 'rgba(127,168,221,0.07)');
    veil.addColorStop(0.5, 'rgba(127,168,221,0.02)');
    veil.addColorStop(1, 'rgba(127,168,221,0.06)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, env.w, env.h);

    ctx.fillStyle = grads.mist;
    ctx.fillRect(0, env.h * 0.45, env.w, env.h * 0.55);
  },
};
