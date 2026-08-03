/**
 * Test map entry #4 — the noise generators, measured rather than asserted about.
 *
 * `src/audio/noise.ts` imports NOTHING at runtime (its only imports are `import
 * type`), so there is no module mock here, no `react-native-audio-api`, and in
 * particular not the shipped mock that renders silence. `getNoiseBuffer` is
 * handed a fake context whose `createBuffer().copyToChannel()` keeps the real
 * Float32Array, and the assertions run on the samples the generator actually
 * produced.
 *
 * Every level assertion is two-sided. Peak is an equality, RMS and slope are
 * bands with a floor as well as a ceiling, and `fake-audio-context.test.ts`
 * proves digital silence fails all of them.
 *
 * Tested THROUGH `getNoiseBuffer`, not through `fillPink`/`sealLoop`/`normalise`
 * — the Team Lead's refuse-list, and it is right: the public path exercises the
 * cache, the seal and the normalise together, and exporting the internals would
 * test less rather than more.
 *
 * WHAT THIS DOES NOT PROVE: that any of it is audible on a device. It proves the
 * generators' arithmetic. The library binding — the class every real bug in this
 * port belonged to — is invisible from here.
 */
import { describe, expect, it } from 'vitest';

import { getGrainBuffer, getNoiseBuffer, type NoiseType } from '../../src/audio/noise';
import { asContext, createFakeContext, type FakeAudioBuffer } from '../fixtures/fake-audio-context';
import {
  BUFFER_SECONDS,
  GRAIN_RMS,
  GRAIN_RMS_ANALYTIC,
  GRAIN_SECONDS,
  LINEAR_CROSSFADE_SEAM_RATIO,
  MAX_DC_OFFSET,
  NOISE,
  NOISE_PEAK,
  SEAM_RMS_RATIO,
  XFADE_SECONDS,
} from './expected-noise';
import { mean, peak, rms, spectrumFit, windowRmsRatio } from './spectrum';

const COLOURS = ['white', 'pink', 'brown'] as const;

function samplesOf(buf: unknown): Float32Array {
  return (buf as FakeAudioBuffer).getChannelData(0);
}

/** One fresh context, one fresh buffer — the module cache is keyed on the context. */
function generate(type: NoiseType, variant = 'test'): { data: Float32Array; sampleRate: number; buf: FakeAudioBuffer } {
  const ctx = createFakeContext();
  const buf = getNoiseBuffer(asContext(ctx), type, variant) as unknown as FakeAudioBuffer;
  return { data: samplesOf(buf), sampleRate: ctx.sampleRate, buf };
}

/** Generated once per colour; several assertions share it. */
const cache = new Map<string, ReturnType<typeof generate>>();
function once(type: NoiseType): ReturnType<typeof generate> {
  let hit = cache.get(type);
  if (!hit) {
    hit = generate(type);
    cache.set(type, hit);
  }
  return hit;
}

describe.each(COLOURS)('%s noise', (colour) => {
  const band = NOISE[colour];

  it('is exactly 10 seconds long at the context sample rate', () => {
    const { data, buf, sampleRate } = once(colour);
    // The seal generates BUFFER_SECONDS + XFADE_SECONDS and slices back down.
    // A subarray here would carry the extra 0.05 s in its backing buffer and
    // the native copy would throw — see fake-audio-context.test.ts.
    expect(data.length).toBe(BUFFER_SECONDS * sampleRate);
    expect(buf.numberOfChannels).toBe(1);
    expect(buf.sampleRate).toBe(sampleRate);
    expect(buf.duration).toBe(BUFFER_SECONDS);
  });

  it('is normalised to exactly the 0.9 peak', () => {
    const { data } = once(colour);
    // An equality, so it is two-sided by construction: silence fails, and so
    // does anything hotter. 6 places covers the float32 storage rounding.
    expect(peak(data)).toBeCloseTo(NOISE_PEAK, 6);
  });

  it('carries real level — a floor, not just a ceiling', () => {
    const { data } = once(colour);
    const r = rms(data);
    expect(r).toBeGreaterThan(band.rms[0]);
    expect(r).toBeLessThan(band.rms[1]);
  });

  it('has no meaningful DC offset', () => {
    const { data } = once(colour);
    expect(Math.abs(mean(data))).toBeLessThan(MAX_DC_OFFSET);
  });

  it('has the spectral slope its colour requires', () => {
    const { data, sampleRate } = once(colour);
    // Skip 0.1 s so the crossfade seam is not inside the analysis window.
    const fit = spectrumFit(data, sampleRate, Math.floor(0.1 * sampleRate));
    expect(fit.slopeDbPerOctave).toBeGreaterThan(band.slope[0]);
    expect(fit.slopeDbPerOctave).toBeLessThan(band.slope[1]);
    // A slope alone is weak: something that is not a straight line at all can
    // still fit one. The residual is what makes this mean "is pink" rather
    // than "averages out to pink".
    expect(fit.maxResidualDb).toBeLessThan(band.maxResidualDb);
  });
});

