import { useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { API_BASE, APP_VERSION, EXPO_PROJECT_ID, ULTREIA_MODE } from '../lib/config';
import { bindDeviceToUser, getDeviceId, registerDevice } from '../lib/device';
import { configureNotificationChannels, registerPushToken, requestNotificationPermission, showLocalTechnicalNotification } from '../lib/notifications';
import { getBackgroundLocationTaskStatus, getCurrentLocation, getGeofenceStatus, getLocationPermissions, registerTechnicalGeofence, sendHeartbeat, startBackgroundLocation } from '../lib/location';
import { getJson } from '../lib/api';
import { listenForMagicLinks, loadCurrentUser, logout, openVerificationUrl, readDevVerificationUrl, requestMagicLink } from '../lib/auth';
import { getSession } from '../lib/session';
import { AUTH_TEXT } from '../lib/i18n';

export default function HomeScreen() {
  const [deviceId, setDeviceId] = useState('wird geladen …');
  const [location, setLocation] = useState(null);
  const [logs, setLogs] = useState([]);
  const [authStatus, setAuthStatus] = useState(AUTH_TEXT.signedOut);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [devUrl, setDevUrl] = useState(null);
  const [status, setStatus] = useState({ api: 'unbekannt', ready: 'unbekannt', database: 'unbekannt', registration: 'unbekannt', location: 'unbekannt', background: 'unbekannt', backgroundTask: 'unbekannt', backgroundService: 'unbekannt', notification: 'unbekannt', push: 'unbekannt', localPush: '–', serverPush: 'wartet auf externen Test', geofence: 'unbekannt', geofenceData: '–', lastHeartbeat: '–', lastServerContact: '–', lastGeofence: '–', error: '–' });

  const log = (message) => setLogs((current) => [`${new Date().toLocaleTimeString()}  ${message}`, ...current].slice(0, 30));
  const markServerContact = () => setStatus((current) => ({ ...current, lastServerContact: new Date().toLocaleTimeString(), error: '–' }));
  const run = async (label, action) => {
    try {
      const result = await action();
      markServerContact();
      log(`${label}: OK`);
      return result;
    } catch (error) {
      setStatus((current) => ({ ...current, error: `${label}: ${error.code || 'client_error'} / ${error.message}` }));
      log(`${label}: FEHLER – ${error.code || 'client_error'} / ${error.message}`);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;
    const refreshLocationPermissions = async () => {
      const [result, taskStarted, geofenceStarted] = await Promise.all([
        getLocationPermissions(),
        getBackgroundLocationTaskStatus(),
        getGeofenceStatus(),
      ]);
      if (!mounted) return;
      setStatus((current) => ({
        ...current,
        location: result.foreground.granted ? 'erlaubt' : result.foreground.status,
        background: result.background.granted ? 'erlaubt' : result.background.status,
        backgroundTask: taskStarted ? 'aktiv' : 'inaktiv',
        backgroundService: taskStarted ? 'aktiv' : 'inaktiv',
        geofence: geofenceStarted ? 'registriert' : 'nicht registriert',
      }));
    };

    refreshLocationPermissions().catch((error) => log(`Location-Status: ${error.message}`));
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') refreshLocationPermissions().catch((error) => log(`Location-Status: ${error.message}`));
    });

    configureNotificationChannels().catch((error) => log(`Channels: ${error.message}`));
    getDeviceId().then(setDeviceId).catch((error) => log(`Device-ID: ${error.message}`));
    getSession().then((session) => { if (session) setAuthStatus(`${session.user?.displayName || 'angemeldet'} · ${session.scope || 'production'}`); }).catch(() => {});
    const removeMagicLinkListener = listenForMagicLinks(async (url) => { try { const result = await openVerificationUrl(url); await bindDeviceToUser(); setAuthStatus(`${result.user.displayName} · ${result.session.scope}`); log('Magic-Link verarbeitet: OK'); } catch (error) { log(`Magic-Link: FEHLER · ${error.code || 'client_error'}`); } });
    SecureStore.getItemAsync('ultreia.lastHeartbeat').then((value) => { if (value) setStatus((current) => ({ ...current, lastHeartbeat: JSON.parse(value).at })); }).catch(() => {});
    SecureStore.getItemAsync('ultreia.lastGeofenceEvent').then((value) => { if (value) setStatus((current) => ({ ...current, lastGeofence: JSON.parse(value).at })); }).catch(() => {});
    getJson('/health').then((health) => {
      setStatus((current) => ({ ...current, api: health.status || 'ok', database: health.database?.connected ? 'verbunden' : 'nicht verbunden', lastServerContact: new Date().toLocaleTimeString() }));
      setLogs((current) => [`${new Date().toLocaleTimeString()}  Backend-Health: OK`, ...current].slice(0, 30));
    }).catch((error) => {
      setStatus((current) => ({ ...current, api: 'nicht erreichbar', error: `Backend-Health: ${error.message}` }));
      setLogs((current) => [`${new Date().toLocaleTimeString()}  Backend-Health: FEHLER – ${error.message}`, ...current].slice(0, 30));
    });
    getJson('/ready').then(() => {
      setStatus((current) => ({ ...current, ready: 'bereit' }));
    }).catch((error) => {
      setStatus((current) => ({ ...current, ready: error.code === 'backend_not_ready' ? 'nicht bereit' : 'nicht erreichbar' }));
    });

    return () => {
      mounted = false;
      appStateSubscription.remove();
      removeMagicLinkListener();
    };
  }, []);

  const locate = async () => {
    const current = await getCurrentLocation();
    setLocation(current.coords);
    setStatus((value) => ({ ...value, location: 'erlaubt' }));
    return current;
  };

  const requestPermissions = async () => {
    const result = await (await import('../lib/location')).requestLocationPermissions();
    setStatus((current) => ({
      ...current,
      location: result.foreground.granted ? 'erlaubt' : result.foreground.status,
      background: result.background.granted ? 'erlaubt' : result.background.status,
    }));
    log(`Location: ${result.foreground.status}/${result.background.status}`);
    return result;
  };

  const requestNotifications = async () => {
    const result = await requestNotificationPermission();
    setStatus((current) => ({ ...current, notification: result.granted ? 'erlaubt' : result.status }));
    return result;
  };

  const heartbeat = async () => {
    const result = await sendHeartbeat();
    setStatus((current) => ({ ...current, lastHeartbeat: result.receivedAt || new Date().toLocaleTimeString() }));
    return result;
  };

  const register = async () => {
    const result = await registerDevice();
    setStatus((current) => ({ ...current, registration: 'registriert' }));
    return result;
  };

  const requestMagic = async () => {
    const result = await requestMagicLink(email, displayName);
    if (result.diagnosticId) {
      const devResult = await readDevVerificationUrl(result.diagnosticId);
      setDevUrl(devResult.verificationUrl);
      setAuthStatus(AUTH_TEXT.localLinkReady);
    } else setAuthStatus(AUTH_TEXT.requested);
    return result;
  };

  const verifyDevMagic = async () => {
    if (!devUrl) throw new Error(AUTH_TEXT.noDevLink);
    const result = await openVerificationUrl(devUrl);
    await bindDeviceToUser();
    setAuthStatus(`${result.user.displayName} · ${result.session.scope}`);
    setDevUrl(null);
    return result;
  };

  const signOut = async () => { await logout(); setAuthStatus(AUTH_TEXT.signedOut); };

  const startBackground = async () => {
    const result = await startBackgroundLocation();
    setStatus((current) => ({ ...current, backgroundTask: result.started ? 'aktiv' : 'inaktiv', backgroundService: result.started ? 'aktiv' : 'inaktiv' }));
    return result;
  };

  const pushToken = async () => {
    const token = await registerPushToken();
    setStatus((current) => ({ ...current, notification: 'erlaubt', push: 'registriert' }));
    log('Expo Push Token: vorhanden; Backend-Registrierung: OK');
    return token;
  };

  const localPush = async () => {
    await showLocalTechnicalNotification();
    setStatus((current) => ({ ...current, localPush: 'ausgelöst' }));
  };

  const geofence = async () => {
    const result = await registerTechnicalGeofence();
    setStatus((current) => ({
      ...current,
      geofence: result.registered ? 'registriert' : 'nicht registriert',
      geofenceData: `${result.geofenceId} · ${result.radiusMeters} m · ${result.latitude.toFixed(5)}, ${result.longitude.toFixed(5)}`,
    }));
    return result;
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>ULTREIA · TECHNICAL FOUNDATION</Text>
        <Text style={styles.title}>Android proof screen</Text>
        <Text style={styles.copy}>Diese bewusst neutrale Oberfläche verifiziert Device-ID, Permissions, Location, Heartbeat, Push, lokale Notifications und Geofence.</Text>
        <Text style={styles.label}>Environment / Version</Text><Text style={styles.value}>{ULTREIA_MODE} · {APP_VERSION} · Expo: {EXPO_PROJECT_ID ? 'konfiguriert' : 'fehlt'}</Text>
        <Text style={styles.label}>API</Text><Text style={styles.value}>{API_BASE}</Text>
        <Text style={styles.label}>Device-ID</Text><Text style={styles.value}>{deviceId}</Text>
        <Text style={styles.label}>Auth / Scope</Text><Text style={styles.value}>{authStatus} · {AUTH_TEXT.scope}: {ULTREIA_MODE === 'production' ? 'production' : 'local_test'}</Text>
        <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder={AUTH_TEXT.emailPlaceholder} value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder={AUTH_TEXT.displayNamePlaceholder} value={displayName} onChangeText={setDisplayName} />
        {location && <Text style={styles.value}>Standort: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)} · ±{Math.round(location.accuracy || 0)} m</Text>}
        <Text style={styles.label}>Technischer Status</Text>
        <View style={styles.statusBox}>
          <Text style={styles.status}>API/Health: {status.api} · Ready: {status.ready} · Mongo: {status.database}</Text>
          <Text style={styles.status}>Device-Registration: {status.registration}</Text>
          <Text style={styles.status}>Location: {status.location} · Background: {status.background} · Task: {status.backgroundTask}</Text>
          <Text style={styles.status}>Foreground-Service: {status.backgroundService}</Text>
          <Text style={styles.status}>Notification: {status.notification} · Expo Push Token / Backend: {status.push}</Text>
          <Text style={styles.status}>Local Push: {status.localPush} · Server Push: {status.serverPush}</Text>
          <Text style={styles.status}>Server-Push-Test: extern über Operator-Shell auslösen</Text>
          <Text style={styles.status}>Geofence: {status.geofence} · Daten: {status.geofenceData}</Text>
          <Text style={styles.status}>Heartbeat: {status.lastHeartbeat}</Text>
          <Text style={styles.status}>Serverkontakt: {status.lastServerContact}</Text>
          <Text style={styles.status}>Geofence-Event: {status.lastGeofence}</Text>
          <Text style={styles.status}>Fehler: {status.error}</Text>
        </View>
        <View style={styles.grid}>
          <Action label={AUTH_TEXT.magicRequest} onPress={() => run('Magic-Link', requestMagic)} />
          {devUrl && <Action label={AUTH_TEXT.devVerify} onPress={() => run('Magic-Link Diagnose', verifyDevMagic)} />}
          <Action label={AUTH_TEXT.authDevice} onPress={() => run('Auth / Device-Bindung', async () => { const result = await loadCurrentUser(); await bindDeviceToUser(); setAuthStatus(`${result.user.displayName} · ${result.scope}`); return result; })} />
          <Action label={AUTH_TEXT.logout} onPress={() => run('Abmelden', signOut)} />
          <Action label="Backend-Gerät registrieren" onPress={() => run('Gerät registrieren', register)} />
          <Action label="Location-Permissions" onPress={() => run('Location-Permissions', requestPermissions)} />
          <Action label="Notification-Permission" onPress={() => run('Notification-Permission', requestNotifications)} />
          <Action label="Standort erfassen" onPress={() => run('Standort', locate)} />
          <Action label="Heartbeat senden" onPress={() => run('Heartbeat', heartbeat)} />
          <Action label="Background Location starten" onPress={() => run('Background Location', startBackground)} />
          <Action label="Push-Token registrieren" onPress={() => run('Push-Token', pushToken)} />
          <Action label="Lokale Notification" onPress={() => run('Lokale Notification', localPush)} />
          <Action label="Geofence registrieren" onPress={() => run('Geofence', geofence)} />
        </View>
        <Text style={styles.label}>Diagnose-Log</Text>
        <View style={styles.logBox}>{logs.length ? logs.map((entry) => <Text key={entry} style={styles.log}>{entry}</Text>) : <Text style={styles.log}>Noch keine Aktionen.</Text>}</View>
      </ScrollView>
    </View>
  );
}

