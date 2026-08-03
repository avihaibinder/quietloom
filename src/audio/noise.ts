/**
 * Noise buffer factory, plus the shared helpers every grain-based layer uses.
 *
 * Quietloom ships zero audio files (research.md §7). Every continuous layer is an
 * AudioBufferSourceNode looping a ~10 s buffer of generated noise. Noise has no
 * audible period, so a loop point is imperceptible — provided the seam itself is
 * smooth. Each buffer is therefore generated slightly long and its tail is
 * equal-power crossfaded back over its head, which makes the wrap sample-exact.
 *
 * Buffers are cached per (type, variant). Layers ask for their own variant so no
 * two layers ever loop identical noise in lockstep, which would comb and phase.
 *
 * Pink uses the Paul Kellet 7-coefficient filter. Pink is the default bed because
 * it is the noise colour the sleep literature actually supports (research.md §1).
 */

import type {
  AudioBuffer,
  AudioNode,
  AudioScheduledSourceNode,
  BaseAudioContext,
  BiquadFilterNode,
} from 'react-native-audio-api';

const BUFFER_SECONDS = 10;
const XFADE_SECONDS = 0.05;
const GRAIN_SECONDS = 2;
const PEAK = 0.9;

export type NoiseType = 'white' | 'pink' | 'brown';

const caches = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

function cacheFor(ctx: BaseAudioContext): Map<string, AudioBuffer> {
  let m = caches.get(ctx);
  if (!m) {
    m = new Map();
    caches.set(ctx, m);
  }
  return m;
}

function fillWhite(out: Float32Array): void {
  for (let i = 0; i < out.length; i++) out[i] = Math.random() * 2 - 1;
}

function fillPink(out: Float32Array): void {
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let i = 0; i < out.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
    b6 = w * 0.115926;
  }
}

function fillBrown(out: Float32Array): void {
  let b = 0;
  for (let i = 0; i < out.length; i++) {
    const w = Math.random() * 2 - 1;
    b = (b + 0.02 * w) / 1.02;
    out[i] = b;
  }
}

const FILLERS: Record<NoiseType, (out: Float32Array) => void> = {
  white: fillWhite,
  pink: fillPink,
  brown: fillBrown,
};

function removeDC(data: Float32Array): void {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  const mean = sum / data.length;
  if (!mean) return;
  for (let i = 0; i < data.length; i++) data[i] -= mean;
}

function normalise(data: Float32Array, peak: number): void {
  let max = 0;
  for (let i = 0; i < data.length; i++) {
    const a = data[i] < 0 ? -data[i] : data[i];
    if (a > max) max = a;
  }
  if (max < 1e-9) return;
  const k = peak / max;
  for (let i = 0; i < data.length; i++) data[i] *= k;
}

/**
 * Fold the extra tail back over the head with an equal-power crossfade, so that
 * wrapping from the last sample to the first is continuous in both value and
 * spectrum. Equal power (sin/cos) rather than linear keeps the RMS constant
 * across the seam — two uncorrelated noise segments would dip 3 dB otherwise.
 *
 * Returns a `slice`, not a `subarray`. That is not fussiness: subarray hands
 * back a *view* that still points at the full (n + xfade) ArrayBuffer, and
 * this library's native copyToChannel measures the backing buffer rather than
 * the view, so it sees xfade too many samples and throws "Not enough space to
 * copy to destination." The browser sized the copy from the view's own length
 * and never complained, which is exactly why the bug survived the port.
 */
function sealLoop(long: Float32Array<ArrayBuffer>, n: number, xfade: number): Float32Array<ArrayBuffer> {
  for (let i = 0; i < xfade; i++) {
    const a = (Math.PI * 0.5 * i) / xfade;
    long[i] = long[n + i] * Math.cos(a) + long[i] * Math.sin(a);
  }
  return long.slice(0, n);
}

/**
 * A seamlessly loopable noise buffer.
 * @param variant  distinct content per caller; layers pass their own id
 */
