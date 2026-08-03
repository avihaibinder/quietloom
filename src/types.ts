/**
 * Shared domain types. These mirror the FROZEN CONTRACTS of the original web
 * app (src/core/bus.js, src/audio/engine.js, scenes/renderer.js) — the event
 * names and state shapes are identical so the two codebases stay comparable
 * file-for-file during the migration.
 */

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
] as const;

export type SoundId = (typeof SOUND_IDS)[number];

export const SCENE_IDS = ['rain', 'embers', 'waves', 'stars', 'moonrise'] as const;

export type SceneId = (typeof SCENE_IDS)[number];

export type ScreenName = 'welcome' | 'mixer' | 'bedside' | 'breathing';

/** Layer params are a small closed set, but layers only read what they know. */
export type LayerParams = Record<string, number>;

export interface LayerState {
  enabled: boolean;
  volume: number;
  params: LayerParams;
}

export interface EngineState {
  master: number;
  running: boolean;
  layers: Record<SoundId, LayerState>;
}

/** What applyMix / presets / saved mixes carry: a sparse layer spec. */
export interface MixLayerSpec {
  enabled?: boolean;
  volume?: number;
  params?: LayerParams;
}

export interface MixSpec {
  master?: number;
  layers: Partial<Record<SoundId, MixLayerSpec>>;
}

export interface SavedMix {
  id: string;
  name: string;
  createdAt: number;
  master: number;
  layers: Record<SoundId, LayerState>;
}

export interface Preset {
  id: string;
  name: string;
  scene: SceneId;
  note: string;
  layers: Partial<Record<SoundId, { enabled: boolean; volume: number; params?: LayerParams }>>;
}

/* ----------------------------------------------------------------- evidence */

export type Badge = 'Strong' | 'Moderate' | 'Emerging' | 'Traditional';

export interface EvidenceSource {
  label: string;
  url: string;
}

export interface EvidenceEntry {
  title: string;
  badge: Badge;
  claim?: string;
  detail?: string;
  sources?: EvidenceSource[];
}

/* ---------------------------------------------------------------- bus events */

/**
 * Every event on the bus, with its payload. FROZEN CONTRACT — do not change
 * the names or shapes without updating every consumer.
 */
export interface BusEvents {
  'audio:started': Record<string, never>;
  'audio:stopped': Record<string, never>;
  'mix:changed': EngineState;
  'timer:tick': { remainingSec: number };
  'timer:done': Record<string, never>;
  'timer:set': { minutes: number | null };
  'ads:banner': { visible: boolean; heightPx: number };
  'entitlements:changed': Record<string, never>;
  'screen:changed': { name: ScreenName };
  toast: { message: string };
  /** UI-internal: persists the scene to settings. Safe to ignore. */
  'scene:changed': { scene: SceneId };
  /** UI-internal: a saved mix replaced a preset. Safe to ignore. */
  'preset:cleared': Record<string, never>;
  /** UI-internal. Safe to ignore. */
  'ui:settings': { nurserySafe?: boolean };
}

export type BusEvent = keyof BusEvents;
