'use strict';

const test = require('tape');
const parse = require('../lib/ai/parse-brief-biography-dates');

test('parseBriefBiographyDates: detects "active YYYY-YYYY" range', function (t) {
  const r = parse('active 1817-1839, optical & mathematical instrument maker, London, England');
  t.ok(r, 'returns a result');
  t.equal(r.kind, 'active-range', 'kind is active-range');
  t.end();
});

test('parseBriefBiographyDates: detects bare "YYYY-YYYY" range', function (t) {
  const r = parse('1856-1905, manufacturer of sewing machines, Bridgeport');
  t.ok(r, 'returns a result');
  t.equal(r.kind, 'bare-range', 'kind is bare-range');
  t.end();
});

test('parseBriefBiographyDates: detects decade text', function (t) {
  const r = parse('active 1990s, recycled paper product manufacturer, Britain');
  t.ok(r, 'returns a result');
  t.equal(r.kind, 'active-decade', 'kind is active-decade');
  t.end();
});

test('parseBriefBiographyDates: detects multi-decade text', function (t) {
  const r = parse('active 1940s-1950s, press photographer, Britain');
  t.ok(r, 'returns a result');
  t.equal(r.kind, 'active-decade', 'kind is active-decade');
  t.end();
});

test('parseBriefBiographyDates: detects "active YYYY" single year', function (t) {
  const r = parse('active 1845, locomotive model maker');
  t.ok(r, 'returns a result');
  t.equal(r.kind, 'active-year', 'kind is active-year');
  t.end();
});

test('parseBriefBiographyDates: detects "b. YYYY"', function (t) {
  const r = parse('b. 1926, queen of the United Kingdom');
  t.ok(r, 'returns a result');
  t.equal(r.kind, 'born', 'kind is born');
  t.end();
});

test('parseBriefBiographyDates: detects "fl. YYYY"', function (t) {
  const r = parse('fl. 1840, photographer, England');
  t.ok(r, 'returns a result');
  t.equal(r.kind, 'flourished', 'kind is flourished');
  t.end();
});

test('parseBriefBiographyDates: detects century markers', function (t) {
  const r = parse('19th century, locomotive maker');
  t.ok(r, 'returns a result');
  t.equal(r.kind, 'century', 'kind is century');
  t.end();
});

test('parseBriefBiographyDates: returns null with no date text', function (t) {
  t.equal(parse('photographer, England'), null, 'no markers, no result');
  t.equal(parse(''), null, 'empty string is null');
  t.equal(parse(null), null, 'null input is null');
  t.equal(parse(undefined), null, 'undefined input is null');
  t.end();
});
