'use strict';

const getNestedProperty = require('../nested-property');

/**
 * Flatten arbitrarily-nested occupation/nationality shapes to a comma-separated
 * string. Handles: string, array of strings, array of {value}, object {value}.
 * Always returns a string (empty if no useful content found).
 */
function flattenToString (raw) {
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    return raw
      .map(flattenToString)
      .filter(function (s) { return s; })
      .join(', ');
  }
  if (typeof raw === 'object' && raw.value !== undefined) {
    return flattenToString(raw.value);
  }
  return '';
}

function extractPersonData (source) {
  const title = getNestedProperty({ attributes: source }, 'attributes.summary.title') || '';

  // Internal distinction is person vs organisation. /people pages cover both
  // plus companies; organisation-vs-company can only be refined via Wikidata
  // downstream. Keep this field narrow ('person' | 'organisation').
  const datatypeActual = getNestedProperty({ attributes: source }, 'attributes.@datatype.actual');
  const subTypeFirst = getNestedProperty({ attributes: source }, 'attributes.type.sub_type.0');
  const typeType = getNestedProperty({ attributes: source }, 'attributes.type.type');
  const isOrganisation = (
    datatypeActual === 'organisation' ||
    subTypeFirst === 'organisation' ||
    typeType === 'institution'
  );
  const entityType = isOrganisation ? 'organisation' : 'person';

  const birthDate = getNestedProperty({ attributes: source }, 'attributes.birth.date.value') ||
    getNestedProperty({ attributes: source }, 'attributes.birth.date.to') || '';
  const birthPlace = getNestedProperty({ attributes: source }, 'attributes.birth.place.name.0.value') || '';
  const deathDate = getNestedProperty({ attributes: source }, 'attributes.death.date.value') ||
    getNestedProperty({ attributes: source }, 'attributes.death.date.to') || '';
  const deathPlace = getNestedProperty({ attributes: source }, 'attributes.death.place.name.0.value') || '';

  // occupation shape varies: string, array of strings, array of {value: string},
  // or object {value: string | string[]}. Flatten to a comma-separated string.
  const occupationRaw = getNestedProperty({ attributes: source }, 'attributes.occupation');
  const occupation = flattenToString(occupationRaw);

  const nationalityRaw = getNestedProperty({ attributes: source }, 'attributes.nationality');
  const nationality = flattenToString(nationalityRaw);

  // Separate the two distinct prose fields. Mimsy/AdLib stores them as
  // typed entries inside `description[]`:
  //   - "biography"        — long-form curatorial text
  //   - "brief biography"  — terse structured-ish summary, often containing
  //                          "active YYYY-YYYY" date text, occupation,
  //                          location and nationality. Around 99% of agent
  //                          records have one. For records with no structured
  //                          birth/death dates, the brief biography is
  //                          frequently the only place the dates exist.
  // We surface them as separate fields so prompts can label them distinctly
  // (the LLM can interpret "active 1817" differently from "born 1817") and
  // so the admin UI can show them with separate char counts.
  const descArr = Array.isArray(source.description) ? source.description : [];
  let biography = '';
  let briefBiography = '';
  descArr.forEach(function (d) {
    if (!d || !d.value) return;
    const t = (d.type || '').toLowerCase();
    if (t === 'brief biography') {
      briefBiography = d.value;
    } else if (t === 'biography' || d.primary) {
      // Last-write-wins is fine — multiple primary entries are extremely rare,
      // and getPrimaryValue elsewhere also picks the first match arbitrarily.
      if (!biography) biography = d.value;
    }
  });
  // Fall back to the first entry if neither typed match found anything —
  // mirrors the previous behaviour and getFirst() in templates.
  if (!biography && !briefBiography && descArr[0] && descArr[0].value) {
    biography = descArr[0].value;
  }
  // descriptionChars must reflect what the PUBLIC visitor actually sees in
  // description.primary. Mirrors lib/get-primary-value.js: when no entry
  // has type='biography' or primary:true, the public template falls back
  // via getFirst(array) — for records whose only description is a brief
  // biography (e.g. cp38424), the brief reaches the page through that
  // fallback. The aiBiographySuppressExistingChars threshold has to be
  // measured against rendered text or it suppresses content the visitor
  // is currently seeing.
  const descriptionChars = (biography || briefBiography).length;
  const briefBiographyChars = briefBiography.length;

  const name = title;
  const wikidata = source.wikidata || null;

  // Extract related people and organisations from the agent field
  const relatedPeople = [];
  const agentArr = source.agent || [];
  if (Array.isArray(agentArr)) {
    agentArr.forEach(function (a) {
      if (!a || !a['@admin']) return;
      const uid = a['@admin'].uid || '';
      const agentName = (a.summary && a.summary.title) || '';
      const role = (a['@link'] && a['@link'].role && Array.isArray(a['@link'].role))
        ? a['@link'].role.map(function (r) { return r.value || r; }).join(', ')
        : '';
      if (uid && agentName) {
        relatedPeople.push({
          id: uid.replace(/^(cp|ap)/, '$1'),
          name: agentName,
          role,
          link: '/people/' + uid
        });
      }
    });
  }

  // Also check organisations field
  const orgArr = source.organisations || [];
  if (Array.isArray(orgArr)) {
    orgArr.forEach(function (o) {
      if (!o || !o['@admin']) return;
      const uid = o['@admin'].uid || '';
      const orgName = (o.summary && o.summary.title) || '';
      const role = (o['@link'] && o['@link'].role && Array.isArray(o['@link'].role))
        ? o['@link'].role.map(function (r) { return r.value || r; }).join(', ')
        : '';
      if (uid && orgName) {
        relatedPeople.push({
          id: uid.replace(/^(cp|ap)/, '$1'),
          name: orgName,
          role,
          link: '/people/' + uid
        });
      }
    });
  }

  return {
    name,
    title,
    entityType, // 'person' | 'organisation'
    birthDate,
    birthPlace,
    deathDate,
    deathPlace,
    occupation,
    nationality,
    biography,
    briefBiography,
    descriptionChars,
    briefBiographyChars,
    wikidata,
    relatedPeople
  };
}

module.exports = extractPersonData;
