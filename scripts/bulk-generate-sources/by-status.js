'use strict';

// By-status candidate source — pulls every BIOGRAPHY item that matches a
// specific status (live / flagged / hidden / insufficient_data) and
// returns their PKs.
//
// Typical uses:
//   - Regenerate every flagged record after a prompt improvement.
//   - Retry every insufficient_data record after the sufficiency
//     threshold or wikidata fetch logic changes.
//   - Regenerate every live record to backfill a new sentence-array field.
//
// Usage:
//   node scripts/bulk-generate.js --source by-status --status flagged --force
//
// --status is REQUIRED. --force is REQUIRED for the same reason as
// regen-existing: every returned id already has a BIOGRAPHY item, so
// without --force the runner would skip all of them.

const biographyStore = require('../../lib/ai/biography-store');

const VALID_STATUSES = ['live', 'flagged', 'hidden', 'insufficient_data', 'admin_only'];
const PAGE_SIZE = 1000;

module.exports = async function list (elastic, config, opts) {
  if (!opts.status) {
    throw new Error('by-status source requires --status <live|flagged|hidden|insufficient_data|admin_only>');
  }
  if (VALID_STATUSES.indexOf(opts.status) === -1) {
    throw new Error('by-status: invalid status "' + opts.status +
      '". Expected one of: ' + VALID_STATUSES.join(', '));
  }
  if (!opts.force) {
    throw new Error(
      'by-status source requires --force. Without it every subject would ' +
      'be filtered by the runner\'s idempotence check and no work would be done.'
    );
  }

  console.log('by-status: paginating listBiographies("' + opts.status + '") ...');
  const ids = [];
  let lastKey = null;
  let page = 0;
  do {
    page += 1;
    const result = await biographyStore.listBiographies(opts.status, PAGE_SIZE, lastKey);
    (result.items || []).forEach(function (item) {
      if (item && item.PK) ids.push(item.PK);
    });
    lastKey = result.lastKey || null;
    console.log('by-status: page', page, '· accumulated', ids.length, 'ids');
  } while (lastKey);

  return ids;
};
