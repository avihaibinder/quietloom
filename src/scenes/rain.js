/**
 * Rain — three parallax layers of streaks, a slow wind slant, and an
 * occasional lightning tint. Each layer is stroked as a single path so the
 * whole scene costs four draw calls a frame.
 */

const LAYER_SPEC = [
  { base: 90, speed: 210, len: [7, 15], width: 0.7, alpha: 0.1, slant: 0.1 },
  { base: 54, speed: 370, len: [15, 27], width: 1.0, alpha: 0.17, slant: 0.13 },
  { base: 24, speed: 620, len: [26, 50], width: 1.5, alpha: 0.26, slant: 0.16 },
];

let layers = [];
let bg = null;
let mist = null;
let flash = 0;
let flashHue = 0;
let nextFlash = 12;
let clock = 0;

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function makeDrop(spec, env, seeded) {
  return {
    x: Math.random() * (env.w + 120) - 60,
    y: seeded ? Math.random() * env.h : -rand(20, env.h * 0.4),
    len: rand(spec.len[0], spec.len[1]),
    v: spec.speed * rand(0.82, 1.18),
  };
}

function buildGradients(env) {
  bg = null;
  mist = null;
  if (!env.w || !env.h) return;
}

function ensureGradients(ctx, env) {
  if (bg && mist) return;
  bg = ctx.createLinearGradient(0, 0, 0, env.h);
  bg.addColorStop(0, '#0b1524');
  bg.addColorStop(0.45, '#080e19');
  bg.addColorStop(1, '#04060b');

  mist = ctx.createLinearGradient(0, env.h * 0.45, 0, env.h);
  mist.addColorStop(0, 'rgba(96,140,196,0)');
  mist.addColorStop(1, 'rgba(96,140,196,0.10)');
}

export const rain = {
  id: 'rain',
  accent: '#7fa8dd',
  accentSoft: 'rgba(127,168,221,0.16)',
  top: '#0b1524',
  bottom: '#04060b',

  init(env) {
    clock = 0;
    flash = 0;
    nextFlash = rand(6, 16);
    buildGradients(env);
    this.resize(env);
  },

  resize(env) {
    buildGradients(env);
    const scale = Math.max(0.45, Math.min(2.2, env.area));
    layers = LAYER_SPEC.map((spec) => {
      const count = Math.round(spec.base * scale);
      const drops = [];
      for (let i = 0; i < count; i += 1) drops.push(makeDrop(spec, env, true));
      return { spec, drops };
    });
  },

  draw(ctx, env, dt) {
    ensureGradients(ctx, env);
    clock += dt;

    ctx.fillStyle = bg;
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

    ctx.fillStyle = mist;
    ctx.fillRect(0, env.h * 0.45, env.w, env.h * 0.55);
  },

  drawStill(ctx, env) {
    ensureGradients(ctx, env);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, env.w, env.h);

    // a soft, still veil of falling light instead of frozen droplets
    const veil = ctx.createLinearGradient(0, 0, env.w * 0.35, env.h);
    veil.addColorStop(0, 'rgba(127,168,221,0.07)');
    veil.addColorStop(0.5, 'rgba(127,168,221,0.02)');
    veil.addColorStop(1, 'rgba(127,168,221,0.06)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, env.w, env.h);

    ctx.fillStyle = mist;
    ctx.fillRect(0, env.h * 0.45, env.w, env.h * 0.55);
  },
};
