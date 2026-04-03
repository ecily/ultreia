// stepsmatch/mobile/components/permissions/LocationAlwaysGate.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { Platform, View, Text, Pressable, Linking, StyleSheet, AppState } from 'react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * Zeigt ein dezentes Banner, wenn Background Location NICHT "granted" ist.
 * Button öffnet die Android-App-Einstellungen, damit der/die Nutzer:in "Immer erlauben" setzen kann.
 * - iOS: wird nicht angezeigt (App Settings würden nicht direkt zu "Always" führen).
 * - Android: BG-Check auf App-Start und bei Rückkehr in die App (AppState).
 *
 * Keine Änderung an Push-/Geofencing-Logiken.
 */
export default function LocationAlwaysGate() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [needsGate, setNeedsGate] = useState(false);

  const checkBg = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setNeedsGate(false);
      return;
    }
    try {
      const bg = await Location.getBackgroundPermissionsAsync();
      // Statuswerte: 'granted' | 'denied' | 'undetermined'
      const ok = bg?.status === 'granted';
      setNeedsGate(!ok);
    } catch {
      // Fallback: sicherheitshalber nichts blockieren
      setNeedsGate(false);
    }
  }, []);

  useEffect(() => {
    checkBg();
  }, [checkBg]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') checkBg();
    });
    return () => sub.remove();
  }, [checkBg]);

  if (!needsGate) return null;
  if (Platform.OS !== 'android') return null;

  return (
    <View
      pointerEvents="box-none"
      style={StyleSheet.flatten([
        styles.root,
        { paddingBottom: Math.max(12, insets.bottom + 8) },
      ])}
    >
      <View
        style={StyleSheet.flatten([
          styles.card,
          {
            backgroundColor: t.colors.elevated,
            borderColor: t.colors.divider,
          },
        ])}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: t.colors.inkHigh,
              fontSize: 14,
              fontWeight: '700',
              marginBottom: 2,
            }}
          >
            Standort „Immer erlauben“
          </Text>
          <Text
            style={{
              color: t.colors.ink,
              fontSize: 13,
              lineHeight: 18,
            }}
            numberOfLines={3}
          >
            Damit StepsMatch Angebote im Hintergrund finden kann, aktiviere bitte
            „Immer erlauben“ in den Android-Einstellungen.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            // Öffnet App-Einstellungen; von dort → Standort → „Immer erlauben“
            Linking.openSettings().catch(() => {});
          }}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: t.colors.primary,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <Text
            style={{
              color: '#fff',
              fontSize: 13,
              fontWeight: '700',
            }}
          >
            Einstellungs­menü öffnen
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    zIndex: 50,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 6,
    gap: 12,
  },
  cta: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
});
