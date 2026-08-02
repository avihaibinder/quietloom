/**
 * Campfire — a low bed with Poisson crackle on top.
 *
 * Signal path:
 *   brown loop -> lowpass 200 Hz -> bed gain                       -> out
 *   crackle    -> envelope gain  -> one of five bandpass+pan chains -> out
 *   pop        -> envelope gain  -> bandpass ~800 Hz chain          -> out
 *
 * Lynn 2014 found blood pressure fell in the fire-with-sound condition and *not*
 * in the muted-fire condition — the sound is doing the work (research.md §4). So
 * the crackle is the point, and the crackle density itself breathes on a slow
 * cosine so the fire seems to flare and settle.
 *
 * Crackles are the densest event source in the engine (up to ~8/s). They use the
 * shared band bank so each event costs two nodes, both released on `ended`.
 */

import { getNoiseBuffer, getGrainBuffer, createBandBank, createVoicePool } from '../noise.js';
import { poissonGap } from '../scheduler.js';

const CRACKLE_BANDS = [
  { freq: 2300, q: 5, pan: -0.7 },
  { freq: 3100, q: 6, pan: -0.3 },
  { freq: 3900, q: 6, pan: 0.05 },
  { freq: 4800, q: 6, pan: 0.4 },
  { freq: 5800, q: 5, pan: 0.75 },
];

const POP_BANDS = [
  { freq: 700, q: 3, pan: -0.25 },
  { freq: 900, q: 3, pan: 0.3 },
];

export function createFire(ctx, { scheduler, key = 'fire' }) {
  const t0 = ctx.currentTime;
  const out = ctx.createGain();

  const bed = ctx.createBufferSource();
  bed.buffer = getNoiseBuffer(ctx, 'brown', 'fire');
  bed.loop = true;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 200;
  lp.Q.value = 0.7;

  // The bed is continuous and the crackles are 2-8 ms grains, so the bed wins on
  // raw energy by a mile if you balance these by eye. Measured, the original
  // 0.42/0.5 split put 87% of the layer's energy below 200 Hz, which reads as a
  // rumble rather than a fire. Fire is a crackle you hear over a warm floor.
  const bedGain = ctx.createGain();
  bedGain.gain.setValueAtTime(0.2, t0);

  bed.connect(lp);
  lp.connect(bedGain);
  bedGain.connect(out);
  bed.start(t0, Math.random() * bed.buffer.duration);

  const crackleBus = ctx.createGain();
  crackleBus.gain.setValueAtTime(1.15, t0);
  crackleBus.connect(out);
  const crackles = createBandBank(ctx, crackleBus, CRACKLE_BANDS);
  const pops = createBandBank(ctx, crackleBus, POP_BANDS);
  const grain = getGrainBuffer(ctx);
  const voices = createVoicePool();

  function spark(t, bank, dur, peak, rateJitter) {
    const src = ctx.createBufferSource();
    src.buffer = grain;
    src.playbackRate.value = rateJitter;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + 0.0008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(env);
    env.connect(bank.inputs[(Math.random() * bank.inputs.length) | 0]);
    src.start(t, Math.random() * (grain.duration - 0.1));
    src.stop(t + dur + 0.02);
    voices.track(src, env);
  }

  scheduler.add(
    `${key}:crackle`,
    (t) => {
      spark(t, crackles, 0.002 + Math.random() * 0.006, 0.25 + Math.random() * 0.6, 0.7 + Math.random() * 0.8);
      // density breathes between roughly 2/s and 8/s
      const rate = 5 + 3 * Math.sin(t * 0.071);
      return poissonGap(rate);
    },
    { maxAhead: 900 }
  );

  scheduler.add(
    `${key}:pop`,
    (t) => {
      spark(t, pops, 0.018 + Math.random() * 0.01, 0.6 + Math.random() * 0.4, 0.5 + Math.random() * 0.4);
      return 4.5 + Math.random() * 6;
    },
    { startDelay: 2 + Math.random() * 6 }
  );

  return {
    output: out,
    setParam() {},
    dispose() {
      scheduler.remove(`${key}:crackle`);
      scheduler.remove(`${key}:pop`);
      voices.dispose();
      try {
        bed.stop();
      } catch {
        /* already stopped */
      }
      crackles.dispose();
      pops.dispose();
      for (const n of [bed, lp, bedGain, crackleBus, out]) n.disconnect();
    },
  };
}
