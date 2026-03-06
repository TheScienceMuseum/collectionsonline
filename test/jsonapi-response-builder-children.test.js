/**
 * Tests for child record rendering in buildJSONResponse.
 *
 * Covers:
 * - Children array is populated from child records list
 * - Location data on child records is preserved
 * - enhancement.web blocks on children are pulled up to the parent record
 * - Multimedia on child records is preserved
 * - All three representative records: co8364603, co8413731, co26704
 *
 * These tests use only the fields returned after the _source filter is applied
 * in lib/get-child-records.js, verifying nothing breaks with the reduced field set.
 */

const test = require('tape');
const config = require('../config');
const dir = __dirname.split('/')[__dirname.split('/').length - 1];
const file = dir + __filename.replace(__dirname, '') + ' > ';
const buildJSONResponse = require('../lib/jsonapi-response.js');

const parentCo8364603 = require('./fixtures/elastic-responses/sph-parent-co8364603.json');
const childRecordsCo8364603 = require('./fixtures/elastic-responses/sph-child-records-co8364603.json');

const parentCo26704 = require('./fixtures/elastic-responses/sph-parent-co26704.json');
const childRecordsCo26704 = require('./fixtures/elastic-responses/sph-child-records-co26704.json');

const parentCo8413731 = require('./fixtures/elastic-responses/sph-parent-co8413731.json');
const childRecordsCo8413731 = require('./fixtures/elastic-responses/sph-child-records-co8413731.json');

// ─── co8364603: location data on children ────────────────────────────────────

test(file + 'co8364603: response is built without throwing', function (t) {
  t.plan(1);
  t.doesNotThrow(() => {
    buildJSONResponse(parentCo8364603, config, null, null, childRecordsCo8364603);
  }, 'buildJSONResponse does not throw with child records list');
  t.end();
});

test(file + 'co8364603: children array is populated', function (t) {
  t.plan(2);
  const response = buildJSONResponse(parentCo8364603, config, null, null, childRecordsCo8364603);
  t.ok(Array.isArray(response.data.children), 'children should be an array');
  t.equal(response.data.children.length, 2, 'should have 2 child records');
  t.end();
});

test(file + 'co8364603: child records have location data', function (t) {
  t.plan(2);
  const response = buildJSONResponse(parentCo8364603, config, null, null, childRecordsCo8364603);
  const child1 = response.data.children[0];
  const child2 = response.data.children[1];
  t.ok(child1.data.attributes.location, 'first child should have location');
  t.ok(child2.data.attributes.location, 'second child should have location');
  t.end();
});

test(file + 'co8364603: child location values are correct', function (t) {
  t.plan(2);
  const response = buildJSONResponse(parentCo8364603, config, null, null, childRecordsCo8364603);
  const child1 = response.data.children[0];
  const child2 = response.data.children[1];
  t.equal(
    child1.data.attributes.location[0].value,
    'Science Museum, Energy Hall, Case 1',
    'first child location value should be correct'
  );
  t.equal(
    child2.data.attributes.location[0].value,
    'Science Museum, Energy Hall, Case 2',
    'second child location value should be correct'
  );
  t.end();
});

test(file + 'co8364603: child records have title and description', function (t) {
  t.plan(2);
  const response = buildJSONResponse(parentCo8364603, config, null, null, childRecordsCo8364603);
  const child1 = response.data.children[0];
  t.ok(child1.data.attributes.title, 'child should have title');
  t.ok(child1.data.attributes.description, 'child should have description');
  t.end();
});

test(file + 'co8364603: child records have measurements', function (t) {
  t.plan(1);
  const response = buildJSONResponse(parentCo8364603, config, null, null, childRecordsCo8364603);
  const child1 = response.data.children[0];
  t.ok(child1.data.attributes.measurements, 'child should have measurements');
  t.end();
});

test(file + 'co8364603: child records have ondisplay', function (t) {
  t.plan(1);
  const response = buildJSONResponse(parentCo8364603, config, null, null, childRecordsCo8364603);
  const child1 = response.data.children[0];
  t.ok(child1.data.attributes.ondisplay, 'child should have ondisplay');
  t.end();
});

// ─── co26704: enhancement.web pull-up from child to parent ───────────────────

