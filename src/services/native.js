/**
 * STUB — replaced by Agent C.
 * Wraps every Capacitor plugin so the rest of the app never imports one directly.
 */

export const Native = {
  isNative() {
    return false;
  },
  async keepAwake(_on) {},
  async backgroundMode(_on) {},
  async openUrl(url) {
    window.open(url, '_blank', 'noopener');
  },
};
