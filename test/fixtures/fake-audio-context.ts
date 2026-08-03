/**
 * A hand-written fake `BaseAudioContext` for the pure-logic audio tier.
 *
 * WHY THIS EXISTS AND NOT THE SHIPPED MOCK
 * ----------------------------------------
 * `react-native-audio-api` 0.13.2 ships `lib/commonjs/mock/index.js`. QA measured
 * it (tasks/tests.md, 21:29:41) and it renders DIGITAL SILENCE by construction:
 * `copyToChannel` discards its input, `getChannelData` hands back a fresh
 * zero-filled array every call, `setTargetAtTime`/`linearRampToValueAtTime` jump
 * instantly with no ramp, `currentTime` is permanently 0, and
 * `startRendering()` resolves an all-zero buffer. It is a structural stub for
 * import-safety and it is correct for that job. It is not a renderer, and a
 * one-sided assertion like "peak <= 0.35" is GREEN on it.
 *
 * This fake is the opposite trade. It has no DSP at all — it renders nothing —
 * but it KEEPS every value written to it:
 *
 *   - `copyToChannel` copies the real samples, and `getChannelData` hands back
 *     the same array, so a generator's output can be measured directly.
 *   - Every AudioParam method records a real automation event, and `valueAt(t)`
 *     evaluates the timeline, so "the gain reaches 0.33 at t+0.5" is a two-sided
 *     assertion on a value rather than a check that a method was called.
 *   - `currentTime` advances (`advance(seconds)`), so scheduling can be driven.
 *
 * WHAT IT PROVES, AND WHAT IT CANNOT
 * ----------------------------------
 * It proves INTENT: our own arithmetic, on our own graph, against our own
 * constants. It is structurally blind to library-binding bugs — the class that
 * every real bug in the RN port belonged to (copyToChannel sizing from the
 * backing ArrayBuffer, `onEnded` vs `onended`, the native event-registry retain
 * cycle, the absent DynamicsCompressorNode). A green run here is NOT evidence
 * that the audio works on a device, and it retires no device listen.
 *
 * Two behaviours below are MODELLED FROM DOCUMENTED NATIVE BEHAVIOUR rather
 * than measured against the native library, and are marked `(reasoned, not
 * measured)` at their definition:
 *   1. `copyToChannel` sizing the copy from the backing ArrayBuffer
 *      (src/audio/noise.ts:107-114).
 *   2. The `PeriodicWave` coefficient convention used by `sampleAt`
 *      (src/audio/onef.ts:23-30).
 *
 * Cast with `asContext()` at the call site; the fake implements the subset of
 * `BaseAudioContext` that `src/audio/**` actually uses — 8 node constructors and
 * 7 AudioParam methods, counted by grep, nothing else.
 */

import type { BaseAudioContext } from 'react-native-audio-api';

const TAU = Math.PI * 2;

/* -------------------------------------------------------------- AudioParam */

export type ParamEventType = 'set' | 'linear' | 'exponential' | 'target' | 'curve';

export interface ParamEvent {
  type: ParamEventType;
  /** Audio-clock time the event is anchored at. */
  time: number;
  /** Target / end value. For `curve`, the final curve sample. */
  value: number;
  /** `target` only. */
  timeConstant?: number;
  /** `curve` only. */
  curve?: Float32Array;
  /** `curve` only. */
  duration?: number;
}

/**
 * An AudioParam that remembers its automation instead of collapsing it.
 *
 * `.value` is the last DIRECT assignment (`param.value = x`) or the node's
 * default — it deliberately does NOT move when a scheduled method is called,
 * because a test that reads `.value` after a ramp would otherwise look like it
 * had measured the ramp. Use `valueAt(t)` for the automated curve; that is the
 * only honest reading.
 */
export class FakeAudioParam {
  readonly defaultValue: number;
  readonly name: string;
  readonly events: ParamEvent[] = [];

  private _value: number;
  private readonly ctx: FakeAudioContext;

  constructor(ctx: FakeAudioContext, name: string, defaultValue: number) {
    this.ctx = ctx;
    this.name = name;
    this.defaultValue = defaultValue;
    this._value = defaultValue;
  }

