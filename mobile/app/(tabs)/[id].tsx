import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Animated,
  Easing,
  ScrollView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';

// ✅ relative Pfade angepasst (2 Ebenen hoch, nicht 3)
import OfferDistanceBadge from '../../components/DistanceBadge';
import { isOfferActiveNow } from '../../utils/isOfferActiveNow';
import colors from '../../theme/colors';

const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.ultreia.app/api').replace(/\/$/, '');
const SCREEN_W = Dimensions.get('window').width;

/* ───────── Geo / Utils ───────── */
const toRad = (d: number) => (d * Math.PI) / 180;
function haversineM(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const aa = s1 * s1 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * s2 * s2;
  return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}
function pickOfferLocation(offer: any) {
  const coords = offer?.location?.coordinates || offer?.provider?.location?.coordinates || null;
  if (Array.isArray(coords) && coords.length >= 2) {
    const [lng, lat] = coords;
    const latN = Number(lat), lngN = Number(lng);
    if (Number.isFinite(latN) && Number.isFinite(lngN)) return { latitude: latN, longitude: lngN };
  }
  return null;
}
function getRemainingMs(offer: any) {
  const keys = ['activeUntil','activeEnd','validUntil','endAt','validTo','dateTo','activeWindowEnd','endTime'];
  const vd = offer?.validDates;
  if (vd && typeof vd === 'object') {
    const toRaw = vd.to ?? vd.end ?? vd.toDate ?? vd.endDate;
    if (toRaw) {
      const d = new Date(toRaw);
      if (!isNaN(d as any)) {
        const diff = d.getTime() - Date.now();
        if (diff > 0) return diff;
      }
    }
  }
  for (const k of keys) {
    const v = offer?.[k as any]; if (!v) continue;
    const d = new Date(v);
    if (!isNaN(d as any)) {
      const diff = d.getTime() - Date.now();
      if (diff > 0) return diff;
    }
  }
  return null;
}
function formatRemaining(diffMs: number | null) {
  if (diffMs == null) return '—';
  const totalMin = Math.ceil(diffMs / 60000);
  if (totalMin <= 0) return '—';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}\u00A0min`;
  if (m === 0) return `${h}\u00A0h`;
  return `${h}\u00A0h ${m}\u00A0min`;
}
function formatRelative(dateLike: any) {
  if (!dateLike) return '—';
  const ts = new Date(dateLike).getTime();
  if (Number.isNaN(ts)) return '—';
  const diff = Date.now() - ts;
  if (diff < 0) return 'gerade eben';
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m} Min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h} h`;
  const d = Math.floor(h / 24);
  return `vor ${d} d`;
}

