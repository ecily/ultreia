import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import Button from '../../components/ui/Button';

export default function WelcomeScreen() {
  const router = useRouter();
  const t = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Text style={[styles.kicker, { color: t.colors.primary }]}>StepsMatch</Text>
        <Text style={[styles.headline, { color: t.colors.inkHigh }]}>Finden. Nicht suchen.</Text>
        <Text style={[styles.subheadline, { color: t.colors.inkLow }]}>Erhalte relevante Angebote zur richtigen Zeit am richtigen Ort.</Text>
        <View style={{ width: '100%', marginTop: 20 }}>
          <Button title="Jetzt starten" size="lg" onPress={() => router.replace('/(onboarding)/LocationScreen')} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  kicker: { fontSize: 14, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  headline: { fontSize: 36, lineHeight: 42, fontWeight: '800', marginBottom: 10 },
  subheadline: { fontSize: 16, lineHeight: 23, maxWidth: 420 },
});