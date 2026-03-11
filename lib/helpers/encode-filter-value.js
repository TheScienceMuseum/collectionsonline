/**
 * Canonical encoding function for filter values in URLs.
 *
 * Encoding scheme:
 *   space  → -         (human-readable, no SEO impact)
 *   hyphen → %252D     (Hapi decodes %25→%, leaving %2D; decodeURIComponent restores -)
 *   slash  → %252F     (Hapi decodes %25→%, leaving %2F; split logic restores /)
 *   comma  → %252C     (replaces the \, backslash-escape scheme)
 *   lowercase throughout
 *
 * The double-percent encoding (%25XX) is required because Hapi performs one level
 * of percent-decoding on path segments before the route handler sees them.
 * %252D → (Hapi) → %2D → (decodeURIComponent in parse-params) → -
 */
module.exports = function encodeFilterValue (value) {
  if (!value) return '';
  return String(value)
    .replace(/-/g, '%252D')
    .replace(/\//g, '%252F')
    .replace(/,/g, '%252C')
    .replace(/\s+/g, '-')
    .toLowerCase();
};
