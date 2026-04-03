// stepsmatch/mobile/utils/isOfferActiveNow.ts

/**
 * Prüft, ob ein Offer JETZT aktiv ist – streng in der IANA-TZ (default: Europe/Vienna).
 *
 * Unterstützte Felder:
 *  - Wochentage: offer.validDays | offer.weekdays
 *      Werte: ["Montag","Di","Wednesday","Thu", 0..6]  (Mo=0 … So=6)
 *      Optional: als kommaseparierter String "Mo,Di,Fr"
 *  - Zeitfenster: offer.validTimes | offer.times
 *      a) Objekt: { from|start|fromTime : "HH:mm", to|end|toTime : "HH:mm" }
 *      b) Array  : [{from:"10:00",to:"14:00"},{from:"17:00",to:"21:00"}]
 *      Nachtfenster (z. B. 22:00–02:00) wird korrekt gehandhabt.
 *  - Datumsfenster: offer.validDates = { from|start, to|end } ODER { date|on }
 *      Fallbacks am Root: offer.validOn | offer.date
 *      Vergleich immer als LOKALER Kalendertag in der angegebenen TZ (inklusive Grenzen).
 *
 * Zusätzliche Kurzschlüsse (optional, falls vorhanden):
 *  - offer.active === false → inaktiv
 *  - offer.disabled === true → inaktiv
 *  - offer.status === 'archived' | 'inactive' | 'disabled' → inaktiv
 *
 * @param {object} offer
 * @param {string} timeZone  IANA TZ, default 'Europe/Vienna'
 * @param {Date}   now       Referenzzeit (optional)
 * @return {boolean}
 */
