import React, { useEffect } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ensureBgAfterOnboarding } from '../../components/PushInitializer';
import { useTheme } from '../../theme/ThemeProvider';

export default function LocationScreen() {
  const router = useRouter();
  const t = useTheme();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await ensureBgAfterOnboarding();
      } catch {}
      if (alive) router.replace('/(onboarding)/InterestsScreen');
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <ActivityIndicator color={t.colors.primary} />
        <Text style={{ color: t.colors.inkLow }}>Standortservice wird vorbereitet ...</Text>
      </View>
    </SafeAreaView>
  );
}