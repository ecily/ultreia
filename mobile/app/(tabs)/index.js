// stepsmatch/mobile/app/(tabs)/index.js
// Robustheit: Standort-Fallback (LastKnown + Persist), Offers trotz fehlender Position, Axios-Timeout + Retry

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { sendHeartbeat, refreshGeofencesAroundUser } from '../../components/PushInitializer';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,  ScrollView,
  RefreshControl,
  AppState,
  Animated,
  Easing,
  Platform,
  InteractionManager,
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { isOfferActiveNow } from '../../utils/isOfferActiveNow';

import { useTheme } from '../../theme/ThemeProvider';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { EmptyState } from '../../components/EmptyState';
import { DistanceBadge } from '../../components/DistanceBadge';

import { csvToSet, matchesInterests } from '../../utils/interests';


const API_URL = 'https://api.ultreia.app/api';
const FALLBACK_NEARBY_RADIUS_M = 5000;

/* ───────────── Helpers ───────────── */

function withTimeout(promise, ms, label = 'operation') {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => (timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms))),
  ]).finally(() => clearTimeout(timer));
}

// Netzwerk robuster: höheres Timeout + gezielter Retry bei Timeout
const AXIOS_BASE_TIMEOUT_MS = 20000;
const AXIOS_RETRY_TIMEOUT_MS = 35000;
const api = axios.create({ baseURL: API_URL, timeout: AXIOS_BASE_TIMEOUT_MS });

function groupByCategory(list) {
  const m = {};
  for (const o of list) {
    const cat = o.category || 'Andere';
    if (!m[cat]) m[cat] = [];
    m[cat].push(o);
  }
  return m;
}

function toNumber(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  }
  return null;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* ─────────── Geo-Helpers (robust) ─────────── */
function pickOfferLatLng(o) {
  try {
    if (o?.location?.coordinates && Array.isArray(o.location.coordinates) && o.location.coordinates.length === 2) {
      const [lng, lat] = o.location.coordinates;
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat: Number(lat), lng: Number(lng) };
    }
    if (o?.provider?.location?.coordinates && Array.isArray(o.provider.location.coordinates) && o.provider.location.coordinates.length === 2) {
      const [lng, lat] = o.provider.location.coordinates;
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat: Number(lat), lng: Number(lng) };
    }
    const lat = toNumber(o?.lat ?? o?.latitude ?? o?.provider?.lat ?? o?.provider?.latitude);
    const lng = toNumber(o?.lng ?? o?.lon ?? o?.longitude ?? o?.provider?.lng ?? o?.provider?.lon ?? o?.provider?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return null;
  } catch {
    return null;
  }
}

function pickRadiusMeters(o) {
  const candidates = [
    o?.radiusMeters, o?.radius_m, o?.radiusM, o?.radius, o?.range, o?.distanceRadius, o?.geoRadiusM,
    o?.provider?.radiusMeters, o?.provider?.radius_m, o?.provider?.radiusM, o?.provider?.radius,
  ].map(toNumber);
  for (const v of candidates) {
    if (Number.isFinite(v) && v > 0) return v;
  }
  return null;
}

/* ─────────── Datums-/Zeit-Parsing ─────────── */
function startOfDayLocal(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0); }
function endOfDayLocal(d)   { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }

function parseDateLike(x, role /* 'from' | 'to' */) {
  if (!x) return null;
  if (x instanceof Date) return isNaN(x) ? null : x;
  if (typeof x === 'number') { const d = new Date(x); return isNaN(d) ? null : d; }
  const s = String(x).trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dateOnly) {
    const y = Number(dateOnly[1]), m = Number(dateOnly[2]) - 1, d = Number(dateOnly[3]);
    const base = new Date(y, m, d);
    return role === 'to' ? endOfDayLocal(base) : startOfDayLocal(base);
  }
  const d = new Date(s);
  if (isNaN(d)) return null;

  const isZMidnight = /T00:00:00(\.000)?Z$/.test(s);
  if (isZMidnight) {
    const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
    const local = new Date(y, m, day);
    return role === 'to' ? endOfDayLocal(local) : startOfDayLocal(local);
  }
  return d;
}

function parseHM(x) {
  if (!x) return null;
  const m = String(x).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]), s = Number(m[3] || 0);
  if (h < 0 || h > 23 || min < 0 || min > 59 || s < 0 || s > 59) return null;
  return h * 3600 + min * 60 + s;
}

