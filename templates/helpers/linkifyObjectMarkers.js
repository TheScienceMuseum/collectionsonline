'use strict';

// Handlebars helper: escape a string, then convert writer-emitted
// `{coXXXX|Title}` markers into safe anchors. Same substitution the
// public/admin prose renderer uses (lib/ai/render-biography's
// linkifyObjectMarkers), lifted here as a helper so template sites
// that display raw claim text (finding cards, resolved / stale
// finding history, etc.) all render the same clickable links rather
// than exposing the raw marker syntax to curators.
//
// Safety: escape first (defence-in-depth against any HTML in the
// text field), then substitute markers whose ID matches /co\d+/ and
// whose title is bounded to a non-`}` run. Anything that doesn't
// match the pattern is left as literal text.

const Handlebars = require('handlebars');
const render = require('../../lib/ai/render-biography');

module.exports = function (str) {
  if (str == null) return '';
  const escaped = Handlebars.escapeExpression(String(str));
  return new Handlebars.SafeString(render.linkifyObjectMarkers(escaped));
};
