/**
 * MAP ENTRY #8 (part 1 of 3) — PRESET DATA INTEGRITY.
 *
 * Presets are plain data with no schema and no validation anywhere on the path
 * into the engine. Two measured facts make that dangerous rather than merely
 * untidy:
 *
 *  1. `App.tsx:149` boots by calling `applyPreset(DEFAULT_PRESET, {silent:true})`
 *     and `getPreset()` returns `null` for an unknown id. A one-character typo
 *     in that constant therefore starts the app in SILENCE, with no error, no
 *     warning and nothing in the log. The user opens a sleep app and it does
 *     nothing.
 *  2. `engine.ts:492` (`applyMix`) merges preset params into engine state
 *     UNVALIDATED — `L.params = { ...L.params, ...spec.params }`. Only the
 *     individual layer clamps, and it clamps its own private copy. So an
 *     out-of-range preset value is silently corrected in the audio graph while
 *     the UI slider goes on displaying the wrong number. Nothing throws.
 *
 * Every bound below is two-sided and every bound is sourced from the clamp in
 * the layer that consumes the value, not invented here. Sources are named
 * inline so a future reader can check them rather than trust them.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PRESETS, getPreset } from '../../src/data/presets';
import { SCENE_IDS, SOUND_IDS, type SoundId } from '../../src/types';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * The real boot preset, read out of `App.tsx` rather than copied.
 *
 * `DEFAULT_PRESET` is a module-private `const` in a `.tsx` (App.tsx:59) and
 * cannot be imported into this tier. Hard-coding 'rainfall' here would test this
 * file against itself and would still be green after somebody typo'd App.tsx —
 * which is the entire bug. So the literal is extracted from the source text.
 * If the constant is renamed or moved this FAILS LOUDLY and says so; it never
 * silently passes.
 */
function defaultPresetId(): string {
  const src = readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
  const m = /const\s+DEFAULT_PRESET\s*=\s*['"]([^'"]+)['"]/.exec(src);
  if (!m) {
    expect.fail(
      'Could not find `const DEFAULT_PRESET = "..."` in App.tsx. It was renamed or moved. ' +
        'Update this test to point at the new boot preset — do NOT delete this check: it is the ' +
        'only thing standing between a typo and an app that boots to silence with no error.',
    );
  }
  return m[1];
}

describe('the default preset actually exists', () => {
  it('resolves the id App.tsx really boots with', () => {
    const id = defaultPresetId();
    const preset = getPreset(id);
    expect(
      preset,
      `App.tsx boots with DEFAULT_PRESET = ${JSON.stringify(id)}, but getPreset() returns null for ` +
        `it. applyPreset() would no-op and the app would start SILENT with no error. Known ids: ` +
        PRESETS.map((p) => p.id).join(', '),
    ).not.toBeNull();
    expect(Object.keys(preset?.layers ?? {}).length).toBeGreaterThan(0);
  });

  it('getPreset returns null for an id that does not exist', () => {
    // The other side of it: the lookup must not fall back to PRESETS[0], which
    // would hide a typo forever.
    expect(getPreset('rainfalll')).toBeNull();
    expect(getPreset('')).toBeNull();
  });

  it('round-trips every preset id', () => {
    for (const p of PRESETS) {
      expect(getPreset(p.id)?.id, `getPreset('${p.id}') did not round-trip`).toBe(p.id);
    }
  });
});

describe('preset shape', () => {
  it('has a sane number of presets', () => {
    // Two-sided: an empty PRESETS array would make every lookup null, and the
    // upper bound catches an accidental duplication of the whole list.
    expect(PRESETS.length).toBeGreaterThanOrEqual(4);
    expect(PRESETS.length).toBeLessThanOrEqual(20);
  });

  it('has unique ids', () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size, `duplicate preset id — getPreset() would silently return the first`).toBe(
      ids.length,
    );
  });

  it('names a scene the renderer knows', () => {
    for (const p of PRESETS) {
      expect(SCENE_IDS as readonly string[], `preset '${p.id}' names an unknown scene`).toContain(
        p.scene,
      );
    }
  });

  it('has a non-empty name and note on every preset', () => {
    for (const p of PRESETS) {
      expect(p.name.trim().length, `preset '${p.id}' has no name`).toBeGreaterThan(0);
      expect(p.name.length, `preset '${p.id}' name is too long for a chip`).toBeLessThanOrEqual(24);
      expect(p.note.trim().length, `preset '${p.id}' has no note`).toBeGreaterThan(0);
    }
  });

  it('references only real sound ids', () => {
    // A typo'd layer key is not a type error — Preset.layers is a Partial
    // Record, so an unknown key is simply dropped and the layer never plays.
    for (const p of PRESETS) {
      for (const id of Object.keys(p.layers)) {
        expect(SOUND_IDS as readonly string[], `preset '${p.id}' references unknown layer`).toContain(
          id,
        );
      }
    }
  });

  it('turns on between one and six layers', () => {
    for (const p of PRESETS) {
      const on = (Object.keys(p.layers) as SoundId[]).filter((id) => p.layers[id]?.enabled);
      // Lower bound: a preset with nothing enabled is silence with a name.
      expect(on.length, `preset '${p.id}' enables no layers — it is silent`).toBeGreaterThanOrEqual(1);
      // Upper bound: past about six the mix is mud and every layer is masked.
      expect(on.length, `preset '${p.id}' enables too many layers`).toBeLessThanOrEqual(6);
    }
  });
});

