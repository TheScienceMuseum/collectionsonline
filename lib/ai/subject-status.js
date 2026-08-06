'use strict';

const parseBriefBiographyDates = require('./parse-brief-biography-dates');

// Determine whether the subject (person, company, or organisation) is
// currently living / active, based on internal ES data with Wikidata as a
// fallback. Our ES records can lag real-world events, so the Wikidata
// fallback catches recent deaths or dissolutions that haven't made it into
// the museum's catalogue yet.
//
// Returns:
//   {
//     status: 'active' | 'deceased' | 'dissolved' | 'unknown' | 'historical',
//     isLiving: true | false,
//     subjectType: 'person' | 'company' | 'organisation' | null,
//     birthDate: string | null,
//     birthDateSource: 'internal' | 'wikidata' | null,
//     deathDate: string | null,
//     deathDateSource: 'internal' | 'wikidata' |
//                      'inferred-from-birth' |
//                      'inferred-from-brief-biography' | null,
//     deathDateInternal: string | null,
//     deathDateWikidata: string | null,
//     deathDateInferred: string | null,
//     deathDateInferredReasoning: string | null,
//     // Organisation-only — populated when the org status was derived from
//     // brief-biography activity prose rather than a structured field:
//     activityText: string | null,                // matched substring, e.g. "active 1990s"
//     latestActivityYear: number | null,          // latest year in that text
//     organisationStatusReasoning: string | null  // human-readable rationale
//   }
//
// Status meanings:
//   'deceased'   — person, structured / inferred death recorded
//   'dissolved'  — organisation, structured dissolution recorded
//   'active'     — person without death (still living), OR organisation
//                  with positive evidence of current operation ("current"
//                  marker in brief biography), OR organisation with no
//                  activity data either way (default — preserves prior
//                  behaviour for thin records)
//   'unknown'    — organisation with brief-biography activity dates whose
//                  latest year is recent enough that the entity COULD
//                  plausibly still be operating, but no structured or
//                  textual confirmation. "Active 1990s" with no current
//                  marker, for example. Honest about uncertainty.
//   'historical' — organisation with brief-biography activity dates whose
//                  latest year is more than ORG_HISTORICAL_CUTOFF_YEARS
//                  ago (75). Likely defunct even without a structured
//                  dissolution date.

// Conservative cap on human lifespan. The oldest verified human (Jeanne
// Calment) reached 122; using 110 leaves ample margin. If any dated
// information about a subject puts them definitively before
// (current year - 110), we treat them as deceased even when no death
// date is recorded.
const HUMAN_LIFESPAN_CAP_YEARS = 110;

// Cutoff for organisation activity dates. Any organisation whose latest
// brief-biography activity year is more than this many years ago is
// classified 'historical' rather than 'unknown'. 75 years roughly maps
// to "no living staff member could remember the entity operating" —
// a curatorial heuristic that catches Victorian / Edwardian / interwar
// records cleanly while leaving mid-20th-century records (where some
// firms genuinely still trade and some don't) honestly classified as
// 'unknown'. Used only to refine the four-state organisation
// classification — doesn't affect public-site visibility (orgs are
// always served).
const ORG_HISTORICAL_CUTOFF_YEARS = 75;

// Text markers that signal a mythological / fictional subject. Applied
// (case-insensitive) to personData.occupation, briefBiography, biography,
// name, and every wikidata `instance of` label. Word-boundaries matter:
// `\bgod of\b` matches "god of health" but not "godfather", "godalming",
// or "godolphin"; `\bgoddess\b` doesn't match "goddesses" (covered by the
// separate `(es)?` alternative).
//
// The set is deliberately narrow — we're only trying to catch subjects
// where the default "person with no death date → living" branch would
// mis-classify a mythological figure as still alive. False-positive
// tolerance: if a real person's briefBiography contains "Greek myth" we'd
// mis-classify them, but that's a rare enough shape that the safer
// default outweighs the miss.
const MYTHOLOGICAL_PATTERNS = [
  /\bgoddess(es)?\b/i,
  /\bgod of\b/i,
  /\bgods of\b/i,
  /\bdeit(y|ies)\b/i,
  /\bmytholog(y|ical|ies)\b/i,
  /\bmythical\b/i,
  /\bpersonification of\b/i,
  /\bin (greek|roman|norse|egyptian|hindu|celtic|aztec|mayan|sumerian|babylonian|japanese|chinese) myth/i,
  /\blegendary (figure|hero|character|god)\b/i,
  /\bfictional character\b/i,
  /\bdemigod(s|dess)?\b/i
];

