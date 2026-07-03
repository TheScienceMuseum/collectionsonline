'use strict';

const test = require('tape');
const promptLoader = require('../lib/ai/prompts/biography');

// The active default prompt is now v7 (source-tagged, response
// schema is sentences[]). v7 has its own test coverage via
// test/ai-generate-source-tagged-biography.test.js +
// test/ai-parse-source-tagged-response.test.js. The assertions in
// this file were authored against v6's prose-shape prompt and check
// v6-specific wording ("ONLY use facts", "COMPANY:" label, etc.),
// so we resolve v6 explicitly here rather than the auto-selected
// active default. Keeps v6 loadable + parseable for the compare
// view without pinning the active version to it. Delete this file
// entirely once v6 is retired (see the plan's Phase 1 cutover +
// the user's earlier "ask before removing old prompts" note).
const V6_VERSION = '2026-04-v6-numeric-confidence';
const prompts = promptLoader.getVersion(V6_VERSION) || promptLoader;

const PERSON_SUBJECT = { noun: 'person', pronoun: 'they', possessive: 'their' };

test('prompts/biography: exports version string', function (t) {
  t.equal(typeof prompts.version, 'string', 'version is string');
  t.ok(prompts.version.length > 0, 'version not empty');
  t.end();
});

test('prompts/biography: v6 remains loadable via prompt-loader registry (compare-view A/B)', function (t) {
  // Regression guard for the compare view: if v6 is ever renamed or
  // moved without a compare-view rewrite, this test catches it.
  t.ok(promptLoader.getVersion(V6_VERSION), 'v6 is registered');
  t.end();
});

test('prompts/biography: systemPrompt contains key instructions', function (t) {
  t.ok(prompts.systemPrompt.indexOf('ONLY use facts') !== -1, 'contains fact restriction');
  t.ok(prompts.systemPrompt.indexOf('confidence') !== -1, 'mentions confidence');
  t.ok(prompts.systemPrompt.indexOf('JSON') !== -1, 'mentions JSON');
  t.end();
});

test('prompts/biography: buildUserPrompt includes person data', function (t) {
  const personData = {
    name: 'Ada Lovelace',
    birthDate: '1815',
    occupation: 'Mathematician',
    biography: 'Pioneer of computing.'
  };
  const items = [
    { id: 'co100', title: 'Analytical Engine', link: '/objects/co100', type: 'object', role: 'creator' }
  ];

  const prompt = prompts.buildUserPrompt(personData, items, null, PERSON_SUBJECT);
  t.ok(prompt.indexOf('Ada Lovelace') !== -1, 'includes name');
  t.ok(prompt.indexOf('1815') !== -1, 'includes birth date');
  t.ok(prompt.indexOf('Mathematician') !== -1, 'includes occupation');
  t.ok(prompt.indexOf('Analytical Engine') !== -1, 'includes collection item');
  t.ok(prompt.indexOf('co100') !== -1, 'includes item ID');
  t.ok(prompt.indexOf('confidence') !== -1, 'mentions confidence in output format');
  t.end();
});

test('prompts/biography: buildUserPrompt handles no items', function (t) {
  const personData = { name: 'Test Person' };
  const prompt = prompts.buildUserPrompt(personData, [], null, PERSON_SUBJECT);
  t.ok(prompt.indexOf('No collection items') !== -1, 'shows no items message');
  t.end();
});

test('prompts/biography: buildUserPrompt includes wikidata when provided', function (t) {
  const personData = { name: 'Test' };
  // Use a field that isn't skipped by formatWikidata (description is skipped
  // because it often duplicates what we already provide).
  const wikidata = { industry: { value: 'computing' } };
  const prompt = prompts.buildUserPrompt(personData, [], wikidata, PERSON_SUBJECT);
  t.ok(prompt.indexOf('ADDITIONAL BIOGRAPHICAL PROPERTIES') !== -1, 'includes wikidata section header');
  t.ok(prompt.indexOf('computing') !== -1, 'includes wikidata value');
  t.end();
});

test('prompts/biography: buildUserPrompt omits empty optional fields', function (t) {
  const personData = { name: 'Minimal' };
  const prompt = prompts.buildUserPrompt(personData, [], null, PERSON_SUBJECT);
  t.ok(prompt.indexOf('Born:') === -1, 'no birth date line');
  t.ok(prompt.indexOf('Occupation:') === -1, 'no occupation line');
  t.ok(prompt.indexOf('ADDITIONAL BIOGRAPHICAL PROPERTIES') === -1, 'no wikidata section');
  t.end();
});

test('prompts/biography: buildUserPrompt adapts wording to subject type', function (t) {
  const personData = { name: 'NeXT' };
  const company = { noun: 'company', pronoun: 'it', possessive: 'its' };
  const prompt = prompts.buildUserPrompt(personData, [], null, company);
  t.ok(prompt.indexOf('COMPANY:') !== -1, 'uses COMPANY label for company subject');
  t.ok(prompt.indexOf('this company') !== -1, 'addresses subject as "this company"');
  t.end();
});
