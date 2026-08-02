/**
 * Bedside mode.
 *
 * Deep red and amber on near-black — never white, never blue. Light of any kind
 * suppresses melatonin and blue does so far more powerfully; after two hours of
 * exposure, red light let melatonin recover to 26.0 pg/mL while blue held it at
 * 7.5 (research.md §9). If this is the last thing you look at, it should be the
 * least disruptive thing you look at.
 */

import { bus } from '../core/bus.js';
import { SOUND_IDS } from '../audio/engine.js';
import { EVIDENCE } from '../data/evidence.js';
import { Native } from '../services/native.js';
import { pushLayer, popLayer, isLayerOpen } from './sheet.js';
import { timerSummary } from './timer-ui.js';

const KEY = 'bedside';
const DIM_AFTER_MS = 20_000;

let engine = null;
let Scenes = null;
let overlay = null;
let clockEl = null;
let subEl = null;
let clockTimer = null;
let dimTimer = null;
let dimmed = false;

export function initBedside(deps) {
  engine = deps.engine;
  Scenes = deps.Scenes;
  overlay = document.getElementById('bedside-overlay');
  clockEl = document.getElementById('bedside-clock');
  subEl = document.getElementById('bedside-sub');
  if (!overlay) {
    console.warn('[ui] #bedside-overlay missing');
    return;
  }

  document.getElementById('btn-bedside')?.addEventListener('click', () => enterBedside());

  // Tap anywhere exits — unless we are dimmed, in which case the first touch
  // just brings the brightness back.
  overlay.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (dimmed) {
      undim();
      return;
    }
    exitBedside();
  });

  bus.on('timer:tick', () => {
    if (isBedsideOpen()) renderSub();
  });
  bus.on('mix:changed', () => {
    if (isBedsideOpen()) renderSub();
  });
}

export function isBedsideOpen() {
  return isLayerOpen(KEY);
}

export function enterBedside() {
  if (!overlay || isBedsideOpen()) return;

  pushLayer(KEY, exitBedside);
  overlay.classList.remove('hidden');
  void overlay.offsetHeight;
  overlay.classList.add('open');
  document.body.classList.add('bedside-on');

  renderClock();
  renderSub();
  clockTimer = setInterval(() => {
    renderClock();
    renderSub();
  }, 1000);

  try {
    Native.keepAwake(true);
  } catch (err) {
    console.warn('[ui] keepAwake failed', err);
  }

  // main.js owns banner policy; it reconciles off screen:changed. We only
  // collapse our own spacer so nothing reserves space behind the overlay.
  bus.emit('ads:banner', { visible: false, heightPx: 0 });
  bus.emit('screen:changed', { name: 'bedside' });

  try {
    Scenes?.setNightMode(true);
    Scenes?.pause();
  } catch (err) {
    console.warn('[ui] scene pause failed', err);
  }

  armDim();
}

export function exitBedside() {
  if (!overlay || !isBedsideOpen()) return;

  popLayer(KEY);
  overlay.classList.remove('open');
  document.body.classList.remove('bedside-on');
  setTimeout(() => {
    if (!isBedsideOpen()) overlay.classList.add('hidden');
  }, 300);

  if (clockTimer) clearInterval(clockTimer);
  clockTimer = null;
  clearDim();
  undim();

  try {
    Native.keepAwake(false);
  } catch {
    /* stub-safe */
  }

  try {
    Scenes?.setNightMode(false);
    if (engine?.isRunning()) Scenes?.resume();
  } catch {
    /* stub-safe */
  }

  bus.emit('screen:changed', { name: 'mixer' });
}

/* ------------------------------------------------------------------ clock */

function renderClock() {
  if (!clockEl) return;
  const now = new Date();
  let text;
  try {
    text = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    text = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
  clockEl.textContent = text.replace(/\s?(AM|PM)/i, (m) => m.toLowerCase());
}

function renderSub() {
  if (!subEl) return;
  const state = engine?.getState?.() || { layers: {} };
  const playing = SOUND_IDS.filter((id) => state.layers?.[id]?.enabled).map(
    (id) => EVIDENCE[id]?.title || id,
  );
  const what = state.running && playing.length ? playing.join(' · ') : 'Silent';
  subEl.textContent = `${what}  ·  ${timerSummary()}`;
}

/* -------------------------------------------------------------- auto-dim */

function armDim() {
  clearDim();
  dimTimer = setTimeout(() => {
    dimmed = true;
    overlay?.classList.add('dim');
  }, DIM_AFTER_MS);
}

function clearDim() {
  if (dimTimer) clearTimeout(dimTimer);
  dimTimer = null;
}

function undim() {
  dimmed = false;
  overlay?.classList.remove('dim');
  if (isBedsideOpen()) armDim();
}
