'use strict';

const test = require('tape');
const subjectStatus = require('../lib/ai/subject-status');

const CAP = subjectStatus.HUMAN_LIFESPAN_CAP_YEARS;
const NOW_YEAR = new Date().getFullYear();
const CUTOFF_YEAR = NOW_YEAR - CAP;

test('subject-status: structured death date is canonical (overrides inference)', function (t) {
  const personData = { birthDate: '1791-12-26', deathDate: '1871-10-18' };
  const r = subjectStatus.inspect(personData, null, 'person');
  t.equal(r.isLiving, false);
  t.equal(r.status, 'deceased');
  t.equal(r.deathDateSource, 'internal');
  t.equal(r.deathDate, '1871-10-18');
  t.equal(r.deathDateInferred, null, 'inference path not engaged when internal known');
  t.end();
});

test('subject-status: wikidata death used when internal absent', function (t) {
  const personData = { birthDate: '1791' };
  const wd = { 'date of death': { value: '1871-10-18' } };
  const r = subjectStatus.inspect(personData, wd, 'person');
  t.equal(r.isLiving, false);
  t.equal(r.deathDateSource, 'wikidata');
  t.equal(r.deathDateInferred, null);
  t.end();
});

test('subject-status: cp52967-style record (no structured dates, "active 1817-1839")', function (t) {
  const personData = {
    birthDate: '',
    deathDate: '',
    briefBiography: 'active 1817-1839, optical & mathematical instrument maker, London, England'
  };
  const r = subjectStatus.inspect(personData, null, 'person');
  t.equal(r.isLiving, false, 'inferred deceased');
  t.equal(r.status, 'deceased');
  t.equal(r.deathDateSource, 'inferred-from-brief-biography');
  t.equal(r.deathDateInferred, '1839', 'latest year in brief biography wins');
  t.ok(r.deathDateInferredReasoning && r.deathDateInferredReasoning.indexOf('1839') !== -1);
  t.end();
});

test('subject-status: structured birth date past lifespan cap → inferred deceased', function (t) {
  const oldYear = String(CUTOFF_YEAR - 5); // 5 years past the cap
  const personData = { birthDate: oldYear };
  const r = subjectStatus.inspect(personData, null, 'person');
  t.equal(r.isLiving, false);
  t.equal(r.deathDateSource, 'inferred-from-birth');
  // Inferred death = birth + lifespan cap
  t.equal(r.deathDateInferred, String(parseInt(oldYear, 10) + CAP));
  t.end();
});

test('subject-status: birth date inside lifespan cap → still living unless other signal', function (t) {
  const recentYear = String(NOW_YEAR - 50); // 50 years old
  const personData = { birthDate: recentYear };
  const r = subjectStatus.inspect(personData, null, 'person');
  t.equal(r.isLiving, true, '50-year-old is still living without a death signal');
  t.equal(r.deathDateInferred, null);
  t.end();
});

test('subject-status: brief bio "active 1990s" within lifespan → still living', function (t) {
  const personData = {
    birthDate: '',
    deathDate: '',
    briefBiography: 'active 1990s, recycled paper product manufacturer, Britain'
  };
  const r = subjectStatus.inspect(personData, null, 'person');
  // 1999 (latest) vs cutoff (NOW - 110). 1999 is well within the cap, so no inference.
  t.equal(r.isLiving, true);
  t.equal(r.deathDateInferred, null);
  t.end();
});

test('subject-status: brief bio with all years past cap → inferred deceased; latest wins', function (t) {
  const personData = {
    birthDate: '',
    deathDate: '',
    briefBiography: '1856-1905, manufacturer of sewing machines, Bridgeport, Connecticut, United States'
  };
  const r = subjectStatus.inspect(personData, null, 'person');
  t.equal(r.isLiving, false);
  t.equal(r.deathDateInferred, '1905', 'picks the latest of the two years');
  t.end();
});

test('subject-status: company is NOT subject to person-lifespan inference', function (t) {
  const personData = {
    birthDate: '',
    deathDate: '',
    briefBiography: 'active 1817-1839, instrument maker'
  };
  const r = subjectStatus.inspect(personData, null, 'company');
  t.equal(r.isLiving, true, 'company stays "active" without explicit dissolution date');
  t.equal(r.status, 'active');
  t.equal(r.deathDateInferred, null);
  t.end();
});

