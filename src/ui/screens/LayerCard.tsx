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
import type { SoundId } from '../../types';
import { BadgeChip, InfoDot, Notice } from '../components/controls';
import { LockIcon } from '../components/icons';
import { SliderRow } from '../components/SliderRow';
import { useLayerState, useSceneAccent } from '../hooks';
import { openEvidence } from '../sheets/EvidenceSheet';
import { openPaywall } from '../sheets/PaywallSheet';
import { color, radius, type SceneAccent } from '../theme';

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

interface BinauralChipDef {
  label: string;
  sub: string;
  baseHz: number;
  beatHz: number;
}

const BINAURAL_CHIPS: readonly BinauralChipDef[] = [
  { label: 'Sleep — Fan 2024', sub: '0.25 Hz @ 250 Hz', baseHz: 250, beatHz: 0.25 },
  { label: 'Delta', sub: '3 Hz @ 250 Hz', baseHz: 250, beatHz: 3 },
  { label: 'Alpha / focus', sub: '10 Hz @ 250 Hz', baseHz: 250, beatHz: 10 },
];

/*
 * Slider formatters are module constants, not inline arrows. They close over
 * nothing, and a fresh identity on every render would defeat SliderRow's memo.
 */
const fmtLevel = (v: number): string => `${Math.round(v)}`;
const fmtIntensity = (v: number): string => (v < 33 ? 'Drizzle' : v < 70 ? 'Steady' : 'Downpour');
const fmtFrequency = (v: number): string => (v < 25 ? 'Rare' : v < 60 ? 'Occasional' : 'Frequent');
const fmtCarrier = (v: number): string => `${Math.round(v)} Hz`;
const fmtBeat = (v: number): string => `${v} Hz`;

/**
 * One binaural preset chip. Split out so its onPress can be a stable callback
 * instead of an arrow rebuilt inside a .map() on every render.
 */
const BinauralChip = React.memo(function BinauralChip({
  def,
  active,
  accent,
  onSelect,
}: {
  def: BinauralChipDef;
  active: boolean;
  accent: SceneAccent;
  onSelect: (def: BinauralChipDef) => void;
}): React.JSX.Element {
  const press = useCallback(() => onSelect(def), [def, onSelect]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={press}
      style={[
        styles.chip,
        active ? { borderColor: accent.accent, backgroundColor: accent.accentSoft } : null,
      ]}
    >
      <Text style={[styles.chipLabel, active ? { color: accent.accent } : null]}>{def.label}</Text>
      <Text style={styles.chipSub}>{def.sub}</Text>
    </Pressable>
  );
});

/**
 * The card's head: the toggle (or the padlock), the title, the badge and the
 * evidence dot.
 *
 * Split out and memoised because none of it moves while a slider is being
 * dragged — only the slider under it does. Without this, the one card that is
 * legitimately re-rendering at touch-move rate redraws its whole head too.
 * Purely a component boundary: the rendered view tree is unchanged.
 */
const LayerHeader = React.memo(function LayerHeader({
  id,
  on,
  unlocked,
  accent,
  onActivate,
  onEvidence,
}: {
  id: SoundId;
  on: boolean;
  unlocked: boolean;
  accent: SceneAccent;
  onActivate: () => void;
  onEvidence: () => void;
}): React.JSX.Element {
  const info = EVIDENCE[id] ?? { title: id, badge: 'Traditional' as const };
  return (
    <View style={styles.top}>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: on, disabled: false }}
        accessibilityLabel={info.title}
        accessibilityHint={unlocked ? undefined : 'Locked — opens the unlock options'}
        onPress={onActivate}
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

      <InfoDot label={`Why ${info.title}? The evidence`} onPress={onEvidence} />
    </View>
  );
});

export interface LayerCardProps {
  id: SoundId;
  /**
   * Whether this layer is unlocked. Passed in rather than read here so the
   * memo below can compare it by value — a lock can disappear mid-session and
   * the card has to notice.
   */
  unlocked: boolean;
}

