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

const childRecordsCo26704YoutubeSf = require('./fixtures/elastic-responses/sph-child-records-co26704-youtube-sketchfab.json');
const parentCo26704MultiYoutube = require('./fixtures/elastic-responses/sph-parent-co26704-multi-youtube.json');
const childRecordsCo26704MultiYoutube = require('./fixtures/elastic-responses/sph-child-records-co26704-multi-youtube.json');

const parentCoYtNoSf = require('./fixtures/elastic-responses/sph-parent-co-yt-no-sf.json');
const childRecordsCoYtNoSf = require('./fixtures/elastic-responses/sph-child-records-co-yt-no-sf.json');

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

// ─── YouTube/SketchFab pull-up: basic pull-up from child ─────────────────────

test(file + 'co26704 + youtube/sf child: YouTube is pulled up when parent has no enhancement', function (t) {
  t.plan(2);
  const response = buildJSONResponse(parentCo26704, config, null, null, childRecordsCo26704YoutubeSf);
  const web = response.data.attributes.enhancement && response.data.attributes.enhancement.web;
  t.ok(Array.isArray(web), 'enhancement.web should be an array');
  const youtube = web.filter((el) => el.platform === 'youtube');
  t.equal(youtube.length, 1, 'should have exactly 1 YouTube item pulled from child');
  t.end();
});

test(file + 'co26704 + youtube/sf child: SketchFab is pulled up when parent has no enhancement', function (t) {
  t.plan(1);
  const response = buildJSONResponse(parentCo26704, config, null, null, childRecordsCo26704YoutubeSf);
  const web = response.data.attributes.enhancement.web;
  const sketchfab = web.filter((el) => el.platform === 'sketchfab');
  t.equal(sketchfab.length, 1, 'should have exactly 1 SketchFab item pulled from child');
  t.end();
});

test(file + 'co26704 + youtube/sf child: total enhancement.web has 2 items (1 youtube + 1 sketchfab)', function (t) {
  t.plan(1);
  const response = buildJSONResponse(parentCo26704, config, null, null, childRecordsCo26704YoutubeSf);
  const web = response.data.attributes.enhancement.web;
  t.equal(web.length, 2, 'should have 2 web enhancement items total');
  t.end();
});

// ─── YouTube/SketchFab pull-up: parent + child both have YouTube ──────────────

test(file + 'yt-no-sf parent + child: both parent and child YouTube items are included', function (t) {
  t.plan(3);
  const response = buildJSONResponse(parentCoYtNoSf, config, null, null, childRecordsCoYtNoSf);
  const web = response.data.attributes.enhancement.web;
  const youtubeItems = web.filter((el) => el.platform === 'youtube');
  t.equal(youtubeItems.length, 2, 'should have 2 YouTube items (parent + child)');
  t.equal(youtubeItems[0].id, 'parent-youtube-id', 'first YouTube id should be the parent\'s');
  t.equal(youtubeItems[1].id, 'child-youtube-id', 'second YouTube id should be the child\'s');
  t.end();
});

test(file + 'yt-no-sf parent + child: missing SketchFab is pulled from child (mixed case)', function (t) {
  t.plan(2);
  const response = buildJSONResponse(parentCoYtNoSf, config, null, null, childRecordsCoYtNoSf);
  const web = response.data.attributes.enhancement.web;
  const sfItems = web.filter((el) => el.platform === 'sketchfab');
  t.equal(sfItems.length, 1, 'should have exactly 1 SketchFab item pulled from child');
  t.equal(sfItems[0].id, 'child-sketchfab-id', 'SketchFab id should come from the child');
  t.end();
});

// ─── YouTube/SketchFab pull-up: all items from all children ──────────────────

test(file + 'co26704 + multi-youtube children: all YouTube items from all children are included', function (t) {
  t.plan(3);
  const response = buildJSONResponse(parentCo26704MultiYoutube, config, null, null, childRecordsCo26704MultiYoutube);
  const web = response.data.attributes.enhancement.web;
  const youtubeItems = web.filter((el) => el.platform === 'youtube');
  t.equal(youtubeItems.length, 2, 'should have 2 YouTube items (one per child)');
  t.equal(youtubeItems[0].id, 'first-child-youtube-id', 'first YouTube id should come from the first child');
  t.equal(youtubeItems[1].id, 'second-child-youtube-id', 'second YouTube id should come from the second child');
  t.end();
});
