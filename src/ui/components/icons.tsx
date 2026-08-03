/**
 * SVG icons, path data copied VERBATIM from the web build (index.html,
 * sheet.js, evidence-ui.js, mixer.js) so the two apps stay pixel-identical.
 *
 * Stroke icons mirror the web `.ico` styles: fill none, stroke = color,
 * round caps/joins, width 1.7. Play/Pause/MixPlay are the filled ones
 * (`.play-btn .ico` / preset chips used fill: currentColor, stroke: none).
 */

import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { color as theme } from '../theme';

export interface IconProps {
  /** Rendered width and height, px. Default 21 (the web .bar-btn .ico). */
  size?: number;
  /** Stroke color (or fill, for the filled icons). Default theme ink. */
  color?: string;
  /** Stroke width. Ignored by the filled icons. Default 1.7 (web .ico). */
  strokeWidth?: number;
}

/** Shared stroke props so every outline icon matches the web .ico exactly. */
function strokeProps(color: string, strokeWidth: number) {
  return {
    stroke: color,
    strokeWidth,
    fill: 'none',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;
}

/** Filled play triangle (web #btn-play .ico-play). */
export function PlayIcon({ size = 21, color = theme.ink }: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8.5 5.2v13.6L19 12z" fill={color} />
    </Svg>
  );
}

/** Filled pause bars (web #btn-play .ico-pause). */
export function PauseIcon({ size = 21, color = theme.ink }: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8 5h3.1v14H8zM12.9 5H16v14h-3.1z" fill={color} />
    </Svg>
  );
}

/** Stopwatch (web #btn-timer). */
export function TimerIcon({
  size = 21,
  color = theme.ink,
  strokeWidth = 1.7,
}: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={13.4} r={7.1} {...strokeProps(color, strokeWidth)} />
      <Path d="M12 9.8v3.6l2.5 1.5M9.5 3.2h5" {...strokeProps(color, strokeWidth)} />
    </Svg>
  );
}

/** Concentric circles (web #btn-breathe). */
export function BreatheIcon({
  size = 21,
  color = theme.ink,
  strokeWidth = 1.7,
}: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={8.2} {...strokeProps(color, strokeWidth)} />
      <Circle cx={12} cy={12} r={3.4} {...strokeProps(color, strokeWidth)} />
    </Svg>
  );
}

/** Crescent moon (web #btn-bedside). */
export function BedsideIcon({
  size = 21,
  color = theme.ink,
  strokeWidth = 1.7,
}: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M19.6 14.5A7.7 7.7 0 0 1 9.5 4.4a7.9 7.9 0 1 0 10.1 10.1z"
        {...strokeProps(color, strokeWidth)}
      />
    </Svg>
  );
}

/** Padlock (web mixer.js / presets-ui.js locked toggles). */
export function LockIcon({
  size = 21,
  color = theme.ink,
  strokeWidth = 1.7,
}: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={5} y={10.5} width={14} height={9.5} rx={2.4} {...strokeProps(color, strokeWidth)} />
      <Path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" {...strokeProps(color, strokeWidth)} />
    </Svg>
  );
}

/** The × cross (web .sheet-close). Two strokes, drawn as one path. */
export function CloseIcon({
  size = 15,
  color = theme.ink2,
  strokeWidth = 1.8,
}: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6.6 6.6l10.8 10.8M17.4 6.6L6.6 17.4" {...strokeProps(color, strokeWidth)} />
    </Svg>
  );
}

/** Outbound ↗ arrow (web .source-arrow — evidence citation links). */
export function ArrowIcon({
  size = 15,
  color = theme.ink,
  strokeWidth = 1.7,
}: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 17L17 7M9 7h8v8" {...strokeProps(color, strokeWidth)} />
    </Svg>
  );
}

/** Small filled play triangle used on preset/mix chips. */
export function MixPlayIcon({ size = 21, color = theme.ink }: IconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9 6.4v11.2L18 12z" fill={color} />
    </Svg>
  );
}
