/**
 * The plain noise beds — one module serving `pink`, `brown` and `white`.
 *
 *   noise loop -> shaping filter -> out
 *
 * Pink is Quietloom's default because it is the colour with the best evidence: steady
 * pink noise reduced EEG complexity and raised the percentage of stable sleep
 * time (research.md §1). Most apps default to white, which the literature
 * supports less well — so white here gets a gentle 7 kHz lowpass to take the
 * hiss off the top, and brown a 22 Hz highpass so it cannot pump a phone speaker
 * with subsonic energy it can never reproduce.
 *
 * The 1/f envelope the engine wraps around this is what stops it feeling like a
 * test tone: even a "steady" bed should breathe (research.md §7).
 */

import { getNoiseBuffer } from '../noise.js';

const SHAPES = {
  white: { type: 'lowpass', freq: 7000, q: 0.5 },
  pink: { type: 'highpass', freq: 25, q: 0.5 },
  brown: { type: 'highpass', freq: 22, q: 0.5 },
};

export function createNoiseBed(ctx, { type = 'pink', key = type } = {}) {
  const t0 = ctx.currentTime;
  const out = ctx.createGain();

  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx, type, key);
  src.loop = true;

  const shape = SHAPES[type] || SHAPES.pink;
  const filter = ctx.createBiquadFilter();
  filter.type = shape.type;
  filter.frequency.value = shape.freq;
  filter.Q.value = shape.q;

  src.connect(filter);
  filter.connect(out);
  src.start(t0, Math.random() * src.buffer.duration);

  return {
    output: out,
    setParam() {},
    dispose() {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      src.disconnect();
      filter.disconnect();
      out.disconnect();
    },
  };
}
