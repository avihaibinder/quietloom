/**
 * SELF-TEST for the audio slice's own instruments — QA blocker 4:
 * "any harness whose self-test does not first recover a known signal it
 * constructed itself" is not to be trusted.
 *
 * Nothing in `src/` is exercised here. This file proves two things before any
 * real audio code is measured:
 *
 *   1. The fake context KEEPS what is written to it — samples survive
 *      copyToChannel, and AudioParam automation is a real evaluable timeline
 *      rather than an instant jump. (The shipped react-native-audio-api mock
 *      fails both; QA measured it rendering digital silence.)
 *   2. The analyser in `spectrum.ts` recovers the known peak, RMS and frequency
 *      of a signal this file builds, AND REJECTS DIGITAL SILENCE against the
 *      exact bands the noise tests use. That is the direct answer to QA's
 *      trap 3: a plausible table of zeros must not be able to pass.
 */
import { describe, expect, it } from 'vitest';

import {
  createFakeContext,
  FakeAudioBuffer,
  FakePeriodicWave,
} from '../fixtures/fake-audio-context';
import { MAX_DC_OFFSET, NOISE } from './expected-noise';
import {
  bandDensityDb,
  mean,
  peak,
  peakFrequency,
  powerSpectrum,
  rms,
  spectrumFit,
} from './spectrum';

const SR = 44100;
const TAU = Math.PI * 2;

/** A 1 kHz sine at a known amplitude — QA's suggested reference signal. */
function sine(amplitude: number, freq: number, seconds: number, sampleRate = SR): Float32Array {
  const n = Math.floor(seconds * sampleRate);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amplitude * Math.sin((TAU * freq * i) / sampleRate);
  return out;
}

describe('the analyser recovers a signal it built itself', () => {
  it('measures the known peak, RMS and frequency of a 0.25-amplitude 1 kHz sine', () => {
    const d = sine(0.25, 1000, 6);

    // Float32 storage costs ~1e-7; the assertion is two-sided either way.
    expect(peak(d)).toBeGreaterThan(0.2499);
    expect(peak(d)).toBeLessThanOrEqual(0.25);

    // A sine's RMS is exactly A/sqrt(2). Recovering that proves the estimator,
    // not merely that the array is non-empty.
    expect(rms(d)).toBeCloseTo(0.25 / Math.SQRT2, 6);

    // One FFT bin at this transform size is 2.69 Hz.
    const binHz = SR / 16384;
    expect(Math.abs(peakFrequency(d, SR) - 1000)).toBeLessThan(binHz);
  });

  it('recovers a known spectral slope: white-by-construction reads flat', () => {
    // Not from src/ — built here, uniform, so its density must be flat.
    const n = SR * 6;
    const d = new Float32Array(n);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const fit = spectrumFit(d, SR);
    expect(fit.slopeDbPerOctave).toBeGreaterThan(-0.5);
    expect(fit.slopeDbPerOctave).toBeLessThan(0.5);
    expect(fit.maxResidualDb).toBeLessThan(1.0);
  });

  it('recovers a known spectral slope: a one-pole integrator reads about -6 dB/octave', () => {
    // A brown-by-construction reference, independent of src/audio/noise.ts.
    const n = SR * 6;
    const d = new Float32Array(n);
    let b = 0;
    for (let i = 0; i < n; i++) {
      b = 0.999 * b + 0.001 * (Math.random() * 2 - 1);
      d[i] = b;
    }
    const fit = spectrumFit(d, SR);
    expect(fit.slopeDbPerOctave).toBeLessThan(-5.5);
    expect(fit.slopeDbPerOctave).toBeGreaterThan(-6.5);
  });

  it('REJECTS digital silence on every band the noise tests use', () => {
    // This is QA's trap, reproduced and defused. The shipped RN audio mock
    // resolves exactly this buffer from startRendering(), and QA showed the
    // real analyser prints a clean, plausible table of zeros for it.
    const silence = new Float32Array(SR * 6);

    expect(peak(silence)).toBe(0);
    expect(rms(silence)).toBe(0);
    expect(mean(silence)).toBe(0);

    // A one-sided ceiling passes on silence. That is the whole failure.
    expect(peak(silence)).toBeLessThanOrEqual(0.35);
    expect(Math.abs(mean(silence))).toBeLessThan(MAX_DC_OFFSET);

    // The floors are what save it. Silence fails all three colours' RMS floor.
    for (const colour of ['white', 'pink', 'brown'] as const) {
      expect(rms(silence)).toBeLessThan(NOISE[colour].rms[0]);
    }

    // And the spectrum of silence is -Infinity, not a plausible small number:
    // bandDensityDb deliberately adds no epsilon.
    const { power, binHz } = powerSpectrum(silence, SR);
    expect(bandDensityDb(power, binHz, 1000)).toBe(-Infinity);
    expect(Number.isFinite(spectrumFit(silence, SR).slopeDbPerOctave)).toBe(false);
  });
});

