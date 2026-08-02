/**
 * Ocean — and the headline feature: the swell period is exactly 10.000 seconds.
 *
 * 0.1 Hz is the resonance frequency of the baroreflex. Breathing at six breaths a
 * minute puts respiration, blood pressure and heart rate into phase and maximises
 * vagally mediated HRV (research.md §6). So the wave is not decoration — it is a
 * breathing pacer you can follow with your eyes closed. Rising half = inhale,
 * falling half = exhale. The period is therefore never randomised; only the
 * character of each crest is.
 *
 * Signal path:
 *   pink loop -> highpass 35 -> lowpass (cutoff swells 350–1400 Hz) -> swell gain -> out
 *   pink loop -> bandpass ~1–2 kHz "wash" -> wash gain (lags the crest by 600 ms) -> out
 *
 * PHASE EXPORT
 * ------------
 * The modulation is driven by OscillatorNodes, but their phase is pinned to a
 * global grid defined purely by the audio clock:
 *
 *     phase(t) = frac(ctx.currentTime * OCEAN_HZ)     0 = trough, 0.5 = crest
 *
 * An oscillator can only start at phase 0, so each one is given a compensating
 * phase offset (2π·f·tStart) at construction. That means `engine.getOceanPhase()`
 * is exact, is valid whether or not the ocean layer is even running, and stays
 * correct across enable/disable — the UI breathing animation can be driven
 * straight from it with no message passing and no drift.
 */

import { getNoiseBuffer } from '../noise.js';
import { phasedSine } from '../onef.js';

export const OCEAN_HZ = 0.1;
export const OCEAN_PERIOD = 1 / OCEAN_HZ;

const TAU = Math.PI * 2;
const WASH_LAG = 0.6;

/**
 * A wave shaped -cos(2π·OCEAN_HZ·(t - lag)) on the global audio clock:
 * -1 at the trough, +1 at the crest. -cos(x) === sin(x - π/2).
 */
function swellWave(ctx, tStart, lag) {
  return phasedSine(ctx, TAU * OCEAN_HZ * (tStart - lag) - Math.PI / 2);
}

export function createOcean(ctx, { scheduler, key = 'ocean' }) {
  const t0 = ctx.currentTime;
  const out = ctx.createGain();

  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx, 'pink', 'ocean');
  src.loop = true;

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 35;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.6;
  lp.frequency.setValueAtTime(875, t0); // centre of 350..1400

  const swellGain = ctx.createGain();
  swellGain.gain.setValueAtTime(0.55, t0);

  src.connect(hp);
  hp.connect(lp);
  lp.connect(swellGain);
  swellGain.connect(out);

  const wash = ctx.createBiquadFilter();
  wash.type = 'bandpass';
  wash.frequency.setValueAtTime(1500, t0);
  wash.Q.setValueAtTime(1.1, t0);

  const washGain = ctx.createGain();
  washGain.gain.setValueAtTime(0.13, t0);

  hp.connect(wash);
  wash.connect(washGain);
  washGain.connect(out);

  const lfo = ctx.createOscillator();
  lfo.frequency.value = OCEAN_HZ;
  lfo.setPeriodicWave(swellWave(ctx, t0, 0));

  const toCutoff = ctx.createGain();
  toCutoff.gain.value = 525; // 875 ± 525 => 350..1400 Hz
  const toSwell = ctx.createGain();
  toSwell.gain.value = 0.42;
  lfo.connect(toCutoff);
  toCutoff.connect(lp.frequency);
  lfo.connect(toSwell);
  toSwell.connect(swellGain.gain);

  const lfoLag = ctx.createOscillator();
  lfoLag.frequency.value = OCEAN_HZ;
  lfoLag.setPeriodicWave(swellWave(ctx, t0, WASH_LAG));
  const toWash = ctx.createGain();
  toWash.gain.value = 0.13; // 0.13 ± 0.13 => never negative
  lfoLag.connect(toWash);
  toWash.connect(washGain.gain);

  src.start(t0, Math.random() * src.buffer.duration);
  lfo.start(t0);
  lfoLag.start(t0);

  // One task per swell, fired at the crest: re-colours the wash so no two waves
  // break the same way. The period itself is untouched.
  const firstCrest = (Math.floor(t0 / OCEAN_PERIOD) + 0.5) * OCEAN_PERIOD;
  scheduler.add(
    `${key}:crest`,
    (t) => {
      wash.frequency.setTargetAtTime(1050 + Math.random() * 950, t - 1.5, 0.9);
      wash.Q.setTargetAtTime(0.8 + Math.random() * 0.9, t - 1.5, 0.9);
      toWash.gain.setTargetAtTime(0.09 + Math.random() * 0.07, t - 1.5, 1.2);
      return OCEAN_PERIOD;
    },
    { startAt: firstCrest > t0 + 1.6 ? firstCrest : firstCrest + OCEAN_PERIOD }
  );

  return {
    output: out,
    setParam() {},
    dispose() {
      scheduler.remove(`${key}:crest`);
      for (const n of [src, lfo, lfoLag]) {
        try {
          n.stop();
        } catch {
          /* already stopped */
        }
      }
      for (const n of [src, hp, lp, swellGain, wash, washGain, lfo, lfoLag, toCutoff, toSwell, toWash, out]) {
        n.disconnect();
      }
    },
  };
}
