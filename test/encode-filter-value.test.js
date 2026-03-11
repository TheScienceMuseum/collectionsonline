const test = require('tape');
const encodeFilterValue = require('../lib/helpers/encode-filter-value');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

test(file + 'encodes spaces as dashes (human-readable)', (t) => {
  t.equal(encodeFilterValue('Science Museum'), 'science-museum', 'spaces become dashes');
  t.equal(encodeFilterValue('National Railway Museum'), 'national-railway-museum', 'multi-word');
  t.end();
});

test(file + 'lowercases the output', (t) => {
  t.equal(encodeFilterValue('Science Museum'), 'science-museum', 'lowercased');
  t.end();
});

test(file + 'encodes hyphens as %252D', (t) => {
  t.equal(encodeFilterValue('Rolls-Royce'), 'rolls%252droyce', 'hyphen encoded');
  t.equal(encodeFilterValue('black-and-white print'), 'black%252dand%252dwhite-print', 'mixed hyphens and spaces');
  t.equal(encodeFilterValue('Tony Ray-Jones'), 'tony-ray%252djones', 'hyphen in name');
  t.end();
});

test(file + 'encodes slashes as %252F', (t) => {
  t.equal(
    encodeFilterValue('Buckingham Movie Museum/John Burgoyne-Johnson Collection'),
    'buckingham-movie-museum%252fjohn-burgoyne%252djohnson-collection',
    'slash and hyphen both encoded'
  );
  t.equal(encodeFilterValue('camera/plate'), 'camera%252fplate', 'simple slash');
  t.end();
});

test(file + 'encodes commas as %252C', (t) => {
  t.equal(encodeFilterValue('Science Museum, London'), 'science-museum%252c-london', 'comma encoded');
  t.equal(encodeFilterValue('Jones, Tony'), 'jones%252c-tony', 'comma in person name');
  t.end();
});

test(file + 'values with no special chars are unchanged except lowercasing and space→dash', (t) => {
  t.equal(encodeFilterValue('London'), 'london', 'plain single word');
  t.equal(encodeFilterValue('Science Museum'), 'science-museum', 'two words');
  t.end();
});

test(file + 'round-trip: encodeFilterValue output decodes correctly', (t) => {
  const dashToSpace = require('../lib/helpers/dash-to-space');

  // Simulate Hapi decode (%25 → %) + dashToSpace + decodeURIComponent
  function decode (encoded) {
    // Hapi decodes %25 → %, so %252D → %2D, %252F → %2F, %252C → %2C
    const afterHapi = encoded.replace(/%25/gi, '%');
    const afterDashToSpace = dashToSpace(afterHapi);
    return decodeURIComponent(afterDashToSpace);
  }

  t.equal(decode(encodeFilterValue('Rolls-Royce')), 'rolls-royce', 'hyphenated value decodes to lowercase with hyphen preserved');
  t.equal(decode(encodeFilterValue('Science Museum, London')), 'science museum, london', 'comma value round-trips');
  t.equal(
    decode(encodeFilterValue('Buckingham Movie Museum/John Burgoyne-Johnson Collection')),
    'buckingham movie museum/john burgoyne-johnson collection',
    'slash+hyphen round-trips'
  );
  t.equal(decode(encodeFilterValue('black-and-white print')), 'black-and-white print', 'space-dash-hyphen round-trips');
  t.end();
});
