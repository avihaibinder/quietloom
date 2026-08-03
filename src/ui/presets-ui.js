/**
 * The preset row. Each chip is a curated sleepscape; the note under the row
 * explains the research angle, because that is the reason the preset exists.
 *
 * If a preset contains locked layers we apply everything the user *can* hear
 * and then offer the rest — never a dead-end tap.
 */

import { bus } from '../core/bus.js';
import { PRESETS } from '../data/presets.js';
import { EVIDENCE } from '../data/evidence.js';
import { Entitlements } from '../services/entitlements.js';
import { openPaywall } from './paywall.js';
import { infoDot, openEvidence } from './evidence-ui.js';
import { el } from './sheet.js';
import { openMixes } from './mixes-ui.js';

/**
 * Scene-level copy for the note card, for a scene showing with no preset behind
 * it. Keyed by scene id — exactly like the evidence dot the card carries.
 */
const SCENE_NOTES = {
  moonrise: {
    name: 'Moonrise',
    text: 'A quiet meadow at night. Picture somewhere pleasant, and interesting enough to hold your attention — that is the tested part, not the sheep.',
  },
};

let engine = null;
let Scenes = null;
let rowEl = null;
let noteEl = null;
let activeId = null;
/** True only while the note card holds scene copy rather than a preset's note. */
let sceneNote = false;

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
  // A scene can change with no preset behind it, and restoreSession() does
  // exactly that on a cold boot without emitting `scene:changed`. So: listen for
  // the scene, and re-check whenever the mixer becomes the current screen —
  // initUI emits that once, after the session has been restored. No new events.
  bus.on('scene:changed', () => showSceneNote());
  bus.on('screen:changed', ({ name } = {}) => {
    if (name === 'mixer') showSceneNote();
  });
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
  sceneNote = false; // a preset's own note has replaced any scene copy
  const dot = evidenceDot(preset.scene);
  if (dot) noteEl.append(dot);

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

/**
 * A scene can carry its own evidence card. Moonrise's is normally reached by
 * tapping the moon, but the moon is often behind this very card or below the
 * hill, so the card carries the same info dot. Keyed off the scene, never the
 * preset's id or name — those are free to be renamed without breaking this.
 *
 * Floated right so it sits in the card's top-right corner level with the name,
 * the way every layer row carries its dot. Inline in the prose it landed beside
 * "Unlock the missing layers" and read as if it explained the paywall. A float
 * needs no positioning context, so nothing has to be set — or later unset — on
 * the shared note element.
 */
function evidenceDot(scene) {
  if (scene !== 'moonrise' || !EVIDENCE.moonrise) return null;
  const dot = infoDot('The evidence behind the Moonrise scene', () => openEvidence('moonrise'));
  dot.style.float = 'right';
  dot.style.margin = '0 0 4px 10px';
  return dot;
}

/**
 * The note card for a scene with no preset behind it — the same card, made
 * consistent with the evidence dot it carries.
 *
 * Precedence is a stated condition, not an accident of event order: this draws
 * only while `activeId` is null, so a preset's own note always wins. It never
 * sets `activeId` (no chip lights up), it never calls openPaywall, and it
 * carries no lock pill and no unlock line — with no preset there is no
 * locked-layer context to offer. It also clears itself when the scene changes
 * away, so a stale card cannot sit under one of the other four scenes.
 */
function showSceneNote() {
  if (!noteEl || activeId !== null) return;

  let scene = null;
  try {
    scene = Scenes?.getScene?.();
  } catch {
    /* renderer is optional */
  }
  const copy = SCENE_NOTES[scene];

  if (!copy) {
    if (sceneNote) {
      noteEl.textContent = '';
      noteEl.hidden = true;
      sceneNote = false;
    }
    return;
  }

  noteEl.textContent = '';
  noteEl.hidden = false;
  const dot = evidenceDot(scene);
  if (dot) noteEl.append(dot);
  noteEl.append(el('span', 'preset-note-name', copy.name));
  noteEl.append(document.createTextNode(' — '));
  noteEl.append(document.createTextNode(copy.text));
  sceneNote = true;
}

/** Used on boot when restoring a session — no paywall, no toast. */
export function clearActive() {
  activeId = null;
  if (rowEl) markActive();
  showSceneNote();
}
