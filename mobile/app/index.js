// stepsmatch/mobile/app/index.js
import React, { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator, Text, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

export default function IndexGate() {
  const router = useRouter();
  const [bootstrapping, setBootstrapping] = useState(true);
  const [needsPerms, setNeedsPerms] = useState(false);
  const [permState, setPermState] = useState({ location: 'unknown', push: 'unknown' });

  const openSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {}
  }, []);

  const checkAndRequestPermissions = useCallback(async () => {
    // ---- Standort (erforderlich) ----
    let loc = await Location.getForegroundPermissionsAsync();
    if (!loc.granted) {
      loc = await Location.requestForegroundPermissionsAsync();
    }

    // ---- Push (optional) ----
    let push = await Notifications.getPermissionsAsync();
    const pushProvisionallyGranted =
      push?.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    const pushGranted = !!push?.granted || pushProvisionallyGranted;
    if (!pushGranted && push?.canAskAgain !== false) {
      try {
        push = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true, allowAnnouncements: false },
        });
      } catch {}
    }

    const pushProvisionallyGrantedAfter =
      push?.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    const pushGrantedAfter = !!push?.granted || pushProvisionallyGrantedAfter;

    setPermState({
      location: loc.granted ? 'granted' : (loc.canAskAgain ? 'denied' : 'blocked'),
      push: pushGrantedAfter ? 'granted' : (push?.canAskAgain ? 'denied' : 'blocked'),
    });

    // Standort ist Pflicht → Gate nur öffnen, wenn granted
    const locationOk = !!loc.granted;
    return locationOk;
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // 1) Deep-Link respektieren (z. B. Push-Open zu /offers/:id)
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          if (!mounted) return;
          router.replace(initialUrl);
          return;
        }

        const lastNotifResp = await Notifications.getLastNotificationResponseAsync();
        const lastNotifData = lastNotifResp?.notification?.request?.content?.data || {};
        const lastOfferId = lastNotifData?.offerId || lastNotifData?.id || lastNotifData?.offer || null;
        if (lastOfferId) {
          if (!mounted) return;
          router.replace({ pathname: '/(tabs)/offers/[id]', params: { id: String(lastOfferId) } });
          return;
        }


        // 2) Auth + Onboarding-Gate
        const [has, token, emailVerified, userEmail] = await Promise.all([
          AsyncStorage.getItem('hasOnboarded'),
          AsyncStorage.getItem('token'),
          AsyncStorage.getItem('userEmailVerified'),
          AsyncStorage.getItem('userEmail'),
        ]);
        if (!mounted) return;

        // 3) Permissions-Gate
        const ok = await checkAndRequestPermissions();
        if (!mounted) return;

        if (!ok) {
          // Standort fehlt → UI mit Hinweis & „Zu den Einstellungen“
          setNeedsPerms(true);
          return;
        }

        // 4) Routing
        if (!token) {
          router.replace('/(auth)/LoginScreen');
        } else if (emailVerified === '0') {
          router.replace({
            pathname: '/(auth)/VerifyEmailScreen',
            params: { email: userEmail || '', next: has === '1' ? 'tabs' : 'onboarding' },
          });
        } else if (has === '1') {
          router.replace('/(tabs)');
        } else {
          router.replace('/(onboarding)/WelcomeScreen');
        }
      } catch {
        if (!mounted) return;
        // defensiver Fallback
        router.replace('/(onboarding)/WelcomeScreen');
      } finally {
        if (mounted) setBootstrapping(false);
      }
    })();

    return () => { mounted = false; };
  }, [router, checkAndRequestPermissions]);

  const retry = useCallback(async () => {
    setBootstrapping(true);
    const ok = await checkAndRequestPermissions();
    setBootstrapping(false);
    if (ok) {
      // Wenn Permissions jetzt ok sind, erneut Onboarding-Gate prüfen und weiter
      const [has, token, emailVerified, userEmail] = await Promise.all([
        AsyncStorage.getItem('hasOnboarded'),
        AsyncStorage.getItem('token'),
        AsyncStorage.getItem('userEmailVerified'),
        AsyncStorage.getItem('userEmail'),
      ]);
      if (!token) {
        router.replace('/(auth)/LoginScreen');
      } else if (emailVerified === '0') {
        router.replace({
          pathname: '/(auth)/VerifyEmailScreen',
          params: { email: userEmail || '', next: has === '1' ? 'tabs' : 'onboarding' },
        });
      } else if (has === '1') {
        router.replace('/(tabs)');
      } else {
        router.replace('/(onboarding)/WelcomeScreen');
      }
    } else {
      setNeedsPerms(true);
    }
  }, [checkAndRequestPermissions, router]);

  if (bootstrapping && !needsPerms) {
    // Kleiner Loader, falls der Redirect einen Tick dauert
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (needsPerms) {
    const locBlocked = permState.location === 'blocked';
    const locDenied = permState.location === 'denied';
    const pushDenied = permState.push === 'denied' || permState.push === 'blocked';

    return (
      <View style={{ flex: 1, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>
          Standortberechtigung benötigt
        </Text>
        <Text style={{ color: '#4b5563', textAlign: 'center', marginBottom: 16, lineHeight: 20 }}>
          Damit wir Angebote in deiner Nähe anzeigen können, erlaube bitte den Zugriff auf deinen Standort.
        </Text>

        {pushDenied && (
          <Text style={{ color: '#6b7280', textAlign: 'center', marginBottom: 10, fontSize: 12 }}>
            Tipp: Push-Benachrichtigungen sind optional – damit verpasst du keine neuen Angebote.
          </Text>
        )}

        <View style={{ flexDirection: 'column', width: '100%', maxWidth: 320 }}>
          <TouchableOpacity
            onPress={openSettings}
            activeOpacity={0.9}
            style={{
              backgroundColor: '#3b82f6',
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              {Platform.OS === 'ios' ? 'Zu den iOS-Einstellungen' : 'Zu den App-Einstellungen'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={retry}
            activeOpacity={0.9}
            style={{
              backgroundColor: '#eef2ff',
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#111827', fontWeight: '700' }}>Erneut prüfen</Text>
          </TouchableOpacity>
        </View>

        {(locDenied || locBlocked) && (
          <Text style={{ color: '#9ca3af', marginTop: 12, fontSize: 12, textAlign: 'center' }}>
            Falls die Abfrage nicht erscheint, öffne die Einstellungen und erlaube „Standortzugriff“.
          </Text>
        )}
      </View>
    );
  }

  // Fallback-Loader
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
