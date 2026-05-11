const Handlebars = require('handlebars');

// Escapes a value for safe interpolation inside a JSON string literal.
// JSON.stringify handles ", \, and control chars (0x00-0x1F) per RFC 8259;
// slicing off the surrounding quotes leaves the bare escaped contents.
// Returns a SafeString so Handlebars does not HTML-escape the result.
module.exports = function jsonEscape (value) {
  if (value === null || value === undefined) {
    return new Handlebars.SafeString('');
  }
  const stringified = JSON.stringify(String(value));
  return new Handlebars.SafeString(stringified.slice(1, -1));
};