function inspect (personData, wikidataContext, subjectType) {
  // subjectType: 'person' | 'company' | 'organisation' (from classify-subject)
  const isPerson = subjectType === 'person';

  const internalDeath = (personData && personData.deathDate) || null;
  const internalBirth = (personData && personData.birthDate) || null;

  // Wikidata death / dissolution — already normalised via fetch-wikidata-live.
  // Wikidata can return multiple values joined by ", " (e.g. a company that
  // had two dissolution events). Take just the first — generally the most
  // meaningful (original date; later ones tend to be restructuring artefacts).
  const firstValue = function (v) { return v ? String(v).split(',')[0].trim() : null; };
  const wikidataDeath = firstValue(wikidataContext && wikidataContext['date of death'] && wikidataContext['date of death'].value);
  const wikidataDissolved = firstValue(wikidataContext && wikidataContext.dissolved && wikidataContext.dissolved.value);
  const wikidataEnd = isPerson ? wikidataDeath : (wikidataDissolved || wikidataDeath);

  // Wikidata birth / inception — surfaced so the admin UI can show "born YYYY"
  // alongside the living pill, mirroring the "· deathDate" treatment for
  // deceased subjects. For organisations the equivalent property is
  // 'inception' (P571) — kept in the same field so a future template change
  // can render "founded YYYY" for active orgs without further wiring.
  const wikidataBirth = firstValue(wikidataContext && wikidataContext['date of birth'] && wikidataContext['date of birth'].value);
  const wikidataInception = firstValue(wikidataContext && wikidataContext.inception && wikidataContext.inception.value);
  const wikidataStart = isPerson ? wikidataBirth : (wikidataInception || wikidataBirth);

  const birthDate = internalBirth || wikidataStart;
  const birthDateSource = internalBirth ? 'internal' : (wikidataStart ? 'wikidata' : null);

  // Inference path — only when no structured death/end is known and only for
  // people. Two routes (see inferDeathFromAge):
  //   - structured birth date older than the lifespan cap
  //   - latest year in the brief biography prose older than the cap
  // Catches cases like cp52967 (no structured dates, brief = "active 1817-1839")
  // where the previous logic incorrectly flagged the subject as living.
  let inferred = null;
  if (!internalDeath && !wikidataEnd && isPerson) {
    inferred = inferDeathFromAge(personData);
  }

  const deathDate = internalDeath || wikidataEnd || (inferred && inferred.value);
  let deathDateSource = null;
  if (internalDeath) deathDateSource = 'internal';
  else if (wikidataEnd) deathDateSource = 'wikidata';
  else if (inferred) deathDateSource = inferred.source;

  let status;
  let isLiving;
  let orgInferred = null;
  let mythologicalReason = null;

  if (deathDate) {
    status = isPerson ? 'deceased' : 'dissolved';
    isLiving = false;
  } else if (isPerson) {
    // Person with no structured / inferred death would normally be
    // classified as living. Before we default to that, check whether
    // the subject is a mythological / fictional figure — Hygeia,
    // Machaon and similar Greek/Roman/etc deities have no birth or
    // death date in either the catalogue or Wikidata (they never
    // existed as people), and the previous logic mis-flagged them as
    // living. Detected via text markers + wikidata `instance of`; see
    // MYTHOLOGICAL_PATTERNS above.
    const mythical = detectMythological(personData, wikidataContext);
    if (mythical) {
      status = 'historical';
      isLiving = false;
      mythologicalReason = mythical.reason;
    } else {
      // The 110-year inference would already have populated `deathDate`
      // above if it applied, so reaching here means we genuinely treat
      // them as alive.
      status = 'active';
      isLiving = true;
    }
  } else {
    // Organisation with no structured dissolution. Refine the previous
    // blanket 'active' to one of {active, unknown, historical} based on
    // brief-biography activity prose. See inferOrganisationStatus.
    orgInferred = inferOrganisationStatus(personData);
    status = orgInferred.status;
    // Only 'active' and 'unknown' organisations are treated as "still
    // possibly operating" for downstream policy decisions. 'historical'
    // is treated as inactive (no defamation risk; the entity is
    // effectively gone). The public site doesn't suppress orgs by
    // status anyway, but isLiving is the canonical "could this entity
    // still be relevant?" flag and downstream code may use it.
    isLiving = (status === 'active' || status === 'unknown');
  }

  return {
    status,
    isLiving,
    subjectType: subjectType || null,
    birthDate,
    birthDateSource,
    deathDate,
    deathDateSource,
    deathDateInternal: internalDeath,
    deathDateWikidata: wikidataEnd,
    deathDateInferred: inferred ? inferred.value : null,
    deathDateInferredReasoning: inferred ? inferred.reasoning : null,
    activityText: orgInferred ? orgInferred.activityText : null,
    latestActivityYear: orgInferred ? orgInferred.latestActivityYear : null,
    organisationStatusReasoning: orgInferred ? orgInferred.reasoning : null,
    mythologicalReason
  };
}

