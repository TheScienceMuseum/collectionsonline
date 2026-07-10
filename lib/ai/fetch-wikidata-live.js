'use strict';

/**
 * Fetch Wikidata entity properties directly from the API.
 *
 * Returns an object with the subject's claims — dual-keyed by BOTH the
 * Wikidata property code (e.g. "P108") AND the human-readable label
 * (e.g. "employer"). Same value object under both keys, so callers can
 * look up whichever way they prefer. The validator queries by P-code;
 * classify-subject / subject-status / prompt formatter query by label.
 *
 * Each claim value carries:
 *   - value        — human-readable label (e.g. "Institute for Advanced Study")
 *   - qCode        — Wikidata entity id (e.g. "Q11989") when the value
 *                    itself is a Wikidata entity; null for literal values
 *                    like dates or strings
 *   - qualifiers   — object of qualifier P-code → resolved string
 *                    (start_time, end_time, position held, subject of, etc.)
 *   - references   — array of { url, statedIn, retrieved } — the Wikidata
 *                    sources cited for THIS claim
 *
 * Top-level shape:
 *
 *   {
 *     description: 'German-American theoretical physicist',
 *     wikipediaUrl: 'https://…',
 *     P108: { label: 'employer', value: 'ETH Zurich, IAS',
 *             claims: [ { value: 'ETH Zurich', qCode: 'Q11942',
 *                         qualifiers: { start_time: '1912', end_time: '1914',
 *                                       position_held: 'professor' },
 *                         references: [ { url, statedIn, retrieved } ] },
 *                       … ] },
 *     employer: <same object as P108>,
 *     …
 *   }
 *
 * The `value` string on each claim entry is a comma-joined summary for
 * backwards compat with older prompt formatters. The `claims[]` array
 * is where qualifiers and references live — new consumers should iterate
 * that instead.
 */

const CLAIM_PROPS = {
  // Person properties
  P106: 'occupation',
  P27: 'country of citizenship',
  P69: 'educated at',
  P108: 'employer',
  P101: 'field of work',
  P800: 'notable work',
  P166: 'awards received',
  P463: 'member of',
  P1412: 'languages spoken',
  P569: 'date of birth',
  P570: 'date of death',
  // Organisation properties
  P112: 'founded by',
  P571: 'inception',
  P576: 'dissolved',
  P169: 'chief executive officer',
  P488: 'chairperson',
  P452: 'industry',
  P159: 'headquarters location',
  P17: 'country',
  P127: 'owned by',
  P749: 'parent organization',
  P355: 'subsidiary',
  P1056: 'product or material produced',
  P1830: 'owner of'
};

// Qualifier property codes worth surfacing. Anything not on this list
// is dropped — Wikidata has hundreds of qualifier types, most of which
// are internal bookkeeping (statement rank, applies to jurisdiction,
// etc.) that don't help the writer make a better sentence.
//
// The two most valuable qualifiers are P580 (start time) and P582 (end
// time), because they let the writer disambiguate temporal periods —
// Einstein at the Swiss patent office 1902-1909 (era-appropriate name)
// vs Einstein at the Institute for Advanced Study 1933-1955. This is
// the primary structural defence against the "institutional sequencing"
// and "anachronism" anti-pattern classes.
const QUALIFIER_PROPS = {
  P580: 'start_time',
  P582: 'end_time',
  P585: 'point_in_time',
  P39: 'position_held',
  P512: 'academic_degree',
  P642: 'of',
  P805: 'subject_of_statement',
  P794: 'role',
  P812: 'academic_major'
};

// Reference property codes worth surfacing per claim. Wikidata claims
// often carry multiple references; we surface the top 3 per claim,
// preferring reference-URL + stated-in.
const REFERENCE_PROPS = {
  P854: 'url',
  P248: 'stated_in',
  P1476: 'title',
  P813: 'retrieved'
};

const MAX_CLAIMS_PER_PROP = 5;
const MAX_QUALIFIERS_PER_CLAIM = 4;
const MAX_REFERENCES_PER_CLAIM = 3;
const MAX_ENTITIES_PER_LABEL_LOOKUP = 50;
const TIMEOUT_MS = 8000;

async function fetchWikidataLive (qCode) {
  const url = 'https://www.wikidata.org/w/api.php?action=wbgetentities' +
    '&ids=' + qCode + '&languages=en&props=labels|descriptions|claims|sitelinks&format=json';

  const controller = new AbortController();
  const timeout = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const entity = data.entities && data.entities[qCode];
    if (!entity) return null;

    const result = {};

    const desc = entity.descriptions && entity.descriptions.en;
    if (desc) result.description = desc.value;

    // Collect entity Q-code references we'll need to resolve to labels.
    // Every entity that appears in a mainsnak, qualifier, or reference
    // gets added here. Batched into one lookup at the end so we pay one
    // label API call per fetch regardless of subject richness.
    const qCodesToResolve = new Set();

    // First pass — extract structured claim data. Q-code values are
    // captured as bare codes; label resolution happens in the second
    // pass after we've collected the full set.
    Object.keys(CLAIM_PROPS).forEach(function (prop) {
      const claims = entity.claims && entity.claims[prop];
      if (!claims || !claims.length) return;

      const parsed = claims.slice(0, MAX_CLAIMS_PER_PROP).map(function (claim) {
        return parseClaim(claim, qCodesToResolve);
      }).filter(Boolean);

      if (parsed.length) {
        const propKey = 'P' + prop.slice(1);
        const propLabel = CLAIM_PROPS[prop];
        const entry = {
          label: propLabel,
          // `value` is the backwards-compat comma-joined summary
          value: parsed.map(function (p) { return p.value; }).join(', '),
          claims: parsed
        };
        result[propKey] = entry;
        result[propLabel] = entry;
      }
    });

    // Batch-resolve every Q-code we collected (values, qualifier values,
    // reference stated_in). One API call, single round-trip cost.
    const labels = await resolveLabels(Array.from(qCodesToResolve), controller);

    // Second pass — swap Q-codes for labels in every entry we built.
    Object.keys(result).forEach(function (key) {
      const entry = result[key];
      if (!entry || !entry.claims) return;
      entry.claims.forEach(function (c) {
        if (c.qCode && labels[c.qCode]) c.value = labels[c.qCode];
        Object.keys(c.qualifiers || {}).forEach(function (qKey) {
          const v = c.qualifiers[qKey];
          if (typeof v === 'string' && labels[v]) c.qualifiers[qKey] = labels[v];
        });
        (c.references || []).forEach(function (r) {
          if (r.stated_in && labels[r.stated_in]) r.stated_in = labels[r.stated_in];
        });
      });
      // Refresh the comma-joined summary with resolved labels.
      entry.value = entry.claims.map(function (c) { return c.value; }).join(', ');
    });

    const enwiki = entity.sitelinks && entity.sitelinks.enwiki;
    if (enwiki) {
      result.wikipediaUrl = 'https://en.wikipedia.org/wiki/' +
        encodeURIComponent(enwiki.title.replace(/ /g, '_'));
    }

    return Object.keys(result).length > 0 ? result : null;
  } finally {
    clearTimeout(timeout);
  }
}

