import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Platform, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = {
  /** Cooldown in ms, wie lange wir nach "Später" nicht erneut fragen. */
  remindAfterMs?: number;
  /** Callback, sobald Benachrichtigungen effektiv erlaubt sind. */
  onGranted?: () => void;
};

const COOLDOWN_KEY = 'perm.notification.nudge.cooldownUntil';

export default function NotificationPermissionPrompt({ remindAfterMs = 6 * 60 * 60 * 1000, onGranted }: Props) {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<'explain' | 'settings'>('explain');

  function isGrantedLike(status: Notifications.PermissionStatus, iosProvisional?: boolean) {
    // iOS: "provisional" ist für stille Pushes ok – wir akzeptieren das als passabel
    if (status === 'granted') return true;
    if (Platform.OS === 'ios' && iosProvisional) return true;
    return false;
  }

  const hasEffectivePermission = useCallback(async () => {
    const perm = await Notifications.getPermissionsAsync();
    const iosProvisional = (perm as any)?.ios?.status === 'provisional';
    return isGrantedLike(perm.status, iosProvisional);
  }, []);

  const checkAndMaybeShow = useCallback(async () => {
    try {
      if (await hasEffectivePermission()) {
        setVisible(false);
        onGranted?.();
        return;
      }
      const cooldownUntil = Number(await AsyncStorage.getItem(COOLDOWN_KEY) || 0);
      if (!cooldownUntil || Date.now() >= cooldownUntil) {
        setPhase('explain');
        setVisible(true);
      }
    } catch {
      setPhase('explain');
      setVisible(true);
    }
  }, [hasEffectivePermission, onGranted]);

  useEffect(() => {
    checkAndMaybeShow();
  }, [checkAndMaybeShow]);

  async function handleAskNow() {
    try {
      const before = await Notifications.getPermissionsAsync();
      let result = before;

      // Wenn wir noch fragen dürfen → Dialog öffnen
      if (before.canAskAgain) {
        result = await Notifications.requestPermissionsAsync();
      }

      const iosProvisional = (result as any)?.ios?.status === 'provisional';
      if (isGrantedLike(result.status, iosProvisional)) {
        setVisible(false);
        onGranted?.();
        return;
      }

      // Falls blockiert (kein canAskAgain) → in die Einstellungen leiten
      if (!result.canAskAgain) {
        setPhase('settings');
      }
    } catch {
      // im Zweifel im Modal bleiben
    }
  }

  async function handleOpenSettings() {
    try { await Linking.openSettings(); } catch {}
  }
  async function handleIAllowed() {
    if (await hasEffectivePermission()) {
      setVisible(false);
      onGranted?.();
    }
  }
  async function handleLater() {
    try { await AsyncStorage.setItem(COOLDOWN_KEY, String(Date.now() + remindAfterMs)); } catch {}
    setVisible(false);
  }

  const copy = useMemo(() => {
    if (phase === 'settings') {
      return {
        title: 'Benachrichtigungen aktivieren',
        body:
          'Damit du Angebote sofort siehst, wenn du in der Nähe bist, bitte in den Geräteeinstellungen die Benachrichtigungen für Ultreia erlauben.',
        primary: 'Einstellungen öffnen',
        secondary: 'Ich habe es erlaubt',
        tertiary: 'Später',
      };
    }
    return {
      title: 'Warum Benachrichtigungen erlauben?',
      body:
        '• Damit du neue Angebote sofort siehst, wenn du in der Nähe bist.\n' +
        '• Töne/Vibration kannst du jederzeit in den Einstellungen ändern.\n\n' +
        'Du kannst das jederzeit in den App-/Systemeinstellungen anpassen.',
      primary: 'Jetzt erlauben',
      tertiary: 'Später',
    };
  }, [phase]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>

          <View style={styles.actions}>
            {phase === 'settings' ? (
              <>
                <Pressable onPress={handleOpenSettings} style={[styles.btn, styles.primary]}>
                  <Text style={styles.primaryText}>{copy.primary}</Text>
                </Pressable>
                <Pressable onPress={handleIAllowed} style={[styles.btn, styles.secondary]}>
                  <Text style={styles.secondaryText}>{copy.secondary}</Text>
                </Pressable>
                <Pressable onPress={handleLater} style={[styles.btn, styles.tertiary]}>
                  <Text style={styles.tertiaryText}>{copy.tertiary}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={handleAskNow} style={[styles.btn, styles.primary]}>
                  <Text style={styles.primaryText}>{copy.primary}</Text>
                </Pressable>
                <Pressable onPress={handleLater} style={[styles.btn, styles.tertiary]}>
                  <Text style={styles.tertiaryText}>{copy.tertiary}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 18,
    backgroundColor: '#fff',
    padding: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    color: '#222',
    marginBottom: 14,
  },
  actions: { gap: 10 },
  btn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: '#0d4ea6' },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondary: { backgroundColor: '#e9effa' },
  secondaryText: { color: '#0d4ea6', fontWeight: '700' },
  tertiary: { backgroundColor: '#f3f4f6' },
  tertiaryText: { color: '#111827', fontWeight: '600' },
});



