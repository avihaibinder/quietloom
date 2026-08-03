/**
 * "How loud should this be?" — the feature almost nobody ships.
 * Built from VOLUME_EVIDENCE, plus the Nursery-safe hard cap.
 *
 * Rendered inside the shared evidence sheet (see EvidenceSheet.tsx) so a
 * citation looks the same wherever it appears.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { bus, toast } from '../../core/bus';
import { VOLUME_EVIDENCE } from '../../data/evidence';
import { SwitchPill } from '../components/controls';
import { SheetHeader } from '../components/SheetHeader';
import { useSettings } from '../hooks';
import { closeSheet } from '../sheets';
import { color, radius } from '../theme';
import { SourceList } from './SourceList';

interface Level {
  db: string;
  label: string;
  note: string;
  tone: 'good' | 'mid' | 'warn';
}

const LEVELS: Level[] = [
  {
    db: '30 dB(A)',
    label: 'WHO bedroom target',
    note: 'Continuous sound below this does not disturb sleep architecture.',
    tone: 'good',
  },
  {
    db: '40 dB',
    label: 'Movement and arousals begin',
    note: 'Between 30 and 40 dB you move more without fully waking.',
    tone: 'mid',
  },
  {
    db: '46 dB',
    label: 'The trial that worked',
    note: 'Messineo 2017 cut sleep-onset latency 38% at this level — above the WHO figure. Hence the timer.',
    tone: 'mid',
  },
  {
    db: '50 dB',
    label: 'Infant ceiling',
    note: 'AAP guidance for nursery sound machines. Never at maximum, at least 2 m away.',
    tone: 'warn',
  },
];

const TONE_COLOR: Record<Level['tone'], string> = {
  good: color.good,
  mid: color.ink2,
  warn: color.warn,
};

export function VolumeGuideBody(): React.JSX.Element {
  const [settings, patchSettings] = useSettings();
  const safe = settings.nurserySafe === true;

  return (
    <>
      <SheetHeader
        title={VOLUME_EVIDENCE.title}
        eyebrow="Safe listening"
        onClose={() => closeSheet('evidence')}
      />

      <Text style={styles.claim}>
        Loud enough to mask, quiet enough to sleep through. Those are two different numbers, and the
        gap is why Quietloom turns itself off.
      </Text>

      <View style={styles.scale}>
        {LEVELS.map((lv) => (
          <View key={lv.db} style={[styles.row, { borderLeftColor: TONE_COLOR[lv.tone] }]}>
            <Text style={[styles.db, { color: TONE_COLOR[lv.tone] }]}>{lv.db}</Text>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{lv.label}</Text>
              <Text style={styles.rowNote}>{lv.note}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Nursery-safe cap</Text>
            <Text style={styles.settingSub}>
              Hard-limits the master volume to 45%. Use it if this is playing anywhere near a baby.
            </Text>
          </View>
          <SwitchPill
            on={safe}
            label="Nursery-safe cap"
            onChange={(on) => {
              patchSettings({ nurserySafe: on });
              bus.emit('ui:settings', { nurserySafe: on });
              toast(on ? 'Nursery-safe cap on' : 'Nursery-safe cap off');
            }}
          />
        </View>
        {safe ? (
          <Text style={styles.why}>
            American Academy of Pediatrics guidance for sound machines in hospital nurseries: 50 dB
            or lower, at least 2 metres (7 feet) from the sleep space, never at maximum volume. The
            cap enforces the ceiling; the distance is on you.
          </Text>
        ) : null}
      </View>

      {(VOLUME_EVIDENCE.detail ?? '')
        .split('\n\n')
        .map((para) => para.trim())
        .filter(Boolean)
        .map((para, i) => (
          <Text key={i} style={styles.detail}>
            {para}
          </Text>
        ))}

      {VOLUME_EVIDENCE.sources?.length ? <SourceList sources={VOLUME_EVIDENCE.sources} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  claim: {
    color: color.ink,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  scale: {
    marginBottom: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 8,
    borderLeftWidth: 2,
    marginBottom: 8,
    backgroundColor: color.cardQuiet,
    borderTopRightRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
  },
  db: {
    width: 74,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    color: color.ink,
    fontSize: 13,
    marginBottom: 2,
  },
  rowNote: {
    color: color.ink3,
    fontSize: 12,
    lineHeight: 18,
  },
  card: {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.cardQuiet,
    padding: 14,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    color: color.ink,
    fontSize: 14,
    marginBottom: 3,
  },
  settingSub: {
    color: color.ink3,
    fontSize: 12,
    lineHeight: 18,
  },
  why: {
    color: color.ink3,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  detail: {
    color: color.ink2,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
});
