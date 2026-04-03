// C:\coding\ultreia\frontend\src\api\axios.js
import axios from "axios";
import { API_PROD_FALLBACK, BRAND_NAME } from "../config/brand";

/**
 * Base URL priority:
 * 1) VITE_API_BASE_URL
 * 2) window.__ULTREIA_API__ (legacy fallback: window.__SM_API__)
 * 3) host-aware fallback
 */
const envBase = import.meta?.env?.VITE_API_BASE_URL;
const winBase =
  typeof window !== "undefined"
    ? window.__ULTREIA_API__ || window.__SM_API__
    : undefined;

const buildMode = import.meta?.env?.MODE || "unknown";
const isBuildDev = !!import.meta?.env?.DEV;
const isBuildProd = !!import.meta?.env?.PROD;

const host = typeof window !== "undefined" ? window.location.hostname : "";
const isLocalHost =
  host === "localhost" ||
  host === "127.0.0.1" ||
  host === "::1" ||
  host.endsWith(".local");

const resolved =
  (envBase && String(envBase).trim()) ||
  (winBase && String(winBase).trim()) ||
  "";

let baseURL = resolved;

if (!baseURL && isLocalHost) {
  baseURL = "http://localhost:8080/api";
}

if (!isLocalHost) {
  if (!baseURL) {
    baseURL = API_PROD_FALLBACK;
    console.warn(`[${BRAND_NAME}] Missing VITE_API_BASE_URL on hosted frontend. Using API_PROD_FALLBACK.`);
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1|::1)(:\\d+)?/i.test(baseURL)) {
    baseURL = API_PROD_FALLBACK;
    console.warn(`[${BRAND_NAME}] Hosted frontend resolved localhost API. Overriding to API_PROD_FALLBACK.`);
  }
}

if (!baseURL) {
  throw new Error(`[${BRAND_NAME}] Could not resolve API base URL.`);
}

const axiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

const TESTER_STORAGE_KEY = "ultreia_tester_key";

function readTesterKey() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TESTER_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeTesterKey(value) {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(TESTER_STORAGE_KEY, value);
    else window.localStorage.removeItem(TESTER_STORAGE_KEY);
  } catch {
    // ignore
  }
}

if (typeof window !== "undefined") {
  try {
    const params = new URLSearchParams(window.location.search);
    const testerFromUrl = params.get("tester");
    if (testerFromUrl && testerFromUrl.trim()) writeTesterKey(testerFromUrl.trim());
    if (!readTesterKey() && window.__ULTREIA_TESTER__) writeTesterKey(String(window.__ULTREIA_TESTER__));
    if (!readTesterKey() && window.__SM_TESTER__) writeTesterKey(String(window.__SM_TESTER__));
  } catch {
    // no-op
  }
}

const initialTesterKey = readTesterKey();
if (initialTesterKey) {
  axiosInstance.defaults.headers.common["X-Tester-Key"] = initialTesterKey;
} else {
  delete axiosInstance.defaults.headers.common["X-Tester-Key"];
}

axiosInstance.interceptors.request.use((config) => {
  const tk = readTesterKey();
  if (tk && tk.trim()) {
    config.headers = config.headers ?? {};
    config.headers["X-Tester-Key"] = tk.trim();
  } else if (config.headers && "X-Tester-Key" in config.headers) {
    delete config.headers["X-Tester-Key"];
  }
  return config;
});

if (typeof window !== "undefined") {
  console.log("Axios Base URL:", baseURL);
  console.log("VITE_API_BASE_URL:", envBase);
  console.log("Build Mode:", buildMode, "| DEV:", isBuildDev, "| PROD:", isBuildProd);
  if (!isLocalHost && isBuildDev) {
    console.warn(`[${BRAND_NAME}] Hosted frontend runs in DEV build mode. Check deploy build command (expected: npm run build).`);
  }
}

export default axiosInstance;
