var test = require('tape');
var anniversary = require('../lib/anniversary');
var transformObjectHit = anniversary._transformObjectHit;
var transformPersonHit = anniversary._transformPersonHit;
var getOverridesForDate = anniversary._getOverridesForDate;
var secondsUntilMidnightUTC = anniversary.secondsUntilMidnightUTC;
var objectFixture = require('./fixtures/elastic-responses/anniversary-objects.json');
var peopleFixture = require('./fixtures/elastic-responses/anniversary-people.json');

var mockConfig = {
  rootUrl: 'http://localhost:8000',
  mediaPath: 'https://media.example.com'
};

// --- Transform Object Hit ---

test('transformObjectHit returns correct shape', function (t) {
  var hit = objectFixture.body.hits.hits[0];
  var result = transformObjectHit(hit, mockConfig, 2026);

  t.equal(result.id, 'co8364603', 'has correct id');
  t.equal(result.type, 'objects', 'type is objects');
  t.equal(result.title, 'Newcomen atmospheric engine', 'has correct title');
  t.ok(result.link.indexOf('/objects/co8364603/') === 0 ||
       result.link.indexOf('http://localhost:8000/objects/co8364603/') === 0,
  'link contains type and id');
  t.equal(result.figure, 'https://media.example.com/media/large/co8364603.jpg', 'image uses mediaPath');
  t.equal(result.yearsAgo, 100, 'calculates years ago');
  t.equal(result.year, '1926', 'has creation year');
  t.equal(result.milestoneLabel, '100 years ago', 'generates milestone label');
  t.ok(result.subtitle.indexOf('Maker') === 0 || result.subtitle.indexOf('maker') >= 0 ||
       result.subtitle.indexOf('Thomas Newcomen') >= 0,
  'subtitle includes maker info');
  t.end();
});

test('transformObjectHit handles missing maker gracefully', function (t) {
  var hit = {
    _id: 'co999',
    _source: {
      '@admin': { uid: 'co999' },
      '@datatype': { base: 'object' },
      summary: { title: 'Test Object' },
      creation: { date: [{ from: '1976' }] }
    }
  };
  var result = transformObjectHit(hit, mockConfig, 2026);

  t.equal(result.title, 'Test Object', 'still has title');
  t.equal(result.yearsAgo, 50, 'calculates years ago');
  t.equal(result.subtitle, '1976', 'subtitle is just the year');
  t.end();
});

test('transformObjectHit handles missing creation date', function (t) {
  var hit = {
    _id: 'co888',
    _source: {
      '@admin': { uid: 'co888' },
      '@datatype': { base: 'object' },
      summary: { title: 'Dateless Object' }
    }
  };
  var result = transformObjectHit(hit, mockConfig, 2026);

  t.equal(result.yearsAgo, null, 'yearsAgo is null');
  t.equal(result.subtitle, '', 'subtitle is empty');
  t.end();
});

// --- Transform Person Hit ---

test('transformPersonHit returns correct shape', function (t) {
  var hit = peopleFixture.body.hits.hits[0];
  var result = transformPersonHit(hit, mockConfig, 2026);

  t.equal(result.id, 'cp36993', 'has correct id');
  t.equal(result.type, 'people', 'type is people');
  t.equal(result.title, 'Charles Babbage', 'has correct title');
  t.ok(result.link.indexOf('/people/cp36993/') >= 0, 'link contains type and id');
  t.equal(result.figure, 'https://media.example.com/media/large/cp36993.jpg', 'image uses mediaPath');
  t.equal(result.birthYear, '1791', 'has birth year');
  t.equal(result.yearsAgo, 235, 'calculates years ago');
  t.equal(result.entityType, 'person', 'entity type is person');
  t.equal(result.subtitle, 'mathematician', 'subtitle is occupation');
  t.ok(result.milestoneLabel.indexOf('1791') >= 0, 'milestone label includes birth year');
  t.end();
});

test('transformPersonHit handles organisation type', function (t) {
  var hit = {
    _id: 'cp555',
    _source: {
      '@admin': { uid: 'cp555', source: 'Mimsy XG' },
      '@datatype': { base: 'agent', actual: 'organisation' },
      summary: { title: 'Royal Institution' },
      birth: { date: { value: '1799-01-25', from: '1799' } }
    }
  };
  var result = transformPersonHit(hit, mockConfig, 2026);

  t.equal(result.entityType, 'organisation', 'entity type is organisation');
  t.ok(result.milestoneLabel.indexOf('Founded') >= 0, 'uses Founded label for organisations');
  t.end();
});

test('transformPersonHit handles missing image', function (t) {
  var hit = {
    _id: 'cp444',
    _source: {
      '@admin': { uid: 'cp444' },
      '@datatype': { base: 'agent', actual: 'person' },
      summary: { title: 'Unknown Scientist' },
      birth: { date: { from: '1900' } }
    }
  };
  var result = transformPersonHit(hit, mockConfig, 2026);

  t.equal(result.figure, null, 'figure is null when no multimedia');
  t.equal(result.subtitle, null, 'subtitle is null when no occupation');
  t.end();
});

// --- Overrides ---

test('getOverridesForDate returns matching override', function (t) {
  // This depends on the config file having overrides.dates entries
  // With an empty overrides.dates config, should return null
  var date = new Date('2026-06-15');
  var result = getOverridesForDate(date);
  t.equal(result, null, 'returns null when no override for date');
  t.end();
});

// --- Midnight Cache ---

test('secondsUntilMidnightUTC returns positive integer', function (t) {
  var result = secondsUntilMidnightUTC();
  t.ok(typeof result === 'number', 'returns a number');
  t.ok(result > 0, 'is positive');
  t.ok(result <= 86400, 'is at most 24 hours');
  t.ok(result === Math.floor(result), 'is an integer');
  t.end();
});

// --- Main function ---

test('getAnniversaryData returns null when disabled', async function (t) {
  // The config has enabled:false by default, so without env var it returns null
  var mockElastic = {};
  var result = await anniversary(mockElastic, mockConfig);
  t.equal(result, null, 'returns null when widget is disabled');
  t.end();
});