export function isOfferActiveNow(offer: any, timeZone: string = 'Europe/Vienna', now: Date = new Date()): boolean {
  if (!offer || typeof offer !== 'object') return false;

  // optionale Kurzschlüsse
  if (offer.active === false) return false;
  if (offer.disabled === true) return false;
  if (typeof offer.status === 'string') {
    const s = offer.status.toLowerCase();
    if (s === 'archived' || s === 'inactive' || s === 'disabled') return false;
  }

  // ───────────────────────── helpers: Wochentage / Zeit / Datum ─────────────────────────
  const WEEKDAY_MAP: Record<string, number> = {
    // de lang/kurz
    montag: 0, mo: 0,
    dienstag: 1, di: 1,
    mittwoch: 2, mi: 2,
    donnerstag: 3, do: 3,
    freitag: 4, fr: 4,
    samstag: 5, sa: 5,
    sonntag: 6, so: 6,
    // en lang/kurz
    monday: 0, mon: 0,
    tuesday: 1, tue: 1, tues: 1,
    wednesday: 2, wed: 2,
    thursday: 3, thu: 3, thur: 3, thurs: 3,
    friday: 4, fri: 4,
    saturday: 5, sat: 5,
    sunday: 6, sun: 6,
    // numerische strings (Mo=0 … So=6)
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
  };

  const normalizeWeekday = (x: any): number | null => {
    if (typeof x === 'number' && Number.isInteger(x)) {
      if (x >= 0 && x <= 6) return x;
      if (x >= 1 && x <= 7) return x - 1; // legacy mapping Mo=1..So=7
    }
    const n = Number(x);
    if (Number.isFinite(n) && Number.isInteger(n)) {
      if (n >= 0 && n <= 6) return n;
      if (n >= 1 && n <= 7) return n - 1;
    }
    const s = String(x || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(WEEKDAY_MAP, s) ? WEEKDAY_MAP[s] : null;
  };

  const getLocalNowParts = (d: Date) => {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(d);
      const mp: Record<string,string> = Object.fromEntries(parts.map((p) => [p.type, p.value]));
      const wd = normalizeWeekday(mp.weekday);
      const hh = Number(mp.hour ?? 0);
      const mm = Number(mp.minute ?? 0);
      const minutes = Number.isFinite(hh) && Number.isFinite(mm) ? hh * 60 + mm : 0;
      return { weekdayIdx: wd, minutes };
    } catch {
      const jsDay = (d.getDay?.() ?? 0); // JS: 0=So … 6=Sa
      const weekdayIdx = (jsDay + 6) % 7; // wir wollen 0=Mo … 6=So
      const hh = d.getHours?.() ?? 0;
      const mm = d.getMinutes?.() ?? 0;
      return { weekdayIdx, minutes: hh * 60 + mm };
    }
  };

  const parseHHMM = (s: any): number | null => {
    if (s == null) return null;
    const m = String(s).trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = Number(m[1]), mi = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(mi)) return null;
    if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
    return h * 60 + mi;
  };

  const getYMD = (x: any): { y: number; m: number; d: number } | null => {
    if (!x) return null;
    if (typeof x === 'string') {
      const m = x.trim().match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
      if (m) {
        const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
        if ([y, mo, d].every(Number.isFinite)) return { y, m: mo, d };
      }
    }
    const d = x instanceof Date ? x : new Date(x);
    if (isNaN(d.getTime())) return null;
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(d);
      const mp: Record<string,string> = Object.fromEntries(parts.map((p) => [p.type, p.value]));
      return { y: Number(mp.year), m: Number(mp.month), d: Number(mp.day) };
    } catch {
      return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
    }
  };

  const cmpYMD = (a: {y:number;m:number;d:number}, b: {y:number;m:number;d:number}) =>
    (a.y - b.y) || (a.m - b.m) || (a.d - b.d);

  // ───────────────────────── 1) Wochentage ─────────────────────────
  const { weekdayIdx, minutes } = getLocalNowParts(now);

  let dayListSource: any =
    (Array.isArray(offer.validDays) && offer.validDays.length > 0)
      ? offer.validDays
      : (Array.isArray(offer.weekdays) ? offer.weekdays : []);

  // Optional: CSV-String "Mo,Di,Fr"
  if (!dayListSource || dayListSource.length === 0) {
    if (typeof offer.validDays === 'string') {
      dayListSource = offer.validDays.split(',').map((s: string) => s.trim()).filter(Boolean);
    } else if (typeof offer.weekdays === 'string') {
      dayListSource = offer.weekdays.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
  }

  if (Array.isArray(dayListSource) && dayListSource.length > 0) {
    const allowed = dayListSource
      .map((v: any) => normalizeWeekday(v))
      .filter((v: any) => v != null) as number[];
    if (allowed.length > 0 && (weekdayIdx == null || !allowed.includes(weekdayIdx))) {
      return false;
    }
  }

  // ───────────────────────── 2) Zeitfenster (inkl. Nachtfenster) ─────────────────────────
  const vtRaw: any =
    (offer.validTimes && typeof offer.validTimes === 'object')
      ? offer.validTimes
      : (offer.times && typeof offer.times === 'object' ? offer.times : null);

  const timeWindows: any[] = [];
  if (Array.isArray(vtRaw)) {
    for (const w of vtRaw) timeWindows.push(w);
  } else if (vtRaw) {
    timeWindows.push(vtRaw);
  }

  const inAnyWindow = (windows: any[]): boolean => {
    if (!windows || windows.length === 0) return true; // keine Zeiten → ganztägig
    for (const vt of windows) {
      const fromMin =
        parseHHMM(vt.from) ??
        parseHHMM(vt.start) ??
        parseHHMM(vt.fromTime) ??
        null;

      const toMin =
        parseHHMM(vt.to) ??
        parseHHMM(vt.end) ??
        parseHHMM(vt.toTime) ??
        null;

      if (fromMin == null && toMin == null) {
        // ungültiges Fenster → ignoriere
        continue;
      }

      const sMin = fromMin ?? 0;            // default 00:00
      const eMin = toMin ?? 23 * 60 + 59;   // default 23:59

      if (sMin === eMin) {
        // 00:00–00:00 → ganztägig
        return true;
      }
      if (sMin < eMin) {
        if (minutes >= sMin && minutes <= eMin) return true;
      } else {
        // über Mitternacht (z. B. 22:00–02:00)
        if (minutes >= sMin || minutes <= eMin) return true;
      }
    }
    return false;
  };

  if (!inAnyWindow(timeWindows)) return false;

  // ───────────────────────── 3) Datumsfenster (inkl. Einzeltag) ─────────────────────────
  const vd: any = (offer.validDates && typeof offer.validDates === 'object') ? offer.validDates : {};
  const single: any = vd.date ?? vd.on ?? offer.validOn ?? offer.date;

  const fromRaw = vd.from ?? vd.start ?? single ?? null;
  const toRaw   = vd.to   ?? vd.end   ?? single ?? null;

  if (fromRaw || toRaw) {
    const nowYMD  = getYMD(now)!;
    const fromYMD = getYMD(fromRaw);
    const toYMD   = getYMD(toRaw);
    if (fromYMD && cmpYMD(nowYMD, fromYMD) < 0) return false;
    if (toYMD   && cmpYMD(nowYMD, toYMD)   > 0) return false;
  }

  return true;
}

/**
 * Testet einen beliebigen Zeitpunkt (TZ-bewusst).
 * @param {object} offer
 * @param {Date|string|number} when
 * @param {string} timeZone
 */
export function isOfferActiveAt(offer: any, when: Date | string | number, timeZone: string = 'Europe/Vienna') {
  return isOfferActiveNow(offer, timeZone, when instanceof Date ? when : new Date(when));
}

export default isOfferActiveNow;
