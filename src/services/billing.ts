/**
 * Play Billing — scaffold only.
 *
 * Real in-app purchases require a Google Play Console account, a signed AAB
 * uploaded to a track, and an ACTIVE in-app product. None of that exists yet,
 * so this module reports itself unavailable and the UI is expected to show
 * "coming soon" rather than a broken buy button.
 *
 * The shape below is deliberately the shape the real implementation will have,
 * so wiring react-native-iap later is a small, obvious diff. Look for
 * TODO(billing) — those three blocks are the whole job.
 *
 * Public API (FROZEN CONTRACT):
 *   Billing.PRODUCT_ID       -> string
 *   Billing.PRICE_DISPLAY    -> string
 *   Billing.init()           -> Promise<void>
 *   Billing.isAvailable()    -> boolean
 *   Billing.purchasePremium()-> Promise<{ok, reason?, productId?}>
 *   Billing.restore()        -> Promise<{ok, reason?}>
 */

import { Entitlements } from './entitlements';
import { bus } from '../core/bus';

/** Every failure reason the UI may receive. Keep this list closed. */
export const BILLING_REASONS = {
  UNAVAILABLE: 'unavailable', // no store on this build/platform
  CANCELLED: 'cancelled', // user backed out of the sheet
  ALREADY_OWNED: 'already-owned', // treat as success upstream
  NOTHING_TO_RESTORE: 'nothing-to-restore',
  ERROR: 'error',
} as const;

export type BillingReason = (typeof BILLING_REASONS)[keyof typeof BILLING_REASONS];

export interface BillingResult {
  ok: boolean;
  reason?: BillingReason;
  productId?: string;
}

/**
 * Flipped to true by TODO(billing) 1 once react-native-iap is wired AND its
 * connection is initialised (react-native-iap has no persistent store object
 * to hold, unlike cordova-plugin-purchase — a boolean is the honest analogue).
 */
let connected = false;
let ready = false;

