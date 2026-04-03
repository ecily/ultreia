import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import Button from '../../components/ui/Button';
import { persistAuthSession } from '../../utils/authSession';

const API_URL = 'https://api.ultreia.app/api';

const normalize = (value) => String(value || '').trim();

export default function VerifyEmailScreen() {
  const router = useRouter();
  const t = useTheme();
  const params = useLocalSearchParams();

  const initialEmail = useMemo(() => normalize(params?.email).toLowerCase(), [params?.email]);
  const initialCode = useMemo(() => normalize(params?.codePreview), [params?.codePreview]);
  const requestedNext = useMemo(() => normalize(params?.next), [params?.next]);

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(
    initialCode
      ? `Testcode verfuegbar: ${initialCode} (nur sichtbar, wenn Mailversand nicht konfiguriert ist).`
      : 'Wir haben dir einen 6-stelligen Verifizierungscode gesendet.'
  );

  const navigateAfterVerify = async () => {
    const hasOnboarded = await AsyncStorage.getItem('hasOnboarded');
    if (requestedNext === 'tabs' && hasOnboarded === '1') {
      router.replace('/(tabs)');
      return;
    }
    if (requestedNext === 'tabs' && hasOnboarded !== '1') {
      router.replace('/(onboarding)/WelcomeScreen');
      return;
    }
    router.replace('/(onboarding)/WelcomeScreen');
  };

  const handleVerify = async () => {
    setError('');
    setInfo('');
    const cleanEmail = normalize(email).toLowerCase();
    const cleanCode = normalize(code);

    if (!cleanEmail || !cleanCode) {
      setError('Bitte E-Mail und Verifizierungscode eingeben.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/users/verify-email`, {
        email: cleanEmail,
        code: cleanCode,
      });

      await persistAuthSession({ token: res?.data?.token, user: res?.data?.user });
      await navigateAfterVerify();
    } catch (err) {
      const payload = err?.response?.data || {};
      setError(payload?.message || 'Verifizierung fehlgeschlagen. Bitte pruefe den Code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    const cleanEmail = normalize(email).toLowerCase();
    if (!cleanEmail) {
      setError('Bitte zuerst deine E-Mail-Adresse eingeben.');
      return;
    }

    setResending(true);
    try {
      const res = await axios.post(`${API_URL}/users/resend-verification`, { email: cleanEmail });
      const nextCode = normalize(res?.data?.verificationCodePreview);
      if (nextCode) {
        setCode(nextCode);
        setInfo(`Neuer Testcode: ${nextCode}`);
      } else {
        setInfo(res?.data?.message || 'Ein neuer Code wurde gesendet.');
      }
    } catch (err) {
      const payload = err?.response?.data || {};
      setError(payload?.message || 'Code konnte nicht erneut gesendet werden.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.wrap}>
        <Text style={[styles.title, { color: t.colors.inkHigh }]}>E-Mail verifizieren</Text>
        <Text style={[styles.subtitle, { color: t.colors.inkLow }]}>Einmal bestaetigen, dann ist dein Konto voll nutzbar.</Text>

        <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.divider }]}>
          <TextInput
            placeholder="E-Mail"
            placeholderTextColor={t.colors.inkLow}
            style={[styles.input, { backgroundColor: t.colors.surface, borderColor: t.colors.divider, color: t.colors.inkHigh }]}
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />

          <TextInput
            placeholder="6-stelliger Code"
            placeholderTextColor={t.colors.inkLow}
            style={[styles.input, { backgroundColor: t.colors.surface, borderColor: t.colors.divider, color: t.colors.inkHigh }]}
            autoCapitalize="none"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
          />

          {info ? <Text style={[styles.info, { color: t.colors.inkLow }]}>{info}</Text> : null}
          {error ? <Text style={[styles.error, { color: t.colors.danger }]}>{error}</Text> : null}

          {loading ? <ActivityIndicator color={t.colors.primary} /> : <Button title="Jetzt bestaetigen" variant="primary" size="lg" onPress={handleVerify} />}

          {resending ? (
            <ActivityIndicator color={t.colors.primary} />
          ) : (
            <Button title="Code erneut senden" variant="secondary" size="lg" onPress={handleResend} />
          )}

          <TouchableOpacity onPress={() => router.replace('/(auth)/LoginScreen')}>
            <Text style={[styles.link, { color: t.colors.primary }]}>Zurueck zum Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wrap: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 30, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 21, marginBottom: 20 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
  },
  info: { fontSize: 13, lineHeight: 18 },
  error: { fontSize: 13 },
  link: { marginTop: 4, textAlign: 'center', fontWeight: '600' },
});

