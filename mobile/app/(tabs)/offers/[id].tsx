import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  SafeAreaView,
  Animated,
  Easing,
  FlatList,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import { useTheme } from '../../../theme/ThemeProvider';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import { DistanceBadge } from '../../../components/DistanceBadge';
import { isOfferActiveNow } from '../../../utils/isOfferActiveNow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';

const API_URL = 'https://lobster-app-ie9a5.ondigitalocean.app/api';
const api = axios.create({ baseURL: API_URL, timeout: 12000 });
const OID24 = /^[0-9a-fA-F]{24}$/;
const SCREEN_W = Dimensions.get('window').width;

function toNumber(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseFloat(val);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function formatDistance(metersLike) {
  const meters = toNumber(metersLike);
  if (meters == null) return null;
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

function pickOfferLatLng(offer) {
  const direct = offer?.location?.coordinates;
  if (Array.isArray(direct) && direct.length === 2) {
    const [lng, lat] = direct;
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat: Number(lat), lng: Number(lng) };
  }
  const provider = offer?.provider?.location?.coordinates;
  if (Array.isArray(provider) && provider.length === 2) {
    const [lng, lat] = provider;
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat: Number(lat), lng: Number(lng) };
  }
  return null;
}

function pickOfferEndDate(offer) {
  const keys = ['activeUntil', 'activeEnd', 'validUntil', 'endAt', 'validTo', 'dateTo', 'activeWindowEnd', 'expiresAt'];
  for (const key of keys) {
    const raw = offer?.[key];
    if (!raw) continue;
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const toRaw = offer?.validDates?.to ?? offer?.validDates?.end;
  if (!toRaw) return null;
  const d = new Date(toRaw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatRemaining(diffMs) {
  if (diffMs == null || diffMs <= 0) return 'endet bald';
  const totalMin = Math.ceil(diffMs / 60000);
  if (totalMin < 60) return `noch ${totalMin} min`;
  const totalH = Math.ceil(totalMin / 60);
  if (totalH < 24) return `noch ${totalH} h`;
  const days = Math.floor(totalH / 24);
  const hours = totalH % 24;
  return hours === 0 ? `noch ${days} Tage` : `noch ${days} Tage ${hours} h`;
}

export default function OfferDetailsScreen() {
  const router = useRouter();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id: idParam, distance: distanceParam } = useLocalSearchParams();

  const id = useMemo(() => (typeof idParam === 'string' ? idParam.trim() : ''), [idParam]);
  const validId = useMemo(() => OID24.test(id), [id]);

  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [userPos, setUserPos] = useState(null);

  const mountedRef = useRef(true);
  const mapRef = useRef(null);
  const titleAnim = useRef(new Animated.Value(0)).current;

  const distanceFromParam = useMemo(() => {
    const n = toNumber(typeof distanceParam === 'string' ? distanceParam : undefined);
    return n != null ? n : null;
  }, [distanceParam]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setOffer(null);
    setErr(null);

    if (!validId) {
      setLoading(false);
      setErr('Ungueltige Angebots-ID.');
      return;
    }

    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        const res = await api.get(`/offers/${id}`, { params: { withProvider: 1 }, signal: controller.signal });
        const data = res?.data?.offer ?? res?.data ?? null;
        if (!mountedRef.current) return;
        setOffer(data);
      } catch (e) {
        if (!mountedRef.current) return;
        const isTimeout = String(e?.message || '').toLowerCase().includes('timeout');
        setErr(isTimeout ? 'Zeitueberschreitung - bitte erneut versuchen.' : 'Fehler beim Laden des Angebots.');
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    return () => controller.abort?.();
  }, [id, validId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (!cancelled && last?.coords) {
          setUserPos({ lat: last.coords.latitude, lng: last.coords.longitude });
          return;
        }
        const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled && cur?.coords) {
          setUserPos({ lat: cur.coords.latitude, lng: cur.coords.longitude });
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      Animated.timing(titleAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [loading, titleAnim]);

  const isActive = useMemo(() => (offer ? isOfferActiveNow(offer, 'Europe/Vienna', new Date()) : false), [offer]);
  const geo = useMemo(() => (offer ? pickOfferLatLng(offer) : null), [offer]);

  const distanceMeters = useMemo(() => {
    if (distanceFromParam != null) return distanceFromParam;
    const fromOffer = toNumber(offer?.distance);
    return fromOffer != null ? fromOffer : null;
  }, [distanceFromParam, offer]);

  const remainingLabel = useMemo(() => {
    const end = pickOfferEndDate(offer);
    if (!end) return null;
    return formatRemaining(end.getTime() - Date.now());
  }, [offer]);

  const images = useMemo(() => (Array.isArray(offer?.images) ? offer.images.filter(Boolean) : []), [offer]);

  const mapRegion = useMemo(() => {
    const p = userPos || geo;
    if (!p) return null;
    return {
      latitude: p.lat,
      longitude: p.lng,
      latitudeDelta: 0.006,
      longitudeDelta: 0.006,
    };
  }, [geo, userPos]);

  useEffect(() => {
    if (!userPos || !mapRef.current) return;
    try {
      mapRef.current.animateCamera(
        {
          center: { latitude: userPos.lat, longitude: userPos.lng },
          zoom: 17.5,
          pitch: 0,
        },
        { duration: 320 }
      );
    } catch {}
  }, [userPos]);

  const handleStartRoute = () => {
    router.push({ pathname: '/(tabs)/NavigationScreen', params: { id } });
  };

  const handleBack = () => {
    try {
      if (router.canGoBack?.()) {
        router.back();
        return;
      }
    } catch {}
    router.replace('/');
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.colors.background }]}>
        <ActivityIndicator size="large" color={t.colors.primary} />
      </SafeAreaView>
    );
  }

  if (err || !offer) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: t.colors.background }]}>
        <Text style={[styles.err, { color: t.colors.danger }]}>{err || 'Angebot nicht gefunden.'}</Text>
        <View style={{ marginTop: 12 }}>
          <Button title="Zurueck" variant="secondary" onPress={handleBack} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={[styles.container, { backgroundColor: t.colors.background }]}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 16 + insets.bottom + 160 }]}>
          <View style={[styles.heroBlock, { backgroundColor: t.colors.card, borderColor: t.colors.divider }]}>
            <View style={styles.badgesRow}>
              {isActive ? <Badge label="Jetzt gueltig" tone="success" style={styles.badgeGap} /> : <Badge label="Pruefen" tone="warning" style={styles.badgeGap} />}
              {remainingLabel ? <Badge label={remainingLabel} tone="info" style={styles.badgeGap} /> : null}
              {distanceMeters != null ? (
                <View style={styles.badgeGap}>
                  <DistanceBadge meters={distanceMeters} />
                </View>
              ) : null}
            </View>

            <Animated.Text
              style={[
                styles.title,
                {
                  color: t.colors.inkHigh,
                  opacity: titleAnim,
                  transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
                },
              ]}
            >
              {offer.name || 'Angebot'}
            </Animated.Text>

            {!!offer.description && <Text style={[styles.desc, { color: t.colors.ink }]}>{offer.description}</Text>}

            <View style={styles.imagePanel}>
              {images.length > 0 ? (
                <FlatList
                  data={images}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(uri, i) => `${offer._id || 'offer'}-${i}-${uri}`}
                  renderItem={({ item }) => (
                    <Image source={{ uri: item }} style={{ width: SCREEN_W - 64, height: 196, borderRadius: 12 }} resizeMode="cover" />
                  )}
                  ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
                />
              ) : (
                <View style={[styles.emptyImage, { backgroundColor: t.colors.muted }]}>
                  <Text style={{ color: t.colors.inkLow }}>Keine Bilder verfuegbar</Text>
                </View>
              )}
            </View>
          </View>

          <View style={[styles.infoBox, { backgroundColor: t.colors.card, borderColor: t.colors.divider }]}>
            <Text style={[styles.infoTitle, { color: t.colors.inkHigh }]}>Ort</Text>
            <Text style={[styles.infoText, { color: t.colors.ink }]}>{offer?.provider?.name || 'Anbieter'}</Text>
            {!!offer?.provider?.address && <Text style={[styles.infoSub, { color: t.colors.inkLow }]}>{offer.provider.address}</Text>}
            {distanceMeters != null && <Text style={[styles.infoSub, { color: t.colors.inkLow }]}>Entfernung: {formatDistance(distanceMeters)}</Text>}
          </View>

          {mapRegion && (
            <View style={[styles.infoBox, { backgroundColor: t.colors.card, borderColor: t.colors.divider }]}>
              <Text style={[styles.infoTitle, { color: t.colors.inkHigh, marginBottom: 8 }]}>Karte</Text>
              <View style={styles.mapWrap}>
                <MapView
                  ref={mapRef}
                  provider={PROVIDER_GOOGLE}
                  style={StyleSheet.absoluteFill}
                  initialRegion={mapRegion}
                  showsUserLocation={!!userPos}
                  showsMyLocationButton={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  toolbarEnabled={false}
                >
                  {geo ? <Marker coordinate={{ latitude: geo.lat, longitude: geo.lng }} title={offer?.name || 'Ziel'} /> : null}
                </MapView>
              </View>
            </View>
          )}

        </ScrollView>

        <SafeAreaView style={{ backgroundColor: t.colors.background }}>
          <View style={[styles.footer, { borderTopColor: t.colors.divider, paddingBottom: 10 + insets.bottom }]}> 
            <View style={{ width: '100%' }}>
              <Button
                title="Bring mich hin"
                variant="primary"
                size="lg"
                onPress={handleStartRoute}
              />
            </View>
            <View style={{ marginTop: 8, width: '100%' }}>
              <Button title="Angebot ansehen" variant="secondary" size="sm" onPress={handleBack} />
            </View>
          </View>
        </SafeAreaView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  err: { fontSize: 14, textAlign: 'center' },

  heroBlock: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  badgeGap: { marginRight: 6, marginBottom: 6 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '900' },
  desc: { marginTop: 8, fontSize: 14, lineHeight: 20 },

  imagePanel: { marginTop: 12 },
  emptyImage: { height: 196, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  infoBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  infoTitle: { fontSize: 14, fontWeight: '800' },
  infoText: { marginTop: 4, fontSize: 15, fontWeight: '600' },
  infoSub: { marginTop: 4, fontSize: 13, lineHeight: 18 },

  mapWrap: { height: 190, borderRadius: 12, overflow: 'hidden' },

  footer: {
    flexDirection: 'column',
    alignItems: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
});
