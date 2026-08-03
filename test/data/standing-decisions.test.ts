/**
 * MAP ENTRY #8 (part 3 of 3) — THE TWO STANDING-DECISION ASSERTIONS.
 *
 * `team/README.md` holds nine standing product decisions: "settled ... nobody
 * changes them quietly, because each has a reason that is not obvious from the
 * code." Two of them are decisions about DATA, so they can be held here rather
 * than by a human re-reading strings before every release.
 *
 * ============================ EXPECTED STATE ==============================
 * The standing decision 6 block below is RED ON PURPOSE and is red in
 * substance. It is not a broken test.
 *
 * Deep Pulse's shipping copy really does breach the decision, in two places
 * (`src/data/evidence.ts:128` and `src/data/presets.ts:104`). The Research Lead
 * ruled on this tonight, has issued replacement copy, and that copy has NOT
 * landed. `src/data/**` belongs to the Research Lead and is being routed
 * separately by the CEO.
 *
 * DO NOT make this green by softening the assertion, and do not edit
 * `src/data/**` to make it pass. A red test that names a real defect is the
 * correct output. It goes green by itself the moment the replacement copy
 * lands — I checked the replacement strings against these assertions rather
 * than assuming, and they pass.
 * ==========================================================================
 */
import { describe, expect, it } from 'vitest';

import { EVIDENCE } from '../../src/data/evidence';
import { PRESETS, getPreset } from '../../src/data/presets';
import { FREE_SOUNDS } from '../../src/services/entitlements';
import { SOUND_IDS, type SoundId } from '../../src/types';

/**
 * Every string a USER can read that describes a layer. Deliberately excludes
 * `detail`: see the long note in the standing-decision-6 block.
 */
interface Surface {
  where: string;
  text: string;
}

function claimSurfacesFor(id: SoundId): Surface[] {
  const entry = EVIDENCE[id];
  const out: Surface[] = [
    { where: `EVIDENCE.${id}.title`, text: entry.title },
    { where: `EVIDENCE.${id}.claim`, text: entry.claim ?? '' },
  ];
  for (const p of PRESETS) {
    if (!p.layers[id]) continue;
    out.push({ where: `PRESETS['${p.id}'].name`, text: p.name });
    out.push({ where: `PRESETS['${p.id}'].note`, text: p.note });
  }
  return out.filter((s) => s.text.length > 0);
}

/* ========================================================================== *
 * STANDING DECISION 4 — "The free tier stays genuinely useful."
 *   "Rain, ocean, pink and brown ... are free forever, and the default preset
 *    is free."
 * ========================================================================== */

describe('standing decision 4 — the free tier stays genuinely useful', () => {
  it('keeps exactly the four named layers free forever', () => {
    expect([...FREE_SOUNDS].sort()).toEqual(['brown', 'ocean', 'pink', 'rain']);
    // Two-sided against both directions of erosion: quietly charging for one of
    // the four, and quietly giving away the paid tier.
    expect(FREE_SOUNDS.length).toBe(4);
    expect(SOUND_IDS.length - FREE_SOUNDS.length).toBe(7);
  });

  it('boots into a preset a brand-new user can actually hear, for free', () => {
    // The decision's own words: "and the default preset is free". presets.ts:10
    // records why — "a new user who opens the app to a wall of padlocks decides
    // it is a paywall and leaves".
    const rainfall = getPreset('rainfall');
    expect(rainfall).not.toBeNull();
    const paid = (Object.keys(rainfall?.layers ?? {}) as SoundId[]).filter(
      (id) => !FREE_SOUNDS.includes(id),
    );
    expect(
      paid,
      `the default preset enables paid layers (${paid.join(', ')}) — a new user opens the app to ` +
        'padlocks, which standing decision 4 exists to prevent',
    ).toEqual([]);
  });

  it('keeps more than one all-free preset, so the free tier is a tier and not a sample', () => {
    const allFree = PRESETS.filter((p) =>
      (Object.keys(p.layers) as SoundId[]).every((id) => FREE_SOUNDS.includes(id)),
    );
    expect(allFree.length, 'fewer than two all-free presets').toBeGreaterThanOrEqual(2);
    expect(allFree.length).toBeLessThanOrEqual(PRESETS.length);
  });

  /**
   * NOT ASSERTED, AND THIS IS DELIBERATE.
   *
   * Standing decision 4 also calls the free four "the four with the strongest
   * evidence". I am not turning that into a test, and it should not become one.
   * The Research Lead has demoted pink noise from Strong to Moderate on 2026
   * evidence, which makes the `Strong` set rain, ocean and fire — so the
   * sentence is now false, and they have vetoed the same claim where it appears
   * on the paywall. Their ruling on the fix is the part that matters here: "the
   * sentence broke because it hard-coded a ranking into copy. Do not replace one
   * ranking claim with another." A test asserting the ranking would be doing
   * exactly that, in a place that is even harder to change. The free SET is the
   * stable commitment; the ranking is not.
   */
});

