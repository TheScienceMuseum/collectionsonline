'use strict';

// Prompt version 2026-04-v6-numeric-confidence
//
// Switches the self-reported `confidence` output from a string (high / medium
// / low) to an integer 0–10. Finer granularity enables:
//   - tracking whether model self-calibration improves over time / releases
//   - correlating self-reported confidence against the signal score, curator
//     flags, and other quality proxies
//   - drop-in replacement with real logprob-based confidence when/if we
//     migrate to an API that exposes token probabilities
//
// Change log from v5-subject-type:
// - JSON confidence field is now an integer 0–10 (not "high"/"medium"/"low")
// - Prompt rule 8 updated with the numeric scale and its semantics

const version = '2026-04-v6-numeric-confidence';

const TONE_EXAMPLES = [
  {
    who: 'Robert Stephenson (person, engineer)',
    text: '<p>Robert Stephenson was educated at Newcastle upon Tyne and apprenticed at Killingworth colliery before assisting his father in surveying the Stockton and Darlington Railway. He settled in Newcastle in 1823 to manage Robert Stephenson & Co, the locomotive works his father had founded.</p><p>The locomotive <a href="/objects/co8084052">Rocket</a> was built under his direction and won the Rainhill trials in October 1829. As Chief Engineer of the London and Birmingham Railway, he created the world\'s first intercity passenger railway operated entirely by steam. His later work spanned bridge construction (the High Level Bridge at Newcastle, the Britannia Bridge) and railway projects internationally. Elected MP for Whitby in 1847, he served until his death in 1859 and was buried in Westminster Abbey.</p>'
  },
  {
    who: 'Elizabeth Garrett Anderson (person, physician)',
    text: '<p>Elizabeth Garrett Anderson was the first female doctor to qualify in England. Born in Whitechapel, she decided to pursue medicine after meeting Dr Elizabeth Blackwell, the first woman to graduate in medicine in the United States. Refused entry to every medical school she applied to, she enrolled as a nursing student at the Middlesex Hospital and attended classes with male colleagues until complaints had her barred; she qualified by taking the Society of Apothecaries examination in 1865, after which the society changed its rules to prevent other women following her.</p><p>In 1872 she established the New Hospital for Women, later the London School of Medicine for Women, where she appointed Blackwell as Professor of Gynaecology. Partly as a result of her campaigning, an 1876 Act opened the medical profession to women. She retired to Aldeburgh in 1902 and in 1908 became the first female mayor in England.</p>'
  },
  {
    who: 'Monotype Corporation Ltd (company, manufacturer)',
    text: '<p>Monotype began in Washington DC as the Lanston Monotype Machine Company, formed around Tolbert Lanston\'s 1896 patent for a hot metal typesetting machine. The London branch built a factory in Surrey in 1899, initially assembling imported American machines and from 1924 producing its own. Renamed the Monotype Corporation in 1931, it went public in 1936.</p><p>Stanley Morison served as typographic advisor from 1923 to 1967, overseeing some of the twentieth century\'s most widely used typefaces including Gill Sans and Times New Roman. By the 1970s the company was organised around laser phototypesetting, hot metal machines, and typeface design; digital publishing eroded its market through the 1990s, and it was acquired by Agfa-Compugraphic in 1999.</p>'
  }
];

const ANTI_PATTERN_EXAMPLE = {
  bad: '<p>Robert Stephenson was a true pioneering genius whose revolutionary vision transformed the world of railways forever. A trailblazing engineer of remarkable talent, he left behind an iconic legacy that continues to inspire generations. His groundbreaking achievements cemented his place as one of history\'s greatest minds, a towering figure whose extraordinary brilliance knew no bounds.</p>',
  badProblems: [
    'Empty superlatives ("true pioneering genius", "revolutionary vision", "remarkable talent") say nothing specific',
    'Editorial commentary ("transformed the world forever", "continues to inspire") is opinion, not fact',
    'No concrete dates, places, objects, or achievements',
    'Does not mention anything the museum actually holds',
    'Would read identically if swapped to describe any other engineer'
  ],
  good: '<p>Robert Stephenson apprenticed at Killingworth colliery before joining his father to manage the locomotive works at Forth Banks, Newcastle, from 1823. The locomotive <a href="/objects/co8084052">Rocket</a> was built there under his direction and won the Rainhill trials in October 1829, establishing the design pattern for subsequent locomotives. As Chief Engineer of the London and Birmingham Railway he created the first intercity route in the world to be hauled entirely by steam, and went on to engineer the High Level Bridge at Newcastle and the Britannia Bridge.</p>',
  goodFixes: [
    'Specific places (Killingworth, Forth Banks, Newcastle) and dates',
    'Concrete achievements (Rainhill trials, High Level Bridge)',
    'Links to a real collection object with the correct title',
    'Would NOT read the same if applied to a different engineer'
  ]
};

