import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { API_BASE } from '../lib/config';
import { getDeviceId, registerDevice } from '../lib/device';
import { configureNotificationChannels, registerPushToken, showLocalTechnicalNotification } from '../lib/notifications';
import { getCurrentLocation, registerTechnicalGeofence, sendHeartbeat, startBackgroundLocation } from '../lib/location';

export default function HomeScreen() {
  const [deviceId, setDeviceId] = useState('wird geladen …');
  const [location, setLocation] = useState(null);
  const [logs, setLogs] = useState([]);

  const log = (message) => setLogs((current) => [`${new Date().toLocaleTimeString()}  ${message}`, ...current].slice(0, 30));
  const run = async (label, action) => {
    try { await action(); log(`${label}: OK`); } catch (error) { log(`${label}: FEHLER – ${error.message}`); }
  };

  useEffect(() => {
    configureNotificationChannels().catch((error) => log(`Channels: ${error.message}`));
    getDeviceId().then(setDeviceId).catch((error) => log(`Device-ID: ${error.message}`));
  }, []);

  const locate = async () => {
    const current = await getCurrentLocation();
    setLocation(current.coords);
    return current;
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>ULTREIA · TECHNICAL FOUNDATION</Text>
        <Text style={styles.title}>Android proof screen</Text>
        <Text style={styles.copy}>Diese bewusst neutrale Oberfläche verifiziert Device-ID, Permissions, Location, Heartbeat, Push, lokale Notifications und Geofence.</Text>
        <Text style={styles.label}>API</Text><Text style={styles.value}>{API_BASE}</Text>
        <Text style={styles.label}>Device-ID</Text><Text style={styles.value}>{deviceId}</Text>
        {location && <Text style={styles.value}>Standort: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)} · ±{Math.round(location.accuracy || 0)} m</Text>}
        <View style={styles.grid}>
          <Action label="Backend-Gerät registrieren" onPress={() => run('Gerät registrieren', registerDevice)} />
          <Action label="Location-Permissions" onPress={() => run('Location-Permissions', async () => { const result = await (await import('../lib/location')).requestLocationPermissions(); log(`${result.foreground.status}/${result.background.status}`); })} />
          <Action label="Standort erfassen" onPress={() => run('Standort', locate)} />
          <Action label="Heartbeat senden" onPress={() => run('Heartbeat', () => sendHeartbeat())} />
          <Action label="Background Location starten" onPress={() => run('Background Location', startBackgroundLocation)} />
          <Action label="Push-Token registrieren" onPress={() => run('Push-Token', registerPushToken)} />
          <Action label="Lokale Notification" onPress={() => run('Lokale Notification', showLocalTechnicalNotification)} />
          <Action label="Geofence registrieren" onPress={() => run('Geofence', registerTechnicalGeofence)} />
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
  grid: { gap: 10, marginTop: 6 }, button: { backgroundColor: '#275d4a', borderRadius: 12, padding: 15 }, buttonText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  logBox: { backgroundColor: '#18251f', borderRadius: 12, padding: 14, minHeight: 100 }, log: { color: '#d8eadf', fontFamily: 'monospace', fontSize: 11, marginBottom: 4 },
});
