/**
 * The mixer: one card per layer, plus the master volume row.
 *
 * Rebuilds on `entitlements:changed` (a lock can disappear mid-session) and
 * syncs values in place on `mix:changed` so a slider being dragged is never
 * yanked out from under the thumb.
 */

import { bus } from '../core/bus.js';
import { SOUND_IDS } from '../audio/engine.js';
import { EVIDENCE } from '../data/evidence.js';
import { Entitlements } from '../services/entitlements.js';
import { getSettings } from '../core/store.js';
import { badgeChip, infoDot, openEvidence } from './evidence-ui.js';
import { openPaywall } from './paywall.js';
import { el } from './sheet.js';
import { openVolumeGuide } from './volume-guide.js';

export const NURSERY_MAX = 0.45;

const COPY = {
  rain: 'Layered droplets under a 1/f gust envelope. Synthesised, so it never loops.',
  thunder: 'Distant rumbles, kept infrequent and below the level that causes arousals.',
  ocean: 'Swells locked to 10 seconds — 0.1 Hz. The waves are a breathing pacer.',
  wind: 'Slowly wandering broadband air. Covers the frequencies speech sits in.',
  fire: 'Crackle, hiss and pop. In the study, silent fire did nothing — the sound is the effect.',
  crickets: 'Sparse, high chirps that sit above the masking bed instead of fighting it.',
  pink: '1/f noise. The default bed, because pink is what the sleep literature actually tested.',
  brown: 'Deeper than pink. Most of its energy sits low, where traffic and footsteps live.',
  white: 'Flat and bright. Included because people like it — the evidence is thinner than the fame.',
  binaural: 'Two carriers, one per ear. Physically impossible on a speaker.',
  deeppulse: 'Pink-noise pulses near 0.8 Hz, modelled on a slow-wave protocol. Experimental.',
};

const GROUPS = [
  {
    name: 'Nature',
    note: 'Water, weather and fire — the element families used in the HRV crossover study.',
    ids: ['rain', 'thunder', 'ocean', 'wind', 'fire', 'crickets'],
  },
  {
    name: 'Noise beds',
    note: 'Steady masking. Pink sits first because pink is what the research tested.',
    ids: ['pink', 'brown', 'white'],
  },
  {
    name: 'Experimental',
    note: 'Real protocols reproduced honestly, with the caveats shown.',
    ids: ['binaural', 'deeppulse'],
  },
];

let engine = null;
let listEl = null;
let masterInput = null;
let masterValue = null;
let masterNote = null;
const cards = new Map(); // id -> refs
let touchingMaster = false;

/* ------------------------------------------------------------------ init */

export function initMixer(deps) {
  engine = deps.engine;
  listEl = document.getElementById('sound-list');
  masterInput = document.getElementById('master-slider');
  masterValue = document.getElementById('master-value');
  masterNote = document.getElementById('master-note');

  if (!listEl) {
    console.warn('[ui] #sound-list missing');
    return;
  }

  buildList();
  wireMaster();

  bus.on('entitlements:changed', () => buildList());
  bus.on('mix:changed', (state) => sync(state));
  bus.on('ui:settings', () => {
    applyNurseryCap();
    sync(engine.getState());
  });

  sync(engine.getState());
}

/* --------------------------------------------------------------- builders */

function groupsForIds(ids) {
  const seen = new Set();
  const out = [];
  for (const g of GROUPS) {
    const present = g.ids.filter((id) => ids.includes(id));
    present.forEach((id) => seen.add(id));
    if (present.length) out.push({ ...g, ids: present });
  }
  const rest = ids.filter((id) => !seen.has(id));
  if (rest.length) out.push({ name: 'More', note: '', ids: rest });
  return out;
}

function buildList() {
  const scrollTop = document.scrollingElement?.scrollTop ?? 0;
  listEl.textContent = '';
  cards.clear();

  for (const group of groupsForIds(SOUND_IDS)) {
    const g = el('section', 'layer-group');
    const head = el('div', 'group-head');
    head.append(el('h3', 'group-name', group.name));
    if (group.note) head.append(el('p', 'group-note', group.note));
    g.append(head);
    for (const id of group.ids) g.append(buildCard(id));
    listEl.append(g);
  }

  sync(engine.getState());
  if (document.scrollingElement) document.scrollingElement.scrollTop = scrollTop;
}

