/**
 * Design tokens, ported from the web app's style.css `:root`.
 *
 * Deep near-black base, one accent that shifts with the scene, nothing
 * brighter than #e8edf5 anywhere. Bedside mode uses deep red/amber only —
 * red suppresses melatonin far less than blue or white light (research.md §9).
 */

import type { Badge, SceneId } from '../types';

export const color = {
  bg: '#05070c',
  bgLift: '#080b12',

  ink: '#e8edf5',
  ink2: '#a9b4c6',
  ink3: '#6e7b90',
  ink4: '#4b5567',

  line: 'rgba(255,255,255,0.06)',
  line2: 'rgba(255,255,255,0.10)',

  /** Translucent dark card base — legible over any scene. */
  card: 'rgba(10,13,20,0.62)',
  cardQuiet: 'rgba(7,10,16,0.44)',

  good: '#7fd8ae',
  warn: '#e4b877',
  danger: '#e08a86',

  /* Bedside — red preserves melatonin. No white, no blue on that surface. */
  bedsideBg: '#030204',
  bedsideClock: '#c2401c',
  bedsideSub: '#8a3a16',
  bedsideHint: '#5e2a12',
} as const;

export const radius = {
  lg: 20,
  md: 16,
  sm: 11,
} as const;

/** Bottom transport bar height (CSS --bar-h). */
export const BAR_HEIGHT = 78;

export interface SceneAccent {
  accent: string;
  accentSoft: string;
  top: string;
  bottom: string;
}

/** Per-scene accent — the RN equivalent of the CSS vars the renderer set. */
export const SCENE_ACCENTS: Record<SceneId, SceneAccent> = {
  rain: { accent: '#7fa8dd', accentSoft: 'rgba(127,168,221,0.16)', top: '#0b1524', bottom: '#04060b' },
  embers: { accent: '#e59a55', accentSoft: 'rgba(229,154,85,0.16)', top: '#160a04', bottom: '#07060a' },
  waves: { accent: '#5fbdb2', accentSoft: 'rgba(95,189,178,0.16)', top: '#06121c', bottom: '#020509' },
  stars: { accent: '#9a90e0', accentSoft: 'rgba(154,144,224,0.16)', top: '#070915', bottom: '#03040a' },
  moonrise: { accent: '#a9b9dd', accentSoft: 'rgba(169,185,221,0.16)', top: '#0a1020', bottom: '#03040a' },
};

export interface BadgeColors {
  color: string;
  background: string;
  border: string;
}

export const BADGE_COLORS: Record<Badge, BadgeColors> = {
  Strong: { color: '#7fd8ae', background: 'rgba(127,216,174,0.10)', border: 'rgba(127,216,174,0.22)' },
  Moderate: { color: '#86b6e8', background: 'rgba(134,182,232,0.10)', border: 'rgba(134,182,232,0.22)' },
  Emerging: { color: '#e4b877', background: 'rgba(228,184,119,0.10)', border: 'rgba(228,184,119,0.22)' },
  Traditional: { color: '#9aa6b8', background: 'rgba(154,166,184,0.09)', border: 'rgba(154,166,184,0.20)' },
};

export const BADGE_MEANING: Record<Badge, string> = {
  Strong: 'Multiple studies or a systematic review, consistent direction of effect.',
  Moderate: 'At least one controlled study with a clear result.',
  Emerging: 'Promising controlled results, small samples, not widely replicated.',
  Traditional: 'Widely used and well liked, without direct controlled evidence.',
};
