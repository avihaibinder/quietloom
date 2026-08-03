/**
 * The welcome screen — the Moonrise meadow, the wordmark, and one tap in.
 *
 * There is no chrome here on purpose. The scene is the whole screen and the
 * only interactive thing is the screen itself, so the first thing anyone learns
 * about Quietloom is what it looks like rather than what its buttons do.
 *
 * The copy is deliberately flat. Binding ruling from the Research Lead: nothing
 * anywhere may imply that looking at a screen helps you sleep — the scenes are
 * pleasant, and that is the entire claim. So this says what the app is and
 * invites a tap, and it does not say the moon will do anything for you.
 *
 * Leaving dips through the app's own background colour rather than cross-fading.
 * The scene has to hard-cut from Moonrise back to whatever the sleeper actually
 * uses, and on a near-black palette a dip is invisible where a cut is not.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { color } from '../theme';

/** Long enough to read as intent, short enough that nobody waits for it. */
const DIP_IN_MS = 240;
const DIP_OUT_MS = 420;

/** The hint arrives after the meadow has had a moment to speak for itself. */
const HINT_DELAY_MS = 900;
const HINT_FADE_MS = 700;

interface Props {
  /**
   * The screen has gone dark: swap the scene and mount the mixer behind us.
   * Fired at the peak of the dip, so neither change is ever seen happening.
   */
  onEnter: () => void;
  /** The dip has cleared. Safe to unmount this component. */
  onFinished: () => void;
}

export function WelcomeScreen({ onEnter, onFinished }: Props): React.JSX.Element {
  const dip = useRef(new Animated.Value(0)).current;
  const hint = useRef(new Animated.Value(0)).current;
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(hint, {
        toValue: 1,
        duration: HINT_FADE_MS,
        useNativeDriver: true,
      }).start();
    }, HINT_DELAY_MS);
    return () => clearTimeout(t);
  }, [hint]);

  const enter = useCallback(() => {
    if (leaving) return; // a double tap must not run the sequence twice
    setLeaving(true);

    Animated.timing(dip, {
      toValue: 1,
      duration: DIP_IN_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      onEnter();
      Animated.timing(dip, {
        toValue: 0,
        duration: DIP_OUT_MS,
        useNativeDriver: true,
      }).start(() => onFinished());
    });
  }, [dip, leaving, onEnter, onFinished]);

  // Fades with the dip so the wordmark is gone before the mixer is revealed.
  const contentOpacity = dip.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <View style={styles.root}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={enter}
        accessibilityRole="button"
        accessibilityLabel="Enter Quietloom"
      >
        <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
          <Text style={styles.wordmark}>Quietloom</Text>
          <Text style={styles.tagline}>Living sleepscapes, synthesised in real time.</Text>
          <Animated.Text style={[styles.hint, { opacity: hint }]}>Tap to begin</Animated.Text>
        </Animated.View>
      </Pressable>

      {/* The dip. Above the content, and never in the way of the tap. */}
      <Animated.View pointerEvents="none" style={[styles.dip, { opacity: dip }]} />
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
    zIndex: 30, // over the mixer (0) and the transport bar (20)
  },
  content: {
    flex: 1,
    alignItems: 'center',
    // The moon sits high and a little left, so the type lives in the lower
    // third where the meadow is quiet.
    justifyContent: 'flex-end',
    paddingBottom: '22%',
    paddingHorizontal: 32,
  },
  wordmark: {
    color: color.ink,
    fontSize: 34,
    fontWeight: '300',
    letterSpacing: 5,
  },
  tagline: {
    color: 'rgba(232,237,245,0.56)',
    fontSize: 13.5,
    letterSpacing: 0.3,
    marginTop: 14,
    textAlign: 'center',
  },
  hint: {
    color: 'rgba(232,237,245,0.42)',
    fontSize: 12,
    letterSpacing: 2.2,
    marginTop: 44,
    textTransform: 'uppercase',
  },
  dip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.bg,
  },
});
