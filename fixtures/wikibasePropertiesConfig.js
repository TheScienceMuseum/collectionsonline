// Action flag strings for each property:
//   'nest'          – value is a Q-code; fetch its English label
//   'match'         – currently unused
//   'display'       – show in UI
//   'hide'          – include in JSON response but exclude from UI rendering
//   'displayLinked' – only include if a matching collection record is found via Elasticsearch
//   'isExternalLink'– format value as a hyperlink
//   'list'          – render as <li> items rather than comma-separated inline
//   'context'       – build a contextual string from qualifiers (dates, company)
//
// can check using this url with any qCode https://www.wikidata.org/w/api.php?action=wbgetentities&ids=<<QCODE>>&format=json&redirects=no&languages=en%7Cfr%7Cde&props=info%7Cclaims
module.exports = {
  Image: { property: 'P18', action: ['display'] },
  Mother: { property: 'P25', action: ['match', 'display', 'displayLinked'] },
  Father: { property: 'P22', action: ['match', 'display', 'displayLinked'] },
  'Founded by': {
    property: 'P112',
    action: ['nest', 'match', 'display']
  },
  'Significant person': {
    property: 'P3342',
    action: ['match', 'display', 'displayLinked']
  },
  Logo: { property: 'P154', action: ['display'] },
  // P1448 is shown (not hidden). A duplicate entry 'Official Name ' (with a trailing
  // space, lower in this file) was silently overwriting this one in JS object literals.
  // That duplicate has been removed; this single entry is canonical.
  'Official name': { property: 'P1448', action: ['match', 'display'] },
  'Employer(s)': {
    property: 'P108',
    action: ['nest', 'match', 'display', 'displayLinked', 'context', 'list']
  },
  Industry: { property: 'P452', action: ['nest', 'match', 'list'] },
  'Position held': {
    property: 'P39',
    action: ['nest', 'match', 'displayLinked', 'context', 'list']
  },
  'Date of birth': {
    property: 'P569',
    action: ['match', 'display', 'hide']
  },
  'Owned by': {
    property: 'P127',
    action: ['nest', 'display', 'displayLinked', 'context']
  },
  'Member of': {
    property: 'P463',
    action: ['nest', 'display', 'displayLinked', 'context', 'list']
  },
  'Owner of': {
    property: 'P1830',
    action: ['nest', 'display', 'context']
  },
  'Described at URL': {
    property: 'P973',
    action: ['display', 'isExternalLink', 'hide']
  },
  'Award received': { property: 'P166', action: ['nest', 'display', 'list'] },
  'Named after': { property: 'P138', action: ['display'] },
  'Archives in': { property: 'P485', action: ['nest', 'display', 'list'] },
  Inception: { property: 'P571', action: ['display', 'hide'] },
  'Headquarters location': { property: 'P159', action: ['nest', 'hide'] },
  Product: { property: 'P1056', action: ['nest'] },
  'Short name': { property: 'P1813', action: ['display', 'hide'] },
  'Has subsidiary': {
    property: 'P355',
    action: ['nest', 'display', 'displayLinked', 'context']
  },
  'Chief executive officers': {
    property: 'P169',
    action: ['nest', 'display', 'displayLinked', 'context']
  },
  'Given name': { property: 'P735', action: ['nest', 'display', 'hide'] },
  'Date of death': { property: 'P570', action: ['display', 'hide'] },
  Sibling: { property: 'P3373', action: ['nest', 'display', 'displayLinked'] },
  Spouse: { property: 'P26', action: ['nest', 'display', 'displayLinked'] },
  Children: { property: 'P40', action: ['display', 'nest', 'displayLinked'] },
  Relatives: { property: 'P1038', action: ['nest', 'display', 'displayLinked'] },
  'Educated at': { property: 'P69', action: ['nest', 'display'] },
  'Notable work': { property: 'P800', action: ['nest', 'display'] }

};
