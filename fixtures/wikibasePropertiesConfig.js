const nest = { nest: true }; // nested data
const match = { match: true }; // currently unused
const display = { display: true }; // currently unused
const hide = { hide: true };
// const displayLinked = { displayLinked: true }; // if no related record in our systems - n.b doesn't work on every field due to how processed
const isExternalLink = { isExternalLink: true };
module.exports = {
  Image: { property: 'P18', action: [display] },
  Mother: { property: 'P25', action: [match, display] },
  Father: { property: 'P22', action: [match, display] },
  'Founded By': {
    property: 'P112',
    action: [nest, match, display]
  },
  'Significant Person': { property: 'P3m,m ,342', action: [match, display] },
  Logo: { property: 'P154', action: [display] },
  'Official Name': { property: 'P1448', action: [match, display] },
  'Employer(s)': {
    property: 'P108',
    action: [nest, match, display]
  },
  Industry: { property: 'P452', action: [nest, match] },
  'Position Held': { property: 'P39', action: [nest, match] },
  'Date of Birth': { property: 'P569', action: [match, display, hide] },
  'Owned By': { property: 'P127', action: [nest, display] },
  'Member Of': { property: 'P463', action: [nest, display] },
  'Owner Of': { property: 'P1830', action: [nest, display] },
  'described at URL': {
    property: 'P973',
    action: [display, isExternalLink, hide]
  },
  'Oxford DNB': { property: 'P1415', action: [display] },
  'Award Received': { property: 'P166', action: [nest, display] },
  Employees: { property: 'P1128', action: [nest, display] },
  Motto: { property: 'P1546', action: [display] },
  'Named After': { property: 'P138', action: [display] },
  'Archives in': { property: 'P485', action: [nest, display] },
  'Part Of': { property: 'P361', action: [nest, display] },
  Inception: { property: 'P571', action: [display] },
  'Headquarters Location': { property: 'P159', action: [nest] },
  Product: { property: 'P1056', action: [nest] },
  'Official Name ': { property: 'P1448', action: [display, hide] },
  'Short Name': { property: 'P1813', action: [display, hide] },
  'Has Subsidiary': { property: 'P355', action: [nest, display] },
  'Chief Executive Officers': {
    property: 'P169',
    action: [nest, display]
  },
  'Official Website': {
    property: 'P856',
    action: [display, isExternalLink]
  },
  'Given Name': { property: 'P735', action: [nest, display, hide] },
  'Family Name': { property: 'P734', action: [display, hide] },
  'Place of Birth': { property: 'P19', action: [display, hide] },
  'Place of Death': { property: 'P20', action: [display, hide] },
  'Date of Death': { property: 'P570', action: [display, hide] },
  Sibling: { property: 'P3373', action: [nest, display] },
  Spouse: { property: 'P26', action: [nest, display] },
  Children: { property: 'P40', action: [display, nest] },
  Relatives: { property: 'P1038', action: [nest, display] },
  Occupation: { property: '106', action: [nest, display] },
  'Educated At': { property: 'P69', action: [nest, display] },
  'Last Words': { property: 'P3909', action: [display] },
  'Notable Work': { property: 'P800', action: [nest, display] },
  'VIAF ID': { property: 'P214', action: [display] }
};
