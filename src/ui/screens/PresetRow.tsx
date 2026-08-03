/**
 * The preset row. Each chip is a curated sleepscape; the note under the row
 * explains the research angle, because that is the reason the preset exists.
 *
 * If a preset contains locked layers we apply everything the user *can* hear
 * and then offer the rest — never a dead-end tap.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { engine } from '../../audio/engine';
import { bus } from '../../core/bus';
import { EVIDENCE } from '../../data/evidence';
import { PRESETS } from '../../data/presets';
import { Scenes } from '../../scenes/renderer';
import { Entitlements } from '../../services/entitlements';
import type { Preset, SceneId, SoundId } from '../../types';
import { InfoDot, LinkButton } from '../components/controls';
import { LockIcon } from '../components/icons';
import { useBusEvent, useSceneAccent } from '../hooks';
import { openEvidence } from '../sheets/EvidenceSheet';
import { openPaywall } from '../sheets/PaywallSheet';
import { color, radius, SCENE_ACCENTS } from '../theme';

/**
 * Scene-level copy for the note card, for a scene showing with no preset behind
 * it. Keyed by scene id — exactly like the evidence dot the card carries.
 */
const SCENE_NOTES: Partial<Record<SceneId, { name: string; text: string }>> = {
  moonrise: {
    name: 'Moonrise',
    text: 'A quiet meadow at night. Picture somewhere pleasant, and interesting enough to hold your attention — that is the tested part, not the sheep.',
  },
};

/** Module state, so the composition root can apply a preset before mount. */
let activeId: string | null = null;
const activeListeners = new Set<() => void>();

function setActive(id: string | null): void {
  activeId = id;
  for (const fn of [...activeListeners]) fn();
}

function lockedIdsOf(preset: Preset): SoundId[] {
  return (Object.keys(preset.layers) as SoundId[]).filter((id) => !Entitlements.isUnlocked(id));
}

/**
 * Apply a preset: everything unlocked, the scene, and the note. `silent` skips
 * the paywall — used on boot when restoring a session.
 */
export function applyPreset(id: string, { silent = false }: { silent?: boolean } = {}): void {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) return;

  const locked = lockedIdsOf(p);
  const layers: Partial<Record<SoundId, Preset['layers'][SoundId]>> = {};
  for (const layerId of Object.keys(p.layers) as SoundId[]) {
    if (Entitlements.isUnlocked(layerId)) layers[layerId] = p.layers[layerId];
  }

  // If every layer in this preset is locked, do not wipe what is already
  // playing — set the scene, explain, and offer the unlock.
  if (Object.keys(layers).length) engine.applyMix({ layers });

  try {
    Scenes.setScene(p.scene);
  } catch (err) {
    console.warn('[ui] setScene failed', err);
  }
  bus.emit('scene:changed', { scene: p.scene });

  setActive(p.id);

  if (locked.length && !silent) {
    setTimeout(() => openPaywall({ lockedIds: locked }), 260);
  }
}

/** Used when a saved mix replaces a preset. */
export function clearActivePreset(): void {
  setActive(null);
}

export function PresetRow(): React.JSX.Element {
  const accent = useSceneAccent();
  const [, bump] = useState(0);
  const [scene, setScene] = useState<SceneId>(() => Scenes.getScene());

  useEffect(() => {
    const fn = () => bump((v) => v + 1);
    activeListeners.add(fn);
    return () => {
      activeListeners.delete(fn);
    };
  }, []);

  useBusEvent('scene:changed', ({ scene: s }) => setScene(s));
  useBusEvent('preset:cleared', () => clearActivePreset());
  // restoreSession() sets the scene without emitting scene:changed, and initUI
  // emits screen:changed once afterwards — that is the cold-boot signal.
  useBusEvent('screen:changed', ({ name }) => {
    if (name === 'mixer') setScene(Scenes.getScene());
  });

  const active = PRESETS.find((p) => p.id === activeId) ?? null;
  const activeLocked = active ? lockedIdsOf(active) : [];
  const sceneNote = !active ? SCENE_NOTES[scene] : undefined;

  const onPress = useCallback((id: string) => applyPreset(id), []);

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityLabel="Presets"
      >
        {PRESETS.map((p) => {
          const locked = lockedIdsOf(p);
          const isActive = p.id === activeId;
          const art = SCENE_ACCENTS[p.scene];
          return (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${p.name}, ${Object.keys(p.layers).length} layers${locked.length ? ', contains locked layers' : ''}`}
              onPress={() => onPress(p.id)}
              style={[
                styles.chip,
                isActive ? { borderColor: accent.accent, backgroundColor: accent.accentSoft } : null,
              ]}
            >
              <View style={[styles.art, { backgroundColor: art.top, borderColor: art.accentSoft }]}>
                <View style={[styles.artDot, { backgroundColor: art.accent }]} />
                {locked.length ? (
                  <View style={styles.chipLock}>
                    <LockIcon size={13} color={color.ink3} />
                  </View>
                ) : null}
              </View>
              <Text style={styles.chipName} numberOfLines={1}>
                {p.name}
              </Text>
              <Text style={styles.chipCount}>{`${Object.keys(p.layers).length} layers`}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {active ? (
        <View style={styles.note}>
          {active.scene === 'moonrise' && EVIDENCE.moonrise ? (
            <View style={styles.noteDot}>
              <InfoDot
                label="The evidence behind the Moonrise scene"
                onPress={() => openEvidence('moonrise')}
                size={28}
              />
            </View>
          ) : null}
          <Text style={styles.noteText}>
            <Text style={styles.noteName}>{active.name}</Text>
            {' — '}
            {active.note}
          </Text>
          {activeLocked.length ? (
            <LinkButton onPress={() => openPaywall({ lockedIds: activeLocked })} inline>
              {`Unlock the missing ${activeLocked.length === 1 ? 'layer' : 'layers'}`}
            </LinkButton>
          ) : null}
        </View>
      ) : sceneNote ? (
        <View style={styles.note}>
          {scene === 'moonrise' && EVIDENCE.moonrise ? (
            <View style={styles.noteDot}>
              <InfoDot
                label="The evidence behind the Moonrise scene"
                onPress={() => openEvidence('moonrise')}
                size={28}
              />
            </View>
          ) : null}
          <Text style={styles.noteText}>
            <Text style={styles.noteName}>{sceneNote.name}</Text>
            {' — '}
            {sceneNote.text}
          </Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 10,
    paddingVertical: 2,
    paddingRight: 4,
  },
  chip: {
    width: 108,
    padding: 8,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.cardQuiet,
  },
  art: {
    height: 54,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: 8,
    justifyContent: 'flex-end',
    padding: 7,
  },
  artDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    opacity: 0.85,
  },
  chipLock: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  chipName: {
    color: color.ink,
    fontSize: 13,
  },
  chipCount: {
    color: color.ink4,
    fontSize: 11,
    marginTop: 1,
  },
  note: {
    marginTop: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.cardQuiet,
  },
  noteDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
  },
  noteText: {
    color: color.ink3,
    fontSize: 12,
    lineHeight: 19,
    paddingRight: 34,
  },
  noteName: {
    color: color.ink,
  },
});