describe('the fake context keeps what is written to it', () => {
  it('copyToChannel stores the real samples and getChannelData hands them back', () => {
    const ctx = createFakeContext();
    const buf = ctx.createBuffer(1, SR, SR);
    const src = sine(0.25, 1000, 1);

    buf.copyToChannel(src, 0);
    const back = buf.getChannelData(0);

    expect(back.length).toBe(SR);
    expect(peak(back)).toBeCloseTo(peak(src), 12);
    expect(rms(back)).toBeCloseTo(rms(src), 12);
    // The same array on every call — the shipped mock returns a fresh zero-fill.
    expect(buf.getChannelData(0)).toBe(back);
  });

  it('reports duration from length and sample rate', () => {
    const buf = new FakeAudioBuffer(1, SR * 10, SR);
    expect(buf.duration).toBe(10);
  });

  it('rejects a subarray view the way the native copy does', () => {
    // (reasoned, not measured) — models react-native-audio-api sizing the copy
    // from the backing ArrayBuffer. src/audio/noise.ts:107-114 records the bug
    // this caused in the port; `sealLoop` returns slice() BECAUSE of it, and
    // this is the regression guard on that decision.
    const ctx = createFakeContext();
    const buf = ctx.createBuffer(1, 100, SR);
    const long = new Float32Array(120);

    expect(() => buf.copyToChannel(long.subarray(0, 100), 0)).toThrow(/Not enough space/);
    expect(() => buf.copyToChannel(long.slice(0, 100), 0)).not.toThrow();
  });
});

describe('AudioParam automation is a timeline, not an instant jump', () => {
  it('holds a set value and reads the default before the first event', () => {
    const ctx = createFakeContext();
    const g = ctx.createGain();
    expect(g.gain.valueAt(0)).toBe(1); // GainNode default

    g.gain.setValueAtTime(0.25, 2);
    expect(g.gain.valueAt(1.999)).toBe(1);
    expect(g.gain.valueAt(2)).toBe(0.25);
    expect(g.gain.valueAt(100)).toBe(0.25);
  });

  it('interpolates a linear ramp, and does not jump to the end value', () => {
    const ctx = createFakeContext();
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, 1);
    g.gain.linearRampToValueAtTime(1, 3);

    expect(g.gain.valueAt(1)).toBe(0);
    expect(g.gain.valueAt(2)).toBeCloseTo(0.5, 12); // the shipped mock reads 1 here
    expect(g.gain.valueAt(2.5)).toBeCloseTo(0.75, 12);
    expect(g.gain.valueAt(3)).toBe(1);
    expect(g.gain.valueAt(9)).toBe(1);
  });

  it('interpolates an exponential ramp geometrically', () => {
    const ctx = createFakeContext();
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.1, 0);
    g.gain.exponentialRampToValueAtTime(0.4, 2);
    // Geometric midpoint of 0.1 and 0.4 is 0.2, not the arithmetic 0.25.
    expect(g.gain.valueAt(1)).toBeCloseTo(0.2, 12);
    expect(g.gain.valueAt(2)).toBe(0.4);
  });

  it('decays towards a target with the right time constant', () => {
    const ctx = createFakeContext();
    const g = ctx.createGain();
    g.gain.setValueAtTime(1, 0);
    g.gain.setTargetAtTime(0, 0, 0.5);

    expect(g.gain.valueAt(0)).toBeCloseTo(1, 12);
    // One time constant leaves exactly 1/e.
    expect(g.gain.valueAt(0.5)).toBeCloseTo(Math.exp(-1), 12);
    expect(g.gain.valueAt(2.5)).toBeCloseTo(Math.exp(-5), 12);
    // Approaches but never reaches — the shipped mock sets it to 0 instantly.
    expect(g.gain.valueAt(50)).toBeGreaterThan(0);
    expect(g.gain.valueAt(50)).toBeLessThan(1e-40);
  });

  it('follows a value curve and holds its last sample', () => {
    const ctx = createFakeContext();
    const g = ctx.createGain();
    g.gain.setValueCurveAtTime(new Float32Array([0, 1, 0]), 1, 2);
    expect(g.gain.valueAt(1)).toBeCloseTo(0, 12);
    expect(g.gain.valueAt(2)).toBeCloseTo(1, 12);
    expect(g.gain.valueAt(3)).toBeCloseTo(0, 12);
    expect(g.gain.valueAt(4)).toBeCloseTo(0, 12);
  });

  it('cancelScheduledValues drops the future and keeps the past', () => {
    const ctx = createFakeContext();
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.2, 1);
    g.gain.setValueAtTime(0.8, 5);
    g.gain.cancelScheduledValues(3);
    expect(g.gain.valueAt(1)).toBe(0.2);
    expect(g.gain.valueAt(9)).toBe(0.2);
  });

  it('cancelAndHoldAtTime pins the value a ramp had actually reached', () => {
    // This is the property engine.ts anchor() is built on: after it, the next
    // ramp starts from a defined value instead of clicking.
    const ctx = createFakeContext();
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, 0);
    g.gain.linearRampToValueAtTime(1, 4);

    g.gain.cancelAndHoldAtTime(1); // a quarter of the way up
    expect(g.gain.valueAt(1)).toBeCloseTo(0.25, 12);
    expect(g.gain.valueAt(4)).toBeCloseTo(0.25, 12);

    g.gain.linearRampToValueAtTime(0, 2);
    expect(g.gain.valueAt(1.5)).toBeCloseTo(0.125, 12);
    expect(g.gain.valueAt(2)).toBe(0);
  });

  it('flags a ramp with nothing anchoring its start', () => {
    const ctx = createFakeContext();
    const anchored = ctx.createGain();
    anchored.gain.setValueAtTime(0.5, 0);
    anchored.gain.linearRampToValueAtTime(1, 1);
    expect(anchored.gain.hasUnanchoredRamp).toBe(false);

    const bare = ctx.createGain();
    bare.gain.linearRampToValueAtTime(1, 1);
    expect(bare.gain.hasUnanchoredRamp).toBe(true);
  });

  it('.value is the last direct write and does not move when automation is scheduled', () => {
    const ctx = createFakeContext();
    const f = ctx.createBiquadFilter();
    expect(f.frequency.value).toBe(350);
    f.frequency.value = 35;
    expect(f.frequency.value).toBe(35);
    f.frequency.setValueAtTime(900, 1);
    expect(f.frequency.value).toBe(35);
    expect(f.frequency.valueAt(1)).toBe(900);
  });
});

