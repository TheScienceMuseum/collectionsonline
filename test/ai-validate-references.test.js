'use strict';

const test = require('tape');
const validateReferences = require('../lib/ai/validate-references');

test('validateReferences: keeps valid links', function (t) {
  const html = '<p>See the <a href="/objects/co12345">Steam Engine</a> in our collection.</p>';
  const items = [{ id: 'co12345', title: 'Steam Engine' }];
  const result = validateReferences(html, items);
  t.ok(result.indexOf('<a href="/objects/co12345">Steam Engine</a>') !== -1, 'valid link kept');
  t.end();
});

test('validateReferences: strips hallucinated links', function (t) {
  const html = '<p>See the <a href="/objects/co99999">Fake Object</a> here.</p>';
  const items = [{ id: 'co12345', title: 'Real Object' }];
  const result = validateReferences(html, items);
  t.ok(result.indexOf('<a') === -1, 'hallucinated link stripped');
  t.ok(result.indexOf('Fake Object') !== -1, 'link text preserved');
  t.end();
});

test('validateReferences: handles multiple links mixed valid/invalid', function (t) {
  const html = '<p><a href="/objects/co111">Good</a> and <a href="/objects/co999">Bad</a></p>';
  const items = [{ id: 'co111', title: 'Good' }];
  const result = validateReferences(html, items);
  t.ok(result.indexOf('<a href="/objects/co111">Good</a>') !== -1, 'valid kept');
  t.ok(result.indexOf('<a href="/objects/co999">') === -1, 'invalid stripped');
  t.ok(result.indexOf('Bad') !== -1, 'text preserved');
  t.end();
});

test('validateReferences: returns original html when no items', function (t) {
  const html = '<p>Some text</p>';
  t.equal(validateReferences(html, []), html, 'empty items returns original');
  t.equal(validateReferences(html, null), html, 'null items returns original');
  t.end();
});

test('validateReferences: returns null/undefined input as-is', function (t) {
  t.equal(validateReferences(null, [{ id: 'co1' }]), null, 'null html');
  t.equal(validateReferences('', [{ id: 'co1' }]), '', 'empty string');
  t.end();
});