test('subject-status: organisation is NOT subject to person-lifespan inference', function (t) {
  const personData = {
    birthDate: '',
    deathDate: '',
    briefBiography: '1856-1905'
  };
  const r = subjectStatus.inspect(personData, null, 'organisation');
  t.equal(r.isLiving, true);
  t.equal(r.deathDateInferred, null);
  t.end();
});

test('subject-status: inference does not run if either internal or wikidata death exists', function (t) {
  const personData = {
    birthDate: '1791',
    deathDate: '',
    briefBiography: 'active 1817-1839'
  };
  // Wikidata says deceased — that should win, not the inference
  const wd = { 'date of death': { value: '1871' } };
  const r = subjectStatus.inspect(personData, wd, 'person');
  t.equal(r.deathDateSource, 'wikidata');
  t.equal(r.deathDate, '1871');
  t.equal(r.deathDateInferred, null);
  t.end();
});

test('subject-status: brief bio with no parseable years → no inference', function (t) {
  const personData = {
    birthDate: '',
    deathDate: '',
    briefBiography: 'optical instrument maker, London, England'
  };
  const r = subjectStatus.inspect(personData, null, 'person');
  t.equal(r.isLiving, true);
  t.equal(r.deathDateInferred, null);
  t.end();
});

test('subject-status: empty personData yields living-with-no-data', function (t) {
  const r = subjectStatus.inspect({}, null, 'person');
  t.equal(r.isLiving, true);
  t.equal(r.deathDate, null);
  t.equal(r.deathDateInferred, null);
  t.equal(r.birthDate, null);
  t.equal(r.birthDateSource, null);
  t.end();
});

test('subject-status: birthDate from internal personData', function (t) {
  const r = subjectStatus.inspect({ birthDate: '1972-03-14' }, null, 'person');
  t.equal(r.birthDate, '1972-03-14');
  t.equal(r.birthDateSource, 'internal');
  t.end();
});

test('subject-status: birthDate from wikidata when internal absent', function (t) {
  const wd = { 'date of birth': { value: '1972-03-14' } };
  const r = subjectStatus.inspect({}, wd, 'person');
  t.equal(r.birthDate, '1972-03-14');
  t.equal(r.birthDateSource, 'wikidata');
  t.end();
});

test('subject-status: internal birthDate wins over wikidata', function (t) {
  const wd = { 'date of birth': { value: '1900-01-01' } };
  const r = subjectStatus.inspect({ birthDate: '1972-03-14' }, wd, 'person');
  t.equal(r.birthDate, '1972-03-14');
  t.equal(r.birthDateSource, 'internal');
  t.end();
});

test('subject-status: organisation birthDate populated from wikidata inception', function (t) {
  const wd = { inception: { value: '1865' } };
  const r = subjectStatus.inspect({}, wd, 'organisation');
  t.equal(r.birthDate, '1865');
  t.equal(r.birthDateSource, 'wikidata');
  t.end();
});

test('isSuppressedOnPublicSite: deceased person never suppressed', function (t) {
  const status = { isLiving: false, subjectType: 'person' };
  t.equal(subjectStatus.isSuppressedOnPublicSite(status, {}), false);
  t.end();
});

test('isSuppressedOnPublicSite: living person suppressed when flag off', function (t) {
  const status = { isLiving: true, subjectType: 'person' };
  t.equal(subjectStatus.isSuppressedOnPublicSite(status, { aiBiographyIncludeLiving: false }), true);
  t.end();
});

test('isSuppressedOnPublicSite: living person served when flag on', function (t) {
  const status = { isLiving: true, subjectType: 'person' };
  t.equal(subjectStatus.isSuppressedOnPublicSite(status, { aiBiographyIncludeLiving: true }), false);
  t.end();
});

test('isSuppressedOnPublicSite: active company always served', function (t) {
  const status = { isLiving: true, subjectType: 'company' };
  t.equal(subjectStatus.isSuppressedOnPublicSite(status, {}), false);
  t.end();
});