describe('nodes, the clock and PeriodicWave', () => {
  it('advances the audio clock', () => {
    const ctx = createFakeContext({ currentTime: 2 });
    expect(ctx.currentTime).toBe(2);
    ctx.advance(0.5);
    expect(ctx.currentTime).toBe(2.5);
    expect(() => ctx.advance(-1)).toThrow();
  });

  it('throws on a double start and on a stop before start, as the real nodes do', () => {
    // Every dispose path in src/audio wraps stop() in try/catch; if the fake
    // never threw, those catch blocks would never be exercised.
    const ctx = createFakeContext();
    const osc = ctx.createOscillator();
    expect(() => osc.stop(0)).toThrow(/InvalidStateError/);
    osc.start(0);
    expect(() => osc.start(1)).toThrow(/InvalidStateError/);
    expect(() => osc.stop(1)).not.toThrow();
  });

  it('tracks connections and drops them on disconnect', () => {
    const ctx = createFakeContext();
    const a = ctx.createGain();
    const b = ctx.createGain();
    expect(a.connect(b)).toBe(b);
    expect(a.connected).toBe(true);
    // Connecting a node to an AudioParam is how all continuous modulation runs.
    a.connect(b.gain);
    expect(a.outputs).toContain(b.gain);
    a.disconnect();
    expect(a.connected).toBe(false);
    expect(a.outputs).toHaveLength(0);
  });

  it('reconstructs sin(2*pi*f*t + phase) from a single-harmonic PeriodicWave', () => {
    // The convention is src/audio/onef.ts's own: real[k] weights cos, imag[k]
    // weights sin. Recovering the phase from it is what the ocean tests stand on.
    for (const phase of [0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 3, 2.7]) {
      const w = new FakePeriodicWave(
        new Float32Array([0, Math.sin(phase)]),
        new Float32Array([0, Math.cos(phase)]),
        true
      );
      for (const cycles of [0, 0.1, 0.25, 0.5, 0.77, 1.3]) {
        expect(w.sampleAt(cycles)).toBeCloseTo(Math.sin(TAU * cycles + phase), 6);
      }
    }
  });

  it('createPeriodicWave copies its coefficients rather than aliasing them', () => {
    const ctx = createFakeContext();
    const real = new Float32Array([0, 1]);
    const w = ctx.createPeriodicWave(real, new Float32Array([0, 0]), { disableNormalization: true });
    real[1] = 99;
    expect(w.real[1]).toBe(1);
    expect(w.disableNormalization).toBe(true);
  });
});
