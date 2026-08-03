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
 *                                                            -> soft-clip -> destination
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
 * React Native adaptations (vs the web build)
 * -------------------------------------------
 *  - react-native-audio-api has no DynamicsCompressorNode, so the output limiter
 *    is a WaveShaperNode running a gentle tanh soft-clip instead (see
 *    makeSoftClipCurve below). Same job — catch the rare constructive pile-up of
 *    several layers — different mechanism.
 *  - There is no document.visibilitychange and no ctx.onstatechange; the wake-up
 *    hook is React Native's AppState instead.
 *  - AudioContextOptions has no latencyHint, so the context is created bare.
 *
 * PUBLIC API IS A FROZEN CONTRACT — the UI codes against it. Extra methods added
 * here (getOceanPhase, setNurserySafe, getContext) are additive only.
 */

import { AppState } from 'react-native';
import { AudioContext, GainNode, WaveShaperNode } from 'react-native-audio-api';
import type { AudioParam } from 'react-native-audio-api';

import { bus } from '../core/bus';
import { SOUND_IDS } from '../types';
import type { EngineState, LayerParams, LayerState, MixSpec, SoundId } from '../types';
import { playChime as strikeChime } from './chime';
import { createBinaural } from './layers/binaural';
import { createCrickets } from './layers/crickets';
import { createDeepPulse } from './layers/deeppulse';
import { createFire } from './layers/fire';
import { createNoiseBed } from './layers/noisebed';
import { createOcean, OCEAN_HZ } from './layers/ocean';
import { createRain } from './layers/rain';
import { createThunder } from './layers/thunder';
import { createWind } from './layers/wind';
import { createOneOverF } from './onef';
import type { OneOverF } from './onef';
import { Scheduler } from './scheduler';
import type { Layer, LayerFactory } from './types';

export { SOUND_IDS };