// Detect mythological / fictional subjects — anyone whose only "reason to
// be alive" is that we couldn't find a death date. Two signals combined:
//
//   1. Text markers on the personData fields the writer sees. Cheap;
//      catches records without Wikidata.
//   2. Wikidata `instance of` (P31) label. More robust when we have it.
//
// Returns { reason: '<what matched and where>' } on first match, null
// otherwise. The reason is stored on the subject status so the admin UI
// can show it as a tooltip when the pill flips from "living" to
// "historical".
function detectMythological (personData, wikidataContext) {
  const fields = [
    ['occupation', personData && personData.occupation],
    ['briefBiography', personData && personData.briefBiography],
    ['biography', personData && personData.biography],
    ['name', personData && personData.name]
  ];
  for (const [fieldName, value] of fields) {
    if (!value) continue;
    const text = String(value);
    for (const p of MYTHOLOGICAL_PATTERNS) {
      const m = text.match(p);
      if (m) {
        return { reason: fieldName + ' contains "' + m[0] + '"' };
      }
    }
  }

  if (wikidataContext) {
    const instanceOf = wikidataContext['instance of'];
    if (instanceOf) {
      // Values can be a normalised `{ value: '...' }` shape or the raw
      // array. Extract every candidate label string, tolerating either.
      const candidates = [];
      const raw = instanceOf.value != null ? instanceOf.value : instanceOf;
      const parts = typeof raw === 'string'
        ? raw.split(',')
        : (Array.isArray(raw) ? raw : [raw]);
      parts.forEach(function (v) {
        if (v == null) return;
        if (typeof v === 'string') candidates.push(v);
        else if (typeof v === 'object') candidates.push(v.label || v.value || v.name || '');
      });
      for (const label of candidates) {
        for (const p of MYTHOLOGICAL_PATTERNS) {
          const m = String(label).match(p);
          if (m) {
            return { reason: 'wikidata instance of: "' + label + '"' };
          }
        }
      }
    }
  }

  return null;
}

// Try to conclude "this person must be dead by now" from data we already have
// when no explicit death date is recorded.
//
// Two routes, in priority order:
//   1. Structured birth date — if `personData.birthDate` parses to a year
//      <= (current year - 110), they're past the lifespan cap.
//   2. Brief biography prose — extract every 4-digit year (1500-2099) from
//      `personData.briefBiography` and take the latest. If that year is
//      <= (current year - 110), the same conclusion holds — even the latest
//      activity we know about is more than a human lifetime ago.
//
// Conservative on purpose: only YEARS in brief biography text, not main
// biography (which often mentions historical events / mentors / contemporaries
// whose dates aren't the subject's own — false-positive risk too high).
//
// Returns { value, reasoning, source } or null.
function inferDeathFromAge (personData) {
  if (!personData) return null;
  const cutoffYear = new Date().getFullYear() - HUMAN_LIFESPAN_CAP_YEARS;

  if (personData.birthDate) {
    const birthYear = parseInt(String(personData.birthDate).slice(0, 4), 10);
    if (!isNaN(birthYear) && birthYear <= cutoffYear) {
      return {
        value: String(birthYear + HUMAN_LIFESPAN_CAP_YEARS),
        reasoning: 'born ' + birthYear + ' — past the ' + HUMAN_LIFESPAN_CAP_YEARS + '-year human-lifespan cap',
        source: 'inferred-from-birth'
      };
    }
  }

  if (personData.briefBiography) {
    // (?!\d) instead of trailing \b — \b would fail in "1990s" because
    // there's no word boundary between '0' and 's'. Lookahead "not
    // followed by another digit" is what we actually want here.
    const matches = personData.briefBiography.match(/\b(1[5-9]\d{2}|20\d{2})(?!\d)/g) || [];
    const years = matches.map(Number);
    if (years.length > 0) {
      const latest = Math.max.apply(null, years);
      if (latest <= cutoffYear) {
        return {
          value: String(latest),
          reasoning: 'latest year in brief biography (' + latest + ') is more than ' + HUMAN_LIFESPAN_CAP_YEARS + ' years ago',
          source: 'inferred-from-brief-biography'
        };
      }
    }
  }

  return null;
}

