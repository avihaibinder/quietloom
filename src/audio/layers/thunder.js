/**
 * Distant thunder — rare, low, and deliberately unstartling.
 *
 * Each strike builds its own short-lived graph:
 *   brown loop -> lowpass 90–160 Hz -> slow envelope   (the rumble)
 *   brown loop -> lowpass 300 Hz    -> shorter envelope (the crack, 50–200 ms later)
 * Both are torn down on `ended`, so nothing survives the event.
 *
 * There is no idling node graph: at a mean gap of 20–90 seconds it is cheaper to
 * build a strike than to keep a filtered source running at zero gain all night.
 *
 * `frequency` (0..1) maps to a mean gap of 90 s down to 20 s. Attack is never
 * shorter than 100 ms and peaks stay modest: single events much above ~45 dB
 * cause micro-arousals (research.md §8), so thunder here is weather happening
 * somewhere else, not a jump scare.
 */

import { getNoiseBuffer, createVoicePool } from '../noise.js';
import { poissonGap } from '../scheduler.js';

const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));

export function createThunder(ctx, { scheduler, params = {}, key = 'thunder' }) {
  const p = { frequency: params.frequency == null ? 0.3 : clamp01(params.frequency) };
  const out = ctx.createGain();
  const buffer = getNoiseBuffer(ctx, 'brown', 'thunder');
  const voices = createVoicePool();

  function boom(t, peak, cutoff, attack, decay) {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.playbackRate.value = 0.65 + Math.random() * 0.5;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    lp.Q.value = 0.7;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0008, t + attack + decay);
    env.gain.linearRampToValueAtTime(0, t + attack + decay + 0.08);

    src.connect(lp);
    lp.connect(env);
    env.connect(out);
    src.start(t, Math.random() * buffer.duration);
    src.stop(t + attack + decay + 0.12);
    voices.track(src, lp, env);
  }

  scheduler.add(
    `${key}:strike`,
    (t) => {
      const peak = 0.3 + Math.random() * 0.7;
      const attack = 0.1 + Math.random() * 0.4;
      const decay = 3 + Math.random() * 5;
      boom(t, peak, 90 + Math.random() * 70, attack, decay);
      // The near-field "crack", rolled off at 300 Hz and offset a little, is what
      // sells distance — a real strike arrives smeared, not as one thump.
      boom(t + 0.05 + Math.random() * 0.15, peak * 0.45, 300, 0.03, 0.8 + Math.random() * 1.4);

      const mean = 90 - 70 * p.frequency;
      return poissonGap(1 / mean, 0.4, 2.2);
    },
    { startDelay: 6 + Math.random() * 25 }
  );

  return {
    output: out,
    setParam(name, value) {
      if (name === 'frequency') p.frequency = clamp01(value);
    },
    dispose() {
      scheduler.remove(`${key}:strike`);
      voices.dispose();
      out.disconnect();
    },
  };
}
