/**
 * Bottom-sheet + overlay layer manager.
 *
 * Every modal surface in Drift registers here so that:
 *   - a backdrop tap closes the top-most surface,
 *   - Android back can close one surface at a time (`closeTopSheet()`),
 *   - nothing can ever be opened twice and stack on top of itself.
 *
 * The sheets in index.html ship as empty <div id="…" class="sheet hidden">.
 * `mountSheet()` builds the scrim / panel / grip skeleton once and hands back
 * the body element for the feature module to fill.
 */

/** @type {Array<{key:string, close:() => void}>} */
const layers = [];
const mounted = new Map(); // id -> { el, body, closeTimer }

const CLOSE_MS = 260;

function lockScroll() {
  document.documentElement.classList.toggle('layer-open', layers.length > 0);
}

/* ------------------------------------------------------------------ layers */

/**
 * Register a non-sheet surface (bedside, breathing) on the layer stack so the
 * back button can dismiss it.
 */
export function pushLayer(key, closeFn) {
  if (layers.some((l) => l.key === key)) return false;
  layers.push({ key, close: closeFn });
  lockScroll();
  return true;
}

export function popLayer(key) {
  const i = layers.findIndex((l) => l.key === key);
  if (i === -1) return false;
  layers.splice(i, 1);
  lockScroll();
  return true;
}

export function isLayerOpen(key) {
  return layers.some((l) => l.key === key);
}

export function anyLayerOpen() {
  return layers.length > 0;
}

/** Closes the top-most sheet/overlay. Returns true if something was closed. */
export function closeTopSheet() {
  const top = layers[layers.length - 1];
  if (!top) return false;
  try {
    top.close();
  } catch (err) {
    console.warn('[ui] layer close failed', err);
    popLayer(top.key);
  }
  return true;
}

export function closeAllSheets() {
  while (layers.length) {
    if (!closeTopSheet()) break;
  }
}

/* ------------------------------------------------------------------ sheets */

/**
 * Build (once) the skeleton for a sheet and return its body element.
 * @returns {HTMLElement|null}
 */
export function mountSheet(id, { label = '' } = {}) {
  if (mounted.has(id)) return mounted.get(id).body;

  const el = document.getElementById(id);
  if (!el) {
    console.warn(`[ui] sheet #${id} is missing from the DOM`);
    return null;
  }

  el.classList.add('sheet');
  el.classList.add('hidden');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  if (label) el.setAttribute('aria-label', label);
  el.textContent = '';

  const scrim = document.createElement('div');
  scrim.className = 'sheet-scrim';

  const panel = document.createElement('div');
  panel.className = 'sheet-panel';

  const grip = document.createElement('div');
  grip.className = 'sheet-grip';
  grip.setAttribute('aria-hidden', 'true');

  const body = document.createElement('div');
  body.className = 'sheet-body';

  panel.append(grip, body);
  el.append(scrim, panel);

  scrim.addEventListener('click', () => closeSheet(id));
  attachDragToDismiss(panel, body, () => closeSheet(id));

  mounted.set(id, { el, body, panel, closeTimer: null });
  return body;
}

export function sheetBody(id) {
  return mounted.get(id)?.body ?? null;
}

export function isSheetOpen(id) {
  return isLayerOpen(`sheet:${id}`);
}

export function openSheet(id) {
  const rec = mounted.get(id);
  if (!rec) return false;
  if (isSheetOpen(id)) return false; // never stack a sheet on itself

  if (rec.closeTimer) {
    clearTimeout(rec.closeTimer);
    rec.closeTimer = null;
  }

  rec.el.classList.remove('hidden');
  rec.panel.style.transform = '';
  // force a reflow so the transition runs from the hidden state
  void rec.el.offsetHeight;
  rec.el.classList.add('open');
  rec.body.scrollTop = 0;

  pushLayer(`sheet:${id}`, () => closeSheet(id));
  return true;
}

export function closeSheet(id) {
  const rec = mounted.get(id);
  if (!rec) return false;
  if (!isSheetOpen(id)) return false;

  popLayer(`sheet:${id}`);
  rec.el.classList.remove('open');
  rec.panel.style.transform = '';

  if (rec.closeTimer) clearTimeout(rec.closeTimer);
  rec.closeTimer = setTimeout(() => {
    rec.closeTimer = null;
    if (!isSheetOpen(id)) rec.el.classList.add('hidden');
  }, CLOSE_MS);
  return true;
}

/* ------------------------------------------------- drag-down to dismiss */

function attachDragToDismiss(panel, body, onDismiss) {
  let startY = 0;
  let dy = 0;
  let dragging = false;
  let pointerId = null;

  panel.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Do not hijack sliders, buttons or a scrolled body.
    if (e.target.closest('input, button, a, textarea, select')) return;
    if (body.scrollTop > 0) return;
    dragging = true;
    pointerId = e.pointerId;
    startY = e.clientY;
    dy = 0;
    panel.classList.add('dragging');
  });

  panel.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    dy = e.clientY - startY;
    if (dy < 0) dy = dy * 0.25;
    panel.style.transform = `translateY(${dy}px)`;
  });

  const end = (e) => {
    if (!dragging || (e && e.pointerId !== pointerId)) return;
    dragging = false;
    pointerId = null;
    panel.classList.remove('dragging');
    if (dy > 96) {
      onDismiss();
    } else {
      panel.style.transform = '';
    }
    dy = 0;
  };

  panel.addEventListener('pointerup', end);
  panel.addEventListener('pointercancel', end);
}

/* --------------------------------------------------------------- builders */

/** Sheet header: big title, optional eyebrow, close button. */
export function sheetHeader(title, { eyebrow = '', onClose = null } = {}) {
  const head = document.createElement('div');
  head.className = 'sheet-head';

  const text = document.createElement('div');
  text.className = 'sheet-head-text';
  if (eyebrow) {
    const e = document.createElement('p');
    e.className = 'sheet-eyebrow';
    e.textContent = eyebrow;
    text.append(e);
  }
  const h = document.createElement('h2');
  h.textContent = title;
  text.append(h);

  head.append(text);

  if (onClose) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sheet-close';
    btn.setAttribute('aria-label', 'Close');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 6.6l10.8 10.8M17.4 6.6L6.6 17.4"/></svg>';
    btn.addEventListener('click', onClose);
    head.append(btn);
  }
  return head;
}

export function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}
