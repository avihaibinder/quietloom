/**
 * STUB — replaced by Agent A with the real generative engine.
 * This file defines the FROZEN public contract the UI and main.js code against.
 * Keep every signature identical when implementing.
 */

import { bus } from '../core/bus.js';

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
  }

  async start() {
    this._running = true;
    bus.emit('audio:started', {});
  }

  async stop() {
    this._running = false;
    bus.emit('audio:stopped', {});
  }

  isRunning() {
    return this._running;
  }

  setLayerEnabled(id, on) {
    if (!this.layers[id]) return;
    this.layers[id].enabled = !!on;
    bus.emit('mix:changed', this.getState());
  }

  setLayerVolume(id, v) {
    if (!this.layers[id]) return;
    this.layers[id].volume = Math.max(0, Math.min(1, v));
    bus.emit('mix:changed', this.getState());
  }

  setLayerParam(id, name, value) {
    if (!this.layers[id]) return;
    this.layers[id].params[name] = value;
    bus.emit('mix:changed', this.getState());
  }

  setMasterVolume(v) {
    this.master = Math.max(0, Math.min(1, v));
    bus.emit('mix:changed', this.getState());
  }

  async fadeMasterTo(_v, seconds) {
    return new Promise((r) => setTimeout(r, Math.min(seconds, 2) * 1000));
  }

  playChime() {}

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
        if (typeof spec.volume === 'number') L.volume = spec.volume;
        if (spec.params) L.params = { ...L.params, ...spec.params };
      } else {
        L.enabled = false;
      }
    }
    bus.emit('mix:changed', this.getState());
  }
}

export const engine = new AudioEngine();
