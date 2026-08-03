/**
 * Binaural beats — two sines, hard panned.
 *
 *   sine(baseHz)          -> panner -1 -> out
 *   sine(baseHz + beatHz) -> panner +1 -> out
 *
 * The beat is not in the signal; it is produced in the listener's brainstem from
 * the difference between the two ears. It therefore physically cannot work on a
 * speaker, which is why the app insists on headphones (research.md §5).
 *
 * Defaults are 250 Hz / 0.25 Hz — the exact parameters of Fan 2024, which
 * shortened both N2 and N3 latency in naps — rather than invented numbers.
 * beatHz is supported from 0.25 (delta pacing) up to 16 (beta), baseHz 100–400.
 *
 * Retuning ramps the two oscillators instead of restarting them: a restart would
 * reset the phase relationship, which is the only thing that matters here.
 */

import type { BaseAudioContext, GainNode, OscillatorNode, StereoPannerNode } from 'react-native-audio-api';

import type { Layer, LayerIO } from '../types';

const BASE_MIN = 100;
const BASE_MAX = 400;
const BEAT_MIN = 0.25;
const BEAT_MAX = 16;

const clamp = (v: number, lo: number, hi: number, fallback: number): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
};

interface Ear {
  osc: OscillatorNode;
  panner: StereoPannerNode;
  g: GainNode;
}

export function createBinaural(ctx: BaseAudioContext, { params = {} }: LayerIO): Layer {
  const t0 = ctx.currentTime;
  const p = {
    baseHz: clamp(params.baseHz, BASE_MIN, BASE_MAX, 250),
    beatHz: clamp(params.beatHz, BEAT_MIN, BEAT_MAX, 0.25),
  };

  const out = ctx.createGain();

  function ear(freq: number, pan: number): Ear {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t0);
    osc.connect(g);
    g.connect(panner);
    panner.connect(out);
    osc.start(t0);
    return { osc, panner, g };
  }

  const left = ear(p.baseHz, -1);
  const right = ear(p.baseHz + p.beatHz, 1);

  function retune(): void {
    const now = ctx.currentTime;
    left.osc.frequency.setTargetAtTime(p.baseHz, now, 0.08);
    right.osc.frequency.setTargetAtTime(p.baseHz + p.beatHz, now, 0.08);
  }

  return {
    output: out,
    setParam(name: string, value: number): void {
      if (name === 'baseHz') p.baseHz = clamp(value, BASE_MIN, BASE_MAX, p.baseHz);
      else if (name === 'beatHz') p.beatHz = clamp(value, BEAT_MIN, BEAT_MAX, p.beatHz);
      else return;
      retune();
    },
    dispose(): void {
      for (const e of [left, right]) {
        try {
          e.osc.stop();
        } catch {
          /* already stopped */
        }
        e.osc.disconnect();
        e.g.disconnect();
        e.panner.disconnect();
      }
      out.disconnect();
    },
  };
}
