import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../theme/ThemeProvider';
import Button from '../../components/ui/Button';

export default function DoneScreen() {
  const router = useRouter();
  const t = useTheme();

  const handleContinue = async () => {
    try {
      await AsyncStorage.setItem('hasOnboarded', '1');
    } catch {}
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={[styles.badge, { borderColor: t.colors.primary, backgroundColor: t.colors.primarySoft }]}>
          <Text style={[styles.badgeText, { color: t.colors.primary }]}>OK</Text>
        </View>

        <Text style={[styles.title, { color: t.colors.inkHigh }]}>Alles bereit.</Text>
        <Text style={[styles.subtitle, { color: t.colors.inkLow }]}>Du bekommst jetzt relevante Angebote mit kurzer Route direkt zum Ziel.</Text>

        <View style={{ width: '100%', marginTop: 18 }}>
          <Button title="Zur App" size="lg" onPress={handleContinue} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  badgeText: { fontSize: 28, fontWeight: '800' },
  title: { fontSize: 30, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 380 },
});