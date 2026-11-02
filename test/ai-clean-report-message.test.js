'use strict';

// Tests for lib/ai/clean-report-message.js — the cleaner for the optional
// note on a public "Report a problem" submission. Special characters are
// built with String.fromCodePoint so the test source stays plain ASCII.

const test = require('tape');
const clean = require('../lib/ai/clean-report-message');

const ch = String.fromCodePoint;
const message = function (input) { return clean(input).message; };

test('clean-report-message: plain text passes through unchanged', function (t) {
  t.equal(message('He died in 1921, not 1912.'), 'He died in 1921, not 1912.');
  const typographic = 'Science Mus' + ch(0xE9) + 'um ' + ch(0x2014) + ' ' + ch(0x201C) + 'quoted' +
    ch(0x201D) + ' it' + ch(0x2019) + 's 50% ' + ch(0xA3) + '10 & co. (ok)';
  t.equal(message(typographic), typographic, 'accents, dashes, curly quotes, currency kept');
  const mixedScripts = ch(0x645, 0x631, 0x62D, 0x628, 0x627) + ' world ' + ch(0x4F60, 0x597D);
  t.equal(message(mixedScripts), mixedScripts, 'non-Latin letters kept');
  t.end();
});

test('clean-report-message: empty, whitespace-only and non-string input store nothing', function (t) {
  t.deepEqual(clean(''), { ok: true, message: null });
  t.deepEqual(clean('   \n\t '), { ok: true, message: null });
  t.deepEqual(clean(undefined), { ok: true, message: null });
  t.deepEqual(clean(['array from a=1&a=2']), { ok: true, message: null }, 'repeated form field ignored');
  t.deepEqual(clean({ toString: function () { return 'x'; } }), { ok: true, message: null });
  t.deepEqual(clean(ch(0x1F600)), { ok: true, message: null }, 'nothing left after the allowlist');
  t.end();
});

test('clean-report-message: length limit is 200 characters, counted in code points', function (t) {
  t.ok(clean('x'.repeat(clean.MAX_CHARS)).ok, '200 accepted');
  t.deepEqual(clean('x'.repeat(clean.MAX_CHARS + 1)), { ok: false, error: 'too_long' }, '201 rejected');
  t.ok(clean(ch(0xE9).repeat(clean.MAX_CHARS)).ok, '200 accented characters accepted');
  t.ok(clean('  ' + 'x'.repeat(clean.MAX_CHARS) + '  ').ok, 'surrounding whitespace not counted');
  t.end();
});

test('clean-report-message: reduced to a single line', function (t) {
  t.equal(message('line1\nline2\r\n\tline3' + ch(0x85) + 'nel' + ch(0x2028) + 'ls'), 'line1 line2 line3 nel ls');
  t.equal(message('a     b'), 'a b');
  t.end();
});

test('clean-report-message: invisible and direction-changing characters removed', function (t) {
  const bidi = 'abc' + ch(0x202E) + 'evil' + ch(0x202C) + ' x' + ch(0x2066) + 'y' + ch(0x2069);
  t.equal(message(bidi), 'abcevil xy', 'bidi overrides and isolates');
  t.equal(message('de' + ch(0x200B) + 'f' + ch(0x200D) + 'g' + ch(0xFEFF) + ch(0xAD) + 'h'), 'defgh', 'zero-width, BOM, soft hyphen');
  t.equal(message('a' + ch(0x0) + 'b' + ch(0x1B) + '[31mc'), 'a b 31mc', 'NUL and terminal escapes');
  t.equal(message('a' + ch(0xE000) + '0' + ch(0xE001) + 'b'), 'a0b', 'private-use characters (placeholder sentinels) removed');
  t.end();
});

test('clean-report-message: markup, template and markdown syntax stripped', function (t) {
  t.equal(message('<script>alert(1)</script> wrong'), 'alert(1) wrong');
  t.equal(message('<img src=x onerror=alert(1)>wrong'), 'wrong');
  t.equal(message('<b>bold</b> <!-- c --> text'), 'bold text');
  t.equal(message(ch(0xFF1C) + 'script' + ch(0xFF1E) + 'x'), 'x', 'fullwidth brackets fold to < > and the tag is dropped');
  t.equal(message('born < 1900 and > 1850'), 'born 1900 and 1850', 'stray angle brackets dropped');
  t.equal(message('{{constructor}} $' + '{7*7} `rm -rf` **b** _i_ ~s~ | ^ \\ = @x'), 'constructor $77 rm -rf b i s x',
    'braces, backticks, markdown and pipes dropped ($ is a currency sign, so kept)');
  t.end();
});

test('clean-report-message: spreadsheet formulas neutralised', function (t) {
  t.equal(message('=1+2'), '12');
  t.equal(message('@SUM(A1)'), 'SUM(A1)');
  t.equal(message('+cmd|calc'), 'cmdcalc');
  t.end();
});

