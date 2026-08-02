/**
 * Embers — rising, flickering particles over a warm bed of light, with a heavy
 * vignette. Glow is drawn from one pre-rendered sprite so we never build a
 * radial gradient per particle per frame.
 */

let sprite = null;
const SPRITE_SIZE = 64;

let parts = [];
let bg = null;
let vignette = null;
let glow = null;

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function buildSprite() {
  if (sprite) return;
  const c = document.createElement('canvas');
  c.width = SPRITE_SIZE;
  c.height = SPRITE_SIZE;
  const g = c.getContext('2d');
  const r = SPRITE_SIZE / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(255,236,196,1)');
  grad.addColorStop(0.22, 'rgba(255,178,86,0.85)');
  grad.addColorStop(0.55, 'rgba(224,116,40,0.28)');
  grad.addColorStop(1, 'rgba(180,70,20,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  sprite = c;
}

function makePart(env, seeded) {
  const size = rand(1.6, 5.4);
  return {
    x: rand(env.w * 0.12, env.w * 0.88),
    y: seeded ? rand(0, env.h) : env.h + rand(0, 60),
    size,
    v: rand(14, 46) * (1 + (5.4 - size) * 0.08),
    quietloom: rand(-9, 9),
    wob: rand(0, Math.PI * 2),
    wobSpeed: rand(0.5, 1.6),
    flick: rand(0, Math.PI * 2),
    flickSpeed: rand(3, 9),
    life: rand(0.5, 1),
  };
}

function resetGradients() {
  bg = null;
  vignette = null;
  glow = null;
}

function ensureGradients(ctx, env) {
  if (bg && vignette && glow) return;
  bg = ctx.createLinearGradient(0, 0, 0, env.h);
  bg.addColorStop(0, '#07060a');
  bg.addColorStop(0.55, '#0d0805');
  bg.addColorStop(1, '#160a04');

  glow = ctx.createRadialGradient(
    env.w * 0.5,
    env.h * 1.02,
    0,
    env.w * 0.5,
    env.h * 1.02,
    Math.max(env.w, env.h) * 0.7,
  );
  glow.addColorStop(0, 'rgba(255,146,48,0.30)');
  glow.addColorStop(0.4, 'rgba(214,94,26,0.12)');
  glow.addColorStop(1, 'rgba(160,60,14,0)');

  const r = Math.max(env.w, env.h) * 0.78;
  vignette = ctx.createRadialGradient(env.w * 0.5, env.h * 0.55, r * 0.28, env.w * 0.5, env.h * 0.55, r);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.72)');
}

export const embers = {
  id: 'embers',
  accent: '#e59a55',
  accentSoft: 'rgba(229,154,85,0.16)',
  top: '#160a04',
  bottom: '#07060a',

  init(env) {
    buildSprite();
    resetGradients();
    this.resize(env);
  },

  resize(env) {
    resetGradients();
    const scale = Math.max(0.45, Math.min(2.2, env.area));
    const count = Math.round(58 * scale);
    parts = [];
    for (let i = 0; i < count; i += 1) parts.push(makePart(env, true));
  },

  draw(ctx, env, dt) {
    ensureGradients(ctx, env);

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, env.w, env.h);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, env.w, env.h);

    const shown = Math.max(4, Math.round(parts.length * (0.35 + 0.65 * env.intensity)));
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < shown; i += 1) {
      const p = parts[i];
      p.y -= p.v * dt * (0.55 + 0.75 * env.intensity);
      p.wob += p.wobSpeed * dt;
      p.flick += p.flickSpeed * dt;
      p.x += (p.quietloom + Math.sin(p.wob) * 12) * dt;

      const h = env.h || 1;
      const rise = 1 - p.y / h; // 0 at the bottom, 1 at the top
      const fade = Math.max(0, 1 - Math.max(0, rise - 0.35) / 0.65);
      const flicker = 0.62 + 0.38 * Math.sin(p.flick);
      const a = p.life * fade * flicker * (0.35 + 0.65 * env.intensity);

      if (a > 0.01) {
        const s = p.size * 6;
        ctx.globalAlpha = Math.min(1, a);
        ctx.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s);
      }

      if (p.y < -30 || p.x < -40 || p.x > env.w + 40) {
        Object.assign(p, makePart(env, false));
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, env.w, env.h);
  },

  drawStill(ctx, env) {
    ensureGradients(ctx, env);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, env.w, env.h);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, env.w, env.h);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, env.w, env.h);
  },
};
