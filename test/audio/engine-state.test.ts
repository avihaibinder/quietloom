/**
 * Test map entry #1 — the `getState()` cache.
 *
 * WHY THIS IS FIRST. The cache landed three days ago in the FASTER wave. Its
 * only proof was a scratchpad harness that has since been deleted, and
 * `src/ui/hooks.ts:153` now depends on its invariant: `layerEqual` starts with
 * `if (a === b) return true`, so if a CHANGED layer ever kept its previous
 * object identity the card silently stops updating, and it reads as a UI bug
 * rather than an engine one. The mirror hazard is worse: `MixesSheet` stores
 * `getState().layers` straight into a SavedMix, so anything mutated in place
 * after being handed out corrupts a saved mix retroactively.
 *
 * Method, as the map specifies: a reference deep-clone ORACLE. The oracle
 * models the mutation semantics independently and re-clones its whole state on
 * every read, which is exactly the "rebuild all 23 objects every call" version
 * the cache replaced. Random mutation sequences are applied to both, and the
 * two must agree after every single step. The seeds are fixed so a failure is
 * reproducible.
 *
 * No assertion here is "a mock was called". `bus.emit` counts are deliberately
 * not checked: the outcome is the state, and the state is what is compared.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `react-native` is not mocked here — the harness aliases it to the shared
 * `__mocks__/react-native.ts` stub, whose AppState is a working implementation.
 *
 * `react-native-audio-api` IS mocked here, per file and never globally. The
 * harness walls it off on purpose, and it must stay walled: a project-wide
 * alias to any audio fake is how QA's trap 3 gets in, where a test that imports
 * the audio library silently receives silence and passes. `AudioContext` is the
 * only value engine.ts imports from it; the other two are type-only.
 */
vi.mock('react-native-audio-api', async () => {
  const { FakeAudioContext } = await import('../fixtures/fake-audio-context');
  return { AudioContext: FakeAudioContext, GainNode: class {}, WaveShaperNode: class {} };
});

import { AudioEngine, LAYER_DEFAULTS } from '../../src/audio/engine';
import { SOUND_IDS } from '../../src/types';
import type { EngineState, LayerState, MixSpec, SoundId } from '../../src/types';
import type { FakeAudioContext, FakeGainNode } from '../fixtures/fake-audio-context';

/* ------------------------------------------------------------- the oracle */

/** Independently written: this is the semantics under test, so it is not shared. */
const clamp01 = (v: number): number => Math.min(1, Math.max(0, Number(v) || 0));

/**
 * The reference model. Holds plain data and deep-clones on every read, so it
 * cannot alias, cannot go stale and cannot share a mutable object by accident.
 * It is what the cached engine has to be indistinguishable from.
 */
class Oracle {
  master = 0.7;
  running = false;
  layers: Record<SoundId, LayerState>;

  constructor() {
    const layers = {} as Record<SoundId, LayerState>;
    for (const id of SOUND_IDS) {
      // The defaults table is data, not the caching logic under test; taking it
      // from the same source keeps an 11-row duplicate from drifting. The
      // literal values are pinned separately below.
      layers[id] = {
        enabled: false,
        volume: LAYER_DEFAULTS[id].volume,
        params: { ...LAYER_DEFAULTS[id].params },
      };
    }
    this.layers = layers;
  }

  setLayerEnabled(id: SoundId, on: boolean): void {
    this.layers[id].enabled = !!on;
  }

  setLayerVolume(id: SoundId, v: number): void {
    this.layers[id].volume = clamp01(v);
  }

  setLayerParam(id: SoundId, name: string, value: number): void {
    this.layers[id].params[name] = value;
  }

  setMasterVolume(v: number): void {
    this.master = clamp01(v);
  }

  applyMix(mix: MixSpec): void {
    if (!mix || !mix.layers) return;
    for (const id of SOUND_IDS) {
      const spec = mix.layers[id];
      const L = this.layers[id];
      if (spec) {
        L.enabled = spec.enabled !== false;
        if (typeof spec.volume === 'number') L.volume = clamp01(spec.volume);
        if (spec.params) L.params = { ...L.params, ...spec.params };
      } else {
        L.enabled = false;
      }
    }
  }

