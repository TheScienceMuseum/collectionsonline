'use strict';

/*
 * DynamoDB tidy for the AI biographies table.
 *
 * Deletes:
 *   1. every item whose PK is NOT in the keep-list, AND
 *   2. every HISTORY#* item (legacy from the retired snapshots feature)
 *      regardless of PK — so kept subjects lose their history rows too.
 *
 * Default is DRY-RUN: prints what would be deleted, does not write. Pass
 * --execute to actually perform the deletes.
 *
 * Usage:
 *   node scripts/ai-biography/purge-dynamo.js                # dry-run
 *   node scripts/ai-biography/purge-dynamo.js --execute      # do it
 *   node scripts/ai-biography/purge-dynamo.js --keep=cp1,cp2 # override keeps
 *
 * The keep-list defaults to the 6 verification subjects: cp37054 (Einstein),
 * cp42536 (Unilever), cp125074 (Lipton), cp102300 (Smith), cp69752
 * (Machaon), cp97864 (Hygeia).
 */

const config = require('../../config');
const dynamo = require('../../lib/ai/dynamo');

const DEFAULT_KEEP = ['cp37054', 'cp42536', 'cp125074', 'cp102300', 'cp69752', 'cp97864'];

function parseArgs () {
  const args = process.argv.slice(2);
  const execute = args.indexOf('--execute') !== -1;
  const keepFlag = args.find(function (a) { return a.indexOf('--keep=') === 0; });
  const keep = keepFlag ? keepFlag.slice('--keep='.length).split(',').filter(Boolean) : DEFAULT_KEEP;
  return { execute, keep };
}

function shouldDelete (item, keepSet) {
  const pk = item.PK;
  const sk = item.SK || '';
  if (!keepSet.has(pk)) return { yes: true, reason: 'PK not in keep-list' };
  if (sk.indexOf('HISTORY#') === 0) return { yes: true, reason: 'legacy HISTORY item' };
  return { yes: false, reason: 'kept' };
}

async function main () {
  const opts = parseArgs();
  const keepSet = new Set(opts.keep);

  dynamo.init(config);
  if (!dynamo.isReady()) {
    console.error('DynamoDB client not ready — check config.dynamodb');
    process.exit(1);
  }

  console.log('Endpoint:', config.dynamodb.endpoint || '(default AWS)');
  console.log('Table:   ', config.dynamodb.tableName);
  console.log('Keep PKs:', opts.keep.join(', '));
  console.log('Mode:    ', opts.execute ? 'EXECUTE (will delete)' : 'DRY RUN (no writes)');
  console.log();

  const planned = [];
  const kept = [];
  let lastKey = null;

  do {
    const page = await dynamo.scan(500, lastKey);
    page.items.forEach(function (item) {
      const verdict = shouldDelete(item, keepSet);
      if (verdict.yes) planned.push({ pk: item.PK, sk: item.SK, reason: verdict.reason });
      else kept.push({ pk: item.PK, sk: item.SK });
    });
    lastKey = page.lastKey;
  } while (lastKey);

  const byReason = {};
  planned.forEach(function (p) { byReason[p.reason] = (byReason[p.reason] || 0) + 1; });

  console.log('Planned deletes:', planned.length);
  Object.keys(byReason).forEach(function (r) {
    console.log('  ' + r.padEnd(28) + byReason[r]);
  });
  console.log('Items kept:     ', kept.length);
  console.log();

  console.log('Sample of planned deletes (first 30):');
  planned.slice(0, 30).forEach(function (p) {
    console.log('  DEL  ' + p.pk.padEnd(12) + ' ' + p.sk);
  });
  if (planned.length > 30) console.log('  … +' + (planned.length - 30) + ' more');
  console.log();

  console.log('Items kept (first 20):');
  kept.slice(0, 20).forEach(function (k) {
    console.log('  KEEP ' + k.pk.padEnd(12) + ' ' + k.sk);
  });
  if (kept.length > 20) console.log('  … +' + (kept.length - 20) + ' more');
  console.log();

  if (!opts.execute) {
    console.log('DRY RUN complete. No changes made. Re-run with --execute to apply.');
    return;
  }

  console.log('Executing deletes …');
  let done = 0;
  let failed = 0;
  for (let i = 0; i < planned.length; i += 1) {
    const p = planned[i];
    try {
      await dynamo.delete(p.pk, p.sk);
      done += 1;
      if (done % 10 === 0) console.log('  ' + done + '/' + planned.length);
    } catch (err) {
      failed += 1;
      console.error('  FAIL ' + p.pk + ' ' + p.sk + ': ' + err.message);
    }
  }
  console.log();
  console.log('Done. Deleted:', done, '  Failed:', failed);
}

main().catch(function (err) {
  console.error('Purge failed:', err);
  process.exit(1);
});
