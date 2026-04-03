// stepsmatch/mobile/components/push/service-control.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVICE_STATE_KEY = 'bg.service.state.v1';
const STOP_UNTIL_RESTART_KEY = 'bg.service.stop_until_restart.v1';
const CACHE_TTL_MS = 5000;

type ServiceState = {
  enabled: boolean;
  pausedUntil: number;
  updatedAt: number;
  reason?: string;
};

const DEFAULT_STATE: ServiceState = {
  enabled: true,
  pausedUntil: 0,
  updatedAt: 0,
};

let CACHE: { state: ServiceState; ts: number } | null = null;

function normalizeState(s: any): ServiceState {
  const enabled = s?.enabled !== false;
  const pausedUntil = Number(s?.pausedUntil || 0);
  const updatedAt = Number(s?.updatedAt || 0);
  const reason = typeof s?.reason === 'string' ? s.reason : undefined;
  return { enabled, pausedUntil, updatedAt, reason };
}

export async function getServiceState(): Promise<ServiceState> {
  const now = Date.now();
  if (CACHE && now - CACHE.ts < CACHE_TTL_MS) return CACHE.state;
  try {
    const raw = await AsyncStorage.getItem(SERVICE_STATE_KEY);
    const state = raw ? normalizeState(JSON.parse(raw)) : { ...DEFAULT_STATE };
    CACHE = { state, ts: now };
    return state;
  } catch {
    const state = { ...DEFAULT_STATE };
    CACHE = { state, ts: now };
    return state;
  }
}

export async function setServiceState(patch: Partial<ServiceState>): Promise<ServiceState> {
  const prev = await getServiceState();
  const next: ServiceState = {
    ...prev,
    ...patch,
    updatedAt: Date.now(),
  };
  try { await AsyncStorage.setItem(SERVICE_STATE_KEY, JSON.stringify(next)); } catch {}
  CACHE = { state: next, ts: Date.now() };
  return next;
}

export function isPaused(state: ServiceState, now = Date.now()): boolean {
  return Number(state?.pausedUntil || 0) > now;
}

export function isServiceActive(state: ServiceState, now = Date.now()): boolean {
  return !!state?.enabled && !isPaused(state, now);
}

export async function isServiceActiveNow(): Promise<boolean> {
  try {
    const hardStopped = await AsyncStorage.getItem(STOP_UNTIL_RESTART_KEY);
    if (hardStopped === '1') return false;
  } catch {}

  const st = await getServiceState();
  const now = Date.now();
  if (st.pausedUntil && st.pausedUntil <= now) {
    await setServiceState({ pausedUntil: 0 });
    return st.enabled !== false;
  }
  return isServiceActive(st, now);
}

export async function setServiceEnabled(enabled: boolean, reason?: string) {
  return setServiceState({ enabled: !!enabled, pausedUntil: 0, reason });
}

export async function pauseUntil(ts: number, reason?: string) {
  const until = Math.max(0, Number(ts || 0));
  return setServiceState({ enabled: true, pausedUntil: until, reason });
}

export async function pauseForMs(ms: number, reason?: string) {
  const until = Date.now() + Math.max(0, Number(ms || 0));
  return pauseUntil(until, reason);
}

export async function resumeService(reason?: string) {
  return setServiceState({ enabled: true, pausedUntil: 0, reason });
}

export async function setStopUntilRestart(enabled: boolean) {
  try {
    if (enabled) await AsyncStorage.setItem(STOP_UNTIL_RESTART_KEY, '1');
    else await AsyncStorage.removeItem(STOP_UNTIL_RESTART_KEY);
  } catch {}
}

export async function clearStopUntilRestart() {
  return setStopUntilRestart(false);
}

export async function isStoppedUntilRestartNow(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STOP_UNTIL_RESTART_KEY)) === '1';
  } catch {
    return false;
  }
}
