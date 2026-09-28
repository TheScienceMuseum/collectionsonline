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
//   'relatedItem:<coId>'  — a related item (object / document; excerpt matches title OR description)
//   'relatedPerson:<cpId>' — a related person / organisation from personData.relatedPeople
//                            (value matches name; excerpt matches name OR role)
//
// Exactly ONE of `value` or `excerpt` must be present. `value` is used
// for structured fields (dates, wikidata claims, related-item IDs,
// related-person names); `excerpt` for freetext.
//
// On successful validation the validator ATTACHES enrichment fields to
// the returned citation so downstream renderers (admin UI, dashboard,
// verification tooling) don't need a fresh ES / DB lookup to display it:
//   relatedItem   → adds { title, href }
//   relatedPerson → adds { name, role, href }
//   wikidata      → adds { propertyLabel? } when the property has a
//                   known human-readable label
//   personData    → no enrichment (field name alone is enough)
// Missing enrichment fields never break rendering — the admin UI falls
// back to showing the raw `field` string for old-shape citations.

// Which source tags are citation-eligible. Other sources have their
// citations[] stripped even if the writer emits one — the source
// semantics say the sentence has no external anchor.
const CITATION_ELIGIBLE_SOURCES = new Set([
  'museum',
  'wikidata',
  'wikipedia',
  'oxfordDNB',
  'gracesGuide'
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
  if (field.indexOf('relatedPerson:') === 0) {
    // Related people come from personData.relatedPeople — an array of
    // { id, name, role, link } produced by extract-person-data.js. The
    // writer sees this list in the user prompt (MUSEUM RELATED PEOPLE &
    // ORGANISATIONS section), so it can cite parents / collaborators /
    // sibling brands from the museum's own related-persons data with a
    // proper receipt rather than having to hide the citation in
    // sourceDetail. Value matches name; excerpt matches name OR role.
    return validateRelatedPersonCitation(field, value, excerpt, (inputs.personData && inputs.personData.relatedPeople) || []);
  }
  if (field.indexOf('wikipedia:') === 0) {
    // Wikipedia intro included in the user prompt via the WIKIPEDIA
    // CONTEXT section. Writer cites with the article title in the
    // field (`wikipedia:<title>`) and a VERBATIM excerpt of the intro
    // text — same substring check as personData excerpts.
    return validateWikipediaCitation(field, value, excerpt, inputs.wikipediaSummary);
  }
  if (field.indexOf('oxfordDNB:') === 0) {
    // Oxford DNB entry — same validation shape as wikipedia. Text
    // source, excerpt must be a verbatim substring of the entry text
    // included in the prompt's ODNB CONTEXT section.
    return validateOdnbCitation(field, value, excerpt, inputs.odnbSummary);
  }
  if (field.indexOf('gracesGuide:') === 0) {
    // Grace's Guide entry — same validation shape as wikipedia + ODNB.
    return validateGracesGuideCitation(field, value, excerpt, inputs.gracesGuideSummary);
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

  // Enrichment attached to every successful relatedItem citation so the
  // admin UI can render "icon + title" without a fresh ES lookup.
  const enrich = {
    title: item.title || '',
    href: item.link || null,
    itemType: item.type || null
  };

  if (value != null) {
    if (value === item.id || value === item.title) {
      return { ok: true, citation: Object.assign({ field, value }, enrich) };
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
    return { ok: true, citation: Object.assign({ field, excerpt }, enrich) };
  }
  return {
    ok: false,
    reason: 'excerpt_not_verbatim',
    detail: 'relatedItem:' + coId + ' neither title nor description contains "' + truncateForLog(excerpt) + '"'
  };
}

function validateRelatedPersonCitation (field, value, excerpt, relatedPeople) {
  const cpId = field.slice('relatedPerson:'.length).toLowerCase();
  if (!/^[a-z]{2}\d+$/.test(cpId)) {
    return { ok: false, reason: 'bad_related_person_id', detail: 'field=' + field };
  }
  const person = (relatedPeople || []).find(function (p) { return p && p.id && p.id.toLowerCase() === cpId; });
  if (!person) {
    return { ok: false, reason: 'related_person_missing', detail: cpId + ' not in personData.relatedPeople' };
  }

  // Enrichment for every successful relatedPerson citation. Role often
  // conveys the meaning of the relationship to the subject ("father",
  // "mother", "collaborator", "manufactured by") — worth carrying
  // through so the admin UI can show "Asklepios (father)" at a glance.
  const enrich = {
    name: person.name || '',
    role: person.role || null,
    href: person.link || null
  };

  if (value != null) {
    if (value === person.id || value === person.name) {
      return { ok: true, citation: Object.assign({ field, value }, enrich) };
    }
    return {
      ok: false,
      reason: 'value_mismatch',
      detail: 'relatedPerson:' + cpId + ' id=' + person.id + ', name=' + (person.name || '') +
        ', writer sent "' + value + '"'
    };
  }

  // Excerpt path: check against name OR role (both are short freetext
  // the writer could quote from).
  const name = String(person.name || '');
  const role = String(person.role || '');
  if (name.indexOf(excerpt) !== -1 || (role && role.indexOf(excerpt) !== -1)) {
    return { ok: true, citation: Object.assign({ field, excerpt }, enrich) };
  }
  return {
    ok: false,
    reason: 'excerpt_not_verbatim',
    detail: 'relatedPerson:' + cpId + ' neither name nor role contains "' + truncateForLog(excerpt) + '"'
  };
}

function validateGracesGuideCitation (field, value, excerpt, gracesGuideSummary) {
  const title = field.slice('gracesGuide:'.length).trim();
  if (!title) return { ok: false, reason: 'bad_graces_guide_title', detail: 'empty title in ' + field };
  if (!gracesGuideSummary || !gracesGuideSummary.extract) {
    return { ok: false, reason: 'graces_guide_summary_missing', detail: 'no Grace\'s Guide summary in inputs' };
  }
  if (gracesGuideSummary.title && title !== gracesGuideSummary.title) {
    return {
      ok: false,
      reason: 'graces_guide_title_mismatch',
      detail: 'writer cited "' + title + '"; prompt entry was "' + gracesGuideSummary.title + '"'
    };
  }
  if (excerpt == null) {
    return { ok: false, reason: 'graces_guide_needs_excerpt', detail: 'gracesGuide citations require excerpt, not value' };
  }
  if (gracesGuideSummary.extract.indexOf(excerpt) !== -1) {
    return { ok: true, citation: { field, excerpt } };
  }
  return {
    ok: false,
    reason: 'excerpt_not_verbatim',
    detail: 'Grace\'s Guide entry "' + title + '" does not contain "' + truncateForLog(excerpt) + '"'
  };
}

function validateOdnbCitation (field, value, excerpt, odnbSummary) {
  const title = field.slice('oxfordDNB:'.length).trim();
  if (!title) return { ok: false, reason: 'bad_odnb_title', detail: 'empty title in ' + field };
  if (!odnbSummary || !odnbSummary.extract) {
    return { ok: false, reason: 'odnb_summary_missing', detail: 'no ODNB summary in inputs' };
  }
  if (odnbSummary.title && title !== odnbSummary.title) {
    return {
      ok: false,
      reason: 'odnb_title_mismatch',
      detail: 'writer cited "' + title + '"; prompt entry was "' + odnbSummary.title + '"'
    };
  }
  if (excerpt == null) {
    return { ok: false, reason: 'odnb_needs_excerpt', detail: 'oxfordDNB citations require excerpt, not value' };
  }
  if (odnbSummary.extract.indexOf(excerpt) !== -1) {
    return { ok: true, citation: { field, excerpt } };
  }
  return {
    ok: false,
    reason: 'excerpt_not_verbatim',
    detail: 'ODNB entry "' + title + '" does not contain "' + truncateForLog(excerpt) + '"'
  };
}

function validateWikipediaCitation (field, value, excerpt, wikipediaSummary) {
  // Wikipedia citations only match if the writer's field names the
  // exact article title we included in the prompt. Otherwise the
  // writer is citing an article we didn't give it, which is a
  // laundering attempt — drop.
  const title = field.slice('wikipedia:'.length).trim();
  if (!title) return { ok: false, reason: 'bad_wikipedia_title', detail: 'empty title in ' + field };
  if (!wikipediaSummary || !wikipediaSummary.extract) {
    return { ok: false, reason: 'wikipedia_summary_missing', detail: 'no wikipedia summary in inputs' };
  }
  if (title !== wikipediaSummary.title) {
    return {
      ok: false,
      reason: 'wikipedia_title_mismatch',
      detail: 'writer cited "' + title + '"; prompt article was "' + wikipediaSummary.title + '"'
    };
  }

  // Wikipedia citations must be excerpt-only. `value` is meaningless
  // for prose — the article isn't a structured field, it's text.
  if (excerpt == null) {
    return { ok: false, reason: 'wikipedia_needs_excerpt', detail: 'wikipedia citations require excerpt, not value' };
  }
  const haystack = wikipediaSummary.extract;
  if (haystack.indexOf(excerpt) !== -1) {
    return { ok: true, citation: { field, excerpt } };
  }
  return {
    ok: false,
    reason: 'excerpt_not_verbatim',
    detail: 'wikipedia article "' + title + '" does not contain "' + truncateForLog(excerpt) + '"'
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
    // Post-2026-07-10 fetcher shape: { label, value: '<comma-joined>',
    // claims: [ { value, qCode, qualifiers, references } ] }. Every
    // individual claim value becomes an eligible candidate so the
    // writer can cite one specific value from a multi-value property
    // (e.g. wikidata:P108 with value "ETH Zurich" against a property
    // that also holds "Institute for Advanced Study"). We also keep
    // the top-level `value` (comma-joined summary) for backwards
    // compat with pre-fetcher-upgrade records that only had one.
    const out = [];
    if (Array.isArray(entry.claims)) {
      entry.claims.forEach(function (c) {
        if (c && typeof c.value === 'string' && c.value) out.push(c.value);
        // qCode is a legitimate exact-match candidate too — some writers
        // will cite the entity id directly rather than the resolved label.
        if (c && typeof c.qCode === 'string' && c.qCode) out.push(c.qCode);
      });
    }
    // Fallback: single-value entries without a claims[] array.
    // Prefer entry.value first — in the post-2026-07-10 fetcher shape,
    // `label` is the property NAME ("employer") and `value` is the
    // comma-joined summary of actual claim values, whereas in the
    // older array-shape entries `label` is the value itself
    // ({label: 'ETH Zurich', qcode: 'Q11942'}). Prefer value → name
    // → label handles both without ambiguity.
    const topValue = entry.value || entry.name || entry.label || '';
    if (topValue && out.indexOf(topValue) === -1) out.push(topValue);
    return out.filter(Boolean);
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
