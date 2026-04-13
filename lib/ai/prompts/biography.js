'use strict';

const version = '1.0.0';

const systemPrompt = [
  'You are a curator at the Science Museum Group writing for the public collections website.',
  'Your task is to write a brief contextual biography and collection context for a person or organisation.',
  '',
  'Rules:',
  '1. ONLY use facts from the data provided below. Never add information from your own knowledge.',
  '2. Write in third person. Use past tense for historical figures, present tense for living people or active organisations.',
  '3. Use an authoritative but accessible tone suitable for a general museum audience.',
  '4. When mentioning collection objects or documents, wrap them in HTML anchor tags using the exact URL provided, e.g. <a href="/objects/co12345">Object Title</a>.',
  '5. Do not repeat information that is already displayed elsewhere on the page (dates, birthplace, occupation are shown in the sidebar).',
  '6. Focus on the person\'s significance and their connection to the museum\'s collection.',
  '7. Return valid JSON only — no markdown fences, no commentary.',
  '8. If you do not have enough information to write a meaningful biography, set confidence to "low".',
  '9. In sourcesSummary, briefly explain which data sources you used and what key facts came from where.'
].join('\n');

function buildUserPrompt (personData, relatedItems, wikidataContext) {
  const parts = [];

  parts.push('Write a contextual biography and collection context for the following person/organisation.');
  parts.push('');
  parts.push('PERSON:');
  parts.push('Name: ' + (personData.name || 'Unknown'));
  if (personData.birthDate) parts.push('Born: ' + personData.birthDate);
  if (personData.birthPlace) parts.push('Birth place: ' + personData.birthPlace);
  if (personData.deathDate) parts.push('Died: ' + personData.deathDate);
  if (personData.deathPlace) parts.push('Death place: ' + personData.deathPlace);
  if (personData.occupation) parts.push('Occupation: ' + personData.occupation);
  if (personData.nationality) parts.push('Nationality: ' + personData.nationality);
  if (personData.biography) parts.push('Existing biography: ' + personData.biography);

  parts.push('');
  parts.push('COLLECTION ITEMS (this person is connected to these items in our collection):');
  if (relatedItems && relatedItems.length > 0) {
    relatedItems.forEach(function (item, i) {
      const role = item.role ? ' (Role: ' + item.role + ')' : '';
      parts.push((i + 1) + '. "' + item.title + '" (ID: ' + item.id + ', URL: ' + item.link + ', Type: ' + item.type + ')' + role);
    });
  } else {
    parts.push('(No collection items linked to this person)');
  }

  if (wikidataContext) {
    parts.push('');
    parts.push(formatWikidata(wikidataContext));
  }

  parts.push('');
  parts.push('Return JSON in this exact format:');
  parts.push('{');
  parts.push('  "biography": "<p>2-3 paragraphs about the person, their significance and achievements</p>",');
  parts.push('  "context": "<p>How this person connects to the museum collection, mentioning specific objects with links</p>",');
  parts.push('  "referencedItems": [{"id": "co12345", "title": "Exact Item Title", "type": "object"}],');
  parts.push('  "confidence": "high|medium|low",');
  parts.push('  "sourcesSummary": "Brief description of what data sources informed this biography"');
  parts.push('}');
  parts.push('');
  parts.push('The "biography" field should be 2-3 paragraphs about the person themselves.');
  parts.push('The "context" field should describe their connection to the museum\'s collection, referencing specific objects/documents with <a> links.');
  parts.push('Only include items in referencedItems if you mentioned them using an <a> tag.');
  parts.push('Set confidence to "low" if there is not enough data for a meaningful biography.');

  return parts.join('\n');
}

function formatWikidata (wikidataCache) {
  const parts = ['WIKIDATA PROPERTIES:'];
  const skip = { P18: true, P154: true, imageMetadata: true, wikidataUrl: true, alsoInCollection: true, externalIdentifiers: true };

  Object.keys(wikidataCache).forEach(function (key) {
    if (skip[key]) return;
    const val = wikidataCache[key];
    if (typeof val === 'string') {
      parts.push(key + ': ' + val);
    } else if (val && val.value) {
      parts.push(key + ': ' + val.value);
    }
  });

  if (wikidataCache.wikipediaUrl) {
    parts.push('Wikipedia: ' + wikidataCache.wikipediaUrl);
  }

  if (wikidataCache.colleagues && wikidataCache.colleagues.length > 0) {
    let colleagueNames = [];
    wikidataCache.colleagues.forEach(function (group) {
      (group.colleagues || []).forEach(function (c) {
        colleagueNames.push(c.name);
      });
    });
    colleagueNames = colleagueNames.slice(0, 10);
    if (colleagueNames.length) {
      parts.push('Known colleagues: ' + colleagueNames.join(', '));
    }
  }

  return parts.length > 1 ? parts.join('\n') : '';
}

module.exports = {
  version,
  systemPrompt,
  buildUserPrompt
};
