/**
 * Stars — a slow drifting starfield under a faint, wandering aurora.
 * Cheap on purpose: stars are 1-2px rects, the aurora is three cached radial
 * gradient sprites translated with the canvas transform rather than rebuilt.
 */

import { createSprite, Gradient2D, type OffscreenSprite, type Ctx2D } from './canvas';
import type { SceneEnv, SceneModule } from './types';

interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
  vx: number;
  vy: number;
  tw: number;
  twSpeed: number;
}

interface Aurora {
  x: number;
  y: number;
  r: number;
  hue: string;
  a: number;
  sx: number;
  sy: number;
  p: number;
}

let field: Star[] = [];
let bg: Gradient2D | null = null;
let aurora: Aurora[] = [];

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function resetGradients(): void {
  bg = null;
}

function ensureBg(ctx: Ctx2D, env: SceneEnv): Gradient2D {
  if (bg) return bg;
  const g = ctx.createLinearGradient(0, 0, 0, env.h);
  g.addColorStop(0, '#05060e');
  g.addColorStop(0.5, '#070915');
  g.addColorStop(1, '#03040a');
  bg = g;
  return g;
}

function build(env: SceneEnv): void {
  const scale = Math.max(0.45, Math.min(2.2, env.area));
  const count = Math.round(150 * scale);
  field = [];
  for (let i = 0; i < count; i += 1) {
    const depth = Math.random();
    field.push({
      x: Math.random() * env.w,
      y: Math.random() * env.h,
      r: 0.4 + depth * 1.3,
      a: 0.16 + depth * 0.6,
      vx: (0.9 + depth * 2.4) * 0.35,
      vy: (0.2 + depth * 0.5) * 0.14,
      tw: Math.random() * Math.PI * 2,
      twSpeed: rand(0.25, 0.9),
    });
  }

  aurora = [
    { x: 0.24, y: 0.24, r: 0.85, hue: '124,110,214', a: 0.1, sx: 0.017, sy: 0.011, p: 0 },
    { x: 0.72, y: 0.34, r: 0.7, hue: '72,150,190', a: 0.085, sx: -0.013, sy: 0.016, p: 1.9 },
    { x: 0.5, y: 0.78, r: 0.95, hue: '96,86,178', a: 0.07, sx: 0.009, sy: -0.008, p: 3.4 },
  ];
}

const tinted = new Map<string, OffscreenSprite>();

/** One 256px glow per hue, drawn scaled. Built once — resizes never add more. */
function tintSprite(hue: string): OffscreenSprite {
  const hit = tinted.get(hue);
  if (hit) return hit;
  const S = 256;
  const sprite = createSprite(S, S);
  const g = sprite.ctx;
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, `rgba(${hue},0.95)`);
  grad.addColorStop(0.4, `rgba(${hue},0.32)`);
  grad.addColorStop(1, `rgba(${hue},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  tinted.set(hue, sprite);
  return sprite;
}

function drawAurora(ctx: Ctx2D, env: SceneEnv, time: number): void {
  ctx.globalCompositeOperation = 'lighter';
  for (const a of aurora) {
    const cx = (a.x + Math.sin(time * a.sx + a.p) * 0.09) * env.w;
    const cy = (a.y + Math.cos(time * a.sy + a.p) * 0.06) * env.h;
    const rad = Math.max(env.w, env.h) * a.r;
    const pulse = 0.75 + 0.25 * Math.sin(time * 0.06 + a.p);
    ctx.globalAlpha = a.a * pulse * (0.45 + 0.55 * env.intensity);
    ctx.save();
    ctx.translate(cx - rad, cy - rad);
    ctx.drawImage(tintSprite(a.hue), 0, 0, rad * 2, rad * 2);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function drawField(ctx: Ctx2D, env: SceneEnv, dt: number, twinkle: boolean): void {
  ctx.fillStyle = '#dfe7f5';
  for (const s of field) {
    if (dt) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.tw += s.twSpeed * dt;
      if (s.x > env.w + 2) s.x = -2;
      if (s.y > env.h + 2) s.y = -2;
    }
    const a = twinkle ? s.a * (0.62 + 0.38 * Math.sin(s.tw)) : s.a * 0.85;
    ctx.globalAlpha = a * (0.5 + 0.5 * env.intensity);
    const d = s.r * 2;
    ctx.fillRect(s.x, s.y, d, d);
  }
  ctx.globalAlpha = 1;
}

export const stars: SceneModule = {
  id: 'stars',

  init(env) {
    resetGradients();
    build(env);
  },

  resize(env) {
    resetGradients();
    build(env);
  },

  draw(ctx, env, dt) {
    ctx.fillStyle = ensureBg(ctx, env);
    ctx.fillRect(0, 0, env.w, env.h);
    drawAurora(ctx, env, env.time);
    drawField(ctx, env, dt, true);
  },

  drawStill(ctx, env) {
    ctx.fillStyle = ensureBg(ctx, env);
    ctx.fillRect(0, 0, env.w, env.h);
    drawAurora(ctx, env, 0);
    drawField(ctx, env, 0, false);
  },
};
