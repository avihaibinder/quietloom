/**
 * Sleep timer. Deadline-based (never accumulated ticks, which drift when the
 * OS throttles JS). The audible fade is handed to the audio engine so it runs
 * on the audio clock and survives a throttled or suspended main thread.
 */

import { bus } from './bus';

const FADE_SECONDS = 60;

/**
 * The slice of the engine the timer needs. Kept minimal (and structural) so
 * core never imports the audio module — same seam as the web build.
 */
export interface TimerEngine {
  isRunning(): boolean;
  getState(): { master: number };
  fadeMasterTo(v: number, seconds: number): Promise<void>;
  playChime(): void;
}

interface TimerOpts {
  chime?: boolean;
}

class SleepTimerImpl {
  private deadline: number | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private fadeArmed = false;
  private engine: TimerEngine | null = null;
  private chime = false;

  bind(engine: TimerEngine): void {
    this.engine = engine;
  }

  start(minutes: number, { chime = false }: TimerOpts = {}): void {
    this.cancel();
    if (!minutes || minutes <= 0) return;
    this.deadline = Date.now() + minutes * 60_000;
    this.chime = chime;
    this.fadeArmed = false;
    this.interval = setInterval(() => this.tick(), 1000);
    this.tick();
    bus.emit('timer:set', { minutes });
  }

  cancel(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    const wasArmed = this.fadeArmed;
    this.deadline = null;
    this.fadeArmed = false;
    // Unwind a fade that had already been scheduled on the audio clock.
    if (wasArmed && this.engine?.isRunning()) {
      void this.engine.fadeMasterTo(this.engine.getState().master, 1.5);
    }
    bus.emit('timer:set', { minutes: null });
  }

  isRunning(): boolean {
    return this.deadline !== null;
  }

  getRemaining(): number {
    if (!this.deadline) return 0;
    return Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
  }

  private tick(): void {
    if (!this.deadline) return;
    const remaining = this.getRemaining();
    bus.emit('timer:tick', { remainingSec: remaining });

    // Arm the fade early so it is already scheduled on the audio clock by the
    // time the OS starts throttling our timers.
    if (!this.fadeArmed && remaining <= FADE_SECONDS + 5) {
      this.fadeArmed = true;
      if (this.engine?.isRunning()) {
        void this.engine.fadeMasterTo(0, Math.max(5, remaining));
      }
    }

    if (remaining <= 0) {
      if (this.interval) clearInterval(this.interval);
      this.interval = null;
      this.deadline = null;
      this.fadeArmed = false;
      if (this.chime) this.engine?.playChime();
      bus.emit('timer:done', {});
    }
  }
}

export const SleepTimer = new SleepTimerImpl();