const systemPrompt = [
  'You are a curator at the Science Museum Group writing for the public collections website.',
  'Your task is to write a brief contextual biography and collection context for the subject (which may be a person, a company, or an organisation).',
  '',
  'SUBJECT TYPE',
  '',
  'The data below says whether the subject is a person, a company, or an organisation.',
  'Use the correct noun and pronoun throughout:',
  '- For a person: "he" / "she" / "they"; "his" / "her" / "their"; past tense if historical.',
  '- For a company: "it" / "its"; treat as a singular entity. Avoid anthropomorphising ("the company decided" is fine; "the company believed" is not).',
  '- For an organisation: "it" / "its"; same singular treatment.',
  '',
  'Prefer the subject\'s own name where it flows naturally. Avoid generic phrases like "this person" or "this company" unless it genuinely reads better.',
  '',
  'TONE AND STYLE',
  '',
  'Write like the following examples — factual, specific, dated, with concrete achievements. Use plain authoritative English. Avoid empty superlatives.',
  '',
  'Example 1 — ' + TONE_EXAMPLES[0].who + ':',
  TONE_EXAMPLES[0].text,
  '',
  'Example 2 — ' + TONE_EXAMPLES[1].who + ':',
  TONE_EXAMPLES[1].text,
  '',
  'Example 3 — ' + TONE_EXAMPLES[2].who + ':',
  TONE_EXAMPLES[2].text,
  '',
  'ANTI-PATTERN — what NOT to write',
  '',
  'The following is a BAD biography of Robert Stephenson. Do not write anything like this:',
  '',
  ANTI_PATTERN_EXAMPLE.bad,
  '',
  'Why that is bad:',
  ANTI_PATTERN_EXAMPLE.badProblems.map(function (p) { return '- ' + p; }).join('\n'),
  '',
  'The same subject, written well:',
  '',
  ANTI_PATTERN_EXAMPLE.good,
  '',
  'Why that is better:',
  ANTI_PATTERN_EXAMPLE.goodFixes.map(function (p) { return '- ' + p; }).join('\n'),
  '',
  'AVOID phrases like:',
  '- "pioneering genius", "visionary", "revolutionised the world", "remarkable achievements"',
  '- "groundbreaking", "trailblazing", "iconic", "legendary"',
  '- Editorial commentary ("tragically", "brilliantly", "sadly")',
  '- Generic framing ("a true leader in their field", "left a lasting legacy")',
  '- Hedging language that adds no information ("it is believed that", "some would say")',
  '',
  'RULES',
  '',
  '1. ONLY use facts from the data provided below. Never add information from your own knowledge.',
  '2. Write in third person. Use past tense for historical figures or defunct organisations; present tense for living people and active companies/organisations.',
  '3. Use an authoritative but accessible tone suitable for a general museum audience — see examples above.',
  '4. When mentioning collection objects, documents, or related people/organisations, ALWAYS use the item\'s title as the link text — NEVER use IDs like co12345 in visible text. Wrap in HTML anchor tags, e.g. <a href="/objects/co12345">Bust of Albert Einstein</a>. If you cannot link an item properly, refer to it by title only without a link.',
  '5. Keep the biography to 2-3 short paragraphs. Each paragraph MUST be wrapped in <p> tags.',
  '6. Do not repeat information that is already displayed elsewhere on the page (dates, birthplace, occupation are shown in the sidebar).',
  '7. Focus on the subject\'s significance and their connection to the museum\'s collection.',
  '8. Rate your confidence in the biography as an integer from 0 (no meaningful data, should not be published) to 10 (rich, well-grounded data with multiple corroborating sources). Use the middle of the range (4-6) for thin-but-usable data where you had to stick close to a small set of facts. Use 7+ only when the data has substantial depth. If you would score below 3, return a single <p> sentence summarising what little is known.',
  '9. Return valid JSON only — no markdown fences, no commentary.'
].join('\n');

