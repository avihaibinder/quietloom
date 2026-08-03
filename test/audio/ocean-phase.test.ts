/**
 * Test map entry #5, the phase half: `getOceanPhase()` and `OCEAN_PERIOD`.
 *
 * The swell period is 10.000 seconds and the charter says "not approximately".
 * It is 0.1 Hz baroreflex resonance, it doubles as a six-breaths-per-minute
 * pacer, and `getOceanPhase()` is what the breathing UI reads — so a phase that
 * drifts, wraps the wrong way, or moves when the layer is toggled is a visible
 * bug in a different feature entirely.
 *
 * QA's cheapest finding in wave 1 was that this is provable with NO renderer:
 * the phase is pure arithmetic on the audio clock. This file proves that half,
 * plus the harder half nobody had costed — that the swell OSCILLATORS agree
 * with `getOceanPhase()` whatever time the layer happened to be built at.
 *
 * ONE THING THIS CANNOT PROVE, stated plainly. The trough/crest polarity rests
 * on the PeriodicWave coefficient convention documented at src/audio/onef.ts:23
 * (real weights cos, imag weights sin). That convention is not verified against
 * the shipped native library and cannot be from the pure tier. If it is
 * reversed, crest and trough swap together everywhere and these tests would
 * agree with the code while both were wrong. The convention-INDEPENDENT results
 * here — the exact 10.000 s spacing, the start-time independence, and the
 * 0.6 s wash lag — hold either way.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `react-native` comes from the harness's shared stub. `react-native-audio-api`
// is mocked per file and never globally — see engine-state.test.ts for why.
vi.mock('react-native-audio-api', async () => {
  const { FakeAudioContext } = await import('../fixtures/fake-audio-context');
  return { AudioContext: FakeAudioContext, GainNode: class {}, WaveShaperNode: class {} };
});

import { AudioEngine } from '../../src/audio/engine';
import { createOcean, OCEAN_HZ, OCEAN_PERIOD } from '../../src/audio/layers/ocean';
import { Scheduler } from '../../src/audio/scheduler';
import {
  asContext,
  createFakeContext,
  type FakeAudioBufferSourceNode,
  type FakeAudioContext,
  type FakeAudioParam,
  type FakeBiquadFilterNode,
  type FakeGainNode,
  type FakeOscillatorNode,
} from '../fixtures/fake-audio-context';

const TAU = Math.PI * 2;
const WASH_LAG = 0.6;

/* ---------------------------------------------------------------- the maths */

describe('the constants themselves', () => {
  it('is exactly 0.1 Hz and exactly 10.000 seconds', () => {
    expect(OCEAN_HZ).toBe(0.1);
    expect(OCEAN_PERIOD).toBe(10);
    expect(OCEAN_PERIOD).toBe(1 / OCEAN_HZ);
  });

  it('is exactly six breaths a minute, which is what the pacer is for', () => {
    // Coherence breathing at 6 bpm IS 0.1 Hz IS OCEAN_HZ. The pacer's own
    // pattern table is still module-private inside BreathingOverlay.tsx, so the
    // cross-file half of this invariant is not reachable yet — see seam S3 in
    // tasks/tests.md. This pins our side of it.
    expect(60 / OCEAN_PERIOD).toBe(6);
    expect(OCEAN_HZ * 60).toBe(6);
  });
});

/* ------------------------------------------------------- getOceanPhase() */

