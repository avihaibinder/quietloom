/**
 * Bottom sheet — visual + gesture port of the web sheet skeleton
 * (src/ui/sheet.js scrim/panel/grip + style.css .sheet-*).
 *
 * The component reads its own open state from the sheet store (useSheet), so
 * the content agent mounts one <Sheet> per id at the root and opens it from
 * anywhere with openSheet(id). It handles its own mount/unmount animation and
 * renders null once fully closed — an idle sheet costs nothing.
 *
 * Gestures, matching the web exactly:
 *   - scrim tap closes;
 *   - drag the panel down to dismiss, but ONLY while the inner scroll is at
 *     the top (otherwise the drag is a scroll);
 *   - upward drag is resisted x0.25 — the sheet is anchored, not free;
 *   - release past 96px dismisses, anything less springs back.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import type { ReactNode } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSheet } from '../hooks';
import { closeSheet } from '../sheets';
import type { SheetId } from '../sheets';
import { color, radius } from '../theme';

/** Web --t-slow: both directions of the slide run 260ms ease-out. */
const SLIDE_MS = 260;
/** Release the drag past this and the sheet dismisses (web: dy > 96). */
const DISMISS_PX = 96;
/** Upward drag resistance (web: dy * 0.25 when dy < 0). */
const UP_RESIST = 0.25;

export interface SheetProps {
  id: SheetId;
  /** Accessibility label for the dialog, e.g. 'Sleep timer'. */
  label: string;
  children: ReactNode;
}

export function Sheet({ id, label, children }: SheetProps): React.JSX.Element | null {
  const { open } = useSheet(id);
  const win = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Stays mounted through the close animation, then unmounts.
  const [rendered, setRendered] = useState(open);

  // One continuous translateY drives open/close AND the drag, so a release
  // past the threshold animates out from wherever the finger left it.
  const translateY = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;

  const panelHeightRef = useRef(0);
  const scrollTopRef = useRef(0);

  useEffect(() => {
    if (open) {
      setRendered(true);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: SLIDE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scrimOpacity, {
          toValue: 1,
          duration: SLIDE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (rendered) {
      // Slide down by the measured panel height (window height before the
      // first layout — only ever the case if we close before measuring).
      const off = panelHeightRef.current > 0 ? panelHeightRef.current : Dimensions.get('window').height;
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: off,
          duration: SLIDE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scrimOpacity, {
          toValue: 0,
          duration: SLIDE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        // A reopen mid-close interrupts this; only unmount if we got there.
        if (finished) setRendered(false);
      });
    }
    // rendered is deliberately in deps: first open flips it and the guard
    // above keeps the extra run a no-op.
  }, [open, rendered, translateY, scrimOpacity]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Claim in the CAPTURE phase so we beat the inner ScrollView — but
        // only for a clearly vertical downward pull while that scroll sits
        // at the top. Taps never move far enough to be claimed, so buttons
        // and sliders inside the sheet keep working.
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          scrollTopRef.current <= 0 && g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx) * 1.2,
        // Once dragging, keep the gesture (the ScrollView will ask for it).
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_e, g) => {
          translateY.setValue(g.dy >= 0 ? g.dy : g.dy * UP_RESIST);
        },
        onPanResponderRelease: (_e, g) => {
          if (g.dy > DISMISS_PX) {
            // The open-state flip runs the close animation from right here.
            closeSheet(id);
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              bounciness: 4,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, { toValue: 0, bounciness: 4, useNativeDriver: true }).start();
        },
      }),
    [id, translateY],
  );

  if (!rendered) return null;

  const onPanelLayout = (e: LayoutChangeEvent): void => {
    panelHeightRef.current = e.nativeEvent.layout.height;
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    scrollTopRef.current = e.nativeEvent.contentOffset.y;
  };

  return (
    <View style={styles.root} pointerEvents="auto">
      <Animated.View style={[styles.scrim, { opacity: scrimOpacity }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close ${label}`}
          style={StyleSheet.absoluteFill}
          onPress={() => closeSheet(id)}
        />
      </Animated.View>

      <KeyboardAvoidingView
        behavior="padding"
        enabled={Platform.OS === 'ios'}
        style={styles.panelHost}
        pointerEvents="box-none"
      >
        <Animated.View
          {...panResponder.panHandlers}
          onLayout={onPanelLayout}
          accessibilityViewIsModal
          accessibilityLabel={label}
          style={[
            styles.panel,
            { maxHeight: Math.min(win.height * 0.88, 780) },
            { transform: [{ translateY }] },
          ]}
        >
          <View style={styles.grip} importantForAccessibility="no" />
          <ScrollView
            onScroll={onScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 26 }]}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 60, // above screens and the bottom bar, under toasts (90)
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(2,3,6,0.66)', // web .sheet-scrim
  },
  panelHost: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  panel: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: color.line2,
    // Web panel is a near-opaque gradient over bgLift; RN gets the midpoint.
    backgroundColor: 'rgba(12,15,23,0.98)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -22 },
    shadowOpacity: 0.9,
    shadowRadius: 30,
    elevation: 24,
  },
  grip: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginTop: 10,
    marginBottom: 2,
  },
  body: {
    paddingTop: 8,
    paddingHorizontal: 20,
  },
});
