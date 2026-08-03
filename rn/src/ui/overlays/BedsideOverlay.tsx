/**
 * Bedside mode.
 *
 * Deep red and amber on near-black — never white, never blue. Light of any kind
 * suppresses melatonin and blue does so far more powerfully; after two hours of
 * exposure, red light let melatonin recover to 26.0 pg/mL while blue held it at
 * 7.5 (research.md §9). If this is the last thing you look at, it should be the
 * least disruptive thing you look at.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';

import { engine } from '../../audio/engine';
import { bus } from '../../core/bus';
import { EVIDENCE } from '../../data/evidence';
import { Scenes } from '../../scenes/renderer';
import { Native } from '../../services/native';
import { SOUND_IDS } from '../../types';
import { useBusEvent, useLayersVersion } from '../hooks';
import { isLayerOpen, popLayer, pushLayer } from '../layers';
import { timerSummary } from '../sheets/TimerSheet';
import { color } from '../theme';

const KEY = 'bedside';
const DIM_AFTER_MS = 20_000;
const DIM_OPACITY = 0.55;

export function isBedsideOpen(): boolean {
  return isLayerOpen(KEY);
}

export function enterBedside(): void {
  if (isBedsideOpen()) return;
  pushLayer(KEY, exitBedside);

  try {
    void Native.keepAwake(true);
  } catch (err) {
    console.warn('[ui] keepAwake failed', err);
  }

  // main.js owns banner policy; it reconciles off screen:changed. We only
  // collapse our own spacer so nothing reserves space behind the overlay.
  bus.emit('ads:banner', { visible: false, heightPx: 0 });
  bus.emit('screen:changed', { name: 'bedside' });

  try {
    Scenes.setNightMode(true);
    Scenes.pause();
  } catch (err) {
    console.warn('[ui] scene pause failed', err);
  }
}

export function exitBedside(): void {
  if (!isBedsideOpen()) return;
  popLayer(KEY);

  try {
    void Native.keepAwake(false);
  } catch {
    /* stub-safe */
  }

  try {
    Scenes.setNightMode(false);
    if (engine.isRunning()) Scenes.resume();
  } catch {
    /* stub-safe */
  }

  bus.emit('screen:changed', { name: 'mixer' });
}

function clockText(): string {
  const now = new Date();
  try {
    return now
      .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      .replace(/\s?(AM|PM)/i, (m) => m.toLowerCase());
  } catch {
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
}

export function BedsideOverlay(): React.JSX.Element | null {
  useLayersVersion(); // re-render when the layer stack changes
  const open = isBedsideOpen();

  const [clock, setClock] = useState(clockText);
  const [sub, setSub] = useState('');
  const [dimmed, setDimmed] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const dimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const renderSub = useCallback(() => {
    const state = engine.getState();
    const playing = SOUND_IDS.filter((id) => state.layers[id]?.enabled).map(
      (id) => EVIDENCE[id]?.title ?? id,
    );
    const what = state.running && playing.length ? playing.join(' · ') : 'Silent';
    setSub(`${what}  ·  ${timerSummary()}`);
  }, []);

  useBusEvent('timer:tick', () => {
    if (isBedsideOpen()) renderSub();
  });
  useBusEvent('mix:changed', () => {
    if (isBedsideOpen()) renderSub();
  });

  const armDim = useCallback(() => {
    if (dimTimer.current) clearTimeout(dimTimer.current);
    dimTimer.current = setTimeout(() => setDimmed(true), DIM_AFTER_MS);
  }, []);

  useEffect(() => {
    if (!open) {
      setDimmed(false);
      if (dimTimer.current) clearTimeout(dimTimer.current);
      dimTimer.current = null;
      return;
    }

    setClock(clockText());
    renderSub();
    armDim();
    const tick = setInterval(() => {
      setClock(clockText());
      renderSub();
    }, 1000);

    return () => {
      clearInterval(tick);
      if (dimTimer.current) clearTimeout(dimTimer.current);
      dimTimer.current = null;
    };
  }, [armDim, open, renderSub]);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: dimmed ? DIM_OPACITY : 1,
      duration: 900,
      useNativeDriver: true,
    }).start();
    if (!dimmed && open) armDim();
  }, [armDim, dimmed, opacity, open]);

  if (!open) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={dimmed ? 'Brighten bedside mode' : 'Exit bedside mode'}
        style={styles.press}
        // Tap anywhere exits — unless we are dimmed, in which case the first
        // touch just brings the brightness back.
        onPress={() => {
          if (dimmed) setDimmed(false);
          else exitBedside();
        }}
      >
        <Text style={styles.clock}>{clock}</Text>
        <Text style={styles.sub}>{sub}</Text>
        <Text style={styles.hint}>TAP ANYWHERE TO EXIT</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.bedsideBg,
    zIndex: 80,
  },
  press: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  clock: {
    color: color.bedsideClock,
    fontSize: 96,
    fontWeight: '200',
    letterSpacing: -4,
    fontVariant: ['tabular-nums'],
  },
  sub: {
    color: color.bedsideSub,
    fontSize: 13,
    letterSpacing: 0.8,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 320,
  },
  hint: {
    color: color.bedsideHint,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 26,
  },
});
