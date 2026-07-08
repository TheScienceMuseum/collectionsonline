'use strict';

// Regenerate-existing candidate source — pulls every BIOGRAPHY item PK
// from DynamoDB and returns them for a full-collection regeneration.
//
// Typical use: propagating a class-wide prompt change (anti-patterns
// update, tone tweak, model bump) across the entire library. Records
// keep their curator decisions + review history — those items live at
// different SK prefixes and are untouched by the regen. Only the
// canonical BIOGRAPHY item is overwritten.
//
// Usage:
//   node scripts/bulk-generate.js --source regen-existing --force
//
// `--force` is REQUIRED. Without it the runner's per-subject idempotence
// check skips every returned id (since they all already have a
// BIOGRAPHY item), so the run would generate nothing. The source
// asserts up-front to save the user 10 minutes of watching a paginated
// listBiographies drain to zero output.
//
// Pagination: iterates the CreatedAtIndex GSI in 1000-item pages until
// the cursor is exhausted. At 5k records that's ~5 round trips; small
// enough not to bother with concurrency.

const biographyStore = require('../../lib/ai/biography-store');

const PAGE_SIZE = 1000;

module.exports = async function list (elastic, config, opts) {
  if (!opts.force) {
    throw new Error(
      'regen-existing source requires --force. Without it every subject would ' +
      'be filtered by the runner\'s idempotence check and no work would be done.'
    );
  }

  console.log('regen-existing: paginating listBiographies("all") ...');
  const ids = [];
  let lastKey = null;
  let page = 0;
  do {
    page += 1;
    const result = await biographyStore.listBiographies('all', PAGE_SIZE, lastKey);
    (result.items || []).forEach(function (item) {
      if (item && item.PK) ids.push(item.PK);
    });
    lastKey = result.lastKey || null;
    console.log('regen-existing: page', page, '· accumulated', ids.length, 'ids');
  } while (lastKey);

  return ids;
};
