import { useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { API_BASE, APP_VERSION, EXPO_PROJECT_ID, ULTREIA_MODE } from '../lib/config';
import { bindDeviceToUser, getDeviceId, registerDevice } from '../lib/device';
import { configureNotificationChannels, registerPushToken, requestNotificationPermission, showLocalTechnicalNotification } from '../lib/notifications';
import { getBackgroundLocationTaskStatus, getCurrentLocation, getGeofenceStatus, getLocationPermissions, registerTechnicalGeofence, sendHeartbeat, startBackgroundLocation } from '../lib/location';
import { getJson, postJson, putJson } from '../lib/api';
import { listenForMagicLinks, loadCurrentUser, logout, openVerificationUrl, readDevVerificationUrl, requestMagicLink } from '../lib/auth';
import { getSession } from '../lib/session';
import { AUTH_TEXT } from '../lib/i18n';

const PILGRIM_TEXT = {
  de: { test: 'TESTDATEN – NICHT PRODUKTIV', title: 'Dein Camino', copy: 'Wähle einen Bedarf und prüfe passende Angebote an deinem aktuellen Standort.', start: 'Test-Trip starten', pause: 'Trip pausieren', resume: 'Trip fortsetzen', refresh: 'Matches aktualisieren', status: 'Trip', needs: 'Meine Bedürfnisse', needsCopy: 'Aktiviere nur, was du gerade brauchst.', active: 'aktiv', activate: 'aktivieren', saved: 'Need gespeichert', match: 'Passendes Angebot', best: 'Bester Match', more: 'Weitere passende Angebote', location: 'Standort wird benötigt, damit Ultreia passende Angebote erkennen kann.', noNeeds: 'Aktiviere einen Need, um Matches zu sehen.', updated: 'Matches aktualisiert', technical: 'Technikdetails', open: 'geöffnet' },
  en: { test: 'TEST DATA – NOT PRODUCTION', title: 'Your Camino', copy: 'Choose a need and check relevant offers at your current location.', start: 'Start test trip', pause: 'Pause trip', resume: 'Resume trip', refresh: 'Refresh matches', status: 'Trip', needs: 'My needs', needsCopy: 'Activate only what you need right now.', active: 'active', activate: 'activate', saved: 'Need saved', match: 'Matching offer', best: 'Best match', more: 'More matching offers', location: 'Location is required so Ultreia can find relevant offers.', noNeeds: 'Activate a need to see matches.', updated: 'Matches refreshed', technical: 'Technical details', open: 'open' },
  es: { test: 'DATOS DE PRUEBA – NO PRODUCTIVO', title: 'Tu Camino', copy: 'Elige una necesidad y consulta ofertas relevantes en tu ubicación actual.', start: 'Iniciar viaje de prueba', pause: 'Pausar viaje', resume: 'Continuar viaje', refresh: 'Actualizar coincidencias', status: 'Viaje', needs: 'Mis necesidades', needsCopy: 'Activa solo lo que necesitas ahora.', active: 'activa', activate: 'activar', saved: 'Necesidad guardada', match: 'Oferta coincidente', best: 'Mejor coincidencia', more: 'Más ofertas coincidentes', location: 'Se necesita la ubicación para encontrar ofertas relevantes.', noNeeds: 'Activa una necesidad para ver coincidencias.', updated: 'Coincidencias actualizadas', technical: 'Detalles técnicos', open: 'abierto' },
};
const pt = (locale, key) => (PILGRIM_TEXT[locale] || PILGRIM_TEXT.en)[key];

export default function HomeScreen() {
  const [locale, setLocale] = useState('de');
  const [deviceId, setDeviceId] = useState('wird geladen …');
  const [location, setLocation] = useState(null);
  const [logs, setLogs] = useState([]);
  const [authStatus, setAuthStatus] = useState(AUTH_TEXT.signedOut);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [trip, setTrip] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [matches, setMatches] = useState([]);
  const [pilgrimMessage, setPilgrimMessage] = useState('');
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

  useEffect(() => { getJson(`/needs?locale=${locale}`).then((result) => setCatalog(result.items || [])).catch(() => {}); }, [locale]);
  useEffect(() => { if (authStatus !== AUTH_TEXT.signedOut) loadPilgrim().catch(() => {}); }, [authStatus]);

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

  const loadPilgrim = async () => { const result = await getJson('/pilgrim/needs'); setTrip(result.trip); setNeeds(result.items || []); return result; };
  const startTrip = async () => { const result = await postJson('/trips', { routeContext: ULTREIA_MODE === 'production' ? 'camino_frances' : 'local_test' }); setTrip(result.trip); return result; };
  const tripAction = async (action) => { const result = await postJson(`/trips/${trip.id}/${action}`, {}); setTrip(result.trip); return result; };
  const setNeed = async (key, active, urgency) => { const result = await putJson(`/pilgrim/needs/${encodeURIComponent(key)}`, { active, urgency }); await loadPilgrim(); setPilgrimMessage(pt(locale, 'saved')); return result; };
  const refreshMatches = async () => { await sendHeartbeat(); const result = await postJson('/pilgrim/matches/current', {}); setMatches(result.matches || []); setPilgrimMessage(result.status === 'location_required' ? pt(locale, 'location') : result.status === 'needs_required' ? pt(locale, 'noNeeds') : pt(locale, 'updated')); return result; };

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
        <View style={styles.pilgrimHeader}><Text style={styles.eyebrow}>ULTREIA · PILGRIM</Text><View style={styles.localeRow}>{['de', 'en', 'es'].map((value) => <Pressable key={value} onPress={() => setLocale(value)} style={[styles.localeButton, locale === value && styles.localeButtonActive]}><Text>{value.toUpperCase()}</Text></Pressable>)}</View></View>
        {ULTREIA_MODE !== 'production' && <Text style={styles.testBanner}>{pt(locale, 'test')}</Text>}
        <Text style={styles.pilgrimTitle}>{pt(locale, 'title')}</Text><Text style={styles.copy}>{pt(locale, 'copy')}</Text>
        {!trip ? <Action label={pt(locale, 'start')} onPress={() => run('Trip', startTrip)} /> : <View style={styles.tripBox}><Text style={styles.label}>{pt(locale, 'status')}: {trip.status}</Text><View style={styles.grid}><Action label={trip.status === 'paused' ? pt(locale, 'resume') : pt(locale, 'pause')} onPress={() => run('Trip', () => tripAction(trip.status === 'paused' ? 'resume' : 'pause'))} /><Action label={pt(locale, 'refresh')} onPress={() => run('Matches', refreshMatches)} /></View></View>}
        {trip && <View style={styles.needBox}><Text style={styles.label}>{pt(locale, 'needs')}</Text><Text style={styles.copy}>{pt(locale, 'needsCopy')}</Text>{catalog.map((item) => { const current = needs.find((need) => need.needKey === item.key); const active = current?.active === true; return <Pressable key={item.key} onPress={() => setNeed(item.key, !active, active ? current.urgency : 'today')} style={[styles.needRow, active && styles.needRowActive]}><Text style={styles.needLabel}>{item.label}</Text><Text style={styles.needState}>{active ? `${pt(locale, 'active')} · ${current.urgency}` : pt(locale, 'activate')}</Text></Pressable>; })}</View>}
        {pilgrimMessage ? <Text style={styles.feedback}>{pilgrimMessage}</Text> : null}
        {matches.length > 0 && <View style={styles.matchBox}><Text style={styles.label}>{pt(locale, 'match')}</Text>{matches.slice(0, 3).map((match, index) => <View key={match.offer.id} style={styles.matchCard}><Text style={styles.matchRank}>{index === 0 ? pt(locale, 'best') : pt(locale, 'more')}</Text>{match.offer.images?.[0]?.secureUrl && <Text style={styles.value}>Photo available</Text>}<Text style={styles.matchTitle}>{match.offer.title}</Text><Text style={styles.value}>{match.provider.name || 'Provider'} · {match.matchingNeed.needKey} · {match.urgency}</Text><Text style={styles.value}>{match.distanceMeters} m · {pt(locale, 'open')} · {match.offer.price?.type || ''}</Text>{ULTREIA_MODE !== 'production' && <Text style={styles.diagnostic}>{pt(locale, 'technical')}: {match.reason.distanceMeters} m / {match.reason.offerRadiusMeters} m</Text>}</View>)}</View>}
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
  pilgrimHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, localeRow: { flexDirection: 'row', gap: 4 }, localeButton: { backgroundColor: '#fff', padding: 6, borderRadius: 6 }, localeButtonActive: { backgroundColor: '#b9d7c4' }, testBanner: { backgroundColor: '#ffe5a8', color: '#5a3d00', padding: 10, borderRadius: 8, fontWeight: '700' }, pilgrimTitle: { color: '#18251f', fontSize: 28, fontWeight: '800' }, tripBox: { backgroundColor: '#e4eee7', borderRadius: 12, padding: 12 }, needBox: { backgroundColor: '#fff', borderRadius: 12, padding: 12, gap: 6 }, needRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 13, borderRadius: 9, borderWidth: 1, borderColor: '#dbe7df', minHeight: 48 }, needRowActive: { backgroundColor: '#e4eee7', borderColor: '#275d4a' }, needLabel: { color: '#18251f', fontWeight: '600', flex: 1 }, needState: { color: '#275d4a', fontSize: 12 }, feedback: { color: '#275d4a', fontWeight: '700' }, matchBox: { gap: 8 }, matchCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 5 }, matchRank: { color: '#275d4a', fontWeight: '700' }, matchTitle: { color: '#18251f', fontSize: 18, fontWeight: '800' }, diagnostic: { color: '#617184', fontFamily: 'monospace', fontSize: 11 },
  screen: { flex: 1, backgroundColor: '#f5f1e8' }, content: { padding: 24, paddingTop: 64, gap: 10 },
  eyebrow: { color: '#275d4a', fontWeight: '700', letterSpacing: 1.2 }, title: { color: '#18251f', fontSize: 32, fontWeight: '800' },
  copy: { color: '#4e5d55', fontSize: 16, lineHeight: 23, marginBottom: 10 }, label: { color: '#275d4a', fontWeight: '700', marginTop: 12 }, value: { color: '#18251f', fontFamily: 'monospace', fontSize: 12 },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 13, color: '#18251f', borderWidth: 1, borderColor: '#cddbd1' },
  grid: { gap: 10, marginTop: 6 }, button: { backgroundColor: '#275d4a', borderRadius: 12, padding: 15 }, buttonText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  statusBox: { backgroundColor: '#e4eee7', borderRadius: 12, padding: 14, gap: 4 }, status: { color: '#18251f', fontFamily: 'monospace', fontSize: 11 },
  logBox: { backgroundColor: '#18251f', borderRadius: 12, padding: 14, minHeight: 100 }, log: { color: '#d8eadf', fontFamily: 'monospace', fontSize: 11, marginBottom: 4 },
});
