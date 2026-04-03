import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import Button from '../../components/ui/Button';
import { persistAuthSession, persistVerifiedUser } from '../../utils/authSession';

const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';

const normalize = (value) => String(value || '').trim();

export default function RegisterScreen() {
  const router = useRouter();
  const t = useTheme();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const routeToVerification = async (payload, fallbackEmail) => {
    const safeEmail = normalize(payload?.email || fallbackEmail);
    if (payload?.user) {
      try {
        await persistVerifiedUser(payload.user);
      } catch {}
    }

    router.replace({
      pathname: '/(auth)/VerifyEmailScreen',
      params: {
        email: safeEmail,
        codePreview: payload?.verificationCodePreview ? String(payload.verificationCodePreview) : '',
        next: 'onboarding',
      },
    });
  };

  const handleRegister = async () => {
    setError('');

    const cleanFirstName = normalize(firstName);
    const cleanLastName = normalize(lastName);
    const cleanUsername = normalize(username);
    const cleanEmail = normalize(email).toLowerCase();

    if (!cleanEmail || !password || !password2) {
      setError('Bitte E-Mail und Passwort vollstaendig eingeben.');
      return;
    }

    const hasNamePair = Boolean(cleanFirstName && cleanLastName);
    if (!hasNamePair && !cleanUsername) {
      setError('Bitte Vorname + Nachname oder alternativ einen Username angeben.');
      return;
    }

    if (password !== password2) {
      setError('Die Passwoerter stimmen nicht ueberein.');
      return;
    }

    if (String(password).length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }

    setLoading(true);
    try {
      const computedName = hasNamePair
        ? `${cleanFirstName} ${cleanLastName}`.trim()
        : cleanUsername;

      const res = await axios.post(`${API_URL}/users/register`, {
        firstName: cleanFirstName,
        lastName: cleanLastName,
        username: cleanUsername,
        name: computedName,
        email: cleanEmail,
        password,
      });

      if (res?.data?.verificationRequired) {
        await routeToVerification(res.data, cleanEmail);
        return;
      }

      if (res?.data?.token && res?.data?.user) {
        await persistAuthSession({ token: res.data.token, user: res.data.user });
        router.replace('/(onboarding)/WelcomeScreen');
        return;
      }

      setError('Registrierung abgeschlossen, bitte pruefe die E-Mail-Verifizierung.');
    } catch (err) {
      const payload = err?.response?.data || {};
      if (payload?.verificationRequired) {
        await routeToVerification(payload, cleanEmail);
        return;
      }

      setError(payload?.message || 'Registrierung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.wrap}>
        <Text style={[styles.title, { color: t.colors.inkHigh }]}>Konto erstellen</Text>
        <Text style={[styles.subtitle, { color: t.colors.inkLow }]}>Mit Profil und bestaetigter E-Mail bist du in weniger als einer Minute startklar.</Text>

        <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.divider }]}>
          <TextInput
            placeholder="Vorname (optional mit Username)"
            placeholderTextColor={t.colors.inkLow}
            style={[styles.input, { backgroundColor: t.colors.surface, borderColor: t.colors.divider, color: t.colors.inkHigh }]}
            value={firstName}
            onChangeText={setFirstName}
          />
          <TextInput
            placeholder="Nachname (optional mit Username)"
            placeholderTextColor={t.colors.inkLow}
            style={[styles.input, { backgroundColor: t.colors.surface, borderColor: t.colors.divider, color: t.colors.inkHigh }]}
            value={lastName}
            onChangeText={setLastName}
          />
          <TextInput
            placeholder="oder Username"
            placeholderTextColor={t.colors.inkLow}
            style={[styles.input, { backgroundColor: t.colors.surface, borderColor: t.colors.divider, color: t.colors.inkHigh }]}
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
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
            placeholder="Passwort (mind. 8 Zeichen)"
            placeholderTextColor={t.colors.inkLow}
            style={[styles.input, { backgroundColor: t.colors.surface, borderColor: t.colors.divider, color: t.colors.inkHigh }]}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            placeholder="Passwort wiederholen"
            placeholderTextColor={t.colors.inkLow}
            style={[styles.input, { backgroundColor: t.colors.surface, borderColor: t.colors.divider, color: t.colors.inkHigh }]}
            secureTextEntry
            value={password2}
            onChangeText={setPassword2}
          />

          {error ? <Text style={[styles.error, { color: t.colors.danger }]}>{error}</Text> : null}

          {loading ? <ActivityIndicator color={t.colors.primary} /> : <Button title="Registrieren" variant="primary" size="lg" onPress={handleRegister} />}

          <TouchableOpacity onPress={() => router.replace('/(auth)/LoginScreen')}>
            <Text style={[styles.link, { color: t.colors.primary }]}>Bereits ein Konto? Jetzt anmelden</Text>
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
  error: { fontSize: 13 },
  link: { marginTop: 8, textAlign: 'center', fontWeight: '600' },
});
