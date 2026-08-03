/**
 * The mixer — the main screen. Port of #screen-mixer plus the wiring that
 * lived in src/ui/index.js.
 *
 * Engine state is held here and fed down: `mix:changed` is the single source
 * of truth, so a slider, a preset and a saved mix all move the same UI by the
 * same path.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type LayoutRectangle,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { engine } from '../../audio/engine';
import { Scenes } from '../../scenes/renderer';
import { Entitlements } from '../../services/entitlements';
import { SOUND_IDS, type EngineState, type SoundId } from '../../types';
import { GhostButton, LinkButton, SwitchPill } from '../components/controls';
import { useBusEvent, useSettings } from '../hooks';
import { openBadgeLegend } from '../sheets/EvidenceSheet';
import { openMixes } from '../sheets/MixesSheet';
import { openPaywall } from '../sheets/PaywallSheet';
import { BAR_HEIGHT, color, radius } from '../theme';
import { LayerCard } from './LayerCard';
import { MasterRow } from './MasterRow';
import { PresetRow } from './PresetRow';

/** Layer groups, in this order. Pink sits first in its group for a reason. */
const GROUPS: Array<{ name: string; note: string; ids: SoundId[] }> = [
  {
    name: 'Nature',
    note: 'Water, weather and fire — the element families used in the HRV crossover study.',
    ids: ['rain', 'thunder', 'ocean', 'wind', 'fire', 'crickets'],
  },
  {
    name: 'Noise beds',
    note: 'Steady masking. Pink sits first because pink is what the research tested.',
    ids: ['pink', 'brown', 'white'],
  },
  {
    name: 'Experimental',
    note: 'Real protocols reproduced honestly, with the caveats shown.',
    ids: ['binaural', 'deeppulse'],
  },
];

function groupsForIds(ids: readonly SoundId[]) {
  const seen = new Set<SoundId>();
  const out: Array<{ name: string; note: string; ids: SoundId[] }> = [];
  for (const g of GROUPS) {
    const present = g.ids.filter((id) => ids.includes(id));
    present.forEach((id) => seen.add(id));
    if (present.length) out.push({ ...g, ids: present });
  }
  const rest = ids.filter((id) => !seen.has(id));
  if (rest.length) out.push({ name: 'More', note: '', ids: [...rest] });
  return out;
}

export interface MixerScreenProps {
  /** Reported upward so the moon tap can avoid sitting on a control. */
  onControlsLayout?: (rects: LayoutRectangle[]) => void;
}

