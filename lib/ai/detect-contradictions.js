'use strict';

/**
 * Cross-source contradiction detection.
 *
 * Takes the same input package the writer sees — museum personData +
 * Wikidata claims + Wikipedia / ODNB / Grace's Guide summaries — and
 * returns a list of facts where two or more sources disagree.
 *
 * v1 scope: STRUCTURED comparison only. Museum personData ↔ Wikidata
 * P-code equivalents for six fact keys (birth/death date, birth/death
 * place, occupation, nationality). Wikipedia / ODNB / Grace's Guide
 * return freetext extracts that require regex or LLM-based extraction
 * to compare mechanically; reserved for a later revision.
 *
 * When a contradiction is found, the priority ladder picks a winner:
 *   museum > oxfordDNB > wikidata > gracesGuide > wikipedia
 * The winner's value goes to the writer as authoritative; the losers
 * are labelled with their source so the writer can spot systematic
 * cataloguing issues without being pressured to "sources disagree" the
 * disagreement in prose.
 *
 * Return shape:
 *
 *   [
 *     {
 *       factKey: 'birthDate',
 *       factLabel: 'Date of birth',
 *       values: [
 *         { source: 'museum',   value: '1879-03-14', sourceDetail: 'personData.birthDate' },
 *         { source: 'wikidata', value: '1879-03-15', sourceDetail: 'wikidata:P569' }
 *       ],
 *       winner: 'museum',
 *       winnerValue: '1879-03-14'
 *     },
 *     …
 *   ]
 *
 * Empty array when no contradictions found.
 */

const SOURCE_PRIORITY = ['museum', 'oxfordDNB', 'wikidata', 'gracesGuide', 'wikipedia'];

// Fact key → { label, museumField, wikidataProp, compare }
//
// `compare(a, b)` returns true when the two values are equivalent under
// this fact's normalisation rules. Missing on either side is handled
// outside the compare function (a missing value is never a contradiction).
const FACT_KEYS = {
  birthDate: {
    label: 'Date of birth',
    museumField: 'birthDate',
    wikidataProp: 'P569',
    compare: compareDates
  },
  deathDate: {
    label: 'Date of death',
    museumField: 'deathDate',
    wikidataProp: 'P570',
    compare: compareDates
  },
  birthPlace: {
    label: 'Place of birth',
    museumField: 'birthPlace',
    wikidataProp: 'P19',
    compare: comparePlaces
  },
  deathPlace: {
    label: 'Place of death',
    museumField: 'deathPlace',
    wikidataProp: 'P20',
    compare: comparePlaces
  },
  occupation: {
    label: 'Occupation',
    museumField: 'occupation',
    wikidataProp: 'P106',
    compare: compareLists
  },
  nationality: {
    label: 'Nationality',
    museumField: 'nationality',
    wikidataProp: 'P27',
    compare: compareLists
  }
};

function detectContradictions (input) {
  input = input || {};
  const personData = input.personData || {};
  const wikidataContext = input.wikidataContext || null;

  const out = [];

  Object.keys(FACT_KEYS).forEach(function (factKey) {
    const spec = FACT_KEYS[factKey];
    const values = collectValues(spec, personData, wikidataContext);
    if (values.length < 2) return;

    // Compare every pair; if ANY pair disagrees, this is a contradiction.
    // Single-value sources with matching normalised forms don't count.
    let disagreement = false;
    for (let i = 0; i < values.length && !disagreement; i += 1) {
      for (let j = i + 1; j < values.length && !disagreement; j += 1) {
        if (!spec.compare(values[i].value, values[j].value)) {
          disagreement = true;
        }
      }
    }
    if (!disagreement) return;

    const winner = pickWinner(values);
    out.push({
      factKey,
      factLabel: spec.label,
      values,
      winner: winner.source,
      winnerValue: winner.value
    });
  });

  return out;
}

function collectValues (spec, personData, wikidataContext) {
  const values = [];

  const museumRaw = personData[spec.museumField];
  if (isNonEmpty(museumRaw)) {
    values.push({
      source: 'museum',
      value: String(museumRaw).trim(),
      sourceDetail: 'personData.' + spec.museumField
    });
  }

  if (wikidataContext) {
    const entry = wikidataContext[spec.wikidataProp];
    const wdValue = extractWikidataValue(entry);
    if (isNonEmpty(wdValue)) {
      values.push({
        source: 'wikidata',
        value: wdValue,
        sourceDetail: 'wikidata:' + spec.wikidataProp
      });
    }
  }

  return values;
}

// Wikidata claim entries carry `value` (comma-joined summary) AND
// `claims[]` (individual claim objects). For list-shaped facts
// (occupation, nationality) we want the summary; for single-valued
// facts we want the same. Both surface as `.value` on the entry.
// Older records / raw string entries also handled.
function extractWikidataValue (entry) {
  if (!entry) return null;
  if (typeof entry === 'string') return entry.trim();
  if (typeof entry.value === 'string' && entry.value.trim()) return entry.value.trim();
  if (Array.isArray(entry.claims) && entry.claims.length) {
    const parts = entry.claims
      .map(function (c) { return c && typeof c.value === 'string' ? c.value.trim() : ''; })
      .filter(Boolean);
    if (parts.length) return parts.join(', ');
  }
  return null;
}

