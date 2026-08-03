/**
 * Sleep timer sheet.
 *
 * Default is 45 minutes, ON. That is a research decision, not a UX one:
 * the evidence supports sound as a sleep-onset aid far better than it supports
 * running noise at yourself all night (research.md §2). Quietloom is designed to
 * turn itself off.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { toast } from '../../core/bus';
import { SleepTimer } from '../../core/timer';
import { getSettings } from '../../core/store';
import { engine } from '../../audio/engine';
import { LinkButton, PrimaryButton, SwitchPill } from '../components/controls';
import { Sheet } from '../components/Sheet';
import { SheetHeader } from '../components/SheetHeader';
import { formatClock, useBusEvent, useSceneAccent, useSettings, useSheet } from '../hooks';
import { closeSheet, isSheetOpen, openSheet } from '../sheets';
import { color, radius } from '../theme';
import { openEvidenceData } from './EvidenceSheet';

const SHEET_ID = 'timer' as const;
const OPTIONS = [15, 30, 45, 60, 90];

export function openTimerSheet(): void {
  openSheet(SHEET_ID);
}

/** One-line summary used by bedside mode. */
export function timerSummary(): string {
  if (SleepTimer.isRunning()) return `${formatClock(SleepTimer.getRemaining())} left`;
  const s = getSettings();
  return s.timerEnabled && s.timerMinutes > 0 ? `Timer ${s.timerMinutes}m` : 'Timer off';
}

/**
 * The bus wiring that used to live in initTimerUI(). Mounted once by the
 * composition root — it has to run whether or not the sheet is on screen.
 */
export function useTimerWiring(): void {
  useBusEvent('audio:started', () => {
    const s = getSettings();
    if (s.timerEnabled && s.timerMinutes > 0) {
      SleepTimer.start(s.timerMinutes, { chime: !!s.chime });
    }
  });

  useBusEvent('audio:stopped', () => {
    if (SleepTimer.isRunning()) SleepTimer.cancel();
  });

  useBusEvent('timer:done', () => {
    toast('Timer finished — fading to quiet');
    // The engine fades on the audio clock; make sure the graph actually stops.
    void Promise.resolve(engine.stop()).catch(() => {
      /* already stopping */
    });
  });
}

