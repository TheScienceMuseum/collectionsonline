// Handlebars helper: render an ISO 8601 timestamp (or Date-parseable string)
// in UK-English format. Used throughout the admin UI and anywhere a raw
// `generatedAt` / `createdAt` / similar would otherwise be shown.
//
// Usage:
//   {{formatDate someIso}}                 → "21 April 2026, 15:32"
//   {{formatDate someIso "short"}}         → "21/04/2026, 15:32"
//   {{formatDate someIso "date"}}          → "21 April 2026"
//   {{formatDate someIso "date-short"}}    → "21/04/2026"
//   {{formatDate someIso "relative"}}      → "3 hours ago"
//   {{formatDate someIso "auto"}}          → "3 hours ago" if < 24h, otherwise
//                                            "21 April 2026". Use when the
//                                            freshness-at-a-glance reading
//                                            matters for recent items but
//                                            old ones just need a date.
//
// Unknown / unparseable inputs return the dash character.

module.exports = function formatDate (value, format) {
  if (!value) return '—';

  // Year-only strings ("1879") would otherwise parse as Jan 1st, which
  // fabricates precision we don't have. Return as-is.
  if (typeof value === 'string' && /^\d{4}$/.test(value.trim())) {
    return value.trim();
  }

  // Approximate / uncertain dates — curators mark these with "c.", "circa",
  // "~", or "?". Some JS engines parse "c. 1879" as 1879-01-01 which
  // misleadingly shows precision. Preserve the raw annotation.
  if (typeof value === 'string' && /\b(c\.|circa|~|\?)/i.test(value)) {
    return value;
  }

  // Wikidata time values look like "+1955-04-18T00:00:00Z". Two quirks:
  //   1. Explicit-positive year prefix some Date parsers reject — strip it.
  //   2. `00` for month/day = precision marker (year-only or year+month),
  //      not a valid date. `new Date('1927-00-00T00:00:00Z')` → Invalid.
  //      Short-circuit these to the appropriate coarse-precision string
  //      before the parser sees them. Fixes the "+1927-00-00T00:00:00Z"
  //      leak seen on subject-status dissolution dates (cp60883 Vickers).
  if (typeof value === 'string' && /^[+-]?\d{4}-00-00T/.test(value)) {
    const m = value.match(/^[+-]?(\d{4})/);
    return m ? m[1] : value;
  }
  if (typeof value === 'string' && /^[+-]?\d{4}-\d{2}-00T/.test(value)) {
    const m = value.match(/^[+-]?(\d{4})-(\d{2})/);
    if (m) {
      const monthDate = new Date(Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, 1));
      return monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    }
  }
  const normalised = (typeof value === 'string' && value.length > 0 && value.charAt(0) === '+')
    ? value.slice(1)
    : value;

  const d = value instanceof Date ? value : new Date(normalised);

  // Unparseable but non-empty string → return the raw value rather than a
  // dash. Handles approximate dates ("c. 1879"), historical dates outside
  // JS Date's safe range, etc. Dash is reserved for genuinely missing data.
  if (isNaN(d.getTime())) {
    return typeof value === 'string' ? value : '—';
  }

  // When called without a format arg, Handlebars passes the options hash.
  const fmt = (typeof format === 'string') ? format : 'long';

  if (fmt === 'relative') return relative(d);
  if (fmt === 'auto') {
    // Sub-24h: relative reads better ("3 hours ago" tells you freshness at
    // a glance). ≥24h: the relative form ("5 days ago", "2 months ago")
    // loses precision without gaining readability, so we switch to the
    // calendar date. 24h is a natural cutoff: within a day the content
    // was generated "recently"; older than that you want a concrete when.
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 24 * 60 * 60 * 1000) return relative(d);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  if (fmt === 'short') {
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  if (fmt === 'date') {
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
  if (fmt === 'date-short') {
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
  // default "long": "21 April 2026 at 16:32"
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

function relative (d) {
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 30) return 'just now';
  if (diff < 60) return plural(diff, 'second');
  if (diff < 3600) return plural(Math.floor(diff / 60), 'minute');
  if (diff < 86400) return plural(Math.floor(diff / 3600), 'hour');
  if (diff < 2592000) return plural(Math.floor(diff / 86400), 'day');
  if (diff < 31536000) return plural(Math.floor(diff / 2592000), 'month');
  return plural(Math.floor(diff / 31536000), 'year');
}

function plural (n, unit) {
  return n + ' ' + unit + (n === 1 ? '' : 's') + ' ago';
}