function LayerCardBase({ id, unlocked }: LayerCardProps): React.JSX.Element {
  const accent = useSceneAccent();
  // Per-layer subscription: this card re-renders when THIS layer moves, not
  // when any of the other ten do.
  const layer = useLayerState(id);
  const on = !!layer.enabled && unlocked;

  const activate = useCallback(() => {
    if (!Entitlements.isUnlocked(id)) {
      openPaywall({ lockedIds: [id] });
      return;
    }
    engine.setLayerEnabled(id, !engine.getState().layers[id]?.enabled);
  }, [id]);

  /*
   * Every callback handed to a child is stable for the life of the card. These
   * were inline arrows, which gave each child a new prop identity on every
   * render and made memoising them pointless.
   */
  const showEvidence = useCallback(() => openEvidence(id), [id]);
  const setLevel = useCallback((v: number) => engine.setLayerVolume(id, v / 100), [id]);
  const setIntensity = useCallback(
    (v: number) => engine.setLayerParam(id, 'intensity', v / 100),
    [id],
  );
  const setFrequency = useCallback(
    (v: number) => engine.setLayerParam(id, 'frequency', v / 100),
    [id],
  );
  const setCarrier = useCallback((v: number) => engine.setLayerParam(id, 'baseHz', v), [id]);
  const setBeat = useCallback((v: number) => engine.setLayerParam(id, 'beatHz', v), [id]);
  const selectChip = useCallback(
    (def: BinauralChipDef) => {
      engine.setLayerParam(id, 'baseHz', def.baseHz);
      engine.setLayerParam(id, 'beatHz', def.beatHz);
    },
    [id],
  );

  return (
    <View
      style={[
        styles.card,
        on ? { borderColor: accent.accentSoft } : null,
        !unlocked ? styles.locked : null,
      ]}
    >
      <LayerHeader
        id={id}
        on={on}
        unlocked={unlocked}
        accent={accent}
        onActivate={activate}
        onEvidence={showEvidence}
      />

      {unlocked && on ? (
        <View style={styles.body}>
          <SliderRow
            label="Level"
            min={0}
            max={100}
            step={1}
            value={Math.round((layer.volume ?? 0) * 100)}
            format={fmtLevel}
            onChange={setLevel}
          />

          {id === 'rain' ? (
            <SliderRow
              label="Intensity"
              hint="Drizzle to downpour"
              min={0}
              max={100}
              step={1}
              value={Math.round((layer.params.intensity ?? 0.5) * 100)}
              format={fmtIntensity}
              onChange={setIntensity}
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
              format={fmtFrequency}
              onChange={setFrequency}
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
                {BINAURAL_CHIPS.map((def) => (
                  <BinauralChip
                    key={def.label}
                    def={def}
                    active={
                      layer.params.baseHz === def.baseHz &&
                      Math.abs((layer.params.beatHz ?? 0) - def.beatHz) < 0.001
                    }
                    accent={accent}
                    onSelect={selectChip}
                  />
                ))}
              </View>

              <SliderRow
                label="Carrier"
                min={80}
                max={400}
                step={5}
                value={layer.params.baseHz ?? 250}
                format={fmtCarrier}
                onChange={setCarrier}
              />
              <SliderRow
                label="Beat"
                min={0.25}
                max={12}
                step={0.25}
                value={layer.params.beatHz ?? 0.25}
                format={fmtBeat}
                onChange={setBeat}
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

/**
 * Compared by VALUE, never by identity.
 *
 * The layer's own numbers are compared in `useLayerState`'s store (hooks.ts,
 * `layerEqual`) — once per mix:changed, rather than eleven times in eleven
 * comparators — and reach this card as a hook, not a prop. What is left to
 * compare here is the id and the lock, both primitives. The default shallow
 * memo would do the same thing; this is spelled out so nobody "simplifies" a
 * freshly allocated object back into the props and silently loses the memo.
 */
function propsEqual(a: LayerCardProps, b: LayerCardProps): boolean {
  return a.id === b.id && a.unlocked === b.unlocked;
}

export const LayerCard = React.memo(LayerCardBase, propsEqual);

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