/* ========================================================================== *
 * STANDING DECISION 6 — "We do not over-claim."
 *   "Deep Pulse is an open-loop approximation and is labelled experimental.
 *    Binaural is badged Emerging and requires headphones."
 *
 * Stated more sharply in two other places that say the same thing:
 *   HANDOFF.md:268          "Do not let anyone describe 'Deep Pulse' as
 *                            slow-wave enhancement"
 *   deeppulse.ts:16          "Do not let it be described as slow-wave
 *                            enhancement."
 * ========================================================================== */

describe('standing decision 6 — we do not over-claim', () => {
  it('labels Deep Pulse experimental wherever it is described', () => {
    // GREEN today, and it must stay green through the copy change. Checked
    // against the Research Lead's replacement string, which front-loads it.
    const claim = EVIDENCE.deeppulse.claim ?? '';
    expect(claim.toLowerCase(), 'Deep Pulse is described without the word Experimental').toContain(
      'experimental',
    );
  });

  it('badges binaural Emerging and says headphones are required', () => {
    // The decision names this one verbatim, so it is asserted verbatim.
    expect(EVIDENCE.binaural.badge).toBe('Emerging');
    const binauralCopy = `${EVIDENCE.binaural.claim ?? ''} ${EVIDENCE.binaural.detail ?? ''}`;
    expect(binauralCopy.toLowerCase()).toContain('headphone');
  });

  it('never describes Deep Pulse as slow-wave enhancement', () => {
    /* ---------------------- EXPECTED RED. READ THIS. ----------------------
     * This is the assertion the whole file exists for, and it currently FAILS
     * at two sites. That is correct and it must not be softened.
     *
     * WHY THE SCAN EXCLUDES `detail`, which is not an oversight:
     * `EVIDENCE.deeppulse.detail` contains "increased slow-wave and spindle
     * activity", describing what Papalambros 2017 measured. That is an accurate
     * report of a cited study, not a claim about our product, and the Research
     * Lead explicitly declined to veto a comparable case — README.md — warning
     * that "a veto that fires on every grep hit is a veto nobody routes around
     * me, and this role is worth nothing the moment it becomes a string
     * filter." A test that flagged the detail field would be exactly that. The
     * prohibition is on describing OUR LAYER as slow-wave enhancement, so the
     * scan covers the surfaces that describe the layer: title, claim, and the
     * name and note of any preset that enables it.
     * -------------------------------------------------------------------- */
    const BANNED = /slow[-\s]?wave\s+enhancement/i;

    const offenders = claimSurfacesFor('deeppulse').filter((s) => BANNED.test(s.text));

    expect(
      offenders.map((o) => `${o.where}: ${JSON.stringify(o.text)}`),
      'Deep Pulse is described as slow-wave enhancement on a user-facing surface. This breaches a ' +
        'standing product decision recorded in three places (team/README.md decision 6, ' +
        'HANDOFF.md:268, src/audio/layers/deeppulse.ts:16). Quietloom has no EEG and cannot ' +
        'phase-lock, so the claim is not ours to make. The Research Lead has issued replacement ' +
        'copy; it has not landed. Fix the copy in src/data/** — do NOT weaken this assertion.',
    ).toEqual([]);
  });

  it('front-loads the caveat so the claim stays honest when truncated', () => {
    /* ALSO EXPECTED RED, same root cause, same one-line fix.
     *
     * The Research Lead's rule R10, issued tonight, and their words for how to
     * check it: "This is a substring test, not a human read." Every surface
     * money touches truncates — a Play listing card, a paywall bullet, a shared
     * link — and today's copy puts "Experimental." eleven words past the fold,
     * so the excerpt a reader actually sees is
     *   "Deep Pulse: rhythmic pink-noise pulses modelled on a slow-wa"
     * which is the unqualified claim on its own. The replacement copy opens
     * with "Experimental." and passes this at index 0.
     */
    const HEAD = 60;
    const claim = EVIDENCE.deeppulse.claim ?? '';
    const at = claim.toLowerCase().indexOf('experimental');

    expect(at, 'Deep Pulse claim does not say Experimental at all').toBeGreaterThanOrEqual(0);
    expect(
      at,
      `The qualifier sits at character ${at} of ${claim.length}, past a ${HEAD}-character cut. ` +
        `Truncated, a reader sees: ${JSON.stringify(claim.slice(0, HEAD))} — an unqualified claim. ` +
        'Qualifiers come first, never last.',
    ).toBeLessThan(HEAD);
  });

  it('says out loud, somewhere a user can read it, that we have no EEG', () => {
    // The substance of "open-loop approximation": the honest version of this
    // layer is that the study used live EEG to time every pulse and we cannot.
    // GREEN today via the detail field, and green under the replacement copy
    // too. Kept separate from the banned-phrase check so that a future rewrite
    // cannot quietly drop the admission while satisfying the regex.
    const copy = `${EVIDENCE.deeppulse.claim ?? ''} ${EVIDENCE.deeppulse.detail ?? ''}`.toLowerCase();
    expect(copy).toMatch(/open.loop/);
    expect(copy, 'nothing tells the user we cannot phase-lock').toMatch(/eeg|phase.lock/);
  });
});