function pickWinner (values) {
  for (let i = 0; i < SOURCE_PRIORITY.length; i += 1) {
    const found = values.find(function (v) { return v.source === SOURCE_PRIORITY[i]; });
    if (found) return found;
  }
  return values[0];
}

// --- Normalisation --------------------------------------------------

function isNonEmpty (v) {
  if (v == null) return false;
  const s = String(v).trim();
  return s.length > 0;
}

// Extract YYYY-MM-DD components from a date string in any of the shapes
// we see: personData ISO ("1879-03-14"), personData year-only ("1879"),
// Wikidata time ("+1879-03-14T00:00:00Z"), or freetext ("14 March 1879").
// Returns { year, month, day } — nulls when a component is missing.
function parseDateParts (raw) {
  if (!raw) return null;
  const s = String(raw).trim();

  // ISO with time: +YYYY-MM-DDTHH:MM:SSZ or YYYY-MM-DDTHH:MM:SSZ
  const iso = s.match(/^[+-]?(\d{3,4})-(\d{2})-(\d{2})(?:T|$)/);
  if (iso) {
    const y = parseInt(iso[1], 10);
    const m = parseInt(iso[2], 10);
    const d = parseInt(iso[3], 10);
    return {
      year: y || null,
      month: m || null,
      day: d || null
    };
  }

  // Year only: 1879 or +1879
  const yearOnly = s.match(/^[+-]?(\d{3,4})$/);
  if (yearOnly) {
    return { year: parseInt(yearOnly[1], 10), month: null, day: null };
  }

  // "14 March 1879" / "March 14, 1879"
  const MONTHS = {
    january: 1,
    jan: 1,
    february: 2,
    feb: 2,
    march: 3,
    mar: 3,
    april: 4,
    apr: 4,
    may: 5,
    june: 6,
    jun: 6,
    july: 7,
    jul: 7,
    august: 8,
    aug: 8,
    september: 9,
    sep: 9,
    sept: 9,
    october: 10,
    oct: 10,
    november: 11,
    nov: 11,
    december: 12,
    dec: 12
  };
  const monthWord = s.toLowerCase().match(/\b([a-z]+)\b/);
  const monthNum = monthWord && MONTHS[monthWord[1]] ? MONTHS[monthWord[1]] : null;
  const yearMatch = s.match(/\b(\d{3,4})\b/);
  const dayMatch = s.match(/\b(\d{1,2})\b/);
  if (yearMatch && monthNum) {
    return {
      year: parseInt(yearMatch[1], 10),
      month: monthNum,
      day: dayMatch ? parseInt(dayMatch[1], 10) : null
    };
  }

  // Unparseable — return null so the compare function treats it as
  // opaque (falls back to raw string comparison for safety).
  return null;
}

function compareDates (a, b) {
  const pa = parseDateParts(a);
  const pb = parseDateParts(b);
  if (!pa || !pb) {
    // Unparseable → compare raw strings (case-insensitive).
    return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  }
  if (pa.year !== pb.year) return false;
  // If either side is year-only, agree on the year.
  if (pa.month == null || pb.month == null) return true;
  if (pa.month !== pb.month) return false;
  if (pa.day == null || pb.day == null) return true;
  return pa.day === pb.day;
}

function normalisePlace (raw) {
  if (!raw) return '';
  return String(raw)
    .toLowerCase()
    .replace(/[,;].*$/, '') // drop everything after the first comma
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function comparePlaces (a, b) {
  const na = normalisePlace(a);
  const nb = normalisePlace(b);
  if (!na || !nb) return na === nb;
  if (na === nb) return true;
  // "Ulm" vs "Ulm, Germany" already handled by the comma-strip. A
  // remaining common case is one side including admin ("City of Ulm")
  // while the other is bare — do a token-set overlap check.
  const ta = new Set(na.split(' '));
  const tb = new Set(nb.split(' '));
  let overlap = 0;
  ta.forEach(function (t) { if (tb.has(t)) overlap += 1; });
  return overlap > 0;
}

function normaliseList (raw) {
  if (!raw) return [];
  return String(raw)
    .toLowerCase()
    .split(/[,;]/)
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
}

// Two lists agree if they share ANY item. Museum "physicist" and
// Wikidata "physicist, theoretical physicist, mathematician" overlap
// on "physicist" → not a contradiction.
function compareLists (a, b) {
  const la = normaliseList(a);
  const lb = normaliseList(b);
  if (!la.length || !lb.length) return la.length === lb.length;
  for (let i = 0; i < la.length; i += 1) {
    for (let j = 0; j < lb.length; j += 1) {
      if (la[i] === lb[j]) return true;
      if (la[i].indexOf(lb[j]) !== -1) return true;
      if (lb[j].indexOf(la[i]) !== -1) return true;
    }
  }
  return false;
}

module.exports = detectContradictions;
module.exports.SOURCE_PRIORITY = SOURCE_PRIORITY;
module.exports.FACT_KEYS = FACT_KEYS;
module.exports.parseDateParts = parseDateParts;
module.exports.compareDates = compareDates;
module.exports.comparePlaces = comparePlaces;
module.exports.compareLists = compareLists;
