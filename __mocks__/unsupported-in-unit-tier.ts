/**
 * A deliberate wall, not an oversight.
 *
 * The unit tier (`npm test`) is a PURE-LOGIC tier. It transforms TypeScript
 * with esbuild and runs no Babel, which means it cannot parse React Native's
 * Flow-typed source, and it has no renderer and no native modules.
 *
 * Without this file, importing `react-native` from a unit test fails with:
 *
 *     RolldownError: Parse failure: Flow is not supported
 *     At file: /node_modules/react-native/index.js:1:0
 *
 * — which is true but tells you nothing about what to do. A probe test hit
 * exactly that during wave 1, and with four engineers writing tests in parallel
 * across four slices it would have been hit four more times. So the modules
 * that cannot work here are aliased to this file, which explains itself.
 *
 * Nothing is broken. You have simply reached the edge of this tier.
 */

const MESSAGE = `
──────────────────────────────────────────────────────────────────────────────
  This module cannot be imported from the unit tier (\`npm test\`).

  You imported a React Native / native module — one of:
      react-native, @shopify/react-native-skia, react-native-audio-api,
      react-native-reanimated, react-native-gesture-handler, react-native-svg

  WHY: the unit tier runs esbuild with NO Babel, so RN's Flow-typed source
  cannot be parsed, and there is no renderer and no native runtime. This was a
  deliberate harness decision — adding Babel would mean adding a project
  babel.config.js, which changes what Metro feeds the SHIPPING app bundle.
  See tasks/tests.md, Senior Platform Engineer entries.

  WHAT TO DO — pick one:

  1. TEST THE LOGIC, NOT THE COMPONENT. Most of this repo's risk is in plain
     TypeScript. These reach the unit tier today with zero mocks:
        src/types.ts            src/core/bus.ts         src/core/timer.ts
        src/data/presets.ts     src/data/evidence.ts    src/ui/mixState.ts
        src/ui/layers.ts        src/ui/sheets.ts        src/audio/scheduler.ts
        src/audio/noise.ts      src/audio/onef.ts       src/scenes/types.ts
     (src/services/entitlements.ts + billing.ts work too — AsyncStorage is
     already stubbed in __mocks__/async-storage.ts.)

  2. THE LOGIC IS TRAPPED INSIDE A COMPONENT? Do not mock your way in. Ask for
     the seam in your log entry and let it be routed — that is the documented
     process in tasks/tests.md. Extracting a pure function is usually a 4-line
     change and makes the logic testable forever.

  3. YOU GENUINELY NEED TO RENDER. That is the component tier. It does not
     exist yet, on purpose, and standing it up is a decision with a bundle-risk
     cost — not something to add mid-slice. Raise it with the CEO.

  If you need a native module STUBBED rather than walled off, add it to
  __mocks__/ and alias it in vitest.config.mts — that is how AsyncStorage works.
──────────────────────────────────────────────────────────────────────────────
`;

throw new Error(MESSAGE);
