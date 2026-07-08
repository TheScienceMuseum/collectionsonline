'use strict';

// Strict verbatim citation validator.
//
// Runs after `parseSourceTaggedResponse` in the writer wrapper. Takes the
// parsed sentences + the raw writer inputs (personData, relatedItems,
// wikidataContext) and drops any citation whose `excerpt` isn't a verbatim
// substring of the referenced input field, or whose `value` doesn't match
// the referenced input value. This is the mechanical defence against the
// writer confabulating plausible-looking source quotes.
//
// Only the sidecar `citations[]` array on each sentence is inspected —
// the sentence's `text` (the prose the reader sees) is unaffected by any
// of this. The writer is free to phrase the sentence in its own voice;
// citations are the audit trail alongside.
//
// Design principles:
//   - STRICT-verbatim: no whitespace normalisation, no case-folding, no
//     punctuation smoothing. The writer's job is to copy the anchor text
//     exactly as it appears in the source. Any drift = failure.
//   - Additive: only sentences with source ∈ {museum, wikidata,
//     llm:validated:*} carry citations; other sources have their
//     citations[] stripped entirely (writer shouldn't emit them there, but
//     a defensive strip means noise from the writer can't leak through).
//   - Reports rather than throws: the caller passes an optional
//     `diagnostics` array — every dropped citation appends one entry with
//     the reason. Never throws; downstream code always gets sentences back.
//
// Citation shape (post-parse):
//   { field: string, value?: string, excerpt?: string }
// Where `field` is one of:
//   'personData.<key>'    — top-level personData field
//   'wikidata:<Pcode>'    — a wikidata claim
//   'relatedItem:<coId>'  — a related item (whole item; excerpt matches title OR description)
//
// Exactly ONE of `value` or `excerpt` must be present. `value` is used
// for structured fields (dates, wikidata claims, related-item IDs);
// `excerpt` for freetext.

// Which source tags are citation-eligible. Other sources have their
// citations[] stripped even if the writer emits one — the source
// semantics say the sentence has no external anchor.
const CITATION_ELIGIBLE_SOURCES = new Set([
  'museum',
  'wikidata'
]);

// llm:validated:* prefix is also eligible; matched separately below.
const LLM_VALIDATED_PREFIX = 'llm:validated:';

// The set of personData keys we accept in `personData.<key>` citation
// fields. Matches the fields buildUserPrompt exposes to the writer. Any
// other key = citation rejected. Kept explicit so a schema drift can't
// silently open the door to citation of a field the writer didn't
// actually see.
const KNOWN_PERSONDATA_FIELDS = new Set([
  'name',
  'birthDate',
  'birthPlace',
  'deathDate',
  'deathPlace',
  'occupation',
  'nationality',
  'briefBiography',
  'biography'
]);

// Public entry point.
//
// sentences  — the parsed sentence array from parseSourceTaggedResponse
// inputs     — { personData, relatedItems, wikidataContext } — the same
//              objects that fed buildUserPrompt.
// opts       — optional; { diagnostics: [] } collects drop reasons.
//
// Returns: sentences[] with per-sentence `citations` filtered. Non-
// destructive on the input (returns fresh sentence objects).
function validateCitations (sentences, inputs, opts) {
  opts = opts || {};
  const diagnostics = Array.isArray(opts.diagnostics) ? opts.diagnostics : null;
  const inputsSafe = inputs || {};

  return (sentences || []).map(function (sentence, sentenceIndex) {
    const eligible = isCitationEligibleSource(sentence.source);
    const rawCitations = Array.isArray(sentence.citations) ? sentence.citations : [];

    if (!eligible) {
      // Non-eligible sources (llm:inferred / contextualising /
      // general_knowledge) — strip citations if the writer emitted them.
      // Log so we can see whether the writer is consistently violating
      // the rule.
      if (rawCitations.length && diagnostics) {
        diagnostics.push({
          sentenceIndex,
          sentenceText: sentence.text,
          reason: 'source_ineligible',
          detail: 'source=' + sentence.source + ' does not carry external anchors; stripping ' + rawCitations.length + ' citation(s)'
        });
      }
      return Object.assign({}, sentence, { citations: [] });
    }

    const validated = [];
    rawCitations.forEach(function (raw, i) {
      const result = validateOne(raw, inputsSafe);
      if (result.ok) {
        validated.push(result.citation);
      } else if (diagnostics) {
        diagnostics.push({
          sentenceIndex,
          citationIndex: i,
          sentenceText: sentence.text,
          reason: result.reason,
          detail: result.detail
        });
      }
    });

    return Object.assign({}, sentence, { citations: validated });
  });
}

