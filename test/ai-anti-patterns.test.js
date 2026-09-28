'use strict';

// Tests for the anti-patterns loader — the module that reads
// prompts/biographies/anti-patterns.md and appends its content to
// every writer + reviewer prompt.

const test = require('tape');
const antiPatterns = require('../lib/ai/anti-patterns');

test('appendToPrompt: appends anti-patterns block with a labelled header', function (t) {
  antiPatterns._resetForTests('- some rule\n- another rule');
  const out = antiPatterns.appendToPrompt('SYSTEM PROMPT BASE');
  t.ok(out.indexOf('SYSTEM PROMPT BASE') === 0, 'base prompt preserved at start');
  t.ok(out.indexOf('Class-wide rules') !== -1, 'section header inserted');
  t.ok(out.indexOf('- some rule') !== -1, 'rule text inserted');
  antiPatterns._resetForTests();
  t.end();
});

test('appendToPrompt: empty file → returns base unchanged', function (t) {
  antiPatterns._resetForTests('__empty__');
  const out = antiPatterns.appendToPrompt('BASE');
  t.equal(out, 'BASE', 'empty anti-patterns → no append');
  antiPatterns._resetForTests();
  t.end();
});

test('getAntiPatternsText: returns raw text without header', function (t) {
  antiPatterns._resetForTests('some rules text');
  const out = antiPatterns.getAntiPatternsText();
  t.equal(out, 'some rules text');
  t.ok(out.indexOf('Class-wide rules') === -1, 'no header on raw getter');
  antiPatterns._resetForTests();
  t.end();
});

test('cache: multiple calls reuse the loaded content', function (t) {
  antiPatterns._resetForTests('cached-rule');
  antiPatterns.getAntiPatternsText();
  antiPatterns.appendToPrompt('X');
  const out = antiPatterns.getAntiPatternsText();
  t.equal(out, 'cached-rule', 'cached content stable across calls');
  antiPatterns._resetForTests();
  t.end();
});

test('real file: anti-patterns.md loads with expected content', function (t) {
  antiPatterns._resetForTests(); // no override → real file load
  const out = antiPatterns.getAntiPatternsText();
  t.ok(out.length > 100, 'anti-patterns.md loaded with substantive content');
  t.ok(out.indexOf('Historical vs modern') !== -1, 'historical-names rule present');
  t.ok(out.indexOf('bridging phrase') !== -1, 'bridging-phrase guidance present');
  t.ok(out.indexOf('Multi-author expeditions') !== -1, 'expedition rule present');
  antiPatterns._resetForTests();
  t.end();
});
