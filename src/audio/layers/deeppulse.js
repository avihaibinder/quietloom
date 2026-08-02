/**
 * Deep Pulse — the Papalambros stimulation pattern, OPEN LOOP.
 *
 *   pink loop -> pulse gain (idles at 0, opened for 50 ms per pulse) -> out
 *
 * Papalambros 2017 delivered 50 ms pink-noise pulses in blocks of five at about
 * 0.8 Hz, each pulse phase-locked to the up-state of a slow oscillation, followed
 * by an OFF interval of roughly equal length. Slow-wave and spindle activity rose
 * during ON blocks and overnight word recall improved (research.md §1).
 *
 * IMPORTANT — WHAT THIS IS NOT.
 * Quietloom has no EEG. It cannot see your slow oscillations, so it cannot phase-lock
 * to them. This layer reproduces the *stimulation pattern* — the rate, the block
 * structure, the pulse shape — and nothing else. It is an open-loop approximation
 * of the protocol, not the protocol, and the app badges it Experimental for
 * exactly that reason. Do not let it be described as slow-wave enhancement.
 *
 * The pulse envelope is a raised cosine (Hann) applied with setValueCurveAtTime.
 * A rectangular 50 ms gate on noise would click at both ends, and a click in a
 * sleep app is an arousal.
 */

import { getNoiseBuffer } from '../noise.js';

const PULSE_HZ = 0.8;
const PULSE_GAP = 1 / PULSE_HZ; // 1.25 s
const PULSES_PER_BLOCK = 5;
const PULSE_SECONDS = 0.05;
const OFF_SECONDS = PULSES_PER_BLOCK * PULSE_GAP; // ~6.25 s, matching the ON block

const CURVE = new Float32Array(65);
for (let i = 0; i < CURVE.length; i++) {
  CURVE[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (CURVE.length - 1));
}

export function createDeepPulse(ctx, { scheduler, key = 'deeppulse' }) {
  const t0 = ctx.currentTime;
  const out = ctx.createGain();

  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx, 'pink', 'deeppulse');
  src.loop = true;

  const band = ctx.createBiquadFilter();
  band.type = 'lowpass';
  band.frequency.value = 6000;
  band.Q.value = 0.5;

  const pulse = ctx.createGain();
  pulse.gain.setValueAtTime(0, t0);

  src.connect(band);
  band.connect(pulse);
  pulse.connect(out);
  src.start(t0, Math.random() * src.buffer.duration);

  let index = 0;
  scheduler.add(
    `${key}:pulse`,
    (t) => {
      pulse.gain.setValueCurveAtTime(CURVE, t, PULSE_SECONDS);
      index += 1;
      if (index < PULSES_PER_BLOCK) return PULSE_GAP;
      index = 0;
      // Jitter the OFF interval a little so the block never phase-locks to the
      // ocean's 10 s swell, which would produce an audible cross-rhythm.
      return OFF_SECONDS + (Math.random() * 0.8 - 0.4);
    },
    { startDelay: 1.5 }
  );

  return {
    output: out,
    setParam() {},
    dispose() {
      scheduler.remove(`${key}:pulse`);
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      src.disconnect();
      band.disconnect();
      pulse.disconnect();
      out.disconnect();
    },
  };
}