function buildCard(id) {
  const info = EVIDENCE[id] || { title: id, badge: 'Traditional' };
  const unlocked = Entitlements.isUnlocked(id);

  const card = el('article', 'layer-card');
  card.dataset.id = id;
  if (!unlocked) card.classList.add('locked');

  /* --- top row --- */
  const top = el('div', 'layer-top');
  top.setAttribute('role', 'button');
  top.tabIndex = 0;

  const toggle = el('span', 'layer-toggle');
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', 'false');
  if (unlocked) {
    const track = el('span', 'toggle-track');
    track.append(el('span', 'toggle-knob'));
    toggle.append(track);
  } else {
    toggle.classList.add('is-lock');
    toggle.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2.4"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"/></svg>';
  }
  top.append(toggle);

  const meta = el('div', 'layer-meta');
  const titleRow = el('div', 'layer-title-row');
  titleRow.append(el('h4', 'layer-name', info.title));
  titleRow.append(badgeChip(info.badge, { small: true }));
  if (!unlocked) titleRow.append(el('span', 'lock-pill', 'Locked'));
  meta.append(titleRow);
  meta.append(el('p', 'layer-desc', COPY[id] || ''));
  top.append(meta);

  top.append(infoDot(`Why ${info.title}? The evidence`, () => openEvidence(id)));
  card.append(top);

  const activate = (e) => {
    if (e.target.closest('.info-dot')) return;
    if (!Entitlements.isUnlocked(id)) {
      openPaywall({ lockedIds: [id] });
      return;
    }
    engine.setLayerEnabled(id, !engine.getState().layers[id]?.enabled);
  };
  top.addEventListener('click', activate);
  top.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate(e);
    }
  });

  /* --- expandable body --- */
  const body = el('div', 'layer-body');
  const refs = { card, toggle, body, sliders: {}, chips: [] };

  if (unlocked) {
    refs.sliders.volume = addSlider(body, {
      label: 'Level',
      min: 0,
      max: 100,
      step: 1,
      format: (v) => `${Math.round(v)}`,
      onInput: (v) => engine.setLayerVolume(id, v / 100),
    });

    if (id === 'rain') {
      refs.sliders.intensity = addSlider(body, {
        label: 'Intensity',
        hint: 'Drizzle to downpour',
        min: 0,
        max: 100,
        step: 1,
        format: (v) => (v < 33 ? 'Drizzle' : v < 70 ? 'Steady' : 'Downpour'),
        onInput: (v) => engine.setLayerParam(id, 'intensity', v / 100),
        param: 'intensity',
      });
    }

    if (id === 'thunder') {
      refs.sliders.frequency = addSlider(body, {
        label: 'Frequency',
        hint: 'How often a rumble rolls through',
        min: 0,
        max: 100,
        step: 1,
        format: (v) => (v < 25 ? 'Rare' : v < 60 ? 'Occasional' : 'Frequent'),
        onInput: (v) => engine.setLayerParam(id, 'frequency', v / 100),
        param: 'frequency',
      });
    }

    if (id === 'binaural') {
      const notice = el('div', 'notice notice-warn');
      notice.innerHTML =
        '<strong>Headphones required.</strong> A binaural beat is created inside your head from two slightly different tones, one per ear. On a speaker the tones mix in the air and the effect cannot happen at all.';
      body.append(notice);

      const chipRow = el('div', 'chip-row');
      const chipDefs = [
        { label: 'Sleep — Fan 2024', sub: '0.25 Hz @ 250 Hz', baseHz: 250, beatHz: 0.25 },
        { label: 'Delta', sub: '3 Hz @ 250 Hz', baseHz: 250, beatHz: 3 },
        { label: 'Alpha / focus', sub: '10 Hz @ 250 Hz', baseHz: 250, beatHz: 10 },
      ];
      for (const def of chipDefs) {
        const c = el('button', 'param-chip');
        c.type = 'button';
        c.append(el('span', 'param-chip-label', def.label));
        c.append(el('span', 'param-chip-sub', def.sub));
        c.addEventListener('click', () => {
          engine.setLayerParam(id, 'baseHz', def.baseHz);
          engine.setLayerParam(id, 'beatHz', def.beatHz);
        });
        c.dataset.baseHz = String(def.baseHz);
        c.dataset.beatHz = String(def.beatHz);
        chipRow.append(c);
        refs.chips.push(c);
      }
      body.append(chipRow);

      refs.sliders.baseHz = addSlider(body, {
        label: 'Carrier',
        min: 80,
        max: 400,
        step: 5,
        format: (v) => `${Math.round(v)} Hz`,
        onInput: (v) => engine.setLayerParam(id, 'baseHz', v),
        param: 'baseHz',
        raw: true,
      });
      refs.sliders.beatHz = addSlider(body, {
        label: 'Beat',
        min: 0.25,
        max: 12,
        step: 0.25,
        format: (v) => `${v} Hz`,
        onInput: (v) => engine.setLayerParam(id, 'beatHz', v),
        param: 'beatHz',
        raw: true,
      });
    }

    if (id === 'deeppulse') {
      const notice = el('div', 'notice');
      notice.innerHTML =
        '<strong>Open-loop approximation.</strong> The original protocol phase-locked pulses to your slow oscillations using EEG. Drift has no EEG — it runs the same rhythm, not the same targeting.';
      body.append(notice);
    }
  }

  card.append(body);
  cards.set(id, refs);
  return card;
}

/**
 * A labelled range row. Returns { input, valueEl, wrap }.
 */
