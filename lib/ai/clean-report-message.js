'use strict';

// Cleans the optional short note a visitor can attach to a public
// "Report a problem" submission (config.aiBiographyPublicFlagMessageEnabled).
//
// The note is untrusted input that staff read in the admin UI, so it's
// reduced to a single line of plain text before it's stored:
//
//   1. Length is checked on the raw input. The form's maxlength is only UX.
//   2. NFKC normalisation folds look-alikes (fullwidth brackets, ligatures)
//      so the later steps see the characters a browser would.
//   3. Line breaks, tabs and other control characters become spaces;
//      format (zero-width, bidi override), private-use and surrogate
//      characters are removed; markup tags are dropped whole.
//   4. Links are reduced to their hostname, e.g. `[link: en.wikipedia.org]`,
//      so query strings (which often carry emails, tokens, tracking ids)
//      are never stored and staff never get a clickable link. Non-web
//      schemes (javascript:, data:, ...) are removed outright.
//   5. Email addresses and phone numbers are redacted.
//   6. What's left is filtered against a character allowlist: letters,
//      digits and everyday punctuation. Anything that could form markup,
//      template syntax, markdown or a CSV formula (< > { } [ ] ` \ * _ = @ |
//      ^ ~ +) is dropped.
//
// Output escaping in the admin template ({{ }}, never {{{ }}}) is still the
// primary XSS defence. This is defence in depth plus privacy hygiene. The
// cleaned note is shown to staff only and is never sent to the AI writer.
//
// Character escapes are built with String.fromCharCode / \p{...} classes
// rather than literal escape sequences so no invisible characters end up in
// this file.

const MAX_CHARS = 200;
// Notes with more links than this are treated as link spam: the report
// still counts, but the note is discarded.
const MAX_LINKS = 2;
// Hard cap on the stored string. Placeholders can be longer than what
// they replace (a@b.co → [email removed]), so the cleaned note may run a
// little past MAX_CHARS; this bounds it regardless.
const MAX_STORED_CHARS = 300;

// Placeholder sentinels: private-use code points. Step 3 strips private-use
// characters from the input, so these can only come from this module.
const SENTINEL_OPEN = String.fromCharCode(0xE000);
const SENTINEL_CLOSE = String.fromCharCode(0xE001);
const PLACEHOLDER_REF = new RegExp(SENTINEL_OPEN + '(\\d+)' + SENTINEL_CLOSE, 'g');

