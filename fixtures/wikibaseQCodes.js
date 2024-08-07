const nest = { nest: true };
const match = { match: true };
const display = { display: true };
module.exports = {
  Image: { qCode: 'P18', action: [display] }, // Image
  Mother: { qCode: 'P25', action: [match, display] }, // Mother
  // TODO: array of qcodes?
  Father: { qCode: 'P22', action: [match, display] }, // Father
  'Founded By': { qCode: 'P112', action: [nest, match, display] }, // Founded by
  'Significant Person': { qCode: 'P3342', action: [match, display] }, // Significant Person
  Logo: { qCode: 'P154', action: [display] }, // Logo
  'Official Name': { qCode: 'P1448', action: [match, display] }, // Official name
  'Employer(s)': { qCode: 'P108', action: [nest, match, display] }, // Employer
  Industry: { qCode: 'P452', action: [nest, match] }, // industry
  'Position Held': { qCode: 'P39', action: [nest, match] }, // position held
  DOB: { qCode: 'P569', action: [match, display] } // DOB
};

// agents var - person or business
