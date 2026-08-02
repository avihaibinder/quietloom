/**
 * Play Billing — scaffold only.
 *
 * Real in-app purchases require a Google Play Console account, a signed AAB
 * uploaded to a track, and an ACTIVE in-app product. None of that exists
 * tonight, so this module reports itself unavailable and the UI is expected to
 * show "coming soon" rather than a broken buy button.
 *
 * The shape below is deliberately the shape the real implementation will have,
 * so wiring cordova-plugin-purchase later is a small, obvious diff. Look for
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

import { Entitlements } from './entitlements.js';
import { bus } from '../core/bus.js';

/** Every failure reason the UI may receive. Keep this list closed. */
export const BILLING_REASONS = {
  UNAVAILABLE: 'unavailable', // no store on this build/platform
  CANCELLED: 'cancelled', // user backed out of the sheet
  ALREADY_OWNED: 'already-owned', // treat as success upstream
  NOTHING_TO_RESTORE: 'nothing-to-restore',
  ERROR: 'error',
};

let store = null; // the cordova-plugin-purchase store, once wired
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
  async init() {
    if (ready) return;
    ready = true;

    /* ------------------------------------------------------------------ *
     * TODO(billing) 1 of 3 — INITIALISE
     *
     * npm i cordova-plugin-purchase@13.18.0 && npx cap sync android
     *
     * Then replace this comment with:
     *
     *   const { Native } = await import('./native.js');
     *   if (!Native.isNative()) return;
     *   try {
     *     store = window.CdvPurchase?.store;
     *     if (!store) return;
     *     const { ProductType, Platform } = window.CdvPurchase;
     *
     *     store.register([{
     *       id: Billing.PRODUCT_ID,
     *       type: ProductType.NON_CONSUMABLE,
     *       platform: Platform.GOOGLE_PLAY,
     *     }]);
     *
     *     store.when()
     *       .approved((tx) => tx.verify())
     *       .verified((receipt) => {
     *         Entitlements.setPremium(true);
     *         receipt.finish();
     *         bus.emit('entitlements:changed', {});
     *       })
     *       .unverified(() => Entitlements.setPremium(false));
     *
     *     store.error((err) => console.warn('[billing]', err));
     *     await store.initialize([Platform.GOOGLE_PLAY]);
     *
     *     const p = store.get(Billing.PRODUCT_ID, Platform.GOOGLE_PLAY);
     *     if (p?.pricing?.price) Billing.PRICE_DISPLAY = p.pricing.price;
     *   } catch (err) {
     *     console.warn('[billing] init failed — staying unavailable', err);
     *     store = null;
     *   }
     *
     * NOTE: cordova-plugin-purchase attaches itself to window (CdvPurchase),
     * it is not an ES module — do not `import` it.
     * ------------------------------------------------------------------ */
  },

  /**
   * False until a real store is wired AND initialised. The UI must branch on
   * this and show "coming soon" rather than a dead button.
   */
  isAvailable() {
    return store !== null;
  },

  /**
   * @returns {Promise<{ok: boolean, reason?: string, productId?: string}>}
   */
  async purchasePremium() {
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
     *     const { Platform } = window.CdvPurchase;
     *     const offer = store.get(Billing.PRODUCT_ID, Platform.GOOGLE_PLAY)?.getOffer();
     *     if (!offer) return { ok: false, reason: BILLING_REASONS.UNAVAILABLE };
     *
     *     const err = await offer.order();
     *     if (err) {
     *       const cancelled = err.code === window.CdvPurchase.ErrorCode.PAYMENT_CANCELLED;
     *       return { ok: false, reason: cancelled ? BILLING_REASONS.CANCELLED
     *                                             : BILLING_REASONS.ERROR };
     *     }
     *     // The .verified() handler registered in init() flips the entitlement.
     *     return { ok: true, productId: Billing.PRODUCT_ID };
     *   } catch (err) {
     *     console.warn('[billing] purchase failed', err);
     *     return { ok: false, reason: BILLING_REASONS.ERROR };
     *   }
     * ------------------------------------------------------------------ */

    return { ok: false, reason: BILLING_REASONS.UNAVAILABLE };
  },

  /**
   * "Restore purchases" — required by Play policy once IAP ships, and the
   * first thing a user who reinstalls will look for.
   *
   * @returns {Promise<{ok: boolean, reason?: string}>}
   */
  async restore() {
    if (!this.isAvailable()) {
      return { ok: false, reason: BILLING_REASONS.UNAVAILABLE };
    }

    /* ------------------------------------------------------------------ *
     * TODO(billing) 3 of 3 — RESTORE
     *
     *   try {
     *     await store.restorePurchases();
     *     const { Platform } = window.CdvPurchase;
     *     const owned = store.get(Billing.PRODUCT_ID, Platform.GOOGLE_PLAY)?.owned;
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
   * (no banner, no interstitial, everything unlocked) can be demoed tonight
   * without a Play Console. This grants nothing on any server and survives
   * only in localStorage.
   *
   * Also reachable from the device via Chrome DevTools / adb as:
   *     window.__quietloom.grantPremium(true)
   *
   * >>> DELETE THIS METHOD, AND THE window.__quietloom BLOCK BELOW, BEFORE ANY <<<
   * >>> PUBLIC RELEASE.                                                    <<<
   *
   * @param {boolean} [on=true]
   */
  __grantPremiumForTesting(on = true) {
    Entitlements.setPremium(!!on);
    bus.emit('entitlements:changed', {});
    console.warn('[billing] DEV: premium set to', !!on);
    return Entitlements.isPremium();
  },
};

/*
 * Dev handle so premium can be toggled from a connected DevTools console.
 *
 * Gated on import.meta.env.DEV, which Vite replaces with the literal `false` in
 * a production build — the whole block is then dead code and gets dropped by the
 * minifier. That matters: anyone who can attach DevTools or adb to a release APK
 * could otherwise call this and take every paid layer for free, permanently.
 * A comment saying "delete before release" would not have survived a busy week.
 */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__quietloom = window.__quietloom || {};
  window.__quietloom.grantPremium = (on = true) => Billing.__grantPremiumForTesting(on);
}
