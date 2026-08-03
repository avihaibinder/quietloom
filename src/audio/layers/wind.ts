/**
 * Wind — broad, pitchless masking that never settles.
 *
 * Signal path:
 *   pink loop -> bandpass (Q 0.7, centre random-walks 300–900 Hz)
 *             -> lowpass 3 kHz -> swell gain (LFOs) -> gust gain (scheduler) -> out
 *
 * Two separate gain stages on purpose. The swell is continuous LFO modulation on
 * the audio thread; the gusts are discrete scheduled events. Keeping them on
 * different nodes means the two automation styles never fight over one AudioParam.
 *
 * Wind covers the mid frequencies where speech sits, and because the centre
 * frequency wanders there is no fixed pitch for the ear to lock onto and start
 * tracking (research.md §2, §3).
 */

import type { BaseAudioContext, GainNode, OscillatorNode } from 'react-native-audio-api';

import { getNoiseBuffer } from '../noise';
import { phasedSine } from '../onef';
import type { Layer, LayerIO } from '../types';

const TAU = Math.PI * 2;

export function createWind(ctx: BaseAudioContext, { scheduler, key = 'wind' }: LayerIO): Layer {
  const t0 = ctx.currentTime;
  const out = ctx.createGain();

  const src = ctx.createBufferSource();
  const srcBuffer = getNoiseBuffer(ctx, 'pink', 'wind');
  src.buffer = srcBuffer;
  src.loop = true;

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(550, t0);
  bp.Q.value = 0.7;

  const tame = ctx.createBiquadFilter();
  tame.type = 'lowpass';
  tame.frequency.value = 3000;
  tame.Q.value = 0.5;

  const swell = ctx.createGain();
  swell.gain.setValueAtTime(0.55, t0);

  const gust = ctx.createGain();
  gust.gain.setValueAtTime(1, t0);

  src.connect(bp);
  bp.connect(tame);
  tame.connect(swell);
  swell.connect(gust);
  gust.connect(out);

  const lfos: OscillatorNode[] = [];
  const lfoGains: GainNode[] = [];
  const lfoSpecs: ReadonlyArray<readonly [number, number]> = [
    [0.031, 0.2],
    [0.083, 0.11],
  ];
  for (const [rate, depth] of lfoSpecs) {
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(phasedSine(ctx, Math.random() * TAU));
    osc.frequency.value = rate * (0.8 + Math.random() * 0.4);
    const g = ctx.createGain();
    g.gain.value = depth;
    osc.connect(g);
    g.connect(swell.gain);
    osc.start(t0);
    lfos.push(osc);
    lfoGains.push(g);
  }

  src.start(t0, Math.random() * srcBuffer.duration);

  scheduler.add(
    `${key}:wander`,
    (t) => {
      bp.frequency.setTargetAtTime(300 + Math.random() * 600, t, 1.4);
      return 2 + Math.random() * 3;
    },
    { startDelay: 1 + Math.random() * 2 }
  );

  scheduler.add(
    `${key}:gust`,
    (t) => {
      const peak = 1.2 + Math.random() * 0.35;
      const rise = 1.4 + Math.random() * 1.6;
      gust.gain.setTargetAtTime(peak, t, rise * 0.4);
      gust.gain.setTargetAtTime(1, t + rise + 1.5, 1.9);
      return 12 + Math.random() * 23;
    },
    { startDelay: 5 + Math.random() * 15 }
  );

  return {
    output: out,
    setParam(): void {},
    dispose(): void {
      scheduler.remove(`${key}:wander`);
      scheduler.remove(`${key}:gust`);
      for (const n of [src, ...lfos]) {
        try {
          n.stop();
        } catch {
          /* already stopped */
        }
      }
      for (const n of [src, bp, tame, swell, gust, out, ...lfos, ...lfoGains]) n.disconnect();
    },
  };
}
