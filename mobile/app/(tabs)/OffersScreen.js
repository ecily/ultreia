import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Platform,  ScrollView,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { isOfferActiveNow } from '../../utils/isOfferActiveNow';
import OfferDistanceBadge from '../../components/DistanceBadge';

import colors from '../../theme/colors';

const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://lobster-app-ie9a5.ondigitalocean.app/api').replace(/\/$/, '');

const SCREEN_W = Dimensions.get('window').width;

/* ───────── Geo Helpers ───────── */
function toRad(deg) { return (deg * Math.PI) / 180; }
function haversineM(a, b) {
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const aa = s1 * s1 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * s2 * s2;
  return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}
function fmtDistance(m) { return m < 995 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`; }

/* ───────── Helpers ───────── */
function normalizeToken(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/\s+/g, ' ').trim();
}
async function getSelectedInterestsSet() {
  const candidates = ['selectedInterests', 'interests', 'userInterests'];
  for (const key of candidates) {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Set(parsed.map(normalizeToken));
      } catch {
        const list = raw.split(',').map(normalizeToken).filter(Boolean);
        if (list.length) return new Set(list);
      }
    }
  }
  return new Set();
}
function offerMatchesInterests(offer, interestSet) {
  if (!interestSet || interestSet.size === 0) return true;
  const cat = normalizeToken(offer?.category);
  const sub = normalizeToken(offer?.subcategory);
  const name = normalizeToken(offer?.name);
  for (const t of interestSet) {
    if (!t) continue;
    if ((cat && (cat === t || cat.includes(t))) ||
        (sub && (sub === t || sub.includes(t))) ||
        (name && name.includes(t))) {
      return true;
    }
  }
  return false;
}
function pickOfferLocation(offer) {
  const coords = offer?.location?.coordinates || offer?.provider?.location?.coordinates || null;
  if (Array.isArray(coords) && coords.length >= 2) {
    const [lng, lat] = coords;
    const latN = Number(lat), lngN = Number(lng);
    if (Number.isFinite(latN) && Number.isFinite(lngN)) return { latitude: latN, longitude: lngN };
  }
  return null;
}
function pickRadiusMeters(offer) {
  const r1 = Number(offer?.radius);
  if (Number.isFinite(r1) && r1 >= 0) return r1;
  const r2 = Number(offer?.provider?.radius);
  if (Number.isFinite(r2) && r2 >= 0) return r2;
  return null;
}

// Restlaufzeit (robust)
function getRemainingMs(offer) {
  const keys = ['activeUntil','activeEnd','validUntil','endAt','validTo','dateTo','activeWindowEnd','endTime'];
  const vd = offer?.validDates;
  if (vd && typeof vd === 'object') {
    const toRaw = vd.to ?? vd.end ?? vd.toDate ?? vd.endDate;
    if (toRaw) {
      const d = new Date(toRaw);
      if (!isNaN(d)) {
        const diff = d.getTime() - Date.now();
        if (diff > 0) return diff;
      }
    }
  }
  for (const k of keys) {
    const v = offer?.[k]; if (!v) continue;
    const d = new Date(v); if (!isNaN(d)) {
      const diff = d.getTime() - Date.now();
      if (diff > 0) return diff;
    }
  }
  return null;
}
function formatRemaining(diffMs) {
  if (diffMs == null) return '—';
  const totalMin = Math.ceil(diffMs / 60000);
  if (totalMin <= 0) return '—';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}\u00A0min`;
  if (m === 0) return `${h}\u00A0h`;
  return `${h}\u00A0h ${m}\u00A0min`;
}
// Simple relative time like on Home
function formatRelative(dateLike) {
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
export default function OffersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTheme?.() || {};
  const pal = (t && t.colors) ? t.colors : colors;

  const { id, name: paramName, image: paramImage, distance: paramDistance } = useLocalSearchParams();
  const offerId = id ? String(id) : null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offers, setOffers] = useState([]);
  const [error, setError] = useState(null);
  const [provider, setProvider] = useState(null);
  const [mapType, setMapType] = useState('standard');

  const userPosRef = useRef(null);
  const mapRef = useRef(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const interestSet = await getSelectedInterestsSet();

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('Standortberechtigung verweigert');
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Platform.OS === 'android' ? Location.Accuracy.Balanced : Location.Accuracy.High,
      });
      const userPos = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      userPosRef.current = userPos;

      if (offerId) {
        const resDetail = await fetch(`${API_BASE_URL}/offers/${encodeURIComponent(offerId)}?withProvider=1`);
        if (resDetail.status === 404) throw new Error('Offer nicht gefunden (404)');
        if (!resDetail.ok) throw new Error(`GET /offers/:id failed: ${resDetail.status}`);
        const obj = await resDetail.json();
        const offer = obj?.offer || obj?.data || obj;
        if (!offer || !offer._id) throw new Error('Unerwartete Antwort für /offers/:id');

        const loc = pickOfferLocation(offer);
        const radiusM = pickRadiusMeters(offer);
        const distanceM = loc ? haversineM(userPos, loc) : Number.POSITIVE_INFINITY;

        const activeNow = isOfferActiveNow(offer, 'Europe/Vienna');

        setOffers([{ offer, loc, radiusM, distanceM, include: true, activeNow }]);

        if (offer?.provider && typeof offer.provider === 'object') setProvider(offer.provider);
        else if (offer?.provider) {
          try {
            const rp = await fetch(`${API_BASE_URL}/providers/${encodeURIComponent(offer.provider)}`);
            if (rp.ok) setProvider(await rp.json());
          } catch {}
        }
        return;
      }

      const res = await fetch(`${API_BASE_URL}/offers?withProvider=1&page=1&limit=200`);
      if (!res.ok) throw new Error(`GET /offers failed: ${res.status}`);
      const json = await res.json();
      const rows = Array.isArray(json?.offers) ? json.offers : Array.isArray(json) ? json : [];

      const kept = rows
        .filter((o) => offerMatchesInterests(o, interestSet))
        .map((offer) => {
          const loc = pickOfferLocation(offer);
          const radiusM = pickRadiusMeters(offer);
          const distanceM = loc ? haversineM(userPos, loc) : Number.POSITIVE_INFINITY;
          const include = !!loc && Number.isFinite(radiusM) && distanceM <= radiusM;
          const activeNow = isOfferActiveNow(offer, 'Europe/Vienna');
          return { offer, loc, radiusM, distanceM, include, activeNow };
        })
        .filter((r) => r.include)
        .sort((a, b) => a.distanceM - b.distanceM);

      setOffers(kept);
    } catch (e) {
      setError(e?.message || 'Unbekannter Fehler beim Laden der Angebote');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [offerId]);

  useEffect(() => { setLoading(true); load(); }, [load, offerId]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  /* Animated helpers */
  const scaleOnPress = () => {
    const v = new Animated.Value(1);
    const onPressIn = () =>
      Animated.spring(v, { toValue: 0.98, useNativeDriver: true, friction: 6, tension: 250 }).start();
    const onPressOut = () =>
      Animated.spring(v, { toValue: 1, useNativeDriver: true, friction: 6, tension: 250 }).start();
    return { v, onPressIn, onPressOut };
  };
  const fadeOnLoad = () => {
    const v = new Animated.Value(0);
    const onLoad = () => Animated.timing(v, { toValue: 1, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    return { v, onLoad };
  };

  /* List Items */
  const renderItem = useCallback(({ item }) => {
    const { offer, distanceM, radiusM, activeNow } = item;
    const accLabel = `${offer?.name || 'Angebot'} – ${fmtDistance(distanceM)} innerhalb Radius`;
    const press = scaleOnPress();
    const img = fadeOnLoad();

    return (
      <Animated.View style={[styles.card, { transform: [{ scale: press.v }] }]}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          onPress={() => router.push({ pathname: '/(tabs)/offers/[id]', params: { id: offer._id } })}
          accessibilityRole="button"
          accessibilityLabel={accLabel}
          testID={`offer-card-${offer._id}`}
        >
          {offer.images?.[0] ? (
            <Animated.Image
              source={{ uri: offer.images[0] }}
              style={[styles.cardImage, { opacity: img.v }]}
              onLoad={img.onLoad}
              resizeMode="cover"
            />
          ) : null}

          {/* Badges oben & einheitlich */}
          <View style={[styles.badgesRow, { marginBottom: 6 }]}>
            <Text style={[styles.badgeUniform, activeNow ? styles.badgeOk : styles.badgeWarn]}>
              <Text style={styles.badgeText}>{activeNow ? 'Jetzt gültig' : 'Nicht aktiv'}</Text>
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
            <View style={[styles.badgeUniform, styles.badgeBlue, { paddingVertical: 0, paddingHorizontal: 0 }]}>
              <OfferDistanceBadge distanceM={distanceM} compact />
            </View>
          </View>

          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, { color: pal.ink || '#1f2937' }]} numberOfLines={1} allowFontScaling>
              {offer.name}
            </Text>
          </View>

          {!!offer.description && (
            <Text style={[styles.cardDesc, { color: pal.inkMid || '#4b5563' }]} numberOfLines={2} allowFontScaling>
              {offer.description}
            </Text>
          )}

          <View style={styles.bottomRow}>
            <Text style={[styles.distance, { color: pal.ink || '#111827' }]} allowFontScaling>
              {fmtDistance(distanceM)} innerhalb Radius ✅
            </Text>
            <Text style={[styles.radius, { color: pal.inkLow || '#6b7280' }]} allowFontScaling>
              Radius: {Number.isFinite(radiusM) ? `${radiusM} m` : '—'}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [router, pal]);

  /* Detail helpers */
  const first = offers?.[0];
  const offer = first?.offer;
  const offerLoc = first?.loc || (offer ? pickOfferLocation(offer) : null);
  const activeNowDetail = first?.activeNow ?? (offer ? isOfferActiveNow(offer, 'Europe/Vienna') : false);

  const distanceMDetail = useMemo(() => {
    if (Number.isFinite(first?.distanceM)) return first.distanceM;
    const prm = typeof paramDistance === 'string' ? Number(paramDistance) : null;
    if (Number.isFinite(prm)) return prm;
    if (userPosRef.current && offerLoc) return haversineM(userPosRef.current, offerLoc);
    return null;
  }, [first, paramDistance, offerLoc]);

  useEffect(() => {
    if (!offerId || !mapRef.current) return;
    const center = userPosRef.current || offerLoc;
    if (!center) return;
    try {
      mapRef.current.animateCamera(
        {
          center,
          zoom: 17.2,
          pitch: 0,
        },
        { duration: 320 }
      );
    } catch {}
  }, [offerId, offerLoc]);

  const remainingMs = offer ? getRemainingMs(offer) : null;
  const updatedAtRel = offer?.updatedAt ? formatRelative(offer.updatedAt) : null;

  const handleStartRoute = () => {
    if (!offer) return;
    router.push({ pathname: '/(tabs)/NavigationScreen', params: { id: offer._id } });
  };
  const handleBackToIndex = () => {
    try {
      if (router.canGoBack?.()) {
        router.back();
        return;
      }
    } catch {}
    router.replace('/');
  };

  // ---- Image pager (Detail) ----
  const images = useMemo(() => {
    if (!offer) return (paramImage ? [paramImage] : []);
    const arr = Array.isArray(offer.images) ? offer.images : [];
    return arr.length ? arr : (paramImage ? [paramImage] : []);
  }, [offer, paramImage]);
  const heroHeight = 220;
  const heroRef = useRef(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const hasMultiple = images.length > 1;

  const onHeroScroll = useCallback((e) => {
    const x = e.nativeEvent.contentOffset.x || 0;
    const idx = Math.round(x / SCREEN_W);
    if (idx !== heroIndex) setHeroIndex(idx);
  }, [heroIndex]);

  const goHero = useCallback((dir) => {
    if (!heroRef.current) return;
    const next = Math.max(0, Math.min(images.length - 1, heroIndex + dir));
    if (next === heroIndex) return;
    heroRef.current.scrollToIndex({ index: next, animated: true });
    setHeroIndex(next);
  }, [heroIndex, images.length]);

  // WOW-Effekt: sanftes Auftauchen der Headline (einmalig)
  const titleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!offerId) return;
    Animated.timing(titleAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  }, [offerId, titleAnim]);

  /* ───────── Render ───────── */
  if (loading) {
    return (
      <View style={[styles.safeLike, { backgroundColor: pal.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={pal.primary || colors.primary} />
          <Text style={[styles.muted, { color: pal.inkLow || '#777' }]} allowFontScaling>Angebote werden geladen…</Text>
        </View>
      </View>
    );
  }
  if (error) {
    return (
      <View style={[styles.safeLike, { backgroundColor: pal.background }]}>
        <View style={styles.center}>
          <Text style={[styles.error]} allowFontScaling>Fehler: {error}</Text>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: pal.primary || colors.primary }]}
            onPress={load}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Erneut versuchen"
            testID="offers-retry"
          >
            <Text style={styles.btnText} allowFontScaling>Erneut versuchen</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── DETAIL ──────────────────────────────────────────────────────────────
  if (offerId && offer) {
    return (
      <View style={[styles.safeLike, { backgroundColor: pal.background }]}>

        {/* Badges oben & einheitlich */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <View style={[styles.badgesRow, { marginBottom: 8 }]}>
            <Text style={[styles.badgeUniform, activeNowDetail ? styles.badgeOk : styles.badgeWarn]}>
              <Text style={styles.badgeText}>{activeNowDetail ? 'Jetzt gültig' : 'Nicht aktiv'}</Text>
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
            {Number.isFinite(distanceMDetail) && (
              <View style={[styles.badgeUniform, styles.badgeBlue, { paddingVertical: 0, paddingHorizontal: 0 }]}>
                <OfferDistanceBadge distanceM={distanceMDetail} compact />
              </View>
            )}
          </View>
        </View>

        {/* Titel (mit WOW-Effekt) + Description */}
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <Animated.Text
            style={[
              styles.titleXL,
              { color: pal.ink || '#1f2937', opacity: titleAnim, transform: [{ translateY: titleAnim.interpolate({ inputRange: [0,1], outputRange: [8,0] }) }] },
            ]}
            allowFontScaling
            numberOfLines={2}
          >
            {offer?.name || paramName || 'Angebot'}
          </Animated.Text>

          {!!offer?.description && (
            <Text style={[styles.cardBody, { color: pal.inkMid || '#4b5563', marginTop: 6 }]} allowFontScaling>
              {offer.description}
            </Text>
          )}
          {!!updatedAtRel && (
            <Text style={[styles.metaSmall, { color: pal.inkLow || '#6b7280' }]}>
              Letztes Update: {updatedAtRel}
            </Text>
          )}
        </View>

        {/* Bilder (nebeneinander wischbar) */}
        <View style={[styles.card, styles.heroCard, { height: heroHeight, backgroundColor: pal.card || '#fff' }]}>
          {images.length ? (
            <>
              <FlatList
                ref={heroRef}
                data={images}
                horizontal
                pagingEnabled
                onScroll={onHeroScroll}
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
              {hasMultiple && (
                <>
                  <TouchableOpacity
                    style={[styles.heroArrow, styles.heroArrowLeft]}
                    onPress={() => goHero(-1)}
                    activeOpacity={0.8}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Vorheriges Bild"
                  >
                    <Text style={styles.arrowText}>{'‹'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.heroArrow, styles.heroArrowRight]}
                    onPress={() => goHero(1)}
                    activeOpacity={0.8}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Nächstes Bild"
                  >
                    <Text style={styles.arrowText}>{'›'}</Text>
                  </TouchableOpacity>
                  <View style={styles.heroHintWrap}>
                    <Text style={styles.heroHint} allowFontScaling>Wischen</Text>
                  </View>
                </>
              )}
            </>
          ) : (
            <View style={[styles.heroPlaceholder, { flex: 1, borderRadius: 12 }]}>
              <Text style={styles.heroPlaceholderText} allowFontScaling>Sorry. Kein Bild.</Text>
            </View>
          )}
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Anbieter-Karte (statt Lat/Lng) */}
          <View style={[styles.infoCard, { backgroundColor: pal.card || '#fff' }]}>
            <Text style={[styles.cardTitleBig, { color: pal.ink || '#1f2937' }]} allowFontScaling>
              {provider?.name || offer?.provider?.name || 'Anbieter'}
            </Text>
            {!!(provider?.address || offer?.provider?.address) && (
              <Text style={[styles.cardBody, { color: pal.inkMid || '#4b5563' }]} allowFontScaling>
                {provider?.address || offer?.provider?.address}
              </Text>
            )}
          </View>

          {/* Map Card (unverändert, keine Lat/Lng-Anzeige im Text) */}
          <View style={[styles.card, { padding: 12, backgroundColor: pal.card || '#fff' }]}>
            <View style={{ height: 220, borderRadius: 12, overflow: 'hidden' }}>
              <MapView
                ref={mapRef}
                style={{ flex: 1 }}
                provider={PROVIDER_GOOGLE}
                mapType={mapType}
                showsUserLocation={!!userPosRef.current}
                showsMyLocationButton={false}
                initialRegion={{
                  latitude: userPosRef.current?.latitude ?? offerLoc?.latitude ?? 47.0707,
                  longitude: userPosRef.current?.longitude ?? offerLoc?.longitude ?? 15.4395,
                  latitudeDelta: 0.006,
                  longitudeDelta: 0.006,
                }}
                accessibilityRole="image"
                accessibilityLabel="Karte mit Ziel und aktuellem Standort"
              >
                {userPosRef.current && <Marker coordinate={userPosRef.current} title="Du" />}
                {offerLoc && <Marker coordinate={offerLoc} title={offer?.name || 'Ziel'} pinColor={pal.primary || colors.primary} />}
              </MapView>

              <View style={[styles.mapToggle, { backgroundColor: 'rgba(255,255,255,0.92)' }]}>
                <TouchableOpacity
                  onPress={() => setMapType('standard')}
                  style={[styles.toggleBtn, mapType === 'standard' && { backgroundColor: pal.primary || colors.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel="Standardkarte"
                >
                  <Text style={[styles.toggleText, mapType === 'standard' && { color: '#fff' }]} allowFontScaling>Map</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setMapType('satellite')}
                  style={[styles.toggleBtn, mapType === 'satellite' && { backgroundColor: pal.primary || colors.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel="Satellitenkarte"
                >
                  <Text style={[styles.toggleText, mapType === 'satellite' && { color: '#fff' }]} allowFontScaling>Sat</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* CTA-Bar */}
        <SafeAreaView edges={['bottom']} style={[
          styles.ctaBar,
          { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: (pal.card || '#ffffff') + 'F2', borderTopColor: pal.separator || '#e5e7eb' },
        ]}>
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: pal.primary || colors.primary }]}
            onPress={handleStartRoute}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Route starten"
            testID="offer-start-route"
          >
            <Text style={styles.ctaPrimaryText} allowFontScaling>Route starten</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ctaBtn, styles.ctaGhost]}
            onPress={handleBackToIndex}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Zurück"
            testID="offer-back"
          >
            <Text style={styles.ctaGhostText} allowFontScaling>Zurück</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // ── LISTE ───────────────────────────────────────────────────────────────
  return (
    <View style={[styles.safeLike, { backgroundColor: pal.background }]}>
      <FlatList
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}
        data={offers}
        keyExtractor={(row) => String(row.offer._id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        accessibilityRole="list"
        testID="offers-list"
      />
    </View>
  );
}

/* ───────── Styles ───────── */
const styles = StyleSheet.create({
  // Safe-like wrapper
  safeLike: { flex: 1 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { marginTop: 8 },
  error: { color: '#B00020', marginBottom: 12, textAlign: 'center' },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' },

  // Screen spacing wie Home
  list: { paddingHorizontal: 16, paddingTop: 12 },

  /* Generic card */
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

  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  /* Index card */
  cardImage: { width: '100%', height: 140, borderRadius: 12, marginBottom: 8, backgroundColor: '#eee' },
  cardTitle: { flex: 1, fontSize: 18, fontWeight: '900', lineHeight: 22 },
  cardDesc: { marginTop: 6 },

  bottomRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  distance: { fontWeight: '600' },
  radius: {},

  /* Title / Meta (Detail) */
  titleXL: { fontSize: 20, fontWeight: '800', lineHeight: 24 },
  metaSmall: { fontSize: 12, marginTop: 8, marginBottom: 8 },

  /* Hero */
  heroCard: { marginTop: 8, marginBottom: 8, padding: 12 },
  heroPlaceholder: { width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' },
  heroPlaceholderText: { color: '#6b7280', fontWeight: '600' },
  heroArrow: {
    position: 'absolute',
    top: '45%',
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(17,24,39,0.65)',
  },
  heroArrowLeft: { left: 14 },
  heroArrowRight: { right: 14 },
  arrowText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroHintWrap: { position: 'absolute', bottom: 10, alignSelf: 'center', backgroundColor: 'rgba(17,24,39,0.55)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  heroHint: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  /* Map toggle */
  mapToggle: {
    position: 'absolute', top: 10, right: 10, flexDirection: 'row',
    borderRadius: 999, overflow: 'hidden',
  },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  toggleText: { fontSize: 12, fontWeight: '700' },

  /* Badges (vereinheitlicht) */
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap' },
  badgeUniform: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, minHeight: 28, borderWidth: 1, marginRight: 8, marginBottom: 8 },
  badgeNeutral: { backgroundColor: '#f3f4f6', borderColor: '#e5e7eb' },
  badgeBlue: { backgroundColor: '#e5f0ff', borderColor: '#bfdbfe' },
  badgeOrange: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  badgeWarn: { backgroundColor: 'rgba(255,149,0,0.18)', borderColor: 'rgba(255,149,0,0.45)' },
  badgeOk: { backgroundColor: 'rgba(46,213,115,0.22)', borderColor: 'rgba(46,213,115,0.45)' },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#0f172a' },

  /* Info cards (Detail) */
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
  cardBody: { fontSize: 14, lineHeight: 20, marginBottom: 6 },

  /* mini pill (nur noch in Ausnahmefällen genutzt) */
  badgeMini: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
    fontSize: 12, fontWeight: '700', color: '#0f172a',
  },

  /* CTA */
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

