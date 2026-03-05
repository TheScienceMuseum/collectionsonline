'use strict';

/**
 * Handlebars helper: pluralizeLabel
 *
 * Converts a label containing "(s)" to its singular or plural form based on count.
 *
 * pluralizeLabel('Employer(s)', 1) → 'Employer'
 * pluralizeLabel('Employer(s)', 3) → 'Employers'
 * pluralizeLabel('Award Received', 5) → 'Award Received'  (unchanged, no (s) pattern)
 */
module.exports = function pluralizeLabel (label, count) {
  if (typeof label !== 'string') return label;
  return label.replace(/\(s\)/g, count === 1 ? '' : 's');
};
