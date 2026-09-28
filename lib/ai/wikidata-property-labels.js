'use strict';

// Human-readable labels for the Wikidata property IDs the writer
// emits in `sourceDetail` fields (`wikidata:p106` etc.).
//
// Two consumers today:
//   1. lib/ai/external-tools/wikidata-deep.js — uses the map to
//      resolve property IDs when checking claims against
//      Wikidata's structured data.
//   2. routes/admin-ai.js — translates `wikidata:p106` etc. in
//      source pills to `P106 (occupation)` for the Claims list
//      and finding cards, so curators aren't decoding property
//      IDs by memory.
//
// Curated for museum subject types: people (scientists, engineers,
// artists), organisations (companies), places, and cultural objects.
// Unknown IDs return null from labelFor() — the source pill still
// displays the raw code so a curator can look it up (P-code stays
// visible in every case; this only ADDS the label).

const PROPERTIES = {
  // People — biographical facts
  P569: 'date of birth',
  P570: 'date of death',
  P19: 'place of birth',
  P20: 'place of death',
  P103: 'native language',
  P1412: 'languages spoken',

  // People — relationships
  P22: 'father',
  P25: 'mother',
  P26: 'spouse',
  P40: 'child',
  P3373: 'sibling',

  // People — professional
  P106: 'occupation',
  P27: 'country of citizenship',
  P69: 'educated at',
  P108: 'employer',
  P101: 'field of work',
  P800: 'notable work',
  P166: 'awards received',
  P463: 'member of',
  P39: 'position held',
  P937: 'work location',
  P737: 'influenced by',

  // Creative works — authorship / credits
  P50: 'author',
  P84: 'architect',
  P170: 'creator',
  P175: 'performer',
  P57: 'director',
  P58: 'screenwriter',
  P86: 'composer',
  P676: 'lyrics by',
  P110: 'illustrator',
  P4884: 'course',

  // Organisations
  P112: 'founded by',
  P571: 'inception',
  P576: 'dissolved',
  P169: 'chief executive officer',
  P488: 'chairperson',
  P452: 'industry',
  P159: 'headquarters location',
  P17: 'country',
  P127: 'owned by',
  P749: 'parent organization',
  P355: 'subsidiary',
  P1056: 'product or material produced',
  P1830: 'owner of',
  P199: 'business division',
  P1128: 'employees',
  P155: 'replaces',
  P156: 'replaced by',

  // Places / locations
  P276: 'location',
  P625: 'coordinate location',
  P30: 'continent',
  P36: 'capital',
  P1082: 'population',

  // Object / concept generic
  P31: 'instance of',
  P279: 'subclass of',
  P361: 'part of',
  P527: 'has part',
  P585: 'point in time',
  P710: 'participant'
};

// Return the human label for a Wikidata property ID (P-code), or
// null when unknown. Case-insensitive input — the writer sometimes
// emits lowercase (`wikidata:p106`) in sourceDetail even though
// canonical Wikidata IDs are uppercase.
function labelFor (propId) {
  if (!propId || typeof propId !== 'string') return null;
  const key = propId.toUpperCase();
  return PROPERTIES[key] || null;
}

// Translate a full sourceDetail string. Handles the two shapes
// the writer produces:
//
//   'wikidata:p106'                       (single citation)
//   'wikidata:p106, wikidata:p101; existingbiography'   (compound)
//
// Splits on `,` and `;`, and translates each `wikidata:pXXX`
// citation to `P-code (label)`. Non-wikidata citations
// (`relateditem:coXXX`, `existingbiography`, `personData.*`)
// pass through unchanged — curators recognise those directly.
//
// Returns the reformatted string. Empty input passes through.
function formatSourceDetail (sourceDetail) {
  if (!sourceDetail || typeof sourceDetail !== 'string') return sourceDetail || '';
  return sourceDetail
    .split(/([,;])/)
    .map(function (piece) {
      if (piece === ',' || piece === ';') return piece;
      const trimmed = piece.trim();
      const m = trimmed.match(/^wikidata:(p\d+)$/i);
      if (!m) return piece;
      const upper = m[1].toUpperCase();
      const label = labelFor(upper);
      const leading = piece.match(/^\s*/)[0];
      const trailing = piece.match(/\s*$/)[0];
      const formatted = label ? 'wikidata:' + upper + ' (' + label + ')' : 'wikidata:' + upper;
      return leading + formatted + trailing;
    })
    .join('');
}

module.exports = {
  PROPERTIES,
  labelFor,
  formatSourceDetail
};