describe('getOceanPhase', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function started(): Promise<{ engine: AudioEngine; ctx: FakeAudioContext }> {
    const engine = new AudioEngine();
    await engine.start();
    return { engine, ctx: engine.getContext() as unknown as FakeAudioContext };
  }

  async function shutDown(engine: AudioEngine): Promise<void> {
    const p = engine.stop();
    await vi.advanceTimersByTimeAsync(1000);
    await p;
  }

  it('is 0 before there is an audio clock to read', () => {
    // Documented behaviour: the UI may ask before playback has ever started.
    expect(new AudioEngine().getOceanPhase()).toBe(0);
  });

  it('reads 0 at the trough, 0.5 at the crest, and wraps at the period', async () => {
    const { engine, ctx } = await started();
    try {
      const at = (t: number): number => {
        ctx.currentTime = t;
        return engine.getOceanPhase();
      };
      expect(at(0)).toBe(0); // trough — start of the inhale
      expect(at(2.5)).toBe(0.25);
      expect(at(5)).toBe(0.5); // crest — start of the exhale
      expect(at(7.5)).toBe(0.75);
      expect(at(OCEAN_PERIOD)).toBe(0); // wrapped, not 1
    } finally {
      await shutDown(engine);
    }
  });

  it('rises monotonically inside a period and never leaves [0, 1)', async () => {
    const { engine, ctx } = await started();
    try {
      let prev = -1;
      for (let i = 0; i < 200; i++) {
        ctx.currentTime = 1234 + i * 0.05; // 10 s of clock in 50 ms steps
        const p = engine.getOceanPhase();
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThan(1);
        if (i > 0 && p < prev) {
          // The only permitted fall is the wrap.
          expect(prev).toBeGreaterThan(0.9);
          expect(p).toBeLessThan(0.1);
        }
        prev = p;
      }
    } finally {
      await shutDown(engine);
    }
  });

  it('does not drift across an eight hour night', async () => {
    const { engine, ctx } = await started();
    try {
      const at = (t: number): number => {
        ctx.currentTime = t;
        return engine.getOceanPhase();
      };
      const eightHours = 8 * 3600;
      expect(eightHours / OCEAN_PERIOD).toBe(2880);

      // The two positions the pacer is actually built on are exactly
      // representable, so 2,880 periods later they are EXACT, not merely close.
      expect(at(eightHours)).toBe(0); // trough
      expect(at(eightHours + 5)).toBe(0.5); // crest

      // MEASURED: at an arbitrary offset the phase reproduces to ~3.6e-13 after
      // eight hours, not bit-for-bit. That is not accumulation — the phase is
      // recomputed from currentTime every call, never integrated — it is the
      // resolution of a double at t = 28,800: one ULP of (t * 0.1) is 4.5e-13.
      // So the error is bounded by O(t * eps) and is 3.6e-12 of one 10 s cycle.
      // An implementation that ACCUMULATED per frame would miss this by orders
      // of magnitude, which is what the bound below is set to catch.
      for (const offset of [0, 1.25, 2.5, 5, 7.5, 9.75]) {
        expect(at(eightHours + offset)).toBeCloseTo(at(offset), 9);
      }
    } finally {
      await shutDown(engine);
    }
  });

  it('stays valid whether or not the ocean layer is enabled', async () => {
    const { engine, ctx } = await started();
    try {
      ctx.currentTime = 33;
      const off = engine.getOceanPhase();
      engine.setLayerEnabled('ocean', true);
      expect(engine.getOceanPhase()).toBe(off);
      engine.setLayerEnabled('ocean', false);
      expect(engine.getOceanPhase()).toBe(off);
      expect(off).toBeCloseTo(0.3, 12);
    } finally {
      await shutDown(engine);
    }
  });

  it('guards a negative clock rather than returning a negative phase', async () => {
    const { engine, ctx } = await started();
    try {
      ctx.currentTime = -2.5;
      const p = engine.getOceanPhase();
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBe(0.75);
    } finally {
      await shutDown(engine);
    }
  });
});

/* --------------------------------------------------- the layer's own phase */

interface OceanParts {
  ctx: FakeAudioContext;
  out: FakeGainNode;
  hp: FakeBiquadFilterNode;
  lp: FakeBiquadFilterNode;
  wash: FakeBiquadFilterNode;
  swellGain: FakeGainNode;
  washGain: FakeGainNode;
  toCutoff: FakeGainNode;
  toSwell: FakeGainNode;
  toWash: FakeGainNode;
  lfo: FakeOscillatorNode;
  lfoLag: FakeOscillatorNode;
  src: FakeAudioBufferSourceNode;
  sched: Scheduler;
  dispose(): void;
}

