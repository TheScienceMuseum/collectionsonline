'use strict';

const getNestedProperty = require('../nested-property');

function extractPersonData (source) {
  const title = getNestedProperty({ attributes: source }, 'attributes.summary.title') || '';

  const birthDate = getNestedProperty({ attributes: source }, 'attributes.birth.date.value') ||
    getNestedProperty({ attributes: source }, 'attributes.birth.date.to') || '';
  const birthPlace = getNestedProperty({ attributes: source }, 'attributes.birth.place.name.0.value') || '';
  const deathDate = getNestedProperty({ attributes: source }, 'attributes.death.date.value') ||
    getNestedProperty({ attributes: source }, 'attributes.death.date.to') || '';
  const deathPlace = getNestedProperty({ attributes: source }, 'attributes.death.place.name.0.value') || '';

  const occupationArr = getNestedProperty({ attributes: source }, 'attributes.occupation');
  let occupation = '';
  if (occupationArr) {
    occupation = Array.isArray(occupationArr)
      ? occupationArr.map(function (o) { return o.value || o; }).join(', ')
      : occupationArr;
  }

  const nationalityArr = getNestedProperty({ attributes: source }, 'attributes.nationality');
  const nationality = nationalityArr && nationalityArr[0] ? nationalityArr[0] : '';

  const descArr = source.description || [];
  let biography = '';
  let descriptionChars = 0;
  if (Array.isArray(descArr)) {
    // Collect all description text for the prompt — gives the LLM full context
    const bioTexts = descArr
      .filter(function (d) { return d.value; })
      .map(function (d) { return d.value; });
    biography = bioTexts.join('. ');
    // Count chars from the primary description actually shown on the page.
    // Mirrors getPrimaryValue: first look for type=biography or primary=true,
    // if none found fall back to the first entry (which getFirst returns).
    const primaryEntries = descArr.filter(function (d) {
      return d.type === 'biography' || d.primary;
    });
    if (primaryEntries.length > 0) {
      descriptionChars = primaryEntries[0].value ? primaryEntries[0].value.length : 0;
    } else if (descArr[0] && descArr[0].value) {
      descriptionChars = descArr[0].value.length;
    }
  }

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
    birthDate,
    birthPlace,
    deathDate,
    deathPlace,
    occupation,
    nationality,
    biography,
    descriptionChars,
    wikidata,
    relatedPeople
  };
}

module.exports = extractPersonData;