// Whether a sentence's source can carry citations. `museum` and
// `wikidata` are always eligible; `llm:validated:<toolname>` matches by
// prefix so a future promotion pipeline that tags with any tool name is
// covered without a code change.
function isCitationEligibleSource (source) {
  if (typeof source !== 'string') return false;
  if (CITATION_ELIGIBLE_SOURCES.has(source)) return true;
  if (source.indexOf(LLM_VALIDATED_PREFIX) === 0) return true;
  return false;
}

// Validate one citation against the inputs. Returns
// { ok: true, citation } on success, { ok: false, reason, detail } on
// any failure. Never throws — malformed writer output should degrade
// gracefully.
function validateOne (raw, inputs) {
  if (raw == null || typeof raw !== 'object') {
    return { ok: false, reason: 'malformed', detail: 'citation is not an object' };
  }

  const field = typeof raw.field === 'string' ? raw.field.trim() : '';
  if (!field) {
    return { ok: false, reason: 'missing_field', detail: 'citation has no `field`' };
  }

  const value = typeof raw.value === 'string' ? raw.value : (raw.value != null ? String(raw.value) : null);
  const excerpt = typeof raw.excerpt === 'string' ? raw.excerpt : null;

  if (value != null && excerpt != null) {
    return { ok: false, reason: 'value_and_excerpt', detail: 'citation must have EITHER `value` OR `excerpt`, not both' };
  }
  if (value == null && excerpt == null) {
    return { ok: false, reason: 'no_anchor', detail: 'citation must have `value` or `excerpt`' };
  }

  if (field.indexOf('personData.') === 0) {
    return validatePersonDataCitation(field, value, excerpt, inputs.personData);
  }
  if (field.indexOf('wikidata:') === 0) {
    return validateWikidataCitation(field, value, excerpt, inputs.wikidataContext);
  }
  if (field.indexOf('relatedItem:') === 0) {
    return validateRelatedItemCitation(field, value, excerpt, inputs.relatedItems);
  }

  return { ok: false, reason: 'unknown_field_prefix', detail: 'field=' + field };
}

// --- Sub-validators -------------------------------------------------

function validatePersonDataCitation (field, value, excerpt, personData) {
  const key = field.slice('personData.'.length);
  if (!KNOWN_PERSONDATA_FIELDS.has(key)) {
    return { ok: false, reason: 'unknown_personData_field', detail: 'field=' + field };
  }
  const sourceValue = personData ? personData[key] : null;
  if (sourceValue == null || sourceValue === '') {
    return { ok: false, reason: 'field_not_in_input', detail: 'personData.' + key + ' is empty or missing' };
  }

  if (value != null) {
    if (String(sourceValue) === value) {
      return { ok: true, citation: { field, value } };
    }
    return {
      ok: false,
      reason: 'value_mismatch',
      detail: 'personData.' + key + ' expected "' + String(sourceValue) + '", writer sent "' + value + '"'
    };
  }

  // excerpt path: strict verbatim substring
  if (String(sourceValue).indexOf(excerpt) !== -1) {
    return { ok: true, citation: { field, excerpt } };
  }
  return {
    ok: false,
    reason: 'excerpt_not_verbatim',
    detail: 'personData.' + key + ' does not contain the exact string "' + truncateForLog(excerpt) + '"'
  };
}

