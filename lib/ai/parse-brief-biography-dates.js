'use strict';

// Parse date text out of a "brief biography" field.
//
// Mimsy/AdLib agent records typically have a `description` entry of type
// "brief biography" containing a structured-text summary, e.g.
//   "active 1817-1839, optical & mathematical instrument maker, London, England"
//   "1856-1905, manufacturer of sewing machines, Bridgeport, Connecticut, USA"
//   "active 1990s, recycled paper product manufacturer, Britain"
//   "b. 1926, queen of the United Kingdom"
//
// For ~22% of agent records there is no structured birth/death date but the
// brief biography contains a parseable date marker. This helper detects
// such markers so assess-sufficiency can credit the record with a date
// signal — without backfilling birthDate/deathDate (which would conflate
// "active" with "born" and corrupt downstream prompts).
//
// Returns null if no marker found, otherwise an object with:
//   - kind: 'active-range' | 'bare-range' | 'born' | 'died' | 'flourished' |
//           'active-decade' | 'active-year' | 'century'
//   - matchedText: the matched substring (for diagnostics / future UI)

const PATTERNS = [
  // "active 1817-1839", "active c. 1817-c. 1839", "active 1817 - 1839"
  { kind: 'active-range', regex: /active\s+(?:c\.?\s*)?\d{3,4}\s*[-–—]\s*(?:c\.?\s*)?\d{2,4}/i },
  // "active 1990s", "active 1940s-1970s"
  { kind: 'active-decade', regex: /active\s+(?:c\.?\s*)?\d{3,4}s(?:\s*[-–—]\s*\d{3,4}s)?/i },
  // "active 1845" (single year)
  { kind: 'active-year', regex: /active\s+(?:c\.?\s*)?\d{3,4}\b(?!\s*s\b)/i },
  // bare "1856-1905" range (often used for companies)
  { kind: 'bare-range', regex: /\b(?:1[5-9]\d{2}|20\d{2})\s*[-–—]\s*(?:1[5-9]\d{2}|20\d{2}|\d{2})\b/ },
  // "b. 1926", "born 1926", "b 1926"
  { kind: 'born', regex: /\bb(?:orn)?\.?\s+(?:c\.?\s*)?\d{3,4}/i },
  // "d. 1903", "died 1903"
  { kind: 'died', regex: /\bd(?:ied)?\.?\s+(?:c\.?\s*)?\d{3,4}/i },
  // "fl. 1840", "flourished 1840"
  { kind: 'flourished', regex: /\b(?:fl\.?|flourished)\s+(?:c\.?\s*)?\d{3,4}/i },
  // "18th century", "19th-20th centuries"
  { kind: 'century', regex: /\b\d{1,2}(?:st|nd|rd|th)(?:\s*[-–—]\s*\d{1,2}(?:st|nd|rd|th))?\s*centur/i }
];

function parseBriefBiographyDates (text) {
  if (!text || typeof text !== 'string') return null;
  for (const p of PATTERNS) {
    const m = text.match(p.regex);
    if (m) {
      return { kind: p.kind, matchedText: m[0] };
    }
  }
  return null;
}

module.exports = parseBriefBiographyDates;