export function getNoiseBuffer(ctx: BaseAudioContext, type: NoiseType, variant = 'default'): AudioBuffer {
  const cache = cacheFor(ctx);
  const key = `${type}:${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const sr = ctx.sampleRate;
  const n = Math.floor(BUFFER_SECONDS * sr);
  const x = Math.floor(XFADE_SECONDS * sr);
  const long = new Float32Array(n + x);

  (FILLERS[type] || fillWhite)(long);
  removeDC(long);
  const data = sealLoop(long, n, x);
  normalise(data, PEAK);

  const buf = ctx.createBuffer(1, n, sr);
  buf.copyToChannel(data, 0);
  cache.set(key, buf);
  return buf;
}

/**
 * A short white-noise buffer used as raw material for one-shot grains (rain
 * droplets, fire crackles). Grains read from a random offset, so one buffer
 * serves an unlimited number of unique-sounding events.
 */
export function getGrainBuffer(ctx: BaseAudioContext): AudioBuffer {
  const cache = cacheFor(ctx);
  const hit = cache.get('grain');
  if (hit) return hit;
  const sr = ctx.sampleRate;
  const data = new Float32Array(Math.floor(GRAIN_SECONDS * sr));
  fillWhite(data);
  normalise(data, PEAK);
  const buf = ctx.createBuffer(1, data.length, sr);
  buf.copyToChannel(data, 0);
  cache.set('grain', buf);
  return buf;
}

/**
 * Bookkeeping for one-shot voices (a droplet, a crackle, a thunder roll).
 *
 * Two jobs. Normally `ended` fires and the voice releases its own nodes. But
 * events are scheduled up to 90 s ahead, so at the moment a layer is switched off
 * there can be several hundred voices that have not started yet — and if the
 * context is then suspended their clock stops and `ended` never arrives. The pool
 * kills those explicitly on dispose, which is the difference between a clean
 * preset swap and a few hundred orphaned nodes per swap.
 *
 * react-native-audio-api spells the handler `onEnded` (not `onended`); it is a
 * settable callback that also accepts null, which is exactly what dispose needs.
 */
export interface VoicePool {
  track(source: AudioScheduledSourceNode, ...nodes: AudioNode[]): void;
  readonly size: number;
  dispose(): void;
}

export function createVoicePool(): VoicePool {
  interface Voice {
    source: AudioScheduledSourceNode;
    nodes: AudioNode[];
  }
  const live = new Set<Voice>();
  return {
    track(source: AudioScheduledSourceNode, ...nodes: AudioNode[]): void {
      const voice: Voice = { source, nodes };
      live.add(voice);
      source.onEnded = () => {
        live.delete(voice);
        source.disconnect();
        for (const n of nodes) n.disconnect();
      };
    },
    get size(): number {
      return live.size;
    },
    dispose(): void {
      for (const { source, nodes } of live) {
        source.onEnded = null;
        try {
          source.stop();
        } catch {
          /* never started, or already stopped */
        }
        source.disconnect();
        for (const n of nodes) n.disconnect();
      }
      live.clear();
    },
  };
}

export interface Band {
  freq: number;
  q: number;
  pan: number;
}

export interface BandBank {
  inputs: BiquadFilterNode[];
  dispose(): void;
}

/**
 * A fixed bank of bandpass + pan chains that grain events are fired into.
 *
 * Building the filter and panner once per bank instead of once per event turns a
 * droplet into two nodes rather than four. At 25 droplets a second over an eight
 * hour night that is the difference between a comfortable node count and a leak
 * you have to think about.
 */
export function createBandBank(ctx: BaseAudioContext, destination: AudioNode, bands: readonly Band[]): BandBank {
  const inputs: BiquadFilterNode[] = [];
  const all: AudioNode[] = [];
  for (const b of bands) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = b.freq;
    filter.Q.value = b.q;
    const pan = ctx.createStereoPanner();
    pan.pan.value = b.pan;
    filter.connect(pan);
    pan.connect(destination);
    inputs.push(filter);
    all.push(filter, pan);
  }
  return {
    inputs,
    dispose(): void {
      for (const n of all) n.disconnect();
    },
  };
}
