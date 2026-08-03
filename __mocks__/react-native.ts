/**
 * Test stub for `react-native` itself.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT THE WALL
 * `__mocks__/unsupported-in-unit-tier.ts` walls off the modules that genuinely
 * cannot work in a Node, no-Babel, no-renderer tier: Skia, audio-api,
 * reanimated, gesture-handler, svg. `react-native` was in that list too, and
 * that was one module too many — it made the whole of `src/services/**`
 * unreachable, including the grace rule, which has the worst bug history in
 * this repository.
 *
 * The wall's own closing line is the instruction being followed here: "If you
 * need a native module STUBBED rather than walled off, add it to __mocks__/ and
 * alias it in vitest.config.mts — that is how AsyncStorage works."
 *
 * That is affordable because the surface `src/` actually uses is tiny — five
 * files, seven named imports, measured by grep:
 *   services/ads.ts     Platform, TurboModuleRegistry
 *   services/native.ts  AppState, BackHandler, Linking, Platform
 *   audio/engine.ts     AppState
 *   scenes/renderer.ts  AccessibilityInfo, PixelRatio
 *   scenes/moonrise.ts  PixelRatio
 * All seven are stubbed below. None of them is a renderer, and none of them is
 * DSP, so none of them can launder a green result the way a silent audio mock
 * can (see QA's trap 3 in tasks/tests.md).
 *
 * IF YOU IMPORT A NAME THAT IS NOT HERE you get
 *   SyntaxError: The requested module ... does not provide an export named 'X'
 * naming the exact export. That is a loud, actionable failure — add the export.
 * What you must NOT do is stub a *renderer* here. Components are the component
 * tier; it does not exist yet, on purpose.
 *
 * NOTHING HERE IS A SPY. Every stub is a small working implementation, so tests
 * assert outcomes and never "X was called" (CEO lead 5).
 *
 * Wired in by `resolve.alias` in vitest.config.mts. Metro never sees this file.
 */

export type PlatformOS = 'android' | 'ios' | 'web' | 'windows' | 'macos';

let currentOS: PlatformOS = 'android';
const turboModules = new Map<string, unknown>();
const appStateListeners = new Set<(state: string) => void>();
let appState = 'active';

/* ------------------------------------------------------- test-only controls */

/**
 * Choose the platform under test. 'android' | 'ios' are the native platforms;
 * anything else is the off-device path every service must survive.
 */
export function __setPlatformOS(next: PlatformOS): void {
  currentOS = next;
}

/**
 * Put a native module into the registry, so `TurboModuleRegistry.get(name)`
 * finds it. Absent by default: the honest default for this repo, whose
 * package.json excludes the ads SDK from autolinking entirely.
 */
export function __registerTurboModule(name: string, impl: unknown = {}): void {
  turboModules.set(name, impl);
}

/** Drive an app foreground/background transition. */
export function __setAppState(next: 'active' | 'background' | 'inactive'): void {
  appState = next;
  for (const fn of [...appStateListeners]) fn(next);
}

/** Wipe every control back to its default. Call in beforeEach. */
export function __resetReactNative(): void {
  currentOS = 'android';
  turboModules.clear();
  appStateListeners.clear();
  appState = 'active';
}

/* ------------------------------------------------------------ the RN surface */

export const Platform = {
  get OS(): PlatformOS {
    return currentOS;
  },
  select<T>(spec: Partial<Record<PlatformOS | 'native' | 'default', T>>): T | undefined {
    if (currentOS in spec) return spec[currentOS];
    if (currentOS === 'android' || currentOS === 'ios') {
      if ('native' in spec) return spec.native;
    }
    return spec.default;
  },
};

export const TurboModuleRegistry = {
  /** Non-throwing lookup. Returns null when the module is not in the binary. */
  get<T = unknown>(name: string): T | null {
    return (turboModules.get(name) as T | undefined) ?? null;
  },
  /** Throwing lookup — what a native package calls at module scope. */
  getEnforcing<T = unknown>(name: string): T {
    const mod = turboModules.get(name);
    if (mod == null) {
      throw new Error(
        `Invariant Violation: TurboModuleRegistry.getEnforcing(...): '${name}' could not be found.`,
      );
    }
    return mod as T;
  },
};

export const AppState = {
  get currentState(): string {
    return appState;
  },
  addEventListener(type: string, handler: (state: string) => void): { remove: () => void } {
    if (type !== 'change') return { remove: () => {} };
    appStateListeners.add(handler);
    return {
      remove: () => {
        appStateListeners.delete(handler);
      },
    };
  },
};

export const BackHandler = {
  addEventListener(_type: string, _handler: () => boolean): { remove: () => void } {
    return { remove: () => {} };
  },
  exitApp(): void {},
};

export const Linking = {
  async openURL(_url: string): Promise<void> {},
  async canOpenURL(_url: string): Promise<boolean> {
    return true;
  },
};

export const PixelRatio = {
  get(): number {
    return 2;
  },
  getFontScale(): number {
    return 1;
  },
  roundToNearestPixel(n: number): number {
    return Math.round(n * 2) / 2;
  },
};

export const AccessibilityInfo = {
  async isReduceMotionEnabled(): Promise<boolean> {
    return false;
  },
  addEventListener(_type: string, _handler: (v: boolean) => void): { remove: () => void } {
    return { remove: () => {} };
  },
};