/* ─────────── Endzeit/Restlaufzeit ─────────── */
function pickOfferEndDate(item) {
  if (!item || typeof item !== 'object') return null;
  const directKeys = [
    'activeUntil','activeEnd','validUntil','endAt',
    'validTo','dateTo','activeWindowEnd','endTime',
    'expiresAt','expiry','until'
  ];
  for (const k of directKeys) {
    const v = item?.[k];
    const d = parseDateLike(v, 'to');
    if (d) return d;
  }
  const vd = item?.validDates || item?.dates || null;
  if (vd && typeof vd === 'object') {
    const toRaw = vd.to ?? vd.end ?? vd.toDate ?? vd.endDate;
    const d = parseDateLike(toRaw, 'to');
    if (d) return d;
  }
  return null;
}

function getRemainingMs(item, now = new Date()) {
  const hardEnd = pickOfferEndDate(item);
  if (hardEnd) {
    const diff = hardEnd.getTime() - now.getTime();
    if (diff > 0) return diff;
    return null;
  }
  const vt = item?.validTimes || item?.times || null;
  if (vt && typeof vt === 'object') {
    const fromS = parseHM(vt.from ?? vt.start ?? vt.fromTime);
    const toS   = parseHM(vt.to   ?? vt.end   ?? vt.toTime);
    if (toS != null) {
      const nowS = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      if (fromS != null && fromS > toS) {
        const endBase = (nowS >= fromS)
          ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)
          : todayStart;
        const end = new Date(endBase.getTime() + toS * 1000);
        const diff = end.getTime() - now.getTime();
        return diff > 0 ? diff : null;
      } else {
        const end = new Date(todayStart.getTime() + toS * 1000);
        const diff = end.getTime() - now.getTime();
        return diff > 0 ? diff : null;
      }
    }
  }
  if (isOfferActiveNow(item, 'Europe/Vienna', now)) {
    const end = endOfDayLocal(now);
    const diff = end.getTime() - now.getTime();
    return diff > 0 ? diff : null;
  }
  return null;
}

/* Nutzerfreundlichere Restzeit (Tage/Std) */
function formatRemainingFriendly(diffMs) {
  if (diffMs == null) return null;
  const totalMin = Math.ceil(diffMs / 60000);
  if (totalMin <= 0) return null;
  const totalH = Math.ceil(totalMin / 60);
  if (totalH >= 24) {
    const d = Math.floor(totalH / 24);
    const h = totalH % 24;
    if (d >= 14) return `noch ${Math.round(d / 7)} Wochen`;
    if (h === 0) return `noch ${d} Tage`;
    return `noch ${d} Tage ${h} h`;
  }
  if (totalH >= 2) return `noch ${totalH} h`;
  return `noch ${totalMin} min`;
}

