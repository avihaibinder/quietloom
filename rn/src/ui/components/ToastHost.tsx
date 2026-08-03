/**
 * Transient message host — port of src/ui/toast.js.
 *
 * Listens for the `toast` bus event. Never more than three on screen; the
 * oldest retires first. Each toast fades/slides in, lives 2900ms, and can be
 * tapped to dismiss early. Rendered ONCE by the composition root, above
 * everything (sheets are z 60, this is 90 — a toast must survive a sheet).
 *
 * Stacked just above the bottom bar, and above the ad banner when one is
 * showing (the web version did this with --banner-h; here we listen to the
 * same 'ads:banner' event).
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBusEvent } from '../hooks';
import { BAR_HEIGHT, color } from '../theme';

const LIFETIME_MS = 2900;
const MAX = 3;
const IN_MS = 260;
const OUT_MS = 240;

interface ToastItem {
  id: number;
  message: string;
}

export function ToastHost(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [bannerH, setBannerH] = useState(0);

  // Refs mirror state so show/retire can run back-to-back within one event
  // without tripping over stale closures.
  const listRef = useRef<ToastItem[]>([]);
  const nextIdRef = useRef(0);
  const animsRef = useRef(new Map<number, Animated.Value>());
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const retiringRef = useRef(new Set<number>());

  const setList = (list: ToastItem[]): void => {
    listRef.current = list;
    setToasts(list);
  };

  const retire = (id: number): void => {
    if (retiringRef.current.has(id)) return;
    retiringRef.current.add(id);

    const timer = timersRef.current.get(id);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(id);

    const anim = animsRef.current.get(id);
    const done = (): void => {
      retiringRef.current.delete(id);
      animsRef.current.delete(id);
      setList(listRef.current.filter((t) => t.id !== id));
    };
    if (anim) {
      Animated.timing(anim, {
        toValue: 0,
        duration: OUT_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(done);
    } else {
      done();
    }
  };

  const show = (message: string): void => {
    // Oldest goes first once we are at capacity (web: retire firstElementChild).
    const alive = listRef.current.filter((t) => !retiringRef.current.has(t.id));
    for (let i = 0; i <= alive.length - MAX; i += 1) retire(alive[i].id);

    nextIdRef.current += 1;
    const id = nextIdRef.current;
    const anim = new Animated.Value(0);
    animsRef.current.set(id, anim);
    setList([...listRef.current, { id, message }]);

    Animated.timing(anim, {
      toValue: 1,
      duration: IN_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    timersRef.current.set(id, setTimeout(() => retire(id), LIFETIME_MS));
  };

  useBusEvent('toast', ({ message }) => {
    if (message) show(String(message));
  });

  // Sit above the ad banner exactly like the web host did with --banner-h.
  useBusEvent('ads:banner', ({ visible, heightPx }) => {
    setBannerH(visible ? Math.max(0, Number(heightPx) || 0) : 0);
  });

  // Never leave timers running after unmount.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.host, { bottom: BAR_HEIGHT + insets.bottom + bannerH + 14 }]}
    >
      {toasts.map((t) => {
        const anim = animsRef.current.get(t.id);
        const animatedStyle = anim
          ? {
              opacity: anim,
              transform: [
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
                { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
              ],
            }
          : null;
        return (
          <Animated.View
            key={t.id}
            style={[styles.toast, { maxWidth: Math.min(win.width * 0.92, 440) }, animatedStyle]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <Pressable accessibilityLabel={`Dismiss: ${t.message}`} onPress={() => retire(t.id)}>
              <Animated.Text style={styles.text}>{t.message}</Animated.Text>
            </Pressable>
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 90, // above sheets (60) and overlays (70)
    alignItems: 'center',
    gap: 8,
  },
  toast: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: color.line2,
    backgroundColor: 'rgba(18,22,31,0.96)', // web one-off .toast bg
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 12,
  },
  text: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    fontSize: 13.5,
    color: color.ink,
    textAlign: 'center',
  },
});
