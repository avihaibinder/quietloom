/**
 * Unlock sheet.
 *
 * Two ways in:
 *   1. Watch a short video  -> Ads.showRewarded() -> night pass until 11am.
 *   2. Premium forever      -> Billing.purchasePremium().
 *
 * GRACE RULE (deliberate, do not "fix"): the pass is granted unless an ad
 * genuinely played and the user closed it early. No fill, no network, a wedged
 * SDK, a timeout — all of those unlock anyway. Nobody gets locked out of
 * falling asleep because an ad server was having a bad night.
 */

import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { toast } from '../../core/bus';
import { EVIDENCE } from '../../data/evidence';
import { Ads, shouldGrantNightPass } from '../../services/ads';
import type { RewardedFailure } from '../../services/ads';
import { Billing } from '../../services/billing';
import { Entitlements } from '../../services/entitlements';
import type { SoundId } from '../../types';
import { LinkButton } from '../components/controls';
import { Sheet } from '../components/Sheet';
import { SheetHeader } from '../components/SheetHeader';
import { useBusEvent, useSceneAccent, useSheet } from '../hooks';
import { closeSheet, openSheet } from '../sheets';
import { color, radius } from '../theme';

const SHEET_ID = 'unlock' as const;

export interface PaywallContext {
  reason?: string;
  lockedIds?: SoundId[];
}

export function openPaywall(ctx: PaywallContext = {}): void {
  openSheet(SHEET_ID, ctx);
}

export function closePaywall(): void {
  closeSheet(SHEET_ID);
}

function expiryLabel(): string {
  const d = Entitlements.nightPassExpiry();
  if (!d) return '';
  try {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '11:00';
  }
}

function lockedNames(ids: SoundId[] | undefined): string {
  return (ids ?? [])
    .map((id) => EVIDENCE[id]?.title ?? id)
    .filter(Boolean)
    .join(', ');
}

