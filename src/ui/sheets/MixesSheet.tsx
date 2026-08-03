/**
 * Saved mixes. Persisted to KEYS.mixes; the working mix is written to
 * KEYS.lastMix on every change so a restart lands you where you left off.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { engine } from '../../audio/engine';
import { bus, toast } from '../../core/bus';
import { KEYS, read, write } from '../../core/store';
import { Entitlements } from '../../services/entitlements';
import type { EngineState, SavedMix, SoundId } from '../../types';
import { DangerButton, LinkButton, PrimaryButton } from '../components/controls';
import { MixPlayIcon } from '../components/icons';
import { Sheet } from '../components/Sheet';
import { SheetHeader } from '../components/SheetHeader';
import { useBusEvent, useSceneAccent, useSheet } from '../hooks';
import { activeLayerIds, describeMix } from '../mixState';
import { closeSheet, isSheetOpen, openSheet } from '../sheets';
import { color, radius } from '../theme';
import { openPaywall } from './PaywallSheet';

const SHEET_ID = 'mixes' as const;
const MAX_MIXES = 40;
/** Long-press duration that arms the delete confirm. */
const PRESS_MS = 600;
/** Swipe-left distance that arms it instead. */
const SWIPE_PX = -70;

export function openMixes(): void {
  openSheet(SHEET_ID);
}

export function loadMixes(): SavedMix[] {
  const list = read<SavedMix[]>(KEYS.mixes, []);
  return Array.isArray(list) ? list : [];
}

function saveMixes(list: SavedMix[]): void {
  write(KEYS.mixes, list.slice(0, MAX_MIXES));
}

export function MixesSheet(): React.JSX.Element {
  const { open } = useSheet(SHEET_ID);
  const [name, setName] = useState('');
  const [list, setList] = useState<SavedMix[]>(() => loadMixes());
  const [state, setState] = useState<EngineState>(() => engine.getState());
  const [confirming, setConfirming] = useState<string | null>(null);

  /*
   * 'mix:changed' is an ANIMATION-frequency event: the mixer's sliders emit it
   * on every touch-move. The composition root mounts this sheet for the whole
   * session, so taking the state unconditionally re-rendered the entire tree
   * below — the `current` useMemo, every saved-mix row and its PanResponder —
   * on every tick of every slider drag in the app, with the sheet CLOSED and
   * nobody looking. Gate it on being open, the same way BedsideOverlay.tsx:109
   * gates on isBedsideOpen().
   */
  useBusEvent('mix:changed', (s) => {
    if (isSheetOpen(SHEET_ID)) setState(s);
  });

  /*
   * ...and resync the instant it opens, so gating can never leave the sheet
   * showing state from whenever it was last closed. This runs BEFORE the first
   * painted frame of the open animation (a layout effect isn't needed: `open`
   * flips on the same commit that starts <Sheet>'s 260 ms slide-up, and the
   * panel begins fully off-screen).
   */
  useEffect(() => {
    if (!open) return;
    setState(engine.getState());
    setList(loadMixes());
    setConfirming(null);
  }, [open]);

  const current = useMemo(() => activeLayerIds(state), [state]);

  const refresh = useCallback(() => {
    setList(loadMixes());
    setConfirming(null);
  }, []);

  const doSave = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast('Give the mix a name first');
      return;
    }
    if (!current.length) {
      toast('Turn a layer on before saving');
      return;
    }
    const s = engine.getState();
    const next = loadMixes().filter((m) => m.name.toLowerCase() !== trimmed.toLowerCase());
    next.unshift({
      id: `mix-${Date.now()}`,
      name: trimmed,
      createdAt: Date.now(),
      master: s.master,
      layers: s.layers,
    });
    saveMixes(next);
    setName('');
    toast(`Saved “${trimmed}”`);
    refresh();
  }, [current.length, name, refresh]);

  const applyMix = useCallback((mix: SavedMix) => {
    const locked = (Object.keys(mix.layers) as SoundId[]).filter(
      (id) => mix.layers[id]?.enabled && !Entitlements.isUnlocked(id),
    );
    const layers: Partial<Record<SoundId, (typeof mix.layers)[SoundId]>> = {};
    for (const id of Object.keys(mix.layers) as SoundId[]) {
      if (Entitlements.isUnlocked(id)) layers[id] = mix.layers[id];
    }
    engine.applyMix({ layers });
    if (typeof mix.master === 'number') engine.setMasterVolume(mix.master);
    bus.emit('preset:cleared', {});
    closeSheet(SHEET_ID);
    toast(`Loaded “${mix.name}”`);
    if (locked.length) setTimeout(() => openPaywall({ lockedIds: locked }), 300);
  }, []);

  const deleteMix = useCallback(
    (id: string) => {
      saveMixes(loadMixes().filter((m) => m.id !== id));
      toast('Mix deleted');
      refresh();
    },
    [refresh],
  );

  return (
    <Sheet id={SHEET_ID} label="My mixes">
      <SheetHeader
        title="My mixes"
        eyebrow="Saved sleepscapes"
        onClose={() => closeSheet(SHEET_ID)}
      />

      <View style={styles.saveCard}>
        <Text style={styles.saveCurrent}>
          {current.length ? describeMix(state) : 'Nothing is playing yet'}
        </Text>
        <View style={styles.saveForm}>
          <TextInput
            style={styles.input}
            placeholder="Name this mix"
            placeholderTextColor={color.ink4}
            value={name}
            onChangeText={setName}
            onSubmitEditing={doSave}
            returnKeyType="done"
            maxLength={32}
            accessibilityLabel="Mix name"
          />
          <PrimaryButton onPress={doSave} disabled={current.length === 0}>
            Save
          </PrimaryButton>
        </View>
      </View>

      {list.length === 0 ? (
        <Text style={styles.empty}>
          No saved mixes yet. Build something you like on the mixer, then save it here — it will be
          waiting tomorrow night.
        </Text>
      ) : (
        <>
          <View style={styles.list}>
            {list.map((mix) => (
              <MixRow
                key={mix.id}
                mix={mix}
                confirming={confirming === mix.id}
                onArm={() => setConfirming(mix.id)}
                onKeep={() => setConfirming(null)}
                onDelete={() => deleteMix(mix.id)}
                onPlay={() => applyMix(mix)}
              />
            ))}
          </View>
          <Text style={styles.empty}>Long-press or swipe a mix to delete it.</Text>
        </>
      )}
    </Sheet>
  );
}