test(file + 'co26704: response is built without throwing', function (t) {
  t.plan(1);
  t.doesNotThrow(() => {
    buildJSONResponse(parentCo26704, config, null, null, childRecordsCo26704);
  }, 'buildJSONResponse does not throw for rocket record');
  t.end();
});

test(file + 'co26704: enhancement.web is pulled up from child to parent', function (t) {
  t.plan(3);
  const response = buildJSONResponse(parentCo26704, config, null, null, childRecordsCo26704);
  const enhancement = response.data.attributes.enhancement;
  t.ok(enhancement, 'parent should have an enhancement block after pull-up');
  t.ok(Array.isArray(enhancement.web), 'parent enhancement.web should be an array');
  t.equal(enhancement.web.length, 1, 'should have 1 pulled-up web enhancement');
  t.end();
});

test(file + 'co26704: pulled-up enhancement.web has correct platform', function (t) {
  t.plan(1);
  const response = buildJSONResponse(parentCo26704, config, null, null, childRecordsCo26704);
  const webEnhancement = response.data.attributes.enhancement.web[0];
  t.equal(webEnhancement.platform, '3D', 'web enhancement platform should be 3D');
  t.end();
});

test(file + 'co26704: child is still in children array after enhancement pull-up', function (t) {
  t.plan(1);
  const response = buildJSONResponse(parentCo26704, config, null, null, childRecordsCo26704);
  t.equal(response.data.children.length, 1, 'children array should still contain the child');
  t.end();
});

// ─── co8413731: enhancement.web merge (parent + child both have enhancement.web) ─

test(file + 'co8413731: response is built without throwing', function (t) {
  t.plan(1);
  t.doesNotThrow(() => {
    buildJSONResponse(parentCo8413731, config, null, null, childRecordsCo8413731);
  }, 'buildJSONResponse does not throw for co8413731');
  t.end();
});

test(file + 'co8413731: enhancement.web from child is merged with parent enhancement.web', function (t) {
  t.plan(2);
  const response = buildJSONResponse(parentCo8413731, config, null, null, childRecordsCo8413731);
  const enhancement = response.data.attributes.enhancement;
  t.ok(Array.isArray(enhancement.web), 'enhancement.web should be an array after merge');
  t.equal(enhancement.web.length, 2, 'merged enhancement.web should have 2 entries (1 parent + 1 child)');
  t.end();
});

test(file + 'co8413731: children array is populated', function (t) {
  t.plan(1);
  const response = buildJSONResponse(parentCo8413731, config, null, null, childRecordsCo8413731);
  t.equal(response.data.children.length, 2, 'should have 2 children');
  t.end();
});

test(file + 'co8413731: child with multimedia has multimedia attribute', function (t) {
  t.plan(1);
  const response = buildJSONResponse(parentCo8413731, config, null, null, childRecordsCo8413731);
  const child1 = response.data.children[0];
  t.ok(child1.data.attributes.multimedia, 'first child should have multimedia');
  t.end();
});

test(file + 'co8413731: child with location data has location attribute', function (t) {
  t.plan(1);
  const response = buildJSONResponse(parentCo8413731, config, null, null, childRecordsCo8413731);
  const child1 = response.data.children[0];
  t.ok(child1.data.attributes.location, 'first child should have location');
  t.end();
});

test(file + 'co8413731: parent record type is correct', function (t) {
  t.plan(1);
  const response = buildJSONResponse(parentCo8413731, config, null, null, childRecordsCo8413731);
  t.equal(response.data.type, 'objects', 'record type should be objects');
  t.end();
});

// ─── No child records passed (empty list) ────────────────────────────────────

test(file + 'children is empty array when no child records passed', function (t) {
  t.plan(1);
  const response = buildJSONResponse(parentCo8364603, config, null, null, []);
  t.equal(response.data.children.length, 0, 'children should be empty when no child records provided');
  t.end();
});

test(file + 'children is empty array when childRecordsList is undefined', function (t) {
  t.plan(1);
  const response = buildJSONResponse(parentCo8364603, config, null, null, undefined);
  t.equal(response.data.children.length, 0, 'children should be empty when childRecordsList is undefined');
  t.end();
});
