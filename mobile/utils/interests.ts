// stepsmatch/mobile/utils/interests.ts

// ————————————————————————————————————————————————
// Normalisierung & Tokenisierung
// ————————————————————————————————————————————————
export const normalizeToken = (s: any): string =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')                         // decompose diacritics
    .replace(/[\u0300-\u036f]/g, '')          // strip accents
    .replace(/ß/g, 'ss')                      // german sharp s
    .replace(/[&@/+\\]/g, ' ')                // common joiners → space
    .replace(/[_\-]+/g, ' ')                  // hyphen/underscore collapse
    .replace(/\s+/g, ' ')                     // whitespace collapse
    .trim();

const splitMulti = (s: string): string[] =>
  String(s ?? '')
    .split(/[,\n;|]/)                          // accept comma, newline, semicolon, pipe
    .map((x) => normalizeToken(x))
    .filter(Boolean);

// ————————————————————————————————————————————————
// CSV → Set
// ————————————————————————————————————————————————
export function csvToSet(csv?: string | string[] | null): Set<string> {
  if (!csv) return new Set();
  const parts = Array.isArray(csv) ? csv.flatMap(splitMulti) : splitMulti(csv);
  return new Set(parts);
}

// ————————————————————————————————————————————————
// Matching-Logik
// Felder: category, subcategory, name, title, provider.name, tags/labels/keywords[]
// - exakte Token-Matches
// - Phrasen-/Substring-Matches ab Länge ≥ 3
// ————————————————————————————————————————————————
function collectSearchValues(offer: any): string[] {
  if (!offer || typeof offer !== 'object') return [];
  const arr: any[] = [
    offer.category,
    offer.subcategory,
    offer.name,
    offer.title,
    offer?.provider?.name,
  ];

  const pushArrayish = (v: any) => {
    if (!v) return;
    if (Array.isArray(v)) arr.push(...v);
    else if (typeof v === 'string') arr.push(...splitMulti(v));
  };

  pushArrayish(offer.tags);
  pushArrayish(offer.labels);
  pushArrayish(offer.keywords);

  return arr.filter((x) => x != null);
}

function buildHaystack(values: string[]): { phrase: string; tokens: Set<string> } {
  const normValues = values.map((v) => normalizeToken(v)).filter(Boolean);
  const phrase = ` ${normValues.join(' ')} `;
  const tokens = new Set<string>(phrase.trim().split(/\s+/).filter(Boolean));
  return { phrase, tokens };
}

export function matchesInterests(
  offer: any,
  interestSet?: Set<string> | null
): boolean {
  if (!interestSet || interestSet.size === 0) return true;

  const values = collectSearchValues(offer);
  if (values.length === 0) return true; // nichts zum Vergleichen → nicht einschränken

  const { phrase, tokens } = buildHaystack(values);

  for (const raw of interestSet) {
    const q = normalizeToken(raw);
    if (!q) continue;

    // 1) exaktes Token-Match
    if (tokens.has(q)) return true;

    // 2) Prefix/Substring-Match (nur wenn sinnvoll lang, um False-Positives zu vermeiden)
    if (q.length >= 3) {
      // 2a) Phrasen-Suche (z. B. "coffee shop")
      if (phrase.includes(` ${q} `) || phrase.includes(q)) return true;

      // 2b) Token-contains (z. B. "fit" in "fitnessstudio")
      for (const t of tokens) {
        if (t.includes(q)) return true;
      }
    }
  }
  return false;
}
