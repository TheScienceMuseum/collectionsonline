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
  // Person-lifespan-cap path (110 years) does not apply to orgs. The
  // org-specific classification (historical / unknown / active) does;
  // a company whose latest activity year is 1839 reaches 'historical'
  // via that path, NOT via person-lifespan inference (deathDateInferred
  // stays null because that's the person-only path).
  const personData = {
    birthDate: '',
    deathDate: '',
    briefBiography: 'active 1817-1839, instrument maker'
  };
  const r = subjectStatus.inspect(personData, null, 'company');
  t.equal(r.deathDateInferred, null,
    'person-lifespan inference path does not run for companies');
  t.end();
});

test('subject-status: organisation is NOT subject to person-lifespan inference', function (t) {
  const personData = {
    birthDate: '',
    deathDate: '',
    briefBiography: '1856-1905'
  };
  const r = subjectStatus.inspect(personData, null, 'organisation');
  // Person-lifespan path doesn't run for organisations. The org-specific
  // classification will handle this record (1905 is more than 50 years
  // ago → 'historical'); the assertion here is only that the
  // person-lifespan inference channel is not engaged.
  t.equal(r.deathDateInferred, null,
    'person-lifespan inference path does not run for organisations');
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

// =====================================================================
// Four-state organisation classification (active / unknown / historical
// / dissolved). See subject-status.js header for the semantics. Tests
// cover the intended decision tree:
//   - 'current'/'present' marker → 'active' regardless of years
//   - latest activity year ≤ NOW - 50 → 'historical'
//   - latest activity year > NOW - 50 → 'unknown'
//   - no parseable years → 'active' (preserves prior default behaviour)
//   - structured dissolution date always wins → 'dissolved'
// =====================================================================

const ORG_HISTORICAL_CUTOFF_YEAR = NOW_YEAR - subjectStatus.ORG_HISTORICAL_CUTOFF_YEARS;

test('org status: structured dissolution date → dissolved (highest precedence)', function (t) {
  const r = subjectStatus.inspect(
    { deathDate: '1905', briefBiography: 'active 1856-1905, manufacturer' },
    null,
    'organisation'
  );
  t.equal(r.status, 'dissolved');
  t.equal(r.isLiving, false);
  t.end();
});

test('org status: "current" marker in brief bio → active regardless of dates', function (t) {
  const r = subjectStatus.inspect(
    { briefBiography: 'active 1820-current(2009), printer, London' },
    null,
    'organisation'
  );
  t.equal(r.status, 'active');
  t.equal(r.isLiving, true);
  t.ok(r.organisationStatusReasoning &&
    r.organisationStatusReasoning.indexOf('current') !== -1);
  t.end();
});

test('org status: "Present" marker → active', function (t) {
  const r = subjectStatus.inspect(
    { briefBiography: '1869 - Present, supermarket retailer, British' },
    null,
    'organisation'
  );
  t.equal(r.status, 'active');
  t.end();
});

test('org status: latest activity > 50 years ago → historical', function (t) {
  const r = subjectStatus.inspect(
    { briefBiography: 'active 1856-1905, manufacturer of sewing machines' },
    null,
    'organisation'
  );
  t.equal(r.status, 'historical');
  t.equal(r.isLiving, false);
  t.equal(r.latestActivityYear, 1905);
  t.equal(r.activityText, 'active 1856-1905',
    'matched activity range surfaced for inline UI display');
  t.end();
});

test('org status: latest activity within last 50 years → unknown (recent enough to be ambiguous)', function (t) {
  // Use a year that's clearly within the cutoff window — current year minus
  // 10 — so the test stays correct when the year rolls over.
  const recentYear = NOW_YEAR - 10;
  const r = subjectStatus.inspect(
    { briefBiography: 'active ' + recentYear + 's, recycled paper product manufacturer, Britain' },
    null,
    'organisation'
  );
  t.equal(r.status, 'unknown');
  t.equal(r.isLiving, true,
    'unknown orgs treated as still-possibly-active for downstream policy');
  // 1990s style — extracts the decade-start year as "latest"
  t.ok(r.latestActivityYear >= recentYear,
    'latest activity year is within the recent cutoff window');
  t.end();
});

test('org status: cp46254 case (active 1990s) → unknown', function (t) {
  // Real-world case from the catalogue that prompted this work.
  const r = subjectStatus.inspect(
    { briefBiography: 'active 1990s, recycled paper product manufacturer, Britain' },
    null,
    'organisation'
  );
  t.equal(r.status, 'unknown');
  t.equal(r.activityText, 'active 1990s');
  t.end();
});

test('org status: no brief biography → active (default, preserves prior behaviour)', function (t) {
  const r = subjectStatus.inspect({}, null, 'organisation');
  t.equal(r.status, 'active');
  t.equal(r.isLiving, true);
  t.equal(r.activityText, null);
  t.equal(r.latestActivityYear, null);
  t.end();
});

test('org status: brief biography with no parseable years → active (default)', function (t) {
  const r = subjectStatus.inspect(
    { briefBiography: 'pharmaceutical manufacturer, British' },
    null,
    'organisation'
  );
  t.equal(r.status, 'active');
  t.equal(r.latestActivityYear, null);
  t.end();
});

test('org status: bare-range with no "active" prefix is also classified', function (t) {
  // E.g., "1828-1903, locomotive manufacturer" — same historical signal.
  const r = subjectStatus.inspect(
    { briefBiography: '1828-1903, locomotive manufacturer, Manchester' },
    null,
    'organisation'
  );
  t.equal(r.status, 'historical');
  t.equal(r.latestActivityYear, 1903);
  t.end();
});

test('org status: cutoff boundary (exactly at the cutoff year) → historical', function (t) {
  // Edge case — equality is treated as "past the cutoff" (≤).
  const r = subjectStatus.inspect(
    { briefBiography: 'active 1900-' + ORG_HISTORICAL_CUTOFF_YEAR + ', textile mill' },
    null,
    'organisation'
  );
  t.equal(r.status, 'historical');
  t.end();
});

test('org status: just inside the cutoff (cutoff + 1) → unknown', function (t) {
  const r = subjectStatus.inspect(
    { briefBiography: 'active 1900-' + (ORG_HISTORICAL_CUTOFF_YEAR + 1) + ', textile mill' },
    null,
    'organisation'
  );
  t.equal(r.status, 'unknown');
  t.end();
});

test('org status: person classification path is unaffected by org-status changes', function (t) {
  // Sanity: the new four-state logic is org-only. Persons still go through
  // the lifespan-cap inference path.
  const r = subjectStatus.inspect(
    { briefBiography: 'active 1990s, photographer' },
    null,
    'person'
  );
  t.equal(r.status, 'active', 'living person');
  t.equal(r.activityText, null, 'org activity fields not populated for persons');
  t.equal(r.latestActivityYear, null);
  t.end();
});

// Public-site policy: orgs are always served, regardless of the new
// four-state classification. Verify all four cases pass through.
test('isSuppressedOnPublicSite: org with status=active served', function (t) {
  t.equal(subjectStatus.isSuppressedOnPublicSite(
    { isLiving: true, subjectType: 'organisation', status: 'active' }, {}), false);
  t.end();
});

test('isSuppressedOnPublicSite: org with status=unknown served', function (t) {
  t.equal(subjectStatus.isSuppressedOnPublicSite(
    { isLiving: true, subjectType: 'organisation', status: 'unknown' }, {}), false);
  t.end();
});

test('isSuppressedOnPublicSite: org with status=historical served (isLiving=false but org)', function (t) {
  t.equal(subjectStatus.isSuppressedOnPublicSite(
    { isLiving: false, subjectType: 'organisation', status: 'historical' }, {}), false);
  t.end();
});

test('isSuppressedOnPublicSite: org with status=dissolved served', function (t) {
  t.equal(subjectStatus.isSuppressedOnPublicSite(
    { isLiving: false, subjectType: 'organisation', status: 'dissolved' }, {}), false);
  t.end();
});
