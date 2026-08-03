/**
 * "Tap the moon" — the evidence card for the Moonrise scene.
 *
 * The moon is painted on the canvas, and #screen-mixer sits over the whole
 * canvas at z-index 2, so a pointer listener on the canvas would be swallowed
 * across most of the sky. Instead this mounts a real focusable button — the
 * same `.info-dot` affordance every sound layer has — over the moon.
 *
 * On the moon or not at all. The dot is centred on the moon and nowhere else:
 * a dot hunting for clear sky stops reading as "this moon has something to
 * say" and starts reading as a stray control. It is suppressed whenever
 *   - moonrise is not the current scene,
 *   - a sheet or the bedside overlay is open (a tap at 3am in bedside mode must
 *     exit bedside, exactly as it does today),
 *   - the document is hidden,
 *   - there is no EVIDENCE entry to open,
 *   - the moon has gone below the hill crest (the scene answers that, not us),
 *   - or its 48px box would land on a control. A target on top of a preset chip
 *     or the Premium button is a dead tap, and dead taps at 2am are how an app
 *     loses someone.
 *
 * When it is suppressed the evidence card is still one tap away, from the info
 * dot on the preset note card — see showNote() in presets-ui.js.
 */

import { bus } from '../core/bus.js';
import { EVIDENCE } from '../data/evidence.js';
import { openEvidence } from './evidence-ui.js';
import { anyLayerOpen } from './sheet.js';
import { moonTarget } from '../scenes/moonrise.js';

const SCENE = 'moonrise';
const SIZE = 48; // ≥44px target, and the charter's 48px minimum for tired hands
const GAP = 6; // clearance we insist on around any control
const DRIFT_MS = 60_000; // the moon moves ~25px an hour — this is generous

/** Everything on the mixer a tap could be stolen from. Never overlapped. */
const CONTROLS =
  '#btn-premium,#btn-mixes,#btn-legend,#btn-volume-guide,#preset-row,#preset-note,' +
  '#sound-list,#master-slider,#motion-row,#bottom-bar';

let Scenes = null;
let btn = null;
let drift = 0;
let queued = null;

export function initMoonTap(deps = {}) {
  Scenes = deps.Scenes;
  if (!Scenes || !EVIDENCE[SCENE]) return;

  bus.on('scene:changed', sync);
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('orientationchange', schedule, { passive: true });
  window.addEventListener('scroll', schedule, { passive: true });
  document.addEventListener('visibilitychange', sync);

  // sheet.js signals every open surface by toggling `layer-open` on <html>;
  // watching the class keeps us in sync without reaching into its state.
  new MutationObserver(sync).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });

  // restoreSession() sets the scene without emitting `scene:changed`, so a cold
  // boot straight into moonrise never fires that event. Read the scene too.
  sync();
  // #screen-mixer animates in on `ui-ready`; re-place once its rect has settled.
  setTimeout(sync, 600);
}

/* ------------------------------------------------------------------ button */

function ensureButton() {
  if (btn) return btn;
  btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'moon-info';
  btn.className = 'info-dot';
  btn.textContent = 'i';
  btn.setAttribute('aria-label', 'About the Moonrise scene, and the study behind it');
  // Position and size only — the look is the shared .info-dot.
  btn.style.position = 'fixed';
  btn.style.zIndex = '3'; // over #screen-mixer (2), under the bar, sheets and overlays
  btn.style.width = `${SIZE}px`;
  btn.style.height = `${SIZE}px`;
  btn.style.fontSize = '15px';
  btn.style.display = 'none';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (anyLayerOpen()) return;
    openEvidence(SCENE);
  });
  document.body.append(btn);
  return btn;
}

function hide() {
  if (btn) btn.style.display = 'none';
  if (drift) {
    clearInterval(drift);
    drift = 0;
  }
}

/* --------------------------------------------------------------- placement */

function overlaps(box, r) {
  return !(
    box.right + GAP <= r.left ||
    box.left - GAP >= r.right ||
    box.bottom + GAP <= r.top ||
    box.top - GAP >= r.bottom
  );
}

/**
 * The 48px box centred on the moon, or null if it cannot be offered there:
 * off the edge of the screen, or sitting on something the user might tap.
 * There is no second choice of position by design.
 */
function place(target, origin) {
  const half = SIZE / 2;
  const cx = origin.left + target.x;
  const cy = origin.top + target.y;
  const box = { left: cx - half, top: cy - half, right: cx + half, bottom: cy + half };

  if (box.left < 4 || box.top < 4) return null;
  if (box.right > window.innerWidth - 4 || box.bottom > window.innerHeight - 4) return null;

  for (const el of document.querySelectorAll(CONTROLS)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && overlaps(box, r)) return null;
  }
  return box;
}

/* -------------------------------------------------------------------- sync */

function schedule() {
  if (queued) clearTimeout(queued);
  queued = setTimeout(() => {
    queued = null;
    sync();
  }, 140);
}

function sync() {
  let scene = null;
  try {
    scene = Scenes?.getScene?.();
  } catch {
    /* renderer is optional */
  }
  if (scene !== SCENE || anyLayerOpen() || document.hidden) {
    hide();
    return;
  }

  // `occluded` is the scene's own answer about its crest — the UI does not get
  // to keep a second copy of that maths.
  const target = moonTarget();
  if (!target || target.occluded) {
    hide();
    return;
  }

  const canvas = document.getElementById('scene-canvas');
  const origin = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
  const box = place(target, origin);
  if (!box) {
    hide();
    return;
  }

  const el = ensureButton();
  el.style.left = `${Math.round(box.left)}px`;
  el.style.top = `${Math.round(box.top)}px`;
  el.style.display = 'grid'; // .info-dot centres its glyph with grid
  if (!drift) drift = setInterval(sync, DRIFT_MS);
}
