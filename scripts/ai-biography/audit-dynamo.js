'use strict';

/*
 * Read-only DynamoDB audit for the AI biographies table. Scans every item,
 * groups by PK (subject id), reports counts per PK + total, and lists which
 * PKs would be removed vs kept if we ran a clean-out that preserved only a
 * given keep-list.
 *
 * Usage:
 *   node scripts/ai-biography/audit-dynamo.js
 *   node scripts/ai-biography/audit-dynamo.js --keep=cp37054,cp42536,cp125074,cp102300,cp69752
 *
 * Reads DynamoDB config from .corc via the app's config module — same
 * endpoint the app uses. No writes.
 */

const config = require('../../config');
const dynamo = require('../../lib/ai/dynamo');

const DEFAULT_KEEP = ['cp37054', 'cp42536', 'cp125074', 'cp102300', 'cp69752'];

function parseArgs () {
  const args = process.argv.slice(2);
  const keepFlag = args.find(function (a) { return a.indexOf('--keep=') === 0; });
  const keep = keepFlag ? keepFlag.slice('--keep='.length).split(',').filter(Boolean) : DEFAULT_KEEP;
  return { keep };
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
  console.log('Keep-list:', opts.keep.join(', '));
  console.log();

  const byPk = new Map();
  const skPrefixes = new Map();
  let lastKey = null;
  let total = 0;

  do {
    const page = await dynamo.scan(500, lastKey);
    page.items.forEach(function (item) {
      total += 1;
      const pk = item.PK || '(no-PK)';
      const sk = item.SK || '(no-SK)';
      const skPrefix = sk.split('#')[0];
      if (!byPk.has(pk)) byPk.set(pk, { count: 0, sks: [] });
      byPk.get(pk).count += 1;
      byPk.get(pk).sks.push(sk);
      skPrefixes.set(skPrefix, (skPrefixes.get(skPrefix) || 0) + 1);
    });
    lastKey = page.lastKey;
  } while (lastKey);

  console.log('Total items:', total);
  console.log('Unique PKs: ', byPk.size);
  console.log();

  console.log('Items per SK-prefix:');
  Array.from(skPrefixes.entries())
    .sort(function (a, b) { return b[1] - a[1]; })
    .forEach(function (entry) {
      console.log('  ' + entry[0].padEnd(24) + entry[1]);
    });
  console.log();

  const pks = Array.from(byPk.keys()).sort();
  const kept = [];
  const toRemove = [];
  pks.forEach(function (pk) {
    if (keepSet.has(pk)) kept.push(pk);
    else toRemove.push(pk);
  });

  console.log('KEEP (' + kept.length + ' PKs, ' + kept.reduce(function (sum, pk) {
    return sum + byPk.get(pk).count;
  }, 0) + ' items):');
  kept.forEach(function (pk) {
    const info = byPk.get(pk);
    console.log('  ' + pk.padEnd(12) + info.count + ' items · SKs: ' + info.sks.slice(0, 4).join(', ') + (info.sks.length > 4 ? ' … (+' + (info.sks.length - 4) + ')' : ''));
  });
  console.log();

  console.log('REMOVE (' + toRemove.length + ' PKs, ' + toRemove.reduce(function (sum, pk) {
    return sum + byPk.get(pk).count;
  }, 0) + ' items):');
  toRemove.slice(0, 40).forEach(function (pk) {
    const info = byPk.get(pk);
    console.log('  ' + pk.padEnd(12) + info.count + ' items');
  });
  if (toRemove.length > 40) console.log('  … (+' + (toRemove.length - 40) + ' more PKs)');
  console.log();

  const missing = opts.keep.filter(function (pk) { return !byPk.has(pk); });
  if (missing.length) {
    console.log('WARNING: keep-list PKs NOT found in table: ' + missing.join(', '));
    console.log('These may need to be regenerated after clean-out.');
  }
}

main().catch(function (err) {
  console.error('Audit failed:', err);
  process.exit(1);
});