/* ───────── Screen ───────── */
export default function OfferDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t: any = useTheme?.() || {};
  const pal = (t && t.colors) ? t.colors : colors;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offer, setOffer] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');

  const userPosRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') throw new Error('Standortberechtigung verweigert');
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Platform.OS === 'android' ? Location.Accuracy.Balanced : Location.Accuracy.High,
        });
        userPosRef.current = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };

        const res = await fetch(`${API_BASE_URL}/offers/${encodeURIComponent(id)}?withProvider=1`);
        if (!res.ok) throw new Error(`GET /offers/:id failed ${res.status}`);
        const obj = await res.json();
        const off = obj?.offer || obj?.data || obj;
        setOffer(off);

        if (off?.provider && typeof off.provider === 'object') setProvider(off.provider);
        else if (off?.provider) {
          try {
            const rp = await fetch(`${API_BASE_URL}/providers/${encodeURIComponent(off.provider)}`);
            if (rp.ok) setProvider(await rp.json());
          } catch {}
        }
      } catch (e: any) {
        setError(e?.message || 'Fehler beim Laden');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const loc = useMemo(() => (offer ? pickOfferLocation(offer) : null), [offer]);
    const distanceM = useMemo(() => {
    if (!offer || !loc || !userPosRef.current) return null as number | null;
    return haversineM(userPosRef.current, loc);
  }, [offer, loc]);
  const remainingMs = offer ? getRemainingMs(offer) : null;
    const activeNow = offer ? isOfferActiveNow(offer, 'Europe/Vienna') : false;

  // WOW: sanfter Headline-Fade/Slide
  const titleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!loading) {
      Animated.timing(titleAnim, { toValue: 1, duration: 380, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    }
  }, [loading, titleAnim]);

  // Bilder
  const images: string[] = useMemo(() => {
    if (!offer) return [];
    return Array.isArray(offer.images) ? offer.images.filter(Boolean) : [];
  }, [offer]);
  const heroRef = useRef<FlatList<string> | null>(null);
  const heroHeight = 220;

  const handleStartRoute = () => {
    if (!offer) return;
    router.push({ pathname: '/(tabs)/NavigationScreen', params: { id: offer._id } });
  };
  const handleBack = () => {
    try {
      if (router.canGoBack?.()) { router.back(); return; }
    } catch {}
    router.replace('/');
  };

  useEffect(() => {
    if (!mapRef.current) return;
    const center = userPosRef.current || loc;
    if (!center) return;
    try {
      (mapRef.current as any).animateCamera(
        { center, zoom: 17.2, pitch: 0 },
        { duration: 320 }
      );
    } catch {}
  }, [loc]);

  if (loading) {
    return (
      <View style={[styles.safeLike, { backgroundColor: pal.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={pal.primary || colors.primary} />
          <Text style={[styles.muted, { color: pal.inkLow || '#777' }]}>Lade…</Text>
        </View>
      </View>
    );
  }
  if (error || !offer) {
    return (
      <View style={[styles.safeLike, { backgroundColor: pal.background }]}>
        <View style={styles.center}>
          <Text style={styles.error}>Fehler: {error || 'Unbekannt'}</Text>
          <TouchableOpacity style={[styles.btn, { backgroundColor: pal.primary || colors.primary }]} onPress={handleBack}>
            <Text style={styles.btnText}>Zurück</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.safeLike, { backgroundColor: pal.background }]}>
      {/* Badges oben (einheitlich) */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <View style={[styles.badgesRow, { marginBottom: 8 }]}>
          <Text style={[styles.badgeUniform, activeNow ? styles.badgeOk : styles.badgeWarn]}>
            <Text style={styles.badgeText}>{activeNow ? 'Jetzt gültig' : 'Nicht aktiv'}</Text>
          </Text>
          <Text style={[styles.badgeUniform, styles.badgeOrange]}>
            <Text style={styles.badgeText}>Rest: {formatRemaining(remainingMs)}</Text>
          </Text>
          {!!offer?.category && (
            <Text style={[styles.badgeUniform, styles.badgeNeutral]}>
              <Text style={styles.badgeText}>{offer.category}</Text>
            </Text>
          )}
          {!!offer?.subcategory && (
            <Text style={[styles.badgeUniform, styles.badgeNeutral]}>
              <Text style={styles.badgeText}>{offer.subcategory}</Text>
            </Text>
          )}
          {Number.isFinite(distanceM as number) && (
            <View style={[styles.badgeUniform, styles.badgeBlue, { paddingVertical: 0, paddingHorizontal: 0 }]}>
              <OfferDistanceBadge distanceM={distanceM as number} compact />
            </View>
          )}
        </View>
      </View>

      {/* Titel + Description */}
      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <Animated.Text
          style={[
            styles.titleXL,
            {
              color: pal.ink || '#1f2937',
              opacity: titleAnim,
              transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
            },
          ]}
          numberOfLines={2}
        >
          {offer.name}
        </Animated.Text>
        {!!offer.description && (
          <Text style={[styles.cardBody, { color: pal.inkMid || '#4b5563', marginTop: 6 }]}>
            {offer.description}
          </Text>
        )}
        {!!offer.updatedAt && <Text style={[styles.metaSmall, { color: pal.inkLow || '#6b7280' }]}>Letztes Update: {formatRelative(offer.updatedAt)}</Text>}
      </View>

      {/* Bilder – wischbar nebeneinander */}
      <View style={[styles.card, styles.heroCard, { height: heroHeight, backgroundColor: pal.card || '#fff' }]}>
        {images.length ? (
          <FlatList
            ref={heroRef as any}
            data={images}
            horizontal
            pagingEnabled
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(uri, i) => `${offer._id}-img-${i}`}
            renderItem={({ item: uri }) => {
              const fade = new Animated.Value(0);
              const onLoad = () => Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
              return (
                <Animated.Image
                  source={{ uri }}
                  style={{ width: SCREEN_W - 24, height: heroHeight - 24, borderRadius: 12, opacity: fade }}
                  onLoad={onLoad}
                  resizeMode="cover"
                />
              );
            }}
            style={{ height: heroHeight - 24 }}
            contentContainerStyle={{ alignItems: 'center' }}
            getItemLayout={(_, index) => ({ length: SCREEN_W - 24, offset: (SCREEN_W - 24) * index, index })}
          />
        ) : (
          <View style={[styles.heroPlaceholder, { flex: 1, borderRadius: 12 }]}>
            <Text style={styles.heroPlaceholderText}>Keine Bilder</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Provider statt Lat/Lng */}
        <View style={[styles.infoCard, { backgroundColor: pal.card || '#fff' }]}>
          <Text style={[styles.cardTitleBig, { color: pal.ink || '#1f2937' }]}>
            {provider?.name || offer?.provider?.name || 'Anbieter'}
          </Text>
          {!!(provider?.address || offer?.provider?.address) && (
            <Text style={[styles.cardBody, { color: pal.inkMid || '#4b5563' }]}>
              {provider?.address || offer?.provider?.address}
            </Text>
          )}
        </View>

        {/* Karte ohne Lat/Lng-Textbox */}
        <View style={[styles.card, { padding: 12, backgroundColor: pal.card || '#fff' }]}>
          <View style={{ height: 220, borderRadius: 12, overflow: 'hidden' }}>
            <MapView
              ref={mapRef as any}
              style={{ flex: 1 }}
              provider={PROVIDER_GOOGLE}
              mapType={mapType}
              showsUserLocation={!!userPosRef.current}
              showsMyLocationButton={false}
              initialRegion={{
                latitude: (userPosRef.current?.latitude ?? pickOfferLocation(offer)?.latitude ?? 47.0707),
                longitude: (userPosRef.current?.longitude ?? pickOfferLocation(offer)?.longitude ?? 15.4395),
                latitudeDelta: 0.006,
                longitudeDelta: 0.006,
              }}
              accessibilityRole="image"
              accessibilityLabel="Karte mit Ziel und aktuellem Standort"
            >
              {userPosRef.current && <Marker coordinate={userPosRef.current} title="Du" />}
              {pickOfferLocation(offer) && (
                <Marker
                  coordinate={pickOfferLocation(offer) as any}
                  title={offer?.name || 'Ziel'}
                  pinColor={pal.primary || colors.primary}
                />
              )}
            </MapView>
            <View style={[styles.mapToggle, { backgroundColor: 'rgba(255,255,255,0.92)' }]}>
              <TouchableOpacity
                onPress={() => setMapType('standard')}
                style={[styles.toggleBtn, mapType === 'standard' && { backgroundColor: pal.primary || colors.primary }]}
              >
                <Text style={[styles.toggleText, mapType === 'standard' && { color: '#fff' }]}>Map</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMapType('satellite')}
                style={[styles.toggleBtn, mapType === 'satellite' && { backgroundColor: pal.primary || colors.primary }]}
              >
                <Text style={[styles.toggleText, mapType === 'satellite' && { color: '#fff' }]}>Sat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* CTA-Bar mit „Zurück“ */}
      <SafeAreaView
        edges={['bottom']}
        style={[
          styles.ctaBar,
          { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: (pal.card || '#ffffff') + 'F2', borderTopColor: pal.separator || '#e5e7eb' },
        ]}
      >
        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: pal.primary || colors.primary }]}
          onPress={handleStartRoute}
          activeOpacity={0.9}
        >
          <Text style={styles.ctaPrimaryText}>Route starten</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ctaBtn, styles.ctaGhost]}
          onPress={handleBack}
          activeOpacity={0.9}
        >
          <Text style={styles.ctaGhostText}>Zurück</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