interface MixRowProps {
  mix: SavedMix;
  confirming: boolean;
  onArm: () => void;
  onKeep: () => void;
  onDelete: () => void;
  onPlay: () => void;
}

function MixRow({ mix, confirming, onArm, onKeep, onDelete, onPlay }: MixRowProps): React.JSX.Element {
  const accent = useSceneAccent();
  const armedRef = useRef(false);

  /*
   * Latest-ref, the same pattern useBusEvent uses in hooks.ts. The parent hands
   * us a brand-new inline `onArm` closure on every one of its renders, and it
   * was in the deps below — so the whole PanResponder was torn down and rebuilt
   * on every parent render, for every row, while the sheet was open. Reading
   * the freshest handler at call time instead lets the responder be built
   * exactly once per row without ever going stale.
   */
  const onArmRef = useRef(onArm);
  onArmRef.current = onArm;

  // Swipe-left arms the same confirm state the long-press does. Claiming the
  // responder only past a clear horizontal drag keeps the sheet's own
  // drag-to-dismiss (vertical) working underneath.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_e, g) => {
          if (g.dx < SWIPE_PX && !armedRef.current) {
            armedRef.current = true;
            onArmRef.current();
          }
        },
        onPanResponderRelease: () => {
          armedRef.current = false;
        },
        onPanResponderTerminate: () => {
          armedRef.current = false;
        },
      }),
    [],
  );

  if (confirming) {
    return (
      <View style={styles.row}>
        <View style={styles.confirm}>
          <Text style={styles.confirmText}>Delete this mix?</Text>
          <DangerButton onPress={onDelete}>Delete</DangerButton>
          <LinkButton onPress={onKeep}>Keep</LinkButton>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row} {...pan.panHandlers}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Load ${mix.name}`}
        accessibilityHint="Long press to delete"
        onPress={onPlay}
        onLongPress={onArm}
        delayLongPress={PRESS_MS}
        style={({ pressed }) => [styles.main, pressed ? styles.mainPressed : null]}
      >
        <View style={styles.rowText}>
          <Text style={styles.rowName}>{mix.name}</Text>
          <Text style={styles.rowDesc}>{describeMix(mix)}</Text>
        </View>
        <MixPlayIcon size={20} color={accent.accent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  saveCard: {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.cardQuiet,
    padding: 14,
    marginBottom: 18,
  },
  saveCurrent: {
    color: color.ink3,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  saveForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 48,
    color: color.ink,
    fontSize: 15,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    backgroundColor: color.bgLift,
  },
  list: {
    marginBottom: 12,
  },
  row: {
    marginBottom: 8,
  },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 62,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.cardQuiet,
  },
  mainPressed: {
    backgroundColor: color.bgLift,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    color: color.ink,
    fontSize: 15,
    marginBottom: 2,
  },
  rowDesc: {
    color: color.ink3,
    fontSize: 12,
    lineHeight: 18,
  },
  confirm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 62,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.bgLift,
  },
  confirmText: {
    flex: 1,
    color: color.ink2,
    fontSize: 13,
  },
  empty: {
    color: color.ink4,
    fontSize: 12,
    lineHeight: 19,
  },
});
