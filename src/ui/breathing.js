/**
 * Breathing pacer.
 *
 * Default is coherence — 6 breaths per minute, 0.1 Hz — because that is the
 * pattern with the strongest evidence: it puts respiration, blood pressure and
 * heart rate in phase at the resonance frequency of the baroreflex. 4-7-8 is
 * offered second, badged Emerging, rather than the other way round.
 *
 * The ocean layer's swell is locked to 10 seconds, which *is* coherence pace —
 * so if ocean is playing we offer to drive the circle straight off the audio.
 */

import { bus } from '../core/bus.js';
import { BREATH_EVIDENCE } from '../data/evidence.js';
import { getSettings, setSettings } from '../core/store.js';
import { pushLayer, popLayer, isLayerOpen, el } from './sheet.js';
import { badgeChip, openEvidenceData } from './evidence-ui.js';

const KEY = 'breathing';
const FRAME_MS = 1000 / 30;

const PATTERNS = {
  coherence: {
    id: 'coherence',
    name: 'Coherence',
    sub: '6 breaths / min',
    badge: BREATH_EVIDENCE.coherence.badge,
    phases: [
      { label: 'Breathe in', dur: 5, kind: 'in' },
      { label: 'Breathe out', dur: 5, kind: 'out' },
    ],
  },
  478: {
    id: '478',
    name: '4-7-8',
    sub: '4 in · 7 hold · 8 out',
    badge: BREATH_EVIDENCE['478'].badge,
    phases: [
      { label: 'Breathe in', dur: 4, kind: 'in' },
      { label: 'Hold', dur: 7, kind: 'hold' },
      { label: 'Breathe out', dur: 8, kind: 'out' },
    ],
  },
};

let engine = null;
let overlay = null;
let raf = 0;
let lastFrame = 0;
let acc = 0;
let phaseStart = 0;
let phaseIdx = 0;
let cycles = 0;
let synced = false;
let lastOceanPhase = 0;
let patternId = 'coherence';

let els = {};

export function initBreathing(deps) {
  engine = deps.engine;
  overlay = document.getElementById('breathing-overlay');
  if (!overlay) {
    console.warn('[ui] #breathing-overlay missing');
    return;
  }
  patternId = PATTERNS[getSettings().breathPattern] ? getSettings().breathPattern : 'coherence';
  build();
  document.getElementById('btn-breathe')?.addEventListener('click', () => openBreathing());

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopLoop();
    else if (isBreathingOpen()) startLoop();
  });

  bus.on('mix:changed', () => {
    if (isBreathingOpen()) refreshChrome();
  });
  bus.on('audio:stopped', () => {
    if (isBreathingOpen()) refreshChrome();
  });
}

export function isBreathingOpen() {
  return isLayerOpen(KEY);
}

/* ------------------------------------------------------------------ build */

function build() {
  overlay.textContent = '';
  overlay.classList.add('breathing');

  const top = el('div', 'breathe-top');
  const close = el('button', 'breathe-close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close');
  close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 6.6l10.8 10.8M17.4 6.6L6.6 17.4"/></svg>';
  close.addEventListener('click', () => closeBreathing());
  top.append(close);
  overlay.append(top);

  const stage = el('div', 'breathe-stage');
  const halo = el('div', 'breathe-halo');
  const circle = el('div', 'breathe-circle');
  const inner = el('div', 'breathe-inner');
  const phase = el('div', 'breathe-phase', 'Ready');
  const count = el('div', 'breathe-count', '');
  inner.append(phase, count);
  circle.append(inner);
  stage.append(halo, circle);
  overlay.append(stage);

  const bottom = el('div', 'breathe-bottom');

  const chips = el('div', 'breathe-patterns');
  for (const p of [PATTERNS.coherence, PATTERNS['478']]) {
    const c = el('button', 'breathe-chip');
    c.type = 'button';
    c.dataset.pattern = p.id;
    const line = el('span', 'breathe-chip-top');
    line.append(el('span', 'breathe-chip-name', p.name));
    line.append(badgeChip(p.badge, { small: true }));
    c.append(line);
    c.append(el('span', 'breathe-chip-sub', p.sub));
    c.addEventListener('click', () => setPattern(p.id));
    chips.append(c);
  }
  bottom.append(chips);

  const syncRow = el('div', 'breathe-sync');
  const syncBtn = el('button', 'sync-btn');
  syncBtn.type = 'button';
  syncBtn.append(el('span', 'sync-title', 'Sync to the waves'));
  syncBtn.append(el('span', 'sync-sub', 'The ocean swell is 10 seconds — exactly this pace.'));
  syncBtn.addEventListener('click', () => toggleSync());
  syncRow.append(syncBtn);
  bottom.append(syncRow);

  const why = el('div', 'breathe-why');
  const whyText = el('p', 'breathe-why-text', '');
  const whyLink = el('button', 'link-btn', 'Read the evidence');
  whyLink.type = 'button';
  whyLink.addEventListener('click', () => {
    const ev = BREATH_EVIDENCE[patternId];
    if (ev) openEvidenceData({ ...ev, claim: ev.title }, { eyebrow: 'Breathing' });
  });
  why.append(whyText, whyLink);
  bottom.append(why);

  overlay.append(bottom);

  els = { circle, halo, phase, count, chips, syncRow, syncBtn, whyText };
}

