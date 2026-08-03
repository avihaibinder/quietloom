/**
 * Breathing pacer.
 *
 * Default is coherence — 6 breaths per minute, 0.1 Hz — because that is the
 * pattern with the strongest evidence: it puts respiration, blood pressure and
 * heart rate in phase at the resonance frequency of the baroreflex. 4-7-8 is
 * offered second, badged Emerging, rather than the other way round.
 *
 * The ocean layer's swell is locked to 10 seconds, which *is* coherence pace —
 * so if ocean is playing we offer to drive the circle straight off the audio.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { engine } from '../../audio/engine';
import { bus } from '../../core/bus';
import { createFrameClock } from '../../core/frameClock';
import { BREATH_EVIDENCE } from '../../data/evidence';
import type { Badge, EngineState } from '../../types';
import { BadgeChip } from '../components/controls';
import { LinkButton } from '../components/controls';
import { CloseIcon } from '../components/icons';
import { useBusEvent, useLayersVersion, useSceneAccent, useSettings } from '../hooks';
import { isLayerOpen, popLayer, pushLayer } from '../layers';
import { openEvidenceData } from '../sheets/EvidenceSheet';
import { color, radius } from '../theme';

const KEY = 'breathing';
/** The pacer runs at its own rate, faster than the 24fps scene. */
const FRAME_MS = 1000 / 30;
/**
 * A gap longer than this was a stall. The pacer times its phases off the rAF
 * timestamp directly rather than off dt, so this clamp is inert here today; it
 * is passed anyway because a clock that can hand back a five-second dt is a
 * trap set for whoever next reaches for the return value.
 */
const MAX_FRAME_MS = 200;
const MIN_SCALE = 0.42;
const SPAN = 0.58; // MIN_SCALE + SPAN = 1

type PatternId = 'coherence' | '478';

interface Phase {
  label: string;
  dur: number;
  kind: 'in' | 'out' | 'hold';
}

interface Pattern {
  id: PatternId;
  name: string;
  sub: string;
  badge: Badge;
  phases: Phase[];
}

const PATTERNS: Record<PatternId, Pattern> = {
  coherence: {
    id: 'coherence',
    name: 'Coherence',
    sub: '6 breaths / min',
    badge: BREATH_EVIDENCE.coherence.badge,
    phases: [
      { label: 'Breathe in', dur: 5, kind: 'in' },
      { label: 'Breathe out', dur: 5, kind: 'out' },
    ],
  },
  '478': {
    id: '478',
    name: '4-7-8',
    sub: '4 in · 7 hold · 8 out',
    badge: BREATH_EVIDENCE['478'].badge,
    phases: [
      { label: 'Breathe in', dur: 4, kind: 'in' },
      { label: 'Hold', dur: 7, kind: 'hold' },
      { label: 'Breathe out', dur: 8, kind: 'out' },
    ],
  },
};

export function isBreathingOpen(): boolean {
  return isLayerOpen(KEY);
}

export function openBreathing(): void {
  if (isBreathingOpen()) return;
  pushLayer(KEY, closeBreathing);
  bus.emit('screen:changed', { name: 'breathing' });
}

export function closeBreathing(): void {
  if (!isBreathingOpen()) return;
  popLayer(KEY);
  bus.emit('screen:changed', { name: 'mixer' });
}

function easeInOut(t: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
}

function oceanAvailableFrom(st: EngineState): boolean {
  if (typeof engine.getOceanPhase !== 'function') return false;
  return !!(st.running && st.layers.ocean?.enabled);
}

/**
 * NEVER call this per frame. `engine.getState()` rebuilds ~23 objects on every
 * call; the answer only changes on 'mix:changed' (which the engine also emits
 * immediately after audio:started / audio:stopped), so it is cached in
 * `oceanRef` and refreshed from that event's payload instead.
 */
function oceanAvailable(): boolean {
  return oceanAvailableFrom(engine.getState());
}

function readOceanPhase(): number {
  try {
    const p = engine.getOceanPhase();
    return Number.isFinite(p) ? ((p % 1) + 1) % 1 : 0;
  } catch {
    return 0;
  }
}

