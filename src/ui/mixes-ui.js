/**
 * Saved mixes. Persisted to KEYS.mixes; the working mix is written to
 * KEYS.lastMix on every change so a restart lands you where you left off.
 */

import { bus, toast } from '../core/bus.js';
import { KEYS, read, write } from '../core/store.js';
import { SOUND_IDS } from '../audio/engine.js';
import { EVIDENCE } from '../data/evidence.js';
import { Entitlements } from '../services/entitlements.js';
import { mountSheet, openSheet, closeSheet, sheetHeader, el } from './sheet.js';
import { openPaywall } from './paywall.js';

const SHEET_ID = 'mixes-sheet';
const MAX_MIXES = 40;

let engine = null;
let body = null;

export function initMixes(deps) {
  engine = deps.engine;
  body = mountSheet(SHEET_ID, { label: 'My mixes' });
}

export function loadMixes() {
  const list = read(KEYS.mixes, []);
  return Array.isArray(list) ? list : [];
}

function saveMixes(list) {
  write(KEYS.mixes, list.slice(0, MAX_MIXES));
}

export function openMixes() {
  if (!body) return;
  render();
  openSheet(SHEET_ID);
}

function activeLayerIds(state) {
  return SOUND_IDS.filter((id) => state.layers?.[id]?.enabled);
}

function describe(mix) {
  const ids = activeLayerIds(mix);
  if (!ids.length) return 'Silent';
  return ids.map((id) => EVIDENCE[id]?.title || id).join(' · ');
}

function render() {
  body.textContent = '';
  body.append(sheetHeader('My mixes', { eyebrow: 'Saved sleepscapes', onClose: () => closeSheet(SHEET_ID) }));

  /* ---- save the current mix ---- */
  const state = engine.getState();
  const current = activeLayerIds(state);

  const saveCard = el('div', 'save-card');
  saveCard.append(el('p', 'save-current', current.length ? describe(state) : 'Nothing is playing yet'));

  const form = el('div', 'save-form');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'text-input';
  input.placeholder = 'Name this mix';
  input.maxLength = 32;
  input.setAttribute('aria-label', 'Mix name');

  const btn = el('button', 'primary-btn', 'Save');
  btn.type = 'button';
  btn.disabled = current.length === 0;

  const doSave = () => {
    const name = input.value.trim();
    if (!name) {
      input.focus();
      toast('Give the mix a name first');
      return;
    }
    if (!current.length) {
      toast('Turn a layer on before saving');
      return;
    }
    const s = engine.getState();
    const list = loadMixes().filter((m) => m.name.toLowerCase() !== name.toLowerCase());
    list.unshift({
      id: `mix-${Date.now()}`,
      name,
      createdAt: Date.now(),
      master: s.master,
      layers: s.layers,
    });
    saveMixes(list);
    input.value = '';
    toast(`Saved “${name}”`);
    render();
  };

  btn.addEventListener('click', doSave);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSave();
  });
  input.addEventListener('input', () => {
    btn.disabled = current.length === 0;
  });

  form.append(input, btn);
  saveCard.append(form);
  body.append(saveCard);

  /* ---- the list ---- */
  const list = loadMixes();
  if (!list.length) {
    body.append(
      el(
        'p',
        'empty-note',
        'No saved mixes yet. Build something you like on the mixer, then save it here — it will be waiting tomorrow night.',
      ),
    );
    return;
  }

  const listEl = el('div', 'mix-list');
  for (const mix of list) listEl.append(mixRow(mix));
  body.append(listEl);
  body.append(el('p', 'empty-note', 'Long-press or swipe a mix to delete it.'));
}

function mixRow(mix) {
  const row = el('div', 'mix-row');
  const main = el('button', 'mix-main');
  main.type = 'button';
  const t = el('div', 'mix-text');
  t.append(el('span', 'mix-name', mix.name));
  t.append(el('span', 'mix-desc', describe(mix)));
  main.append(t);
  const play = el('span', 'mix-play');
  play.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.4v11.2L18 12z"/></svg>';
  main.append(play);
  main.addEventListener('click', () => applyMix(mix));
  row.append(main);

  /* delete affordance */
  const confirm = el('div', 'mix-confirm');
  confirm.append(el('span', 'mix-confirm-text', 'Delete this mix?'));
  const yes = el('button', 'danger-btn', 'Delete');
  yes.type = 'button';
  yes.addEventListener('click', () => {
    saveMixes(loadMixes().filter((m) => m.id !== mix.id));
    toast('Mix deleted');
    render();
  });
  const no = el('button', 'link-btn', 'Keep');
  no.type = 'button';
  no.addEventListener('click', () => row.classList.remove('confirming'));
  confirm.append(yes, no);
  row.append(confirm);

  /* long-press + swipe-left both arm the confirm state */
  let pressTimer = null;
  let startX = 0;
  let moved = false;

  const arm = () => row.classList.add('confirming');
  const cancelPress = () => {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
  };

  main.addEventListener('pointerdown', (e) => {
    startX = e.clientX;
    moved = false;
    cancelPress();
    pressTimer = setTimeout(arm, 600);
  });
  main.addEventListener('pointermove', (e) => {
    if (Math.abs(e.clientX - startX) > 10) {
      moved = true;
      cancelPress();
    }
    if (e.clientX - startX < -70) arm();
  });
  main.addEventListener('pointerup', cancelPress);
  main.addEventListener('pointercancel', cancelPress);
  main.addEventListener('pointerleave', cancelPress);
  main.addEventListener(
    'click',
    (e) => {
      if (row.classList.contains('confirming') || moved) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    true,
  );

  return row;
}

function applyMix(mix) {
  const locked = Object.keys(mix.layers || {}).filter(
    (id) => mix.layers[id]?.enabled && !Entitlements.isUnlocked(id),
  );
  const layers = {};
  for (const [id, spec] of Object.entries(mix.layers || {})) {
    if (Entitlements.isUnlocked(id)) layers[id] = spec;
  }
  engine.applyMix({ layers });
  if (typeof mix.master === 'number') engine.setMasterVolume(mix.master);
  bus.emit('preset:cleared', {});
  closeSheet(SHEET_ID);
  toast(`Loaded “${mix.name}”`);
  if (locked.length) setTimeout(() => openPaywall({ lockedIds: locked }), 300);
}
