'use strict';

/**
 * Build a deterministic sources summary from the actual data used to generate
 * the biography. No LLM involved — just facts about what was available.
 */
function buildSourcesSummary (personData, relatedItems, wikidataContext, references, qCode) {
  const parts = [];

  // Person record source
  const personFields = [];
  if (personData.birthDate) personFields.push('birth date');
  if (personData.birthPlace) personFields.push('birth place');
  if (personData.deathDate) personFields.push('death date');
  if (personData.deathPlace) personFields.push('death place');
  if (personData.occupation) personFields.push('occupation');
  if (personData.nationality) personFields.push('nationality');
  if (personData.biography) personFields.push('existing biography text');

  parts.push('Person record: ' + (personData.name || 'Unknown') +
    (personFields.length ? ' (' + personFields.join(', ') + ')' : ' (name only)'));

  // Collection items
  const items = relatedItems || [];
  const objects = items.filter(function (i) { return i.type === 'object'; });
  const documents = items.filter(function (i) { return i.type === 'document'; });

  if (items.length > 0) {
    const itemParts = [];
    if (objects.length) itemParts.push(objects.length + ' object' + (objects.length > 1 ? 's' : ''));
    if (documents.length) itemParts.push(documents.length + ' document' + (documents.length > 1 ? 's' : ''));
    parts.push('Collection items: ' + itemParts.join(', ') + ' linked to this person');

    // List referenced items with IDs and URLs
    const refs = references || [];
    if (refs.length > 0) {
      parts.push('Referenced in biography: ' + refs.map(function (ref) {
        return ref.title + ' (' + ref.id + ')';
      }).join('; '));
    }
  } else {
    parts.push('Collection items: none linked');
  }

  // Related people & organisations
  const people = personData.relatedPeople || [];
  if (people.length > 0) {
    parts.push('Related people/organisations: ' + people.length + ' linked (' +
      people.map(function (p) {
        const role = p.role ? ' [' + p.role + ']' : '';
        return p.name + ' (' + p.id + ')' + role;
      }).join('; ') + ')');
  }

  // Wikidata
  if (wikidataContext) {
    const wdFields = Object.keys(wikidataContext).filter(function (k) {
      return wikidataContext[k] && k !== 'wikipediaUrl';
    });
    const qLabel = qCode ? ' ' + qCode : '';
    parts.push('Wikidata' + qLabel + ': ' + wdFields.length + ' propert' +
      (wdFields.length === 1 ? 'y' : 'ies') +
      ' (' + wdFields.slice(0, 8).join(', ') + ')');
    if (wikidataContext.wikipediaUrl) {
      parts.push('Wikipedia: ' + wikidataContext.wikipediaUrl);
    }
  } else if (qCode) {
    parts.push('Wikidata: ' + qCode + ' (fetch failed)');
  } else {
    parts.push('Wikidata: no Q-code on record');
  }

  return parts.join('. ') + '.';
}

module.exports = buildSourcesSummary;
