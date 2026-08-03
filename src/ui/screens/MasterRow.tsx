/**
 * The master volume row, and the only place the nursery-safe cap is enforced
 * in the UI (the engine enforces it again in the audio graph — belt and braces,
 * because this one is a safety ceiling and not a preference).
 */

import React, { useCallback, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { engine } from '../../audio/engine';
import { InfoDot } from '../components/controls';
import { SliderRow } from '../components/SliderRow';
import { useBusEvent, useMasterVolume, useSettings } from '../hooks';
import { openVolumeGuide } from '../sheets/EvidenceSheet';
import { color, radius } from '../theme';

/** Hard ceiling on the master fader when the nursery cap is on. */
export const NURSERY_MAX = 0.45;

/* Module constants, so the slider's props keep a stable identity. */
const fmtLevel = (v: number): string => `${Math.round(v)}`;
const setMaster = (v: number): void => engine.setMasterVolume(v / 100);

function MasterRowBase(): React.JSX.Element {
  const [settings] = useSettings();
  // Subscribed straight to the master volume: a layer slider moving no longer
  // re-renders this row, and this row moving no longer re-renders the mixer.
  const master = useMasterVolume();
  const safe = settings.nurserySafe === true;

  /** Re-reads the nursery-safe setting and hard-caps the fader. */
  const applyCap = useCallback(() => {
    if (typeof engine.setNurserySafe === 'function') {
      try {
        engine.setNurserySafe(safe);
      } catch (err) {
        console.warn('[ui] setNurserySafe failed', err);
      }
    }
    if (safe && engine.getState().master > NURSERY_MAX) engine.setMasterVolume(NURSERY_MAX);
  }, [safe]);

  useEffect(applyCap, [applyCap]);
  useBusEvent('ui:settings', applyCap);

  const max = safe ? Math.round(NURSERY_MAX * 100) : 100;
  const value = Math.min(Math.round(master * 100), max);

  let note: string;
  let noteStyle: { color: string } | null = null;
  if (safe) {
    note =
      'Nursery-safe cap on — output is limited. Keep the phone at least 2 m from the crib (AAP: 50 dB or lower).';
    noteStyle = { color: color.good };
  } else if (master > 0.75) {
    note =
      'That is loud for a bedroom. The WHO suggests staying below 30 dB(A) of continuous sound overnight.';
    noteStyle = { color: color.warn };
  } else {
    note = 'Just loud enough to cover what you are masking — no louder.';
  }

  return (
    <View style={styles.wrap}>
      {/* The guide dot sits over the row's own header, level with the label. */}
      <View style={styles.dot}>
        <InfoDot label="How loud should this be?" onPress={openVolumeGuide} />
      </View>
      <SliderRow
        label="Volume"
        min={0}
        max={max}
        step={1}
        value={value}
        format={fmtLevel}
        onChange={setMaster}
        style={styles.slider}
      />
      <Text style={[styles.note, noteStyle]}>{note}</Text>
    </View>
  );
}

/**
 * Memoised. Everything this row draws now comes from a store it subscribes to
 * itself — the master volume by value, and the nursery-safe setting — so it
 * takes no props at all and a mixer re-render can never drag it along. There
 * is nothing left to compare, which is the point: the value comparison happens
 * in `useMasterVolume`'s store (hooks.ts), not in a prop comparator that a
 * freshly allocated EngineState would defeat.
 */
export const MasterRow = React.memo(MasterRowBase);

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.cardQuiet,
    padding: 14,
    marginTop: 18,
  },
  dot: {
    position: 'absolute',
    top: 10,
    right: 12,
    zIndex: 1,
  },
  slider: {
    marginTop: 0,
    paddingRight: 42,
  },
  note: {
    color: color.ink3,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
});
