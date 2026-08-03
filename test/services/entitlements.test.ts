/**
 * MAP ENTRY #7 — ENTITLEMENTS AND THE NIGHT-PASS EXPIRY EDGES.
 *
 * Moved here from test/unit/entitlements.test.ts (the wave-1 exemplar) so the
 * test path mirrors the source path, per the Team Lead's ownership rule and CEO
 * ruling 4. The wave-1 cases are unchanged; the boundary work below is new.
 *
 * The rule under test, entitlements.ts:12-19, is four lines and has two
 * separate comparison edges, neither of which had ever been exercised:
 *
 *   e.setHours(11, 0, 0, 0);
 *   if (e <= now) e.setDate(e.getDate() + 1);   <-- edge 1, `<=` not `<`
 *   ...
 *   return Number.isFinite(t) && t > Date.now(); <-- edge 2, `>` not `>=`
 *
 * Get edge 1 wrong and a pass granted at exactly 11:00:00 lasts zero seconds.
 * Get edge 2 wrong and it lasts one tick too long. Both are off-by-one in a
 * paid feature, which is the kind of thing nobody reports and everybody
 * notices.
 *
 * Note what is NOT asserted anywhere here: never that AsyncStorage.setItem
 * "was called". Only whether a user can actually still hear a locked sound.
 * (CEO lead 5.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetAsyncStorage } from '../../__mocks__/async-storage';
import { KEYS, hydrate, remove, write } from '../../src/core/store';
import { Entitlements, FREE_SOUNDS } from '../../src/services/entitlements';
import { SOUND_IDS, type LayerState, type SavedMix, type SoundId } from '../../src/types';

/** Local-time Date, matching entitlements.ts's use of setHours(). */
const at = (y: number, m: number, d: number, h: number, min = 0, s = 0, ms = 0) =>
  new Date(y, m - 1, d, h, min, s, ms);

