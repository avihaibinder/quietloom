/**
 * Background audio + media notification wiring.
 *
 * This module FIXES the known gap of the web/Capacitor build: with the screen
 * off and outside bedside mode, Android eventually froze the WebView and the
 * sound died. react-native-audio-api ships an Android mediaPlayback foreground
 * service with a media-style notification (enabled via the plugin config in
 * rn/app.json) and the matching iOS background-audio session, so the engine can
 * keep synthesising all night.
 *
 * House rule inherited from the web build's services: NOTHING in here may
 * throw. A notification is decoration; the audio path must survive any failure
 * in it, so every native call is wrapped and every returned promise has its
 * rejection swallowed (after a console.warn).
 *
 * ABSOLUTELY NO microphone / recording APIs are used here — a sleep app that
 * requests the mic is a trust catastrophe (team decision; the web build
 * rejected a Capacitor plugin over exactly this). The session category is
 * 'playback', never 'playAndRecord', and no recording permission is touched.
 */

import { AudioManager, PlaybackNotificationManager } from 'react-native-audio-api';

import { bus } from '../core/bus';
import { SOUND_IDS } from '../types';
import type { EngineState } from '../types';
import type { AudioEngine } from './engine';

/** Human names for the notification's artist line. */
const LAYER_LABELS: Record<(typeof SOUND_IDS)[number], string> = {
  rain: 'Rain',
  thunder: 'Thunder',
  ocean: 'Ocean',
  wind: 'Wind',
  fire: 'Fire',
  crickets: 'Crickets',
  pink: 'Pink Noise',
  brown: 'Brown Noise',
  white: 'White Noise',
  binaural: 'Binaural Beats',
  deeppulse: 'Deep Pulse',
};

/** e.g. 'Rain · Pink Noise'. Falls back when nothing is enabled yet. */
function mixSummary(state: EngineState): string {
  const names = SOUND_IDS.filter((id) => state.layers[id].enabled).map((id) => LAYER_LABELS[id]);
  return names.length ? names.join(' · ') : 'Sleep sounds';
}

const swallow = (what: string) => (err: unknown) => {
  console.warn(`[background] ${what} failed`, err);
};

let initialized = false;

/**
 * Call once at boot, before the first engine.start(). Safe to call again (it
 * no-ops), safe on platforms where any of the native pieces are missing.
 */
export function initBackgroundAudio(engine: AudioEngine): void {
  if (initialized) return;
  initialized = true;

  // Session first: 'playback' is what lets iOS keep the audio unit alive with
  // the screen locked. Exact option names verified against system/types.d.ts.
  try {
    AudioManager.setAudioSessionOptions({
      iosCategory: 'playback',
      iosMode: 'default',
      iosOptions: ['allowBluetoothA2DP', 'allowAirPlay'],
    });
  } catch (err) {
    swallow('setAudioSessionOptions')(err);
  }

  // Pause on phone calls / other apps taking the output, resume when they end.
  try {
    AudioManager.observeAudioInterruptions(true);
  } catch (err) {
    swallow('observeAudioInterruptions')(err);
  }

  // The artist line only changes when the *set of enabled layers* changes, so
  // remember the last one and skip identical updates — 'mix:changed' also fires
  // for every step of a volume drag, and re-posting the notification each time
  // would make the shade flicker.
  let lastArtist: string | null = null;

  const showNotification = (artist: string): void => {
    lastArtist = artist;
    try {
      PlaybackNotificationManager.show({
        title: 'Quietloom',
        artist,
        state: 'playing',
      }).catch(swallow('notification show'));
      PlaybackNotificationManager.enableControl('play', true).catch(swallow('enableControl play'));
      PlaybackNotificationManager.enableControl('pause', true).catch(swallow('enableControl pause'));
    } catch (err) {
      swallow('notification show')(err);
    }
  };

  bus.on('audio:started', () => {
    showNotification(mixSummary(engine.getState()));
  });

  // Hide rather than flip to 'paused': a stopped sleep app should leave no
  // notification behind. Waking at 03:00 to a stale media card inviting you to
  // fiddle with your phone is the opposite of what this app is for.
  bus.on('audio:stopped', () => {
    lastArtist = null;
    try {
      PlaybackNotificationManager.hide().catch(swallow('notification hide'));
    } catch (err) {
      swallow('notification hide')(err);
    }
  });

  bus.on('mix:changed', (state) => {
    if (!engine.isRunning()) return;
    const artist = mixSummary(state);
    if (artist === lastArtist) return;
    showNotification(artist);
  });

  // Notification transport buttons drive the engine through its public API.
  // Pause and stop are the same thing for a sleep app: silence, now.
  const stopFromNotification = (): void => {
    try {
      engine.stop().catch(swallow('engine.stop'));
    } catch (err) {
      swallow('engine.stop')(err);
    }
  };
  const startFromNotification = (): void => {
    try {
      engine.start().catch(swallow('engine.start'));
    } catch (err) {
      swallow('engine.start')(err);
    }
  };

  try {
    PlaybackNotificationManager.addEventListener('playbackNotificationPause', stopFromNotification);
    PlaybackNotificationManager.addEventListener('playbackNotificationStop', stopFromNotification);
    PlaybackNotificationManager.addEventListener('playbackNotificationPlay', startFromNotification);
  } catch (err) {
    swallow('notification listeners')(err);
  }
}
