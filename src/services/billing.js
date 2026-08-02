/**
 * STUB — replaced by Agent C with the scaffold.
 * Real Play Billing needs a Play Console listing, so this degrades to
 * "coming soon" until the owner wires it. See BUSINESS.md.
 */

export const Billing = {
  PRODUCT_ID: 'drift_premium_forever',
  PRICE_DISPLAY: '$4.99',
  async init() {},
  isAvailable() {
    return false;
  },
  async purchasePremium() {
    return { ok: false, reason: 'unavailable' };
  },
  async restore() {
    return { ok: false, reason: 'unavailable' };
  },
};
