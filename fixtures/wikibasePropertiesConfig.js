const nest = { nest: true }; // nested data
const match = { match: true }; // currently unused
const display = { display: true }; // currently unused
const hide = { hide: true }; // to hide properties from ui, but include in json response
const displayLinked = { displayLinked: true }; // if no related record in our systems - n.b doesn't work on every field due to how processed
const isExternalLink = { isExternalLink: true }; // formatting links, not widely used, but could be useful in future
const list = { list: true }; // used to conditionally format long lists as li in css
const context = { context: true }; // to add further context. Note property needs qualifiers obj with further dates for this to work, and some don't have this or contain desired data
// can check using this url with any qCode https://www.wikidata.org/w/api.php?action=wbgetentities&ids=<<QCODE>>&format=json&redirects=no&languages=en%7Cfr%7Cde&props=info%7Cclaims
module.exports = {
  Image: { property: 'P18', action: [display] },
  Mother: { property: 'P25', action: [match, display, displayLinked] },
  Father: { property: 'P22', action: [match, display, displayLinked] },
  'Founded By': {
    property: 'P112',
    action: [nest, match, display]
  },
  'Significant Person': {
    property: 'P3342',
    action: [match, display, displayLinked]
  },
  Logo: { property: 'P154', action: [display] },
  'Official Name': { property: 'P1448', action: [match, display] },
  'Employer(s)': {
    property: 'P108',
    action: [nest, match, display, displayLinked, context, list]
  },
  Industry: { property: 'P452', action: [nest, match, list] },
  'Position Held': {
    property: 'P39',
    action: [nest, match, displayLinked, context, list]
  },
  'Date of Birth': {
    property: 'P569',
    action: [match, display, hide]
  },
  'Owned By': {
    property: 'P127',
    action: [nest, display, displayLinked, context]
  },
  'Member Of': {
    property: 'P463',
    action: [nest, display, displayLinked, context, list]
  },
  'Owner Of': {
    property: 'P1830',
    action: [nest, display, context]
  },
  'described at URL': {
    property: 'P973',
    action: [display, isExternalLink, hide]
  },
  'Oxford DNB': { property: 'P1415', action: [display] },
  'Award Received': { property: 'P166', action: [nest, display, list] },
  'Named After': { property: 'P138', action: [display] },
  'Archives in': { property: 'P485', action: [nest, display, list] },
  Inception: { property: 'P571', action: [display, hide] },
  'Headquarters Location': { property: 'P159', action: [nest, hide] },
  Product: { property: 'P1056', action: [nest] },
  'Official Name ': { property: 'P1448', action: [display, hide] },
  'Short Name': { property: 'P1813', action: [display, hide] },
  'Has Subsidiary': {
    property: 'P355',
    action: [nest, display, displayLinked, displayLinked, context]
  },
  'Chief Executive Officers': {
    property: 'P169',
    action: [nest, display, displayLinked, displayLinked, context]
  },
  'Given Name': { property: 'P735', action: [nest, display, hide] },
  'Date of Death': { property: 'P570', action: [display, hide] },
  Sibling: { property: 'P3373', action: [nest, display, displayLinked] },
  Spouse: { property: 'P26', action: [nest, display, displayLinked] },
  Children: { property: 'P40', action: [display, nest, displayLinked] },
  Relatives: { property: 'P1038', action: [nest, display, displayLinked] },
  'Educated At': { property: 'P69', action: [nest, display] },
  'Notable Work': { property: 'P800', action: [nest, display] }
  // 'VIAF ID': { property: 'P214', action: [display, isExternalLink] }

};