function validateWikidataCitation (field, value, excerpt, wikidataContext) {
  const pcode = field.slice('wikidata:'.length);
  if (!/^P\d+$/.test(pcode)) {
    return { ok: false, reason: 'bad_wikidata_pcode', detail: 'field=' + field };
  }
  if (!wikidataContext || wikidataContext[pcode] == null) {
    return { ok: false, reason: 'wikidata_property_missing', detail: pcode + ' not in wikidataContext' };
  }

  const wdEntry = wikidataContext[pcode];
  // Wikidata entries are typically arrays of value objects like
  // [{ label: 'ETH Zurich', qcode: 'Q11942' }, ...]. Also tolerate raw
  // strings or arrays of strings, for older cache shapes.
  const candidateStrings = extractWikidataCandidates(wdEntry);

  if (value != null) {
    if (candidateStrings.indexOf(value) !== -1) {
      return { ok: true, citation: { field, value } };
    }
    return {
      ok: false,
      reason: 'value_mismatch',
      detail: 'wikidata:' + pcode + ' has [' + candidateStrings.slice(0, 3).join(', ') +
        (candidateStrings.length > 3 ? ', …' : '') + '], writer sent "' + value + '"'
    };
  }

  // excerpt for wikidata is unusual (values are structured, not
  // freetext) but allow it against any candidate string.
  const hit = candidateStrings.some(function (s) { return s.indexOf(excerpt) !== -1; });
  if (hit) return { ok: true, citation: { field, excerpt } };
  return {
    ok: false,
    reason: 'excerpt_not_verbatim',
    detail: 'wikidata:' + pcode + ' none of [' + candidateStrings.slice(0, 3).join(', ') +
      '] contains "' + truncateForLog(excerpt) + '"'
  };
}

function validateRelatedItemCitation (field, value, excerpt, relatedItems) {
  const coId = field.slice('relatedItem:'.length).toLowerCase();
  if (!/^[a-z]{2}\d+$/.test(coId)) {
    return { ok: false, reason: 'bad_related_item_id', detail: 'field=' + field };
  }
  const item = (relatedItems || []).find(function (r) { return r && r.id && r.id.toLowerCase() === coId; });
  if (!item) {
    return { ok: false, reason: 'related_item_missing', detail: coId + ' not in relatedItems' };
  }

  if (value != null) {
    if (value === item.id || value === item.title) {
      return { ok: true, citation: { field, value } };
    }
    return {
      ok: false,
      reason: 'value_mismatch',
      detail: 'relatedItem:' + coId + ' id=' + item.id + ', title=' + (item.title || '') +
        ', writer sent "' + value + '"'
    };
  }

  // Excerpt path: check against title OR description (both are freetext
  // the writer could reasonably quote from).
  const title = String(item.title || '');
  const description = String(item.description || '');
  if (title.indexOf(excerpt) !== -1 || description.indexOf(excerpt) !== -1) {
    return { ok: true, citation: { field, excerpt } };
  }
  return {
    ok: false,
    reason: 'excerpt_not_verbatim',
    detail: 'relatedItem:' + coId + ' neither title nor description contains "' + truncateForLog(excerpt) + '"'
  };
}

// --- Helpers --------------------------------------------------------

function extractWikidataCandidates (entry) {
  if (entry == null) return [];
  if (typeof entry === 'string') return [entry];
  if (Array.isArray(entry)) {
    return entry.map(function (e) {
      if (e == null) return '';
      if (typeof e === 'string') return e;
      if (typeof e === 'object') return e.label || e.value || e.name || '';
      return String(e);
    }).filter(Boolean);
  }
  if (typeof entry === 'object') {
    return [entry.label || entry.value || entry.name || ''].filter(Boolean);
  }
  return [String(entry)];
}

function truncateForLog (s) {
  const str = String(s);
  return str.length > 80 ? str.slice(0, 77) + '…' : str;
}

module.exports = validateCitations;
module.exports.CITATION_ELIGIBLE_SOURCES = CITATION_ELIGIBLE_SOURCES;
module.exports.LLM_VALIDATED_PREFIX = LLM_VALIDATED_PREFIX;
module.exports.KNOWN_PERSONDATA_FIELDS = KNOWN_PERSONDATA_FIELDS;
module.exports.isCitationEligibleSource = isCitationEligibleSource;