function addSlider(parent, opts) {
  const wrap = el('div', 'slider-row');
  const head = el('div', 'slider-head');
  head.append(el('span', 'slider-label', opts.label));
  const val = el('span', 'slider-value');
  head.append(val);
  wrap.append(head);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(opts.min);
  input.max = String(opts.max);
  input.step = String(opts.step);
  input.className = 'range';
  input.setAttribute('aria-label', opts.label);
  wrap.append(input);

  if (opts.hint) wrap.append(el('p', 'slider-hint', opts.hint));

  const commit = () => {
    const v = Number(input.value);
    val.textContent = opts.format(v);
    setFill(input);
    opts.onInput(v);
  };
  input.addEventListener('input', commit);
  input.addEventListener('pointerdown', () => {
    input.dataset.dragging = '1';
  });
  const release = () => delete input.dataset.dragging;
  input.addEventListener('pointerup', release);
  input.addEventListener('pointercancel', release);
  input.addEventListener('blur', release);

  parent.append(wrap);
  return { input, valueEl: val, wrap, format: opts.format, param: opts.param, raw: !!opts.raw };
}

function setFill(input) {
  const min = Number(input.min);
  const max = Number(input.max);
  const pct = max > min ? ((Number(input.value) - min) / (max - min)) * 100 : 0;
  input.style.setProperty('--fill', `${Math.max(0, Math.min(100, pct))}%`);
}

/* ------------------------------------------------------------------ sync */

export function sync(state) {
  if (!state) return;

  for (const [id, refs] of cards) {
    const L = state.layers?.[id];
    if (!L) continue;
    const on = !!L.enabled && Entitlements.isUnlocked(id);
    refs.card.classList.toggle('on', on);
    refs.toggle.setAttribute('aria-checked', on ? 'true' : 'false');

    const s = refs.sliders;
    if (s.volume && s.volume.input.dataset.dragging !== '1') {
      s.volume.input.value = String(Math.round((L.volume ?? 0) * 100));
      s.volume.valueEl.textContent = s.volume.format(Number(s.volume.input.value));
      setFill(s.volume.input);
    }
    for (const key of ['intensity', 'frequency', 'baseHz', 'beatHz']) {
      const sl = s[key];
      if (!sl || sl.input.dataset.dragging === '1') continue;
      const pv = L.params?.[key];
      if (typeof pv !== 'number') continue;
      sl.input.value = String(sl.raw ? pv : Math.round(pv * 100));
      sl.valueEl.textContent = sl.format(Number(sl.input.value));
      setFill(sl.input);
    }

    if (refs.chips.length) {
      const b = L.params?.baseHz;
      const beat = L.params?.beatHz;
      for (const c of refs.chips) {
        c.classList.toggle(
          'active',
          Number(c.dataset.baseHz) === b && Math.abs(Number(c.dataset.beatHz) - beat) < 0.001,
        );
      }
    }
  }

  syncMaster(state.master ?? 0.7);
}

/* ---------------------------------------------------------------- master */

function wireMaster() {
  if (!masterInput) return;
  applyNurseryCap();
  masterInput.addEventListener('input', () => {
    const v = Number(masterInput.value) / 100;
    engine.setMasterVolume(v);
    renderMasterCopy(v);
    setFill(masterInput);
  });
  masterInput.addEventListener('pointerdown', () => {
    touchingMaster = true;
  });
  const release = () => {
    touchingMaster = false;
  };
  masterInput.addEventListener('pointerup', release);
  masterInput.addEventListener('pointercancel', release);
  masterInput.addEventListener('blur', release);

  document.getElementById('btn-volume-guide')?.addEventListener('click', () => openVolumeGuide());
}

/** Re-reads the nursery-safe setting and hard-caps the slider. */
export function applyNurseryCap() {
  if (!masterInput || !engine) return;
  const safe = getSettings().nurserySafe === true;
  // The engine also caps in the audio graph when it supports it (additive API).
  if (typeof engine.setNurserySafe === 'function') {
    try {
      engine.setNurserySafe(safe);
    } catch (err) {
      console.warn('[ui] setNurserySafe failed', err);
    }
  }
  const max = safe ? Math.round(NURSERY_MAX * 100) : 100;
  masterInput.max = String(max);
  if (Number(masterInput.value) > max) {
    masterInput.value = String(max);
    engine.setMasterVolume(max / 100);
  }
  if (safe && engine.getState().master > NURSERY_MAX) engine.setMasterVolume(NURSERY_MAX);
}

function syncMaster(master) {
  if (!masterInput || touchingMaster) return;
  masterInput.value = String(Math.round(master * 100));
  setFill(masterInput);
  renderMasterCopy(master);
}

function renderMasterCopy(master) {
  if (masterValue) masterValue.textContent = String(Math.round(master * 100));
  if (!masterNote) return;
  const safe = getSettings().nurserySafe === true;
  masterNote.classList.remove('warn', 'safe');
  if (safe) {
    masterNote.classList.add('safe');
    masterNote.textContent =
      'Nursery-safe cap on — output is limited. Keep the phone at least 2 m from the crib (AAP: 50 dB or lower).';
  } else if (master > 0.75) {
    masterNote.classList.add('warn');
    masterNote.textContent =
      'That is loud for a bedroom. The WHO suggests staying below 30 dB(A) of continuous sound overnight.';
  } else {
    masterNote.textContent = 'Just loud enough to cover what you are masking — no louder.';
  }
}
