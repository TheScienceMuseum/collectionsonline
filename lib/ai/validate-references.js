'use strict';

function validateReferences (html, inputItems) {
  if (!html || !inputItems || inputItems.length === 0) {
    return html;
  }

  const validIds = {};
  inputItems.forEach(function (item) {
    validIds[item.id] = true;
  });

  return html.replace(/<a\s+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, function (match, href, text) {
    const hasValidId = Object.keys(validIds).some(function (id) {
      return href.indexOf(id) !== -1;
    });
    return hasValidId ? match : text;
  });
}

module.exports = validateReferences;
