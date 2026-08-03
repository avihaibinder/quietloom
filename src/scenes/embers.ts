/**
 * Embers — rising, flickering particles over a warm bed of light, with a heavy
 * vignette. Glow is drawn from one pre-rendered sprite so we never build a
 * radial gradient per particle per frame.
 */

import { createSprite, Gradient2D, type OffscreenSprite, type Ctx2D } from './canvas';
import type { SceneEnv, SceneModule } from './types';

const SPRITE_SIZE = 64;

interface Part {
  x: number;
  y: number;
  size: number;
  v: number;
  drift: number;
  wob: number;
  wobSpeed: number;
  flick: number;
  flickSpeed: number;
  life: number;
}

let sprite: OffscreenSprite | null = null;
let parts: Part[] = [];
let bg: Gradient2D | null = null;
let vignette: Gradient2D | null = null;
let glow: Gradient2D | null = null;

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function buildSprite(): OffscreenSprite {
  if (sprite) return sprite;
  const s = createSprite(SPRITE_SIZE, SPRITE_SIZE);
  const g = s.ctx;
  const r = SPRITE_SIZE / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(255,236,196,1)');
  grad.addColorStop(0.22, 'rgba(255,178,86,0.85)');
  grad.addColorStop(0.55, 'rgba(224,116,40,0.28)');
  grad.addColorStop(1, 'rgba(180,70,20,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  sprite = s;
  return s;
}

function makePart(env: SceneEnv, seeded: boolean): Part {
  const size = rand(1.6, 5.4);
  return {
    x: rand(env.w * 0.12, env.w * 0.88),
    y: seeded ? rand(0, env.h) : env.h + rand(0, 60),
    size,
    v: rand(14, 46) * (1 + (5.4 - size) * 0.08),
    drift: rand(-9, 9),
    wob: rand(0, Math.PI * 2),
    wobSpeed: rand(0.5, 1.6),
    flick: rand(0, Math.PI * 2),
    flickSpeed: rand(3, 9),
    life: rand(0.5, 1),
  };
}

function resetGradients(): void {
  bg = null;
  vignette = null;
  glow = null;
}

function ensureGradients(
  ctx: Ctx2D,
  env: SceneEnv,
): { bg: Gradient2D; glow: Gradient2D; vignette: Gradient2D } {
  if (bg && vignette && glow) return { bg, glow, vignette };

  const b = ctx.createLinearGradient(0, 0, 0, env.h);
  b.addColorStop(0, '#07060a');
  b.addColorStop(0.55, '#0d0805');
  b.addColorStop(1, '#160a04');
  bg = b;

  const gl = ctx.createRadialGradient(
    env.w * 0.5,
    env.h * 1.02,
    0,
    env.w * 0.5,
    env.h * 1.02,
    Math.max(env.w, env.h) * 0.7,
  );
  gl.addColorStop(0, 'rgba(255,146,48,0.30)');
  gl.addColorStop(0.4, 'rgba(214,94,26,0.12)');
  gl.addColorStop(1, 'rgba(160,60,14,0)');
  glow = gl;

  const r = Math.max(env.w, env.h) * 0.78;
  const v = ctx.createRadialGradient(env.w * 0.5, env.h * 0.55, r * 0.28, env.w * 0.5, env.h * 0.55, r);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.72)');
  vignette = v;

  return { bg: b, glow: gl, vignette: v };
}

export const embers: SceneModule = {
  id: 'embers',

  init(env) {
    buildSprite();
    resetGradients();
    this.resize?.(env);
  },

  resize(env) {
    resetGradients();
    const scale = Math.max(0.45, Math.min(2.2, env.area));
    const count = Math.round(58 * scale);
    parts = [];
    for (let i = 0; i < count; i += 1) parts.push(makePart(env, true));
  },

  draw(ctx, env, dt) {
    const grads = ensureGradients(ctx, env);
    const glowSprite = buildSprite();

    ctx.fillStyle = grads.bg;
    ctx.fillRect(0, 0, env.w, env.h);
    ctx.fillStyle = grads.glow;
    ctx.fillRect(0, 0, env.w, env.h);

    const shown = Math.max(4, Math.round(parts.length * (0.35 + 0.65 * env.intensity)));
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < shown; i += 1) {
      const p = parts[i];
      p.y -= p.v * dt * (0.55 + 0.75 * env.intensity);
      p.wob += p.wobSpeed * dt;
      p.flick += p.flickSpeed * dt;
      p.x += (p.drift + Math.sin(p.wob) * 12) * dt;

      const h = env.h || 1;
      const rise = 1 - p.y / h; // 0 at the bottom, 1 at the top
      const fade = Math.max(0, 1 - Math.max(0, rise - 0.35) / 0.65);
      const flicker = 0.62 + 0.38 * Math.sin(p.flick);
      const a = p.life * fade * flicker * (0.35 + 0.65 * env.intensity);

      if (a > 0.01) {
        const s = p.size * 6;
        ctx.globalAlpha = Math.min(1, a);
        ctx.drawImage(glowSprite, p.x - s / 2, p.y - s / 2, s, s);
      }

      if (p.y < -30 || p.x < -40 || p.x > env.w + 40) {
        Object.assign(p, makePart(env, false));
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    ctx.fillStyle = grads.vignette;
    ctx.fillRect(0, 0, env.w, env.h);
  },

  drawStill(ctx, env) {
    const grads = ensureGradients(ctx, env);
    ctx.fillStyle = grads.bg;
    ctx.fillRect(0, 0, env.w, env.h);
    ctx.fillStyle = grads.glow;
    ctx.fillRect(0, 0, env.w, env.h);
    ctx.fillStyle = grads.vignette;
    ctx.fillRect(0, 0, env.w, env.h);
  },
};
