/**
 * UI composition root.
 *
 * main.js calls `initUI({ engine, Scenes })` once, after `Scenes.attach(canvas)`.
 * Nothing here touches the audio graph before a user gesture — the play button
 * is the gesture that calls engine.start().
 */

import { bus, toast } from '../core/bus.js';
import { SOUND_IDS } from '../audio/engine.js';
import { SleepTimer } from '../core/timer.js';
import { KEYS, read, write, getSettings, setSettings } from '../core/store.js';
import { Entitlements } from '../services/entitlements.js';

import { initToasts } from './toast.js';
import { initEvidenceSheet, openBadgeLegend } from './evidence-ui.js';
import { initVolumeGuide } from './volume-guide.js';
import { initPaywall, openPaywall } from './paywall.js';
import { initMixes } from './mixes-ui.js';
import { initPresets, applyPreset } from './presets-ui.js';
import { initMixer } from './mixer.js';
import { initTimerUI } from './timer-ui.js';
import { initBedside } from './bedside.js';
import { initBreathing } from './breathing.js';
import { initMoonTap } from './moon-tap.js';
import { closeTopSheet, anyLayerOpen, el } from './sheet.js';
import { switchEl } from './volume-guide.js';
import { Ads } from '../services/ads.js';

export { closeTopSheet, anyLayerOpen };

// Deliberately a free preset. A first-ever launch that opens on a locked
// sleepscape reads as a paywall, and the upsell lands better once someone has
// actually heard how good the free tier sounds.
const DEFAULT_PRESET = 'rainfall';

let engine = null;
let Scenes = null;
let busy = false;

export function initUI(deps = {}) {
  engine = deps.engine;
  Scenes = deps.Scenes;
  if (!engine) {
    console.error('[ui] initUI needs { engine, Scenes }');
    return {};
  }

  // Harmless if main.js already did it; the timer needs the engine for fades.
  SleepTimer.bind(engine);

  initToasts();
  initEvidenceSheet();
  initVolumeGuide();
  initPaywall();
  initMixes({ engine });
  initPresets({ engine, Scenes });
  initMixer({ engine });
  initTimerUI({ engine });
  initBedside({ engine, Scenes });
  initBreathing({ engine });

  wireHeader();
  wireMotionRow();
  wirePlay();
  wireBanner();
  wireSceneFollow();
  restoreSession();
  initMoonTap({ Scenes }); // after restoreSession: it reads the restored scene

  document.body.classList.add('ui-ready');
  bus.emit('screen:changed', { name: 'mixer' });

  return { closeTopSheet, anyLayerOpen };
}

/* ---------------------------------------------------------------- header */

function wireHeader() {
  const premiumBtn = document.getElementById('btn-premium');
  premiumBtn?.addEventListener('click', () => openPaywall({ reason: 'Every layer, every scene.' }));

  document.getElementById('btn-legend')?.addEventListener('click', () => openBadgeLegend());

  const paintPremium = () => {
    if (!premiumBtn) return;
    if (Entitlements.isPremium()) {
      premiumBtn.textContent = 'Premium';
      premiumBtn.classList.add('is-owned');
    } else if (Entitlements.hasNightPass()) {
      premiumBtn.textContent = 'Unlocked tonight';
      premiumBtn.classList.add('is-pass');
      premiumBtn.classList.remove('is-owned');
    } else {
      premiumBtn.textContent = 'Premium';
      premiumBtn.classList.remove('is-owned', 'is-pass');
    }
  };
  paintPremium();
  bus.on('entitlements:changed', () => {
    paintPremium();
    // Belt and braces: a paying user should never see another banner.
    if (Entitlements.isPremium() && typeof Ads.setAdsDisabled === 'function') {
      try {
        Ads.setAdsDisabled(true);
      } catch {
        /* stub-safe */
      }
    }
  });
}

/* ---------------------------------------------------------- reduce motion */

function wireMotionRow() {
  const host = document.getElementById('motion-row');
  if (!host) return;

  const paint = () => {
    const on = getSettings().reduceMotion === true;
    host.textContent = '';
    const row = el('div', 'setting-row');
    const text = el('div', 'setting-text');
    text.append(el('span', 'setting-title', 'Reduce motion'));
    text.append(
      el('span', 'setting-sub', 'Freezes the scene to a still gradient. Saves battery over a long night.'),
    );
    row.append(text);
    row.append(
      switchEl(
        on,
        (next) => {
          setSettings({ reduceMotion: next });
          try {
            if (engine.isRunning()) Scenes?.resume();
            else Scenes?.pause();
          } catch {
            /* renderer is optional */
          }
          paint();
        },
        'Reduce motion',
      ),
    );
    host.append(row);
  };

  paint();
}