/**
 * Build an ocean at a given audio time and identify its nodes STRUCTURALLY —
 * by filter type and by what feeds what — rather than by creation order, so a
 * harmless reordering inside the factory does not fail these tests.
 */
function buildOcean(t0: number): OceanParts {
  const ctx = createFakeContext({ currentTime: t0 });
  const sched = new Scheduler(asContext(ctx));
  const layer = createOcean(asContext(ctx), { scheduler: sched, params: {}, key: 'ocean' });

  const biquads = ctx.nodesOfType('biquad') as FakeBiquadFilterNode[];
  const byType = (t: string): FakeBiquadFilterNode => {
    const hits = biquads.filter((b) => b.type === t);
    if (hits.length !== 1) throw new Error(`expected one ${t} filter, found ${hits.length}`);
    return hits[0];
  };
  const hp = byType('highpass');
  const lp = byType('lowpass');
  const wash = byType('bandpass');

  const gains = ctx.nodesOfType('gain') as FakeGainNode[];
  /** The single gain node whose output feeds `target` (a node or an AudioParam). */
  const feeding = (target: unknown): FakeGainNode => {
    const hits = gains.filter((g) => g.outputs.includes(target as never));
    if (hits.length !== 1) throw new Error(`expected one gain feeding target, found ${hits.length}`);
    return hits[0];
  };
  /** The single gain node that `source` feeds. */
  const fedBy = (source: { outputs: unknown[] }): FakeGainNode => {
    const hits = gains.filter((g) => source.outputs.includes(g));
    if (hits.length !== 1) throw new Error(`expected one gain fed by source, found ${hits.length}`);
    return hits[0];
  };

  const swell = fedBy(lp);
  const washG = fedBy(wash);
  const toCutoff = feeding(lp.frequency);
  const toSwell = feeding(swell.gain);
  const toWash = feeding(washG.gain);

  const oscs = ctx.nodesOfType('oscillator') as FakeOscillatorNode[];
  const lfo = oscs.filter((o) => o.outputs.includes(toCutoff))[0];
  const lfoLag = oscs.filter((o) => o.outputs.includes(toWash))[0];
  const src = ctx.nodesOfType('buffersource')[0] as FakeAudioBufferSourceNode;

  return {
    ctx,
    out: layer.output as unknown as FakeGainNode,
    hp,
    lp,
    wash,
    swellGain: swell,
    washGain: washG,
    toCutoff,
    toSwell,
    toWash,
    lfo,
    lfoLag,
    src,
    sched,
    dispose: () => layer.dispose(),
  };
}

/** The swell value the oscillator will actually emit at audio time `t`. */
function swellAt(osc: FakeOscillatorNode, t: number): number {
  const wave = osc.periodicWave;
  if (!wave) throw new Error('oscillator has no periodic wave');
  const tStart = osc.startedAt ?? 0;
  return wave.sampleAt(osc.frequency.value * (t - tStart));
}

