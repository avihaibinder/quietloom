/**
 * The evidence sheet — Drift's differentiator.
 *
 * Every sound, the breathing pacer and the volume guide all render through
 * `renderEvidence()`, so a citation always looks the same wherever it appears.
 * Source links go out through Native.openUrl (Capacitor Browser on device),
 * falling back to window.open on the desktop.
 */

import { EVIDENCE, BADGE } from '../data/evidence.js';
import { Native } from '../services/native.js';
import { mountSheet, openSheet, closeSheet, sheetHeader, el } from './sheet.js';

const SHEET_ID = 'evidence-sheet';

export const BADGE_CLASS = {
  [BADGE.STRONG]: 'b-strong',
  [BADGE.MODERATE]: 'b-moderate',
  [BADGE.EMERGING]: 'b-emerging',
  [BADGE.TRADITIONAL]: 'b-traditional',
};

export const BADGE_MEANING = {
  [BADGE.STRONG]: 'Multiple studies or a systematic review, consistent direction of effect.',
  [BADGE.MODERATE]: 'At least one controlled study with a clear result.',
  [BADGE.EMERGING]: 'Promising controlled results, small samples, not widely replicated.',
  [BADGE.TRADITIONAL]: 'Widely used and well liked, without direct controlled evidence.',
};

let body = null;

export function initEvidenceSheet() {
  body = mountSheet(SHEET_ID, { label: 'Evidence' });
}

/** Small colour-coded badge chip. */
export function badgeChip(badge, { small = false } = {}) {
  const chip = el('span', `badge ${BADGE_CLASS[badge] || 'b-traditional'}${small ? ' badge-sm' : ''}`, badge);
  chip.title = BADGE_MEANING[badge] || '';
  return chip;
}

/** Round ⓘ button. */
export function infoDot(label, onClick) {
  const b = el('button', 'info-dot', 'i');
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick(e);
  });
  return b;
}

export function openUrl(url) {
  try {
    const r = Native.openUrl(url);
    if (r && typeof r.catch === 'function') r.catch(() => fallbackOpen(url));
  } catch {
    fallbackOpen(url);
  }
}

function fallbackOpen(url) {
  try {
    window.open(url, '_blank', 'noopener');
  } catch {
    /* nothing else we can do */
  }
}

/** A tappable list of citations. */
export function sourceList(sources = []) {
  const wrap = el('div', 'source-list');
  const head = el('p', 'source-head', 'Sources');
  wrap.append(head);
  for (const s of sources) {
    const b = el('button', 'source-link');
    b.type = 'button';
    b.append(el('span', 'source-label', s.label));
    const arrow = el('span', 'source-arrow');
    arrow.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>';
    b.append(arrow);
    b.addEventListener('click', () => openUrl(s.url));
    wrap.append(b);
  }
  return wrap;
}

/**
 * Renders a full evidence card into a container.
 * @param {{title:string, badge?:string, claim?:string, detail?:string, sources?:Array}} data
 */
export function renderEvidence(container, data, { eyebrow = 'The evidence' } = {}) {
  container.textContent = '';
  container.append(sheetHeader(data.title, { eyebrow, onClose: () => closeSheet(SHEET_ID) }));

  if (data.badge) {
    const row = el('div', 'evidence-badge-row');
    row.append(badgeChip(data.badge));
    row.append(el('span', 'badge-meaning', BADGE_MEANING[data.badge] || ''));
    container.append(row);
  }

  if (data.claim) container.append(el('p', 'evidence-claim', data.claim));

  if (data.detail) {
    for (const para of String(data.detail).split('\n\n')) {
      if (para.trim()) container.append(el('p', 'evidence-detail', para.trim()));
    }
  }

  if (data.sources?.length) container.append(sourceList(data.sources));

  const foot = el(
    'p',
    'evidence-foot',
    'Drift is not a medical device. Sample sizes in this literature are small and effects vary between people.',
  );
  container.append(foot);
}

/** Open the evidence sheet for a sound id from EVIDENCE. */
export function openEvidence(soundId) {
  const data = EVIDENCE[soundId];
  if (!data) return;
  openEvidenceData(data);
}

/** Open the evidence sheet for an arbitrary evidence-shaped object. */
export function openEvidenceData(data, opts) {
  if (!body) initEvidenceSheet();
  if (!body) return;
  renderEvidence(body, data, opts);
  openSheet(SHEET_ID);
}

/** The badge legend, shown from the Layers header. */
export function openBadgeLegend() {
  if (!body) initEvidenceSheet();
  if (!body) return;

  body.textContent = '';
  body.append(
    sheetHeader('How to read the badges', {
      eyebrow: 'Drift cites its sources',
      onClose: () => closeSheet(SHEET_ID),
    }),
  );
  body.append(
    el(
      'p',
      'evidence-claim',
      'Most sleep apps tell you a sound works. Drift tells you how well it is evidenced — including when the answer is "not very".',
    ),
  );

  const list = el('div', 'legend-list');
  for (const b of [BADGE.STRONG, BADGE.MODERATE, BADGE.EMERGING, BADGE.TRADITIONAL]) {
    const row = el('div', 'legend-row');
    row.append(badgeChip(b));
    row.append(el('p', 'legend-text', BADGE_MEANING[b]));
    list.append(row);
  }
  body.append(list);
  body.append(
    el(
      'p',
      'evidence-detail',
      'We link the negative findings too. A 2021 systematic review of 38 studies rated the overall evidence that continuous noise improves sleep as very low — which is exactly why the sleep timer defaults to on.',
    ),
  );
  body.append(
    sourceList([
      {
        label: 'Riedy 2021, Sleep Medicine Reviews — the counter-evidence',
        url: 'https://www.sciencedirect.com/science/article/abs/pii/S1087079220301283',
      },
    ]),
  );
  openSheet(SHEET_ID);
}
