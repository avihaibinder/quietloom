/**
 * "Tap the moon" — the evidence card for the Moonrise scene.
 *
 * The scene canvas is pointer-transparent, so this mounts a real focusable
 * button — the same InfoDot affordance every sound layer has — over the moon.
 *
 * On the moon or not at all. The dot is centred on the moon and nowhere else:
 * a dot hunting for clear sky stops reading as "this moon has something to
 * say" and starts reading as a stray control. It is suppressed whenever
 *   - the scene is hidden, i.e. there is no moon on screen to point at. The
 *     mixer draws a flat backdrop, but moonrise stays the selected scene
 *     underneath it and keeps reporting a moon position — so this check is
 *     what stops a dot from floating over an empty gradient,
 *   - moonrise is not the current scene,
 *   - a sheet or an overlay is open (a tap at 3am in bedside mode must exit
 *     bedside, exactly as it does today),
 *   - the app is backgrounded,
 *   - there is no EVIDENCE entry to open,
 *   - the moon has gone below the hill crest (the scene answers that, not us),
 *   - or its 48px box would land on a control. A target on top of a preset chip
 *     or the Premium button is a dead tap, and dead taps at 2am are how an app
 *     loses someone.
 *
 * When it is suppressed the evidence card is still one tap away, from the info
 * dot on the preset note card — see PresetRow.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, useWindowDimensions, View, type LayoutRectangle } from 'react-native';

import { EVIDENCE } from '../../data/evidence';
import { moonTarget } from '../../scenes/moonrise';
import { isHidden, Scenes } from '../../scenes/renderer';
import { InfoDot } from '../components/controls';
import { useBusEvent, useLayersVersion } from '../hooks';
import { anyLayerOpen } from '../layers';
import { openEvidence } from '../sheets/EvidenceSheet';

const SCENE = 'moonrise';
const SIZE = 48; // >=44px target, and the charter's 48px minimum for tired hands
const GAP = 6; // clearance we insist on around any control
const DRIFT_MS = 60_000; // the moon moves ~25px an hour — this is generous
const EDGE = 4;

export interface MoonTapProps {
  /** Boxes the dot must not overlap, in window coordinates. */
  avoidRects?: LayoutRectangle[];
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function overlaps(box: Box, r: LayoutRectangle): boolean {
  return !(
    box.right + GAP <= r.x ||
    box.left - GAP >= r.x + r.width ||
    box.bottom + GAP <= r.y ||
    box.top - GAP >= r.y + r.height
  );
}

export function MoonTap({ avoidRects = [] }: MoonTapProps): React.JSX.Element | null {
  const { width, height } = useWindowDimensions();
  const layersVersion = useLayersVersion();
  const [tick, setTick] = useState(0);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  const bump = useCallback(() => setTick((t) => t + 1), []);

  useBusEvent('scene:changed', bump);
  useBusEvent('screen:changed', bump);

  useEffect(() => {
    const drift = setInterval(bump, DRIFT_MS);
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => {
      clearInterval(drift);
      sub.remove();
    };
  }, [bump]);

  // Re-placed whenever anything that moves it changes.
  void tick;
  void layersVersion;
  void width;
  void height;

  if (!EVIDENCE[SCENE]) return null;
  if (!appActive || anyLayerOpen()) return null;

  let scene: string | null = null;
  try {
    if (isHidden()) return null;
    scene = Scenes.getScene();
  } catch {
    /* renderer is optional */
  }
  if (scene !== SCENE) return null;

  // `occluded` is the scene's own answer about its crest — the UI does not get
  // to keep a second copy of that maths.
  const target = moonTarget();
  if (!target || target.occluded) return null;

  const half = SIZE / 2;
  const box: Box = {
    left: target.x - half,
    top: target.y - half,
    right: target.x + half,
    bottom: target.y + half,
  };

  if (box.left < EDGE || box.top < EDGE) return null;
  if (box.right > width - EDGE || box.bottom > height - EDGE) return null;
  for (const r of avoidRects) {
    if (r.width > 0 && r.height > 0 && overlaps(box, r)) return null;
  }

  return (
    <View style={[styles.host, { left: Math.round(box.left), top: Math.round(box.top) }]}>
      <InfoDot
        label="About the Moonrise scene, and the study behind it"
        onPress={() => openEvidence(SCENE)}
        size={SIZE}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
  },
});
