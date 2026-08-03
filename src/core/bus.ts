/**
 * Tiny typed pub/sub. This is the only channel between the audio engine, the
 * UI, the scene renderer and the monetization services. The event names and
 * payloads live in src/types.ts (BusEvents) — FROZEN CONTRACT.
 */

import type { BusEvent, BusEvents } from '../types';

type Handler<E extends BusEvent> = (payload: BusEvents[E]) => void;

const handlers = new Map<BusEvent, Set<Handler<BusEvent>>>();

export const bus = {
  on<E extends BusEvent>(event: E, fn: Handler<E>): () => void {
    let set = handlers.get(event);
    if (!set) {
      set = new Set();
      handlers.set(event, set);
    }
    set.add(fn as Handler<BusEvent>);
    return () => bus.off(event, fn);
  },

  off<E extends BusEvent>(event: E, fn: Handler<E>): void {
    handlers.get(event)?.delete(fn as Handler<BusEvent>);
  },

  emit<E extends BusEvent>(event: E, payload: BusEvents[E]): void {
    const set = handlers.get(event);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[bus] handler for "${event}" threw`, err);
      }
    }
  },
};

export function toast(message: string): void {
  bus.emit('toast', { message });
}
