'use strict';

// Shared vocabulary for the MCP server (lib/mcp). Kept separate from the
// website's helpers so the agent-facing surface can evolve without touching
// search page behaviour.

// External (public) type names → ES @datatype.base. lib/type-mapping.js maps
// group → mgroup, which matches nothing in the ciim index, so MCP keeps its own.
const TYPES = {
  objects: 'object',
  people: 'agent',
  documents: 'archive',
  group: 'group'
};

const EXTERNAL_TYPES = {
  object: 'objects',
  agent: 'people',
  archive: 'documents',
  group: 'group'
};

// 'all' mirrors the website's "all" tab: groups are excluded.
const ALL_TYPES = ['object', 'agent', 'archive'];

const TYPE_NAMES = ['objects', 'people', 'documents', 'group', 'all'];

// Museums as they appear in `ondisplay[].value`. Legacy names aren't in the
// index today (Oct 2026) but are kept as aliases in case CIIM re-emits them.
const MUSEUMS = [
  { name: 'Science Museum', codes: ['scm'], aliases: [] },
  { name: 'National Railway Museum', codes: ['nrm'], aliases: ['Railway Museum'] },
  { name: 'Science and Industry Museum', codes: ['sim', 'msi'], aliases: ['Museum of Science and Industry'] },
  { name: 'National Science and Media Museum', codes: ['nsmm'], aliases: ['National Media Museum'] },
  { name: 'Locomotion', codes: ['locomotion'], aliases: [] },
  { name: 'Science and Innovation Park', codes: ['sip'], aliases: ['National Collections Centre'] }
];

const MUSEUM_NAMES = MUSEUMS.map((m) => m.name);

const resolveMuseum = (input) => {
  if (!input) return null;
  const v = String(input).trim().toLowerCase();
  return MUSEUMS.find((m) =>
    m.name.toLowerCase() === v ||
    m.codes.includes(v) ||
    m.aliases.some((a) => a.toLowerCase() === v)
  ) || null;
};

// Every `ondisplay` string that means this museum (canonical name + aliases).
const museumValues = (museum) => [museum.name, ...museum.aliases];

// Image licences in `multimedia.legal.rights.licence`, with the spelling
// variants seen in the index and short forms an agent might use.
const LICENCES = [
  {
    value: 'CC BY-NC-SA 4.0',
    variants: ['CC-BY-NC-SA 4.0'],
    shortForms: ['cc by-nc-sa', 'by-nc-sa', 'cc-by-nc-sa']
  },
  {
    value: 'CC BY-NC-ND 4.0',
    variants: [],
    shortForms: ['cc by-nc-nd', 'by-nc-nd', 'cc-by-nc-nd']
  },
  {
    value: 'Open Government Licence v3.0',
    variants: [],
    shortForms: ['ogl', 'ogl v3', 'open government licence', 'open government license']
  }
];

// Returns every stored value that should match the requested licence, or
// null when the input isn't a known licence (the caller then matches it as-is).
const resolveLicence = (input) => {
  const v = String(input).trim().toLowerCase();
  const licence = LICENCES.find((l) =>
    l.value.toLowerCase() === v ||
    l.variants.some((x) => x.toLowerCase() === v) ||
    l.shortForms.includes(v)
  );
  return licence ? [licence.value, ...licence.variants] : null;
};

// Folds variant spellings back to the canonical licence name for display.
const canonicalLicence = (value) => {
  const licence = LICENCES.find((l) => l.value === value || l.variants.includes(value));
  return licence ? licence.value : value;
};

const RECORD_ID = /^(co|cp|ap|aa|c)\d+$/;

module.exports = {
  TYPES,
  EXTERNAL_TYPES,
  ALL_TYPES,
  TYPE_NAMES,
  MUSEUMS,
  MUSEUM_NAMES,
  resolveMuseum,
  museumValues,
  LICENCES,
  resolveLicence,
  canonicalLicence,
  RECORD_ID
};