// Anything with a scheme: https://..., hxxp://..., ftp://...
const SCHEME_URL = /\b[a-z][a-z0-9+.-]{1,15}:\/\/[^\s<>"']+/gi;
// Script-capable schemes that don't use `//`.
const SCRIPT_SCHEME = /\b(?:javascript|vbscript|livescript)\s*:[^\s]*/gi;
const DATA_URI = /\bdata:[a-z]+\/[a-z0-9.+-]+[;,][^\s]*/gi;
// Local part excludes URL punctuation so an email inside a query string
// (example.com/?u=me@x.com) is redacted on its own and the URL around it
// is still recognised as a link.
const EMAIL = /[^\s@<>()[\]{}"',;:/?=&]+@[^\s@<>()[\]{}"',;:/?=&]+\.[a-z]{2,}/gi;
// Bare domains: www.anything, a dotted name followed by a path, or a dotted
// name ending in a common TLD. The TLD must be lower case and the list
// leaves out English words (in, it, me, no, be, at, co...) so a missing
// space after a full stop ("the date.It says") isn't read as a link.
const COMMON_TLDS = 'com|org|net|edu|gov|mil|int|info|biz|io|ly|uk|eu|de|fr|nl|ie|ch|se|dk|fi|pl|pt|ru|cn|jp|au|nz|ca|br|za|wiki|museum|ac';
const LABEL = '[A-Za-z0-9-]+';
const BARE_DOMAIN = new RegExp(
  '\\b(?:[Ww]{3}\\.' + LABEL + '(?:\\.' + LABEL + ')+|' +
  LABEL + '(?:\\.' + LABEL + ')*\\.[A-Za-z][A-Za-z0-9-]*(?=/)|' +
  LABEL + '(?:\\.' + LABEL + ')*\\.(?:' + COMMON_TLDS + '))\\b(?:/[^\\s]*)?',
  'g'
);
// Ten or more digits with phone-style separators (no dots, so dotted dates
// like 12.03.1901 aren't caught). isPhoneLike() makes the final call.
const LONG_NUMBER = /\+?\(?\d[\d\s()-]{8,}\d/g;
// Tag-shaped markup: <b>, </p>, <!-- ... -->, <script ...>. A lone "<"
// followed by a space ("born < 1900") isn't a tag and is left for the
// allowlist.
const TAG = /<\/?[a-z!][^<>]*>/gi;

// Allowed characters: letters, combining marks, digits, dashes, quotes,
// currency signs, whitespace and everyday punctuation, plus the
// placeholder sentinels.
const DISALLOWED = new RegExp(
  '[^\\p{L}\\p{M}\\p{N}\\p{Pd}\\p{Pi}\\p{Pf}\\p{Sc}\\s.,;:!?\'"()/&%#' +
  SENTINEL_OPEN + SENTINEL_CLOSE + ']',
  'gu'
);
// Runs of the same punctuation mark ("!!!!!!", "------") cap at three.
const REPEATED_PUNCTUATION = new RegExp(
  '([^\\p{L}\\p{N}\\s' + SENTINEL_OPEN + SENTINEL_CLOSE + '])\\1{2,}',
  'gu'
);

function cleanReportMessage (input) {
  if (typeof input !== 'string') return { ok: true, message: null };

  // 1. Raw length. Counted in code points so an emoji or accented
  // character is one character, matching what a visitor sees.
  const raw = input.trim();
  if (!raw) return { ok: true, message: null };
  if (Array.from(raw).length > MAX_CHARS) return { ok: false, error: 'too_long' };

  // 2-3. Normalise and strip invisible characters and markup.
  // Format characters go first: BOM (U+FEFF) is both Cf and matched by \s,
  // and should vanish rather than become a space.
  let text = raw.normalize('NFKC')
    .replace(/[\p{Cf}\p{Co}\p{Cs}]/gu, '')
    .replace(/[\s\p{Cc}]/gu, ' ')
    // Cap stacked combining marks ("zalgo" text) at two per character.
    .replace(/(\p{M}{2})\p{M}+/gu, '$1')
    // Drop markup tags whole, so "<b>wrong</b>" reads "wrong" rather than
    // "bwrong/b" once the allowlist removes the angle brackets.
    .replace(TAG, ' ');

  // 4-5. Links, emails and phone numbers → placeholders.
  const placeholders = [];
  let linkCount = 0;
  const hold = function (placeholder) {
    placeholders.push(placeholder);
    return SENTINEL_OPEN + (placeholders.length - 1) + SENTINEL_CLOSE;
  };
  const link = function (match) {
    linkCount += 1;
    // Sentence punctuation straight after a link ("see x.com/a.", "(see
    // https://x.com)") isn't part of it: keep it in the text.
    const trailing = match.match(/[).,;:!?'"]*$/)[0];
    const host = webHostname(match.slice(0, match.length - trailing.length));
    return hold(host ? '[link: ' + host + ']' : '[link removed]') + trailing;
  };
  const removeLink = function () {
    linkCount += 1;
    return hold('[link removed]');
  };
  text = text
    .replace(SCHEME_URL, link)
    .replace(SCRIPT_SCHEME, removeLink)
    .replace(DATA_URI, removeLink)
    .replace(EMAIL, function () { return hold('[email removed]'); })
    .replace(BARE_DOMAIN, link)
    .replace(LONG_NUMBER, function (match) {
      return isPhoneLike(match) ? hold('[number removed]') : match;
    });

  if (linkCount > MAX_LINKS) {
    return { ok: true, message: null, discarded: 'too_many_links' };
  }

  // 6. Allowlist, then tidy repeated punctuation and whitespace.
  text = text
    .replace(DISALLOWED, '')
    .replace(REPEATED_PUNCTUATION, '$1$1$1')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(PLACEHOLDER_REF, function (m, i) { return placeholders[Number(i)] || ''; });

  if (!text) return { ok: true, message: null };
  const chars = Array.from(text);
  if (chars.length > MAX_STORED_CHARS) text = chars.slice(0, MAX_STORED_CHARS).join('');
  return { ok: true, message: text };
}

// Hostname of an http(s) link, without a leading `www.`; null for any
// other scheme or anything that doesn't parse. Scheme-less matches are
// treated as https.
function webHostname (match) {
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(match) ? match : 'https://' + match;
  let url;
  try {
    url = new URL(candidate);
  } catch (err) {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/^www\./, '');
  // Hostname is ASCII after URL parsing (IDNs become punycode). Keep it
  // that way so the placeholder can't smuggle anything past the allowlist.
  return /^[a-z0-9.-]+$/.test(host) ? host : null;
}

// 10+ digits that start the way a phone number does (+, 0 or an opening
// bracket), or one unbroken run of 10+ digits. "07700 900123" and
// "+44 20 7942 4000" are redacted; years ("1856 1921 1930") and object
// numbers ("1990-5036 1990-5037") are not.
function isPhoneLike (match) {
  const groups = match.match(/\d+/g) || [];
  if (groups.join('').length < 10) return false;
  if (/^[+0(]/.test(match)) return true;
  return groups.some(function (g) { return g.length >= 10; });
}

module.exports = cleanReportMessage;
module.exports.MAX_CHARS = MAX_CHARS;
module.exports.MAX_LINKS = MAX_LINKS;
