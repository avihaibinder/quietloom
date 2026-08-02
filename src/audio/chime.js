/**
 * The end-of-timer chime. Three sines a fifth and an octave apart (660 / 990 /
 * 1320 Hz), each detuned a few cents and struck 30 ms after the last so it reads
 * as one soft bell rather than a chord.
 *
 * Long exponential decay, no attack transient, upper partials quieter than the
 * fundamental. This plays to someone who may already be asleep — it should be
 * possible to miss it.
 *
 * Every node is stopped and disconnected on `ended`.
 */

const FREQS = [660, 990, 1320];
const DECAY = 4;

export function playChime(ctx, destination, { gain = 0.3 } = {}) {
  const t0 = ctx.currentTime + 0.05;
  FREQS.forEach((freq, i) => {
    const t = t0 + i * 0.03;
    const peak = Math.max(0.001, gain * (1 - i * 0.22));

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.detune.value = (Math.random() * 2 - 1) * 6;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t + DECAY);
    env.gain.linearRampToValueAtTime(0, t + DECAY + 0.05);

    osc.connect(env);
    env.connect(destination);
    osc.start(t);
    osc.stop(t + DECAY + 0.1);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };
  });
}
