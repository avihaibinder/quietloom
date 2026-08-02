/**
 * Sleep timer sheet.
 *
 * Default is 45 minutes, ON. That is a research decision, not a UX one:
 * the evidence supports sound as a sleep-onset aid far better than it supports
 * running noise at yourself all night (research.md §2). Quietloom is designed to
 * turn itself off.
 */

import { bus, toast } from '../core/bus.js';
import { SleepTimer } from '../core/timer.js';
import { getSettings, setSettings } from '../core/store.js';
import { mountSheet, openSheet, closeSheet, sheetHeader, el, isSheetOpen } from './sheet.js';
import { switchEl } from './volume-guide.js';
import { openEvidenceData } from './evidence-ui.js';

const SHEET_ID = 'timer-sheet';
const OPTIONS = [15, 30, 45, 60, 90];

let engine = null;
let body = null;
let barLabel = null;
let remainingSec = 0;

export function initTimerUI(deps) {
  engine = deps.engine;
  body = mountSheet(SHEET_ID, { label: 'Sleep timer' });
  barLabel = document.querySelector('#btn-timer .bar-label');

  document.getElementById('btn-timer')?.addEventListener('click', () => openTimerSheet());

  bus.on('audio:started', () => {
    const s = getSettings();
    if (s.timerEnabled && s.timerMinutes > 0) {
      SleepTimer.start(s.timerMinutes, { chime: !!s.chime });
    }
  });

  bus.on('audio:stopped', () => {
    if (SleepTimer.isRunning()) SleepTimer.cancel();
    remainingSec = 0;
    renderBar();
  });

  bus.on('timer:tick', ({ remainingSec: r }) => {
    remainingSec = r;
    renderBar();
    if (isSheetOpen(SHEET_ID)) updateSheetRemaining();
  });

  bus.on('timer:set', () => {
    if (!SleepTimer.isRunning()) remainingSec = 0;
    renderBar();
  });

  bus.on('timer:done', () => {
    remainingSec = 0;
    renderBar();
    toast('Timer finished — fading to quiet');
    // The engine fades on the audio clock; make sure the graph actually stops.
    Promise.resolve(engine.stop()).catch(() => {});
  });

  renderBar();
}

/* ------------------------------------------------------------------ label */

export function formatClock(sec) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

/** One-line summary used by bedside mode. */
export function timerSummary() {
  if (SleepTimer.isRunning()) return `${formatClock(SleepTimer.getRemaining())} left`;
  const s = getSettings();
  return s.timerEnabled && s.timerMinutes > 0 ? `Timer ${s.timerMinutes}m` : 'Timer off';
}

function renderBar() {
  if (!barLabel) return;
  const btn = document.getElementById('btn-timer');
  if (SleepTimer.isRunning()) {
    barLabel.textContent = formatClock(remainingSec || SleepTimer.getRemaining());
    btn?.classList.add('is-live');
  } else {
    const s = getSettings();
    barLabel.textContent = s.timerEnabled && s.timerMinutes > 0 ? `${s.timerMinutes}m` : 'Timer';
    btn?.classList.remove('is-live');
  }
}

/* ------------------------------------------------------------------ sheet */

export function openTimerSheet() {
  if (!body) return;
  render();
  openSheet(SHEET_ID);
}

function applyChoice(minutes) {
  if (minutes === null) {
    setSettings({ timerEnabled: false });
    SleepTimer.cancel();
    toast('Timer off — sound will run until you stop it');
  } else {
    setSettings({ timerEnabled: true, timerMinutes: minutes });
    if (engine.isRunning()) {
      SleepTimer.start(minutes, { chime: !!getSettings().chime });
      toast(`Fading out in ${minutes} minutes`);
    }
  }
  render();
  renderBar();
}

function updateSheetRemaining() {
  const n = body?.querySelector('#timer-remaining');
  if (n) n.textContent = formatClock(remainingSec);
}

