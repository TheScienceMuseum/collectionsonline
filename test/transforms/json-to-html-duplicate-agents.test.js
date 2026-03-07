const test = require('tape');
const config = require('../../config');
const buildJSONResponse = require('../../lib/jsonapi-response');
const buildHTMLData = require('../../lib/transforms/json-to-html-data');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';

const fixture = require('../fixtures/elastic-responses/example-get-response-object-duplicate-agents.json');

// ---------------------------------------------------------------------------
// Full-pipeline tests (ES fixture → JSON:API → HTML template data)
// Fixture co71938 has 3 agents, each appearing twice in the ES agent array:
//   cp74281 Roch         – twice with unlisted roles ("association details")
//   cp99001 Marie Curie  – twice with mixed-case allowed roles (Donor / Founder)
//   cp99002 Louis Pasteur– twice with the same allowed role (donor / donor)
// ---------------------------------------------------------------------------

test(file + 'HTMLData should be transformed successfully', (t) => {
  t.plan(1);
  t.doesNotThrow(() => {
    const JSONAPIResponse = buildJSONResponse(fixture, config);
    buildHTMLData(JSONAPIResponse);
  }, 'Transform did not throw error');
  t.end();
});

test(file + 'same id / unlisted roles (Roch "association details") → appears once with no role label', (t) => {
  t.plan(2);
  const HTMLData = buildHTMLData(buildJSONResponse(fixture, config));
  const roch = HTMLData.related.people.filter((p) => p.attributes.summary.title === 'Roch');
  t.equal(roch.length, 1, 'Roch should appear exactly once');
  t.equal(roch[0].attributes.role, null, 'Roch role should be null (unlisted value)');
  t.end();
});

test(file + 'same id / same allowed role (Louis Pasteur "donor" + "donor") → appears once', (t) => {
  t.plan(3);
  const HTMLData = buildHTMLData(buildJSONResponse(fixture, config));
  const pasteur = HTMLData.related.people.filter((p) => p.attributes.summary.title === 'Louis Pasteur');
  t.equal(pasteur.length, 1, 'Louis Pasteur should appear exactly once');
  t.ok(pasteur[0].attributes.role, 'Louis Pasteur should have a role');
  t.equal(pasteur[0].attributes.role.value, 'donor', 'Role should be "donor" (not duplicated)');
  t.end();
});

test(file + 'roles should be displayed in lowercase regardless of index casing', (t) => {
  t.plan(1);
  const HTMLData = buildHTMLData(buildJSONResponse(fixture, config));
  const withRoles = HTMLData.related.people.filter((p) => p.attributes.role && p.attributes.role.value);
  const allLowercase = withRoles.every((p) => p.attributes.role.value === p.attributes.role.value.toLowerCase());
  t.ok(allLowercase, 'All displayed roles should be lowercase');
  t.end();
});

test(file + 'case-insensitive matching allows mixed-case roles like "Donor" / "Founder" from index', (t) => {
  t.plan(2);
  const HTMLData = buildHTMLData(buildJSONResponse(fixture, config));
  const curie = HTMLData.related.people.find((p) => p.attributes.summary.title === 'Marie Curie');
  t.ok(curie, 'Marie Curie should appear in related people');
  t.ok(curie.attributes.role, 'Mixed-case role from index should be allowed via case-insensitive match');
  t.end();
});

test(file + 'total unique people should equal number of distinct agent ids in fixture', (t) => {
  t.plan(1);
  // Fixture has 3 distinct agent ids (cp74281, cp99001, cp99002) each appearing twice.
  // After deduplication, related.people should have exactly 3 entries.
  const HTMLData = buildHTMLData(buildJSONResponse(fixture, config));
  t.equal(HTMLData.related.people.length, 3, 'related.people should have 3 unique entries (one per distinct id)');
  t.end();
});

// Note on deduplication:
// getRelationships (jsonapi-response.js) deduplicates relationship refs by {id, type}
// before they reach getIncluded, so included will only ever contain one entry per unique
// id. The map() + Array.find in getRelated therefore cannot produce duplicate entries,
// making a downstream seen-map unnecessary. The tests above verify the deduplicated
// output is correct regardless of which layer does the work.
