/**
 * "How loud should this be?" — the feature almost nobody ships.
 * Built from VOLUME_EVIDENCE, plus the Nursery-safe hard cap.
 */

import { bus, toast } from '../core/bus.js';
import { VOLUME_EVIDENCE } from '../data/evidence.js';
import { getSettings, setSettings } from '../core/store.js';
import { mountSheet, openSheet, closeSheet, sheetHeader, el } from './sheet.js';
import { sourceList } from './evidence-ui.js';

const SHEET_ID = 'evidence-sheet';

let body = null;

export function initVolumeGuide() {
  body = mountSheet(SHEET_ID, { label: 'Volume guide' });
}

export function openVolumeGuide() {
  if (!body) initVolumeGuide();
  if (!body) return;
  render();
  openSheet(SHEET_ID);
}

const LEVELS = [
  { db: '30 dB(A)', label: 'WHO bedroom target', note: 'Continuous sound below this does not disturb sleep architecture.', tone: 'good' },
  { db: '40 dB', label: 'Movement and arousals begin', note: 'Between 30 and 40 dB you move more without fully waking.', tone: 'mid' },
  { db: '46 dB', label: 'The trial that worked', note: 'Messineo 2017 cut sleep-onset latency 38% at this level — above the WHO figure. Hence the timer.', tone: 'mid' },
  { db: '50 dB', label: 'Infant ceiling', note: 'AAP guidance for nursery sound machines. Never at maximum, at least 2 m away.', tone: 'warn' },
];

function render() {
  body.textContent = '';
  body.append(
    sheetHeader(VOLUME_EVIDENCE.title, {
      eyebrow: 'Safe listening',
      onClose: () => closeSheet(SHEET_ID),
    }),
  );

  body.append(
    el(
      'p',
      'evidence-claim',
      'Loud enough to mask, quiet enough to sleep through. Those are two different numbers, and the gap is why Drift turns itself off.',
    ),
  );

  const scale = el('div', 'db-scale');
  for (const lv of LEVELS) {
    const row = el('div', `db-row tone-${lv.tone}`);
    row.append(el('span', 'db-value', lv.db));
    const t = el('div', 'db-text');
    t.append(el('span', 'db-label', lv.label));
    t.append(el('span', 'db-note', lv.note));
    row.append(t);
    scale.append(row);
  }
  body.append(scale);

  /* ---- nursery-safe cap ---- */
  const safe = getSettings().nurserySafe === true;
  const card = el('div', 'setting-card');
  const row = el('div', 'setting-row');
  const text = el('div', 'setting-text');
  text.append(el('span', 'setting-title', 'Nursery-safe cap'));
  text.append(
    el(
      'span',
      'setting-sub',
      'Hard-limits the master volume to 45%. Use it if this is playing anywhere near a baby.',
    ),
  );
  row.append(text);
  row.append(switchEl(safe, (on) => {
    setSettings({ nurserySafe: on });
    bus.emit('ui:settings', { nurserySafe: on });
    toast(on ? 'Nursery-safe cap on' : 'Nursery-safe cap off');
    render();
  }, 'Nursery-safe cap'));
  card.append(row);

  if (safe) {
    card.append(
      el(
        'p',
        'setting-why',
        'American Academy of Pediatrics guidance for sound machines in hospital nurseries: 50 dB or lower, at least 2 metres (7 feet) from the sleep space, never at maximum volume. The cap enforces the ceiling; the distance is on you.',
      ),
    );
  }
  body.append(card);

  for (const para of VOLUME_EVIDENCE.detail.split('\n\n')) {
    if (para.trim()) body.append(el('p', 'evidence-detail', para.trim()));
  }

  body.append(sourceList(VOLUME_EVIDENCE.sources));
}

/** Reusable pill switch. */
export function switchEl(on, onChange, label) {
  const b = el('button', `switch${on ? ' on' : ''}`);
  b.type = 'button';
  b.setAttribute('role', 'switch');
  b.setAttribute('aria-checked', on ? 'true' : 'false');
  if (label) b.setAttribute('aria-label', label);
  b.append(el('span', 'switch-knob'));
  b.addEventListener('click', () => onChange(!on));
  return b;
}
