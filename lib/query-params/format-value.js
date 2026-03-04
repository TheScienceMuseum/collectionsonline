const splitOnUnescapedCommas = require('../../client/lib/split-commas.js');

/**
 * Normalises a filter value into an array, handling the HTML and JSON request paths differently.
 *
 * WHY TWO PATHS EXIST
 * -------------------
 * Filter values containing literal commas (e.g. "Science Museum, London") must survive
 * the URL pipeline intact. To do this, literal commas inside a value are escaped as \,
 * when building filter URLs (see routes/route-helpers/parse-params.js). A bare , acts
 * as the separator between multiple values for the same filter key.
 *
 * HTML path (server render):
 *   Joi's .single() has already converted the value to an array before this function is
 *   called, so we just need to unescape any \, back to , in each array element.
 *
 * JSON path (SPA / API):
 *   The value arrives as a plain string (e.g. "Science Museum\, London,Bristol").
 *   We must split on unescaped commas first (giving ["Science Museum\, London", "Bristol"]),
 *   then unescape \, in each element (giving ["Science Museum, London", "Bristol"]).
 *   Splitting before unescaping is critical — reversing the order would destroy the
 *   escaped commas before the split can use them as guards.
 *
 * @param {'html'|'json'} typeFormat - Origin of the request
 * @param {string|string[]|number} value - Raw filter value from the URL
 * @returns {string[]|number|null}
 */
module.exports = function (typeFormat, value) {
  if (value) {
    if (typeFormat === 'html') {
      const v = typeof value === 'string' ? [value] : value;
      if (!Array.isArray(v)) return v;
      return v.map(function (item) {
        return typeof item === 'string' ? item.replace(/\\,/g, ',') : item;
      });
    }
    if (typeFormat === 'json' && !Array.isArray(value)) {
      if (typeof value === 'number') {
        return value;
      } else {
        return splitOnUnescapedCommas(value).map(function (v) {
          return v.replace(/\\,/g, ',');
        });
      }
    }
    if (Array.isArray(value)) {
      return value.map(function (item) {
        return typeof item === 'string' ? item.replace(/\\,/g, ',') : item;
      });
    }
    return value;
  } else {
    return null;
  }
};
