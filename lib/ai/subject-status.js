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
//     deathDate: string | null,         // raw value if known
//     deathDateSource: 'internal' | 'wikidata' | null,
//     deathDateInternal: string | null,
//     deathDateWikidata: string | null
//   }

function inspect (personData, wikidataContext, subjectType) {
  // subjectType: 'person' | 'company' | 'organisation' (from classify-subject)
  const isPerson = subjectType === 'person';

  const internalDeath = (personData && personData.deathDate) || null;

  // Wikidata death / dissolution — already normalised via fetch-wikidata-live.
  // Wikidata can return multiple values joined by ", " (e.g. a company that
  // had two dissolution events). Take just the first — generally the most
  // meaningful (original date; later ones tend to be restructuring artefacts).
  const firstValue = function (v) { return v ? String(v).split(',')[0].trim() : null; };
  const wikidataDeath = firstValue(wikidataContext && wikidataContext['date of death'] && wikidataContext['date of death'].value);
  const wikidataDissolved = firstValue(wikidataContext && wikidataContext.dissolved && wikidataContext.dissolved.value);
  const wikidataEnd = isPerson ? wikidataDeath : (wikidataDissolved || wikidataDeath);

  const deathDate = internalDeath || wikidataEnd;
  const deathDateSource = internalDeath ? 'internal' : (wikidataEnd ? 'wikidata' : null);

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
    deathDate,
    deathDateSource,
    deathDateInternal: internalDeath,
    deathDateWikidata: wikidataEnd
  };
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

module.exports = { inspect, isSuppressedOnPublicSite };
