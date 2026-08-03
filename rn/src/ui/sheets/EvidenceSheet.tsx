/**
 * The evidence sheet — Quietloom's differentiator.
 *
 * Every sound, the breathing pacer, the timer rationale and the volume guide
 * all render through here, so a citation always looks the same wherever it
 * appears. Source links go out through Native.openUrl (an in-app browser on
 * device).
 *
 * One sheet, three payload shapes: a citation card, the badge legend, or the
 * volume guide. The web app reused a single #evidence-sheet element the same
 * way — two sheets that look identical are two sheets that drift apart.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BADGE, EVIDENCE } from '../../data/evidence';
import type { Badge, EvidenceEntry } from '../../types';
import { BadgeChip } from '../components/controls';
import { Sheet } from '../components/Sheet';
import { SheetHeader } from '../components/SheetHeader';
import { useSheet } from '../hooks';
import { closeSheet, openSheet } from '../sheets';
import { BADGE_MEANING, color } from '../theme';
import { SourceList } from './SourceList';
import { VolumeGuideBody } from './VolumeGuide';

export { SourceList };

const SHEET_ID = 'evidence' as const;

export type EvidencePayload =
  | { kind: 'entry'; data: EvidenceEntry; eyebrow?: string }
  | { kind: 'legend' }
  | { kind: 'volume' };

/* --------------------------------------------------------------- openers --- */

/** Open the evidence sheet for a sound id (or a scene id) from EVIDENCE. */
export function openEvidence(id: string): void {
  const data = EVIDENCE[id];
  if (!data) return;
  const payload: EvidencePayload = { kind: 'entry', data };
  openSheet(SHEET_ID, payload);
}

/** Open the sheet for an arbitrary evidence-shaped object. */
export function openEvidenceData(data: EvidenceEntry, opts?: { eyebrow?: string }): void {
  const payload: EvidencePayload = { kind: 'entry', data, eyebrow: opts?.eyebrow };
  openSheet(SHEET_ID, payload);
}

/** The badge legend, shown from the Layers header. */
export function openBadgeLegend(): void {
  const payload: EvidencePayload = { kind: 'legend' };
  openSheet(SHEET_ID, payload);
}

/** "How loud should this be?" — the feature almost nobody ships. */
export function openVolumeGuide(): void {
  const payload: EvidencePayload = { kind: 'volume' };
  openSheet(SHEET_ID, payload);
}

export function closeEvidence(): void {
  closeSheet(SHEET_ID);
}

/* ------------------------------------------------------------ fragments --- */

/** Paragraphs, split on blank lines exactly as the web renderer did. */
function Detail({ text }: { text: string }): React.JSX.Element {
  return (
    <>
      {text
        .split('\n\n')
        .map((para) => para.trim())
        .filter(Boolean)
        .map((para, i) => (
          <Text key={i} style={styles.detail}>
            {para}
          </Text>
        ))}
    </>
  );
}

function EvidenceCard({ data, eyebrow }: { data: EvidenceEntry; eyebrow?: string }): React.JSX.Element {
  return (
    <>
      <SheetHeader title={data.title} eyebrow={eyebrow ?? 'The evidence'} onClose={closeEvidence} />
      {data.badge ? (
        <View style={styles.badgeRow}>
          <BadgeChip badge={data.badge} />
          <Text style={styles.badgeMeaning}>{BADGE_MEANING[data.badge]}</Text>
        </View>
      ) : null}
      {data.claim ? <Text style={styles.claim}>{data.claim}</Text> : null}
      {data.detail ? <Detail text={data.detail} /> : null}
      {data.sources?.length ? <SourceList sources={data.sources} /> : null}
      <Text style={styles.foot}>
        Quietloom is not a medical device. Sample sizes in this literature are small and effects vary
        between people.
      </Text>
    </>
  );
}

const LEGEND_ORDER: Badge[] = [BADGE.STRONG, BADGE.MODERATE, BADGE.EMERGING, BADGE.TRADITIONAL];

function BadgeLegend(): React.JSX.Element {
  return (
    <>
      <SheetHeader
        title="How to read the badges"
        eyebrow="Quietloom cites its sources"
        onClose={closeEvidence}
      />
      <Text style={styles.claim}>
        Most sleep apps tell you a sound works. Quietloom tells you how well it is evidenced —
        including when the answer is &ldquo;not very&rdquo;.
      </Text>
      <View style={styles.legendList}>
        {LEGEND_ORDER.map((b) => (
          <View key={b} style={styles.legendRow}>
            <BadgeChip badge={b} />
            <Text style={styles.legendText}>{BADGE_MEANING[b]}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.detail}>
        We link the negative findings too. A 2021 systematic review of 38 studies rated the overall
        evidence that continuous noise improves sleep as very low — which is exactly why the sleep
        timer defaults to on.
      </Text>
      <SourceList
        sources={[
          {
            label: 'Riedy 2021, Sleep Medicine Reviews — the counter-evidence',
            url: 'https://www.sciencedirect.com/science/article/abs/pii/S1087079220301283',
          },
        ]}
      />
    </>
  );
}

/* --------------------------------------------------------------- sheet --- */

export function EvidenceSheet(): React.JSX.Element {
  const { payload } = useSheet(SHEET_ID);
  const p = payload as EvidencePayload | undefined;

  return (
    <Sheet id={SHEET_ID} label="Evidence">
      {p?.kind === 'legend' ? <BadgeLegend /> : null}
      {p?.kind === 'volume' ? <VolumeGuideBody /> : null}
      {p?.kind === 'entry' ? <EvidenceCard data={p.data} eyebrow={p.eyebrow} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  badgeMeaning: {
    flex: 1,
    color: color.ink3,
    fontSize: 12,
    lineHeight: 17,
  },
  claim: {
    color: color.ink,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 14,
  },
  detail: {
    color: color.ink2,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  legendList: {
    marginBottom: 16,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  legendText: {
    flex: 1,
    color: color.ink2,
    fontSize: 13,
    lineHeight: 20,
  },
  foot: {
    color: color.ink4,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
});
