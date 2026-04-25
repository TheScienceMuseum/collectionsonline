'use strict';

// Turn a named source citation from an AI review (string) into
// { text, url } where we can safely infer a URL.
//
// Two deep-linkable citation shapes supported:
//
//   1. Wikipedia articles — "Wikipedia's article on X" → /wiki/X
//      Topic-based; the URL is built from the article title. A
//      hallucinated article name either 404s or lands on a
//      disambiguation page — low-harm failure mode.
//
//   2. DOI references     — "... (doi:10.1017/S0007087400001539)" → doi.org
//      Format-validated. DOIs resolve through the official registry
//      regardless of publisher so the link is stable. A hallucinated
//      DOI typically doesn't resolve to any real paper (the registry
//      namespace is sparse and tied to publisher submissions).
//
// Deliberately NOT supported: ISBN. Checksum validation is not
// sufficient — Opus sometimes hallucinates ISBNs that pass the
// check digit but correspond to a DIFFERENT real book in its
// training data. A wrong-book link looks authoritative and wastes
// staff time worse than plain-text "here's the book title, search
// for it yourself". Prompt tells the reviewer not to include ISBNs.
//
// Anything else (press coverage, archives, book titles, unstructured
// sources) stays as plain text — we won't fabricate a link the staff
// member can't trust.

const WIKIPEDIA_PATTERN = /^Wikipedia(?:'s)?\s+(?:article|entry|page)\s+(?:on|for|about)\s+(.+)$/i;

// DOI matcher. Matches the registrant (`10.<digits>`) + `/` + suffix,
// optionally preceded by the `doi:` prefix Opus likes to use.
// Trailing punctuation (full stops, closing brackets) is stripped
// after extraction so we don't carry it into the URL.
const DOI_PATTERN = /\b(?:doi:\s*)?(10\.\d{4,9}\/[^\s"<>)\]]+)/i;

function linkify (text) {
  if (typeof text !== 'string') return { text: '', url: null };
  const trimmed = text.trim().replace(/[.,;]+$/, '');

  // 1. Wikipedia (longest-standing path).
  const wiki = trimmed.match(WIKIPEDIA_PATTERN);
  if (wiki) {
    const topic = wiki[1].trim().replace(/^['"‘’“”]+|['"‘’“”]+$/g, '').replace(/[.,;]+$/, '');
    if (topic) {
      const slug = encodeURIComponent(topic.replace(/\s+/g, '_'));
      return { text: trimmed, url: 'https://en.wikipedia.org/wiki/' + slug };
    }
  }

  // 2. DOI. DOIs are tied to a specific paper in a publisher-agnostic
  //    registry, so a hallucinated DOI either doesn't resolve or lands
  //    you on a specific-but-wrong paper (less likely than the ISBN
  //    failure mode because DOI namespace is sparse and tied to
  //    publisher submissions rather than commercial book ISBN pools).
  const doiMatch = trimmed.match(DOI_PATTERN);
  if (doiMatch) {
    const doi = doiMatch[1].replace(/[.,;:]+$/, '');
    return { text: trimmed, url: 'https://doi.org/' + encodeURI(doi) };
  }

  // Book citations stay as plain text. ISBN linking was tried and
  // removed: Opus sometimes hallucinates valid-checksum ISBNs that
  // resolve to the WRONG book on Google Books — looks authoritative,
  // wastes staff time, loses trust. A plain-text book title with author
  // is more useful than a wrong-but-confident link.

  return { text: trimmed, url: null };
}

module.exports = { linkify };
