/**
 * Curated presets. These are built from element combinations that appear in the
 * literature (water + wind + fire + insects), not arbitrary pairings.
 * See research.md §3 and §4.
 */

import type { Preset } from '../types';

export const PRESETS: Preset[] = [
  // The first two use only free layers, deliberately. A new user who opens the
  // app to a wall of padlocks decides it is a paywall and leaves; someone who
  // gets something genuinely good for free is the one who later watches an ad.
  {
    id: 'rainfall',
    name: 'Rainfall',
    scene: 'rain',
    note: 'Rain over a bed of pink noise — the two layers with the strongest evidence behind them. Free, always.',
    layers: {
      rain: { enabled: true, volume: 0.72, params: { intensity: 0.5 } },
      pink: { enabled: true, volume: 0.3 },
    },
  },
  {
    id: 'tide',
    name: 'Tide',
    scene: 'waves',
    note: 'Ocean swells at 0.1 Hz over brown noise. Breathe with the waves — in as it rises, out as it falls. Free, always.',
    layers: {
      ocean: { enabled: true, volume: 0.78 },
      brown: { enabled: true, volume: 0.34 },
    },
  },
  {
    id: 'moonlit-meadow',
    name: 'Moonrise',
    scene: 'moonrise',
    note: 'Brown noise under a quiet meadow at night. Picture somewhere pleasant, and interesting enough to hold your attention — that is the tested part, not the sheep.',
    layers: {
      brown: { enabled: true, volume: 0.34 },
      crickets: { enabled: true, volume: 0.16 },
      wind: { enabled: true, volume: 0.16 },
    },
  },
  {
    id: 'rainy-cabin',
    name: 'Rainy Cabin',
    scene: 'rain',
    note: 'Rain, distant thunder and a fire. The combination used in HRV soundscape research.',
    layers: {
      rain: { enabled: true, volume: 0.7, params: { intensity: 0.55 } },
      thunder: { enabled: true, volume: 0.4, params: { frequency: 0.3 } },
      wind: { enabled: true, volume: 0.22 },
      fire: { enabled: true, volume: 0.3 },
    },
  },
  {
    id: 'ocean-night',
    name: 'Ocean Night',
    scene: 'waves',
    note: 'Swells at exactly 0.1 Hz. Breathe in as the wave rises, out as it falls — six breaths a minute.',
    layers: {
      ocean: { enabled: true, volume: 0.8 },
      wind: { enabled: true, volume: 0.25 },
      crickets: { enabled: true, volume: 0.16 },
    },
  },
  {
    id: 'deep-space',
    name: 'Deep Space',
    scene: 'stars',
    note: 'Brown noise under a 0.25 Hz binaural beat on a 250 Hz carrier — the exact parameters from Fan 2024. Headphones required.',
    layers: {
      brown: { enabled: true, volume: 0.5 },
      binaural: { enabled: true, volume: 0.3, params: { baseHz: 250, beatHz: 0.25 } },
      wind: { enabled: true, volume: 0.14 },
    },
  },
  {
    id: 'campfire',
    name: 'Campfire',
    scene: 'embers',
    note: 'Fire lowered blood pressure in testing — but only with sound. Stay a while; the effect grew with time.',
    layers: {
      fire: { enabled: true, volume: 0.8 },
      crickets: { enabled: true, volume: 0.3 },
      wind: { enabled: true, volume: 0.16 },
    },
  },
  {
    id: 'focus-flow',
    name: 'Focus Flow',
    scene: 'rain',
    note: 'Pink noise plus a 10 Hz alpha beat and light rain. For work, not sleep.',
    layers: {
      pink: { enabled: true, volume: 0.42 },
      binaural: { enabled: true, volume: 0.34, params: { baseHz: 250, beatHz: 10 } },
      rain: { enabled: true, volume: 0.22, params: { intensity: 0.3 } },
    },
  },
  {
    id: 'slow-wave',
    name: 'Slow Wave',
    scene: 'stars',
    note: 'Pink-noise pulses at 0.8 Hz, modelled on a slow-wave enhancement protocol. Experimental — see the evidence card.',
    layers: {
      pink: { enabled: true, volume: 0.34 },
      deeppulse: { enabled: true, volume: 0.5 },
      rain: { enabled: true, volume: 0.2, params: { intensity: 0.25 } },
    },
  },
];

export function getPreset(id: string): Preset | null {
  return PRESETS.find((p) => p.id === id) ?? null;
}