  get value(): number {
    return this._value;
  }

  /** A direct write is `setValueAtTime(v, ctx.currentTime)` plus a readable field. */
  set value(v: number) {
    this._value = v;
    this.events.push({ type: 'set', time: this.ctx.currentTime, value: v });
  }

  setValueAtTime(value: number, startTime: number): this {
    this.events.push({ type: 'set', time: startTime, value });
    return this;
  }

  linearRampToValueAtTime(value: number, endTime: number): this {
    this.events.push({ type: 'linear', time: endTime, value });
    return this;
  }

  exponentialRampToValueAtTime(value: number, endTime: number): this {
    this.events.push({ type: 'exponential', time: endTime, value });
    return this;
  }

  setTargetAtTime(target: number, startTime: number, timeConstant: number): this {
    this.events.push({ type: 'target', time: startTime, value: target, timeConstant });
    return this;
  }

  setValueCurveAtTime(curve: Float32Array | number[], startTime: number, duration: number): this {
    const c = curve instanceof Float32Array ? Float32Array.from(curve) : Float32Array.from(curve);
    this.events.push({
      type: 'curve',
      time: startTime,
      value: c.length ? c[c.length - 1] : this.defaultValue,
      curve: c,
      duration,
    });
    return this;
  }

  cancelScheduledValues(startTime: number): this {
    for (let i = this.events.length - 1; i >= 0; i--) {
      if (this.events[i].time >= startTime) this.events.splice(i, 1);
    }
    return this;
  }

  /**
   * Truncate the future and pin the value the param actually has at `t`.
   * This is what `engine.ts anchor()` relies on: after it, the next ramp has a
   * defined start, which is the fix for the classic click.
   */
  cancelAndHoldAtTime(cancelTime: number): this {
    const held = this.valueAt(cancelTime);
    for (let i = this.events.length - 1; i >= 0; i--) {
      if (this.events[i].time > cancelTime) this.events.splice(i, 1);
    }
    this.events.push({ type: 'set', time: cancelTime, value: held });
    return this;
  }

  /** The automated value at audio time `t`. */
  valueAt(t: number): number {
    const evs = [...this.events].sort((a, b) => a.time - b.time);
    if (evs.length === 0) return this._value;

    // Forward pass: the value immediately BEFORE each event, computed once so a
    // long chain of setTargetAtTime (a slider drag is ~60/s) stays iterative.
    const before: number[] = new Array<number>(evs.length);
    for (let k = 0; k < evs.length; k++) {
      before[k] = k === 0 ? this.defaultValue : governedValue(evs[k - 1], before[k - 1], evs[k].time);
    }

    let i = -1;
    for (let k = 0; k < evs.length; k++) {
      if (evs[k].time <= t) i = k;
      else break;
    }
    if (i < 0) return this.defaultValue;

    const e = evs[i];
    const next: ParamEvent | undefined = evs[i + 1];
    if (next && (next.type === 'linear' || next.type === 'exponential') && next.time > t) {
      const v0 = governedValue(e, before[i], e.time);
      const span = next.time - e.time;
      if (span <= 0) return next.value;
      const frac = (t - e.time) / span;
      if (next.type === 'linear') return v0 + (next.value - v0) * frac;
      // WebAudio forbids an exponential ramp through or to zero; the engine only
      // ever ramps exponentially between positive values.
      if (v0 <= 0 || next.value <= 0) return next.value;
      return v0 * Math.pow(next.value / v0, frac);
    }
    return governedValue(e, before[i], t);
  }

  /** True when a ramp is scheduled with nothing anchoring its start value.
   *  "Never ramp from an unset AudioParam" — team/audio-engineer.md. */
  get hasUnanchoredRamp(): boolean {
    const evs = [...this.events].sort((a, b) => a.time - b.time);
    return evs.length > 0 && (evs[0].type === 'linear' || evs[0].type === 'exponential');
  }
}

