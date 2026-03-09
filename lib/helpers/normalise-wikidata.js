'use strict';

const Q_CODE_RE = /^Q\d+$/i;

/**
 * Extracts a valid Wikidata Q-code from a raw value.
 * Accepts: full URL, Q-code string, or garbage — returns null if invalid.
 */
function getQCode (raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (Q_CODE_RE.test(trimmed)) return trimmed.toUpperCase();
  const match = trimmed.match(/\/(Q\d+)\s*$/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Returns a valid Wikidata URL or null.
 */
function getUrl (raw) {
  const qCode = getQCode(raw);
  return qCode ? 'https://www.wikidata.org/wiki/' + qCode : null;
}

module.exports = { getQCode, getUrl };
