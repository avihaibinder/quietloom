/**
 * The preset row. Each chip is a curated sleepscape; the note under the row
 * explains the research angle, because that is the reason the preset exists.
 *
 * If a preset contains locked layers we apply everything the user *can* hear
 * and then offer the rest — never a dead-end tap.
 */

import { bus } from '../core/bus.js';
import { PRESETS } from '../data/presets.js';
import { Entitlements } from '../services/entitlements.js';
import { openPaywall } from './paywall.js';
import { el } from './sheet.js';
import { openMixes } from './mixes-ui.js';

let engine = null;
let Scenes = null;
let rowEl = null;
let noteEl = null;
let activeId = null;

export function initPresets(deps) {
  engine = deps.engine;
  Scenes = deps.Scenes;
  rowEl = document.getElementById('preset-row');
  noteEl = document.getElementById('preset-note');
  if (!rowEl) {
    console.warn('[ui] #preset-row missing');
    return;
  }

  build();
  bus.on('entitlements:changed', () => build());
  bus.on('preset:cleared', () => clearActive());
  document.getElementById('btn-mixes')?.addEventListener('click', () => openMixes());
}

function lockedIdsOf(preset) {
  return Object.keys(preset.layers).filter((id) => !Entitlements.isUnlocked(id));
}

function build() {
  rowEl.textContent = '';
  for (const p of PRESETS) {
    const locked = lockedIdsOf(p);
    const chip = el('button', 'preset-chip');
    chip.type = 'button';
    chip.dataset.id = p.id;
    chip.dataset.scene = p.scene;
    if (p.id === activeId) chip.classList.add('active');

    const art = el('span', `preset-art scene-${p.scene}`);
    art.setAttribute('aria-hidden', 'true');
    chip.append(art);

    const label = el('span', 'preset-label');
    label.append(el('span', 'preset-name', p.name));
    label.append(el('span', 'preset-count', `${Object.keys(p.layers).length} layers`));
    chip.append(label);

    if (locked.length) {
      const pill = el('span', 'preset-lock');
      pill.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2.4"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"/></svg>';
      chip.append(pill);
    }

    chip.addEventListener('click', () => applyPreset(p.id));
    rowEl.append(chip);
  }
  markActive();
}

export function applyPreset(id, { silent = false } = {}) {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) return;

  const locked = lockedIdsOf(p);
  const layers = {};
  for (const [layerId, spec] of Object.entries(p.layers)) {
    if (Entitlements.isUnlocked(layerId)) layers[layerId] = spec;
  }

  // If every layer in this preset is locked, do not wipe what is already
  // playing — set the scene, explain, and offer the unlock.
  if (Object.keys(layers).length) engine.applyMix({ layers });
  setScene(p.scene);

  activeId = p.id;
  markActive();
  showNote(p, locked);

  if (locked.length && !silent) {
    setTimeout(() => openPaywall({ lockedIds: locked }), 260);
  }
}

function setScene(scene) {
  try {
    Scenes?.setScene(scene);
  } catch (err) {
    console.warn('[ui] setScene failed', err);
  }
  bus.emit('scene:changed', { scene });
}

function markActive() {
  for (const c of rowEl.querySelectorAll('.preset-chip')) {
    c.classList.toggle('active', c.dataset.id === activeId);
  }
}

function showNote(preset, locked) {
  if (!noteEl) return;
  noteEl.textContent = '';
  noteEl.hidden = false;
  noteEl.append(el('span', 'preset-note-name', preset.name));
  noteEl.append(document.createTextNode(' — '));
  noteEl.append(document.createTextNode(preset.note));
  if (locked?.length) {
    const b = el('button', 'link-btn inline', `Unlock the missing ${locked.length === 1 ? 'layer' : 'layers'}`);
    b.type = 'button';
    b.addEventListener('click', () => openPaywall({ lockedIds: locked }));
    noteEl.append(document.createTextNode(' '));
    noteEl.append(b);
  }
}

/** Used on boot when restoring a session — no paywall, no toast. */
export function clearActive() {
  activeId = null;
  if (rowEl) markActive();
}