describe('the swell is pinned to the global clock, not to when the layer was built', () => {
  const STARTS = [0, 3.7, 12, 47.3, 123.456, 28_800];

  it('runs both modulators at exactly OCEAN_HZ', () => {
    const o = buildOcean(0);
    expect(o.lfo.frequency.value).toBe(OCEAN_HZ);
    expect(o.lfoLag.frequency.value).toBe(OCEAN_HZ);
    expect(o.lfo.periodicWave).not.toBeNull();
    expect(o.lfoLag.periodicWave).not.toBeNull();
    o.dispose();
  });

  it.each(STARTS)('built at t=%s, the swell still troughs at phase 0 and crests at phase 0.5', (t0) => {
    const o = buildOcean(t0);
    try {
      // -cos(2*pi*f*t) on the GLOBAL clock: -1 at the trough, +1 at the crest,
      // whatever t0 was. This is what the compensating phase offset buys.
      for (let k = 0; k < 40; k++) {
        const t = t0 + k * 0.37;
        expect(swellAt(o.lfo, t)).toBeCloseTo(-Math.cos(TAU * OCEAN_HZ * t), 5);
      }
      // And the two extremes land exactly where getOceanPhase says they do.
      const trough = Math.ceil(t0 / OCEAN_PERIOD) * OCEAN_PERIOD;
      expect(swellAt(o.lfo, trough)).toBeCloseTo(-1, 5);
      expect(swellAt(o.lfo, trough + OCEAN_PERIOD / 2)).toBeCloseTo(1, 5);
    } finally {
      o.dispose();
    }
  });

  it.each(STARTS)('built at t=%s, the wash lags the swell by exactly 0.6 s', (t0) => {
    const o = buildOcean(t0);
    try {
      for (let k = 0; k < 40; k++) {
        const t = t0 + k * 0.41;
        expect(swellAt(o.lfoLag, t)).toBeCloseTo(swellAt(o.lfo, t - WASH_LAG), 5);
        expect(swellAt(o.lfoLag, t)).toBeCloseTo(-Math.cos(TAU * OCEAN_HZ * (t - WASH_LAG)), 5);
      }
    } finally {
      o.dispose();
    }
  });

  it('does not randomise the period — two layers built 3.7 s apart stay in step', () => {
    const a = buildOcean(0);
    const b = buildOcean(3.7);
    try {
      for (let k = 0; k < 60; k++) {
        const t = 100 + k * 0.23;
        expect(swellAt(b.lfo, t)).toBeCloseTo(swellAt(a.lfo, t), 5);
      }
    } finally {
      a.dispose();
      b.dispose();
    }
  });
});

describe('the modulation depths keep the graph in range', () => {
  it('swings the cutoff over exactly 350..1400 Hz and never below zero', () => {
    const o = buildOcean(0);
    try {
      const base = o.lp.frequency.valueAt(0);
      const depth = o.toCutoff.gain.value;
      expect(base).toBe(875);
      expect(depth).toBe(525);
      expect(base - depth).toBe(350);
      expect(base + depth).toBe(1400);
      expect(o.lp.Q.value).toBe(0.6);
    } finally {
      o.dispose();
    }
  });

  it('swings the swell gain over 0.13..0.97 — never negative, never above unity', () => {
    const o = buildOcean(0);
    try {
      const base = o.swellGain.gain.valueAt(0);
      const depth = o.toSwell.gain.value;
      expect(base).toBe(0.55);
      expect(depth).toBe(0.42);
      expect(base - depth).toBeGreaterThan(0);
      expect(base + depth).toBeLessThan(1);
    } finally {
      o.dispose();
    }
  });

  it('starts the noise loop at a random offset inside the buffer', () => {
    // Two layers must not read the same point of the same pink loop.
    const offsets: number[] = [];
    for (let i = 0; i < 8; i++) {
      const o = buildOcean(0);
      try {
        const offset = o.src.startOffset ?? -1;
        expect(offset).toBeGreaterThanOrEqual(0);
        expect(offset).toBeLessThan(o.src.buffer?.duration ?? 0);
        expect(o.src.loop).toBe(true);
        expect(o.src.startedAt).toBe(0);
        offsets.push(offset);
      } finally {
        o.dispose();
      }
    }
    // A fixed offset would put every ocean layer in lockstep on the same loop.
    expect(new Set(offsets).size).toBe(offsets.length);
  });

  it('highpasses at 35 Hz so the swell carries no subsonic energy', () => {
    const o = buildOcean(0);
    expect(o.hp.frequency.value).toBe(35);
    expect(o.hp.type).toBe('highpass');
    o.dispose();
  });
});

