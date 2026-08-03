/**
 * MAP ENTRY #8 (part 2 of 3) — EVIDENCE DATA INTEGRITY.
 *
 * The evidence card is the product's differentiator: tap the info dot and you
 * get the actual study. Two structural weaknesses make that worth a test rather
 * than a read-through:
 *
 *  1. `EVIDENCE` is typed `Record<string, EvidenceEntry>` (evidence.ts:16), not
 *     `Record<SoundId, ...>`. So a missing sound is NOT a type error and a
 *     typo'd key is NOT a type error. `src/ui/mixState.ts:36` does
 *     `EVIDENCE[id]?.title ?? id`, which means a missing entry degrades to the
 *     raw id — the mix summary would read "Deep Pulse · deeppulse" and nothing
 *     would throw.
 *  2. The badge is the honesty mechanism for standing decision 6. An entry with
 *     a badge outside the legend renders as an unrecognised chip.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO: pin any individual sound to a
 * specific badge. The Research Lead has demoted pink noise from Strong to
 * Moderate on 2026 evidence and holds an open ruling on Deep Pulse's Emerging
 * badge. Asserting `EVIDENCE.pink.badge === 'Strong'` would go red tonight for
 * a reason that has nothing to do with a defect, and it would be deleted rather
 * than fixed. Badges are checked for MEMBERSHIP of the legend, which is the
 * property that is actually stable. The two badge facts that ARE standing
 * decisions live in standing-decisions.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { BADGE, BREATH_EVIDENCE, EVIDENCE, VOLUME_EVIDENCE } from '../../src/data/evidence';
import { SOUND_IDS } from '../../src/types';
import type { EvidenceEntry } from '../../src/types';

const LEGEND = Object.values(BADGE);

/** Every entry the app can surface, labelled by where it came from. */
const ALL_ENTRIES: Array<{ where: string; entry: EvidenceEntry }> = [
  ...Object.entries(EVIDENCE).map(([k, entry]) => ({ where: `EVIDENCE.${k}`, entry })),
  ...Object.entries(BREATH_EVIDENCE).map(([k, entry]) => ({ where: `BREATH_EVIDENCE.${k}`, entry })),
  { where: 'VOLUME_EVIDENCE', entry: VOLUME_EVIDENCE },
];

describe('every sound has an evidence entry', () => {
  it('covers all eleven SOUND_IDS with a usable title', () => {
    // The lookup is untyped, so this is the only thing standing between a
    // renamed sound and a mix summary that reads "rain · deeppulse".
    for (const id of SOUND_IDS) {
      const entry = EVIDENCE[id];
      expect(entry, `SOUND_ID '${id}' has no EVIDENCE entry — the UI would fall back to the raw id`)
        .toBeDefined();
      expect(entry.title.trim().length, `EVIDENCE.${id} has an empty title`).toBeGreaterThan(0);
      // Two-sided: a title longer than this overflows the layer card and the
      // mix summary line that joins them with " · ".
      expect(entry.title.length, `EVIDENCE.${id} title is too long for a layer card`).toBeLessThanOrEqual(
        32,
      );
      expect(entry.title).not.toBe(id); // a placeholder left behind
    }
  });

  it('checked all eleven, not a subset', () => {
    // The scan above iterates SOUND_IDS; if that list were ever emptied the loop
    // would pass having checked nothing.
    expect(SOUND_IDS.length).toBe(11);
    const covered = SOUND_IDS.filter((id) => EVIDENCE[id] !== undefined);
    expect(covered.length).toBe(SOUND_IDS.length);
  });

  it('gives every sound a distinct title', () => {
    const titles = SOUND_IDS.map((id) => EVIDENCE[id].title);
    expect(new Set(titles).size, 'two sounds share a title — the mix summary becomes ambiguous').toBe(
      titles.length,
    );
  });
});

describe('evidence entry shape', () => {
  it('badges every entry from the published legend', () => {
    expect(LEGEND).toEqual(['Strong', 'Moderate', 'Emerging', 'Traditional']);
    for (const { where, entry } of ALL_ENTRIES) {
      expect(LEGEND, `${where} has badge '${entry.badge}', which is not in the legend`).toContain(
        entry.badge,
      );
    }
  });

  it('scanned a realistic number of entries', () => {
    // Guards the scan itself: an ALL_ENTRIES that silently came back empty would
    // make every loop in this file vacuously green.
    expect(ALL_ENTRIES.length).toBeGreaterThanOrEqual(14);
    expect(ALL_ENTRIES.length).toBeLessThanOrEqual(40);
  });

  it('cites at least one real source for every sound', () => {
    // Standing decision 6 — "we publish the counter-evidence alongside the
    // supporting evidence". An evidence card with no evidence on it is the
    // marketing copy this product exists not to be.
    for (const id of SOUND_IDS) {
      const sources = EVIDENCE[id].sources ?? [];
      expect(sources.length, `EVIDENCE.${id} cites no sources`).toBeGreaterThanOrEqual(1);
      expect(sources.length, `EVIDENCE.${id} cites an implausible number of sources`).toBeLessThanOrEqual(
        6,
      );
    }
  });

  it('gives every source a label and an https url', () => {
    let checked = 0;
    for (const { where, entry } of ALL_ENTRIES) {
      for (const [i, src] of (entry.sources ?? []).entries()) {
        expect(src.label.trim().length, `${where}.sources[${i}] has no label`).toBeGreaterThan(0);
        expect(src.url, `${where}.sources[${i}] is not an https url`).toMatch(/^https:\/\/\S+$/);
        checked += 1;
      }
    }
    expect(checked, 'no sources were checked — the scan is broken').toBeGreaterThanOrEqual(15);
  });

  it('writes a claim or a detail on every entry', () => {
    for (const { where, entry } of ALL_ENTRIES) {
      const body = `${entry.claim ?? ''}${entry.detail ?? ''}`.trim();
      expect(body.length, `${where} has neither a claim nor a detail`).toBeGreaterThan(0);
    }
  });
});
