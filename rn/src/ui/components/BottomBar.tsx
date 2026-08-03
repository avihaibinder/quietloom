/**
 * The fixed transport bar — port of #bottom-bar + wirePlay() from
 * src/ui/index.js: the Play/Pause pill plus Timer / Breathe / Bedside.
 *
 * The engine singleton is imported directly (same as the web build); the
 * timer, entitlement and layer decisions stay with the callers via props so
 * this component never grows screen logic.
 */

import React, { useEffect, useReducer, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { engine } from '../../audio/engine';
import { toast } from '../../core/bus';
import { SleepTimer } from '../../core/timer';
import { SOUND_IDS } from '../../types';
import type { EngineState } from '../../types';
import { formatClock, useBusEvent, useSceneAccent, useSettings } from '../hooks';
import { BAR_HEIGHT, color } from '../theme';
import { BedsideIcon, BreatheIcon, PauseIcon, PlayIcon, TimerIcon } from './icons';

export interface BottomBarProps {
  /**
   * Called when Play is hit with no layer enabled — the content agent
   * applies the default preset here (a free one, on purpose: a first launch
   * that opens on a locked sleepscape reads as a paywall).
   */
  onEmptyPlay: () => void;
  onTimerPress: () => void;
  onBreathePress: () => void;
  onBedsidePress: () => void;
  /**
   * Slide the bar off-screen (fullscreen overlays: bedside, breathing).
   * The composition root decides; the bar just obeys.
   */
  hidden?: boolean;
}

function anyLayerOn(state: EngineState): boolean {
  return SOUND_IDS.some((id) => state.layers[id]?.enabled === true);
}

export function BottomBar({
  onEmptyPlay,
  onTimerPress,
  onBreathePress,
  onBedsidePress,
  hidden = false,
}: BottomBarProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const accent = useSceneAccent();
  const [settings] = useSettings();

  const [playing, setPlaying] = useState<boolean>(() => engine.isRunning());
  const [busy, setBusy] = useState(false);
  // Ref, not state: two taps can land inside one render (web `busy` guard).
  const busyRef = useRef(false);

  const [remainingSec, setRemainingSec] = useState(0);
  const [, bump] = useReducer((n: number) => n + 1, 0);

  useBusEvent('audio:started', () => setPlaying(true));
  useBusEvent('audio:stopped', () => setPlaying(false));
  useBusEvent('timer:tick', ({ remainingSec: r }) => setRemainingSec(r));
  useBusEvent('timer:set', () => {
    if (!SleepTimer.isRunning()) setRemainingSec(0);
    bump();
  });
  useBusEvent('timer:done', () => {
    setRemainingSec(0);
    bump();
  });

  const onPlayPress = async (): Promise<void> => {
    if (busyRef.current) return; // start/stop are async — never overlap them
    busyRef.current = true;
    setBusy(true);
    try {
      if (engine.isRunning()) {
        await engine.stop();
      } else {
        if (!anyLayerOn(engine.getState())) onEmptyPlay();
        await engine.start();
      }
    } catch (err) {
      console.error('[ui] play failed', err);
      toast('Could not start audio — tap again');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  /* Timer label: live countdown > configured minutes > plain 'Timer'. */
  const timerLive = SleepTimer.isRunning();
  const timerLabel = timerLive
    ? formatClock(remainingSec > 0 ? remainingSec : SleepTimer.getRemaining())
    : settings.timerEnabled && settings.timerMinutes > 0
      ? `${settings.timerMinutes}m`
      : 'Timer';

  /* Hide/show slide. */
  const hide = useRef(new Animated.Value(hidden ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(hide, {
      toValue: hidden ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [hidden, hide]);
  const translateY = hide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, BAR_HEIGHT + insets.bottom + 24],
  });

  const barHeight = BAR_HEIGHT + insets.bottom;

  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'box-none'}
      style={[
        styles.bar,
        { height: barHeight, paddingBottom: insets.bottom + 10, transform: [{ translateY }] },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pause' : 'Play'}
        accessibilityState={{ busy }}
        onPress={() => {
          void onPlayPress();
        }}
        style={({ pressed }) => [
          styles.playBtn,
          { backgroundColor: accent.accent, shadowColor: accent.accent },
          pressed ? { transform: [{ scale: 0.975 }] } : null,
          busy ? { opacity: 0.6 } : null,
        ]}
      >
        {playing ? (
          <PauseIcon size={20} color={color.bg} />
        ) : (
          <PlayIcon size={20} color={color.bg} />
        )}
        <Text style={styles.playLabel}>{playing ? 'Pause' : 'Play'}</Text>
      </Pressable>

      <BarButton
        label={timerLabel}
        accessibilityLabel="Sleep timer"
        live={timerLive}
        liveColor={accent.accent}
        onPress={onTimerPress}
        icon={<TimerIcon size={21} color={timerLive ? accent.accent : color.ink3} strokeWidth={1.6} />}
      />
      <BarButton
        label="Breathe"
        accessibilityLabel="Breathing pacer"
        onPress={onBreathePress}
        icon={<BreatheIcon size={21} color={color.ink3} strokeWidth={1.6} />}
      />
      <BarButton
        label="Bedside"
        accessibilityLabel="Bedside mode"
        onPress={onBedsidePress}
        icon={<BedsideIcon size={21} color={color.ink3} strokeWidth={1.6} />}
      />
    </Animated.View>
  );
}

/* ------------------------------------------------------------- bar button */

interface BarButtonProps {
  label: string;
  accessibilityLabel: string;
  icon: React.ReactNode;
  onPress: () => void;
  live?: boolean;
  liveColor?: string;
}

function BarButton({
  label,
  accessibilityLabel,
  icon,
  onPress,
  live = false,
  liveColor,
}: BarButtonProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.barBtn,
        pressed ? { backgroundColor: 'rgba(255,255,255,0.05)' } : null,
      ]}
    >
      {icon}
      <Text style={[styles.barLabel, live && liveColor ? { color: liveColor } : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ styles */

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    paddingHorizontal: 14,
    // Web used a blurred gradient; RN gets the gradient's settled tone.
    backgroundColor: 'rgba(5,7,12,0.94)',
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  playBtn: {
    flex: 1,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 999,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 8,
  },
  playLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.15,
    color: color.bg, // dark text on the accent fill
  },
  barBtn: {
    width: 62,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 14,
  },
  barLabel: {
    fontSize: 10.5,
    letterSpacing: 0.11,
    fontVariant: ['tabular-nums'],
    color: color.ink3,
  },
});
