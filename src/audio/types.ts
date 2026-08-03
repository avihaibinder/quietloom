/**
 * Small helper types shared by the audio engine and its layer factories.
 * The domain types (SoundId, EngineState, MixSpec, …) live in rn/src/types.ts —
 * these are purely the internal seams between engine.ts and layers/*.
 */

import type { AudioNode, BaseAudioContext } from 'react-native-audio-api';

import type { Scheduler } from './scheduler';

/** What every layer factory returns. `output` is connected into the 1/f chain. */
export interface Layer {
  output: AudioNode;
  setParam?(name: string, value: number): void;
  dispose(): void;
}

/** What the engine hands every layer factory. */
export interface LayerIO {
  scheduler: Scheduler;
  params: Record<string, number>;
  key: string;
}

export type LayerFactory = (ctx: BaseAudioContext, io: LayerIO) => Layer;