export function BreathingOverlay(): React.JSX.Element | null {
  useLayersVersion();
  const open = isBreathingOpen();
  const accent = useSceneAccent();
  const [settings, patchSettings] = useSettings();

  const initialPattern: PatternId = PATTERNS[settings.breathPattern as PatternId]
    ? (settings.breathPattern as PatternId)
    : 'coherence';

  const [patternId, setPatternId] = useState<PatternId>(initialPattern);
  const [synced, setSynced] = useState(false);
  const [label, setLabel] = useState('Ready');
  const [cycles, setCycles] = useState(0);
  const [canSync, setCanSync] = useState(false);

  /*
   * The circle is driven by an Animated.Value, NOT React state. Constructing it
   * with `useNativeDriver` marks the node native up front (AnimatedValue.js:111
   * -> __makeNative), so every `setValue()` below posts straight to the native
   * animated node and skips the JS style flush — no React render and no
   * reconciliation, ~30 times a second, for as long as the overlay is open.
   * Only things a human reads (the phase label, the breath count) go through
   * React state, and only when they actually change.
   */
  const scaleAnim = useRef(new Animated.Value(MIN_SCALE, { useNativeDriver: true })).current;

  /*
   * The halo's scale and opacity were `scale * 1.18` and
   * `0.18 + 0.3 * (scale - MIN_SCALE)` computed in JS on every render. Both are
   * linear in `scale`, so a linear interpolation over the circle's full range
   * reproduces them EXACTLY (extrapolation is linear too) — on the same native
   * node, off the JS thread.
   */
  const haloScale = useMemo(
    () =>
      scaleAnim.interpolate({
        inputRange: [MIN_SCALE, 1],
        outputRange: [MIN_SCALE * 1.18, 1.18],
      }),
    [scaleAnim],
  );
  const haloOpacity = useMemo(
    () =>
      scaleAnim.interpolate({
        inputRange: [MIN_SCALE, 1],
        outputRange: [0.18, 0.18 + 0.3 * SPAN],
      }),
    [scaleAnim],
  );

  // Loop state that must not trigger renders.
  const raf = useRef(0);
  /**
   * The same clock the scene canvas runs on, at the pacer's own rate. One
   * mounted overlay, one clock — see src/core/frameClock.ts for why this is not
   * written out longhand here any more.
   */
  const clock = useMemo(
    () => createFrameClock({ frameMs: FRAME_MS, maxFrameMs: MAX_FRAME_MS }),
    [],
  );
  /** -1 = "seed me from the next frame's clock". See the note in `tick`. */
  const phaseStart = useRef(-1);
  const phaseIdx = useRef(0);
  const lastOceanPhase = useRef(0);
  const patternRef = useRef(patternId);
  const syncedRef = useRef(synced);
  /** Mirrors `label` so the tick can skip setState when nothing changed. */
  const labelRef = useRef('Ready');
  /** Cached `oceanAvailable()` — refreshed on 'mix:changed', never per frame. */
  const oceanRef = useRef(false);

  patternRef.current = patternId;
  syncedRef.current = synced;

  const showLabel = useCallback((next: string) => {
    if (labelRef.current === next) return;
    labelRef.current = next;
    setLabel(next);
  }, []);

  const refreshOcean = useCallback((st?: EngineState): boolean => {
    const available = st ? oceanAvailableFrom(st) : oceanAvailable();
    oceanRef.current = available;
    setCanSync((prev) => (prev === available ? prev : available));
    return available;
  }, []);

  // 'mix:changed' carries the EngineState, so this costs no extra getState().
  // The engine emits it immediately after audio:started and audio:stopped too
  // (engine.ts:248-249, :263-264), so the cache tracks `running` as well.
  useBusEvent('mix:changed', (st) => {
    if (isBreathingOpen()) refreshOcean(st);
  });

  const tick = useCallback(
    (now: number) => {
      raf.current = requestAnimationFrame(tick);
      // The pacer uses the clock purely as a gate: null means this frame falls
      // inside the cap. Everything below times its phases off `now` itself, so
      // the returned dt is deliberately unused — but `now` still goes to the
      // clock unexamined, and nothing here decides what "the previous frame"
      // was. That used to be written out longhand in this file AND in
      // SceneView, which is exactly how the same clock bug shipped twice.
      if (clock.step(now) === null) return;

      const available = oceanRef.current;

      if (syncedRef.current && available) {
        const p = readOceanPhase();
        if (p < lastOceanPhase.current - 0.5) setCycles((c) => c + 1); // wrapped past the trough
        lastOceanPhase.current = p;
        // 0 = start of inhale, 0.5 = crest
        scaleAnim.setValue(MIN_SCALE + SPAN * (0.5 - 0.5 * Math.cos(2 * Math.PI * p)));
        showLabel(p < 0.5 ? 'Breathe in' : 'Breathe out');
        return;
      }

      if (syncedRef.current) {
        // The ocean stopped underneath us — fall back to the timed pattern.
        syncedRef.current = false;
        setSynced(false);
        phaseStart.current = now;
      }

      // `phaseStart` is compared against `now` below, so it MUST be on the same
      // clock. -1 means "not seeded yet"; seed it from the frame clock itself
      // rather than from any wall-clock reading.
      if (phaseStart.current < 0) phaseStart.current = now;

      const pat = PATTERNS[patternRef.current] ?? PATTERNS.coherence;
      const phase = pat.phases[phaseIdx.current % pat.phases.length];
      const elapsed = (now - phaseStart.current) / 1000;
      if (elapsed >= phase.dur) {
        phaseStart.current = now;
        phaseIdx.current = (phaseIdx.current + 1) % pat.phases.length;
        if (phaseIdx.current === 0) setCycles((c) => c + 1);
        return;
      }
      const t = elapsed / phase.dur;
      if (phase.kind === 'in') scaleAnim.setValue(MIN_SCALE + SPAN * easeInOut(t));
      else if (phase.kind === 'out') scaleAnim.setValue(1 - SPAN * easeInOut(t));
      else scaleAnim.setValue(1);
      showLabel(phase.label);
    },
    [clock, scaleAnim, showLabel],
  );

  const stopLoop = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = 0;
  }, []);

  const startLoop = useCallback(() => {
    if (raf.current) return;
    // Discards however far the clock ran while the loop was cancelled, and
    // primes it so the first frame advances immediately. No timestamp is passed
    // and none can be — see src/core/frameClock.ts.
    clock.reset();
    if (!syncedRef.current) phaseStart.current = -1;
    raf.current = requestAnimationFrame(tick);
  }, [clock, tick]);

  useEffect(() => {
    if (!open) {
      stopLoop();
      return;
    }
    setCycles(0);
    phaseIdx.current = 0;
    phaseStart.current = -1;
    setSynced(false);
    syncedRef.current = false;
    scaleAnim.setValue(MIN_SCALE);
    refreshOcean();
    startLoop();

    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') startLoop();
      else stopLoop();
    });

    return () => {
      sub.remove();
      stopLoop();
    };
  }, [open, refreshOcean, scaleAnim, startLoop, stopLoop]);

  if (!open) return null;

  const setPattern = (id: PatternId) => {
    setPatternId(id);
    patchSettings({ breathPattern: id });
    phaseIdx.current = 0;
    // -1, not Date.now() — the loop reseeds this from its own clock.
    phaseStart.current = -1;
    setCycles(0);
    if (id !== 'coherence') {
      setSynced(false);
      syncedRef.current = false;
    }
  };

  const toggleSync = () => {
    if (!oceanRef.current) return;
    const next = !synced;
    setSynced(next);
    syncedRef.current = next;
    if (next) {
      setPatternId('coherence');
      patchSettings({ breathPattern: 'coherence' });
      setCycles(0);
      lastOceanPhase.current = readOceanPhase();
    } else {
      phaseIdx.current = 0;
      // -1, not Date.now() — the loop reseeds this from its own clock.
      phaseStart.current = -1;
    }
  };

  const ev = BREATH_EVIDENCE[patternId];
  const whyText = synced
    ? 'Following the ocean itself. The swell period is locked to 10 seconds — 0.1 Hz — which is the resonance frequency of the baroreflex.'
    : (ev?.detail ?? '');

  const circle = 220;

  return (
    <View style={styles.overlay}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={closeBreathing}
          hitSlop={12}
          style={styles.close}
        >
          <CloseIcon size={20} color={color.ink2} />
        </Pressable>
      </View>

      <View style={styles.stage}>
        <Animated.View
          style={[
            styles.halo,
            {
              width: circle,
              height: circle,
              borderRadius: circle / 2,
              backgroundColor: accent.accentSoft,
              opacity: haloOpacity,
              transform: [{ scale: haloScale }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.circle,
            {
              width: circle,
              height: circle,
              borderRadius: circle / 2,
              borderColor: accent.accent,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        />
        <View style={styles.inner} pointerEvents="none">
          <Text style={styles.phase}>{label}</Text>
          <Text style={styles.count}>
            {cycles > 0 ? `${cycles} ${cycles === 1 ? 'breath' : 'breaths'}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.bottom}>
        <View style={styles.patterns}>
          {[PATTERNS.coherence, PATTERNS['478']].map((p) => {
            const active = p.id === patternId && !synced;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setPattern(p.id)}
                style={[
                  styles.chip,
                  active
                    ? { borderColor: accent.accent, backgroundColor: accent.accentSoft }
                    : null,
                ]}
              >
                <View style={styles.chipTop}>
                  <Text style={[styles.chipName, active ? { color: accent.accent } : null]}>
                    {p.name}
                  </Text>
                  <BadgeChip badge={p.badge} small />
                </View>
                <Text style={styles.chipSub}>{p.sub}</Text>
              </Pressable>
            );
          })}
        </View>

        {canSync ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: synced }}
            onPress={toggleSync}
            style={[
              styles.sync,
              synced ? { borderColor: accent.accent, backgroundColor: accent.accentSoft } : null,
            ]}
          >
            <Text style={[styles.syncTitle, synced ? { color: accent.accent } : null]}>
              Sync to the waves
            </Text>
            <Text style={styles.syncSub}>The ocean swell is 10 seconds — exactly this pace.</Text>
          </Pressable>
        ) : null}

        <View style={styles.why}>
          <Text style={styles.whyText}>{whyText}</Text>
          <LinkButton
            onPress={() => {
              const entry = BREATH_EVIDENCE[patternId];
              if (entry) openEvidenceData({ ...entry, claim: entry.title }, { eyebrow: 'Breathing' });
            }}
          >
            Read the evidence
          </LinkButton>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(4,6,10,0.94)',
    paddingHorizontal: 20,
    paddingTop: 46,
    paddingBottom: 30,
    zIndex: 70,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
  },
  circle: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  inner: {
    alignItems: 'center',
  },
  phase: {
    color: color.ink,
    fontSize: 19,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  count: {
    color: color.ink4,
    fontSize: 12,
    marginTop: 6,
    minHeight: 16,
  },
  bottom: {
    gap: 12,
  },
  patterns: {
    flexDirection: 'row',
    gap: 10,
  },
  chip: {
    flex: 1,
    minHeight: 62,
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.cardQuiet,
  },
  chipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  chipName: {
    color: color.ink,
    fontSize: 14,
  },
  chipSub: {
    color: color.ink4,
    fontSize: 11,
  },
  sync: {
    minHeight: 62,
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.cardQuiet,
  },
  syncTitle: {
    color: color.ink,
    fontSize: 14,
    marginBottom: 2,
  },
  syncSub: {
    color: color.ink4,
    fontSize: 11,
    lineHeight: 17,
  },
  why: {
    gap: 8,
    alignItems: 'flex-start',
  },
  whyText: {
    color: color.ink3,
    fontSize: 12,
    lineHeight: 19,
  },
});
