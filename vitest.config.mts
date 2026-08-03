/**
 * Unit tier — the fast one. `npm test` runs this and nothing else.
 *
 * WHY VITEST AND NOT jest-expo
 * See tasks/tests.md. The short version: jest-expo requires a project-level
 * babel config, and `@expo/metro-config/build/loadBabelConfig.js` changes what
 * Metro feeds Babel the moment one exists. Vitest transforms TypeScript with
 * esbuild and needs no Babel config at all, so Metro's input is untouched.
 *
 * This config file is invisible to Metro: Metro bundles the import graph
 * reachable from `index.ts`, and nothing here is reachable from it.
 */
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const mock = (p: string) => fileURLToPath(new URL(`./__mocks__/${p}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // src/core/store.ts value-imports AsyncStorage, which is a native module
      // and cannot load in Node. Everything that persists state sits behind it.
      {
        find: '@react-native-async-storage/async-storage',
        replacement: mock('async-storage.ts'),
      },
      // `react-native` ITSELF is stubbed, not walled. It was inside the wall
      // pattern below, and that one entry made the whole of src/services/**
      // unreachable — the grace rule included, which is the worst bug history
      // in this repository. The surface src/ actually uses is seven named
      // imports across five files (Platform, TurboModuleRegistry, AppState,
      // BackHandler, Linking, PixelRatio, AccessibilityInfo), none of them a
      // renderer, so a small working stub is affordable and strictly more
      // useful than an error. This follows the wall's own closing advice.
      // ORDER MATTERS: Vite takes the FIRST matching alias, so this and the
      // ads SDK below must stay above the wall pattern.
      { find: /^react-native$/, replacement: mock('react-native.ts') },
      // The ad SDK. package.json excludes it from autolinking, so ads.ts's lazy
      // `await import()` has never resolved on any machine and showRewarded()'s
      // state machine has never run end to end. A working fake ad NETWORK, not
      // a spy — see the file header for what it deliberately does not prove.
      { find: /^react-native-google-mobile-ads$/, replacement: mock('google-mobile-ads.ts') },
      // Modules that CANNOT work in this tier. Aliased to a wall that explains
      // itself, because the raw failure is `RolldownError: Flow is not
      // supported` pointing into node_modules, which helps nobody. See the
      // stub for the full rationale and the three ways forward.
      // Matches `react-native/...` and every `react-native-*` package, plus
      // Skia. Does NOT match `@react-native-async-storage/...`, which is
      // stubbed for real above (it starts with `@`), nor bare `react-native`
      // nor the ads SDK, both stubbed for real immediately above.
      {
        // NOTE the trailing `.*$`, which is load-bearing. With a RegExp `find`,
        // Vite replaces only the MATCHED PORTION of the specifier. Without it,
        // `react-native-audio-api` matched just `react-native-` and resolved to
        // `<mock path>audio-api`, producing "Cannot find package" instead of the
        // wall. Only the exact `react-native` case worked. Caught by wave 2's
        // test/ui/hooks.test.ts. The match must span the whole specifier.
        find: /^(?:react-native(?:$|[-/])|@shopify\/react-native-skia).*$/,
        replacement: mock('unsupported-in-unit-tier.ts'),
      },
    ],
  },
  test: {
    name: 'unit',
    // Pure-logic tier only. No renderer, no native modules, no device.
    //
    // Wave 2 mirrors the source tree — ownership follows the SOURCE, not the
    // folder (tasks/tests.md, Team Lead + CEO ruling 4) — so the mirror folders
    // are listed here explicitly. This is a WHITELIST on purpose: `test/**` would
    // swallow test/bundle/**, which is `npm run test:bundle`, needs a release
    // build, and is deliberately red. It must never be pulled into `npm test`.
    // Widened by Senior Frontend for test/core/frameClock.test.ts; disclosed in
    // the log and routed to Senior Platform, who owns this file.
    include: [
      'test/unit/**/*.test.ts',
      'test/core/**/*.test.ts',
      'test/scenes/**/*.test.ts',
      'test/ui/**/*.test.ts',
      'test/audio/**/*.test.ts',
      'test/services/**/*.test.ts',
      'test/data/**/*.test.ts',
    ],
    environment: 'node',
    // Module-level singletons (src/ui/layers.ts, src/core/store.ts's cache) mean
    // state leaks between files unless each file gets a fresh module registry.
    isolate: true,
    // Keep the failure output honest and short.
    reporters: process.env.CI ? ['default'] : ['dot'],
  },
});
