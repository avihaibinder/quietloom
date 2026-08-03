/**
 * Measurement helpers for the noise tests. Not a test file — `*.test.ts` only
 * is collected.
 *
 * These are the *analyser* half of the audio slice, and QA's blocker 4 applies
 * to them directly: "any harness whose self-test does not first recover a known
 * signal it constructed itself" is not trusted. So `fake-audio-context.test.ts`
 * drives every function here against a synthetic 1 kHz sine of known amplitude,
 * and against digital silence, before a single noise buffer is measured.
 *
 * Deliberately small: peak, RMS, mean, and octave-band spectral DENSITY. Density
 * (mean power per FFT bin), not band energy — an octave band is proportionally
 * wider the higher it sits, so band ENERGY reads white as +3 dB/oct and pink as
 * flat, while density reads the canonical white 0 / pink -3 / brown -6 dB/oct.
 * Both are correct; the density convention is the one the test map is written
 * in, and the charter's "pink flat per octave" is the same statement in the
 * other convention.
 */

/** Largest absolute sample. */
export function peak(data: Float32Array | Float64Array): number {
  let m = 0;
  for (let i = 0; i < data.length; i++) {
    const a = data[i] < 0 ? -data[i] : data[i];
    if (a > m) m = a;
  }
  return m;
}

/** Root mean square. */
export function rms(data: Float32Array | Float64Array): number {
  let s = 0;
  for (let i = 0; i < data.length; i++) s += data[i] * data[i];
  return Math.sqrt(s / data.length);
}

/** Arithmetic mean — the DC offset. */
export function mean(data: Float32Array | Float64Array): number {
  let s = 0;
  for (let i = 0; i < data.length; i++) s += data[i];
  return s / data.length;
}

/** RMS of a window, as a ratio to the RMS of the whole. Used on the loop seam. */
export function windowRmsRatio(data: Float32Array, from: number, count: number): number {
  const whole = rms(data);
  if (whole === 0) return 0;
  const slice = data.subarray(from, from + count);
  return rms(slice) / whole;
}

/* ------------------------------------------------------------------ FFT */

const twiddleCache = new Map<number, { cos: Float64Array; sin: Float64Array }>();

function twiddles(n: number): { cos: Float64Array; sin: Float64Array } {
  const hit = twiddleCache.get(n);
  if (hit) return hit;
  const half = n >> 1;
  const cos = new Float64Array(half);
  const sin = new Float64Array(half);
  for (let k = 0; k < half; k++) {
    cos[k] = Math.cos((-2 * Math.PI * k) / n);
    sin[k] = Math.sin((-2 * Math.PI * k) / n);
  }
  const t = { cos, sin };
  twiddleCache.set(n, t);
  return t;
}

/**
 * In-place iterative radix-2 Cooley-Tukey. `re.length` must be a power of two.
 * Twiddles come from a precomputed table rather than a recurrence, so accuracy
 * does not decay across the 14 stages of a 16384-point transform.
 */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n !== im.length || (n & (n - 1)) !== 0) throw new Error(`fft needs a power-of-two length, got ${n}`);

  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }

  const { cos, sin } = twiddles(n);
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const stride = n / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k * stride];
        const wi = sin[k * stride];
        const a = i + k;
        const b = a + half;
        const vr = re[b] * wr - im[b] * wi;
        const vi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - vr;
        im[b] = im[a] - vi;
        re[a] += vr;
        im[a] += vi;
      }
    }
  }
}

const SEGMENT = 16384;
const MAX_SEGMENTS = 16;

/**
 * Bartlett-averaged power spectrum: Hann-windowed non-overlapping segments,
 * averaged. Returns power per bin (index 0..SEGMENT/2) and the bin width in Hz.
 */
export function powerSpectrum(
  data: Float32Array,
  sampleRate: number,
  skip = 0
): { power: Float64Array; binHz: number; segments: number } {
  const usable = data.length - skip;
  const segments = Math.max(1, Math.min(MAX_SEGMENTS, Math.floor(usable / SEGMENT)));
  const bins = SEGMENT / 2 + 1;
  const power = new Float64Array(bins);

  const win = new Float64Array(SEGMENT);
  let winPower = 0;
  for (let i = 0; i < SEGMENT; i++) {
    win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / SEGMENT);
    winPower += win[i] * win[i];
  }
  // Normalise so a unit-amplitude sine keeps its power regardless of the window.
  const norm = 1 / (winPower * segments);

  const re = new Float64Array(SEGMENT);
  const im = new Float64Array(SEGMENT);
  for (let s = 0; s < segments; s++) {
    const off = skip + s * SEGMENT;
    for (let i = 0; i < SEGMENT; i++) {
      re[i] = data[off + i] * win[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < bins; k++) {
      power[k] += (re[k] * re[k] + im[k] * im[k]) * norm;
    }
  }
  return { power, binHz: sampleRate / SEGMENT, segments };
}

/**
 * Mean power per bin inside an octave band centred on `centreHz`, in dB.
 * Density, not total energy — see the module header.
 */
export function bandDensityDb(
  power: Float64Array,
  binHz: number,
  centreHz: number
): number {
  const lo = centreHz / Math.SQRT2;
  const hi = centreHz * Math.SQRT2;
  const k0 = Math.max(1, Math.ceil(lo / binHz));
  const k1 = Math.min(power.length - 1, Math.floor(hi / binHz));
  if (k1 < k0) throw new Error(`empty band at ${centreHz} Hz`);
  let sum = 0;
  for (let k = k0; k <= k1; k++) sum += power[k];
  const density = sum / (k1 - k0 + 1);
  // No epsilon floor: silence must produce -Infinity and fail, not read as a
  // plausible small number. QA's trap 3 is exactly a plausible table of zeros.
  return 10 * Math.log10(density);
}

export const OCTAVE_CENTRES = [250, 500, 1000, 2000, 4000, 8000] as const;

export interface SpectrumFit {
  /** dB per octave, least-squares over the octave centres. */
  slopeDbPerOctave: number;
  /** Band densities in dB, one per centre in `OCTAVE_CENTRES`. */
  bandsDb: number[];
  /** Largest deviation of any band from the fitted line, in dB. */
  maxResidualDb: number;
}

/**
 * Least-squares slope of octave-band density against log2(frequency).
 *
 * The residual is returned as well as the slope, because a slope alone is a
 * one-sided-shaped assertion: a signal that is not a straight line at all can
 * still fit some slope. Asserting the residual is small is what makes "this is
 * pink" mean pink rather than "averages out to pink".
 */
export function spectrumFit(data: Float32Array, sampleRate: number, skip = 0): SpectrumFit {
  const { power, binHz } = powerSpectrum(data, sampleRate, skip);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const c of OCTAVE_CENTRES) {
    xs.push(Math.log2(c));
    ys.push(bandDensityDb(power, binHz, c));
  }
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) * (xs[i] - mx);
  }
  const slope = num / den;
  const intercept = my - slope * mx;
  let maxResidual = 0;
  for (let i = 0; i < n; i++) {
    const r = Math.abs(ys[i] - (slope * xs[i] + intercept));
    if (r > maxResidual) maxResidual = r;
  }
  return { slopeDbPerOctave: slope, bandsDb: ys, maxResidualDb: maxResidual };
}

/** Frequency of the largest single bin, in Hz. */
export function peakFrequency(data: Float32Array, sampleRate: number): number {
  const { power, binHz } = powerSpectrum(data, sampleRate);
  let best = 1;
  for (let k = 1; k < power.length; k++) if (power[k] > power[best]) best = k;
  return best * binHz;
}
