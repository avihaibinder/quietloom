/**
 * Sleep timer. Deadline-based (never accumulated ticks, which drift when the OS
 * throttles JS). The audible fade is handed to the audio engine so it runs on the
 * audio clock and survives a throttled or suspended main thread.
 */

import { bus } from '../core/bus.js';

const FADE_SECONDS = 60;

export const SleepTimer = {
  _deadline: null,
  _interval: null,
  _fadeArmed: false,
  _engine: null,
  _chime: false,

  bind(engine) {
    this._engine = engine;
  },

  start(minutes, { chime = false } = {}) {
    this.cancel();
    if (!minutes || minutes <= 0) return;
    this._deadline = Date.now() + minutes * 60_000;
    this._chime = chime;
    this._fadeArmed = false;
    this._interval = setInterval(() => this._tick(), 1000);
    this._tick();
    bus.emit('timer:set', { minutes });
  },

  cancel() {
    if (this._interval) clearInterval(this._interval);
    this._interval = null;
    const wasArmed = this._fadeArmed;
    this._deadline = null;
    this._fadeArmed = false;
    // Unwind a fade that had already been scheduled on the audio clock.
    if (wasArmed && this._engine?.isRunning()) {
      this._engine.fadeMasterTo(this._engine.getState().master, 1.5);
    }
    bus.emit('timer:set', { minutes: null });
  },

  isRunning() {
    return this._deadline !== null;
  },

  getRemaining() {
    if (!this._deadline) return 0;
    return Math.max(0, Math.ceil((this._deadline - Date.now()) / 1000));
  },

  _tick() {
    if (!this._deadline) return;
    const remaining = this.getRemaining();
    bus.emit('timer:tick', { remainingSec: remaining });

    // Arm the fade early so it is already scheduled on the audio clock by the
    // time the OS starts throttling our timers.
    if (!this._fadeArmed && remaining <= FADE_SECONDS + 5) {
      this._fadeArmed = true;
      if (this._engine?.isRunning()) {
        this._engine.fadeMasterTo(0, Math.max(5, remaining));
      }
    }

    if (remaining <= 0) {
      clearInterval(this._interval);
      this._interval = null;
      this._deadline = null;
      this._fadeArmed = false;
      if (this._chime) this._engine?.playChime();
      bus.emit('timer:done', {});
    }
  },
};
