/**
 * A tappable list of citations. Its own module because both the evidence card
 * and the volume guide render one, and they import each other otherwise.
 *
 * Links go out through Native.openUrl — an in-app browser on device, never a
 * silent failure.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Native } from '../../services/native';
import type { EvidenceSource } from '../../types';
import { ArrowIcon } from '../components/icons';
import { useSceneAccent } from '../hooks';
import { color, radius } from '../theme';

export function SourceList({ sources }: { sources: EvidenceSource[] }): React.JSX.Element {
  const accent = useSceneAccent();
  return (
    <View style={styles.list}>
      <Text style={styles.head}>Sources</Text>
      {sources.map((s) => (
        <Pressable
          key={s.url}
          accessibilityRole="link"
          accessibilityLabel={`${s.label} — opens in a browser`}
          onPress={() => {
            void Native.openUrl(s.url);
          }}
          style={({ pressed }) => [styles.link, pressed ? styles.pressed : null]}
        >
          <Text style={[styles.label, { color: accent.accent }]}>{s.label}</Text>
          <ArrowIcon size={15} color={accent.accent} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: 6,
    marginBottom: 14,
  },
  head: {
    color: color.ink3,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.cardQuiet,
    marginBottom: 8,
  },
  pressed: {
    backgroundColor: color.bgLift,
  },
  label: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
});