// Extract the value / qualifiers / references from one claim. Q-code
// references added to `qCodesToResolve` (a Set the caller owns) for
// batch label resolution.
function parseClaim (claim, qCodesToResolve) {
  const snak = claim.mainsnak;
  if (!snak || !snak.datavalue) return null;

  const parsedValue = parseSnakValue(snak, qCodesToResolve);
  if (parsedValue == null) return null;

  const qualifiers = parseQualifiers(claim.qualifiers, qCodesToResolve);
  const references = parseReferences(claim.references, qCodesToResolve);

  return {
    value: parsedValue.value,
    qCode: parsedValue.qCode,
    qualifiers,
    references
  };
}

// Snak datavalue → { value, qCode }. `qCode` is the Wikidata entity id
// when the snak is an entity reference; null for literal values.
function parseSnakValue (snak, qCodesToResolve) {
  if (!snak || !snak.datavalue) return null;
  const dv = snak.datavalue;
  if (dv.type === 'wikibase-entityid') {
    const id = dv.value.id;
    if (id) qCodesToResolve.add(id);
    return { value: id, qCode: id };
  }
  if (dv.type === 'string') {
    return { value: dv.value, qCode: null };
  }
  if (dv.type === 'time' && dv.value && dv.value.time) {
    return { value: dv.value.time, qCode: null };
  }
  if (dv.type === 'monolingualtext' && dv.value && dv.value.text) {
    return { value: dv.value.text, qCode: null };
  }
  return null;
}

function parseQualifiers (raw, qCodesToResolve) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  let taken = 0;
  Object.keys(raw).forEach(function (qProp) {
    if (taken >= MAX_QUALIFIERS_PER_CLAIM) return;
    const humanKey = QUALIFIER_PROPS[qProp];
    if (!humanKey) return;
    const arr = Array.isArray(raw[qProp]) ? raw[qProp] : [];
    const first = arr[0];
    const parsed = parseSnakValue(first, qCodesToResolve);
    if (parsed != null) {
      out[humanKey] = parsed.value;
      taken += 1;
    }
  });
  return out;
}

function parseReferences (raw, qCodesToResolve) {
  if (!Array.isArray(raw) || !raw.length) return [];
  const refs = [];
  raw.slice(0, MAX_REFERENCES_PER_CLAIM).forEach(function (ref) {
    if (!ref || !ref.snaks) return;
    const item = {};
    Object.keys(REFERENCE_PROPS).forEach(function (rProp) {
      const humanKey = REFERENCE_PROPS[rProp];
      const arr = Array.isArray(ref.snaks[rProp]) ? ref.snaks[rProp] : [];
      const first = arr[0];
      const parsed = parseSnakValue(first, qCodesToResolve);
      if (parsed != null) item[humanKey] = parsed.value;
    });
    if (Object.keys(item).length) refs.push(item);
  });
  return refs;
}

// Batch-resolve Q-codes to English labels. Chunks by MAX_ENTITIES_PER_LABEL_LOOKUP
// so we never overflow the API's per-request limit.
async function resolveLabels (qCodes, controller) {
  const out = {};
  if (!qCodes.length) return out;
  for (let i = 0; i < qCodes.length; i += MAX_ENTITIES_PER_LABEL_LOOKUP) {
    const batch = qCodes.slice(i, i + MAX_ENTITIES_PER_LABEL_LOOKUP);
    const labelUrl = 'https://www.wikidata.org/w/api.php?action=wbgetentities' +
      '&ids=' + batch.join('|') + '&languages=en&props=labels&format=json';
    try {
      const res = await fetch(labelUrl, { signal: controller.signal });
      if (!res.ok) continue;
      const data = await res.json();
      Object.keys(data.entities || {}).forEach(function (id) {
        const label = data.entities[id].labels && data.entities[id].labels.en;
        if (label) out[id] = label.value;
      });
    } catch (err) {
      // Label resolution failure is non-fatal — unresolved Q-codes
      // stay as their raw code in the output, which is still usable
      // (validator matches Q-code as a candidate value).
    }
  }
  return out;
}

module.exports = fetchWikidataLive;
module.exports.CLAIM_PROPS = CLAIM_PROPS;
module.exports.QUALIFIER_PROPS = QUALIFIER_PROPS;
module.exports.REFERENCE_PROPS = REFERENCE_PROPS;
