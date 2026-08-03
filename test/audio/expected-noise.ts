/**
 * The measured envelope of `getNoiseBuffer`. Not a test file.
 *
 * Every band here is TWO-SIDED — a floor and a ceiling — because QA measured
 * (tasks/tests.md, 21:29:41 and the 21:30:56 addendum) that a one-sided upper
 * bound like "peak <= 0.35" is GREEN on digital silence, and proved it by
 * running the real analyser over an all-zero WAV. `fake-audio-context.test.ts`
 * asserts that silence fails these bands before any of them is used in anger.
 *
 * The numbers come from measurement, not from intent: 25 freshly generated
 * buffers per colour, 44.1 kHz, 10 s, on 2026-08-03. Observed ranges are quoted
 * beside each band so the margin is visible and a future tightening is informed.
 *
 * `Math.random()` is unseeded here on purpose — the point is that the generator
 * is in-band for ANY buffer it produces, not for one lucky one. Every band was
 * chosen with enough margin over the observed spread that the suite is stable;
 * see the Audio Engineer's entry in tasks/tests.md for the repeat-run count.
 */

/** noise.ts PEAK. Every buffer is normalised to exactly this. */
export const NOISE_PEAK = 0.9;

/** noise.ts BUFFER_SECONDS / XFADE_SECONDS / GRAIN_SECONDS. */
export const BUFFER_SECONDS = 10;
export const XFADE_SECONDS = 0.05;
export const GRAIN_SECONDS = 2;

export interface NoiseBand {
  /** Least-squares slope of octave-band spectral density, dB per octave. */
  slope: [number, number];
  /** Largest deviation of any octave band from the fitted line, dB. */
  maxResidualDb: number;
  /** Whole-buffer RMS. The FLOOR is the anti-silence guard. */
  rms: [number, number];
}

/**
 * The three bands are DISJOINT in slope, so each assertion says "this is pink"
 * rather than "this is noise of some sort". White cannot pass pink's band and
 * brown cannot pass either.
 */
export const NOISE: Record<'white' | 'pink' | 'brown', NoiseBand> = {
  // observed slope -0.029..0.034, rms 0.374..0.406
  white: { slope: [-0.5, 0.5], maxResidualDb: 1.0, rms: [0.34, 0.44] },
  // observed slope -3.044..-2.982, rms 0.180..0.219 — the Paul Kellet filter
  // hits its nominal -3 dB/octave to within 0.05 dB
  pink: { slope: [-3.4, -2.6], maxResidualDb: 0.5, rms: [0.155, 0.245] },
  // observed slope -5.763..-5.667, rms 0.179..0.223. Not a clean -6: the leaky
  // integrator b = (b + 0.02w)/1.02 has its corner near 138 Hz, so the 250 Hz
  // octave is still partly flat and shallows the fit. The 1k->8k octaves fall
  // 5.7-6.0 dB each, which is the -6 the design intends.
  brown: { slope: [-6.3, -5.3], maxResidualDb: 1.2, rms: [0.155, 0.25] },
};

/**
 * |DC offset| after `removeDC`.
 *
 * The test map proposed 1e-4. MEASURED, that is wrong and would have shipped a
 * flaky suite: `removeDC` runs on the LONG buffer, but the mean that survives is
 * the mean of the 10 s SLICE taken after the crossfade folds the tail back over
 * the head, and pink and brown carry enough low-frequency energy for those to
 * differ. Worst of 25 runs: white 8.0e-5, pink 3.6e-4, brown 3.8e-4. The band
 * below is ~5x the worst observed and is still -74 dB relative to the buffer
 * RMS, i.e. far below anything audible as a thump.
 */
export const MAX_DC_OFFSET = 2e-3;

/**
 * RMS inside the crossfade seam, as a ratio to whole-buffer RMS.
 *
 * This is the regression guard on `sealLoop`'s EQUAL-POWER (sin/cos) fade. Two
 * uncorrelated noise segments crossfaded LINEARLY dip 3 dB in the middle of the
 * seam; over the whole seam window that reads as sqrt(2/3) = 0.816. Equal power
 * holds the RMS flat, i.e. 1.0. Observed over 25 runs: 0.980..1.023, so the band
 * below sits ~3 sigma clear of the observed spread and ~12 sigma clear of the
 * linear-crossfade value it exists to reject.
 *
 * WHITE ONLY. Pink and brown have so much low-frequency energy that the RMS of a
 * 50 ms window is not a stable estimator — measured 0.80..1.15 across runs,
 * which is wider than the effect. That is a limit of the measurement, not of the
 * crossfade, and it is recorded here rather than papered over with a loose band.
 */
export const SEAM_RMS_RATIO: [number, number] = [0.93, 1.07];
export const LINEAR_CROSSFADE_SEAM_RATIO = Math.sqrt(2 / 3);

/**
 * `getGrainBuffer` is raw uniform white with no crossfade and no DC removal, so
 * its crest factor is the exact analytic one: uniform noise scaled to peak P has
 * RMS = P/sqrt(3) = 0.5196. That pins the DISTRIBUTION, not merely the level —
 * a Gaussian generator at the same peak would read ~0.30 and fail the floor.
 * Observed 0.5189.
 */
export const GRAIN_RMS: [number, number] = [0.508, 0.531];
export const GRAIN_RMS_ANALYTIC = NOISE_PEAK / Math.sqrt(3);
