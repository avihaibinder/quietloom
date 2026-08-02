/**
 * Transient message host. Listens for the `toast` bus event.
 * Never more than three on screen; oldest is retired first.
 */

import { bus } from '../core/bus.js';

const LIFETIME_MS = 2900;
const MAX = 3;

let host = null;
let unsub = null;

export function initToasts() {
  host = document.getElementById('toast-host');
  if (!host) {
    console.warn('[ui] #toast-host missing');
    return;
  }
  if (unsub) unsub();
  unsub = bus.on('toast', (payload) => {
    const message = typeof payload === 'string' ? payload : payload?.message;
    if (message) show(String(message));
  });
}

export function show(message) {
  if (!host) return;

  while (host.children.length >= MAX) {
    retire(host.firstElementChild);
  }

  const node = document.createElement('div');
  node.className = 'toast';
  node.setAttribute('role', 'status');
  node.textContent = message;
  host.append(node);

  // reflow, then animate in
  void node.offsetHeight;
  node.classList.add('in');

  const t = setTimeout(() => retire(node), LIFETIME_MS);
  node.addEventListener('click', () => {
    clearTimeout(t);
    retire(node);
  });
}

function retire(node) {
  if (!node || node.dataset.retiring === '1') return;
  node.dataset.retiring = '1';
  node.classList.remove('in');
  setTimeout(() => node.remove(), 240);
}