function render() {
  const s = getSettings();
  body.textContent = '';
  body.append(sheetHeader('Sleep timer', { eyebrow: 'Fades out, then silence', onClose: () => closeSheet(SHEET_ID) }));

  if (SleepTimer.isRunning()) {
    const live = el('div', 'timer-live');
    live.append(el('span', 'timer-live-label', 'Fading out in'));
    const v = el('span', 'timer-live-value', formatClock(remainingSec || SleepTimer.getRemaining()));
    v.id = 'timer-remaining';
    live.append(v);
    body.append(live);
  }

  const grid = el('div', 'timer-grid');
  for (const m of OPTIONS) {
    const b = el('button', 'timer-opt');
    b.type = 'button';
    b.append(el('span', 'timer-opt-value', String(m)));
    b.append(el('span', 'timer-opt-unit', 'min'));
    if (s.timerEnabled && s.timerMinutes === m) b.classList.add('active');
    b.addEventListener('click', () => applyChoice(m));
    grid.append(b);
  }

  const off = el('button', 'timer-opt timer-off');
  off.type = 'button';
  off.append(el('span', 'timer-opt-value', 'Off'));
  off.append(el('span', 'timer-opt-unit', 'all night'));
  if (!s.timerEnabled) off.classList.add('active');
  off.addEventListener('click', () => applyChoice(null));
  grid.append(off);
  body.append(grid);

  /* custom */
  const custom = el('div', 'timer-custom');
  const isCustom = s.timerEnabled && !OPTIONS.includes(s.timerMinutes);
  custom.append(el('span', 'timer-custom-label', 'Custom'));
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'text-input num';
  input.min = '1';
  input.max = '600';
  input.step = '1';
  input.placeholder = '20';
  input.setAttribute('aria-label', 'Custom minutes');
  if (isCustom) input.value = String(s.timerMinutes);
  const set = el('button', 'primary-btn small', 'Set');
  set.type = 'button';
  const commit = () => {
    const v = Math.round(Number(input.value));
    if (!Number.isFinite(v) || v < 1) {
      toast('Enter a number of minutes');
      return;
    }
    applyChoice(Math.min(600, v));
  };
  set.addEventListener('click', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit();
  });
  custom.append(input, set);
  if (isCustom) custom.classList.add('active');
  body.append(custom);

  /* chime */
  const card = el('div', 'setting-card');
  const row = el('div', 'setting-row');
  const text = el('div', 'setting-text');
  text.append(el('span', 'setting-title', 'Soft chime when it ends'));
  text.append(el('span', 'setting-sub', 'A single quiet tone at the end of the fade. Off by default.'));
  row.append(text);
  row.append(
    switchEl(
      !!s.chime,
      (on) => {
        setSettings({ chime: on });
        render();
      },
      'Chime when the timer ends',
    ),
  );
  card.append(row);
  body.append(card);

  /* the why */
  const why = el('div', 'why-card');
  why.append(
    el(
      'p',
      'why-text',
      'Why it defaults to on: sound helps you fall asleep, quiet helps you stay asleep. The trial that cut sleep-onset latency by 38% used 46 dB — above the WHO overnight guideline. So Quietloom masks the noisy part of the evening and then gets out of the way.',
    ),
  );
  const link = el('button', 'link-btn', 'Read the evidence');
  link.type = 'button';
  link.addEventListener('click', () => {
    openEvidenceData({
      title: 'Why the timer is on by default',
      badge: 'Moderate',
      claim: 'Sound helps you fall asleep. Quiet helps you stay asleep.',
      detail:
        'Broadband sound at 46 dB produced a median 38% reduction in sleep-onset latency versus a 40 dB ambient baseline in a model of transient insomnia.\n\nA systematic review of 38 articles rated the overall evidence that continuous noise improves sleep as very low, and some work suggests continuous noise may shorten deep sleep. The WHO recommends staying below 30 dB(A) of continuous sound in a bedroom overnight.\n\nBoth results can be true. Quietloom resolves the tension by fading itself out after 45 minutes rather than running all night.',
      sources: [
        { label: 'Messineo 2017, Front Neurol', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5742584/' },
        { label: 'Riedy 2021, Sleep Medicine Reviews', url: 'https://www.sciencedirect.com/science/article/abs/pii/S1087079220301283' },
        { label: 'WHO Night Noise Guidelines (2009)', url: 'https://www.polisnetwork.eu/wp-content/uploads/2019/06/who-night-noise-guidelines.pdf' },
      ],
    });
  });
  why.append(link);
  body.append(why);
}
