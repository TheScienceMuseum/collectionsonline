const nest = { nest: true };
const match = { match: true };
const display = { display: true };
const hide = { hide: true };
// const displayLinked = {displayLinked: true}
const isExternalLink = { isExternalLink: true };
module.exports = {
  Image: { qCode: 'P18', action: [display] },
  Mother: { qCode: 'P25', action: [match, display] },
  Father: { qCode: 'P22', action: [match, display] },
  'Founded By': { qCode: 'P112', action: [nest, match, display] },
  'Significant Person': { qCode: 'P3342', action: [match, display] },
  Logo: { qCode: 'P154', action: [display] },
  'Official Name': { qCode: 'P1448', action: [match, display] },
  'Employer(s)': { qCode: 'P108', action: [nest, match, display] },
  Industry: { qCode: 'P452', action: [nest, match] },
  'Position Held': { qCode: 'P39', action: [nest, match] },
  'Date of Birth': { qCode: 'P569', action: [match, display, hide] },
  'Owned By': { qCode: 'P127', action: [nest, display] },
  'Member Of': { qCode: 'P463', action: [nest, display] },
  'Owner Of': { qCode: 'P1830', action: [nest, display] },
  'described at URL': { qCode: 'P973', action: [display, isExternalLink] },
  'Oxford DNB': { qCode: 'P1415', action: [display] },
  'Award Received': { qCode: 'P166', action: [nest, display] },
  Employees: { qCode: 'P1128', action: [nest, display] },
  Motto: { qCode: 'P1546', action: [display] },
  'Named After': { qCode: 'P138', action: [display] },
  'Archives in': { qCode: 'P485', action: [nest, display] },
  'Part Of': { qCode: 'P361', action: [nest, display] },
  Inception: { qCode: 'P571', action: [display] },
  'Headquarters Location': { qCode: 'P159', action: [nest] },
  Product: { qCode: 'P1056', action: [nest] },
  'Official Name ': { qCode: 'P1448', action: [display, hide] },
  'Short Name': { qCode: 'P1813', action: [display, hide] },
  'Has Subsidiary': { qCode: 'P355', action: [nest, display] },
  'Chief Executive Officers': { qCode: 'P169', action: [nest, display] },
  'Official Website': {
    qCode: 'P856',
    action: [display, isExternalLink]
  },
  'Given Name': { qCode: 'P735', action: [nest, display, hide] },
  'Family Name': { qCode: 'P734', action: [display, hide] },
  'Place of Birth': { qCode: 'P19', action: [display, hide] },
  'Place of Death': { qCode: 'P20', action: [display, hide] },
  'Date of Death': { qCode: 'P570', action: [display, hide] },
  Sibling: { qCode: 'P3373', action: [nest, display] },
  Spouse: { qCode: 'P26', action: [nest, display] },
  Children: { qCode: 'P40', action: [display, nest] },
  Relatives: { qCode: 'P1038', action: [nest, display] },
  Occupation: { qCode: '106', action: [nest, display] },
  'Educated At': { qCode: 'P69', action: [nest, display] },
  'Last Words': { qCode: 'P3909', action: [display] },
  'Notable Work': { qCode: 'P800', action: [nest, display] },
  'VIAF ID': { qCode: 'P214', action: [display] }
};
