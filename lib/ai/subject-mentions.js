'use strict';

// Sentences from a related item's OTHER catalogue descriptions (the web
// description, mostly) that name the biography's subject.
//
// The writer sees each item's primary description, which is usually the
// short "catalogue description". When that text doesn't say how the item
// connects to the subject, the longer web description often does — e.g.
// the Dolly the sheep jumper linked to Portman Building Society (sponsor):
// only the web description says the design competition was "supported by
// Portman Building Society". Passing the whole web description would add
// 2-3K tokens per prompt for ~1% of items that need it, so we pass only the
// sentences that name the subject.
//
// Matching is on the subject's name as the catalogue link records it, plus
// the surname for a person's name. The item is already linked to this
// subject, so a sentence naming them is very likely about them; a stray
// surname match costs a sentence of context, not a claim.

const { isSentenceEnd } = require('./truncate-description');
const truncateAtSentence = require('./truncate-description');

const MAX_SENTENCES = 2;
const MAX_SENTENCE_CHARS = 300;
const MAX_TOTAL_CHARS = 500;

// Words that mark a name as an organisation's, not a person's — no
// surname variant for those ("Portman Building Society" must not match
// a bare "Society").
const ORG_WORDS = new Set([
  'ltd', 'limited', 'company', 'co', 'corporation', 'corp', 'inc', 'plc',
  'society', 'railway', 'railways', 'institute', 'institution', 'trust',
  'museum', 'university', 'college', 'school', 'hospital', 'works',
  'brothers', 'bros', 'sons', 'board', 'council', 'department', 'office',
  'association', 'club', 'group', 'industries', 'bank', 'agency', 'service',
  'services', 'studio', 'studios', 'press', 'commission', 'authority',
  'ministry', 'committee', 'laboratory', 'laboratories', 'foundation',
  'federation', 'union', 'league', 'partnership', 'archive', 'library',
  'observatory', 'academy', 'guild', 'syndicate', 'factory', 'mill', 'mills',
  'engineering', 'manufacturing', 'motors', 'and', '&', 'of', 'the'
]);

function escapeRegExp (s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Full name (brackets dropped), "Forename Surname" for a "Surname,
// Forename" form, and the surname alone for what looks like a person's
// name.
function nameVariants (name) {
  if (typeof name !== 'string') return [];
  const clean = name.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const variants = [clean];

  let tokens;
  let surname;
  let inverted = null;
  const comma = clean.split(',').map(function (p) { return p.trim(); }).filter(Boolean);
  if (comma.length === 2) {
    inverted = comma[1] + ' ' + comma[0];
    tokens = inverted.split(' ');
    surname = comma[0].split(' ').pop();
  } else {
    tokens = clean.split(' ');
    surname = tokens[tokens.length - 1];
  }

  const looksLikePerson = tokens.length >= 2 && tokens.length <= 5 &&
    tokens.every(function (t) { return !ORG_WORDS.has(t.toLowerCase().replace(/[.,]/g, '')); });
  if (looksLikePerson && inverted) variants.push(inverted);
  if (looksLikePerson && surname && /^\p{Lu}[\p{L}'’-]{3,}$/u.test(surname)) {
    variants.push(surname);
  }

  return Array.from(new Set(variants));
}

// "Sir F. Chantrey", "J. Smith": a single capital before the full stop is
// an initial, not a sentence end.
function isInitial (para, i) {
  return para[i] === '.' && /\p{Lu}/u.test(para[i - 1] || '') &&
    (i < 2 || /[\s(]/.test(para[i - 2]));
}

function splitSentences (text) {
  const out = [];
  String(text || '').split(/\n+/).forEach(function (para) {
    let start = 0;
    for (let i = 0; i < para.length; i++) {
      if (isSentenceEnd(para, i) && !isInitial(para, i)) {
        out.push(para.slice(start, i + 1));
        start = i + 1;
      }
    }
    if (start < para.length) out.push(para.slice(start));
  });
  return out
    .map(function (s) { return s.replace(/\s+/g, ' ').trim(); })
    .filter(Boolean);
}

// texts: the item's other description values. name: the subject's name as
// the link records it. alreadyShown: strings the writer already sees for
// this item (primary description, title) — sentences inside them are
// skipped.
function sentencesNaming (texts, name, alreadyShown) {
  if (!Array.isArray(texts) || !texts.length) return [];
  const variants = nameVariants(name);
  if (!variants.length) return [];
  const re = new RegExp(
    '(?<![\\p{L}\\p{N}])(?:' + variants.map(escapeRegExp).join('|') + ')(?![\\p{L}\\p{N}])',
    'u'
  );
  const shown = (alreadyShown || [])
    .filter(function (s) { return typeof s === 'string' && s; })
    .map(function (s) { return s.replace(/\s+/g, ' '); });

  const out = [];
  let total = 0;
  for (const text of texts) {
    for (const sentence of splitSentences(text)) {
      if (!re.test(sentence)) continue;
      if (shown.some(function (s) { return s.indexOf(sentence) !== -1; })) continue;
      if (out.indexOf(sentence) !== -1) continue;
      const cut = truncateAtSentence(sentence, MAX_SENTENCE_CHARS);
      if (out.length && total + cut.length > MAX_TOTAL_CHARS) return out;
      out.push(cut);
      total += cut.length;
      if (out.length >= MAX_SENTENCES) return out;
    }
  }
  return out;
}

module.exports = sentencesNaming;
module.exports.nameVariants = nameVariants;
module.exports.splitSentences = splitSentences;
module.exports.MAX_SENTENCES = MAX_SENTENCES;