beforeEach(async () => {
  vi.useFakeTimers();
  __resetAsyncStorage();
  // store.ts caches in a module-level Map; clear the keys this file touches.
  remove(KEYS.premium);
  remove(KEYS.nightPass);
  await hydrate();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('night pass expiry — "the next 11:00 local"', () => {
  it('granted in the evening, survives the night and dies at 11:00 the NEXT morning', () => {
    vi.setSystemTime(at(2026, 8, 3, 22, 30)); // 22:30 Monday
    Entitlements.grantNightPass();

    expect(Entitlements.hasNightPass()).toBe(true);

    vi.setSystemTime(at(2026, 8, 4, 3, 0)); // 03:00, still asleep
    expect(Entitlements.hasNightPass()).toBe(true);

    vi.setSystemTime(at(2026, 8, 4, 10, 59)); // one minute to go
    expect(Entitlements.hasNightPass()).toBe(true);

    vi.setSystemTime(at(2026, 8, 4, 11, 1)); // expired
    expect(Entitlements.hasNightPass()).toBe(false);
  });

  it('granted after midnight, dies at 11:00 the SAME morning — not 35 hours later', () => {
    // This is the `if (e <= now) e.setDate(e.getDate() + 1)` branch NOT firing.
    // Get it wrong and a 03:00 pass silently lasts a day and a half.
    vi.setSystemTime(at(2026, 8, 4, 3, 0));
    Entitlements.grantNightPass();

    const expiry = Entitlements.nightPassExpiry();
    expect(expiry).not.toBeNull();
    expect(expiry?.getDate()).toBe(4);
    expect(expiry?.getHours()).toBe(11);

    vi.setSystemTime(at(2026, 8, 4, 11, 1));
    expect(Entitlements.hasNightPass()).toBe(false);
  });

  it('reports no pass at all when none was ever granted', () => {
    vi.setSystemTime(at(2026, 8, 3, 22, 30));
    expect(Entitlements.hasNightPass()).toBe(false);
    expect(Entitlements.nightPassExpiry()).toBeNull();
  });
});

describe('the two comparison edges, at the exact millisecond', () => {
  it('granted at EXACTLY 11:00:00.000 rolls to tomorrow — the `<=` edge', () => {
    // `<` here instead of `<=` would set the expiry to the same instant as the
    // grant, and `hasNightPass()` would return false immediately: the user pays
    // an ad for a pass that is already dead. Nobody would ever see this except
    // the one user who tapped at 11:00:00 exactly.
    vi.setSystemTime(at(2026, 8, 3, 11, 0, 0, 0));
    Entitlements.grantNightPass();

    const expiry = Entitlements.nightPassExpiry();
    expect(expiry?.getDate()).toBe(4); // tomorrow, not today
    expect(expiry?.getHours()).toBe(11);
    expect(Entitlements.hasNightPass()).toBe(true);

    // Two-sided on the duration: a full day, not zero and not two.
    const heldMs = (expiry as Date).getTime() - Date.now();
    expect(heldMs).toBeGreaterThan(23 * 3_600_000);
    expect(heldMs).toBeLessThanOrEqual(25 * 3_600_000); // DST-tolerant
  });

  it('granted one millisecond BEFORE 11:00:00 expires today — the mirror of that edge', () => {
    // Deliberately pinned, and deliberately flagged rather than blessed. This
    // is the current rule and QA filed it as a product question (tasks/tests.md,
    // finding d): "night pass" implies a night, and a pass bought at 10:59:59.999
    // lasts one millisecond. If product changes the rule, this test SHOULD go
    // red — that is the point of writing it down.
    vi.setSystemTime(at(2026, 8, 3, 10, 59, 59, 999));
    Entitlements.grantNightPass();

    const expiry = Entitlements.nightPassExpiry();
    expect(expiry?.getDate()).toBe(3); // today
    expect((expiry as Date).getTime() - Date.now()).toBe(1);
  });

  it('is dead AT the expiry instant and alive one millisecond before — the `>` edge', () => {
    vi.setSystemTime(at(2026, 8, 3, 22, 30));
    Entitlements.grantNightPass();
    const expiry = (Entitlements.nightPassExpiry() as Date).getTime();

    vi.setSystemTime(new Date(expiry - 1));
    expect(Entitlements.hasNightPass()).toBe(true);

    vi.setSystemTime(new Date(expiry));
    // `>=` here instead of `>` would keep it alive for one more tick. Small,
    // but it is the difference between a rule and a rule-shaped guess.
    expect(Entitlements.hasNightPass()).toBe(false);

    vi.setSystemTime(new Date(expiry + 1));
    expect(Entitlements.hasNightPass()).toBe(false);
  });

  it('treats a corrupt or unparseable stored expiry as no pass, not as forever', () => {
    // `Number.isFinite(t)` is the guard. There is no versioning or migration on
    // any persisted value in this app (QA finding e), so a garbage read is a
    // real possibility and it must fail CLOSED.
    vi.setSystemTime(at(2026, 8, 3, 22, 30));
    for (const junk of ['', 'tomorrow', 'null', '{}']) {
      Entitlements.grantNightPass();
      expect(Entitlements.hasNightPass()).toBe(true);
      // Overwrite the stored value the way a truncated write or an absent
      // migration would, then ask the only question that matters.
      write(KEYS.nightPass, junk);
      expect(Entitlements.hasNightPass(), `junk expiry ${JSON.stringify(junk)} unlocked the app`).toBe(
        false,
      );
      expect(Entitlements.isUnlocked('fire')).toBe(false);
    }
  });
});

describe('isUnlocked decision table', () => {
  beforeEach(() => {
    vi.setSystemTime(at(2026, 8, 3, 22, 30));
  });

  it('keeps the four free sounds free with no premium and no pass', () => {
    // Standing product decision 4: the free tier stays genuinely useful.
    expect(FREE_SOUNDS).toEqual(['rain', 'ocean', 'pink', 'brown']);
    for (const id of FREE_SOUNDS) {
      expect(Entitlements.isUnlocked(id)).toBe(true);
    }
  });

  it('locks a paid sound when there is no premium and no pass', () => {
    expect(Entitlements.isPremium()).toBe(false);
    expect(Entitlements.hasNightPass()).toBe(false);
    expect(Entitlements.isUnlocked('fire')).toBe(false);
  });

  it('unlocks a paid sound for a night pass, and re-locks it once the pass expires', () => {
    Entitlements.grantNightPass();
    expect(Entitlements.isUnlocked('fire')).toBe(true);

    vi.setSystemTime(at(2026, 8, 4, 11, 1));
    expect(Entitlements.isUnlocked('fire')).toBe(false);
    // ...but the free four are unaffected by expiry.
    expect(Entitlements.isUnlocked('rain')).toBe(true);
  });

  it('unlocks everything for premium, with no pass and regardless of the clock', () => {
    Entitlements.setPremium(true);
    vi.setSystemTime(at(2030, 1, 1, 12, 0));
    expect(Entitlements.hasNightPass()).toBe(false);
    expect(Entitlements.isUnlocked('fire')).toBe(true);
    expect(Entitlements.isUnlocked('binaural')).toBe(true);
  });

  it('re-locks paid sounds when premium is revoked', () => {
    Entitlements.setPremium(true);
    expect(Entitlements.isUnlocked('deeppulse')).toBe(true);
    Entitlements.setPremium(false);
    expect(Entitlements.isUnlocked('deeppulse')).toBe(false);
  });
});

/* ========================================================================== *
 * RESTORING A SAVED MIX ACROSS THE EXPIRY BOUNDARY
 * ========================================================================== */

/**
 * A saved mix exactly as `MixesSheet.doSave()` writes one.
 *
 * The shape matters and a partial would have been a lie: doSave() stores
 * `engine.getState().layers`, which is the FULL eleven-key record with the
 * untouched layers present and disabled — not just the ones that were on. So
 * the fixture fills all eleven and the caller names only what was playing.
 */
function savedMix(playing: Partial<Record<SoundId, LayerState>>): SavedMix {
  const layers = {} as Record<SoundId, LayerState>;
  for (const id of SOUND_IDS) {
    layers[id] = playing[id] ?? { enabled: false, volume: 0, params: {} };
  }
  return {
    id: 'mix-1',
    name: 'Headphones night',
    createdAt: Date.parse('2026-08-03T22:30:00Z'),
    master: 0.7,
    layers,
  };
}

const nightMix = savedMix({
  rain: { enabled: true, volume: 0.6, params: { intensity: 0.5 } },
  brown: { enabled: true, volume: 0.4, params: {} },
  binaural: { enabled: true, volume: 0.3, params: { baseHz: 250, beatHz: 0.25 } },
});

/**
 * !! THIS IS A MIRROR OF SHIPPED CODE, NOT THE SHIPPED CODE ITSELF. !!
 *
 * `MixesSheet.tsx:114-117` computes exactly this, inline, inside a
 * `useCallback` — tier 3, unreachable from here. `PresetRow.tsx:61` computes it
 * a second time. Duplicating it a third time in a test is not good enough, and
 * I am not pretending otherwise: it is the concrete argument for seam S5, which
 * is written out in my log entry for routing.
 *
 * What the test below therefore DOES prove: that the entitlement decision this
 * filter consumes flips correctly across the expiry boundary, which is the only
 * input the filter has. What it does NOT prove: that MixesSheet still calls it.
 */
/** Which layers actually come back ON. Mirrors MixesSheet.tsx:115-117 + :102. */
function restoredEnabled(mix: SavedMix): SoundId[] {
  return (Object.keys(mix.layers) as SoundId[])
    .filter((id) => mix.layers[id]?.enabled && Entitlements.isUnlocked(id))
    .sort();
}

/** Which enabled layers were withheld, i.e. what the paywall is opened for.
 *  Mirrors MixesSheet.tsx:111-113. */
function lockedOut(mix: SavedMix): SoundId[] {
  return (Object.keys(mix.layers) as SoundId[])
    .filter((id) => mix.layers[id]?.enabled && !Entitlements.isUnlocked(id))
    .sort();
}

describe('a saved mix restores only what the user may still hear', () => {
  it('restores binaural enabled while the pass is live, and DISABLED once it expires', () => {
    vi.setSystemTime(at(2026, 8, 3, 22, 30));
    Entitlements.grantNightPass();

    // While the pass is live the mix comes back whole and nothing is withheld.
    expect(restoredEnabled(nightMix)).toEqual(['binaural', 'brown', 'rain']);
    expect(lockedOut(nightMix)).toEqual([]);

    // Next morning, one minute past 11:00.
    vi.setSystemTime(at(2026, 8, 4, 11, 1));

    // The paid layer comes back DISABLED; the free bed survives. A user who
    // reloads their saved mix at lunchtime gets rain and brown — not silence,
    // and not a binaural beat they are no longer entitled to.
    expect(Entitlements.isUnlocked('binaural')).toBe(false);
    expect(restoredEnabled(nightMix)).toEqual(['brown', 'rain']);
    expect(restoredEnabled(nightMix)).not.toContain('binaural');

    // ...and they are told why, rather than the layer vanishing silently.
    expect(lockedOut(nightMix)).toEqual(['binaural']);
  });

  it('restores the paid layer again for a premium user, with no pass at all', () => {
    vi.setSystemTime(at(2026, 8, 4, 11, 1));
    expect(restoredEnabled(nightMix)).not.toContain('binaural');

    Entitlements.setPremium(true);
    expect(Entitlements.hasNightPass()).toBe(false);
    expect(restoredEnabled(nightMix)).toEqual(['binaural', 'brown', 'rain']);
    expect(lockedOut(nightMix)).toEqual([]);
  });

  it('never drops a free layer, and never re-enables one that was off', () => {
    // Two-sided against the opposite failure: a filter that is too aggressive
    // strips the free tier and leaves the user with silence; one that is too
    // loose turns on eight layers the user never selected. The fixture stores
    // all eleven layers, eight of them disabled, so both are reachable here.
    for (const when of [at(2026, 8, 3, 22, 30), at(2026, 8, 4, 11, 1), at(2030, 1, 1, 12, 0)]) {
      vi.setSystemTime(when);
      const on = restoredEnabled(nightMix);
      expect(on).toContain('rain');
      expect(on).toContain('brown');
      expect(on).not.toContain('fire'); // stored, but disabled
      expect(on.length).toBeGreaterThanOrEqual(2);
      expect(on.length).toBeLessThanOrEqual(3);
    }
  });
});
