'use strict';

// Determine whether the subject (person, company, or organisation) is
// currently living / active, based on internal ES data with Wikidata as a
// fallback. Our ES records can lag real-world events, so the Wikidata
// fallback catches recent deaths or dissolutions that haven't made it into
// the museum's catalogue yet.
//
// Returns:
//   {
//     status: 'active' | 'deceased' | 'dissolved',
//     isLiving: true | false,           // true = living person or active org
//     subjectType: 'person' | 'company' | 'organisation' | null,
//                                       // echoed from the caller so downstream
//                                       // UI can distinguish a living person
//                                       // ("living") from an active org
//                                       // ("active") without re-classifying
//     birthDate: string | null,                   // raw value if known
//     birthDateSource: 'internal' | 'wikidata' | null,
//     deathDate: string | null,                   // raw value if known
//     deathDateSource:                            // 'internal' | 'wikidata' |
//       'internal' | 'wikidata' |                 // 'inferred-from-birth' |
//       'inferred-from-birth' |                   // 'inferred-from-brief-biography' | null
//       'inferred-from-brief-biography' | null,
//     deathDateInternal: string | null,
//     deathDateWikidata: string | null,
//     deathDateInferred: string | null,           // year used by the inference path
//     deathDateInferredReasoning: string | null   // human-readable rationale
//   }

// Conservative cap on human lifespan. The oldest verified human (Jeanne
// Calment) reached 122; using 110 leaves ample margin. If any dated
// information about a subject puts them definitively before
// (current year - 110), we treat them as deceased even when no death
// date is recorded. Affects ONLY the living-person policy decision —
// not the structured personData passed to the LLM.
const HUMAN_LIFESPAN_CAP_YEARS = 110;

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
  if (deathDate) {
    status = isPerson ? 'deceased' : 'dissolved';
  } else {
    status = 'active';
  }
  const isLiving = !deathDate;

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
    deathDateInferredReasoning: inferred ? inferred.reasoning : null
  };
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
    const matches = personData.briefBiography.match(/\b(1[5-9]\d{2}|20\d{2})\b/g) || [];
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

// Should the public site suppress this record's biography, based on its
// subject status + the global living-person config flag?
//
// Rule: only applies to living PEOPLE. Active companies / organisations
// always serve regardless of `aiBiographyIncludeLiving` — defamation risk
// is lower for corporations and dissolution dates are unreliably recorded
// (many catalogue records marked "active" are actually defunct).
//
// A missing `subjectType` is treated as person — fail-closed for older
// records that predate the subjectType echo (generated before mid-session).
// Those records opt into the policy by default; if staff wants to release
// them they can regenerate to populate the field.
//
// Takes the stored subjectStatus shape and the live config; returns bool.
function isSuppressedOnPublicSite (subjectStatus, config) {
  if (!subjectStatus || !subjectStatus.isLiving) return false;
  if (config && config.aiBiographyIncludeLiving) return false;
  const t = subjectStatus.subjectType;
  if (t === 'company' || t === 'organisation') return false;
  return true;
}

module.exports = { inspect, isSuppressedOnPublicSite, HUMAN_LIFESPAN_CAP_YEARS };
