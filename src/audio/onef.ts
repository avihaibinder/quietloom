/**
 * The 1/f amplitude envelope — the difference between "a noise generator" and
 * "rain" (research.md §7).
 *
 * The 1/f law that makes natural sound feel comfortable lives in the demodulated
 * amplitude envelope, not in the raw waveform. So every layer in the engine is
 * multiplied by a GainNode whose gain is driven by a sum of very low frequency
 * modulators at roughly octave-spaced rates, with amplitude proportional to 1/f.
 * The slow components dominate, which is exactly what "organic" sounds like: a
 * long, unhurried quietloom with a little fine texture on top.
 *
 * Everything here runs as OscillatorNodes routed into an AudioParam, i.e. wholly
 * on the audio thread. Android can throttle our JS timers to nothing and the
 * breathing of the mix does not change.
 *
 * Depth is deliberately small (±10–20%). It should be felt, not heard.
 */

import type { BaseAudioContext, GainNode, OscillatorNode, PeriodicWave } from 'react-native-audio-api';

const TAU = Math.PI * 2;

/**
 * A unit-amplitude sinusoid at an arbitrary phase, as a PeriodicWave.
 *
 * OscillatorNode has no phase control and always starts at phase 0, so a stack of
 * oscillators started together would all peak at once. A single-harmonic
 * PeriodicWave gives us the phase back: with real[1] = sin(phase) and
 * imag[1] = cos(phase) the output is sin(2πft + phase).
 */
export function phasedSine(ctx: BaseAudioContext, phase = 0): PeriodicWave {
  const real = new Float32Array([0, Math.sin(phase)]);
  const imag = new Float32Array([0, Math.cos(phase)]);
  return ctx.createPeriodicWave(real, imag, { disableNormalization: true });
}

const DEFAULT_RATES = [0.011, 0.023, 0.049, 0.101, 0.207];

export interface OneOverF {
  /** Insert in the layer chain. */
  node: GainNode;
  dispose(): void;
}

export interface OneOverFOptions {
  depth?: number;
  rates?: number[];
  startAt?: number;
}

export function createOneOverF(ctx: BaseAudioContext, opts: OneOverFOptions = {}): OneOverF {
  const depth = opts.depth == null ? 0.14 : opts.depth;
  const rates = opts.rates || DEFAULT_RATES;
  const t0 = opts.startAt == null ? ctx.currentTime : opts.startAt;

  const node = ctx.createGain();
  node.gain.setValueAtTime(1, t0);

  // amplitude ∝ 1/f, normalised so the total excursion is exactly ±depth
  const weights = rates.map((r) => 1 / r);
  const total = weights.reduce((a, b) => a + b, 0);

  const oscs: OscillatorNode[] = [];
  const gains: GainNode[] = [];
  rates.forEach((rate, i) => {
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(phasedSine(ctx, Math.random() * TAU));
    // detune each band so the sum never returns to the same relative phase
    osc.frequency.value = rate * (0.78 + Math.random() * 0.44);
    const g = ctx.createGain();
    g.gain.value = (depth * weights[i]) / total;
    osc.connect(g);
    g.connect(node.gain);
    osc.start(t0);
    oscs.push(osc);
    gains.push(g);
  });

  return {
    node,
    dispose(): void {
      for (const o of oscs) {
        try {
          o.stop();
        } catch {
          /* already stopped */
        }
        o.disconnect();
      }
      for (const g of gains) g.disconnect();
      node.disconnect();
    },
  };
}
