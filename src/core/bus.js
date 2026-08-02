/**
 * Tiny pub/sub. This is the only channel between the audio engine, the UI,
 * the scene renderer and the monetization services. FROZEN CONTRACT — do not
 * change the event names below without updating every consumer.
 *
 * Events:
 *   audio:started          {}
 *   audio:stopped          {}
 *   mix:changed            engine.getState()
 *   timer:tick             { remainingSec }
 *   timer:done             {}
 *   timer:set              { minutes | null }
 *   ads:banner             { visible, heightPx }
 *   entitlements:changed   {}
 *   screen:changed         { name: 'mixer' | 'bedside' | 'breathing' }
 *   toast                  { message }
 */

const handlers = new Map();

export const bus = {
  on(event, fn) {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event).add(fn);
    return () => bus.off(event, fn);
  },

  off(event, fn) {
    handlers.get(event)?.delete(fn);
  },

  emit(event, payload) {
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

export function toast(message) {
  bus.emit('toast', { message });
}
