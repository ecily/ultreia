import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import Button from '../../components/ui/Button';

const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';

export default function InterestsScreen() {
  const router = useRouter();
  const t = useTheme();
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [res, stored] = await Promise.all([
          axios.get(`${API_URL}/categories`),
          AsyncStorage.getItem('userInterests'),
        ]);
        if (!mounted) return;
        setCategories(Array.isArray(res.data) ? res.data : []);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) setSelected(parsed);
          } catch {}
        }
      } catch {
        if (!mounted) return;
        setCategories([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const allSubcats = useMemo(() => categories.flatMap((c) => (Array.isArray(c.subcategories) ? c.subcategories : [])), [categories]);

  const toggleInterest = (interest) => {
    setSelected((curr) => (curr.includes(interest) ? curr.filter((x) => x !== interest) : [...new Set([...curr, interest])]));
  };

  const handleSave = async () => {
    const csv = (selected || []).map((s) => String(s || '').trim()).filter(Boolean).join(',');
    await AsyncStorage.multiSet([
      ['userInterests', JSON.stringify(selected)],
      ['userInterests.csv', csv],
      ['hasOnboarded', '1'],
    ]);
    router.replace('/(onboarding)/DoneScreen');
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.colors.background }]}>
        <ActivityIndicator color={t.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Text style={[styles.headline, { color: t.colors.inkHigh }]}>Was interessiert dich?</Text>
        <Text style={[styles.sub, { color: t.colors.inkLow }]}>Damit wir nur relevante Angebote senden, waehle deine Themen.</Text>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {categories.map((cat, idx) => (
            <View key={cat._id || `${cat.name}-${idx}`} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: t.colors.inkHigh }]}>{cat.name}</Text>
              <View style={styles.row}>
                {(cat.subcategories || []).map((subcat) => {
                  const active = selected.includes(subcat);
                  return (
                    <TouchableOpacity
                      key={subcat}
                      onPress={() => toggleInterest(subcat)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? t.colors.primary : t.colors.surface,
                          borderColor: active ? t.colors.primary : t.colors.divider,
                        },
                      ]}
                    >
                      <Text style={{ color: active ? '#fff' : t.colors.ink, fontWeight: '600' }}>{subcat}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <Button title="Auswahl speichern" size="lg" onPress={handleSave} disabled={selected.length === 0 && allSubcats.length > 0} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  headline: { fontSize: 28, fontWeight: '800' },
  sub: { fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 14 },
  scrollContent: { paddingBottom: 20 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  footer: { paddingVertical: 12 },
});
