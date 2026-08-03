/**
 * Who can hear what. Free tier is deliberately useful — the four layers with the
 * best evidence behind them are free, which is both honest and good retention.
 */

import { bus } from '../core/bus';
import { KEYS, read, write } from '../core/store';
import type { SoundId } from '../types';

export const FREE_SOUNDS: readonly SoundId[] = ['rain', 'ocean', 'pink', 'brown'];

/** Next 11:00 local time — a "night pass" naturally expires the morning after. */
function nextExpiry(): string {
  const now = new Date();
  const e = new Date(now);
  e.setHours(11, 0, 0, 0);
  if (e <= now) e.setDate(e.getDate() + 1);
  return e.toISOString();
}

export const Entitlements = {
  isPremium(): boolean {
    return read<boolean>(KEYS.premium, false) === true;
  },

  setPremium(on: boolean): void {
    write(KEYS.premium, !!on);
    bus.emit('entitlements:changed', {});
  },

  hasNightPass(): boolean {
    const iso = read<string | null>(KEYS.nightPass, null);
    if (!iso) return false;
    const t = Date.parse(iso);
    return Number.isFinite(t) && t > Date.now();
  },

  grantNightPass(): void {
    write(KEYS.nightPass, nextExpiry());
    bus.emit('entitlements:changed', {});
  },

  nightPassExpiry(): Date | null {
    const iso = read<string | null>(KEYS.nightPass, null);
    return iso ? new Date(iso) : null;
  },

  isUnlocked(soundId: SoundId): boolean {
    if (FREE_SOUNDS.includes(soundId)) return true;
    if (this.isPremium()) return true;
    return this.hasNightPass();
  },
};
