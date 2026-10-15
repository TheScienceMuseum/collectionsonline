'use strict';

// Display-time house-style safety net for AI biography sentence text.
//
// Runs on the raw writer text (with `{coXXXX|Title}` markers still in
// place) just before render-biography escapes and linkifies it. The
// stored `text` field is never modified — claim signatures and curator
// decisions keep keying off the canonical writer output. The prompt
// carries the same rules; this layer catches the residue the writer
// still lets through, and fixes already-stored records without a regen.
//
// Two passes:
//
//   1. foldRepeatedTitleNoun — "a reconstruction of {co1|Reconstruction
//      of Novelty Locomotive}" → "a {co1|reconstruction of Novelty
//      Locomotive}". Fires only when the word immediately before a
//      marker (optionally followed by "of", "of the/a/an" or a comma)
//      is the exact same descriptive noun the title opens with.
//
//   2. britishSpelling — lowercase-only swaps from a fixed list of
//      unambiguous American spellings (airplane → aeroplane, color →
//      colour, organized → organised, …). Never touches link text
//      (catalogue titles keep their catalogued spelling: "Nintendo Color
//      TV-Game"), quoted spans, or capitalised words (proper nouns such
//      as "World Meteorological Organization"). Words that are correct
//      British English in some senses — program (computer program),
//      meter (gas meter), license (the verb), gray (the SI unit) — are
//      deliberately absent.

// Nouns that catalogue titles commonly open with ("Model of …", "Print
// of …", "Box containing …"). Restricting the fold to these keeps it away
// from proper names that happen to repeat ("Rocket {co1|Rocket …}").
const TITLE_NOUNS = new Set([
  'album', 'apparatus', 'advertisement', 'badge', 'banknote', 'book', 'booklet',
  'bottle', 'box', 'brochure', 'bust', 'card', 'cartoon', 'case', 'cast',
  'catalogue', 'certificate', 'chart', 'coin', 'diagram', 'document', 'drawing',
  'engraving', 'etching', 'figure', 'figurine', 'film', 'fragment', 'instrument',
  'jar', 'jug', 'label', 'leaflet', 'letter', 'lithograph', 'manuscript', 'map',
  'medal', 'medallion', 'model', 'mug', 'negative', 'notice', 'pack', 'packet',
  'painting', 'pamphlet', 'part', 'photograph', 'photo', 'plan', 'plate',
  'portrait', 'postcard', 'poster', 'print', 'reconstruction', 'replica',
  'reproduction', 'sample', 'section', 'set', 'sketch', 'slide', 'specimen',
  'statue', 'ticket', 'tile', 'tin', 'token', 'transparency', 'watercolour'
]);

