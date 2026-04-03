// stepsmatch/mobile/bootHeadless.ts
import { AppRegistry, Platform } from 'react-native';
import { headlessBootstrap } from './components/PushInitializer';

// Guard gegen Doppel-Registrierung & Parallelstarts
let __registered = false;
let __inFlight = false;

async function runHeadlessBootstrapOnce() {
  if (__inFlight) {
    try { console.log('[HEADLESS] skip (already in-flight)'); } catch {}
    return;
  }
  __inFlight = true;
  try {
    console.log('[HEADLESS] task start');
    await headlessBootstrap();
    console.log('[HEADLESS] task done');
  } catch (e: any) {
    try { console.log('[HEADLESS] error', e?.message || String(e)); } catch {}
  } finally {
    __inFlight = false;
  }
}

// Headless-Handler (Signatur gemäß RN)
const handler = async () => {
  await runHeadlessBootstrapOnce();
};

if (Platform.OS === 'android' && !__registered) {
  // Optionaler, eigener Task-Name (falls ein nativer BootReceiver diesen Task explizit startet)
  AppRegistry.registerHeadlessTask('BootHeadlessTask', () => handler);

  // Expo interner Headless-Einstieg (z. B. wenn Expo-Services die App headless wecken)
  AppRegistry.registerHeadlessTask('ExpoHeadlessApp', () => handler);

  __registered = true;
}

// Keine Exports nötig – wichtig ist, dass diese Datei vom Entry importiert wird.
export {};
