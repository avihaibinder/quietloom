/**
 * One card per layer: the toggle, the evidence badge, and — once the layer is
 * on — its parameters.
 *
 * Locked layers still show everything except the controls. A padlock that
 * explains what it is guarding sells better than a padlock that just refuses,
 * and a tap goes to the paywall rather than nowhere.
 */

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { engine } from '../../audio/engine';
import { EVIDENCE } from '../../data/evidence';
import { Entitlements } from '../../services/entitlements';
import type { LayerState, SoundId } from '../../types';
import { BadgeChip, InfoDot, Notice } from '../components/controls';
import { LockIcon } from '../components/icons';
import { SliderRow } from '../components/SliderRow';
import { useSceneAccent } from '../hooks';
import { openEvidence } from '../sheets/EvidenceSheet';
import { openPaywall } from '../sheets/PaywallSheet';
import { color, radius } from '../theme';

/** Per-layer body copy. Ported verbatim — each line is a research summary. */
export const COPY: Record<SoundId, string> = {
  rain: 'Layered droplets under a 1/f gust envelope. Synthesised, so it never loops.',
  thunder: 'Distant rumbles, kept infrequent and below the level that causes arousals.',
  ocean: 'Swells locked to 10 seconds — 0.1 Hz. The waves are a breathing pacer.',
  wind: 'Slowly wandering broadband air. Covers the frequencies speech sits in.',
  fire: 'Crackle, hiss and pop. In the study, silent fire did nothing — the sound is the effect.',
  crickets: 'Sparse, high chirps that sit above the masking bed instead of fighting it.',
  pink: '1/f noise. The default bed, because pink is what the sleep literature actually tested.',
  brown: 'Deeper than pink. Most of its energy sits low, where traffic and footsteps live.',
  white: 'Flat and bright. Included because people like it — the evidence is thinner than the fame.',
  binaural: 'Two carriers, one per ear. Physically impossible on a speaker.',
  deeppulse: 'Pink-noise pulses near 0.8 Hz, modelled on a slow-wave protocol. Experimental.',
};

const BINAURAL_CHIPS = [
  { label: 'Sleep — Fan 2024', sub: '0.25 Hz @ 250 Hz', baseHz: 250, beatHz: 0.25 },
  { label: 'Delta', sub: '3 Hz @ 250 Hz', baseHz: 250, beatHz: 3 },
  { label: 'Alpha / focus', sub: '10 Hz @ 250 Hz', baseHz: 250, beatHz: 10 },
];

export interface LayerCardProps {
  id: SoundId;
  layer: LayerState;
}

