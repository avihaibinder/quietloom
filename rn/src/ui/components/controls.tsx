/**
 * Small shared controls, ported one-for-one from the web build:
 * switchEl (volume-guide.js), infoDot/badgeChip (evidence-ui.js), and the
 * .link-btn / .primary-btn / .danger-btn / .ghost-btn / .notice styles.
 *
 * Everything interactive keeps a >= 48px touch target (hitSlop where the
 * visual is smaller) — tired hands at 2am, per the team charter.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent, StyleProp, TextStyle, ViewStyle } from 'react-native';

import type { Badge } from '../../types';
import { useSceneAccent } from '../hooks';
import { BADGE_COLORS, BADGE_MEANING, color, radius } from '../theme';

/** 'rgba(r,g,b,a)' from a '#rrggbb' token — RN has no color-mix(). */
function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* -------------------------------------------------------------- SwitchPill */

export interface SwitchPillProps {
  on: boolean;
  onChange: (next: boolean) => void;
  /** Accessibility label — what the switch controls, e.g. 'Reduce motion'. */
  label: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The pill switch (web .switch): 52x31 track, 23px knob sliding 21px,
 * accent-tinted when on.
 */
export function SwitchPill({ on, onChange, label, style }: SwitchPillProps): React.JSX.Element {
  const accent = useSceneAccent();
  const anim = useRef(new Animated.Value(on ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: on ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [on, anim]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 21] });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      // 31px tall — pad the target up to 48.
      hitSlop={{ top: 9, bottom: 9, left: 6, right: 6 }}
      onPress={() => onChange(!on)}
      style={[
        styles.switchTrack,
        on
          ? { backgroundColor: withAlpha(accent.accent, 0.58), borderColor: withAlpha(accent.accent, 0.62) }
          : null,
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.switchKnob,
          { transform: [{ translateX }] },
          on ? styles.switchKnobOn : null,
        ]}
      />
    </Pressable>
  );
}

/* ----------------------------------------------------------------- InfoDot */

export interface InfoDotProps {
  /** Accessibility label, e.g. 'Why Rain? The evidence'. */
  label: string;
  onPress: (e: GestureResponderEvent) => void;
  /** Diameter, px. Default 30 (web .info-dot). */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The round 'i' button that opens an evidence sheet. Italic serif 'i', as on
 * the web — it reads as "footnote", not "warning".
 */
export function InfoDot({ label, onPress, size = 30, style }: InfoDotProps): React.JSX.Element {
  const slop = Math.max(0, Math.ceil((48 - size) / 2));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: slop, bottom: slop, left: slop, right: slop }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.infoDot,
        { width: size, height: size, borderRadius: size / 2 },
        pressed ? { transform: [{ scale: 0.9 }] } : null,
        style,
      ]}
    >
      <Text style={styles.infoDotText}>i</Text>
    </Pressable>
  );
}

/* --------------------------------------------------------------- BadgeChip */