test('clean-report-message: links become their hostname only', function (t) {
  t.equal(message('See https://en.wikipedia.org/wiki/X?utm=1&email=a@b.com please'),
    'See [link: en.wikipedia.org] please', 'path, query and embedded email dropped');
  t.equal(message('http://user:pass@evil.test:8080/x'), '[link: evil.test]', 'credentials and port dropped');
  t.equal(message('www.Example.co.uk/page'), '[link: example.co.uk]', 'www. dropped, lower-cased');
  t.equal(message('bit.ly/abc'), '[link: bit.ly]', 'bare domain with path');
  t.equal(message('visit example.com, then'), 'visit [link: example.com], then', 'bare domain with common TLD');
  t.equal(message('(see https://x.com/a.)'), '(see [link: x.com].)', 'trailing punctuation kept outside the link');
  t.equal(message('[x](http://evil.test)'), 'x([link: evil.test])', 'markdown link');
  t.equal(message('https://' + ch(0x430) + 'pple.com/'), '[link: xn--pple-43d.com]', 'homoglyph domain shown as punycode');
  t.end();
});

test('clean-report-message: non-web schemes removed entirely', function (t) {
  t.equal(message('javascript:alert(1)'), '[link removed]');
  t.equal(message('JavaScript :alert(1)'), '[link removed]');
  t.equal(message('javascript://%0aalert(1)'), '[link removed])', 'trailing bracket left behind, link gone');
  t.equal(message('data:text/html;base64,PHNjcmlwdD4='), '[link removed]');
  t.equal(message('hxxp://evil.test/x'), '[link removed]');
  t.equal(message('ftp://files.test/x'), '[link removed]');
  t.end();
});

test('clean-report-message: ordinary words are not mistaken for links', function (t) {
  t.equal(message('The data: born 1856 not 1865'), 'The data: born 1856 not 1865');
  t.equal(message('the date.It says 1856.Mr.Smith was wrong.in fact'), 'the date.It says 1856.Mr.Smith was wrong.in fact');
  t.equal(message('e.g. this, i.e. that, Ph.D. and/or St. Ives'), 'e.g. this, i.e. that, Ph.D. and/or St. Ives');
  t.end();
});

test('clean-report-message: more than two links discards the note but not the report', function (t) {
  t.ok(clean('a.com b.com').message, 'two links kept');
  t.deepEqual(clean('a.com b.com c.com'), { ok: true, message: null, discarded: 'too_many_links' });
  t.deepEqual(clean('https://a.test/ javascript:x data:text/html,x'), { ok: true, message: null, discarded: 'too_many_links' });
  t.end();
});

test('clean-report-message: emails and phone numbers redacted', function (t) {
  t.equal(message('Email me at jane.doe+tag@example.org please'), 'Email me at [email removed] please');
  t.equal(message('a@b.co'), '[email removed]');
  t.equal(message('Call 07700 900123'), 'Call [number removed]');
  t.equal(message('or +44 20 7942 4000'), 'or [number removed]');
  t.equal(message('or (020) 7942-4000'), 'or [number removed]');
  t.equal(message('or 7700900123'), 'or [number removed]', 'unbroken run of 10 digits');
  t.end();
});

test('clean-report-message: years, dates and object numbers survive', function (t) {
  t.equal(message('Years 1856 1921 1930'), 'Years 1856 1921 1930');
  t.equal(message('objects 1990-5036 1990-5037'), 'objects 1990-5036 1990-5037');
  t.equal(message('12.03.1901 - 15.04.1950'), '12.03.1901 - 15.04.1950');
  t.equal(message('12/03/1901'), '12/03/1901');
  t.end();
});

test('clean-report-message: stacked marks and repeated punctuation tamed', function (t) {
  const zalgo = 'a' + ch(0x300, 0x301, 0x302, 0x303, 0x304, 0x305) + 'b';
  t.equal(Array.from(message(zalgo)).length, 4, 'at most two combining marks per letter');
  t.equal(message('Wrong!!!!!!! ------ ok....'), 'Wrong!!! --- ok...');
  t.end();
});

test('clean-report-message: output never contains characters outside the allowlist', function (t) {
  // Every printable ASCII character plus a spread of awkward code points.
  let input = '';
  for (let c = 0x20; c < 0x7F; c++) input += ch(c);
  input += ch(0x202E, 0x200B, 0xFEFF, 0xFF1C, 0xFF1E, 0x2028, 0x1F600, 0xE000);
  const out = message(input);
  t.ok(out, 'something survives');
  t.notOk(/[<>{}[\]`\\*_=@|^~+]/.test(out.replace(/\[(?:link: [a-z0-9.-]+|link removed|email removed|number removed)\]/g, '')),
    'no markup / template / formula characters outside placeholders: ' + out);
  t.end();
});
