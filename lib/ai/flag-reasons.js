'use strict';

// The reasons a visitor can give when reporting a biography. FLAGS items
// store one counter pair per reason: count_<reason> (lifetime) and
// count_pending_<reason>.
//
// Its own module, without the AWS SDK, so code that only needs the list
// (dashboard-stats' scan projection) doesn't load flag-store. Several tests
// swap a fake flag-store into require.cache, and that fake has no list.

const VALID_REASONS = [
  'factually_incorrect',
  'offensive',
  'doesnt_match',
  'other'
];

module.exports = { VALID_REASONS };
