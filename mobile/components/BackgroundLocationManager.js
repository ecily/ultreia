// stepsmatch/mobile/components/BackgroundLocationManager.js
import { sendHeartbeat } from './PushInitializer';

// Hinweis in den Logs, damit klar ist, dass hier nichts mehr doppelt startet
console.log('[BGLOC] BackgroundLocationManager: delegating to PushInitializer (no own task/start)');

/**
 * Optionaler, sicherer Kickstart – falls irgendwo im Code noch gebraucht.
 * Keine eigenen fetch()-Calls, kein doppelter Task-Start.
 * sendHeartbeat() kümmert sich selbst um Token & Position.
 */
export async function kickstartOnce() {
  try {
    await sendHeartbeat(undefined, 'Kickstart(BackgroundManager)');
  } catch (e) {
    console.log('[BGLOC] Kickstart wrapper error', e?.message || e);
  }
}

/** Keine Side-Effects mehr – PushInitializer übernimmt alles. */
export default function BackgroundLocationManager() {
  return null;
}

