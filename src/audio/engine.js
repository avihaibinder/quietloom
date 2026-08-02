/**
 * The generative audio engine.
 *
 * Zero audio files. Every sound in Quietloom is synthesised at runtime from plain
 * standard AudioNodes — no AudioWorklet, no ScriptProcessor — so it never loops
 * and never repeats (research.md §7).
 *
 * Signal path
 * -----------
 *   layer.output -> 1/f envelope -> layer gain -> master gain -> nursery cap
 *                                                            -> limiter -> destination
 *
 * Every layer is multiplied by a slow 1/f amplitude envelope; that is the whole
 * difference between "a noise generator" and "rain". Layers are built lazily on
 * first enable and torn down on disable, so an eight-hour night of two layers
 * costs two layers of CPU.
 *
 * Surviving the screen going off
 * ------------------------------
 *  - Continuous modulation (wave swells, wind wander, 1/f) is OscillatorNodes
 *    routed to AudioParams. It runs on the audio thread and cannot be throttled.
 *  - Discrete events (droplets, crackles, thunder, pulses) are pre-scheduled 90 s
 *    ahead by scheduler.js, topped up every 5 s.
 *  - fadeMasterTo() ramps on ctx.currentTime, so the sleep timer's fade completes
 *    correctly even if the main thread is suspended for the whole minute.
 *
 * PUBLIC API IS A FROZEN CONTRACT — the UI codes against it. Extra methods added
 * here (getOceanPhase, setNurserySafe, getContext) are additive only.
 */

import { bus } from '../core/bus.js';
import { Scheduler } from './scheduler.js';
import { createOneOverF } from './onef.js';
import { playChime as strikeChime } from './chime.js';
import { createRain } from './layers/rain.js';
import { createThunder } from './layers/thunder.js';
import { createOcean, OCEAN_HZ } from './layers/ocean.js';
import { createWind } from './layers/wind.js';
import { createFire } from './layers/fire.js';
import { createCrickets } from './layers/crickets.js';
import { createNoiseBed } from './layers/noisebed.js';
import { createBinaural } from './layers/binaural.js';
import { createDeepPulse } from './layers/deeppulse.js';

export const SOUND_IDS = [
  'rain',
  'thunder',
  'ocean',
  'wind',
  'fire',
  'crickets',
  'pink',
  'brown',
  'white',
  'binaural',
  'deeppulse',
];

export const LAYER_DEFAULTS = {
  rain: { volume: 0.6, params: { intensity: 0.5 } },
  thunder: { volume: 0.4, params: { frequency: 0.3 } },
  ocean: { volume: 0.7, params: {} },
  wind: { volume: 0.4, params: {} },
  fire: { volume: 0.6, params: {} },
  crickets: { volume: 0.3, params: {} },
  pink: { volume: 0.45, params: {} },
  brown: { volume: 0.5, params: {} },
  white: { volume: 0.4, params: {} },
  binaural: { volume: 0.3, params: { baseHz: 250, beatHz: 0.25 } },
  deeppulse: { volume: 0.5, params: {} },
};

const FACTORIES = {
  rain: (ctx, io) => createRain(ctx, io),
  thunder: (ctx, io) => createThunder(ctx, io),
  ocean: (ctx, io) => createOcean(ctx, io),
  wind: (ctx, io) => createWind(ctx, io),
  fire: (ctx, io) => createFire(ctx, io),
  crickets: (ctx, io) => createCrickets(ctx, io),
  pink: (ctx, io) => createNoiseBed(ctx, { ...io, type: 'pink' }),
  brown: (ctx, io) => createNoiseBed(ctx, { ...io, type: 'brown' }),
  white: (ctx, io) => createNoiseBed(ctx, { ...io, type: 'white' }),
  binaural: (ctx, io) => createBinaural(ctx, io),
  deeppulse: (ctx, io) => createDeepPulse(ctx, io),
};

