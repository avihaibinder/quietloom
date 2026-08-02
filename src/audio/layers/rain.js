/**
 * Rain — a filtered white-noise bed plus individually scheduled droplets.
 *
 * Signal path:
 *   white loop -> highpass 400 -> lowpass (LFO wanders 3.6–9 kHz) -> bed gain -> out
 *   droplet    -> envelope gain -> one of six bandpass+pan chains          -> out
 *
 * The bed is what you hear; the droplets are what makes you believe it. The
 * lowpass wander runs on an OscillatorNode so the sheet of rain keeps moving even
 * when the JS thread is frozen; only the droplets need the scheduler.
 *
 * `intensity` (0..1) raises bed level, opens the lowpass and multiplies the
 * droplet rate from 4/s to 25/s.
 *
 * Evidence: nature water sound speeds stress recovery (research.md §3).
 */

import { getNoiseBuffer, getGrainBuffer, createBandBank, createVoicePool } from '../noise.js';
import { phasedSine } from '../onef.js';
import { poissonGap } from '../scheduler.js';

const TAU = Math.PI * 2;

const BANDS = [
  { freq: 1100, q: 8, pan: -0.75 },
  { freq: 1600, q: 8, pan: -0.4 },
  { freq: 2100, q: 9, pan: -0.1 },
  { freq: 2600, q: 8, pan: 0.18 },
  { freq: 3200, q: 9, pan: 0.48 },
  { freq: 3900, q: 8, pan: 0.8 },
];

const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));

export function createRain(ctx, { scheduler, params = {}, key = 'rain' }) {
  const t0 = ctx.currentTime;
  const p = { intensity: params.intensity == null ? 0.5 : clamp01(params.intensity) };

  const out = ctx.createGain();

  const bed = ctx.createBufferSource();
  bed.buffer = getNoiseBuffer(ctx, 'white', 'rain');
  bed.loop = true;

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 400;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.4;
  lp.frequency.setValueAtTime(cutoffFor(p.intensity), t0);

  const bedGain = ctx.createGain();
  bedGain.gain.setValueAtTime(bedLevelFor(p.intensity), t0);

  bed.connect(hp);
  hp.connect(lp);
  lp.connect(bedGain);
  bedGain.connect(out);

  const wander = ctx.createOscillator();
  wander.setPeriodicWave(phasedSine(ctx, Math.random() * TAU));
  wander.frequency.value = 0.037 + Math.random() * 0.02;
  const wanderDepth = ctx.createGain();
  wanderDepth.gain.value = 1600;
  wander.connect(wanderDepth);
  wanderDepth.connect(lp.frequency);
  wander.start(t0);

  bed.start(t0, Math.random() * bed.buffer.duration);

  const dropBus = ctx.createGain();
  dropBus.gain.setValueAtTime(dropLevelFor(p.intensity), t0);
  dropBus.connect(out);
  const bank = createBandBank(ctx, dropBus, BANDS);
  const grain = getGrainBuffer(ctx);
  const voices = createVoicePool();

  scheduler.add(
    `${key}:drops`,
    (t) => {
      const inten = p.intensity;
      const dur = 0.005 + Math.random() * 0.015;
      const peak = 0.2 + Math.random() * 0.6;

      const src = ctx.createBufferSource();
      src.buffer = grain;
      src.playbackRate.value = 0.75 + Math.random() * 0.9;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(peak, t + 0.0015);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      src.connect(env);
      env.connect(bank.inputs[(Math.random() * BANDS.length) | 0]);
      src.start(t, Math.random() * (grain.duration - 0.1));
      src.stop(t + dur + 0.02);
      voices.track(src, env);

      // Occasionally retune a bank filter so droplet timbre never settles into
      // a recognisable set of six pitches.
      if (Math.random() < 0.02) {
        const f = bank.inputs[(Math.random() * BANDS.length) | 0];
        f.frequency.setTargetAtTime(900 + Math.random() * 3200, t, 0.6);
      }

      return poissonGap(4 + 21 * inten);
    },
    { maxAhead: 1500 }
  );

  function setParam(name, value) {
    if (name !== 'intensity') return;
    p.intensity = clamp01(value);
    const now = ctx.currentTime;
    lp.frequency.setTargetAtTime(cutoffFor(p.intensity), now, 0.25);
    bedGain.gain.setTargetAtTime(bedLevelFor(p.intensity), now, 0.2);
    // Droplet *rate* is fixed at schedule time, so it can only catch up over the
    // 90 s horizon. Moving droplet level with the slider as well means the fader
    // responds immediately and the density arrives underneath it.
    dropBus.gain.setTargetAtTime(dropLevelFor(p.intensity), now, 0.25);
  }

  return {
    output: out,
    setParam,
    dispose() {
      scheduler.remove(`${key}:drops`);
      voices.dispose();
      for (const n of [bed, wander]) {
        try {
          n.stop();
        } catch {
          /* already stopped */
        }
      }
      bank.dispose();
      for (const n of [bed, hp, lp, bedGain, wander, wanderDepth, dropBus, out]) n.disconnect();
    },
  };
}

function cutoffFor(intensity) {
  return 5200 + 2400 * intensity;
}

function bedLevelFor(intensity) {
  return 0.3 + 0.7 * intensity;
}

function dropLevelFor(intensity) {
  return 0.3 + 0.45 * intensity;
}