export interface BadgeChipProps {
  badge: Badge;
  /** Web .badge-sm — the size used inline on layer cards. */
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Colour-coded evidence badge (web .badge / badgeChip()). */
export function BadgeChip({ badge, small = false, style }: BadgeChipProps): React.JSX.Element {
  const c = BADGE_COLORS[badge];
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${badge} evidence. ${BADGE_MEANING[badge]}`}
      style={[
        styles.badge,
        small ? styles.badgeSm : null,
        { backgroundColor: c.background, borderColor: c.border },
        style,
      ]}
    >
      <Text style={[styles.badgeText, small ? styles.badgeTextSm : null, { color: c.color }]}>
        {badge}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------- LinkButton */

export interface LinkButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  /** Web .link-btn.inline — underlined, sits inside running text. */
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/** Accent text button (web .link-btn), e.g. 'Read the evidence'. */
export function LinkButton({
  children,
  onPress,
  inline = false,
  style,
  textStyle,
}: LinkButtonProps): React.JSX.Element {
  const accent = useSceneAccent();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
      onPress={onPress}
      style={({ pressed }) => [styles.linkBtn, pressed ? { opacity: 0.6 } : null, style]}
    >
      <Text
        style={[
          styles.linkText,
          { color: accent.accent },
          inline ? styles.linkTextInline : null,
          textStyle,
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

/* ----------------------------------------------------------- PrimaryButton */

export interface PrimaryButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  /** Web .primary-btn.small. */
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/** Filled accent button (web .primary-btn) — 'Set', 'Unlock', etc. */
export function PrimaryButton({
  children,
  onPress,
  disabled = false,
  small = false,
  style,
  textStyle,
}: PrimaryButtonProps): React.JSX.Element {
  const accent = useSceneAccent();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryBtn,
        small ? styles.primaryBtnSmall : null,
        { backgroundColor: accent.accent },
        pressed ? { transform: [{ scale: 0.97 }] } : null,
        disabled ? { opacity: 0.35 } : null,
        style,
      ]}
    >
      <Text style={[styles.primaryText, small ? styles.primaryTextSmall : null, textStyle]}>
        {children}
      </Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------ DangerButton */

export interface DangerButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/** Muted destructive button (web .danger-btn) — 'Delete mix' etc. */
export function DangerButton({
  children,
  onPress,
  style,
  textStyle,
}: DangerButtonProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={{ top: 4, bottom: 4 }}
      onPress={onPress}
      style={({ pressed }) => [styles.dangerBtn, pressed ? { opacity: 0.7 } : null, style]}
    >
      <Text style={[styles.dangerText, textStyle]}>{children}</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------- GhostButton */

export interface GhostButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  /**
   * Accent-tinted state (web .ghost-btn.is-owned / .is-pass) — the header
   * pill when Premium is owned or a Night Pass is active.
   */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/** Translucent pill button (web .ghost-btn) — the header 'Premium' pill. */
export function GhostButton({
  children,
  onPress,
  active = false,
  style,
  textStyle,
}: GhostButtonProps): React.JSX.Element {
  const accent = useSceneAccent();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={{ top: 4, bottom: 4 }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.ghostBtn,
        active ? { backgroundColor: accent.accentSoft, borderColor: accent.accentSoft } : null,
        pressed ? { transform: [{ scale: 0.96 }] } : null,
        style,
      ]}
    >
      <Text style={[styles.ghostText, active ? { color: accent.accent } : null, textStyle]}>
        {children}
      </Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ Notice */

export interface NoticeProps {
  /** Strings or nested <Text> runs (nested Text inherits the card's style). */
  children: React.ReactNode;
  /** Web .notice-warn — the amber variant ('Headphones required.'). */
  warn?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/** Left-quiet info card (web .notice / .notice-warn). */
export function Notice({ children, warn = false, style, textStyle }: NoticeProps): React.JSX.Element {
  return (
    <View style={[styles.notice, warn ? styles.noticeWarn : null, style]}>
      <Text style={[styles.noticeText, textStyle]}>{children}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ styles */

const styles = StyleSheet.create({
  /* switch */
  switchTrack: {
    width: 52,
    height: 31,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: color.line2,
    justifyContent: 'center',
  },
  switchKnob: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 23,
    height: 23,
    borderRadius: 999,
    backgroundColor: color.ink3,
  },
  switchKnobOn: {
    backgroundColor: '#f2f6fc', // web one-off: the lit knob
  },

  /* info dot */
  infoDot: {
    borderWidth: 1,
    borderColor: color.line2,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoDotText: {
    fontSize: 12,
    fontWeight: '700',
    fontStyle: 'italic',
    fontFamily: 'serif', // Georgia on the web; the platform serif reads the same
    color: color.ink3,
  },

  /* badge */
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 2.5,
    paddingHorizontal: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeSm: {
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.22,
  },
  badgeTextSm: {
    fontSize: 10,
  },

  /* link */
  linkBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '500',
  },
  linkTextInline: {
    textDecorationLine: 'underline',
  },

  /* primary */
  primaryBtn: {
    alignSelf: 'flex-start',
    minHeight: 46,
    paddingHorizontal: 20,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnSmall: {
    minHeight: 42,
    paddingHorizontal: 16,
  },
  primaryText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: color.bg, // dark text on the accent fill, as on the web
  },
  primaryTextSmall: {
    fontSize: 13.5,
  },

  /* danger */
  dangerBtn: {
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(224,138,134,0.35)',
    backgroundColor: 'rgba(224,138,134,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: color.danger,
  },

  /* ghost */
  ghostBtn: {
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingHorizontal: 15,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: color.line2,
    backgroundColor: color.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.13,
    color: color.ink2,
  },

  /* notice */
  notice: {
    marginTop: 6,
    marginBottom: 12,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.line2,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  noticeWarn: {
    borderColor: 'rgba(228,184,119,0.28)',
    backgroundColor: 'rgba(228,184,119,0.07)',
  },
  noticeText: {
    fontSize: 12.5,
    lineHeight: 19,
    color: color.ink2,
  },
});
