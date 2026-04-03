import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../theme/ThemeProvider';
import Button from '../../components/ui/Button';
import { stopBackgroundServices, syncRemoteServiceState } from '../../components/PushInitializer';
import { isStoppedUntilRestartNow, setServiceEnabled, setStopUntilRestart } from '../../components/push/service-control';

const PRIVACY_OPTIN_KEY = 'privacy.push.optin.v1';

export default function ProfileScreen() {
  const router = useRouter();
  const t = useTheme();
  const [privacyOptIn, setPrivacyOptIn] = useState(null);
  const [hardStopped, setHardStopped] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  const loadPrivacy = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(PRIVACY_OPTIN_KEY);
      if (raw == null) {
        setPrivacyOptIn(null);
        return;
      }
      setPrivacyOptIn(raw === '1');
    } catch {
      setPrivacyOptIn(null);
    }
  }, []);

  useEffect(() => {
    loadPrivacy();
  }, [loadPrivacy]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('userProfile');
        if (!alive || !raw) return;
        const parsed = JSON.parse(raw);
        setUserProfile(parsed && typeof parsed === 'object' ? parsed : null);
      } catch {
        if (alive) setUserProfile(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const refreshHardStopState = useCallback(async () => {
    try {
      setHardStopped(await isStoppedUntilRestartNow());
    } catch {
      setHardStopped(false);
    }
  }, []);

  useEffect(() => {
    refreshHardStopState();
  }, [refreshHardStopState]);

  const setPrivacy = useCallback(async (next) => {
    try {
      await AsyncStorage.setItem(PRIVACY_OPTIN_KEY, next ? '1' : '0');
      setPrivacyOptIn(!!next);
    } catch {}
  }, []);

  const hardStopUntilAppRestart = useCallback(async (reason = 'manual-stop') => {
    try { await setStopUntilRestart(true); } catch {}
    try { await syncRemoteServiceState(false, reason); } catch {}
    try { await stopBackgroundServices(reason); } catch {}
    setHardStopped(true);
  }, []);

  const handleStopUntilRestart = useCallback(() => {
    Alert.alert(
      'Hintergrunddienst stoppen',
      'Der Hintergrunddienst wird jetzt beendet und bleibt aus, bis du die App neu startest.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Jetzt stoppen',
          style: 'destructive',
          onPress: async () => {
            await hardStopUntilAppRestart('profile-stop-until-restart');
          },
        },
      ]
    );
  }, [hardStopUntilAppRestart]);

  const handleLogout = async () => {
    Alert.alert('Abmelden', 'Willst du dich wirklich abmelden und lokale App-Daten loeschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await hardStopUntilAppRestart('logout');
            await setServiceEnabled(false, 'logout');
          } catch {}
          await AsyncStorage.clear();
          await setStopUntilRestart(true);
          router.replace('/(auth)/LoginScreen');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.colors.background }]} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.hero, { backgroundColor: '#174ea6' }]}>
          <Text style={styles.heroTitle}>Dein Bereich, deine Kontrolle</Text>
          <Text style={styles.heroSub}>Passe Interessen, Push und Hintergrunddienst jederzeit auf deinen Alltag an.</Text>
          <Text style={styles.profileMeta}>
            {(userProfile?.firstName && userProfile?.lastName)
              ? `${userProfile.firstName} ${userProfile.lastName}`
              : (userProfile?.username || userProfile?.name || 'Nutzerprofil')}
            {userProfile?.email ? ` • ${userProfile.email}` : ''}
          </Text>
          <Text style={styles.profileMeta}>
            E-Mail: {userProfile?.emailVerified ? 'verifiziert' : 'noch nicht verifiziert'}
          </Text>
          <View style={styles.heroPills}>
            <View style={[styles.heroPill, { backgroundColor: hardStopped ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)' }]}>
              <Text style={styles.heroPillText}>{hardStopped ? 'Dienst gestoppt' : 'Dienst aktiv beim naechsten Start'}</Text>
            </View>
            <View style={[styles.heroPill, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={styles.heroPillText}>
                {privacyOptIn === null ? 'Push offen' : (privacyOptIn ? 'Push ein' : 'Push pausiert')}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: t.colors.card, borderColor: t.colors.divider }]}> 
          <Text style={[styles.sectionTitle, { color: t.colors.inkHigh }]}>Entdecker-Profil</Text>
          <Text style={[styles.hint, { color: t.colors.inkLow }]}>Je besser deine Interessen, desto passender werden Angebote, Wege und Timing.</Text>
          <Button title="Interessen aktualisieren" variant="primary" size="lg" onPress={() => router.push('/(onboarding)/InterestsScreen')} />
        </View>

        <View style={[styles.section, { backgroundColor: t.colors.card, borderColor: t.colors.divider }]}> 
          <Text style={[styles.sectionTitle, { color: t.colors.inkHigh }]}>Datenschutz & Push</Text>
          <Text style={[styles.hint, { color: t.colors.inkLow }]}>Du entscheidest, wie oft wir dich auf passende Angebote in deiner Naehe hinweisen.</Text>
          <Text style={[styles.state, { color: privacyOptIn === false ? t.colors.warning : t.colors.success }]}>Status: {privacyOptIn === null ? 'Noch nicht festgelegt' : (privacyOptIn ? 'Einwilligung aktiv' : 'Einwilligung pausiert')}</Text>
          <View style={styles.row}>
            <Button title="Einwilligen" variant="primary" size="sm" onPress={() => setPrivacy(true)} />
            <Button title="Ablehnen" variant="secondary" size="sm" onPress={() => setPrivacy(false)} />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: t.colors.card, borderColor: t.colors.divider }]}> 
          <Text style={[styles.sectionTitle, { color: t.colors.inkHigh }]}>Hintergrunddienst</Text>
          <Text style={[styles.hint, { color: t.colors.inkLow }]}>
            {hardStopped ? 'Der Dienst bleibt bis zum naechsten App-Start aus.' : 'Der Dienst meldet deinen Standort akkuschonend fuer passende Live-Angebote.'}
          </Text>
          <Button
            title={hardStopped ? 'Hintergrunddienst bereits gestoppt' : 'Hintergrunddienst stoppen'}
            variant="secondary"
            size="lg"
            onPress={handleStopUntilRestart}
            disabled={hardStopped}
          />
        </View>

        <View style={[styles.section, { backgroundColor: t.colors.card, borderColor: t.colors.divider }]}> 
          <Text style={[styles.sectionTitle, { color: t.colors.inkHigh }]}>Konto</Text>
          <Text style={[styles.hint, { color: t.colors.inkLow }]}>Wenn du neu starten willst, loeschen wir lokale Daten sauber und sicher.</Text>
          <Button title="Logout & App zuruecksetzen" variant="secondary" size="lg" onPress={handleLogout} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 26, gap: 12 },
  hero: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 2,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  heroSub: { color: 'rgba(255,255,255,0.92)', fontSize: 13, lineHeight: 18, marginTop: 6 },
  profileMeta: { color: 'rgba(255,255,255,0.88)', fontSize: 12, marginTop: 5 },
  heroPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  heroPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  heroPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  section: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  hint: { fontSize: 12, lineHeight: 18 },
  state: { fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