/** Value at time `t`, given `e` is the governing event and `pre` the value just before it. */
function governedValue(e: ParamEvent, pre: number, t: number): number {
  switch (e.type) {
    case 'set':
    case 'linear':
    case 'exponential':
      return e.value;
    case 'target': {
      const tc = e.timeConstant ?? 0;
      if (tc <= 0) return e.value;
      return e.value + (pre - e.value) * Math.exp(-(t - e.time) / tc);
    }
    case 'curve': {
      const c = e.curve;
      const dur = e.duration ?? 0;
      if (!c || c.length === 0) return pre;
      if (dur <= 0 || t >= e.time + dur) return c[c.length - 1];
      const x = ((t - e.time) / dur) * (c.length - 1);
      const i0 = Math.floor(x);
      const i1 = Math.min(c.length - 1, i0 + 1);
      return c[i0] + (c[i1] - c[i0]) * (x - i0);
    }
  }
}

/* --------------------------------------------------------------- AudioNode */

export type ConnectTarget = FakeAudioNode | FakeAudioParam;

export class FakeAudioNode {
  readonly nodeType: string;
  readonly id: number;
  readonly context: FakeAudioContext;
  /** Everything this node currently feeds. Emptied by `disconnect()`. */
  readonly outputs: ConnectTarget[] = [];
  disconnectCount = 0;

  constructor(ctx: FakeAudioContext, nodeType: string) {
    this.context = ctx;
    this.nodeType = nodeType;
    this.id = ctx._register(this);
  }

  connect<T extends ConnectTarget>(destination: T): T {
    this.outputs.push(destination);
    return destination;
  }

  disconnect(destination?: ConnectTarget): void {
    this.disconnectCount++;
    if (!destination) {
      this.outputs.length = 0;
      return;
    }
    const i = this.outputs.indexOf(destination);
    if (i >= 0) this.outputs.splice(i, 1);
  }

  /** Still feeding something. A disposed node must not be. */
  get connected(): boolean {
    return this.outputs.length > 0;
  }
}

export class FakeGainNode extends FakeAudioNode {
  readonly gain: FakeAudioParam;
  constructor(ctx: FakeAudioContext) {
    super(ctx, 'gain');
    this.gain = new FakeAudioParam(ctx, 'gain', 1);
  }
}

export type FakeBiquadType =
  | 'lowpass'
  | 'highpass'
  | 'bandpass'
  | 'lowshelf'
  | 'highshelf'
  | 'peaking'
  | 'notch'
  | 'allpass';

export class FakeBiquadFilterNode extends FakeAudioNode {
  type: FakeBiquadType = 'lowpass';
  readonly frequency: FakeAudioParam;
  readonly Q: FakeAudioParam;
  readonly gain: FakeAudioParam;
  readonly detune: FakeAudioParam;
  constructor(ctx: FakeAudioContext) {
    super(ctx, 'biquad');
    this.frequency = new FakeAudioParam(ctx, 'frequency', 350);
    this.Q = new FakeAudioParam(ctx, 'Q', 1);
    this.gain = new FakeAudioParam(ctx, 'gain', 0);
    this.detune = new FakeAudioParam(ctx, 'detune', 0);
  }
}

export class FakeStereoPannerNode extends FakeAudioNode {
  readonly pan: FakeAudioParam;
  constructor(ctx: FakeAudioContext) {
    super(ctx, 'panner');
    this.pan = new FakeAudioParam(ctx, 'pan', 0);
  }
}

export class FakeWaveShaperNode extends FakeAudioNode {
  curve: Float32Array | null = null;
  oversample: 'none' | '2x' | '4x' = 'none';
  constructor(ctx: FakeAudioContext) {
    super(ctx, 'waveshaper');
  }
}

/**
 * Shared start/stop bookkeeping. The real nodes throw on a double start and on
 * a stop before start, which is why every dispose path in `src/audio` wraps
 * `stop()` in try/catch — so the fake throws too, or those catch blocks would
 * never be exercised.
 */
export class FakeScheduledSourceNode extends FakeAudioNode {
  onEnded: (() => void) | null = null;
  startedAt: number | null = null;
  stoppedAt: number | null = null;

