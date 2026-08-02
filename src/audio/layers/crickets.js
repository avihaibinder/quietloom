/**
 * Night crickets — three independent voices.
 *
 * Per voice:
 *   sine 4.2–4.8 kHz -> gate gain (0..1 at ~25 Hz) -> chirp gain (burst envelope)
 *                    -> panner -> out
 *
 * The ~25 Hz gate is what makes a cricket a cricket: amplitude modulating a pure
 * tone at that rate produces the characteristic trill and its sidebands. Each
 * voice gets its own carrier, pan, gate rate and chirp timing, so the three never
 * lock together.
 *
 * There are no per-event nodes at all here — a chirp is four automation points on
 * a gain that already exists. This layer can run for eight hours without
 * allocating anything.
 *
 * Insect sound was part of the soundscape that raised HRV and slowed respiration
 * (research.md §3); Drift keeps the chirps sparse and high so they sit above the
 * masking bed rather than competing with it.
 */

import { phasedSine } from '../onef.js';

const TAU = Math.PI * 2;
const PANS = [-0.62, 0.08, 0.7];

export function createCrickets(ctx, { scheduler, key = 'crickets' }) {
  const t0 = ctx.currentTime;
  const out = ctx.createGain();

  const nodes = [];
  const sources = [];

  for (let i = 0; i < PANS.length; i++) {
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = 4200 + Math.random() * 600;

    const gate = ctx.createOscillator();
    gate.setPeriodicWave(phasedSine(ctx, Math.random() * TAU));
    gate.frequency.setValueAtTime(23 + Math.random() * 4, t0);

    const gateGain = ctx.createGain();
    gateGain.gain.setValueAtTime(0.5, t0);
    const gateDepth = ctx.createGain();
    gateDepth.gain.value = 0.5;
    gate.connect(gateDepth);
    gateDepth.connect(gateGain.gain);

    const chirp = ctx.createGain();
    chirp.gain.setValueAtTime(0, t0);

    const pan = ctx.createStereoPanner();
    pan.pan.value = PANS[i];

    carrier.connect(gateGain);
    gateGain.connect(chirp);
    chirp.connect(pan);
    pan.connect(out);

    carrier.start(t0);
    gate.start(t0);
    sources.push(carrier, gate);
    nodes.push(carrier, gate, gateGain, gateDepth, chirp, pan);

    scheduler.add(
      `${key}:v${i}`,
      (t) => {
        const dur = 0.3 + Math.random() * 0.3;
        const peak = 0.32 + Math.random() * 0.3;
        // chirp rate rises and falls a little, the way temperature moves it
        gate.frequency.setValueAtTime(22 + Math.random() * 7, t);
        carrier.detune.setValueAtTime((Math.random() * 2 - 1) * 40, t);
        chirp.gain.setValueAtTime(0, t);
        chirp.gain.linearRampToValueAtTime(peak, t + 0.04);
        chirp.gain.setValueAtTime(peak, t + dur - 0.07);
        chirp.gain.linearRampToValueAtTime(0, t + dur);
        return dur + 0.5 + Math.random() * 2.5;
      },
      { startDelay: 0.4 + i * 0.7 + Math.random() }
    );
  }

  return {
    output: out,
    setParam() {},
    dispose() {
      for (let i = 0; i < PANS.length; i++) scheduler.remove(`${key}:v${i}`);
      for (const s of sources) {
        try {
          s.stop();
        } catch {
          /* already stopped */
        }
      }
      for (const n of nodes) n.disconnect();
      out.disconnect();
    },
  };
}