describe('the crest task fires on the crest, forever', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** Crest times, recovered from the wash filter's own automation. */
  function crestTimes(o: OceanParts): number[] {
    const param = o.wash.frequency as unknown as FakeAudioParam;
    return param.events.filter((e) => e.type === 'target').map((e) => e.time + 1.5);
  }

  it.each([0, 3.7, 12, 47.3, 123.456])('built at t=%s, every crest lands at phase 0.5', (t0) => {
    const o = buildOcean(t0);
    try {
      o.sched.start();
      vi.advanceTimersByTime(14 * 60); // walk the scheduler out to the full horizon
      const crests = crestTimes(o);

      expect(crests.length).toBeGreaterThan(6);
      for (const c of crests) {
        const phase = (c * OCEAN_HZ) % 1;
        expect(phase).toBeCloseTo(0.5, 12);
      }
      // Exactly 10.000 s apart. Not approximately.
      for (let i = 1; i < crests.length; i++) {
        expect(crests[i] - crests[i - 1]).toBe(OCEAN_PERIOD);
      }
      // The first one is far enough ahead for its own 1.5 s pre-roll ramp.
      expect(crests[0]).toBeGreaterThanOrEqual(t0 + 1.6);
    } finally {
      o.sched.stop();
      o.dispose();
    }
  });

  it('re-colours the wash within its stated ranges, so no two waves break alike', () => {
    const o = buildOcean(0);
    try {
      o.sched.start();
      vi.advanceTimersByTime(14 * 60);

      const freqs = (o.wash.frequency as unknown as FakeAudioParam).events
        .filter((e) => e.type === 'target')
        .map((e) => e.value);
      const qs = (o.wash.Q as unknown as FakeAudioParam).events
        .filter((e) => e.type === 'target')
        .map((e) => e.value);
      const depths = (o.toWash.gain as unknown as FakeAudioParam).events
        .filter((e) => e.type === 'target')
        .map((e) => e.value);

      expect(freqs.length).toBeGreaterThan(6);
      for (const f of freqs) {
        expect(f).toBeGreaterThanOrEqual(1050);
        expect(f).toBeLessThanOrEqual(2000);
      }
      for (const q of qs) {
        expect(q).toBeGreaterThanOrEqual(0.8);
        expect(q).toBeLessThanOrEqual(1.7);
      }
      // NOTE: ocean.ts:104 comments "0.13 +/- 0.13 => never negative", but the
      // crest task re-writes this depth to 0.09..0.16 while the wash gain base
      // stays 0.13, so the modulated gain reaches -0.03 on the ~43% of crests
      // that draw above 0.13. Filed as a finding in tasks/tests.md, not fixed
      // here — this test pins the range that IS true.
      for (const d of depths) {
        expect(d).toBeGreaterThanOrEqual(0.09);
        expect(d).toBeLessThanOrEqual(0.16);
      }
      // Not a constant: the whole point is that each wave breaks differently.
      expect(new Set(freqs).size).toBeGreaterThan(freqs.length / 2);
    } finally {
      o.sched.stop();
      o.dispose();
    }
  });

  it('stops scheduling once the layer is disposed', () => {
    const o = buildOcean(0);
    o.sched.start();
    vi.advanceTimersByTime(14 * 60);
    const before = crestTimes(o).length;

    o.dispose();
    o.ctx.advance(300);
    vi.advanceTimersByTime(5000 * 3);

    expect(crestTimes(o)).toHaveLength(before);
    o.sched.stop();
  });

  it('disconnects every node it built when disposed', () => {
    const o = buildOcean(0);
    const built = [o.hp, o.lp, o.wash, o.swellGain, o.washGain, o.toCutoff, o.toSwell, o.toWash, o.lfo, o.lfoLag, o.src, o.out];
    expect(built.some((n) => n.connected)).toBe(true);
    o.dispose();
    for (const n of built) expect(n.connected).toBe(false);
    o.sched.stop();
  });
});