function Action({ label, onPress }) { return <Pressable style={styles.button} onPress={onPress}><Text style={styles.buttonText}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f1e8' }, content: { padding: 24, paddingTop: 64, gap: 10 },
  eyebrow: { color: '#275d4a', fontWeight: '700', letterSpacing: 1.2 }, title: { color: '#18251f', fontSize: 32, fontWeight: '800' },
  copy: { color: '#4e5d55', fontSize: 16, lineHeight: 23, marginBottom: 10 }, label: { color: '#275d4a', fontWeight: '700', marginTop: 12 }, value: { color: '#18251f', fontFamily: 'monospace', fontSize: 12 },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 13, color: '#18251f', borderWidth: 1, borderColor: '#cddbd1' },
  grid: { gap: 10, marginTop: 6 }, button: { backgroundColor: '#275d4a', borderRadius: 12, padding: 15 }, buttonText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  statusBox: { backgroundColor: '#e4eee7', borderRadius: 12, padding: 14, gap: 4 }, status: { color: '#18251f', fontFamily: 'monospace', fontSize: 11 },
  logBox: { backgroundColor: '#18251f', borderRadius: 12, padding: 14, minHeight: 100 }, log: { color: '#d8eadf', fontFamily: 'monospace', fontSize: 11, marginBottom: 4 },
});
