/**
 * Who can hear what. Free tier is deliberately useful — the four layers with the
 * best evidence behind them are free, which is both honest and good retention.
 */

import { bus } from '../core/bus.js';
import { KEYS, read, write } from '../core/store.js';

export const FREE_SOUNDS = ['rain', 'ocean', 'pink', 'brown'];

/** Next 11:00 local time — a "night pass" naturally expires the morning after. */
function nextExpiry() {
  const now = new Date();
  const e = new Date(now);
  e.setHours(11, 0, 0, 0);
  if (e <= now) e.setDate(e.getDate() + 1);
  return e.toISOString();
}

export const Entitlements = {
  isPremium() {
    return read(KEYS.premium, false) === true;
  },

  setPremium(on) {
    write(KEYS.premium, !!on);
    bus.emit('entitlements:changed', {});
  },

  hasNightPass() {
    const iso = read(KEYS.nightPass, null);
    if (!iso) return false;
    const t = Date.parse(iso);
    return Number.isFinite(t) && t > Date.now();
  },

  grantNightPass() {
    write(KEYS.nightPass, nextExpiry());
    bus.emit('entitlements:changed', {});
  },

  nightPassExpiry() {
    const iso = read(KEYS.nightPass, null);
    return iso ? new Date(iso) : null;
  },

  isUnlocked(soundId) {
    if (FREE_SOUNDS.includes(soundId)) return true;
    if (this.isPremium()) return true;
    return this.hasNightPass();
  },
};
