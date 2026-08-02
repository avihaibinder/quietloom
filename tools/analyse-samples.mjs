/*
 * Reads the rendered WAVs and reports what each one actually is, so the
 * synthesis can be judged on a machine with no speakers.
 *
 *   node tools/analyse-samples.mjs
 *
 * Spectral tilt separates rain (bright, high-tilted) from brown noise (dark).
 * Crest factor and transient count separate a droplet/crackle texture from flat
 * hiss. Slow modulation depth is what makes the ocean read as waves rather than
 * a drone - and its period should come out at 10 s, which is the 0.1 Hz pacer.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'samples');

function readWav(file) {
  const b = fs.readFileSync(file);
  const ch = b.readUInt16LE(22);
  const sr = b.readUInt32LE(24);
  let off = 12;
  while (off < b.length - 8) {
    const id = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    if (id === 'data') {
      const n = Math.floor(size / 2 / ch);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = b.readInt16LE(off + 8 + i * ch * 2) / 32768;
      return { sr, data: out };
    }
    off += 8 + size;
  }
  throw new Error('no data chunk');
}

/** In-place iterative radix-2 FFT. A decimated DFT aliases badly - use this. */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/**
 * A-weighting gain at f, squared for use on a power spectrum.
 *
 * Raw energy share is misleading for perceived balance: the ear is roughly 25 dB
 * less sensitive at 100 Hz than at 3 kHz, so a layer can be 90% low-frequency by
 * energy and still be heard as its high-frequency detail.
 */
function aWeightPower(f) {
  if (f < 10) return 0;
  const f2 = f * f;
  const num = 12194 ** 2 * f2 * f2;
  const den =
    (f2 + 20.6 ** 2) *
    Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) *
    (f2 + 12194 ** 2);
  const r = num / den;
  const g = r * 10 ** (2.0 / 20); // +2 dB normalisation at 1 kHz
  return g * g;
}

/** Fraction of total energy in each octave-ish band. */
function bandEnergies(data, sr, weighted = false) {
  const N = 8192;
  const bands = [
    ['low', 20, 200],
    ['lo-mid', 200, 800],
    ['mid', 800, 3000],
    ['high', 3000, 20000],
  ];
  const acc = bands.map(() => 0);

  for (let start = 0; start + N < data.length; start += N * 3) {
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      re[i] = data[start + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
    }
    fft(re, im);
    for (let k = 1; k < N / 2; k++) {
      const f = (k * sr) / N;
      const p = (re[k] * re[k] + im[k] * im[k]) * (weighted ? aWeightPower(f) : 1);
      for (let bi = 0; bi < bands.length; bi++) {
        if (f >= bands[bi][1] && f < bands[bi][2]) { acc[bi] += p; break; }
      }
    }
  }
  const total = acc.reduce((a, b) => a + b, 0) || 1;
  return bands.map((b, i) => [b[0], acc[i] / total]);
}

/** Envelope modulation: depth, and the dominant slow period in seconds. */
function modulation(data, sr) {
  const hop = Math.floor(sr / 20); // 20 Hz envelope
  const env = [];
  for (let i = 0; i + hop < data.length; i += hop) {
    let s = 0;
    for (let j = 0; j < hop; j++) s += data[i + j] * data[i + j];
    env.push(Math.sqrt(s / hop));
  }
  const mean = env.reduce((a, b) => a + b, 0) / (env.length || 1);
  if (mean < 1e-6) return { depth: 0, periodS: 0 };
  const dev = env.map((v) => v - mean);
  const depth = Math.sqrt(dev.reduce((a, b) => a + b * b, 0) / dev.length) / mean;

  // Autocorrelation of the envelope, looking for 2 s .. 20 s periodicity.
  let best = 0, bestLag = 0;
  for (let lag = 2 * 20; lag < Math.min(20 * 20, env.length / 2); lag++) {
    let c = 0;
    for (let i = 0; i + lag < env.length; i++) c += dev[i] * dev[i + lag];
    if (c > best) { best = c; bestLag = lag; }
  }
  return { depth: +depth.toFixed(2), periodS: +(bestLag / 20).toFixed(1) };
}

/** Sharp onsets per second - droplets, crackles, chirps. */
function transients(data, sr) {
  const hop = Math.floor(sr / 200); // 5 ms
  let prev = 0, count = 0;
  for (let i = 0; i + hop < data.length; i += hop) {
    let s = 0;
    for (let j = 0; j < hop; j++) s += data[i + j] * data[i + j];
    const e = Math.sqrt(s / hop);
    if (e > prev * 2.2 && e > 0.01) count++;
    prev = e;
  }
  return +(count / (data.length / sr)).toFixed(1);
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.wav')).sort();
console.log('\n  sample                 crest  transients/s  modDepth  modPeriod  A-weighted balance (as heard)');
console.log('  ' + '-'.repeat(104));

for (const f of files) {
  const { sr, data } = readWav(path.join(DIR, f));
  let peak = 0, sum = 0;
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i]);
    if (a > peak) peak = a;
    sum += data[i] * data[i];
  }
  const rms = Math.sqrt(sum / data.length);
  const crest = +(peak / (rms || 1e-9)).toFixed(1);
  const mod = modulation(data, sr);
  const tr = transients(data, sr);
  const bands = bandEnergies(data, sr, true)
    .map(([n, v]) => `${n}:${(v * 100).toFixed(0)}%`)
    .join(' ');
  console.log(
    `  ${f.replace('.wav', '').padEnd(22)} ${String(crest).padEnd(6)} ${String(tr).padEnd(13)} ${String(mod.depth).padEnd(9)} ${String(mod.periodS + 's').padEnd(10)} ${bands}`,
  );
}
console.log('');
