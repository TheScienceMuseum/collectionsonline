/**
 * Normalises a filter value into an array.
 *
 * In the JSON API path, multiple values arrive as a bare comma-separated string
 * (e.g. 'mathematician,developer'). Bare commas are value separators; literal
 * commas in filter values are encoded as %2C (from the %252C double-encoding
 * scheme), so we split on bare ',' and then decode each element.
 *
 * In the HTML path, values have already been decoded by parse-params.js so
 * no splitting or unescaping is needed.
 *
 * @param {'html'|'json'} typeFormat - Origin of the request
 * @param {string|string[]|number} value - Raw filter value
 * @returns {string[]|number|null}
 */
module.exports = function (typeFormat, value) {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (Array.isArray(value)) return value;
  if (typeFormat === 'json') {
    // Split on commas only when they are value separators (no following space).
    // Literal commas in decoded filter values like 'Science Museum, London' or
    // 'People, Pride and Progress' are always followed by a space, so those
    // are kept as a single value. Multi-value query params use bare commas
    // without spaces (e.g. 'mathematician,developer').
    const parts = value.split(',');
    if (parts.length > 1 && parts.every(p => !p.startsWith(' '))) {
      return parts.map(v => v.replace(/%2[Cc]/g, ','));
    }
    return [value.replace(/%2[Cc]/g, ',')];
  }
  if (typeFormat === 'html') {
    return [value];
  }
  return value;
};