export const LAYER_DEFAULTS: Record<SoundId, { volume: number; params: Record<string, number> }> = {
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

const FACTORIES: Record<SoundId, LayerFactory> = {
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
const TRIM: Record<SoundId, number> = {
  rain: 0.55,
  thunder: 1.0,
  ocean: 0.6,
  // Measured against the other continuous layers at an identical slider
  // position, wind came out ~12 dB quiet - inaudible the moment anything else
  // was playing. Bandpassed noise carries far less energy than the broadband
  // beds it sits next to, which is not obvious until you render and measure it.
  wind: 1.3,
  // Raised to compensate for the crackle-forward rebalance inside fire.ts: the
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
const ONEF_DEPTH: Record<SoundId, number> = {
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

const clamp01 = (v: number): number => Math.min(1, Math.max(0, Number(v) || 0));

/** Perceptual taper on the master fader. Applied identically by setMasterVolume
 *  and fadeMasterTo so the timer can restore an exact level. */
const gainFor = (v: number): number => Math.pow(clamp01(v), 1.7);

/** Pin an AudioParam to its current value so the next ramp has a defined start.
 *  Ramping from an unset value is the classic source of clicks and jumps.
 *  react-native-audio-api always implements cancelAndHoldAtTime, so the web
 *  build's feature detection is gone. */
function anchor(param: AudioParam, t: number): void {
  param.cancelAndHoldAtTime(t);
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * SUBSTITUTION — the web build ended the chain in a DynamicsCompressorNode
 * (threshold -4 dB, knee 12, ratio 6:1) as a safety limiter. This library has no
 * compressor, so the same slot holds a WaveShaperNode with a gentle tanh
 * soft-clip: y = tanh(1.2·x) / 1.2 sampled over the shaper's [-1, 1] input
 * domain (2048 points).
 *
 * The /1.2 normalisation gives UNITY SLOPE AT ZERO — that is the load-bearing
 * property. The TRIM table, the nursery-safe cap (research.md §8) and the WHO
 * volume-guide copy were all calibrated against a compressor that is transparent
 * below threshold; a curve with makeup gain would have made the nursery ceiling
 * physically louder than the web build. This one is transparent at
 * sleep-listening levels (−0.5 dB at a typical 0.35 peak), bends gracefully as
 * layers pile up, and can never emit a sample beyond ±tanh(1.2)/1.2 ≈ 0.695 —
 * which matches the web compressor's effective full-scale ceiling (threshold
 * −4 dB, ratio 6 → ≈ 0.68 at 0 dBFS input), so the two builds level-match both
 * quietly and at the ceiling.
 */
const SOFTCLIP_POINTS = 2048;
const SOFTCLIP_DRIVE = 1.2;

function makeSoftClipCurve(): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(SOFTCLIP_POINTS);
  for (let i = 0; i < SOFTCLIP_POINTS; i++) {
    const x = (2 * i) / (SOFTCLIP_POINTS - 1) - 1; // [-1, 1]
    curve[i] = Math.tanh(SOFTCLIP_DRIVE * x) / SOFTCLIP_DRIVE;
  }
  return curve;
}

interface LayerEntry {
  layer: Layer;
  onef: OneOverF;
  gain: GainNode;
  teardown: ReturnType<typeof setTimeout> | null;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master = 0.7;
  private layers: Record<SoundId, LayerState>;
  private _running = false;

  private _sched: Scheduler | null = null;
  private _masterGain: GainNode | null = null;
  private _capGain: GainNode | null = null;
  private _softClip: WaveShaperNode | null = null;
  private _nodes: Partial<Record<SoundId, LayerEntry>> = {};
  private _nursery = false;

  /**
   * getState() cache — see getState() for the invariant that makes it safe.
   * `null` always means "rebuild this piece". The three levels are invalidated
   * independently so a volume tick rebuilds three small objects instead of 23.
   */
  private _stateCache: EngineState | null = null;
  private _layersCache: Record<SoundId, LayerState> | null = null;
  private _layerCache: Record<SoundId, LayerState | null>;
  private _paramsCache: Record<SoundId, LayerParams | null>;

  constructor() {
    const layers = {} as Record<SoundId, LayerState>;
    const layerCache = {} as Record<SoundId, LayerState | null>;
    const paramsCache = {} as Record<SoundId, LayerParams | null>;
    for (const id of SOUND_IDS) {
      const d = LAYER_DEFAULTS[id];
      layers[id] = { enabled: false, volume: d.volume, params: { ...d.params } };
      layerCache[id] = null;
      paramsCache[id] = null;
    }
    this.layers = layers;
    this._layerCache = layerCache;
    this._paramsCache = paramsCache;

    // The RN equivalent of the web build's visibilitychange hook: coming back to
    // the foreground is the moment to notice the OS suspended our context.
    AppState.addEventListener('change', (state) => {
      if (state === 'active') this._wake();
    });
  }

  // ---------------------------------------------------------------- transport

  async start(): Promise<void> {
    if (this._running) return;
    const ctx = this._ensureContext();
    // Always called from a user gesture; this is what unlocks audio on Android.
    try {
      await ctx.resume();
    } catch (err) {
      console.warn('[engine] resume failed', err);
    }

    this._running = true;
    this._dirtyTop();
    this._sched?.start();

    const g = this._masterGain?.gain;
    if (g) {
      const now = ctx.currentTime;
      // Always come up from silence, so a half-finished stop fade cannot leave the
      // ramp starting from an undefined value.
      g.cancelScheduledValues(now);
      g.setValueAtTime(SILENT, now);
      g.linearRampToValueAtTime(Math.max(SILENT, gainFor(this.master)), now + START_RAMP);
    }

    for (const id of SOUND_IDS) if (this.layers[id].enabled) this._applyLayer(id);

    bus.emit('audio:started', {});
    bus.emit('mix:changed', this.getState());
  }

  async stop(): Promise<void> {
    if (!this._running) return;
    this._running = false;
    this._dirtyTop();

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
    for (const id of SOUND_IDS) if (this._nodes[id]) this._disposeLayer(id);
    try {
      await this.ctx?.suspend();
    } catch {
      /* some platforms refuse; harmless, master is already at 0 */
    }
  }

  isRunning(): boolean {
    return this._running;
  }

  // ------------------------------------------------------------------- layers

  setLayerEnabled(id: SoundId, on: boolean): void {
    if (!this.layers[id]) return;
    this.layers[id].enabled = !!on;
    this._dirtyLayer(id);
    this._applyLayer(id);
    bus.emit('mix:changed', this.getState());
  }

  setLayerVolume(id: SoundId, v: number): void {
    if (!this.layers[id]) return;
    this.layers[id].volume = clamp01(v);
    this._dirtyLayer(id);
    const n = this._nodes[id];
    if (n && this.ctx && this.layers[id].enabled) {
      n.gain.gain.setTargetAtTime(this.layers[id].volume * TRIM[id], this.ctx.currentTime, FADE_TC);
    }
    bus.emit('mix:changed', this.getState());
  }

  setLayerParam(id: SoundId, name: string, value: number): void {
    if (!this.layers[id]) return;
    this.layers[id].params[name] = value;
    this._dirtyLayerParams(id);
    this._nodes[id]?.layer.setParam?.(name, value);
    bus.emit('mix:changed', this.getState());
  }

  // ------------------------------------------------------------------- master

  setMasterVolume(v: number): void {
    this.master = clamp01(v);
    this._dirtyTop();
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
  async fadeMasterTo(v: number, seconds: number): Promise<void> {
    const secs = Math.max(0.05, Number(seconds) || 0);
    if (!this.ctx || !this._masterGain) return;
    const g = this._masterGain.gain;
    const now = this.ctx.currentTime;
    anchor(g, now);
    g.linearRampToValueAtTime(Math.max(0, gainFor(v)), now + secs);
    await wait(secs * 1000 + 30);
  }

  playChime(): void {
    let ctx: AudioContext;
    try {
      ctx = this._ensureContext();
    } catch (err) {
      console.warn('[engine] no audio context for chime', err);
      return;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const cap = this._capGain;
    if (!cap) return;
    // Routed past the master gain on purpose: the timer plays this immediately
    // after fading master to zero, and the chime still has to be audible.
    strikeChime(ctx, cap, { gain: 0.26 * (0.4 + 0.6 * this.master) });
  }

  /** Hard ceiling for use near an infant — research.md §8. Additive to the contract. */
  setNurserySafe(on: boolean): void {
    this._nursery = !!on;
    if (this._capGain && this.ctx) {
      this._capGain.gain.setTargetAtTime(this._nursery ? NURSERY_CAP : 1, this.ctx.currentTime, 0.08);
    }
  }

  isNurserySafe(): boolean {
    return this._nursery;
  }

  // -------------------------------------------------------------------- state

  /**
   * INVALIDATION — every path that mutates observable state calls exactly one of
   * these three, and they are the ONLY writers of the cache fields.
   *
   *   _dirtyTop()          `master` or `running` changed
   *   _dirtyLayer(id)      that layer's `enabled` or `volume` changed
   *   _dirtyLayerParams(id) that layer's `params` changed (implies _dirtyLayer)
   *
   * Call sites, exhaustively:
   *   constructor          — caches start null, so nothing to dirty
   *   start()              _running = true        -> _dirtyTop
   *   stop()               _running = false       -> _dirtyTop
   *   setLayerEnabled()    layers[id].enabled     -> _dirtyLayer
   *   setLayerVolume()     layers[id].volume      -> _dirtyLayer
   *   setLayerParam()      layers[id].params[n]   -> _dirtyLayerParams
   *   setMasterVolume()    master                 -> _dirtyTop
   *   applyMix()           enabled/volume/params  -> _dirtyLayerParams per id
   *
   * Deliberately NOT invalidating:
   *   fadeMasterTo()  does not touch `master` by design — the sleep timer fades
   *                   to zero and later restores getState().master, so the
   *                   logical level must survive the fade.
   *   setNurserySafe() `_nursery` is not part of EngineState (isNurserySafe()).
   *   _applyLayer / _ensureLayer / _disposeLayer / _buildGraph / _wake — these
   *                   only read this.layers and touch AudioNodes.
   */
  private _dirtyTop(): void {
    this._stateCache = null;
  }

  private _dirtyLayer(id: SoundId): void {
    this._layerCache[id] = null;
    this._layersCache = null;
    this._stateCache = null;
  }

  private _dirtyLayerParams(id: SoundId): void {
    this._paramsCache[id] = null;
    this._dirtyLayer(id);
  }

  /**
   * The mix as the UI sees it.
   *
   * FROZEN CONTRACT: the returned shape is exactly
   * `{ master, running, layers: { <id>: { enabled, volume, params } } }`, with
   * `layers` keyed in SOUND_IDS order. That is unchanged from the version that
   * rebuilt all 23 objects on every call.
   *
   * This is called on every setLayerVolume, i.e. ~60x/second during a slider
   * drag, and five bus subscribers fan out from the emit. So the result is
   * cached, and only the parts that are actually dirty are rebuilt.
   *
   * THE INVARIANT THAT MAKES IT SAFE: nothing here is ever mutated in place
   * after it has been handed out. A changed layer gets a brand-new LayerState
   * (and a brand-new params object if params moved); the unchanged ten keep
   * their previous identity. So a caller that holds on to a previous result —
   * MixesSheet stores `getState().layers` straight into a SavedMix — keeps a
   * snapshot with exactly the semantics the deep clone gave it. Copy-on-write,
   * not shared mutable state.
   *
   * Cost: unchanged state -> 0 allocations. A volume or enable tick -> 3 (one
   * LayerState, the layers record, the EngineState). A params tick -> 4. A
   * master tick -> 1.
   */
  getState(): EngineState {
    const cached = this._stateCache;
    if (cached) return cached;

    let layers = this._layersCache;
    if (!layers) {
      const next = {} as Record<SoundId, LayerState>;
      for (const id of SOUND_IDS) {
        let snap = this._layerCache[id];
        if (!snap) {
          const L = this.layers[id];
          let params = this._paramsCache[id];
          if (!params) {
            params = { ...L.params };
            this._paramsCache[id] = params;
          }
          snap = { enabled: L.enabled, volume: L.volume, params };
          this._layerCache[id] = snap;
        }
        next[id] = snap;
      }
      layers = next;
      this._layersCache = next;
    }

    const state: EngineState = { master: this.master, running: this._running, layers };
    this._stateCache = state;
    return state;
  }

  applyMix(mix: MixSpec): void {
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
      // Dirty unconditionally: applyMix rewrites `enabled` on every layer, and
      // a preset that only *drops* a layer still changes it.
      this._dirtyLayerParams(id);
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
   * breathing animation straight from this. See layers/ocean.ts.
   */
  getOceanPhase(): number {
    if (!this.ctx) return 0;
    const p = (this.ctx.currentTime * OCEAN_HZ) % 1;
    return p < 0 ? p + 1 : p;
  }

  getContext(): AudioContext | null {
    return this.ctx;
  }

  // ------------------------------------------------------------------ private

  private _ensureContext(): AudioContext {
    if (this.ctx) return this.ctx;
    // No latencyHint here: react-native-audio-api's AudioContextOptions only
    // carries sampleRate. The web build asked for 'playback'; the native
    // engine's default buffering is already tuned for playback-style apps.
    this.ctx = new AudioContext();
    this._sched = new Scheduler(this.ctx);
    this._buildGraph(this.ctx);
    return this.ctx;
  }

  private _buildGraph(ctx: AudioContext): void {
    this._softClip = ctx.createWaveShaper();
    this._softClip.curve = makeSoftClipCurve();
    this._softClip.oversample = 'none';

    this._capGain = ctx.createGain();
    this._capGain.gain.value = this._nursery ? NURSERY_CAP : 1;

    this._masterGain = ctx.createGain();
    this._masterGain.gain.value = 0;

    this._masterGain.connect(this._capGain);
    this._capGain.connect(this._softClip);
    this._softClip.connect(ctx.destination);
  }

  private _wake(): void {
    if (!this._running || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  private _ensureLayer(ctx: AudioContext, sched: Scheduler, masterGain: GainNode, id: SoundId): LayerEntry {
    const existing = this._nodes[id];
    if (existing) return existing;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.connect(masterGain);

    const onef = createOneOverF(ctx, { depth: ONEF_DEPTH[id] });
    onef.node.connect(gain);

    const layer = FACTORIES[id](ctx, {
      scheduler: sched,
      params: this.layers[id].params,
      key: id,
    });
    layer.output.connect(onef.node);

    const entry: LayerEntry = { layer, onef, gain, teardown: null };
    this._nodes[id] = entry;
    return entry;
  }

  private _applyLayer(id: SoundId): void {
    const ctx = this.ctx;
    const sched = this._sched;
    const masterGain = this._masterGain;
    if (!ctx || !sched || !masterGain || !this._running) return;
    const L = this.layers[id];
    const now = ctx.currentTime;

    if (L.enabled) {
      const n = this._ensureLayer(ctx, sched, masterGain, id);
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

  private _disposeLayer(id: SoundId): void {
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
