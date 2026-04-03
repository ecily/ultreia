// stepsmatch/mobile/components/LocationPermissionPrompt.tsx
import { useEffect } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = {
  /** Cooldown in ms, wie lange wir nach "Später" nicht erneut nudgen. (Nur noch für Kompat.) */
  remindAfterMs?: number;
  /** Wird aufgerufen, sobald FG/BG effektiv verfügbar ist. */
  onGranted?: () => void;
};

const COOLDOWN_KEY = 'perm.location.nudge.cooldownUntil';

/**
 * LEGACY PROMPT DEAKTIVIERT
 * -------------------------
 * Dieses Komponent zeigte früher ein eigenes Modal. Um Doppel-Prompts zu vermeiden,
 * macht es jetzt *kein sichtbares UI* mehr. Es prüft nur noch, ob wir effektive
 * Location-Rechte haben und ruft ggf. `onGranted()` auf.
 * Alles weitere regelt das zentrale PermissionGate.
 */
export default function LocationPermissionPrompt({
  remindAfterMs = 6 * 60 * 60 * 1000,
  onGranted,
}: Props) {
  useEffect(() => {
    (async () => {
      try {
        if (await hasEffectivePermission()) {
          onGranted?.();
        } else {
          // Legacy-Kompatibilität: setze (stille) Cooldown-Marke, aber zeige kein Modal mehr
          try {
            await AsyncStorage.setItem(
              COOLDOWN_KEY,
              String(Date.now() + remindAfterMs)
            );
          } catch {}
        }
      } catch {
        // schweigend ignorieren
      }
    })();
  }, [remindAfterMs, onGranted]);

  return null;
}

async function hasEffectivePermission(): Promise<boolean> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== 'granted') return false;

    // Android braucht BG für Geofencing/BG-Updates
    const isAndroid = Platform.OS === 'android';
    if (isAndroid) {
      const bg = await Location.getBackgroundPermissionsAsync();
      return bg.status === 'granted';
    }

    // iOS: "whenInUse" akzeptieren
    return true;
  } catch {
    return false;
  }
}

