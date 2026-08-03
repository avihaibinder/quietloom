/**
 * Build-output tier — deliberately NOT part of `npm test`.
 *
 * This tier asserts on a *built artifact*, so it can only be as truthful as the
 * last build. Three reasons it is a separate command (`npm run test:bundle`):
 *
 *  1. Staleness. A green result against a bundle built before your change means
 *     nothing. The test guards against this explicitly, but the guard is a
 *     reason to run it deliberately, not on every save.
 *  2. It is red today, correctly — `__grantPremiumForTesting` is an open ship
 *     blocker. Wiring a known-red test into `npm test` trains people to ignore
 *     the suite, which is worse than not having it.
 *  3. It needs a release build to exist, which breaks the CEO's "runs in
 *     seconds, offline, no device" rule for the default command.
 *
 * Where it belongs: the release checklist, as a gate before shipping.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'bundle',
    include: ['test/bundle/**/*.test.ts'],
    environment: 'node',
    // Reading and scanning a 3 MB bundle is slower than a unit test.
    testTimeout: 30_000,
  },
});
