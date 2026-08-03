/**
 * EXEMPLAR 1 of 3 — the zero-mock pure-logic tier.
 *
 * Proves: the harness reaches real `src/` TypeScript, with real imports
 * (`../data/evidence`, `../types`), with no renderer, no native module, no
 * mock of any kind, and no Babel config.
 *
 * `sceneIntensity` is the arithmetic that keeps the canvas and the audio in
 * agreement. It has two clamps and a blend that nobody has ever verified.
 */
import { describe, expect, it } from 'vitest';

import { anyLayerOn, describeMix, layerEqual, sceneIntensity } from '../../src/ui/mixState';
import { SOUND_IDS, type EngineState, type LayerState, type SoundId } from '../../src/types';

/** A full EngineState with every layer off — the shape the engine really emits. */
function stateWith(master: number, overrides: Partial<Record<SoundId, Partial<LayerState>>> = {}): EngineState {
  const layers = {} as Record<SoundId, LayerState>;
  for (const id of SOUND_IDS) {
    layers[id] = { enabled: false, volume: 0, params: {}, ...overrides[id] };
  }
  return { master, running: false, layers };
}

describe('sceneIntensity', () => {
  it('never returns less than the 0.12 floor, even at total silence', () => {
    // base = 0 * (0.4 + 0) = 0, so the floor is the only thing keeping the
    // scene visible. Without it the canvas goes black on a muted mix.
    expect(sceneIntensity(stateWith(0))).toBe(0.12);
  });

  it('never exceeds 1 when everything is at maximum', () => {
    const state = stateWith(1, { rain: { enabled: true, volume: 1, params: { intensity: 1 } } });
    expect(sceneIntensity(state)).toBe(1);
  });

  it('tracks the loudest enabled layer, not the sum of them', () => {
    const one = stateWith(1, { wind: { enabled: true, volume: 0.5 } });
    const many = stateWith(1, {
      wind: { enabled: true, volume: 0.5 },
      fire: { enabled: true, volume: 0.4 },
      crickets: { enabled: true, volume: 0.3 },
    });
    // peak is a max, so adding quieter layers must not brighten the scene.
    expect(sceneIntensity(many)).toBe(sceneIntensity(one));
    // base = 1 * (0.4 + 0.6*0.5) = 0.7, no rain so no blend.
    expect(sceneIntensity(one)).toBeCloseTo(0.7, 10);
  });

  it('ignores a disabled layer however loud it is', () => {
    const loudButOff = stateWith(1, { wind: { enabled: false, volume: 1 } });
    expect(sceneIntensity(loudButOff)).toBe(sceneIntensity(stateWith(1)));
  });

  it('blends in rain intensity at 35% when rain is on', () => {
    const state = stateWith(1, { rain: { enabled: true, volume: 1, params: { intensity: 0 } } });
    // base = 1 * (0.4 + 0.6*1) = 1; blended = 1*0.65 + 0*0.35 = 0.65
    expect(sceneIntensity(state)).toBeCloseTo(0.65, 10);
  });

  it('defaults rain intensity to 0.5 when the param is absent', () => {
    const absent = stateWith(1, { rain: { enabled: true, volume: 1, params: {} } });
    const explicit = stateWith(1, { rain: { enabled: true, volume: 1, params: { intensity: 0.5 } } });
    expect(sceneIntensity(absent)).toBe(sceneIntensity(explicit));
  });

  it('ignores rain intensity entirely while rain is disabled, however extreme the value', () => {
    // rainParam is only read when rainLayer.enabled — a disabled rain layer
    // must blend exactly like "no rain" (base only), even if intensity is 1.
    const rainOffLoudIntensity = stateWith(1, {
      wind: { enabled: true, volume: 0.5 },
      rain: { enabled: false, volume: 1, params: { intensity: 1 } },
    });
    const noRainAtAll = stateWith(1, { wind: { enabled: true, volume: 0.5 } });
    expect(sceneIntensity(rainOffLoudIntensity)).toBe(sceneIntensity(noRainAtAll));
  });

  it('is pure: the same state produces the same result twice and is never mutated', () => {
    const state = stateWith(0.8, { rain: { enabled: true, volume: 0.6, params: { intensity: 0.3 } } });
    // Deep-freeze so any in-place write throws in strict mode instead of
    // silently succeeding — App.tsx:288 dedupes on `!==` against a cached
    // number, which only means anything if this function never mutates its
    // input and is deterministic on it.
    Object.freeze(state);
    Object.freeze(state.layers);
    for (const id of SOUND_IDS) {
      Object.freeze(state.layers[id]);
      Object.freeze(state.layers[id].params);
    }
    const first = sceneIntensity(state);
    const second = sceneIntensity(state);
    expect(second).toBe(first);
  });
});