  start(when = 0, offset?: number, duration?: number): void {
    if (this.startedAt !== null) throw new Error('InvalidStateError: cannot call start more than once');
    this.startedAt = when;
    this.startOffset = offset;
    this.startDuration = duration;
  }

  stop(when = 0): void {
    if (this.startedAt === null) throw new Error('InvalidStateError: cannot call stop without calling start first');
    this.stoppedAt = when;
  }

  startOffset: number | undefined;
  startDuration: number | undefined;

  /** Simulate the native `ended` event. */
  fireEnded(): void {
    this.onEnded?.();
  }
}

export class FakeOscillatorNode extends FakeScheduledSourceNode {
  type: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'custom' = 'sine';
  readonly frequency: FakeAudioParam;
  readonly detune: FakeAudioParam;
  periodicWave: FakePeriodicWave | null = null;

  constructor(ctx: FakeAudioContext) {
    super(ctx, 'oscillator');
    this.frequency = new FakeAudioParam(ctx, 'frequency', 440);
    this.detune = new FakeAudioParam(ctx, 'detune', 0);
  }

  setPeriodicWave(wave: FakePeriodicWave): void {
    this.periodicWave = wave;
    this.type = 'custom';
  }
}

export class FakeAudioBufferSourceNode extends FakeScheduledSourceNode {
  buffer: FakeAudioBuffer | null = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  readonly playbackRate: FakeAudioParam;
  readonly detune: FakeAudioParam;

  constructor(ctx: FakeAudioContext) {
    super(ctx, 'buffersource');
    this.playbackRate = new FakeAudioParam(ctx, 'playbackRate', 1);
    this.detune = new FakeAudioParam(ctx, 'detune', 0);
  }
}

/* ------------------------------------------------------------- AudioBuffer */

export class FakeAudioBuffer {
  readonly numberOfChannels: number;
  readonly length: number;
  readonly sampleRate: number;
  private readonly _channels: Float32Array[];

  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this._channels = [];
    for (let c = 0; c < numberOfChannels; c++) this._channels.push(new Float32Array(length));
  }

  get duration(): number {
    return this.length / this.sampleRate;
  }

  /** The real backing array — writes through it are visible, unlike the shipped mock. */
  getChannelData(channel: number): Float32Array {
    const c = this._channels[channel];
    if (!c) throw new RangeError(`IndexSizeError: no channel ${channel}`);
    return c;
  }

  /**
   * (reasoned, not measured) — models react-native-audio-api 0.13.2's native
   * copy, which sizes the transfer from the source's BACKING ArrayBuffer rather
   * than from the view. `subarray()` therefore reports more samples than the
   * view holds and throws; `slice()` does not. That difference is the exact bug
   * recorded at src/audio/noise.ts:107-114, which the browser build never
   * surfaced because it sized from the view. Modelled from that comment, not
   * from the native source.
   */
  copyToChannel(source: Float32Array, channel: number, startInChannel = 0): void {
    const dest = this.getChannelData(channel);
    const backingSamples = source.buffer.byteLength / source.BYTES_PER_ELEMENT;
    if (backingSamples > dest.length - startInChannel) {
      throw new RangeError('Not enough space to copy to destination.');
    }
    dest.set(source, startInChannel);
  }

  copyFromChannel(destination: Float32Array, channel: number, startInChannel = 0): void {
    const src = this.getChannelData(channel);
    const n = Math.min(destination.length, src.length - startInChannel);
    for (let i = 0; i < n; i++) destination[i] = src[startInChannel + i];
  }
}

/* ------------------------------------------------------------ PeriodicWave */

export class FakePeriodicWave {
  readonly real: Float32Array;
  readonly imag: Float32Array;
  readonly disableNormalization: boolean;

  constructor(real: Float32Array, imag: Float32Array, disableNormalization: boolean) {
    this.real = Float32Array.from(real);
    this.imag = Float32Array.from(imag);
    this.disableNormalization = disableNormalization;
  }

