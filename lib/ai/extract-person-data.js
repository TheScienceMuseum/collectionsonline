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
    const bioEntry = descArr.find(function (d) {
      return d.type === 'biography' || d.type === 'brief biography';
    });
    if (bioEntry) {
      biography = bioEntry.value || '';
    }
    // Calculate total description chars across all entries
    descriptionChars = descArr.reduce(function (sum, d) {
      return sum + (d.value ? d.value.length : 0);
    }, 0);
  }

  const name = title;
  const wikidata = source.wikidata || null;

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
    wikidata
  };
}

module.exports = extractPersonData;