/** Per-layer loudness trim. Synthesis levels differ wildly; this is what makes a
 *  slider at 0.5 mean roughly the same thing on every layer. */
const TRIM = {
  rain: 0.55,
  thunder: 1.0,
  ocean: 0.6,
  // Measured against the other continuous layers at an identical slider
  // position, wind came out ~12 dB quiet - inaudible the moment anything else
  // was playing. Bandpassed noise carries far less energy than the broadband
  // beds it sits next to, which is not obvious until you render and measure it.
  wind: 1.3,
  // Raised to compensate for the crackle-forward rebalance inside fire.js: the
  // low bed carried most of the layer's energy, so trading it for grain detail
  // cost ~7 dB of level even though it gained presence.
  fire: 1.5,
  crickets: 0.22,
  pink: 0.5,
  brown: 0.45,
  white: 0.35,
  binaural: 0.22,
  deeppulse: 0.55,
};

/** 1/f depth per layer. Shallow on the two clinical layers, where the stimulus
 *  itself is the point and amplitude wobble would only muddy it. */
const ONEF_DEPTH = {
  rain: 0.16,
  thunder: 0.1,
  ocean: 0.1,
  wind: 0.18,
  fire: 0.15,
  crickets: 0.14,
  pink: 0.12,
  brown: 0.12,
  white: 0.12,
  binaural: 0.05,
  deeppulse: 0.08,
};

const FADE_TC = 0.04; // setTargetAtTime time constant — ~120 ms to settle
const DISABLE_RAMP = 0.15;
const DISABLE_TEARDOWN_MS = 400;
const START_RAMP = 0.5;
const STOP_RAMP = 0.35;
const NURSERY_CAP = 0.3; // hard ceiling for use near an infant (research.md §8)
const SILENT = 0.0001;

const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));

/** Perceptual taper on the master fader. Applied identically by setMasterVolume
 *  and fadeMasterTo so the timer can restore an exact level. */
const gainFor = (v) => Math.pow(clamp01(v), 1.7);

/** Pin an AudioParam to its current value so the next ramp has a defined start.
 *  Ramping from an unset value is the classic source of clicks and jumps. */
