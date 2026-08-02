/**
 * Unlock sheet.
 *
 * Two ways in:
 *   1. Watch a short video  -> Ads.showRewarded() -> night pass until 11am.
 *   2. Premium forever      -> Billing.purchasePremium().
 *
 * GRACE RULE (deliberate, do not "fix"): if the rewarded ad returns false AND
 * ads are not actually available, we grant the pass anyway. Nobody gets locked
 * out of falling asleep because an ad server was slow.
 */

import { bus, toast } from '../core/bus.js';
import { Ads } from '../services/ads.js';
import { Billing } from '../services/billing.js';
import { Entitlements } from '../services/entitlements.js';
import { EVIDENCE } from '../data/evidence.js';
import { mountSheet, openSheet, closeSheet, sheetHeader, el, isSheetOpen } from './sheet.js';

const SHEET_ID = 'unlock-sheet';

let body = null;
let busy = false;
let pendingContext = null;

export function initPaywall() {
  body = mountSheet(SHEET_ID, { label: 'Unlock all sounds' });
  bus.on('entitlements:changed', () => {
    if (isSheetOpen(SHEET_ID)) render();
  });
}

/**
 * @param {{reason?:string, lockedIds?:string[]}} ctx
 */
export function openPaywall(ctx = {}) {
  if (!body) initPaywall();
  if (!body) return;
  pendingContext = ctx;
  render();
  openSheet(SHEET_ID);
}

export function closePaywall() {
  closeSheet(SHEET_ID);
}

function expiryLabel() {
  const d = Entitlements.nightPassExpiry();
  if (!d) return '';
  try {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '11:00';
  }
}

function lockedNames(ids) {
  return (ids || [])
    .map((id) => EVIDENCE[id]?.title || id)
    .filter(Boolean)
    .join(', ');
}

function render() {
  const ctx = pendingContext || {};
  body.textContent = '';

  const premium = Entitlements.isPremium();
  const pass = !premium && Entitlements.hasNightPass();

  body.append(
    sheetHeader(premium ? 'Premium is active' : 'Unlock every layer', {
      eyebrow: premium ? 'Thank you' : 'Four layers are always free',
      onClose: () => closeSheet(SHEET_ID),
    }),
  );

  if (premium) {
    body.append(
      el('p', 'evidence-claim', 'You have every sound, every scene, forever. No ads. Sleep well.'),
    );
    body.append(restoreRow());
    return;
  }

  if (ctx.lockedIds?.length) {
    body.append(
      el(
        'p',
        'paywall-context',
        `${lockedNames(ctx.lockedIds)} ${ctx.lockedIds.length > 1 ? 'are' : 'is'} part of the full library.`,
      ),
    );
  } else if (ctx.reason) {
    body.append(el('p', 'paywall-context', ctx.reason));
  }

  if (pass) {
    body.append(
      el('p', 'paywall-active', `Your night pass is active until ${expiryLabel()}. Everything is unlocked.`),
    );
  }

  /* ---- option 1: rewarded video ---- */
  const optA = el('button', 'unlock-option primary');
  optA.type = 'button';
  optA.append(el('span', 'unlock-title', pass ? 'Extend tonight — watch a short video' : 'Unlock tonight'));
  optA.append(el('span', 'unlock-sub', 'Watch a short video. Everything opens until 11am tomorrow.'));
  optA.append(el('span', 'unlock-price', 'Free'));
  optA.addEventListener('click', () => runRewarded(optA));
  body.append(optA);

  /* ---- option 2: premium forever ---- */
  const price = Billing.PRICE_DISPLAY || '$4.99';
  const optB = el('button', 'unlock-option');
  optB.type = 'button';
  optB.append(el('span', 'unlock-title', 'Premium forever'));
  optB.append(el('span', 'unlock-sub', 'Every layer, every scene, no ads, no timer on the unlock. One payment.'));
  optB.append(el('span', 'unlock-price', price));
  optB.addEventListener('click', () => runPurchase(optB));
  body.append(optB);

  const status = el('p', 'unlock-status');
  status.id = 'unlock-status';
  body.append(status);

  body.append(
    el(
      'p',
      'unlock-foot',
      'Rain, Ocean, Pink noise and Brown noise stay free forever — those are the four with the strongest evidence behind them. The paid layers are extras, not the product.',
    ),
  );

  body.append(restoreRow());
}

function restoreRow() {
  const row = el('div', 'unlock-restore');
  const b = el('button', 'link-btn', 'Restore a previous purchase');
  b.type = 'button';
  b.addEventListener('click', async () => {
    setStatus('Checking…');
    let res = null;
    try {
      res = await Billing.restore();
    } catch {
      res = null;
    }
    if (res?.ok) {
      Entitlements.setPremium(true);
      toast('Premium restored');
      closeSheet(SHEET_ID);
    } else {
      setStatus('Nothing to restore on this device yet.');
    }
  });
  row.append(b);
  return row;
}

function setStatus(msg) {
  const n = body?.querySelector('#unlock-status');
  if (n) n.textContent = msg;
}

async function runRewarded(btn) {
  if (busy) return;
  busy = true;
  btn.classList.add('is-busy');
  btn.disabled = true;
  setStatus('Loading a short video…');

  let earned = false;
  try {
    earned = (await Ads.showRewarded()) === true;
  } catch (err) {
    console.warn('[paywall] rewarded failed', err);
    earned = false;
  }

  let available = false;
  try {
    available = Ads.isAvailable() === true;
  } catch {
    available = false;
  }

  // THE GRACE RULE — an ad that never loaded is not a decline.
  if (!earned && !available) earned = true;

  busy = false;
  btn.classList.remove('is-busy');
  btn.disabled = false;

  if (earned) {
    Entitlements.grantNightPass();
    toast(`Unlocked until ${expiryLabel() || '11am'}`);
    closeSheet(SHEET_ID);
  } else {
    setStatus('No reward earned that time. You can try again.');
  }
}

async function runPurchase(btn) {
  if (busy) return;

  let available = false;
  try {
    available = Billing.isAvailable() === true;
  } catch {
    available = false;
  }

  if (!available) {
    setStatus('Coming soon — the free unlock works tonight.');
    return;
  }

  busy = true;
  btn.classList.add('is-busy');
  btn.disabled = true;
  setStatus('Opening Google Play…');

  let res = null;
  try {
    res = await Billing.purchasePremium();
  } catch (err) {
    console.warn('[paywall] purchase failed', err);
    res = null;
  }

  busy = false;
  btn.classList.remove('is-busy');
  btn.disabled = false;

  if (res?.ok) {
    Entitlements.setPremium(true);
    toast('Premium unlocked. Thank you.');
    closeSheet(SHEET_ID);
  } else if (res?.reason === 'cancelled') {
    setStatus('Purchase cancelled.');
  } else {
    setStatus('Coming soon — the free unlock works tonight.');
  }
}
