'use strict';

const test = require('tape');
const prompts = require('../lib/ai/prompts/biography');

test('prompts/biography: exports version string', function (t) {
  t.equal(typeof prompts.version, 'string', 'version is string');
  t.ok(prompts.version.length > 0, 'version not empty');
  t.end();
});

test('prompts/biography: systemPrompt contains key instructions', function (t) {
  t.ok(prompts.systemPrompt.indexOf('ONLY use facts') !== -1, 'contains fact restriction');
  t.ok(prompts.systemPrompt.indexOf('confidence') !== -1, 'mentions confidence');
  t.ok(prompts.systemPrompt.indexOf('sourcesSummary') !== -1, 'mentions sourcesSummary');
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

  const prompt = prompts.buildUserPrompt(personData, items, null);
  t.ok(prompt.indexOf('Ada Lovelace') !== -1, 'includes name');
  t.ok(prompt.indexOf('1815') !== -1, 'includes birth date');
  t.ok(prompt.indexOf('Mathematician') !== -1, 'includes occupation');
  t.ok(prompt.indexOf('Analytical Engine') !== -1, 'includes collection item');
  t.ok(prompt.indexOf('co100') !== -1, 'includes item ID');
  t.ok(prompt.indexOf('confidence') !== -1, 'mentions confidence in output format');
  t.ok(prompt.indexOf('sourcesSummary') !== -1, 'mentions sourcesSummary in output format');
  t.end();
});

test('prompts/biography: buildUserPrompt handles no items', function (t) {
  const personData = { name: 'Test Person' };
  const prompt = prompts.buildUserPrompt(personData, [], null);
  t.ok(prompt.indexOf('No collection items') !== -1, 'shows no items message');
  t.end();
});

test('prompts/biography: buildUserPrompt includes wikidata when provided', function (t) {
  const personData = { name: 'Test' };
  const wikidata = { description: 'A scientist', wikipediaUrl: 'https://en.wikipedia.org/wiki/Test' };
  const prompt = prompts.buildUserPrompt(personData, [], wikidata);
  t.ok(prompt.indexOf('WIKIDATA') !== -1, 'includes wikidata section');
  t.ok(prompt.indexOf('A scientist') !== -1, 'includes wikidata description');
  t.end();
});

test('prompts/biography: buildUserPrompt omits empty optional fields', function (t) {
  const personData = { name: 'Minimal' };
  const prompt = prompts.buildUserPrompt(personData, [], null);
  t.ok(prompt.indexOf('Born:') === -1, 'no birth date line');
  t.ok(prompt.indexOf('Occupation:') === -1, 'no occupation line');
  t.ok(prompt.indexOf('WIKIDATA') === -1, 'no wikidata section');
  t.end();
});
