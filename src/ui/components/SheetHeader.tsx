/**
 * Sheet header — port of sheetHeader() in src/ui/sheet.js (web .sheet-head):
 * big title, small uppercase eyebrow above it, round × close button top-right.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSceneAccent } from '../hooks';
import { color } from '../theme';
import { CloseIcon } from './icons';

export interface SheetHeaderProps {
  title: string;
  /** Small uppercase kicker above the title, e.g. 'Safe listening'. */
  eyebrow?: string;
  /** When present, renders the round close button. */
  onClose?: () => void;
}

export function SheetHeader({ title, eyebrow, onClose }: SheetHeaderProps): React.JSX.Element {
  const accent = useSceneAccent();
  return (
    <View style={styles.head}>
      <View style={styles.text}>
        {eyebrow ? (
          <Text style={[styles.eyebrow, { color: accent.accent }]}>{eyebrow.toUpperCase()}</Text>
        ) : null}
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      </View>
      {onClose ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          // 34px visual, 48px target.
          hitSlop={{ top: 7, bottom: 7, left: 7, right: 7 }}
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed ? { transform: [{ scale: 0.9 }] } : null]}
        >
          <CloseIcon size={15} color={color.ink2} strokeWidth={1.8} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    paddingTop: 4,
    paddingBottom: 14,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.32, // 0.12em of 11px
    marginBottom: 5,
  },
  title: {
    fontSize: 23,
    fontWeight: '500',
    letterSpacing: -0.55,
    lineHeight: 28,
    color: color.ink,
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: color.line2,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