// Refine the binary "active vs dissolved" classification for organisations
// using brief-biography activity prose. See the four-state semantics in the
// header docblock; this function picks among {active, unknown, historical}
// when no structured dissolution date is available.
//
// Decision tree (in priority order):
//
//   1. Brief biography contains "current" or "Present" marker → 'active'.
//      Positive evidence the org was operating at catalogue write time.
//      We could in theory still age this out if the captured "current"
//      year is itself decades old, but the marker carries staff intent
//      ("yes this still exists") that the years alone don't, so we trust
//      it as the strongest signal in the brief biography.
//
//   2. No brief biography activity dates at all → 'active' (default).
//      Preserves the prior behaviour for thin records — we don't have
//      grounds to make a stronger claim either way, and recategorising
//      every brief-biographyless org as 'unknown' would be more visual
//      noise than insight.
//
//   3. Latest activity year > ORG_HISTORICAL_CUTOFF_YEARS ago → 'historical'.
//      The org last has a documented activity year more than 50 years
//      back. Likely defunct.
//
//   4. Otherwise → 'unknown'. Recent enough to plausibly still operate,
//      but no positive confirmation.
//
// `latestActivityYear` is the latest 4-digit year found anywhere in the
// brief biography (1500-2099 range). `activityText` is the matched
// substring of whichever date pattern fired first (active range, bare
// range, etc.) — used for inline display in the admin UI ("· active 1990s").
//
// Returns { status, activityText, latestActivityYear, reasoning }.
function inferOrganisationStatus (personData) {
  const brief = personData && personData.briefBiography;
  if (!brief) {
    return {
      status: 'active',
      activityText: null,
      latestActivityYear: null,
      reasoning: 'no brief biography to refine status from — preserving default'
    };
  }

  const hasCurrentMarker = /\b(?:current|present)\b/i.test(brief);

  // Pull the matched activity-range substring for display, when present.
  const parsed = parseBriefBiographyDates(brief);
  const activityText = parsed ? parsed.matchedText : null;

  // Latest 4-digit year in brief biography prose. Mirrors the helper used
  // in inferDeathFromAge — same year-pattern, same scope (brief biography
  // only, never main biography). The (?!\d) lookahead is what makes this
  // work for "1990s" — \b would fail because there's no word boundary
  // between '0' and 's'.
  const matches = brief.match(/\b(1[5-9]\d{2}|20\d{2})(?!\d)/g) || [];
  const years = matches.map(Number);
  const latestActivityYear = years.length > 0 ? Math.max.apply(null, years) : null;

  if (hasCurrentMarker) {
    return {
      status: 'active',
      activityText,
      latestActivityYear,
      reasoning: '"current" or "present" marker in brief biography — positive evidence of ongoing operation'
    };
  }

  if (latestActivityYear == null) {
    return {
      status: 'active',
      activityText: null,
      latestActivityYear: null,
      reasoning: 'no parseable years in brief biography — preserving default'
    };
  }

  const cutoffYear = new Date().getFullYear() - ORG_HISTORICAL_CUTOFF_YEARS;
  if (latestActivityYear <= cutoffYear) {
    return {
      status: 'historical',
      activityText,
      latestActivityYear,
      reasoning: 'latest activity year (' + latestActivityYear + ') is more than ' + ORG_HISTORICAL_CUTOFF_YEARS + ' years ago — likely defunct'
    };
  }

  return {
    status: 'unknown',
    activityText,
    latestActivityYear,
    reasoning: 'latest activity year (' + latestActivityYear + ') is recent but no "current" marker — operational status uncertain'
  };
}

// Should the public site suppress this record's biography, based on its
// subject status + the global config flags?
//
// Two independent gates:
//   - Living PEOPLE: suppressed unless `aiBiographyIncludeLiving` is set.
//   - Active / unknown-status COMPANIES + ORGANISATIONS: suppressed unless
//     `aiBiographyIncludeActiveCompanies` is set. Added 2026-08 after
//     curator review — earlier reasoning that "corporations have lower
//     defamation risk" was overturned. A modern corporation whose
//     biography implies continuity with a founder's harmful beliefs can
//     actively deter people from services (MSI Reproductive Choices
//     example — see anti-patterns.md "Modern-successor distancing").
//
// Dissolved companies + deceased people are ALWAYS served regardless of
// either flag — the isLiving check gates suppression entirely.
//
// A missing `subjectType` is treated as person — fail-closed for older
// records that predate the subjectType echo (generated before mid-session).
// Those records opt into the person policy by default; if staff wants to
// release them they can regenerate to populate the field.
//
// Takes the stored subjectStatus shape and the live config; returns bool.
function isSuppressedOnPublicSite (subjectStatus, config) {
  if (!subjectStatus || !subjectStatus.isLiving) return false;
  const t = subjectStatus.subjectType;
  const cfg = config || {};
  if (t === 'company' || t === 'organisation') {
    return !cfg.aiBiographyIncludeActiveCompanies;
  }
  // Person branch (also catches missing subjectType — fail-closed).
  return !cfg.aiBiographyIncludeLiving;
}

module.exports = {
  inspect,
  isSuppressedOnPublicSite,
  HUMAN_LIFESPAN_CAP_YEARS,
  ORG_HISTORICAL_CUTOFF_YEARS
};
