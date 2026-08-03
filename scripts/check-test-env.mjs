/**
 * Preflight for `npm test`. Runs as the `pretest` script.
 *
 * WHY THIS EXISTS
 * During wave 1 the harness was reported broken with two errors:
 *   "Vitest failed to find the runner"
 *   "Cannot read properties of undefined (reading 'config')"
 * Neither says what is actually wrong. Both are what Vitest emits when its
 * packages are half-installed or version-skewed — which is what you get if you
 * run `npm test` while someone else's `npm install` is still mutating
 * node_modules, or after a lockfile change without a reinstall.
 *
 * The harness itself was fine. The diagnosis cost was the problem: four
 * engineers are about to run this in parallel across four slices, and a cryptic
 * stack trace sends all four to debug one runner config. This turns that into
 * one line naming the fix.
 *
 * Keep it fast (~50ms) and keep it dependency-free.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** Every package that must be present and at the SAME version as vitest. */
const LOCKSTEP = ['@vitest/runner', '@vitest/expect', '@vitest/spy', '@vitest/utils'];

const problems = [];
let vitestVersion = null;

function versionOf(pkg) {
  try {
    return require(`${pkg}/package.json`).version;
  } catch {
    return null;
  }
}

vitestVersion = versionOf('vitest');
if (!vitestVersion) {
  problems.push('`vitest` is not installed (or not resolvable from the project root).');
} else {
  for (const pkg of LOCKSTEP) {
    const v = versionOf(pkg);
    if (v === null) {
      problems.push(`\`${pkg}\` is missing — vitest ${vitestVersion} cannot run without it.`);
    } else if (v !== vitestVersion) {
      problems.push(`\`${pkg}\` is ${v} but \`vitest\` is ${vitestVersion} — these must match exactly.`);
    }
  }
}

if (problems.length > 0) {
  const lines = [
    '',
    'npm test cannot start: the Vitest install is incomplete or version-skewed.',
    '',
    ...problems.map((p) => `  - ${p}`),
    '',
    'Fix:  npm install',
    '',
    'If you are seeing this while a teammate is mid-`npm install`, just wait for',
    'it to finish and re-run. Nothing is wrong with the tests or your code.',
    '',
  ];
  console.error(lines.join('\n'));
  process.exit(1);
}