/* ------------------------------------------------------------------ play */

function anyLayerOn(state) {
  return SOUND_IDS.some((id) => state.layers?.[id]?.enabled);
}

function wirePlay() {
  const btn = document.getElementById('btn-play');
  const label = btn?.querySelector('.play-label');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    btn.classList.add('is-busy');
    try {
      if (engine.isRunning()) {
        await engine.stop();
      } else {
        if (!anyLayerOn(engine.getState())) applyPreset(DEFAULT_PRESET, { silent: true });
        await engine.start();
      }
    } catch (err) {
      console.error('[ui] play failed', err);
      toast('Could not start audio — tap again');
    } finally {
      busy = false;
      btn.classList.remove('is-busy');
    }
  });

  const paint = (playing) => {
    document.body.classList.toggle('is-playing', playing);
    btn.classList.toggle('playing', playing);
    btn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    if (label) label.textContent = playing ? 'Pause' : 'Play';
  };

  bus.on('audio:started', () => {
    paint(true);
    try {
      Scenes?.resume();
    } catch {
      /* renderer is optional */
    }
  });

  bus.on('audio:stopped', () => {
    paint(false);
    try {
      Scenes?.pause();
    } catch {
      /* renderer is optional */
    }
  });

  paint(engine.isRunning());
}

/* ---------------------------------------------------------------- banner */

function wireBanner() {
  const spacer = document.getElementById('banner-spacer');
  bus.on('ads:banner', ({ visible, heightPx } = {}) => {
    const h = visible ? Math.max(0, Number(heightPx) || 0) : 0;
    document.documentElement.style.setProperty('--banner-h', `${h}px`);
    if (spacer) spacer.style.height = `${h}px`;
  });
  document.documentElement.style.setProperty('--banner-h', '0px');
}

/* ----------------------------------------------------------------- scene */

/** Scene energy follows the mix so the canvas and the audio agree. */
function sceneIntensity(state) {
  let peak = 0;
  for (const id of SOUND_IDS) {
    const L = state.layers?.[id];
    if (L?.enabled) peak = Math.max(peak, L.volume ?? 0);
  }
  const rainParam = state.layers?.rain?.enabled ? (state.layers.rain.params?.intensity ?? 0.5) : null;
  const base = (state.master ?? 0.7) * (0.4 + 0.6 * peak);
  const blended = rainParam === null ? base : base * 0.65 + rainParam * 0.35;
  return Math.max(0.12, Math.min(1, blended));
}

let persistTimer = null;
let pendingState = null;

/** Dragging a slider fires `mix:changed` continuously — do not thrash storage. */
function persistMix(state) {
  pendingState = state;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const s = pendingState;
    pendingState = null;
    if (s) write(KEYS.lastMix, { master: s.master, layers: s.layers });
  }, 400);
}

function wireSceneFollow() {
  bus.on('mix:changed', (state) => {
    persistMix(state);
    try {
      Scenes?.setIntensity(sceneIntensity(state));
    } catch {
      /* renderer is optional */
    }
  });

  // Never lose the last mix to a backgrounded tab / process death.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || !pendingState) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = null;
    write(KEYS.lastMix, { master: pendingState.master, layers: pendingState.layers });
    pendingState = null;
  });

  bus.on('scene:changed', ({ scene } = {}) => {
    if (scene) setSettings({ scene });
  });
}

/* --------------------------------------------------------------- restore */

function restoreSession() {
  const settings = getSettings();
  const saved = read(KEYS.lastMix, null);

  if (saved?.layers) {
    const layers = {};
    for (const [id, spec] of Object.entries(saved.layers)) {
      layers[id] = { ...spec, enabled: !!spec?.enabled && Entitlements.isUnlocked(id) };
    }
    engine.applyMix({ layers });
    if (typeof saved.master === 'number') engine.setMasterVolume(saved.master);
    try {
      Scenes?.setScene(settings.scene || 'rain');
    } catch {
      /* renderer is optional */
    }
  } else {
    applyPreset(DEFAULT_PRESET, { silent: true });
  }

  try {
    Scenes?.setIntensity(sceneIntensity(engine.getState()));
  } catch {
    /* renderer is optional */
  }
}