export const Billing = {
  /** Must match the product ID created in the Play Console, exactly. */
  PRODUCT_ID: 'quietloom_premium_forever',

  /**
   * Shown in the paywall. Once billing is live, replace this at runtime with
   * the localised price the store reports — never hardcode currency in UI.
   */
  PRICE_DISPLAY: '$4.99',

  /**
   * Safe to call at boot on any platform. Currently resolves immediately
   * having done nothing.
   */
  async init(): Promise<void> {
    if (ready) return;
    ready = true;

    /* ------------------------------------------------------------------ *
     * TODO(billing) 1 of 3 — INITIALISE
     *
     * npx expo install react-native-iap
     * (react-native-iap is the RN equivalent of cordova-plugin-purchase. It
     * contains native code, so a fresh dev build is required — Expo Go will
     * not run it.)
     *
     * Then replace this comment with:
     *
     *   const { Native } = await import('./native');
     *   if (!Native.isNative()) return;
     *   try {
     *     const {
     *       initConnection,
     *       getProducts,
     *       purchaseUpdatedListener,
     *       purchaseErrorListener,
     *       finishTransaction,
     *     } = await import('react-native-iap');
     *
     *     await initConnection();
     *
     *     // Fires for new purchases AND for pending ones replayed at boot.
     *     purchaseUpdatedListener(async (purchase) => {
     *       // Verify server-side when a backend exists; the verified purchase
     *       // is what flips the entitlement.
     *       Entitlements.setPremium(true);
     *       // Non-consumable: acknowledge, never consume. An unacknowledged
     *       // purchase is auto-refunded by Play after 3 days.
     *       await finishTransaction({ purchase, isConsumable: false });
     *       bus.emit('entitlements:changed', {});
     *     });
     *     purchaseErrorListener((err) => console.warn('[billing]', err));
     *
     *     const [p] = await getProducts({ skus: [Billing.PRODUCT_ID] });
     *     if (p?.localizedPrice) Billing.PRICE_DISPLAY = p.localizedPrice;
     *
     *     connected = true;
     *   } catch (err) {
     *     console.warn('[billing] init failed — staying unavailable', err);
     *     connected = false;
     *   }
     * ------------------------------------------------------------------ */
  },

  /**
   * False until a real store is wired AND initialised. The UI must branch on
   * this and show "coming soon" rather than a dead button.
   */
  isAvailable(): boolean {
    return connected;
  },

  async purchasePremium(): Promise<BillingResult> {
    if (Entitlements.isPremium()) {
      return { ok: true, reason: BILLING_REASONS.ALREADY_OWNED, productId: this.PRODUCT_ID };
    }

    if (!this.isAvailable()) {
      return { ok: false, reason: BILLING_REASONS.UNAVAILABLE };
    }

    /* ------------------------------------------------------------------ *
     * TODO(billing) 2 of 3 — PURCHASE
     *
     *   try {
     *     const { requestPurchase, ErrorCode } = await import('react-native-iap');
     *
     *     // Opens the Play purchase sheet. The result arrives through the
     *     // purchaseUpdatedListener registered in init() — THAT is what flips
     *     // Entitlements.setPremium(true), not this call.
     *     await requestPurchase({
     *       skus: [Billing.PRODUCT_ID], // android; ios takes { sku: ... }
     *       andDangerouslyFinishTransactionAutomaticallyIOS: false,
     *     });
     *     return { ok: true, productId: Billing.PRODUCT_ID };
     *   } catch (err) {
     *     const cancelled = err?.code === 'E_USER_CANCELLED';
     *     if (!cancelled) console.warn('[billing] purchase failed', err);
     *     return { ok: false, reason: cancelled ? BILLING_REASONS.CANCELLED
     *                                           : BILLING_REASONS.ERROR };
     *   }
     * ------------------------------------------------------------------ */

    return { ok: false, reason: BILLING_REASONS.UNAVAILABLE };
  },

  /**
   * "Restore purchases" — required by Play policy once IAP ships, and the
   * first thing a user who reinstalls will look for.
   */
  async restore(): Promise<BillingResult> {
    if (!this.isAvailable()) {
      return { ok: false, reason: BILLING_REASONS.UNAVAILABLE };
    }

    /* ------------------------------------------------------------------ *
     * TODO(billing) 3 of 3 — RESTORE
     *
     *   try {
     *     const { getAvailablePurchases } = await import('react-native-iap');
     *
     *     // For a non-consumable, "restore" is just re-reading ownership.
     *     const purchases = await getAvailablePurchases();
     *     const owned = purchases.some((p) => p.productId === Billing.PRODUCT_ID);
     *     if (owned) {
     *       Entitlements.setPremium(true);
     *       return { ok: true };
     *     }
     *     return { ok: false, reason: BILLING_REASONS.NOTHING_TO_RESTORE };
     *   } catch (err) {
     *     console.warn('[billing] restore failed', err);
     *     return { ok: false, reason: BILLING_REASONS.ERROR };
     *   }
     * ------------------------------------------------------------------ */

    return { ok: false, reason: BILLING_REASONS.UNAVAILABLE };
  },

  /**
   * DEV ONLY — flips the premium entitlement locally so the premium UI path
   * (no banner, no interstitial, everything unlocked) can be demoed without a
   * Play Console. This grants nothing on any server and survives only in
   * AsyncStorage.
   *
   * Reachable from a connected debugger via the __DEV__-gated global below:
   *     globalThis.__quietloom.grantPremium(true)
   */
  __grantPremiumForTesting(on = true): boolean {
    Entitlements.setPremium(!!on);
    bus.emit('entitlements:changed', {});
    console.warn('[billing] DEV: premium set to', !!on);
    return Entitlements.isPremium();
  },
};

/*
 * Dev handle so premium can be toggled from a connected debugger console.
 *
 * Gated on __DEV__, React Native's COMPILE-TIME flag: Metro/Babel replaces it
 * with the literal `false` in a release build, so the whole block is dead code
 * and gets dropped by the minifier — exactly what `import.meta.env.DEV` did
 * under Vite in the web build. That matters: anyone who can attach a debugger
 * or adb to a release APK could otherwise call this and take every paid layer
 * for free, permanently. A comment saying "delete before release" would not
 * have survived a busy week; a compile-time gate does not need remembering.
 */
interface QuietloomDevHandle {
  grantPremium?: (on?: boolean) => boolean;
}

if (__DEV__) {
  const g = globalThis as typeof globalThis & { __quietloom?: QuietloomDevHandle };
  g.__quietloom = g.__quietloom ?? {};
  g.__quietloom.grantPremium = (on = true) => Billing.__grantPremiumForTesting(on);
}
