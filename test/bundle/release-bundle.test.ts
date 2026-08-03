/**
 * EXEMPLAR 3 of 3 — the build-output tier. `npm run test:bundle`.
 *
 * Proves: test tooling CAN assert on the shipping artifact, turning an open
 * ship blocker into an automated gate instead of a paragraph in BUSINESS.md
 * that everyone has read and nobody can enforce.
 *
 * NOT part of `npm test`; see the header of vitest.bundle.config.mts for why.
 *
 * EXPECTED STATE ON LANDING: RED, in substance. `__grantPremiumForTesting` is a
 * property of an exported object literal and sits outside the `__DEV__` gate
 * (src/services/billing.ts:197), so it survives into release. That is the
 * defect; this file is the alarm, not the cause. Do not make it green by
 * weakening the assertion — the fix is in src/services/**, owned elsewhere.
 *
 * DESIGN NOTE — why there is no bare `return` in this file.
 * An earlier revision guarded with `if (!found.length) return;`. In Vitest an
 * early return is a PASS, not a skip: with no release bundle on disk the suite
 * went green having read nothing at all. That is the exact failure class this
 * task exists to prevent, sitting inside the tool meant to prevent it. Caught
 * in review by QA via the Software Team Lead. Two changes fix it for good:
 *   1. A missing artifact now THROWS with an actionable message.
 *   2. A positive control asserts the scanner finds a string known to be in
 *      every Metro release bundle. If the scanner ever silently reads nothing —
 *      wrong path, empty file, bad decoding — the control goes red instead of
 *      the whole suite going quietly, uselessly green.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Symbols that must never reach a user's phone. Each is a real dev-only
 * affordance.
 */
const FORBIDDEN = [
  '__grantPremiumForTesting',
  '__quietloom',
  '__resetInterstitialDay',
  '[billing] DEV:',
] as const;

/**
 * POSITIVE CONTROL — two independent proofs that we are reading the real thing.
 *
 * NOTE, and this surprised me: `index.android.bundle` in a RELEASE build is not
 * JavaScript. Gradle has already run `hermesc`, so it is Hermes BYTECODE. The
 * first revision of this control looked for `__d(` (Metro's module-define) and
 * could not find it — correctly, because the JS syntax is compiled away. Only
 * the bytecode STRING TABLE survives, which is exactly why the forbidden
 * symbols below are still greppable, and why finding them here means they are
 * in the shipped artifact rather than in some intermediate.
 *
 * So: check the Hermes file magic, and check a string-table entry that any
 * React Native app must contain.
 */
const HERMES_MAGIC = [0xc6, 0x1f, 0xbc, 0x03, 0xc1, 0x03, 0x19, 0x1f];
const SENTINEL = 'AppRegistry';

/** Release artifacts (Hermes bytecode), most authoritative first. */
const CANDIDATES = [
  'android/app/build/generated/assets/react/release/index.android.bundle',
  'android/app/build/intermediates/assets/release/mergeReleaseAssets/index.android.bundle',
];

const HOW_TO_BUILD =
  'No release bundle found on disk. Build one with `npm run apk:release` and re-run.\n' +
  'Looked in:\n  ' +
  CANDIDATES.join('\n  ') +
  '\nThis FAILS rather than skips on purpose: a green run against an artifact that ' +
  'does not exist would assert nothing while looking like proof.';

/** Absolute paths of every release artifact that exists. Never returns empty. */
function requireArtifacts(): string[] {
  const found = CANDIDATES.map((rel) => path.join(ROOT, rel)).filter((abs) => {
    try {
      return statSync(abs).isFile();
    } catch {
      return false;
    }
  });
  if (found.length === 0) throw new Error(HOW_TO_BUILD);
  return found;
}

/** Newest mtime across the sources that end up in the bundle. */
function newestSourceMtime(): number {
  let newest = 0;
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else newest = Math.max(newest, statSync(p).mtimeMs);
    }
  };
  walk(path.join(ROOT, 'src'));
  for (const f of ['App.tsx', 'index.ts']) {
    try {
      newest = Math.max(newest, statSync(path.join(ROOT, f)).mtimeMs);
    } catch {
      /* ignore */
    }
  }
  return newest;
}

/** latin1 so 1 char === 1 byte and reported offsets are true file byte offsets. */
const readBundle = (abs: string): string => readFileSync(abs, 'latin1');

describe('release bundle', () => {
  it('exists on disk, or says exactly how to build one', () => {
    expect(requireArtifacts().length).toBeGreaterThan(0);
  });

  it('is actually readable and searchable (positive control)', () => {
    // Without this, "no forbidden symbols" could mean "the scanner is broken".
    for (const abs of requireArtifacts()) {
      const rel = path.relative(ROOT, abs);
      const text = readBundle(abs);

      expect(text.length, `${rel} is suspiciously small`).toBeGreaterThan(1_000_000);

      const magic = [...text.slice(0, 8)].map((c) => c.charCodeAt(0));
      expect(
        magic,
        `${rel} is not Hermes bytecode — its first 8 bytes are not the Hermes magic. ` +
          'Either the build changed shape or we are scanning the wrong file.',
      ).toEqual(HERMES_MAGIC);

      expect(
        text.indexOf(SENTINEL),
        `Sentinel ${JSON.stringify(SENTINEL)} not found in ${rel} — the scanner is not ` +
          'reading a real React Native bundle, so every other assertion in this file ' +
          'is worthless. Fix the scanner before trusting a green run.',
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it('is not older than the source it claims to represent', () => {
    const found = requireArtifacts();
    const bundleMtime = statSync(found[0]).mtimeMs;
    const srcMtime = newestSourceMtime();
    expect(
      bundleMtime,
      `Release bundle is STALE (built ${new Date(bundleMtime).toISOString()}, ` +
        `newest source ${new Date(srcMtime).toISOString()}). Rebuild before trusting this suite.`,
    ).toBeGreaterThan(srcMtime);
  });

  it('contains no dev-only backdoor symbols', () => {
    const hits: string[] = [];
    for (const abs of requireArtifacts()) {
      const text = readBundle(abs);
      for (const needle of FORBIDDEN) {
        const at = text.indexOf(needle);
        if (at >= 0) hits.push(`${path.relative(ROOT, abs)}: "${needle}" at byte offset ${at}`);
      }
    }
    expect(
      hits,
      'Dev-only symbols reached the release bundle. These are shipping to users:\n  ' +
        hits.join('\n  '),
    ).toEqual([]);
  });
});