function anchor(param, t) {
  const held = param.value;
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(t);
  } else {
    param.cancelScheduledValues(t);
    param.setValueAtTime(held, t);
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = 0.7;
    this.layers = {};
    for (const id of SOUND_IDS) {
      const d = LAYER_DEFAULTS[id];
      this.layers[id] = { enabled: false, volume: d.volume, params: { ...d.params } };
    }
    this._running = false;

    this._sched = null;
    this._masterGain = null;
    this._capGain = null;
    this._limiter = null;
    this._nodes = {};
    this._nursery = false;

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => this._wake());
    }
  }

  // ---------------------------------------------------------------- transport

  async start() {
    if (this._running) return;
    const ctx = this._ensureContext();
    // Always called from a user gesture; this is what unlocks audio on Android.
    try {
      await ctx.resume();
    } catch (err) {
      console.warn('[engine] resume failed', err);
    }

    this._running = true;
    this._sched.start();

    const now = ctx.currentTime;
    const g = this._masterGain.gain;
    // Always come up from silence, so a half-finished stop fade cannot leave the
    // ramp starting from an undefined value.
    g.cancelScheduledValues(now);
    g.setValueAtTime(SILENT, now);
    g.linearRampToValueAtTime(Math.max(SILENT, gainFor(this.master)), now + START_RAMP);

    for (const id of SOUND_IDS) if (this.layers[id].enabled) this._applyLayer(id);

    bus.emit('audio:started', {});
    bus.emit('mix:changed', this.getState());
  }

  async stop() {
    if (!this._running) return;
    this._running = false;

    if (this.ctx && this._masterGain) {
      const now = this.ctx.currentTime;
      const g = this._masterGain.gain;
      anchor(g, now);
      g.linearRampToValueAtTime(0, now + STOP_RAMP);
    }

    bus.emit('audio:stopped', {});
    bus.emit('mix:changed', this.getState());

    await wait(STOP_RAMP * 1000 + 60);
    // start() may have been pressed again during the fade — leave everything up.
    if (this._running) return;

    this._sched?.stop();
    for (const id of Object.keys(this._nodes)) this._disposeLayer(id);
    try {
      await this.ctx?.suspend();
    } catch {
      /* some platforms refuse; harmless, master is already at 0 */
    }
  }

  isRunning() {
    return this._running;
  }

  // ------------------------------------------------------------------- layers

  setLayerEnabled(id, on) {
    if (!this.layers[id]) return;
    this.layers[id].enabled = !!on;
    this._applyLayer(id);
    bus.emit('mix:changed', this.getState());
  }

  setLayerVolume(id, v) {
    if (!this.layers[id]) return;
    this.layers[id].volume = clamp01(v);
    const n = this._nodes[id];
    if (n && this.ctx && this.layers[id].enabled) {
      n.gain.gain.setTargetAtTime(this.layers[id].volume * TRIM[id], this.ctx.currentTime, FADE_TC);
    }
    bus.emit('mix:changed', this.getState());
  }

  setLayerParam(id, name, value) {
    if (!this.layers[id]) return;
    this.layers[id].params[name] = value;
    this._nodes[id]?.layer.setParam?.(name, value);
    bus.emit('mix:changed', this.getState());
  }

  // ------------------------------------------------------------------- master

  setMasterVolume(v) {
    this.master = clamp01(v);
    if (this.ctx && this._masterGain && this._running) {
      // Deliberately no cancel: if the sleep timer has a fade to zero already on
      // the audio clock, a volume nudge must not silently disarm it.
      this._masterGain.gain.setTargetAtTime(gainFor(this.master), this.ctx.currentTime, FADE_TC);
    }
    bus.emit('mix:changed', this.getState());
  }

  /**
   * Fade the audible master to `v` over `seconds`, scheduled on the audio clock.
   * Does NOT change `this.master` — the sleep timer fades out and then restores
   * getState().master, so the logical level has to survive the fade.
   */
  async fadeMasterTo(v, seconds) {
    const secs = Math.max(0.05, Number(seconds) || 0);
    if (!this.ctx || !this._masterGain) return;
    const g = this._masterGain.gain;
    const now = this.ctx.currentTime;
    anchor(g, now);
    g.linearRampToValueAtTime(Math.max(0, gainFor(v)), now + secs);
    await wait(secs * 1000 + 30);
  }

  playChime() {
    let ctx;
    try {
      ctx = this._ensureContext();
    } catch (err) {
      console.warn('[engine] no audio context for chime', err);
      return;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    // Routed past the master gain on purpose: the timer plays this immediately
    // after fading master to zero, and the chime still has to be audible.
    strikeChime(ctx, this._capGain, { gain: 0.26 * (0.4 + 0.6 * this.master) });
  }

  /** Hard ceiling for use near an infant — research.md §8. Additive to the contract. */
  setNurserySafe(on) {
    this._nursery = !!on;
    if (this._capGain && this.ctx) {
      this._capGain.gain.setTargetAtTime(this._nursery ? NURSERY_CAP : 1, this.ctx.currentTime, 0.08);
    }
  }

  isNurserySafe() {
    return this._nursery;
  }

  // -------------------------------------------------------------------- state

  getState() {
    return {
      master: this.master,
      running: this._running,
      layers: JSON.parse(JSON.stringify(this.layers)),
    };
  }

  applyMix(mix) {
    if (!mix || !mix.layers) return;
    for (const id of SOUND_IDS) {
      const spec = mix.layers[id];
      const L = this.layers[id];
      if (!L) continue;
      if (spec) {
        L.enabled = spec.enabled !== false;
        if (typeof spec.volume === 'number') L.volume = clamp01(spec.volume);
        if (spec.params) L.params = { ...L.params, ...spec.params };
      } else {
        L.enabled = false;
      }
    }
    // One pass over the whole graph after the state settles, so a preset swap is
    // a single crossfade rather than eleven independent ones.
    for (const id of SOUND_IDS) {
      this._applyLayer(id);
      const n = this._nodes[id];
      if (!n?.layer.setParam) continue;
      for (const [name, value] of Object.entries(this.layers[id].params)) {
        n.layer.setParam(name, value);
      }
    }
    bus.emit('mix:changed', this.getState());
  }

  /**
   * Position within the 10.000 s ocean swell: 0 = trough (start of inhale),
   * 0.5 = crest (start of exhale). Derived from the audio clock, so it is exact
   * and stays valid whether or not the ocean layer is enabled — drive the UI
   * breathing animation straight from this. See layers/ocean.js.
   */
  getOceanPhase() {
    if (!this.ctx) return 0;
    const p = (this.ctx.currentTime * OCEAN_HZ) % 1;
    return p < 0 ? p + 1 : p;
  }

  getContext() {
    return this.ctx;
  }

  // ------------------------------------------------------------------ private

  _ensureContext() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ latencyHint: 'playback' });
    this._sched = new Scheduler(this.ctx);
    this._buildGraph();
    this.ctx.onstatechange = () => this._wake();
    return this.ctx;
  }

  _buildGraph() {
    const ctx = this.ctx;

    this._limiter = ctx.createDynamicsCompressor();
    this._limiter.threshold.value = -4;
    this._limiter.knee.value = 12;
    this._limiter.ratio.value = 6;
    this._limiter.attack.value = 0.01;
    this._limiter.release.value = 0.4;

    this._capGain = ctx.createGain();
    this._capGain.gain.value = this._nursery ? NURSERY_CAP : 1;

    this._masterGain = ctx.createGain();
    this._masterGain.gain.value = 0;

    this._masterGain.connect(this._capGain);
    this._capGain.connect(this._limiter);
    this._limiter.connect(ctx.destination);
  }

  _wake() {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    if (!this._running || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  _ensureLayer(id) {
    if (this._nodes[id]) return this._nodes[id];
    const ctx = this.ctx;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.connect(this._masterGain);

    const onef = createOneOverF(ctx, { depth: ONEF_DEPTH[id] });
    onef.node.connect(gain);

    const layer = FACTORIES[id](ctx, {
      scheduler: this._sched,
      params: this.layers[id].params,
      key: id,
    });
    layer.output.connect(onef.node);

    const entry = { layer, onef, gain, teardown: null };
    this._nodes[id] = entry;
    return entry;
  }

  _applyLayer(id) {
    if (!this.ctx || !this._running) return;
    const L = this.layers[id];
    const now = this.ctx.currentTime;

    if (L.enabled) {
      const n = this._ensureLayer(id);
      if (n.teardown) {
        clearTimeout(n.teardown);
        n.teardown = null;
      }
      n.gain.gain.setTargetAtTime(L.volume * TRIM[id], now, FADE_TC);
      return;
    }

    const n = this._nodes[id];
    if (!n || n.teardown) return;
    const g = n.gain.gain;
    anchor(g, now);
    g.linearRampToValueAtTime(0, now + DISABLE_RAMP);
    n.teardown = setTimeout(() => this._disposeLayer(id), DISABLE_TEARDOWN_MS);
  }

  _disposeLayer(id) {
    const n = this._nodes[id];
    if (!n) return;
    delete this._nodes[id];
    if (n.teardown) clearTimeout(n.teardown);
    try {
      n.layer.dispose();
    } catch (err) {
      console.warn(`[engine] dispose "${id}" failed`, err);
    }
    try {
      n.onef.dispose();
    } catch {
      /* ignore */
    }
    n.gain.disconnect();
  }
}

export const engine = new AudioEngine();
