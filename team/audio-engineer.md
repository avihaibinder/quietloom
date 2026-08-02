# Audio Engineering — discipline charter

> This is the shared domain reference for the audio team. It holds the rules and the
> verification method, which do not change with level. For scope, reporting lines and
> model, see [audio-senior.md](audio-senior.md) and [audio-junior.md](audio-junior.md).

## Mission

Own the generative engine. Every sound in Quietloom is synthesised in real time from
standard Web Audio nodes — no audio files, ever. This is the moat: a recording loops,
and once a user hears the seam they cannot unhear it. Ours never repeats.

## Owns

| Area | Files |
|---|---|
| Engine core | `src/audio/engine.js` |
| Primitives | `src/audio/noise.js`, `onef.js`, `scheduler.js`, `chime.js` |
| Layers | `src/audio/layers/*.js` (rain, thunder, ocean, wind, fire, crickets, noisebed, binaural, deeppulse) |
| Dev harnesses | `audio-test.html`, `tools/render-samples.mjs`, `tools/render.html`, `tools/analyse-samples.mjs` |

## Does not own

`src/ui/**`, `src/scenes/**`, `src/services/**`, `src/main.js`. The UI drives the
engine through its public API and nothing else.

## The frozen contract

Additive changes are fine. Removing or changing any of these is a coordination event
with the CEO, because the UI is written against them:

```js
export const SOUND_IDS, LAYER_DEFAULTS;
class AudioEngine {
  start(); stop(); isRunning();
  setLayerEnabled(id, on); setLayerVolume(id, v); setLayerParam(id, name, value);
  setMasterVolume(v); fadeMasterTo(v, seconds); playChime();
  getState(); applyMix(mix);
  // additive, already relied on by the UI:
  getOceanPhase(); setNurserySafe(on); isNurserySafe(); getContext();
}
```

`fadeMasterTo` deliberately does **not** mutate `master`. The sleep timer fades to
zero and later restores `getState().master`, so the logical level has to survive the
fade.

## Rules that are not negotiable

**No AudioWorklet, no ScriptProcessorNode.** Standard nodes only. ScriptProcessor is
deprecated and janks the main thread; the worklet is not worth the complexity here.

**The scheduler keeps a 90-second horizon.** Android throttles JS timers to roughly
once a minute when the screen is off. Anything discrete — droplets, crackles,
thunder, pulses — must be pre-scheduled on `ctx.currentTime`, not driven by a timer
that will stop firing. Continuous modulation must be `OscillatorNode` → `AudioParam`,
which runs on the audio thread and cannot be throttled at all.

**Every layer carries a 1/f amplitude envelope.** This is the difference between "a
noise generator" and "rain". See `research.md` §7.

**Never ramp from an unset AudioParam.** Anchor the current value first. This is the
single most common source of clicks.

**Dispose every one-shot node.** The app plays for eight hours. A node created per
droplet and never disconnected is a crash, not a leak. Note that `ended` does not
fire once the context is suspended, which is how ~500 orphaned nodes once survived a
preset swap — the voice pool now kills them explicitly on dispose.

**The ocean swell period is exactly 10.000 seconds.** Not approximately. It is 0.1 Hz
baroreflex resonance and doubles as a six-breaths-per-minute pacer that the breathing
UI reads through `getOceanPhase()`. Do not "improve" it by randomising the period.

## How to verify

You cannot rely on hearing it — the build machine has no audio. Render and measure:

```powershell
node tools/render-samples.mjs     # writes samples/*.wav via OfflineAudioContext
node tools/analyse-samples.mjs    # crest, transients/s, modulation, A-weighted bands
```

What good looks like:

| Signal | Expectation |
|---|---|
| Continuous layers | RMS within roughly a 6 dB window of each other at the same slider |
| Peaks | ≤ ~0.35, well clear of clipping |
| Ocean | modulation period 10.0 s, depth ≈ 0.6 |
| Binaural | crest ≈ 1.4 (a sine), energy concentrated at the carrier |
| Pink | flat per octave · Brown steeply falling · White rising |
| Sparse layers | thunder, crickets, deeppulse legitimately measure lower RMS — check *peak* |

**Use the A-weighted column for balance judgements.** Unweighted, fire reads as 88%
low-frequency and a correct rebalance looks like a failure. The ear is roughly 25 dB
less sensitive at 100 Hz than at 3 kHz, so the unweighted number answers the wrong
question.

Also worth running before any release: an eight-hour simulated run with timers
throttled, watching that node count stays flat and the scheduler horizon never empties.

## Known limitations

- Rain droplet **rate** lags an intensity change by up to 90 s, inherent to
  pre-scheduling. Droplet *level* moves instantly so the fader still feels immediate.
- Node count on a rich preset is around 3,900. Flat and leak-free, but it is the
  number to watch on a low-end phone. Halving the horizon for `rain:drops` and
  `fire:crackle` halves it if field reports ever complain.
- `TRIM` in `engine.js` is the single table for per-layer loudness. If a preset sounds
  lopsided, that is the one place to adjust.

## Now

1. Ear-check the rendered samples on real headphones — the balance is measured but
   nobody has listened critically yet.
2. Consider a gentle high-shelf on white noise; it measures correct but is the
   harshest layer.
3. If background audio becomes a first-party foreground service, confirm the
   scheduler still behaves when the WebView is genuinely backgrounded rather than
   merely screen-off.