// <noun><connector>{coXXXX|<Noun> …}
//   connector: " of the ", " of a ", " of ", ", " or " "
const REPEATED_NOUN = /\b([A-Za-z]+)(\s+of\s+(?:the|an?)\s+|\s+of\s+|,\s*|\s+)(\{+co\d+\|)([A-Za-z]+)/g;

function foldRepeatedTitleNoun (text) {
  return String(text).replace(REPEATED_NOUN, function (match, word, connector, open, titleWord) {
    if (word.toLowerCase() !== titleWord.toLowerCase()) return match;
    if (!TITLE_NOUNS.has(titleWord.toLowerCase())) return match;
    // Keep the case of the word being dropped so a sentence-initial
    // "Model of {co1|Model of X}" still opens with a capital.
    const firstIsLower = word[0] === word[0].toLowerCase();
    const folded = firstIsLower
      ? titleWord[0].toLowerCase() + titleWord.slice(1)
      : titleWord;
    return open + folded;
  });
}

// Whole-word American → British replacements. Inflected forms listed
// explicitly so nothing is derived by guesswork.
const SPELLINGS = {
  aluminum: 'aluminium',
  airplane: 'aeroplane',
  airplanes: 'aeroplanes',
  anemia: 'anaemia',
  anesthesia: 'anaesthesia',
  anesthetic: 'anaesthetic',
  anesthetics: 'anaesthetics',
  anesthetist: 'anaesthetist',
  anesthetists: 'anaesthetists',
  armor: 'armour',
  armored: 'armoured',
  artifact: 'artefact',
  artifacts: 'artefacts',
  behavior: 'behaviour',
  behaviors: 'behaviours',
  caliber: 'calibre',
  canceled: 'cancelled',
  canceling: 'cancelling',
  cesarean: 'caesarean',
  catalog: 'catalogue',
  catalogs: 'catalogues',
  cataloged: 'catalogued',
  cataloging: 'cataloguing',
  center: 'centre',
  centers: 'centres',
  centered: 'centred',
  centimeter: 'centimetre',
  centimeters: 'centimetres',
  color: 'colour',
  colors: 'colours',
  colored: 'coloured',
  coloring: 'colouring',
  colorful: 'colourful',
  counselor: 'counsellor',
  defense: 'defence',
  diarrhea: 'diarrhoea',
  endeavor: 'endeavour',
  endeavors: 'endeavours',
  enrollment: 'enrolment',
  estrogen: 'oestrogen',
  estrogens: 'oestrogens',
  favor: 'favour',
  favored: 'favoured',
  favorable: 'favourable',
  favorite: 'favourite',
  favorites: 'favourites',
  fiber: 'fibre',
  fibers: 'fibres',
  flavor: 'flavour',
  flavors: 'flavours',
  fueled: 'fuelled',
  fueling: 'fuelling',
  gynecologist: 'gynaecologist',
  gynecology: 'gynaecology',
  harbor: 'harbour',
  harbors: 'harbours',
  hematology: 'haematology',
  hemoglobin: 'haemoglobin',
  hemorrhage: 'haemorrhage',
  honor: 'honour',
  honors: 'honours',
  honored: 'honoured',
  honorable: 'honourable',
  humor: 'humour',
  installment: 'instalment',
  jewelry: 'jewellery',
  kilometer: 'kilometre',
  kilometers: 'kilometres',
  labeled: 'labelled',
  labeling: 'labelling',
  labor: 'labour',
  labored: 'laboured',
  leukemia: 'leukaemia',
  liter: 'litre',
  liters: 'litres',
  maneuver: 'manoeuvre',
  maneuvers: 'manoeuvres',
  millimeter: 'millimetre',
  millimeters: 'millimetres',
  modeled: 'modelled',
  modeling: 'modelling',
  mustache: 'moustache',
  neighbor: 'neighbour',
  neighbors: 'neighbours',
  neighborhood: 'neighbourhood',
  odor: 'odour',
  offense: 'offence',
  orthopedic: 'orthopaedic',
  orthopedics: 'orthopaedics',
  pediatric: 'paediatric',
  pediatrics: 'paediatrics',
  pediatrician: 'paediatrician',
  plow: 'plough',
  plows: 'ploughs',
  rumor: 'rumour',
  rumors: 'rumours',
  signaled: 'signalled',
  signaling: 'signalling',
  skeptic: 'sceptic',
  skeptical: 'sceptical',
  skepticism: 'scepticism',
  skillful: 'skilful',
  somber: 'sombre',
  theater: 'theatre',
  theaters: 'theatres',
  tumor: 'tumour',
  tumors: 'tumours',
  traveled: 'travelled',
  traveler: 'traveller',
  travelers: 'travellers',
  traveling: 'travelling',
  vapor: 'vapour',
  watercolor: 'watercolour',
  watercolors: 'watercolours'
};

// -ize / -yze stems that take -ise / -yse in house style. An explicit
// list rather than a blanket /ize$/ rule, which would also catch size,
// seize, prize, capsize, resize, lifesize …
const IZE_STEMS = [
  'apolog', 'author', 'capital', 'categor', 'central', 'character', 'civil',
  'colon', 'commercial', 'computer', 'critic', 'crystall', 'digit', 'dramat',
  'emphas', 'energ', 'fertil', 'final', 'formal', 'galvan', 'general',
  'harmon', 'hospital', 'ideal', 'immortal', 'immun', 'industrial',
  'international', 'legal', 'local', 'magnet', 'maxim', 'mechan', 'memorial',
  'minim', 'mobil', 'modern', 'monopol', 'motor', 'national', 'natural',
  'neutral', 'normal', 'optim', 'organ', 'pasteur', 'patron', 'popular',
  'pressur', 'priorit', 'privat', 'public', 'rational', 'real', 'recogn',
  'reorgan', 'revolution', 'social', 'special', 'stabil', 'standard',
  'steril', 'subsid', 'summar', 'symbol', 'sympath', 'synthes', 'systemat',
  'theor', 'urban', 'util', 'visual', 'vulcan'
];
const IZE_WORD = new RegExp('^(' + IZE_STEMS.join('|') + ')iz(e|ed|es|ing|er|ers|ation|ations)$');
const YZE_WORD = /^(analy|catal|paraly)z(e|ed|es|ing|er|ers)$/;

function britishWord (word) {
  if (Object.prototype.hasOwnProperty.call(SPELLINGS, word)) return SPELLINGS[word];
  let m = IZE_WORD.exec(word);
  if (m) return m[1] + 'is' + m[2];
  m = YZE_WORD.exec(word);
  if (m) return m[1] + 's' + m[2];
  return word;
}

// Link markers and quoted spans keep their original spelling: titles are
// catalogue data and quotations are verbatim by definition.
const PROTECTED = /\{+co\d+\|[^}]+\}+|“[^”]*”|"[^"]*"|‘[^’]*’/g;

function britishSpelling (text) {
  const src = String(text);
  let out = '';
  let last = 0;
  let m;
  PROTECTED.lastIndex = 0;
  while ((m = PROTECTED.exec(src))) {
    out += swapWords(src.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return out + swapWords(src.slice(last));
}

// \b[a-z]+\b only matches all-lowercase words: "Organization" has no
// word boundary before its "r", so capitalised words never match.
function swapWords (segment) {
  return segment.replace(/\b[a-z]+\b/g, britishWord);
}

function applyHouseStyle (text) {
  if (typeof text !== 'string' || !text) return text;
  return britishSpelling(foldRepeatedTitleNoun(text));
}

module.exports = applyHouseStyle;
module.exports.foldRepeatedTitleNoun = foldRepeatedTitleNoun;
module.exports.britishSpelling = britishSpelling;