  snapshot(): EngineState {
    return structuredClone({ master: this.master, running: this.running, layers: this.layers });
  }
}

/* -------------------------------------------------------------- utilities */

/** mulberry32 — seeded so a red run is reproducible rather than a ghost. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PARAM_NAMES = ['intensity', 'frequency', 'baseHz', 'beatHz', 'wobble'];
const VOLUMES = [0, 0.25, 0.5, 1, 1.5, -0.4, NaN, 0.333333];

describe('the frozen EngineState shape', () => {
  it('is exactly { master, running, layers } with all eleven ids in SOUND_IDS order', () => {
    const s = new AudioEngine().getState();
    expect(Object.keys(s).sort()).toEqual(['layers', 'master', 'running']);
    // Order is part of the contract — toEqual would not catch a reshuffle.
    expect(Object.keys(s.layers)).toEqual([...SOUND_IDS]);
    expect(SOUND_IDS).toHaveLength(11);
    for (const id of SOUND_IDS) {
      expect(Object.keys(s.layers[id]).sort()).toEqual(['enabled', 'params', 'volume']);
      expect(typeof s.layers[id].enabled).toBe('boolean');
      expect(typeof s.layers[id].volume).toBe('number');
    }
  });

  it('starts silent, stopped, and at the documented defaults', () => {
    const s = new AudioEngine().getState();
    expect(s.master).toBe(0.7);
    expect(s.running).toBe(false);
    for (const id of SOUND_IDS) expect(s.layers[id].enabled).toBe(false);
    // A few literals, so a defaults regression cannot hide behind the oracle
    // sharing the table.
    expect(s.layers.rain.volume).toBe(0.6);
    expect(s.layers.rain.params.intensity).toBe(0.5);
    expect(s.layers.binaural.params).toEqual({ baseHz: 250, beatHz: 0.25 });
    expect(s.layers.ocean.params).toEqual({});
  });
});

describe('the cache against a deep-clone oracle', () => {
  it.each([1, 20260803, 777777])(
    'agrees after every step of a 400-step random mutation sequence (seed %i)',
    (seed) => {
      const engine = new AudioEngine();
      const oracle = new Oracle();
      const rand = rng(seed);
      const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];

      for (let step = 0; step < 400; step++) {
        switch (Math.floor(rand() * 6)) {
          case 0: {
            const id = pick(SOUND_IDS);
            const on = rand() < 0.5;
            engine.setLayerEnabled(id, on);
            oracle.setLayerEnabled(id, on);
            break;
          }
          case 1: {
            const id = pick(SOUND_IDS);
            const v = pick(VOLUMES);
            engine.setLayerVolume(id, v);
            oracle.setLayerVolume(id, v);
            break;
          }
          case 2: {
            const id = pick(SOUND_IDS);
            const name = pick(PARAM_NAMES);
            const v = Math.round(rand() * 1000) / 100;
            engine.setLayerParam(id, name, v);
            oracle.setLayerParam(id, name, v);
            break;
          }
          case 3: {
            const v = pick(VOLUMES);
            engine.setMasterVolume(v);
            oracle.setMasterVolume(v);
            break;
          }
          case 4: {
            const mix: MixSpec = { layers: {} };
            for (const id of SOUND_IDS) {
              if (rand() < 0.4) continue; // a sparse preset: absent means "off"
              mix.layers[id] = {
                enabled: rand() < 0.7,
                ...(rand() < 0.6 ? { volume: pick(VOLUMES) } : {}),
                ...(rand() < 0.4 ? { params: { [pick(PARAM_NAMES)]: Math.round(rand() * 100) / 10 } } : {}),
              };
            }
            engine.applyMix(mix);
            oracle.applyMix(mix);
            break;
          }
          default:
            // A pure read. The cache must survive being read, repeatedly, with
            // nothing dirty — this is the ~60/s slider-drag path.
            engine.getState();
            engine.getState();
            break;
        }

        const got = engine.getState();
        expect(got).toEqual(oracle.snapshot());
        // Re-reading with nothing dirty must return the very same object.
        expect(engine.getState()).toBe(got);
      }
    }
  );

  it('never mutates a snapshot it has already handed out', () => {
    // The MixesSheet hazard: a SavedMix is `getState().layers`, stored as-is.
    const engine = new AudioEngine();
    const rand = rng(42);

    engine.setLayerEnabled('rain', true);
    engine.setLayerVolume('rain', 0.42);
    engine.setLayerParam('rain', 'intensity', 0.8);

    const held = engine.getState();
    const heldLayers = held.layers;
    const heldRain = held.layers.rain;
    const heldParams = held.layers.rain.params;
    const frozenCopy = structuredClone(held);

    for (let i = 0; i < 300; i++) {
      const id = SOUND_IDS[Math.floor(rand() * SOUND_IDS.length)];
      engine.setLayerEnabled(id, rand() < 0.5);
      engine.setLayerVolume(id, rand());
      engine.setLayerParam(id, 'intensity', rand());
      engine.setMasterVolume(rand());
      engine.applyMix({ layers: { rain: { enabled: false, volume: 0.1, params: { intensity: 0.01 } } } });
    }

    expect(held).toEqual(frozenCopy);
    expect(held.layers).toBe(heldLayers);
    expect(held.layers.rain).toBe(heldRain);
    expect(held.layers.rain.params).toBe(heldParams);
    expect(heldRain.volume).toBe(0.42);
    expect(heldParams.intensity).toBe(0.8);
  });
});

describe('copy-on-write identity, which hooks.ts:153 reads as "did this change"', () => {
  function idsExcept(id: SoundId): SoundId[] {
    return SOUND_IDS.filter((x) => x !== id);
  }

  it('gives a changed layer a NEW object and leaves the other ten alone', () => {
    for (const mutate of [
      (e: AudioEngine): void => e.setLayerEnabled('fire', true),
      (e: AudioEngine): void => e.setLayerVolume('fire', 0.11),
      (e: AudioEngine): void => e.setLayerParam('fire', 'intensity', 0.9),
    ]) {
      const engine = new AudioEngine();
      const before = engine.getState();
      mutate(engine);
      const after = engine.getState();

      // If this were `toBe`, the fire card would never re-render.
      expect(after.layers.fire).not.toBe(before.layers.fire);
      expect(after).not.toBe(before);
      expect(after.layers).not.toBe(before.layers);
      for (const id of idsExcept('fire')) {
        expect(after.layers[id]).toBe(before.layers[id]);
      }
    }
  });

  it('reallocates params only when params actually moved', () => {
    // `layerEqual` short-circuits on `pa === pb`, so a params object reused
    // across a real params change would freeze the card just as surely.
    const engine = new AudioEngine();
    const before = engine.getState();

    engine.setLayerVolume('rain', 0.9);
    const afterVolume = engine.getState();
    expect(afterVolume.layers.rain).not.toBe(before.layers.rain);
    expect(afterVolume.layers.rain.params).toBe(before.layers.rain.params);

    engine.setLayerParam('rain', 'intensity', 0.77);
    const afterParam = engine.getState();
    expect(afterParam.layers.rain.params).not.toBe(afterVolume.layers.rain.params);
    expect(afterParam.layers.rain.params.intensity).toBe(0.77);
  });

  it('hands out a params object that is not the engine internal one', () => {
    const engine = new AudioEngine();
    const snap = engine.getState();
    const params = snap.layers.rain.params;
    engine.setLayerParam('rain', 'intensity', 0.99);
    expect(params.intensity).toBe(0.5);
    expect(engine.getState().layers.rain.params.intensity).toBe(0.99);
  });

  it('invalidates a layer that applyMix only DROPS', () => {
    // A preset that merely omits a layer still changes it, which is why
    // applyMix dirties unconditionally.
    const engine = new AudioEngine();
    engine.setLayerEnabled('thunder', true);
    const before = engine.getState();
    expect(before.layers.thunder.enabled).toBe(true);

    engine.applyMix({ layers: { rain: { enabled: true } } });
    const after = engine.getState();
    expect(after.layers.thunder.enabled).toBe(false);
    expect(after.layers.thunder).not.toBe(before.layers.thunder);
  });

  it('returns the identical object when nothing has changed at all', () => {
    const engine = new AudioEngine();
    const a = engine.getState();
    expect(engine.getState()).toBe(a);
    // A no-op write is still a write: it must invalidate rather than guess.
    engine.setLayerVolume('rain', engine.getState().layers.rain.volume);
    expect(engine.getState()).not.toBe(a);
    expect(engine.getState()).toEqual(a);
  });
});

describe('clamping and unknown ids', () => {
  it('clamps volumes into [0, 1] and treats NaN as zero', () => {
    const engine = new AudioEngine();
    for (const [given, want] of [
      [1.5, 1],
      [-0.4, 0],
      [NaN, 0],
      [0.333, 0.333],
    ] as const) {
      engine.setLayerVolume('rain', given);
      engine.setMasterVolume(given);
      expect(engine.getState().layers.rain.volume).toBe(want);
      expect(engine.getState().master).toBe(want);
    }
  });

  it('does not clamp params — a layer owns its own units', () => {
    const engine = new AudioEngine();
    engine.setLayerParam('binaural', 'baseHz', 432);
    expect(engine.getState().layers.binaural.params.baseHz).toBe(432);
  });

  it('ignores an unknown layer id without corrupting the state', () => {
    const engine = new AudioEngine();
    const before = engine.getState();
    const bogus = 'harpsichord' as SoundId;
    engine.setLayerEnabled(bogus, true);
    engine.setLayerVolume(bogus, 0.5);
    engine.setLayerParam(bogus, 'x', 1);
    const after = engine.getState();
    expect(Object.keys(after.layers)).toEqual([...SOUND_IDS]);
    expect(after).toEqual(before);
  });

  it('ignores a malformed mix', () => {
    const engine = new AudioEngine();
    const before = engine.getState();
    engine.applyMix(undefined as unknown as MixSpec);
    engine.applyMix({} as MixSpec);
    expect(engine.getState()).toBe(before);
  });
});

describe('running, and the fade that must not change the level', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function shutDown(engine: AudioEngine): Promise<void> {
    const p = engine.stop();
    await vi.advanceTimersByTimeAsync(1000);
    await p;
  }

  /** masterGain -> capGain -> softClip -> destination, identified structurally. */
  function masterGainOf(engine: AudioEngine): FakeGainNode {
    const ctx = engine.getContext() as unknown as FakeAudioContext;
    const shaper = ctx.nodesOfType('waveshaper')[0];
    const gains = ctx.nodesOfType('gain') as FakeGainNode[];
    const cap = gains.find((g) => g.outputs.includes(shaper));
    const master = gains.find((g) => cap !== undefined && g.outputs.includes(cap));
    if (!master) throw new Error('master gain not found');
    return master;
  }

  it('flips running on start and stop, and invalidates the cache both times', async () => {
    const engine = new AudioEngine();
    const stopped = engine.getState();
    expect(stopped.running).toBe(false);

    await engine.start();
    const running = engine.getState();
    expect(running.running).toBe(true);
    expect(running).not.toBe(stopped);
    expect(engine.isRunning()).toBe(true);
    // The layers are untouched by transport, so they keep their identity.
    expect(running.layers).toBe(stopped.layers);

    await shutDown(engine);
    expect(engine.getState().running).toBe(false);
    expect(engine.isRunning()).toBe(false);
  });

  it('fadeMasterTo lowers the audible gain but NOT getState().master', async () => {
    // The sleep timer fades to zero and later restores getState().master, so
    // the logical level has to survive the fade. This is that contract.
    const engine = new AudioEngine();
    await engine.start();
    try {
      const ctx = engine.getContext() as unknown as FakeAudioContext;
      const master = masterGainOf(engine);

      engine.setMasterVolume(0.7);
      ctx.advance(1);
      const audibleBefore = master.gain.valueAt(ctx.currentTime);
      expect(audibleBefore).toBeGreaterThan(0.4);

      const t0 = ctx.currentTime;
      const fade = engine.fadeMasterTo(0, 2);

      // The ramp lives on the AUDIO clock. Not one JS timer has fired here, and
      // the fade is already complete — which is exactly what has to survive the
      // main thread being suspended for the whole minute.
      ctx.advance(2);
      expect(master.gain.valueAt(t0 + 1)).toBeCloseTo(audibleBefore / 2, 6);
      expect(master.gain.valueAt(t0 + 2)).toBe(0);

      await vi.advanceTimersByTimeAsync(2100);
      await fade;

      // Audibly gone, logically untouched — so the timer can put it back.
      expect(engine.getState().master).toBe(0.7);

      // The restore, as the sleep timer performs it: after the fade has run its
      // course on the audio clock. (Nudging the volume DURING a scheduled fade
      // deliberately does not cancel it — engine.ts:336.)
      ctx.advance(0.2);
      engine.setMasterVolume(engine.getState().master);
      ctx.advance(0.5); // >12 time constants at FADE_TC = 0.04
      expect(master.gain.valueAt(ctx.currentTime)).toBeCloseTo(audibleBefore, 4);
    } finally {
      await shutDown(engine);
    }
  });

  it('applies the same taper whether the level is set or faded to', async () => {
    // Without this the sleep timer would restore to a different loudness than
    // it faded from. The exponent is deliberately not restated here.
    const engine = new AudioEngine();
    await engine.start();
    try {
      const ctx = engine.getContext() as unknown as FakeAudioContext;
      const master = masterGainOf(engine);

      ctx.advance(1);
      engine.setMasterVolume(0.4);
      ctx.advance(0.5); // >12 time constants at FADE_TC = 0.04
      const settled = master.gain.valueAt(ctx.currentTime);

      const t0 = ctx.currentTime;
      const fade = engine.fadeMasterTo(0.4, 2);
      await vi.advanceTimersByTimeAsync(2100);
      await fade;
      const ramped = master.gain.valueAt(t0 + 2);

      expect(ramped).toBeCloseTo(settled, 5);
      // A perceptual taper sits below the linear line, and stays inside [0, 1].
      expect(settled).toBeGreaterThan(0);
      expect(settled).toBeLessThan(0.4);
    } finally {
      await shutDown(engine);
    }
  });

  it('comes up from silence rather than from whatever the last fade left', async () => {
    const engine = new AudioEngine();
    await engine.start();
    try {
      const master = masterGainOf(engine);
      // start() anchors at SILENT and ramps up, so there is no unanchored ramp
      // for the click the charter warns about.
      expect(master.gain.hasUnanchoredRamp).toBe(false);
      expect(master.gain.valueAt(0)).toBeLessThan(0.001);
      expect(master.gain.valueAt(0.5)).toBeGreaterThan(0.4);
    } finally {
      await shutDown(engine);
    }
  });

  it('keeps the oracle agreement across a start/stop cycle', async () => {
    const engine = new AudioEngine();
    const oracle = new Oracle();
    engine.setLayerVolume('ocean', 0.8);
    oracle.setLayerVolume('ocean', 0.8);
    expect(engine.getState()).toEqual(oracle.snapshot());

    await engine.start();
    oracle.running = true;
    expect(engine.getState()).toEqual(oracle.snapshot());

    engine.setLayerParam('rain', 'intensity', 0.9);
    oracle.setLayerParam('rain', 'intensity', 0.9);
    expect(engine.getState()).toEqual(oracle.snapshot());

    await shutDown(engine);
    oracle.running = false;
    expect(engine.getState()).toEqual(oracle.snapshot());
  });
});