export function MixerScreen({ onControlsLayout }: MixerScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [settings, patchSettings] = useSettings();
  const [state, setState] = useState<EngineState>(() => engine.getState());
  const [bannerH, setBannerH] = useState(0);
  const [entVersion, setEntVersion] = useState(0);

  useBusEvent('mix:changed', setState);
  useBusEvent('entitlements:changed', () => setEntVersion((v) => v + 1));
  useBusEvent('ads:banner', ({ visible, heightPx }) =>
    setBannerH(visible ? Math.max(0, heightPx) : 0),
  );

  // A lock can disappear mid-session, so the layer list is keyed off this.
  void entVersion;

  const groups = useMemo(() => groupsForIds(SOUND_IDS), []);

  const premiumLabel = Entitlements.isPremium()
    ? 'Premium'
    : Entitlements.hasNightPass()
      ? 'Unlocked tonight'
      : 'Premium';
  const premiumActive = Entitlements.isPremium() || Entitlements.hasNightPass();

  const onReduceMotion = useCallback(
    (next: boolean) => {
      patchSettings({ reduceMotion: next });
      try {
        if (engine.isRunning()) Scenes.resume();
        else Scenes.pause();
      } catch {
        /* renderer is optional */
      }
    },
    [patchSettings],
  );

  /**
   * Control boxes reported up for the moon tap to avoid.
   *
   * onLayout gives coordinates inside the scroll content, but the moon is
   * placed in window space, so the current scroll offset has to come off the
   * top. Republished on a 140 ms debounce while scrolling — the same interval
   * the web build used, and enough to keep a 24fps scene from re-rendering the
   * whole screen on every scroll event.
   */
  const controlRects = useRef<Record<string, LayoutRectangle>>({});
  const scrollY = useRef(0);
  const publishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const publishRects = useCallback(() => {
    if (!onControlsLayout) return;
    onControlsLayout(
      Object.values(controlRects.current).map((r) => ({ ...r, y: r.y - scrollY.current })),
    );
  }, [onControlsLayout]);

  const schedulePublish = useCallback(() => {
    if (publishTimer.current) return;
    publishTimer.current = setTimeout(() => {
      publishTimer.current = null;
      publishRects();
    }, 140);
  }, [publishRects]);

  useEffect(
    () => () => {
      if (publishTimer.current) clearTimeout(publishTimer.current);
    },
    [],
  );

  const reportRect = useCallback(
    (key: string) => (e: LayoutChangeEvent) => {
      controlRects.current[key] = e.nativeEvent.layout;
      schedulePublish();
    },
    [schedulePublish],
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.current = e.nativeEvent.contentOffset.y;
      schedulePublish();
    },
    [schedulePublish],
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + 14,
          paddingBottom: insets.bottom + BAR_HEIGHT + bannerH + 28,
        },
      ]}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={32}
    >
      <View style={styles.head} onLayout={reportRect('head')}>
        <View style={styles.brand}>
          <Text style={styles.title}>Quietloom</Text>
          <Text style={styles.tagline}>Living sleepscapes, generated in real time</Text>
        </View>
        <GhostButton
          active={premiumActive}
          onPress={() => openPaywall({ reason: 'Every layer, every scene.' })}
        >
          {premiumLabel}
        </GhostButton>
      </View>

      <View style={styles.block} onLayout={reportRect('presets')}>
        <View style={styles.blockHead}>
          <Text style={styles.h2}>Sleepscapes</Text>
          <LinkButton onPress={openMixes}>My mixes</LinkButton>
        </View>
        <PresetRow />
      </View>

      <View style={styles.block}>
        <View style={styles.blockHead}>
          <Text style={styles.h2}>Layers</Text>
          <LinkButton onPress={openBadgeLegend}>What the badges mean</LinkButton>
        </View>
        {groups.map((group) => (
          <View key={group.name} style={styles.group}>
            <Text style={styles.groupName}>{group.name}</Text>
            {group.note ? <Text style={styles.groupNote}>{group.note}</Text> : null}
            {group.ids.map((id) => (
              <LayerCard key={id} id={id} layer={state.layers[id]} />
            ))}
          </View>
        ))}
      </View>

      <MasterRow master={state.master} />

      <View style={styles.card}>
        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Reduce motion</Text>
            <Text style={styles.settingSub}>
              Freezes the scene to a still gradient. Saves battery over a long night.
            </Text>
          </View>
          <SwitchPill
            on={settings.reduceMotion === true}
            label="Reduce motion"
            onChange={onReduceMotion}
          />
        </View>
      </View>

      <Text style={styles.disclaimer}>
        Quietloom is a relaxation and sound-masking tool, not a medical device. Every claim in this
        app links to the study behind it.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 22,
  },
  brand: {
    flex: 1,
  },
  title: {
    color: color.ink,
    fontSize: 26,
    fontWeight: '300',
    letterSpacing: -0.4,
  },
  tagline: {
    color: color.ink4,
    fontSize: 12,
    marginTop: 2,
  },
  block: {
    marginBottom: 22,
  },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  h2: {
    color: color.ink,
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  group: {
    marginBottom: 16,
  },
  groupName: {
    color: color.ink2,
    fontSize: 13,
    marginBottom: 2,
  },
  groupNote: {
    color: color.ink4,
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.cardQuiet,
    padding: 14,
    marginTop: 14,
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
  disclaimer: {
    color: color.ink4,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 20,
  },
});