export function PaywallSheet(): React.JSX.Element {
  const { payload } = useSheet(SHEET_ID);
  const ctx = (payload ?? {}) as PaywallContext;
  const accent = useSceneAccent();

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [entVersion, setEntVersion] = useState(0);
  useBusEvent('entitlements:changed', () => setEntVersion((v) => v + 1));
  void entVersion; // the re-render is the point

  const premium = Entitlements.isPremium();
  const pass = !premium && Entitlements.hasNightPass();

  const runRewarded = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setStatus('Loading a short video…');

    let earned = false;
    try {
      earned = (await Ads.showRewarded()) === true;
    } catch (err) {
      console.warn('[paywall] rewarded failed', err);
      earned = false;
    }

    // THE GRACE RULE — an ad that never loaded is not a decline.
    //
    // Branch on why it failed, not on Ads.isAvailable(): the SDK reports itself
    // available as soon as it initialises, which stays true even when the
    // network cannot deliver a single impression. Only a 'declined' outcome
    // means an ad actually played and the user closed it early.
    let reason: RewardedFailure = 'unavailable';
    try {
      reason = Ads.lastRewardedFailure();
    } catch {
      reason = 'unavailable';
    }
    earned = shouldGrantNightPass(earned, reason);

    setBusy(false);

    if (earned) {
      Entitlements.grantNightPass();
      toast(`Unlocked until ${expiryLabel() || '11am'}`);
      closeSheet(SHEET_ID);
    } else {
      setStatus('No reward earned that time. You can try again.');
    }
  }, [busy]);

  const runPurchase = useCallback(async () => {
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

    setBusy(true);
    setStatus('Opening Google Play…');

    let res: { ok: boolean; reason?: string } | null = null;
    try {
      res = await Billing.purchasePremium();
    } catch (err) {
      console.warn('[paywall] purchase failed', err);
      res = null;
    }

    setBusy(false);

    if (res?.ok) {
      Entitlements.setPremium(true);
      toast('Premium unlocked. Thank you.');
      closeSheet(SHEET_ID);
    } else if (res?.reason === 'cancelled') {
      setStatus('Purchase cancelled.');
    } else {
      setStatus('Coming soon — the free unlock works tonight.');
    }
  }, [busy]);

  const restore = useCallback(async () => {
    setStatus('Checking…');
    let res: { ok: boolean } | null = null;
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
  }, []);

  const restoreRow = (
    <View style={styles.restore}>
      <LinkButton onPress={() => void restore()}>Restore a previous purchase</LinkButton>
    </View>
  );

  if (premium) {
    return (
      <Sheet id={SHEET_ID} label="Unlock all sounds">
        <SheetHeader title="Premium is active" eyebrow="Thank you" onClose={closePaywall} />
        <Text style={styles.claim}>
          You have every sound, every scene, forever. No ads. Sleep well.
        </Text>
        {restoreRow}
      </Sheet>
    );
  }

  const price = Billing.PRICE_DISPLAY || '$4.99';

  return (
    <Sheet id={SHEET_ID} label="Unlock all sounds">
      <SheetHeader
        title="Unlock every layer"
        eyebrow="Four layers are always free"
        onClose={closePaywall}
      />

      {ctx.lockedIds?.length ? (
        <Text style={styles.context}>
          {`${lockedNames(ctx.lockedIds)} ${ctx.lockedIds.length > 1 ? 'are' : 'is'} part of the full library.`}
        </Text>
      ) : ctx.reason ? (
        <Text style={styles.context}>{ctx.reason}</Text>
      ) : null}

      {pass ? (
        <Text style={[styles.active, { color: accent.accent }]}>
          {`Your night pass is active until ${expiryLabel()}. Everything is unlocked.`}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void runRewarded()}
        style={({ pressed }) => [
          styles.option,
          { borderColor: accent.accentSoft, backgroundColor: accent.accentSoft },
          pressed ? styles.optionPressed : null,
          busy ? styles.optionBusy : null,
        ]}
      >
        <Text style={styles.optionTitle}>
          {pass ? 'Extend tonight — watch a short video' : 'Unlock tonight'}
        </Text>
        <Text style={styles.optionSub}>
          Watch a short video. Everything opens until 11am tomorrow.
        </Text>
        <Text style={[styles.optionPrice, { color: accent.accent }]}>Free</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void runPurchase()}
        style={({ pressed }) => [
          styles.option,
          pressed ? styles.optionPressed : null,
          busy ? styles.optionBusy : null,
        ]}
      >
        <Text style={styles.optionTitle}>Premium forever</Text>
        <Text style={styles.optionSub}>
          Every layer, every scene, no ads, no timer on the unlock. One payment.
        </Text>
        <Text style={styles.optionPrice}>{price}</Text>
      </Pressable>

      {status ? <Text style={styles.status}>{status}</Text> : null}

      <Text style={styles.foot}>
        Rain, Ocean, Pink noise and Brown noise are free forever. Between them they cover the two
        things the evidence supports best — nature sound for winding down, and steady masking for
        falling asleep. Every layer shows its evidence badge, free or paid.
      </Text>

      {restoreRow}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  claim: {
    color: color.ink,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  context: {
    color: color.ink2,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },
  active: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },
  option: {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.cardQuiet,
    padding: 16,
    marginBottom: 12,
    minHeight: 48,
  },
  optionPressed: {
    opacity: 0.85,
  },
  optionBusy: {
    opacity: 0.6,
  },
  optionTitle: {
    color: color.ink,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionSub: {
    color: color.ink3,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  optionPrice: {
    color: color.ink2,
    fontSize: 13,
    fontWeight: '600',
  },
  status: {
    color: color.ink3,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
    minHeight: 18,
  },
  foot: {
    color: color.ink4,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  restore: {
    alignItems: 'flex-start',
    marginTop: 4,
  },
});