describe('preset levels are audible and in range', () => {
  it('gives every enabled layer a volume strictly above zero and at most one', () => {
    // TWO-SIDED, and the floor is the point. QA measured that a one-sided
    // "peaks <= 0.35" passes on digital silence (tasks/tests.md, trap 3). An
    // enabled layer at volume 0 is a layer the user turned on and cannot hear —
    // the "no layer inaudible" checklist item, provable here with no renderer.
    for (const p of PRESETS) {
      for (const id of Object.keys(p.layers) as SoundId[]) {
        const layer = p.layers[id];
        if (!layer?.enabled) continue;
        expect(Number.isFinite(layer.volume), `${p.id}.${id} volume is not a number`).toBe(true);
        expect(layer.volume, `${p.id}.${id} is enabled but SILENT`).toBeGreaterThan(0);
        expect(layer.volume, `${p.id}.${id} volume exceeds unity`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps at least one layer in every preset at a carrying level', () => {
    // Guards the opposite failure from the one above: every layer technically
    // non-zero but the whole preset mixed so low it reads as broken.
    for (const p of PRESETS) {
      const volumes = (Object.keys(p.layers) as SoundId[])
        .filter((id) => p.layers[id]?.enabled)
        .map((id) => p.layers[id]?.volume ?? 0);
      const loudest = Math.max(...volumes);
      expect(loudest, `preset '${p.id}' has no layer above 0.3 — it will read as broken`).toBeGreaterThan(
        0.3,
      );
      expect(loudest, `preset '${p.id}' has a layer at full scale`).toBeLessThanOrEqual(1);
    }
  });
});

describe('preset params sit inside the range their layer will accept', () => {
  /**
   * Bounds taken from the clamp in the consuming layer — NOT from the UI
   * slider, and not invented. Anything outside these is silently corrected by
   * the layer while engine state and the UI keep the wrong value.
   */
  const BOUNDS: Record<string, { min: number; max: number; source: string }> = {
    // rain.ts:37,41,121 — clamp01, then interpolated into cutoff/gain/rate.
    intensity: { min: 0, max: 1, source: 'rain.ts clamp01' },
    // thunder.ts:24,27,77 — clamp01, then mapped to a 90s..20s mean gap.
    frequency: { min: 0, max: 1, source: 'thunder.ts clamp01' },
    // binaural.ts:23-24 — BASE_MIN / BASE_MAX, raw Hz, not normalised.
    baseHz: { min: 100, max: 400, source: 'binaural.ts BASE_MIN/BASE_MAX' },
    // binaural.ts:25-26 — BEAT_MIN / BEAT_MAX.
    beatHz: { min: 0.25, max: 16, source: 'binaural.ts BEAT_MIN/BEAT_MAX' },
  };

  it('bounds every named param two-sidedly', () => {
    let checked = 0;
    for (const p of PRESETS) {
      for (const id of Object.keys(p.layers) as SoundId[]) {
        const params = p.layers[id]?.params;
        if (!params) continue;
        for (const [name, value] of Object.entries(params)) {
          const bound = BOUNDS[name];
          expect(
            bound,
            `preset '${p.id}' sets an unknown param '${name}' on ${id}. Either it is a typo (it will ` +
              `be merged into engine state and ignored by the layer) or this test needs the bound ` +
              `adding from the layer that consumes it.`,
          ).toBeDefined();
          expect(Number.isFinite(value), `${p.id}.${id}.${name} is not finite`).toBe(true);
          expect(value, `${p.id}.${id}.${name} below ${bound.source}`).toBeGreaterThanOrEqual(bound.min);
          expect(value, `${p.id}.${id}.${name} above ${bound.source}`).toBeLessThanOrEqual(bound.max);
          checked += 1;
        }
      }
    }
    // The loop must actually have run. Without this, deleting every param from
    // presets.ts would leave this test green having checked nothing — the same
    // "green having read nothing" failure QA caught in the bundle suite.
    expect(checked, 'no preset params were checked at all — the scan is broken').toBeGreaterThanOrEqual(
      5,
    );
  });

  it('sets binaural to the exact frequencies that were actually tested', () => {
    // research.md and the evidence card both cite Fan 2024's 250 Hz carrier with
    // a 0.25 Hz offset. Standing decision 6 — we use the frequencies that were
    // tested rather than invented ones — so the Deep Space preset is not free to
    // drift to a rounder number.
    const deepSpace = getPreset('deep-space');
    expect(deepSpace).not.toBeNull();
    expect(deepSpace?.layers.binaural?.params).toMatchObject({ baseHz: 250, beatHz: 0.25 });
  });
});