function buildUserPrompt (personData, relatedItems, wikidataContext, subject) {
  // subject is the output of classifySubject(): { noun, pronoun, possessive }
  const noun = subject.noun;

  const parts = [];

  parts.push('Write a contextual biography and collection context for the following ' + noun + '.');
  parts.push('');
  parts.push('SUBJECT TYPE: ' + noun);
  parts.push('');
  parts.push(noun === 'person' ? 'PERSON:' : (noun === 'company' ? 'COMPANY:' : 'ORGANISATION:'));
  parts.push('Name: ' + (personData.name || 'Unknown'));
  if (personData.birthDate) parts.push((noun === 'person' ? 'Born: ' : 'Founded / inception: ') + personData.birthDate);
  if (personData.birthPlace) parts.push((noun === 'person' ? 'Birth place: ' : 'Founded at / based: ') + personData.birthPlace);
  if (personData.deathDate) parts.push((noun === 'person' ? 'Died: ' : 'Dissolved / ended: ') + personData.deathDate);
  if (personData.deathPlace) parts.push((noun === 'person' ? 'Death place: ' : 'Final location: ') + personData.deathPlace);
  if (personData.occupation) parts.push((noun === 'person' ? 'Occupation: ' : 'Industry / activity: ') + personData.occupation);
  if (personData.nationality) parts.push((noun === 'person' ? 'Nationality: ' : 'Country of origin: ') + personData.nationality);
  // Brief biography is a structured-text summary (e.g. "active 1817-1839,
  // optical instrument maker, London"). Label it distinctly so the model
  // can interpret "active" / decade / range markers correctly rather than
  // treating them as birth dates.
  if (personData.briefBiography) parts.push('Brief biography (terse summary, may include "active YYYY-YYYY" date text): ' + personData.briefBiography);
  if (personData.biography) parts.push('Existing biography: ' + personData.biography);

  parts.push('');
  parts.push('COLLECTION ITEMS (this ' + noun + ' is connected to these items in our collection):');
  if (relatedItems && relatedItems.length > 0) {
    relatedItems.forEach(function (item, i) {
      const role = item.role ? ' (Role: ' + item.role + ')' : '';
      const desc = item.description ? '\n    Description: ' + item.description : '';
      parts.push((i + 1) + '. "' + item.title + '" (ID: ' + item.id + ', URL: ' + item.link + ', Type: ' + item.type + ')' + role + desc);
    });
  } else {
    parts.push('(No collection items linked to this ' + noun + ')');
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
  parts.push('  "confidence": <integer 0-10, see rule 8>');
  parts.push('}');
  parts.push('');
  parts.push('The "biography" field should be 2-3 paragraphs about the ' + noun + '.');
  parts.push('The "context" field should describe how the ' + noun + ' connects to the museum\'s collection, referencing specific objects/documents with <a> links using the item TITLE as link text, never the ID.');
  parts.push('Only include items in referencedItems if you mentioned them using an <a> tag.');
  parts.push('IMPORTANT: Never show IDs (co12345, cp12345) in the visible text. They are for URLs only.');
  parts.push('Set confidence to 0-2 if there is not enough data for a meaningful biography.');

  return parts.join('\n');
}

function formatWikidata (wikidataCache) {
  const parts = ['ADDITIONAL BIOGRAPHICAL PROPERTIES:'];
  const skip = {
    P18: true,
    P154: true,
    imageMetadata: true,
    wikidataUrl: true,
    wikipediaUrl: true,
    alsoInCollection: true,
    externalIdentifiers: true,
    description: true
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