describe('the three colours are distinguishable, not merely all noise', () => {
  it('white is flatter than pink, and pink is flatter than brown, by clear margins', () => {
    const slopes = Object.fromEntries(
      COLOURS.map((c) => {
        const { data, sampleRate } = once(c);
        return [c, spectrumFit(data, sampleRate, Math.floor(0.1 * sampleRate)).slopeDbPerOctave];
      })
    ) as Record<(typeof COLOURS)[number], number>;

    expect(slopes.white - slopes.pink).toBeGreaterThan(2);
    expect(slopes.pink - slopes.brown).toBeGreaterThan(2);

    // And each fails the other two's bands, so a colour swap cannot pass.
    expect(slopes.white).toBeGreaterThan(NOISE.pink.slope[1]);
    expect(slopes.brown).toBeLessThan(NOISE.pink.slope[0]);
  });

  it('an unknown type falls back to white rather than throwing or emitting silence', () => {
    const { data, sampleRate } = generate('chartreuse' as NoiseType, 'fallback');
    expect(peak(data)).toBeCloseTo(NOISE_PEAK, 6);
    expect(rms(data)).toBeGreaterThan(NOISE.white.rms[0]);
    const fit = spectrumFit(data, sampleRate, Math.floor(0.1 * sampleRate));
    expect(fit.slopeDbPerOctave).toBeGreaterThan(NOISE.white.slope[0]);
    expect(fit.slopeDbPerOctave).toBeLessThan(NOISE.white.slope[1]);
  });
});

describe('the loop seal', () => {
  it('holds RMS flat across the seam, which a linear crossfade would not', () => {
    // WHITE ONLY: a 50 ms RMS window is not a stable estimator on pink or brown
    // (measured 0.80..1.15 across runs). Recorded in expected-noise.ts.
    const { data, sampleRate } = once('white');
    const ratio = windowRmsRatio(data, 0, Math.floor(XFADE_SECONDS * sampleRate));

    expect(ratio).toBeGreaterThan(SEAM_RMS_RATIO[0]);
    expect(ratio).toBeLessThan(SEAM_RMS_RATIO[1]);
    // The value the equal-power fade exists to avoid, stated so the test says
    // what it is FOR: two uncorrelated segments faded linearly dip to 0.816.
    expect(Math.abs(ratio - LINEAR_CROSSFADE_SEAM_RATIO)).toBeGreaterThan(0.1);
  });
});

describe('the per-context buffer cache', () => {
  it('returns the identical buffer for a repeated (type, variant)', () => {
    const ctx = createFakeContext();
    const a = getNoiseBuffer(asContext(ctx), 'pink', 'ocean');
    const b = getNoiseBuffer(asContext(ctx), 'pink', 'ocean');
    expect(b).toBe(a);
  });

  it('gives each variant its OWN noise, so two layers never loop in lockstep', () => {
    const ctx = createFakeContext();
    const a = samplesOf(getNoiseBuffer(asContext(ctx), 'pink', 'ocean'));
    const b = samplesOf(getNoiseBuffer(asContext(ctx), 'pink', 'wind'));

    // The outcome that matters is different CONTENT, not a different object:
    // identical samples on two layers comb and phase.
    expect(a.length).toBe(b.length);
    let identical = 0;
    for (let i = 0; i < 1000; i++) if (a[i] === b[i]) identical++;
    expect(identical).toBeLessThan(10);
  });

  it('does not share buffers between contexts', () => {
    const one = createFakeContext();
    const two = createFakeContext();
    const a = getNoiseBuffer(asContext(one), 'brown', 'bed');
    const b = getNoiseBuffer(asContext(two), 'brown', 'bed');
    expect(b).not.toBe(a);
  });

  it('sizes the buffer from the context, not from a hardcoded 44.1 kHz', () => {
    const ctx = createFakeContext({ sampleRate: 22050 });
    const buf = getNoiseBuffer(asContext(ctx), 'pink', 'lowrate') as unknown as FakeAudioBuffer;
    expect(buf.length).toBe(BUFFER_SECONDS * 22050);
    expect(buf.sampleRate).toBe(22050);
    expect(peak(samplesOf(buf))).toBeCloseTo(NOISE_PEAK, 6);
  });
});

describe('the grain buffer', () => {
  it('is 2 seconds of uniform white at the 0.9 peak', () => {
    const ctx = createFakeContext();
    const buf = getGrainBuffer(asContext(ctx)) as unknown as FakeAudioBuffer;
    const data = samplesOf(buf);

    expect(buf.duration).toBe(GRAIN_SECONDS);
    expect(data.length).toBe(GRAIN_SECONDS * ctx.sampleRate);
    expect(peak(data)).toBeCloseTo(NOISE_PEAK, 6);

    // Pins the DISTRIBUTION, not merely the level: uniform noise at peak P has
    // RMS = P/sqrt(3). A Gaussian generator at the same peak reads ~0.30 and
    // fails the floor.
    const r = rms(data);
    expect(r).toBeGreaterThan(GRAIN_RMS[0]);
    expect(r).toBeLessThan(GRAIN_RMS[1]);
    expect(r).toBeCloseTo(GRAIN_RMS_ANALYTIC, 2);
  });

  it('is cached per context', () => {
    const ctx = createFakeContext();
    expect(getGrainBuffer(asContext(ctx))).toBe(getGrainBuffer(asContext(ctx)));
  });
});