/* ------------------------------------------------------------- open/close */

export function openBreathing() {
  if (!overlay || isBreathingOpen()) return;
  pushLayer(KEY, closeBreathing);
  overlay.classList.remove('hidden');
  void overlay.offsetHeight;
  overlay.classList.add('open');
  cycles = 0;
  phaseIdx = 0;
  phaseStart = performance.now();
  synced = false;
  refreshChrome();
  bus.emit('screen:changed', { name: 'breathing' });
  startLoop();
}

export function closeBreathing() {
  if (!overlay || !isBreathingOpen()) return;
  popLayer(KEY);
  stopLoop();
  overlay.classList.remove('open');
  setTimeout(() => {
    if (!isBreathingOpen()) overlay.classList.add('hidden');
  }, 300);
  bus.emit('screen:changed', { name: 'mixer' });
}

function setPattern(id) {
  if (!PATTERNS[id]) return;
  patternId = id;
  setSettings({ breathPattern: id });
  phaseIdx = 0;
  cycles = 0;
  phaseStart = performance.now();
  if (id !== 'coherence') synced = false;
  refreshChrome();
}

function oceanAvailable() {
  if (!engine || typeof engine.getOceanPhase !== 'function') return false;
  const st = engine.getState?.();
  return !!(st?.running && st.layers?.ocean?.enabled);
}

function toggleSync() {
  if (!oceanAvailable()) return;
  synced = !synced;
  if (synced) {
    patternId = 'coherence';
    setSettings({ breathPattern: 'coherence' });
    cycles = 0;
    lastOceanPhase = readOceanPhase();
  } else {
    phaseIdx = 0;
    phaseStart = performance.now();
  }
  refreshChrome();
}

function readOceanPhase() {
  try {
    const p = engine.getOceanPhase();
    return Number.isFinite(p) ? ((p % 1) + 1) % 1 : 0;
  } catch {
    return 0;
  }
}

function refreshChrome() {
  for (const c of els.chips.querySelectorAll('.breathe-chip')) {
    c.classList.toggle('active', c.dataset.pattern === patternId && !synced);
  }
  const canSync = oceanAvailable();
  els.syncRow.classList.toggle('hidden', !canSync);
  els.syncBtn.classList.toggle('active', synced);
  const ev = BREATH_EVIDENCE[patternId];
  els.whyText.textContent = synced
    ? 'Following the ocean itself. The swell period is locked to 10 seconds — 0.1 Hz — which is the resonance frequency of the baroreflex.'
    : ev?.detail || '';
}

/* ------------------------------------------------------------------- loop */

function startLoop() {
  if (raf) return;
  lastFrame = performance.now();
  acc = 0;
  if (!synced) phaseStart = performance.now();
  raf = requestAnimationFrame(tick);
}

function stopLoop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function easeInOut(t) {
  return 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
}

function tick(now) {
  raf = requestAnimationFrame(tick);
  const dt = now - lastFrame;
  lastFrame = now;
  acc += dt;
  if (acc < FRAME_MS) return;
  acc = 0;

  let scale;
  let label;

  if (synced && oceanAvailable()) {
    const p = readOceanPhase();
    if (p < lastOceanPhase - 0.5) cycles += 1; // wrapped past the trough
    lastOceanPhase = p;
    // 0 = start of inhale, 0.5 = crest
    scale = 0.42 + 0.58 * (0.5 - 0.5 * Math.cos(2 * Math.PI * p));
    label = p < 0.5 ? 'Breathe in' : 'Breathe out';
  } else {
    if (synced) {
      synced = false;
      refreshChrome();
      phaseStart = now;
    }
    const pat = PATTERNS[patternId] || PATTERNS.coherence;
    const phase = pat.phases[phaseIdx % pat.phases.length];
    const elapsed = (now - phaseStart) / 1000;
    if (elapsed >= phase.dur) {
      phaseStart = now;
      phaseIdx = (phaseIdx + 1) % pat.phases.length;
      if (phaseIdx === 0) cycles += 1;
      return;
    }
    const t = elapsed / phase.dur;
    if (phase.kind === 'in') scale = 0.42 + 0.58 * easeInOut(t);
    else if (phase.kind === 'out') scale = 1 - 0.58 * easeInOut(t);
    else scale = 1;
    label = phase.label;
  }

  els.circle.style.transform = `scale(${scale.toFixed(4)})`;
  els.halo.style.transform = `scale(${(scale * 1.18).toFixed(4)})`;
  els.halo.style.opacity = String(0.18 + 0.3 * (scale - 0.42));
  if (els.phase.textContent !== label) els.phase.textContent = label;
  els.count.textContent = cycles > 0 ? `${cycles} ${cycles === 1 ? 'breath' : 'breaths'}` : '';
}
