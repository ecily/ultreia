// backend/utils/isOfferActiveNow.js

/**
 * Aktiv jetzt? – strikt im Kalender "Europe/Vienna" (oder über Parameter timeZone).
 * Unterstützt:
 *  - validDays / weekdays: ["Montag","Di","Wednesday","Thu", 0..6, "0".."6", 1..7, "1".."7"]
 *      Mapping intern: Mo=0 … So=6. Werte 1..7 werden auf 0..6 normalisiert (1=>Mo=0, …, 7=>So=6).
 *  - validTimes: { from: "HH:mm", to: "HH:mm" } (akzeptiert auch start/end), inkl. Nachtfenster (22:00–02:00)
 *      Gleichheit from==to wird als "24h offen" interpretiert.
 *  - validDates:
 *      - { from, to } (inklusive, lokale Kalendertage)
 *      - { date } oder { on }  (Einzeltag)
 *    Fallbacks am Root: offer.validOn / offer.date
 */
export function isOfferActiveNow(offer, timeZone = 'Europe/Vienna', now = new Date()) {
  if (!offer || typeof offer !== 'object') return false;

  // Weekday map → 0..6 (Mo..So)
  const WD = new Map([
    ['monday',0],['mon',0],['montag',0],['mo',0],
    ['tuesday',1],['tue',1],['dienstag',1],['di',1],
    ['wednesday',2],['wed',2],['mittwoch',2],['mi',2],
    ['thursday',3],['thu',3],['donnerstag',3],['do',3],
    ['friday',4],['fri',4],['freitag',4],['fr',4],
    ['saturday',5],['sat',5],['samstag',5],['sa',5],
    ['sunday',6],['sun',6],['sonntag',6],['so',6],
  ]);

  const getLocalNowParts = (d) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone, weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(d);
    const mp = Object.fromEntries(parts.map(p => [p.type, p.value]));
    const wdIdx = WD.get(String(mp.weekday || '').toLowerCase());
    const hh = Number(mp.hour ?? 0);
    const mm = Number(mp.minute ?? 0);
    return { weekdayIdx: wdIdx, minutes: hh * 60 + mm };
  };

  const parseHHMM = (s) => {
    if (s == null) return null;
    const m = String(s).trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = +m[1], mi = +m[2];
    if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
    return h * 60 + mi;
  };

  const parseYMDString = (s) => {
    const m = String(s).trim().match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
    return m ? { y:+m[1], m:+m[2], d:+m[3] } : null;
  };

  const getYMD = (x) => {
    if (!x) return null;
    if (typeof x === 'string') {
      const pure = parseYMDString(x);
      if (pure) return pure; // „YYYY-MM-DD“ → direkt als lokaler Kalendertag
    }
    const d = x instanceof Date ? x : new Date(x);
    if (isNaN(d.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone, year:'numeric', month:'2-digit', day:'2-digit'
    }).formatToParts(d);
    const mp = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return { y:+mp.year, m:+mp.month, d:+mp.day };
  };

  const cmpYMD = (a, b) => (a.y-b.y) || (a.m-b.m) || (a.d-b.d);

  // 1) Wochentag (validDays ODER weekdays akzeptieren)
  const { weekdayIdx, minutes } = getLocalNowParts(now);
  const dayList = Array.isArray(offer.validDays) && offer.validDays.length
    ? offer.validDays
    : (Array.isArray(offer.weekdays) ? offer.weekdays : []);

  if (dayList.length > 0) {
    const toIdx = (x) => {
      if (typeof x === 'number' && Number.isInteger(x)) {
        // 0..6 direkt, 1..7 (Mo=1..So=7) auf 0..6 mappen
        if (x >= 0 && x <= 6) return x;
        if (x >= 1 && x <= 7) return (x - 1);
        return null;
      }
      if (typeof x === 'string') {
        const t = x.trim().toLowerCase();
        // numerische Strings erlauben
        if (/^\d+$/.test(t)) {
          const n = Number(t);
          if (n >= 0 && n <= 6) return n;
          if (n >= 1 && n <= 7) return (n - 1);
          return null;
        }
        // Namen/Abkürzungen
        return WD.get(t) ?? null;
      }
      return null;
    };
    const allowed = dayList.map(toIdx).filter(v => v != null);
    if (allowed.length > 0 && (weekdayIdx == null || !allowed.includes(weekdayIdx))) return false;
  }

  // 2) Uhrzeit inkl. Nachtfenster
  const vtRaw = offer.validTimes || offer.times || {};
  const fromStr = vtRaw.from ?? vtRaw.start ?? null;
  const toStr   = vtRaw.to   ?? vtRaw.end   ?? null;

  if (fromStr || toStr) {
    const sMin = parseHHMM(fromStr ?? '00:00');
    const eMin = parseHHMM(toStr   ?? '23:59');
    if (sMin != null && eMin != null) {
      if (sMin === eMin) {
        // 24h offen → immer erlaubt
      } else if (sMin < eMin) {
        if (!(minutes >= sMin && minutes <= eMin)) return false;
      } else {
        // über Mitternacht (z.B. 22:00–02:00)
        if (!(minutes >= sMin || minutes <= eMin)) return false;
      }
    }
  }

  // 3) Datumsfenster inkl. Einzeltag (inklusive Grenzen)
  const vd = (offer.validDates && typeof offer.validDates === 'object') ? offer.validDates : {};
  const single = vd.date ?? vd.on ?? offer.validOn ?? offer.date;
  const fromRaw = vd.from ?? vd.start ?? (single ?? null);
  const toRaw   = vd.to   ?? vd.end   ?? (single ?? null);

  if (fromRaw || toRaw) {
    const nowYMD  = getYMD(now);
    const fromYMD = getYMD(fromRaw);
    const toYMD   = getYMD(toRaw);
    if (fromYMD && cmpYMD(nowYMD, fromYMD) < 0) return false;
    if (toYMD   && cmpYMD(nowYMD, toYMD)   > 0) return false;
  }

  return true;
}
