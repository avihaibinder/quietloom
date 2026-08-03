/**
 * Labelled slider row — port of addSlider() in src/ui/mixer.js.
 *
 * Header: label left, live formatted value right (accent). Below, a
 * full-width slider; optional hint line underneath.
 *
 * CRITICAL sync semantics, carried over from the web build: while the user
 * is sliding, external `value` prop changes must NOT yank the thumb. Every
 * onChange echoes back through the engine as a mix:changed re-render within
 * a frame or two — if we fed that echo straight back into the native slider
 * the thumb would stutter under the finger. So the thumb only follows the
 * prop when no drag is in flight (the web version's `dataset.dragging`).
 */

import Slider from '@react-native-community/slider';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useSceneAccent } from '../hooks';
import { color } from '../theme';

export interface SliderRowProps {
  label: string;
  /** Small hint under the track, e.g. 'Drizzle to downpour'. */
  hint?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  /** Formats the header value, e.g. v => `${Math.round(v)} Hz`. */
  format: (v: number) => string;
  /** Fired continuously while sliding (the web 'input' event). */
  onChange: (v: number) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

function SliderRowBase({
  label,
  hint,
  min,
  max,
  step,
  value,
  format,
  onChange,
  disabled = false,
  style,
}: SliderRowProps): React.JSX.Element {
  const accent = useSceneAccent();

  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  // What the finger last reported — drives the header text during a drag.
  const [dragValue, setDragValue] = useState(value);
  // What we hand the native control — frozen while dragging (see doc above).
  const [sliderValue, setSliderValue] = useState(value);

  useEffect(() => {
    if (!draggingRef.current) setSliderValue(value);
  }, [value]);

  const shown = dragging ? dragValue : value;

  return (
    <View style={[styles.row, disabled ? styles.disabled : null, style]}>
      <View style={styles.head}>
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        <Text style={[styles.value, { color: accent.accent }]}>{format(shown)}</Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={sliderValue}
        disabled={disabled}
        minimumTrackTintColor={accent.accent}
        maximumTrackTintColor={color.line2}
        thumbTintColor={accent.accent}
        accessibilityLabel={label}
        onSlidingStart={(v: number) => {
          draggingRef.current = true;
          setDragging(true);
          setDragValue(v);
        }}
        onValueChange={(v: number) => {
          if (draggingRef.current) setDragValue(v);
          onChange(v);
        }}
        onSlidingComplete={(v: number) => {
          draggingRef.current = false;
          setDragging(false);
          setSliderValue(v);
          onChange(v);
        }}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/**
 * Memoised on a shallow prop compare, which here IS a value compare: every
 * prop is a primitive except `format`, `onChange` and `style`, and all three
 * are stable at both call sites (module-constant formatters, useCallback'd
 * handlers, StyleSheet refs). So a card that re-renders because its level
 * moved no longer re-renders its other sliders.
 *
 * This does not touch the drag path. The thumb is still driven by this
 * component's own state at the full rate of the native onValueChange, and
 * nothing about the engine call is throttled or deferred.
 */
export const SliderRow = React.memo(SliderRowBase);

const styles = StyleSheet.create({
  row: {
    marginTop: 2,
  },
  disabled: {
    opacity: 0.45,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.48, // 0.04em of 12px
    color: color.ink3,
  },
  value: {
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
  },
  slider: {
    width: '100%',
    height: 44, // the web track row was 44px tall — also our touch target
  },
  hint: {
    marginTop: -4,
    fontSize: 11.5,
    color: color.ink4,
  },
});