  /**
   * The waveform at `cycles` periods from the oscillator's own start, i.e.
   * `f * (t - tStart)`.
   *
   * (reasoned, not measured) — uses the convention DOCUMENTED BY THIS CODEBASE
   * at src/audio/onef.ts:23-30: real[k] weights cos, imag[k] weights sin, so
   * `real[1] = sin(p), imag[1] = cos(p)` yields `sin(2*pi*f*t + p)`. The sign
   * convention of the shipped native implementation has NOT been verified here
   * and cannot be from the pure tier. If it is opposite, every phase in the
   * engine is consistently reflected and these tests would agree with the code
   * while both were wrong — that check needs a render or a device.
   */
  sampleAt(cycles: number): number {
    let sum = 0;
    const n = Math.min(this.real.length, this.imag.length);
    for (let k = 1; k < n; k++) {
      sum += this.real[k] * Math.cos(TAU * k * cycles) + this.imag[k] * Math.sin(TAU * k * cycles);
    }
    return sum;
  }
}

/* ----------------------------------------------------------------- context */

export interface FakeContextOptions {
  sampleRate?: number;
  currentTime?: number;
  state?: 'suspended' | 'running' | 'closed';
}

export class FakeAudioContext {
  sampleRate: number;
  /** Writable audio clock. Move it with `advance()`. */
  currentTime: number;
  state: 'suspended' | 'running' | 'closed';
  readonly destination: FakeAudioNode;
  /** Every node ever created, in creation order. */
  readonly nodes: FakeAudioNode[] = [];

  private _nextId = 0;

  constructor(opts: FakeContextOptions = {}) {
    this.sampleRate = opts.sampleRate ?? 44100;
    this.currentTime = opts.currentTime ?? 0;
    this.state = opts.state ?? 'running';
    // Registered like any other node so `nodes[0]` is not a surprise.
    this.destination = new FakeAudioNode(this, 'destination');
  }

  /** @internal */
  _register(node: FakeAudioNode): number {
    const id = this._nextId++;
    this.nodes.push(node);
    return id;
  }

  createGain(): FakeGainNode {
    return new FakeGainNode(this);
  }

  createBiquadFilter(): FakeBiquadFilterNode {
    return new FakeBiquadFilterNode(this);
  }

  createOscillator(): FakeOscillatorNode {
    return new FakeOscillatorNode(this);
  }

  createBufferSource(): FakeAudioBufferSourceNode {
    return new FakeAudioBufferSourceNode(this);
  }

  createStereoPanner(): FakeStereoPannerNode {
    return new FakeStereoPannerNode(this);
  }

  createWaveShaper(): FakeWaveShaperNode {
    return new FakeWaveShaperNode(this);
  }

  createBuffer(numberOfChannels: number, length: number, sampleRate: number): FakeAudioBuffer {
    return new FakeAudioBuffer(numberOfChannels, length, sampleRate);
  }

  createPeriodicWave(
    real: Float32Array,
    imag: Float32Array,
    opts: { disableNormalization?: boolean } = {}
  ): FakePeriodicWave {
    return new FakePeriodicWave(real, imag, opts.disableNormalization === true);
  }

  async resume(): Promise<void> {
    this.state = 'running';
  }

  async suspend(): Promise<void> {
    this.state = 'suspended';
  }

  async close(): Promise<void> {
    this.state = 'closed';
  }

  /* ------------------------------------------------------------ test-only */

  /** Move the audio clock forward. Negative steps are a caller error. */
  advance(seconds: number): number {
    if (!(seconds >= 0)) throw new Error(`advance() needs a non-negative step, got ${seconds}`);
    this.currentTime += seconds;
    return this.currentTime;
  }

  nodesOfType(nodeType: string): FakeAudioNode[] {
    return this.nodes.filter((n) => n.nodeType === nodeType);
  }
}

/**
 * The one cast, in one place. `src/audio/**` types its context parameter as
 * `BaseAudioContext`; the fake implements the subset that is actually used.
 */
export function asContext(fake: FakeAudioContext): BaseAudioContext {
  return fake as unknown as BaseAudioContext;
}

export function createFakeContext(opts: FakeContextOptions = {}): FakeAudioContext {
  return new FakeAudioContext(opts);
}