export function LayerCard({ id, layer }: LayerCardProps): React.JSX.Element {
  const accent = useSceneAccent();
  const info = EVIDENCE[id] ?? { title: id, badge: 'Traditional' as const };
  const unlocked = Entitlements.isUnlocked(id);
  const on = !!layer.enabled && unlocked;

  const activate = useCallback(() => {
    if (!Entitlements.isUnlocked(id)) {
      openPaywall({ lockedIds: [id] });
      return;
    }
    engine.setLayerEnabled(id, !engine.getState().layers[id]?.enabled);
  }, [id]);

  return (
    <View
      style={[
        styles.card,
        on ? { borderColor: accent.accentSoft } : null,
        !unlocked ? styles.locked : null,
      ]}
    >
      <View style={styles.top}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: on, disabled: false }}
          accessibilityLabel={info.title}
          accessibilityHint={unlocked ? undefined : 'Locked — opens the unlock options'}
          onPress={activate}
          style={({ pressed }) => [styles.topPress, pressed ? styles.topPressed : null]}
        >
          {unlocked ? (
            <View style={[styles.track, on ? { backgroundColor: accent.accent } : null]}>
              <View style={[styles.knob, on ? styles.knobOn : null]} />
            </View>
          ) : (
            <View style={styles.lock}>
              <LockIcon size={18} color={color.ink4} />
            </View>
          )}

          <View style={styles.meta}>
            <View style={styles.titleRow}>
              <Text style={styles.name}>{info.title}</Text>
              <BadgeChip badge={info.badge} small />
              {!unlocked ? <Text style={styles.lockPill}>Locked</Text> : null}
            </View>
            <Text style={styles.desc}>{COPY[id]}</Text>
          </View>
        </Pressable>

        <InfoDot label={`Why ${info.title}? The evidence`} onPress={() => openEvidence(id)} />
      </View>

      {unlocked && on ? (
        <View style={styles.body}>
          <SliderRow
            label="Level"
            min={0}
            max={100}
            step={1}
            value={Math.round((layer.volume ?? 0) * 100)}
            format={(v) => `${Math.round(v)}`}
            onChange={(v) => engine.setLayerVolume(id, v / 100)}
          />

          {id === 'rain' ? (
            <SliderRow
              label="Intensity"
              hint="Drizzle to downpour"
              min={0}
              max={100}
              step={1}
              value={Math.round((layer.params.intensity ?? 0.5) * 100)}
              format={(v) => (v < 33 ? 'Drizzle' : v < 70 ? 'Steady' : 'Downpour')}
              onChange={(v) => engine.setLayerParam(id, 'intensity', v / 100)}
            />
          ) : null}

          {id === 'thunder' ? (
            <SliderRow
              label="Frequency"
              hint="How often a rumble rolls through"
              min={0}
              max={100}
              step={1}
              value={Math.round((layer.params.frequency ?? 0.3) * 100)}
              format={(v) => (v < 25 ? 'Rare' : v < 60 ? 'Occasional' : 'Frequent')}
              onChange={(v) => engine.setLayerParam(id, 'frequency', v / 100)}
            />
          ) : null}

          {id === 'binaural' ? (
            <>
              <Notice warn>
                <Text style={styles.noticeStrong}>Headphones required.</Text> A binaural beat is
                created inside your head from two slightly different tones, one per ear. On a
                speaker the tones mix in the air and the effect cannot happen at all.
              </Notice>

              <View style={styles.chipRow}>
                {BINAURAL_CHIPS.map((def) => {
                  const active =
                    layer.params.baseHz === def.baseHz &&
                    Math.abs((layer.params.beatHz ?? 0) - def.beatHz) < 0.001;
                  return (
                    <Pressable
                      key={def.label}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => {
                        engine.setLayerParam(id, 'baseHz', def.baseHz);
                        engine.setLayerParam(id, 'beatHz', def.beatHz);
                      }}
                      style={[
                        styles.chip,
                        active
                          ? { borderColor: accent.accent, backgroundColor: accent.accentSoft }
                          : null,
                      ]}
                    >
                      <Text style={[styles.chipLabel, active ? { color: accent.accent } : null]}>
                        {def.label}
                      </Text>
                      <Text style={styles.chipSub}>{def.sub}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <SliderRow
                label="Carrier"
                min={80}
                max={400}
                step={5}
                value={layer.params.baseHz ?? 250}
                format={(v) => `${Math.round(v)} Hz`}
                onChange={(v) => engine.setLayerParam(id, 'baseHz', v)}
              />
              <SliderRow
                label="Beat"
                min={0.25}
                max={12}
                step={0.25}
                value={layer.params.beatHz ?? 0.25}
                format={(v) => `${v} Hz`}
                onChange={(v) => engine.setLayerParam(id, 'beatHz', v)}
              />
            </>
          ) : null}

          {id === 'deeppulse' ? (
            <Notice>
              <Text style={styles.noticeStrong}>Open-loop approximation.</Text> The original
              protocol phase-locked pulses to your slow oscillations using EEG. Quietloom has no EEG
              — it runs the same rhythm, not the same targeting.
            </Notice>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.card,
    marginBottom: 10,
    overflow: 'hidden',
  },
  locked: {
    opacity: 0.72,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
  topPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingVertical: 12,
    paddingLeft: 14,
  },
  topPressed: {
    opacity: 0.8,
  },
  track: {
    width: 42,
    height: 25,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.10)',
    padding: 3,
    justifyContent: 'center',
  },
  knob: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: color.ink2,
  },
  knobOn: {
    backgroundColor: color.bg,
    transform: [{ translateX: 17 }],
  },
  lock: {
    width: 42,
    alignItems: 'center',
  },
  meta: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 3,
  },
  name: {
    color: color.ink,
    fontSize: 15,
  },
  lockPill: {
    color: color.ink4,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  desc: {
    color: color.ink3,
    fontSize: 12,
    lineHeight: 18,
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: color.line,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  noticeStrong: {
    color: color.ink,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flexGrow: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    backgroundColor: color.cardQuiet,
  },
  chipLabel: {
    color: color.ink2,
    fontSize: 12,
  },
  chipSub: {
    color: color.ink4,
    fontSize: 10,
    marginTop: 2,
  },
});
