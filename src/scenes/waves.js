/**
 * Waves — horizontal sine bands whose crest period is locked to 10 seconds.
 *
 * That is not a design choice: the ocean layer's swell is 0.1 Hz, which is the
 * resonance frequency of the baroreflex and exactly six breaths a minute. The
 * bands and the audio breathe together, so you can pace off either one.
 */

export const SWELL_PERIOD = 10; // seconds — 0.1 Hz. Do not change.

const BAND_COUNT = 7;

let bands = [];
let bg = null;
let moonGlow = null;
let step = 14;

function resetGradients() {
  bg = null;
  moonGlow = null;
}

function ensureGradients(ctx, env) {
  if (bg && moonGlow) return;
  bg = ctx.createLinearGradient(0, 0, 0, env.h);
  bg.addColorStop(0, '#050a12');
  bg.addColorStop(0.42, '#06121c');
  bg.addColorStop(1, '#020509');

  moonGlow = ctx.createRadialGradient(
    env.w * 0.72,
    env.h * 0.18,
    0,
    env.w * 0.72,
    env.h * 0.18,
    Math.max(env.w, env.h) * 0.55,
  );
  moonGlow.addColorStop(0, 'rgba(120,196,196,0.16)');
  moonGlow.addColorStop(0.35, 'rgba(80,150,164,0.06)');
  moonGlow.addColorStop(1, 'rgba(40,90,110,0)');
}

function build(env) {
  bands = [];
  for (let i = 0; i < BAND_COUNT; i += 1) {
    const t = i / (BAND_COUNT - 1);
    bands.push({
      t,
      // near bands sit lower, are taller and brighter
      baseY: env.h * (0.42 + t * 0.62),
      amp: 6 + t * 26,
      wavelength: env.w * (0.75 + (1 - t) * 1.5),
      phase: t * 1.35,
      alpha: 0.05 + t * 0.16,
      swellPhase: t * 0.22,
    });
  }
  step = env.w > 720 ? 18 : 12;
}

function drawBands(ctx, env, time) {
  ensureGradients(ctx, env);

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, env.w, env.h);
  ctx.fillStyle = moonGlow;
  ctx.fillRect(0, 0, env.w, env.h);

  const amplitudeScale = 0.45 + 0.55 * env.intensity;

  for (const b of bands) {
    // one full crest-to-crest cycle every SWELL_PERIOD seconds
    const swell = Math.sin(2 * Math.PI * (time / SWELL_PERIOD + b.swellPhase));
    const lift = swell * b.amp * amplitudeScale;

    ctx.beginPath();
    ctx.moveTo(-4, env.h + 4);
    for (let x = -4; x <= env.w + step; x += step) {
      const k = (x / b.wavelength) * Math.PI * 2;
      const y =
        b.baseY +
        lift +
        Math.sin(k + b.phase + time * 0.22) * b.amp * 0.55 * amplitudeScale +
        Math.sin(k * 0.43 - time * 0.13 + b.phase) * b.amp * 0.3 * amplitudeScale;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(env.w + 4, env.h + 4);
    ctx.closePath();

    const crest = 0.5 + 0.5 * swell;
    ctx.fillStyle = `rgba(64, 138, 150, ${(b.alpha * (0.7 + 0.5 * crest)).toFixed(4)})`;
    ctx.fill();

    // a thin brighter line along the crest
    ctx.strokeStyle = `rgba(150, 220, 218, ${(0.05 + b.t * 0.1 * (0.5 + crest)).toFixed(4)})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

export const waves = {
  id: 'waves',
  accent: '#5fbdb2',
  accentSoft: 'rgba(95,189,178,0.16)',
  top: '#06121c',
  bottom: '#020509',

  init(env) {
    resetGradients();
    build(env);
  },

  resize(env) {
    resetGradients();
    build(env);
  },

  draw(ctx, env) {
    drawBands(ctx, env, env.time);
  },

  drawStill(ctx, env) {
    // Frozen at the crest — the calmest point of the cycle.
    drawBands(ctx, env, SWELL_PERIOD * 0.25);
  },
};
