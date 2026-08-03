/**
 * Pure helpers over engine state, shared by the mixer, bedside and the mixes
 * sheet. Ported from src/ui/index.js and mixes-ui.js — the arithmetic is the
 * arithmetic, so it lives in one place rather than three.
 */

import { EVIDENCE } from '../data/evidence';
import { SOUND_IDS, type EngineState, type LayerState, type SoundId } from '../types';

/** Scene energy follows the mix so the canvas and the audio agree. */
export function sceneIntensity(state: EngineState): number {
  let peak = 0;
  for (const id of SOUND_IDS) {
    const layer = state.layers[id];
    if (layer?.enabled) peak = Math.max(peak, layer.volume ?? 0);
  }
  const rainLayer = state.layers.rain;
  const rainParam = rainLayer?.enabled ? (rainLayer.params.intensity ?? 0.5) : null;
  const base = (state.master ?? 0.7) * (0.4 + 0.6 * peak);
  const blended = rainParam === null ? base : base * 0.65 + rainParam * 0.35;
  return Math.max(0.12, Math.min(1, blended));
}

export function anyLayerOn(state: EngineState): boolean {
  return SOUND_IDS.some((id) => state.layers[id]?.enabled);
}

export function activeLayerIds(state: { layers: Partial<Record<SoundId, { enabled?: boolean }>> }): SoundId[] {
  return SOUND_IDS.filter((id) => state.layers[id]?.enabled);
}

/** "Rain · Pink Noise", or 'Silent'. */
export function describeMix(mix: { layers: Partial<Record<SoundId, { enabled?: boolean }>> }): string {
  const ids = activeLayerIds(mix);
  if (!ids.length) return 'Silent';
  return ids.map((id) => EVIDENCE[id]?.title ?? id).join(' · ');
}

/** True when two layer states would render identically. Values, not identity. */
export function layerEqual(a: LayerState | undefined, b: LayerState | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.enabled !== b.enabled || a.volume !== b.volume) return false;
  const pa = a.params;
  const pb = b.params;
  if (pa === pb) return true;
  if (!pa || !pb) return false;
  // Both directions, so an added or removed param counts as a change. Params
  // are plain number records, so a missing key compares as undefined.
  for (const k in pa) if (pa[k] !== pb[k]) return false;
  for (const k in pb) if (pb[k] !== pa[k]) return false;
  return true;
}