/* Relative Zeit (UI) */
function formatRelative(ts, now = Date.now()) {
  if (!ts) return '';
  const diff = Math.max(0, now - ts.getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m} Min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h} Std`;
  const d = Math.floor(h / 24);
  return `vor ${d} Tag${d > 1 ? 'en' : ''}`;
}

function etaFromDistanceM(distanceM) {
  const m = toNumber(distanceM);
  if (!Number.isFinite(m) || m <= 0) return null;
  const walkMinutes = Math.max(1, Math.round(m / 80));
  if (walkMinutes < 60) return `${walkMinutes} min zu Fuss`;
  const h = Math.floor(walkMinutes / 60);
  const r = walkMinutes % 60;
  return r === 0 ? `${h} h zu Fuss` : `${h} h ${r} min zu Fuss`;
}

/* ───────────── Screen ───────────── */

export default function HomeTab() {
  const router = useRouter();
  const t = useTheme();

  // Data
  const [, setOffers] = useState([]);
  const [grouped, setGrouped] = useState({});
  // Paging
  const [page, setPage] = useState(1);
  const [limit] = useState(200);
  const [hasMore, setHasMore] = useState(false);
  // Loading
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Error/Info
  const [err, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  // Location
  const [userLoc, setUserLoc] = useState(null);

  // Refs
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const abortRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const heartbeatTimerRef = useRef(null);  const appState = useRef(AppState.currentState);
  const fgNoticeTimerRef = useRef(null);

  const fetchFnRef = useRef(null);

  // Foreground-sync dedupe
  const fgSyncInFlightRef = useRef(false);
  const lastFgSyncAtRef = useRef(0);
  const FG_REFRESH_MIN_GAP_MS = 2500;

  // Persistierter Standort (Fallback)
  const LAST_LOC_KEY = 'lastUserLoc.v1';

  /* Initial HB */
  useEffect(() => {
    (async () => {
      try {
        await sendHeartbeat();
      } catch (_e) {
        /* noop */
      }
    })();
  }, []);

  /* Push-FG-Refresh */
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((n) => {
      try {
        const data = n?.request?.content?.data || {};
        if (data?.type === 'offer') {
          fetchFnRef.current?.({ pageToLoad: 1, mode: 'push' });
        }
      } catch {}
    });
    return () => { try { sub?.remove?.(); } catch {} };
  }, []);

  /* Gesehen-IDs */
  const SEEN_IDS_KEY = 'seenOfferIds_v1';
  const BASELINE_ON_FIRST_LOAD = false;

  const seenIdsRef = useRef(new Set());
  const baselineAppliedRef = useRef(BASELINE_ON_FIRST_LOAD);

  const loadSeenIds = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(SEEN_IDS_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        seenIdsRef.current = new Set(arr.filter((x) => typeof x === 'string'));
      }
    } catch {}
  }, []);

  const saveSeenIds = useCallback(async () => {
    try {
      await AsyncStorage.setItem(SEEN_IDS_KEY, JSON.stringify(Array.from(seenIdsRef.current)));
    } catch {}
  }, []);

  const interestsCSVFromStorage = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('userInterests');
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr) && arr.length) return arr.join(',');
    } catch {}
    return '';
  }, []);

  // Standort robust holen (mit Fallback auf „last known“ + Persist)
  const getLocation = useCallback(async () => {
    const fg = await withTimeout(Location.getForegroundPermissionsAsync(), 5000, 'location permission check');
    let status = fg?.status;
    if (status !== 'granted' && fg?.canAskAgain) {
      const req = await withTimeout(Location.requestForegroundPermissionsAsync(), 5000, 'location permission request');
      status = req?.status;
    }
    if (status !== 'granted') return null;

    // 1) Sofort: last known (wenn da, direkt nutzen)
    let last = null;
    try { last = await Location.getLastKnownPositionAsync(); } catch {}

    // 2) Versuche eine frische Position (7s Soft-Timeout)
    try {
      const pos = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        7000,
        'getCurrentPosition'
      );
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      // Persistieren für späteren Fallback
      try { await AsyncStorage.setItem(LAST_LOC_KEY, JSON.stringify(loc)); } catch {}
      return loc;
    } catch (_e) {
      // 3) Bei Timeout: nutze lastKnown oder persistierten Fallback – kein harter Fehler
      if (last?.coords) {
        const loc = { lat: last.coords.latitude, lng: last.coords.longitude };
        try { await AsyncStorage.setItem(LAST_LOC_KEY, JSON.stringify(loc)); } catch {}
        return loc;
      }
      try {
        const raw = await AsyncStorage.getItem(LAST_LOC_KEY);
        if (raw) {
          const loc = JSON.parse(raw);
          if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
            return loc;
          }
        }
      } catch {}
      // wenn gar nichts da ist → gib null zurück, damit UI trotzdem lädt
      return null;
    }
  }, []);

  // Fetch
  const fetchPage = useCallback(
    async ({ pageToLoad = 1, mode = 'initial' } = {}) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      if (abortRef.current) { try { abortRef.current.abort(); } catch {} }
      const controller = new AbortController();
      abortRef.current = controller;

      if (mode === 'initial' && !hasLoadedOnce) { setInitialLoading(true); setError(null); }
      if (mode === 'pull') { setRefreshing(true); setError(null); }
      if (mode === 'more') { setLoadingMore(true); }

      let postsThisReload = 0;

      try {
        if (!baselineAppliedRef.current) { await loadSeenIds(); }

        const [interestsCSV, loc] = await Promise.all([interestsCSVFromStorage(), getLocation()]);
        setUserLoc(loc || null);
        const interestSet = csvToSet(interestsCSV);

        let expoToken = null;
        try {
          expoToken = (await AsyncStorage.getItem('expoPushToken.v2')) ||
                      (await AsyncStorage.getItem('expoPushToken')) ||
                      null;
        } catch {}

        const params = { withProvider: 1, page: pageToLoad, limit, activeNow: 1 };
        if (interestsCSV) params.interests = interestsCSV;
        if (loc?.lat != null && loc?.lng != null) {
          params.lat = loc.lat;
          params.lng = loc.lng;
          params.maxDistanceM = 8000;
        }
        const t0 = (global?.performance && performance.now) ? performance.now() : Date.now();

        let res;
        try {
          res = await api.get('/offers', { params, signal: controller.signal });
        } catch (_e) {
          // gezielter Retry nur bei Timeout/Abort
          const isTimeout = _e?.code === 'ECONNABORTED' || String(_e?.message || '').toLowerCase().includes('timeout');
          const isAborted = String(_e?.message || '').toLowerCase().includes('aborted');
          if (isTimeout || isAborted) {
            const apiRetry = axios.create({ baseURL: API_URL, timeout: AXIOS_RETRY_TIMEOUT_MS });
            res = await apiRetry.get('/offers', { params }); // ohne signal (um Race zu vermeiden)
          } else {
            throw _e;
          }
        }

        const t1 = (global?.performance && performance.now) ? performance.now() : Date.now();

        const payload = res?.data ?? {};
        let rows = [];
        if (Array.isArray(payload)) rows = payload;
        else if (Array.isArray(payload.data)) rows = payload.data;
        else if (Array.isArray(payload.offers)) rows = payload.offers;
        else if (Array.isArray(payload.items)) rows = payload.items;
        else if (Array.isArray(payload.results)) rows = payload.results;
        else if (payload?.data && Array.isArray(payload.data.data)) rows = payload.data.data;

        const serverHasMore =
          !!(payload?.hasMore ??
             payload?.data?.hasMore ??
             payload?.pagination?.hasMore ??
             (payload?.nextPage != null) ??
             (rows.length === limit));

        const now = new Date();
        const filtered = [];
        const newlySeenThisRun = [];

        for (const o of rows) {
          if (!matchesInterests(o, interestSet)) continue;
          if (!isOfferActiveNow(o, 'Europe/Vienna', now)) continue;

          const geo = pickOfferLatLng(o);
          const radiusM = pickRadiusMeters(o);
          if (!geo) continue;

          // Wenn loc fehlt → nicht wegfiltern, sondern zeigen (Distance bleibt leer)
          const distanceM =
            toNumber(o.distance) ?? (loc && geo ? haversineMeters(loc.lat, loc.lng, geo.lat, geo.lng) : null);

          const effectiveRadiusM = Number.isFinite(radiusM) ? radiusM : FALLBACK_NEARBY_RADIUS_M;
          const inside = loc ? (Number(distanceM) <= effectiveRadiusM) : true;
          if (inside) {
            filtered.push(o);

            if (expoToken && postsThisReload < 1 && loc) {
              const id = String(o._id || '');
              const seenSet = seenIdsRef.current;
              const isNew = id && !seenSet.has(id);

              if (isNew) {
                seenSet.add(id);
                newlySeenThisRun.push(id);

                api.post('/location/geofence-enter', {
                  offerId: o._id,
                  lat: loc.lat,
                  lng: loc.lng,
                  token: expoToken,
                  platform: Platform.OS === 'ios' ? 'ios' : 'android',
                  eventType: 'enter',
                  channelId: 'offers',
                }).catch(() => {});

                postsThisReload += 1;
              }
            }
          }
        }

        filtered.sort((a, b) => {
          if (!loc) return 0; // ohne Position Reihenfolge vom Server lassen
          const pa = pickOfferLatLng(a);
          const pb = pickOfferLatLng(b);
          const da = toNumber(a.distance) ?? (pa ? haversineMeters(loc.lat, loc.lng, pa.lat, pa.lng) : Infinity);
          const db = toNumber(b.distance) ?? (pb ? haversineMeters(loc.lat, loc.lng, pb.lat, pb.lng) : Infinity);
          return da - db;
        });

        if (!mountedRef.current) return;
        setLastUpdated(new Date());
        setHasMore(serverHasMore);
        setPage(pageToLoad);

        if (pageToLoad === 1) {
          setOffers(() => {
            setGrouped(groupByCategory(filtered));
            return filtered;
          });
        } else {
          setOffers(prev => {
            const merged = [...prev, ...filtered];
            setGrouped(groupByCategory(merged));
            return merged;
          });
        }

        if (!hasLoadedOnce) setHasLoadedOnce(true);

        console.log(`[HomeTab] GET /offers p=${pageToLoad} n=${rows.length} kept=${filtered.length} hasMore=${serverHasMore} net=${(t1 - t0).toFixed(0)}ms loc=${loc ? 'yes' : 'no'}`);
        if (newlySeenThisRun.length > 0) { await saveSeenIds(); }
      } catch (_e) {
        if (mountedRef.current) {
          const isTimeout = String(_e?.message || '').toLowerCase().includes('timeout');
          const msg = isTimeout
            ? 'Netzwerk langsam – erneut versuchen.'
            : 'Fehler beim Laden der Angebote.';
          setError(msg);
          console.warn('[HomeTab] fetch error:', _e?.message || _e);
        }
      } finally {
        inFlightRef.current = false;
        if (!mountedRef.current) return;
        if (mode === 'initial' && !hasLoadedOnce) setInitialLoading(false);
        if (mode === 'pull') setRefreshing(false);
        if (mode === 'more') setLoadingMore(false);
      }
    },
    [limit, interestsCSVFromStorage, getLocation, hasLoadedOnce, loadSeenIds, saveSeenIds]
  );

  useEffect(() => { fetchFnRef.current = fetchPage; }, [fetchPage]);

  // Initial load
  useEffect(() => {
    mountedRef.current = true;
    fetchFnRef.current?.({ pageToLoad: 1, mode: 'initial' });

    // Nach dem ersten Render aktiv einen Foreground-Sync durchführen
    InteractionManager.runAfterInteractions(async () => {
      try {
        await sendHeartbeat();
      } catch {}
      try {
        await refreshGeofencesAroundUser(true);
      } catch {}
      fetchFnRef.current?.({ pageToLoad: 1, mode: 'auto' });
      lastFgSyncAtRef.current = Date.now();
    });

    const refreshTimer = refreshTimerRef.current;
    const heartbeatTimer = heartbeatTimerRef.current;
    return () => {
      mountedRef.current = false;
      if (abortRef.current) try { abortRef.current.abort(); } catch {}
      if (refreshTimer) clearInterval(refreshTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    };
  }, []);

  // Garantierter Foreground-Sync (Heartbeat -> Geofence -> Offers) mit Dedupe
  const foregroundSync = useCallback(async (reason = 'focus') => {
    const now = Date.now();
    if (fgSyncInFlightRef.current) return;
    if (now - (lastFgSyncAtRef.current || 0) < FG_REFRESH_MIN_GAP_MS) return;

    fgSyncInFlightRef.current = true;
    try {
      console.log(`[FOREGROUND_SYNC] start reason=${reason}`);
      try { await sendHeartbeat(); } catch {}
      try { await refreshGeofencesAroundUser(true); } catch {}
      await fetchFnRef.current?.({ pageToLoad: 1, mode: reason });
      lastFgSyncAtRef.current = Date.now();
      console.log('[FOREGROUND_SYNC] done');
    } finally {
      fgSyncInFlightRef.current = false;
    }
  }, []);

  const onRefresh = useCallback(() => {
    fetchFnRef.current?.({ pageToLoad: 1, mode: 'pull' });
  }, []);

  // AppState -> active: Foreground-Sync
  useEffect(() => {
    const handleAppState = async (next) => {
      const prev = appState.current;
      appState.current = next;
      if (prev?.match(/inactive|background/) && next === 'active') {
        await foregroundSync('appstate');
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);

    // Auto-Refresh alle 3 Min
    refreshTimerRef.current = setInterval(() => {
      fetchFnRef.current?.({ pageToLoad: 1, mode: 'auto' });
    }, 180000);

    const refreshTimer = refreshTimerRef.current;
    const heartbeatTimer = heartbeatTimerRef.current;
    return () => {
      sub.remove();
      if (refreshTimer) clearInterval(refreshTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    };
  }, [foregroundSync]);

  // Screen-Focus -> Foreground-Sync (z. B. beim Tab-Wechsel)
  useFocusEffect(
    useCallback(() => {
      foregroundSync('focus');
      return () => {};
    }, [foregroundSync])
  );

  /* UI */


  const [fgNotice, setFgNotice] = useState('');

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('offers:foreground-signal', (payload) => {
      const title = String(payload?.title || 'Neues Angebot in deiner Naehe');
      setFgNotice(title);
      fetchFnRef.current?.({ pageToLoad: 1, mode: 'push' });
      if (fgNoticeTimerRef.current) clearTimeout(fgNoticeTimerRef.current);
      fgNoticeTimerRef.current = setTimeout(() => setFgNotice(''), 2600);
    });
    return () => {
      try { sub?.remove?.(); } catch {}
      if (fgNoticeTimerRef.current) clearTimeout(fgNoticeTimerRef.current);
    };
  }, []);

  if (!hasLoadedOnce && initialLoading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: t.colors.surface }}>
        <View style={[styles.container, { backgroundColor: t.colors.surface }]}>
          <ScrollView contentContainerStyle={styles.categoryContainer}>
            <SkeletonSection titleWidth={140} />
            <SkeletonSection titleWidth={120} />
            <SkeletonSection titleWidth={160} />
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  if (err && !hasLoadedOnce) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: t.colors.surface }}>
        <View style={[styles.containerCenter, { backgroundColor: t.colors.surface }]}>
          <Text style={[styles.error, { color: t.colors.danger }]}>{err}</Text>
          <View style={{ marginTop: 16, width: 220, alignItems: 'center' }}>
            <Button
              title="Erneut versuchen"
              variant="primary"
              size="md"
              onPress={() => fetchFnRef.current?.({ pageToLoad: 1, mode: 'pull' })}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const groupedEntries = Object.entries(grouped);
  const offersCount = groupedEntries.reduce((sum, [, catOffers]) => sum + (Array.isArray(catOffers) ? catOffers.length : 0), 0);
  const nearestDistance = (() => {
    if (!userLoc || offersCount === 0) return null;
    let best = Infinity;
    for (const [, catOffers] of groupedEntries) {
      for (const offer of catOffers) {
        const geo = pickOfferLatLng(offer);
        if (!geo) continue;
        const d = toNumber(offer?.distance) ?? haversineMeters(userLoc.lat, userLoc.lng, geo.lat, geo.lng);
        if (Number.isFinite(d) && d < best) best = d;
      }
    }
    return Number.isFinite(best) ? best : null;
  })();
  const heroTitle = offersCount > 0 ? `${offersCount} aktive Angebote fuer deinen Tag` : 'Neue Wege warten schon auf dich';
  const heroSubtitle = nearestDistance != null
    ? `Das naechste Angebot ist nur ${Math.round(nearestDistance)} m entfernt. Starte entspannt und sammle Schritte mit Sinn.`
    : 'Sobald in deiner Umgebung etwas Spannendes aktiv ist, findest du es hier sofort.';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: t.colors.surface }}>
      <View style={[styles.container, { backgroundColor: t.colors.surface }]}>
        <ScrollView
          contentContainerStyle={styles.categoryContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={[styles.heroCard, { backgroundColor: '#0f3a8a', borderColor: 'rgba(255,255,255,0.2)' }]}>
            <View style={styles.heroGlowA} />
            <View style={styles.heroGlowB} />
            <View style={styles.heroTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroEyebrow, { color: 'rgba(255,255,255,0.76)' }]}>Heute fuer dich</Text>
                <Text style={[styles.heroTitle, { color: '#ffffff' }]}>{heroTitle}</Text>
                <Text style={[styles.heroSubtitle, { color: 'rgba(255,255,255,0.92)' }]}>{heroSubtitle}</Text>
              </View>
              <Badge label="Live" tone="success" />
            </View>
            <View style={styles.heroActionRow}>
              <View style={{ flex: 1 }}>
                <Button title="Zur Karte" variant="secondary" size="sm" onPress={() => router.push('/(tabs)/NavigationMap')} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Interessen" variant="secondary" size="sm" onPress={() => router.push('/(onboarding)/InterestsScreen')} />
              </View>
            </View>
          </View>

          {fgNotice ? (
            <View style={[styles.inlineNotice, { backgroundColor: t.colors.card, borderColor: t.colors.divider }]}>
              <Text style={[styles.inlineNoticeText, { color: t.colors.ink }]}>{fgNotice}</Text>
            </View>
          ) : null}

          {lastUpdated && (
            <Text style={[styles.updatedHint, { color: t.colors.inkLow }]}>
              Letztes Update: {formatRelative(lastUpdated)}
            </Text>
          )}

          {offersCount > 0 ? (
            <View style={[styles.feedSummaryCard, { backgroundColor: t.colors.card, borderColor: t.colors.divider }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.feedSummaryTitle, { color: t.colors.inkHigh }]}>
                  Dein naechstes Angebot wartet
                </Text>
                <Text style={[styles.feedSummarySub, { color: t.colors.inkLow }]}>
                  {nearestDistance != null ? `Dein naechstes Angebot ist nur ${Math.round(nearestDistance)} m entfernt.` : 'Waehle unten ein Angebot und starte direkt mit deiner Route zu Fuss.'}
                </Text>
              </View>
              <View style={{ width: 120 }}>
                <Button title="Route starten" variant="primary" size="sm" onPress={() => router.push('/(tabs)/NavigationMap')} />
              </View>
            </View>
          ) : null}

          {groupedEntries.length === 0 ? (
            <EmptyState
              title="Keine Angebote in deiner Nähe"
              subtitle="Passe deine Interessen an oder versuche es später erneut."
              icon="📍"
            />
          ) : (
            groupedEntries.map(([category, catOffers]) => (
              <View key={category} style={styles.categoryBlock}>
                <Text style={[styles.categoryTitle, { color: t.colors.inkHigh }]}>{category}</Text>
                <FlatList
                  data={catOffers}
                  keyExtractor={(it) => it._id}
                  renderItem={({ item, index }) => (
                    <AnimatedOfferCard
                      item={item}
                      index={index}
                      userLoc={userLoc}
                      theme={t}
                      onPress={() => {
                        try {
                          const geo = pickOfferLatLng(item);
                          const distanceMeters =
                            toNumber(item.distance) ??
                            (userLoc && geo ? haversineMeters(userLoc.lat, userLoc.lng, geo.lat, geo.lng) : null);
                          const heroImage = (Array.isArray(item.images) && item.images.length > 0) ? item.images[0] : '';
                          router.push({
                            pathname: '/(tabs)/offers/[id]',
                            params: {
                              id: item._id,
                              name: item.name || '',
                              image: heroImage || '',
                              distance: distanceMeters != null ? String(Math.round(distanceMeters)) : '',
                            },
                          });
                        } catch {
                          router.push({ pathname: '/(tabs)/offers/[id]', params: { id: item._id } });
                        }
                      }}
                      onNavigate={() => {
                        if (!item?._id) return;
                        router.push({ pathname: '/(tabs)/NavigationScreen', params: { id: item._id } });
                      }}
                    />
                  )}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  style={{ marginBottom: 24 }}
                />
              </View>
            ))
          )}

          {hasMore && (
            <View style={{ alignItems: 'center', marginTop: 4 }}>
              {loadingMore ? (
                <ActivityIndicator size="small" color={t.colors.primary} />
              ) : (
                <View style={{ width: 180 }}>
                  <Button
                    title="Mehr laden"
                    variant="secondary"
                    size="md"
                    onPress={() => fetchFnRef.current?.({ pageToLoad: page + 1, mode: 'more' })}
                  />
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

/* ───────────── Card (Badges ÜBER dem Hero, WOW: Fade-In & Press-Scale) ───────────── */

function AnimatedOfferCard({ item, index, onPress, onNavigate, userLoc, theme }) {
  const themeFromHook = useTheme();
  const t = theme || themeFromHook;

  // Enter animation
  const enterOpacity = useRef(new Animated.Value(0)).current;
  const enterTranslateY = useRef(new Animated.Value(6)).current;

  // Press scale
  const pressScale = useRef(new Animated.Value(1)).current;

  // Hero fade-in
  const heroOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = Math.min(index * 50, 250);
    Animated.parallel([
      Animated.timing(enterOpacity, { toValue: 1, duration: 220, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(enterTranslateY, { toValue: 0, duration: 220, delay, useNativeDriver: true }),
    ]).start();
  }, [index, enterOpacity, enterTranslateY]);

  const onPressIn = () => {
    Animated.spring(pressScale, { toValue: 0.98, useNativeDriver: true, friction: 6, tension: 120 }).start();
  };
  const onPressOut = () => {
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 120 }).start();
  };

  // Distanz berechnen
  let distanceMeters = toNumber(item.distance);
  if (distanceMeters == null && userLoc && item?.location?.coordinates?.length === 2) {
    const [lng, lat] = item.location.coordinates;
    distanceMeters = haversineMeters(userLoc.lat, userLoc.lng, lat, lng);
  }

  // Zeit-Infos
  const isActiveNowFlag = isOfferActiveNow(item, 'Europe/Vienna', new Date());
  const remainingMs = getRemainingMs(item);
  const remainingNice = formatRemainingFriendly(remainingMs);
  const etaNice = etaFromDistanceM(distanceMeters);

  // Bild (Hero)
  const hero = Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : null;

  // Description
  const desc = typeof item.description === 'string' ? item.description : '';

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: enterOpacity,
          transform: [{ translateY: enterTranslateY }, { scale: pressScale }],
          backgroundColor: t.colors.card,
          shadowOpacity: t.mode === 'dark' ? 0.25 : 0.08,
        },
      ]}
    >
      <View style={styles.cardInner}>
        <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress}>
          {/* BADGE-ROW (oben, außerhalb des Bildes) */}
          <View style={styles.badgeRowTop}>
            {isActiveNowFlag && <Badge label="Jetzt gültig" tone="info" style={[styles.badgeSpacing, styles.badgeUniform]} />}
            {remainingNice && <Badge label={remainingNice} tone="warning" style={[styles.badgeSpacing, styles.badgeUniform]} />}
            <DistanceBadge meters={distanceMeters} style={[styles.badgeSpacing, styles.badgeUniform]} />
          </View>

          {/* HERO */}
          <View style={styles.heroWrap}>
            {hero ? (
              <Animated.Image
                source={{ uri: hero }}
                style={[styles.heroImage, { opacity: heroOpacity }]}
                onLoad={() => {
                  Animated.timing(heroOpacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
                }}
                onError={() => {
                  heroOpacity.setValue(1);
                }}
              />
            ) : (
              <View style={[styles.heroImage, { backgroundColor: t.colors.elevated, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: t.colors.inkLow, fontSize: 12 }}>Kein Bild</Text>
              </View>
            )}
          </View>

          {/* Textbereich */}
          <View>
            <Text style={[styles.title, { color: t.colors.primary }]} numberOfLines={2}>
              {item.name}
            </Text>

            {!!item.category && (
              <Text style={[styles.meta, { color: t.colors.inkLow }]} numberOfLines={1}>
                {item.subcategory ? `${item.category} · ${item.subcategory}` : item.category}
              </Text>
            )}

            {!!desc && (
              <Text style={[styles.desc, { color: t.colors.ink }]} numberOfLines={3}>
                {desc}
              </Text>
            )}

            {!!etaNice && (
              <Text style={[styles.quickBenefit, { color: t.colors.success }]}>
                Schnell erreichbar: {etaNice}
              </Text>
            )}
          </View>

        </Pressable>

        {/* CTA */}
        <View style={styles.ctaRow}>
          <View style={styles.ctaSplit}>
            <Button title="Jetzt Angebot ansehen" variant="secondary" size="sm" onPress={onPress} />
          </View>
          <View style={styles.ctaSplit}>
            <Button title="Bring mich hin" variant="primary" size="sm" onPress={onNavigate} />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

/* ───────────── Skeletons & Styles ───────────── */

function SkeletonCard() {
  return (
    <View style={[styles.card, { overflow: 'hidden' }]}>
      <View style={[styles.skel, { width: 90, height: 28, marginBottom: 8, borderRadius: 14 }]} />
      <View style={[styles.skel, { width: 120, height: 28, marginBottom: 8, borderRadius: 14 }]} />
      <View style={[styles.skel, { width: '100%', height: HERO_HEIGHT, borderRadius: 12, marginBottom: 12 }]} />
      <View style={[styles.skel, { width: 160, height: 16, marginBottom: 6 }]} />
      <View style={[styles.skel, { width: 220, height: 12, marginBottom: 8 }]} />
      <View style={[styles.skel, { width: 200, height: 12 }]} />
    </View>
  );
}

function SkeletonSection({ titleWidth = 140 }) {
  return (
    <View style={styles.categoryBlock}>
      <View style={[styles.skel, { width: titleWidth, height: 20, marginBottom: 12 }]} />
      <FlatList
        data={[1, 2, 3, 4]}
        keyExtractor={(i) => `skel-${i}`}
        renderItem={() => <SkeletonCard />}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
        style={{ marginBottom: 24 }}
      />
    </View>
  );
}

const CARD_WIDTH = 260;
const CARD_MIN_HEIGHT = 300;
const HERO_HEIGHT = 136;

const styles = StyleSheet.create({
  container: { flex: 1 },
  categoryContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  containerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroCard: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroGlowA: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -45,
    top: -60,
    backgroundColor: 'rgba(99,179,237,0.30)',
  },
  heroGlowB: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    left: -30,
    bottom: -70,
    backgroundColor: 'rgba(236,72,153,0.22)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  heroActionRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },

  categoryBlock: { marginBottom: 16 },
  categoryTitle: { fontSize: 22, fontWeight: '900', marginBottom: 10 },

  horizontalList: { paddingLeft: 2, paddingRight: 2 },

  updatedHint: { fontSize: 12, marginBottom: 8 },

  card: {
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    width: CARD_WIDTH,
    minHeight: CARD_MIN_HEIGHT,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },

  cardInner: {
    flex: 1,
    justifyContent: 'space-between',
  },

  // Badges oben, außerhalb des Bildes – alle gleich groß
  badgeRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  badgeSpacing: { marginRight: 6, marginBottom: 6 },
  badgeUniform: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    minHeight: 28,
    alignSelf: 'flex-start',
  },

  heroWrap: { marginBottom: 12 },
  heroImage: {
    width: '100%',
    height: HERO_HEIGHT,
    borderRadius: 12,
    backgroundColor: '#eee',
  },

  title: { fontSize: 18, fontWeight: '900', marginBottom: 4, lineHeight: 22 },
  meta: { fontSize: 12, marginBottom: 6 },
  desc: { fontSize: 14, lineHeight: 20 },
  quickBenefit: { fontSize: 12, fontWeight: '700', marginTop: 8 },

  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  ctaSplit: { flex: 1 },
  feedSummaryCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  feedSummaryTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  feedSummarySub: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 18,
  },

  skel: { backgroundColor: '#e9eef5', borderRadius: 8 },

  error: { marginTop: 30, textAlign: 'center' },
  inlineNotice: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
  },
  inlineNoticeText: { fontSize: 13, fontWeight: '600' },
});









