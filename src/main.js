/**
 * Composition root — placeholder wiring so the stub app boots and the first
 * APK can be verified. Rewritten during integration once the three modules land.
 */

import './style.css';
import { bus } from './core/bus.js';
import { engine } from './audio/engine.js';
import { SleepTimer } from './core/timer.js';
import { Ads } from './services/ads.js';
import { Native } from './services/native.js';
import { Billing } from './services/billing.js';
import { Scenes } from './scenes/renderer.js';
import { PRESETS } from './data/presets.js';

async function boot() {
  SleepTimer.bind(engine);
  Scenes.attach(document.getElementById('scene-canvas'));
  await Ads.init();
  await Billing.init();

  document.getElementById('preset-row').textContent =
    `${PRESETS.length} presets ready · native=${Native.isNative()} · ads=${Ads.isAvailable()}`;

  document.getElementById('btn-play')?.addEventListener('click', async () => {
    if (engine.isRunning()) await engine.stop();
    else await engine.start();
  });

  bus.on('audio:started', () => console.log('[drift] audio started'));
  console.log('[drift] booted');
}

boot();