const WHY_EVIDENCE = {
  title: 'Why the timer is on by default',
  badge: 'Moderate',
  claim: 'Sound helps you fall asleep. Quiet helps you stay asleep.',
  detail:
    'Broadband sound at 46 dB produced a median 38% reduction in sleep-onset latency versus a 40 dB ambient baseline in a model of transient insomnia.\n\nA systematic review of 38 articles rated the overall evidence that continuous noise improves sleep as very low, and some work suggests continuous noise may shorten deep sleep. The WHO recommends staying below 30 dB(A) of continuous sound in a bedroom overnight.\n\nBoth results can be true. Quietloom resolves the tension by fading itself out after 45 minutes rather than running all night.',
  sources: [
    { label: 'Messineo 2017, Front Neurol', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5742584/' },
    {
      label: 'Riedy 2021, Sleep Medicine Reviews',
      url: 'https://www.sciencedirect.com/science/article/abs/pii/S1087079220301283',
    },
    {
      label: 'WHO Night Noise Guidelines (2009)',
      url: 'https://www.polisnetwork.eu/wp-content/uploads/2019/06/who-night-noise-guidelines.pdf',
    },
  ],
} as const;

export function TimerSheet(): React.JSX.Element {
  const accent = useSceneAccent();
  const { open } = useSheet(SHEET_ID);
  const [settings, patchSettings] = useSettings();
  const [custom, setCustom] = useState('');
  const [remainingSec, setRemainingSec] = useState(() => SleepTimer.getRemaining());
  const [running, setRunning] = useState(() => SleepTimer.isRunning());

  /*
   * The composition root mounts this sheet for the whole session, so an
   * ungated 'timer:tick' re-rendered it once a second for the entire ~45 minute
   * life of the sleep timer — roughly 2,700 renders of a sheet nobody is
   * looking at. Gate it on being open, the same way BedsideOverlay.tsx:106
   * gates its own 'timer:tick' handler on isBedsideOpen().
   *
   * This only gates the RE-RENDER. The countdown itself lives in
   * core/timer.ts on a deadline (`Date.now() + minutes * 60_000`, timer.ts:40)
   * and its setInterval, the fade arming and 'timer:done' are all untouched by
   * anything here — the timer keeps time identically whether or not the sheet
   * is on screen.
   */
  useBusEvent('timer:tick', ({ remainingSec: r }) => {
    if (isSheetOpen(SHEET_ID)) setRemainingSec(r);
  });
  // 'timer:set' and 'timer:done' fire at most a handful of times a session, so
  // they stay ungated — there is nothing to save and it keeps `running` honest.
  useBusEvent('timer:set', () => setRunning(SleepTimer.isRunning()));
  useBusEvent('timer:done', () => {
    setRunning(false);
    setRemainingSec(0);
  });

  /*
   * Resync the instant it opens so the gate above can never show a stale
   * countdown. getRemaining() is computed from the deadline (timer.ts:65-68),
   * not accumulated from ticks, so it is exact no matter how many ticks we
   * skipped while closed.
   */
  useEffect(() => {
    if (!open) return;
    setRemainingSec(SleepTimer.getRemaining());
    setRunning(SleepTimer.isRunning());
  }, [open]);

  const applyChoice = useCallback(
    (minutes: number | null) => {
      if (minutes === null) {
        patchSettings({ timerEnabled: false });
        SleepTimer.cancel();
        toast('Timer off — sound will run until you stop it');
      } else {
        patchSettings({ timerEnabled: true, timerMinutes: minutes });
        if (engine.isRunning()) {
          SleepTimer.start(minutes, { chime: !!getSettings().chime });
          toast(`Fading out in ${minutes} minutes`);
        }
      }
      setRunning(SleepTimer.isRunning());
    },
    [patchSettings],
  );

  const commitCustom = useCallback(() => {
    const v = Math.round(Number(custom));
    if (!Number.isFinite(v) || v < 1) {
      toast('Enter a number of minutes');
      return;
    }
    applyChoice(Math.min(600, v));
  }, [applyChoice, custom]);

  const isCustom = settings.timerEnabled && !OPTIONS.includes(settings.timerMinutes);

  return (
    <Sheet id={SHEET_ID} label="Sleep timer">
      <SheetHeader
        title="Sleep timer"
        eyebrow="Fades out, then silence"
        onClose={() => closeSheet(SHEET_ID)}
      />

      {running ? (
        <View style={styles.live}>
          <Text style={styles.liveLabel}>Fading out in</Text>
          <Text style={[styles.liveValue, { color: accent.accent }]}>
            {formatClock(remainingSec || SleepTimer.getRemaining())}
          </Text>
        </View>
      ) : null}

      <View style={styles.grid}>
        {OPTIONS.map((m) => {
          const active = settings.timerEnabled && settings.timerMinutes === m;
          return (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${m} minutes`}
              onPress={() => applyChoice(m)}
              style={[
                styles.opt,
                active ? { borderColor: accent.accent, backgroundColor: accent.accentSoft } : null,
              ]}
            >
              <Text style={[styles.optValue, active ? { color: accent.accent } : null]}>{m}</Text>
              <Text style={styles.optUnit}>min</Text>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: !settings.timerEnabled }}
          accessibilityLabel="Timer off, all night"
          onPress={() => applyChoice(null)}
          style={[
            styles.opt,
            !settings.timerEnabled
              ? { borderColor: accent.accent, backgroundColor: accent.accentSoft }
              : null,
          ]}
        >
          <Text style={[styles.optValue, !settings.timerEnabled ? { color: accent.accent } : null]}>
            Off
          </Text>
          <Text style={styles.optUnit}>all night</Text>
        </Pressable>
      </View>

      <View style={[styles.custom, isCustom ? { borderColor: accent.accent } : null]}>
        <Text style={styles.customLabel}>Custom</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          placeholder={isCustom ? String(settings.timerMinutes) : '20'}
          placeholderTextColor={color.ink4}
          value={custom}
          onChangeText={setCustom}
          onSubmitEditing={commitCustom}
          returnKeyType="done"
          accessibilityLabel="Custom minutes"
          maxLength={3}
        />
        <PrimaryButton small onPress={commitCustom}>
          Set
        </PrimaryButton>
      </View>

      <View style={styles.card}>
        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Soft chime when it ends</Text>
            <Text style={styles.settingSub}>
              A single quiet tone at the end of the fade. Off by default.
            </Text>
          </View>
          <SwitchPill
            on={!!settings.chime}
            label="Chime when the timer ends"
            onChange={(on) => patchSettings({ chime: on })}
          />
        </View>
      </View>

      <View style={styles.why}>
        <Text style={styles.whyText}>
          Why it defaults to on: sound helps you fall asleep, quiet helps you stay asleep. The trial
          that cut sleep-onset latency by 38% used 46 dB — above the WHO overnight guideline. So
          Quietloom masks the noisy part of the evening and then gets out of the way.
        </Text>
        <LinkButton
          onPress={() =>
            openEvidenceData({
              title: WHY_EVIDENCE.title,
              badge: 'Moderate',
              claim: WHY_EVIDENCE.claim,
              detail: WHY_EVIDENCE.detail,
              sources: [...WHY_EVIDENCE.sources],
            })
          }
        >
          Read the evidence
        </LinkButton>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  live: {
    alignItems: 'center',
    marginBottom: 18,
  },
  liveLabel: {
    color: color.ink3,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  liveValue: {
    fontSize: 40,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  opt: {
    minWidth: 84,
    flexGrow: 1,
    minHeight: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.cardQuiet,
    paddingVertical: 10,
  },
  optValue: {
    color: color.ink,
    fontSize: 20,
    fontWeight: '300',
  },
  optUnit: {
    color: color.ink4,
    fontSize: 11,
    marginTop: 2,
  },
  custom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
  },
  customLabel: {
    color: color.ink2,
    fontSize: 13,
  },
  input: {
    flex: 1,
    minHeight: 48,
    color: color.ink,
    fontSize: 15,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    backgroundColor: color.cardQuiet,
  },
  card: {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.cardQuiet,
    padding: 14,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    color: color.ink,
    fontSize: 14,
    marginBottom: 3,
  },
  settingSub: {
    color: color.ink3,
    fontSize: 12,
    lineHeight: 18,
  },
  why: {
    borderTopWidth: 1,
    borderTopColor: color.line,
    paddingTop: 14,
    alignItems: 'flex-start',
    gap: 10,
  },
  whyText: {
    color: color.ink3,
    fontSize: 12,
    lineHeight: 19,
  },
});