/* ───────── Styles ───────── */
const styles = StyleSheet.create({
  safeLike: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { marginTop: 8 },
  error: { color: '#B00020', marginBottom: 12, textAlign: 'center' },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' },

  titleXL: { fontSize: 20, fontWeight: '800', lineHeight: 24 },
  metaSmall: { fontSize: 12, marginTop: 8, marginBottom: 8 },
  cardBody: { fontSize: 14, lineHeight: 20 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
  },
  heroCard: { marginTop: 8, marginBottom: 8, padding: 12 },
  heroPlaceholder: { width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' },
  heroPlaceholderText: { color: '#6b7280', fontWeight: '600' },

  mapToggle: {
    position: 'absolute', top: 10, right: 10, flexDirection: 'row',
    borderRadius: 999, overflow: 'hidden',
  },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  toggleText: { fontSize: 12, fontWeight: '700' },

  badgesRow: { flexDirection: 'row', flexWrap: 'wrap' },
  badgeUniform: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
    minHeight: 28, borderWidth: 1, marginRight: 8, marginBottom: 8,
  },
  badgeNeutral: { backgroundColor: '#f3f4f6', borderColor: '#e5e7eb' },
  badgeBlue: { backgroundColor: '#e5f0ff', borderColor: '#bfdbfe' },
  badgeOrange: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  badgeWarn: { backgroundColor: 'rgba(255,149,0,0.18)', borderColor: 'rgba(255,149,0,0.45)' },
  badgeOk: { backgroundColor: 'rgba(46,213,115,0.22)', borderColor: 'rgba(46,213,115,0.45)' },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#0f172a' },

  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
  },
  cardTitleBig: { fontSize: 18, fontWeight: '900', color: '#1f2937', marginBottom: 6, lineHeight: 22 },

  ctaBar: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row', gap: 10,
  },
  ctaBtn: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, minHeight: 48 },
  ctaPrimaryText: { color: '#fff', fontWeight: '700' },
  ctaGhost: { backgroundColor: '#eef2ff' },
  ctaGhostText: { color: '#111827', fontWeight: '700' },
});


