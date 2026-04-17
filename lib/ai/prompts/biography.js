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
  '4. When mentioning collection objects, documents, or related people/organisations, ALWAYS use the item\'s title as the link text — NEVER use IDs like co12345 in visible text. Wrap in HTML anchor tags, e.g. <a href="/objects/co12345">Bust of Albert Einstein</a>. If you cannot link an item properly, refer to it by title only without a link.',
  '5. Keep the biography to 2-3 short paragraphs. Each paragraph MUST be wrapped in <p> tags.',
  '6. Do not repeat information that is already displayed elsewhere on the page (dates, birthplace, occupation are shown in the sidebar).',
  '7. Focus on the person\'s significance and their connection to the museum\'s collection.',
  '8. If the data is too thin to write a full biography, return a single <p> sentence summarising what is known and set confidence to "medium". Only set confidence to "low" if there is virtually no usable data at all.',
  '9. Return valid JSON only — no markdown fences, no commentary.'
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

  parts.push('');
  parts.push('RELATED PEOPLE & ORGANISATIONS (formally linked in our records):');
  if (personData.relatedPeople && personData.relatedPeople.length > 0) {
    personData.relatedPeople.forEach(function (person, i) {
      const role = person.role ? ' (Relationship: ' + person.role + ')' : '';
      parts.push((i + 1) + '. "' + person.name + '" (ID: ' + person.id + ', URL: ' + person.link + ')' + role);
    });
  } else {
    parts.push('(No related people or organisations linked)');
  }

  if (wikidataContext) {
    parts.push('');
    parts.push(formatWikidata(wikidataContext));
  }

  parts.push('');
  parts.push('Return JSON in this exact shape (replace placeholder values with your generated content):');
  parts.push('{');
  parts.push('  "biography": "<p>...biography paragraphs...</p>",');
  parts.push('  "context": "<p>...collection context with <a> links...</p>",');
  parts.push('  "referencedItems": [ {"id": "<id from the data above>", "title": "<exact title from the data above>", "type": "object|document|people"} ],');
  parts.push('  "confidence": "high|medium|low"');
  parts.push('}');
  parts.push('');
  parts.push('The "biography" field should be 2-3 paragraphs about the person themselves.');
  parts.push('The "context" field should describe their connection to the museum\'s collection, referencing specific objects/documents with <a> links using the item TITLE as link text, never the ID.');
  parts.push('Only include items in referencedItems if you mentioned them using an <a> tag.');
  parts.push('IMPORTANT: Never show IDs (co12345, cp12345) in the visible text. They are for URLs only.');
  parts.push('Set confidence to "low" if there is not enough data for a meaningful biography.');

  return parts.join('\n');
}

function formatWikidata (wikidataCache) {
  const parts = ['ADDITIONAL BIOGRAPHICAL PROPERTIES:'];
  // Only pass structured facts — skip images, URLs, and identifiers that could
  // trigger the model to use training knowledge instead of provided data
  const skip = {
    P18: true,
    P154: true,
    imageMetadata: true,
    wikidataUrl: true,
    wikipediaUrl: true,
    alsoInCollection: true,
    externalIdentifiers: true,
    description: true // Often just repeats what we already provide
  };

  Object.keys(wikidataCache).forEach(function (key) {
    if (skip[key]) return;
    const val = wikidataCache[key];
    if (typeof val === 'string') {
      parts.push(key + ': ' + val);
    } else if (val && val.value) {
      parts.push(key + ': ' + val.value);
    }
  });

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