describe('anyLayerOn / describeMix', () => {
  it('reports a silent mix as Silent', () => {
    expect(anyLayerOn(stateWith(0.7))).toBe(false);
    expect(describeMix(stateWith(0.7))).toBe('Silent');
  });

  it('reports Silent even for a bare object with no layers at all', () => {
    // describeMix only requires `{ layers: ... }`, and every lookup is
    // optional-chained — an empty layers object must not throw and must
    // still read as silent, not as "every layer active".
    expect(describeMix({ layers: {} })).toBe('Silent');
  });

  it('names enabled layers in SOUND_IDS order, not insertion order', () => {
    // Written pink-first on purpose: the output must still be rain-first,
    // because describeMix filters SOUND_IDS rather than reading key order.
    const state = stateWith(0.7, {
      pink: { enabled: true, volume: 0.5 },
      rain: { enabled: true, volume: 0.5 },
    });
    expect(anyLayerOn(state)).toBe(true);
    expect(describeMix(state)).toBe('Rain · Pink Noise');
  });
});

describe('layerEqual', () => {
  // Landed by seam S4 (tasks/tests.md): moved verbatim out of hooks.ts,
  // where it decided whether `applyMixState` re-renders a layer's
  // subscribers. FASTER recorded the exact risk this guards: if a cached
  // snapshot is ever mutated in place, or compared wrongly, the cards stop
  // updating and it reads as a UI bug, not an engine one.

  /** Shaped exactly like hooks.ts's own EMPTY_LAYER fallback for an unknown id. */
  const emptyLayer: LayerState = { enabled: false, volume: 0, params: {} };

  it('takes the identity fast path: the same reference is always equal', () => {
    const a: LayerState = { enabled: true, volume: 0.4, params: { intensity: 0.2 } };
    expect(layerEqual(a, a)).toBe(true);
    expect(layerEqual(undefined, undefined)).toBe(true);
  });

  it('is false when only one side is missing', () => {
    const a: LayerState = { enabled: true, volume: 0.4, params: {} };
    expect(layerEqual(a, undefined)).toBe(false);
    expect(layerEqual(undefined, a)).toBe(false);
  });

  it('is false when enabled differs', () => {
    const a: LayerState = { enabled: true, volume: 0.5, params: {} };
    const b: LayerState = { enabled: false, volume: 0.5, params: {} };
    expect(layerEqual(a, b)).toBe(false);
  });

  it('is false when volume differs', () => {
    const a: LayerState = { enabled: true, volume: 0.5, params: {} };
    const b: LayerState = { enabled: true, volume: 0.6, params: {} };
    expect(layerEqual(a, b)).toBe(false);
  });

  it('is true for two different layer objects whose params happen to be the same reference', () => {
    const params = { intensity: 0.3 };
    const a: LayerState = { enabled: true, volume: 0.5, params };
    const b: LayerState = { enabled: true, volume: 0.5, params };
    expect(layerEqual(a, b)).toBe(true);
  });

  it('is true for two independent params objects with identical keys and values', () => {
    const a: LayerState = { enabled: true, volume: 0.5, params: { intensity: 0.3, baseHz: 90 } };
    const b: LayerState = { enabled: true, volume: 0.5, params: { intensity: 0.3, baseHz: 90 } };
    expect(layerEqual(a, b)).toBe(true);
  });

  it('is false when a param value changes', () => {
    const a: LayerState = { enabled: true, volume: 0.5, params: { intensity: 0.3 } };
    const b: LayerState = { enabled: true, volume: 0.5, params: { intensity: 0.4 } };
    expect(layerEqual(a, b)).toBe(false);
  });

  it('is false when a param is added — caught by the loop over b\'s keys (:164)', () => {
    // a has no keys at all, so the loop over a's keys alone would see nothing
    // to compare and wrongly report equal. Only the second loop (over b)
    // notices the addition.
    const a: LayerState = { enabled: true, volume: 0.5, params: {} };
    const b: LayerState = { enabled: true, volume: 0.5, params: { intensity: 0.3 } };
    expect(layerEqual(a, b)).toBe(false);
  });

  it('is false when a param is removed — caught by the loop over a\'s keys (:163)', () => {
    // The mirror case: only the first loop (over a) notices a key that b no
    // longer has.
    const a: LayerState = { enabled: true, volume: 0.5, params: { intensity: 0.3 } };
    const b: LayerState = { enabled: true, volume: 0.5, params: {} };
    expect(layerEqual(a, b)).toBe(false);
  });

  it('treats a missing key as undefined on both sides, so two empty params objects are equal', () => {
    expect(layerEqual(emptyLayer, { enabled: false, volume: 0, params: {} })).toBe(true);
  });

  it('EMPTY_LAYER-shaped layer is equal to another value-equal one by a different reference', () => {
    const otherEmpty: LayerState = { enabled: false, volume: 0, params: {} };
    expect(emptyLayer).not.toBe(otherEmpty);
    expect(layerEqual(emptyLayer, otherEmpty)).toBe(true);
  });

  it('EMPTY_LAYER-shaped layer is NOT equal to a real enabled layer', () => {
    const realLayer: LayerState = { enabled: true, volume: 0.7, params: { intensity: 0.5 } };
    expect(layerEqual(emptyLayer, realLayer)).toBe(false);
  });
});
