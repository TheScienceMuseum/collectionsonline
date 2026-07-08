#!/usr/bin/env node
'use strict';

// Bulk-generate AI biographies against a live DynamoDB table.
//
// Named "generate" not "regenerate" — the primary pre-launch use case is
// seeding biographies for records that don't have one yet. Re-generation
// (regen-existing / by-status sources with --force) is a secondary mode
// covered by the same runner.
//
// Usage:
//   node scripts/bulk-generate.js [options]
//
// Options:
//   --source <name>       Candidate source (default: es-threshold).
//                         See scripts/bulk-generate-sources/ for the modules.
//   --limit <N>           Cap the number of subjects processed (useful for
//                         smoke tests before a full run).
//   --concurrency <N>     Number of parallel workers (default: 5).
//   --min-analytics <N>   For es-threshold: min analytics count (default: 500).
//   --csv <path>          For csv-file: path to a CSV / plaintext list of IDs.
//   --status <status>     For by-status: which status to pull (live / flagged
//                         / hidden / insufficient_data).
//   --no-cache            Disable prompt caching. Batch runs pass cache=true
//                         by default (writer + reviewer prefixes warm inside
//                         the 5-min TTL, ~90% input-token discount).
//   --force               Regenerate subjects that already have a BIOGRAPHY
//                         item. Default behaviour is to skip them. Required
//                         when using regen-existing / by-status sources.
//   --dry-run             Resolve candidates and print the plan; skip Claude
//                         calls and DynamoDB writes.
//   --log <path>          Override the JSONL progress log path.
//   --batch-id <id>       Override the batch identifier stamped onto every
//                         BIOGRAPHY item touched by this run. Defaults to a
//                         timestamp; useful for continuing a named batch.
//
// Config: reads `.corc` (via rc, same as the app) and additionally deep-
// merges `.corc.batch` when present. `.corc.batch` is gitignored (see
// .gitignore); the intended use is to hold prod-DynamoDB / prod-ES creds
// separately from your dev config. `.corc.batch` is shallow-JSON, same
// shape as `.corc`.
//
// Every processed subject produces one JSONL line in the progress log:
//   {ts, id, outcome, status?, writer?, reviewer?, error?}
// Re-running the script over the same candidate list is safe — subjects
// with an existing BIOGRAPHY item are skipped by default.
//
// See scripts/bulk-generate.md for full details, examples, and the source contract.

const fs = require('fs');
const path = require('path');

const { Client } = require('@elastic/elasticsearch');

// -------------------------------------------------------------------
// Config loading — .corc + .corc.batch merge
// -------------------------------------------------------------------

// rc reads .corc (JSON) + env vars prefixed `co_` into an object, same
// way bin/server.mjs does via require('../config'). We then deep-merge
// `.corc.batch` overrides on top, in-place, BEFORE requiring the config
// module — so subsequent `require('../config')` calls in libs pick up
// the merged shape (Node caches modules; the app's config.js re-invokes
// rc but writes to the same singleton reference we mutate here via
// deepMerge into the exported object).
function deepMerge (target, source) {
  Object.keys(source || {}).forEach(function (k) {
    const sv = source[k];
    const tv = target[k];
    if (sv && typeof sv === 'object' && !Array.isArray(sv) && tv && typeof tv === 'object' && !Array.isArray(tv)) {
      deepMerge(tv, sv);
    } else {
      target[k] = sv;
    }
  });
  return target;
}

function loadConfig () {
  // First: load the app's config module (rc-based, singleton). This has
  // the same shape config.js exports at runtime.
  const config = require('../config');

  // Second: overlay .corc.batch. The batch file is optional; when
  // present it must be a JSON file matching the .corc shape.
  const batchPath = path.join(__dirname, '..', '.corc.batch');
  if (fs.existsSync(batchPath)) {
    let overrides;
    try {
      overrides = JSON.parse(fs.readFileSync(batchPath, 'utf8'));
    } catch (err) {
      throw new Error('Failed to parse .corc.batch — ' + err.message);
    }
    deepMerge(config, overrides);
    console.log('bulk-generate: merged .corc.batch overrides.');
  } else {
    console.log('bulk-generate: no .corc.batch found — using .corc + env only.');
  }
  return config;
}

// -------------------------------------------------------------------
// CLI parsing — minimal, matches the restore-from-backup style
// -------------------------------------------------------------------

function parseArgs (argv) {
  const opts = {
    source: 'es-threshold',
    limit: null,
    concurrency: 5,
    minAnalytics: 500,
    csvPath: null,
    status: null,
    useCache: true,
    force: false,
    dryRun: false,
    logPath: null,
    batchId: null
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    switch (a) {
      case '--source': opts.source = next; i++; break;
      case '--limit': opts.limit = parseInt(next, 10); i++; break;
      case '--concurrency': opts.concurrency = parseInt(next, 10); i++; break;
      case '--min-analytics': opts.minAnalytics = parseInt(next, 10); i++; break;
      case '--csv': opts.csvPath = next; i++; break;
      case '--status': opts.status = next; i++; break;
      case '--no-cache': opts.useCache = false; break;
      case '--force': opts.force = true; break;
      case '--dry-run': opts.dryRun = true; break;
      case '--log': opts.logPath = next; i++; break;
      case '--batch-id': opts.batchId = next; i++; break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      default:
        if (a.startsWith('--')) {
          console.error('Unknown option: ' + a);
          process.exit(2);
        }
    }
  }
  return opts;
}

function printUsage () {
  console.log('Usage: node scripts/bulk-generate.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --source <name>       Candidate source (default: es-threshold)');
  console.log('  --limit <N>           Cap subjects processed');
  console.log('  --concurrency <N>     Parallel workers (default: 5)');
  console.log('  --min-analytics <N>   For es-threshold: min analytics (default: 500)');
  console.log('  --csv <path>          For csv-file: path to CSV / plaintext ID list');
  console.log('  --status <status>     For by-status: live / flagged / hidden / insufficient_data');
  console.log('  --no-cache            Disable prompt caching');
  console.log('  --force               Regenerate subjects that already have a biography');
  console.log('  --dry-run             Print the plan; skip Claude + DynamoDB writes');
  console.log('  --log <path>          Override JSONL log path');
  console.log('  --batch-id <id>       Override batch identifier');
  console.log('');
  console.log('See scripts/bulk-generate.md for full details.');
}

// -------------------------------------------------------------------
// Concurrency helper — bounded parallel worker pool
// -------------------------------------------------------------------

async function runWithConcurrency (items, workerFn, concurrency) {
  const results = [];
  let cursor = 0;
  async function worker () {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];
      try {
        results[index] = await workerFn(item, index);
      } catch (err) {
        results[index] = { error: err };
      }
    }
  }
  const workers = [];
  for (let i = 0; i < Math.max(1, concurrency); i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}

// -------------------------------------------------------------------
// Progress log — one JSONL line per subject
// -------------------------------------------------------------------

function openLog (logPath) {
  const stream = fs.createWriteStream(logPath, { flags: 'a' });
  return {
    path: logPath,
    write: function (obj) {
      stream.write(JSON.stringify(obj) + '\n');
    },
    close: function () {
      stream.end();
    }
  };
}

// -------------------------------------------------------------------
// Main
// -------------------------------------------------------------------

async function main () {
  const opts = parseArgs(process.argv.slice(2));
  const batchId = opts.batchId || 'batch-' + new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = opts.logPath || path.join(process.cwd(), 'bulk-regen-' + batchId + '.jsonl');

  console.log('bulk-generate: batch-id=' + batchId);
  console.log('bulk-generate: log=' + logPath);
  console.log('bulk-generate: source=' + opts.source + ', concurrency=' + opts.concurrency +
    ', useCache=' + opts.useCache + ', force=' + opts.force +
    ', dryRun=' + opts.dryRun + ', limit=' + (opts.limit || 'none'));

  const config = loadConfig();

  // Initialise clients — mirrors bin/server.mjs's startup.
  const elastic = new Client(config.elasticsearch);
  const dynamo = require('../lib/ai/dynamo');
  dynamo.init(config);
  if (!dynamo.isReady()) {
    console.error('bulk-generate: DynamoDB is not ready — check config.dynamodb + AWS credentials.');
    process.exit(2);
  }
  console.log('bulk-generate: DynamoDB ready, table=' + (config.dynamodb && config.dynamodb.tableName));

  // Load the candidate source module. Each source module lives at
  // scripts/bulk-generate-sources/<name>.js and exports a single async
  // `list(elastic, config, opts) → [id]` function. Adding a new source
  // is: drop a file in that dir, use --source <name>. No registry to
  // touch. Sources are expected to filter out subjects already covered
  // (unless --force is set) but the runner also does its own safety
  // check per subject below.
  const sourcePath = path.join(__dirname, 'bulk-generate-sources', opts.source + '.js');
  if (!fs.existsSync(sourcePath)) {
    console.error('bulk-generate: unknown source "' + opts.source + '" — expected file: ' + sourcePath);
    process.exit(2);
  }
  const source = require(sourcePath);

  console.log('bulk-generate: querying candidate source...');
  let candidateIds;
  try {
    candidateIds = await source(elastic, config, opts);
  } catch (err) {
    console.error('bulk-generate: candidate source failed — ' + err.message);
    process.exit(1);
  }
  console.log('bulk-generate: source returned ' + candidateIds.length + ' candidate ids.');

  if (opts.limit && candidateIds.length > opts.limit) {
    candidateIds = candidateIds.slice(0, opts.limit);
    console.log('bulk-generate: --limit=' + opts.limit + ' applied → ' + candidateIds.length + ' candidates.');
  }

  if (opts.dryRun) {
    console.log('bulk-generate: dry-run — first 20 candidates:');
    candidateIds.slice(0, 20).forEach(function (id, i) {
      console.log('  ' + (i + 1) + '. ' + id);
    });
    console.log('');
    console.log('bulk-generate: dry-run complete. No Claude calls, no DynamoDB writes.');
    return;
  }

  const log = openLog(logPath);
  const regenerateBiography = require('../lib/ai/regenerate-biography');
  const biographyStore = require('../lib/ai/biography-store');

  const counts = { generated: 0, skippedByAssessment: 0, alreadyExists: 0, errors: 0 };
  const started = Date.now();

  await runWithConcurrency(candidateIds, async function (id, index) {
    // Idempotence check: unless --force-regen, skip subjects that already
    // have a BIOGRAPHY item. Cheap GetItem — one round-trip per subject,
    // amortised across the whole run. Prefer this over the candidate
    // source doing all the filtering because a source may over-produce
    // (e.g. es-threshold streams pages of ES results and can be slower
    // to filter). Belt + braces.
    if (!opts.force) {
      try {
        const existing = await biographyStore.fetchBiography(id);
        if (existing) {
          counts.alreadyExists++;
          log.write({
            ts: new Date().toISOString(),
            id,
            outcome: 'skip_already_exists',
            batchId
          });
          return;
        }
      } catch (err) {
        console.warn('bulk-generate:', id, '- existence check failed:', err.message);
      }
    }

    try {
      const result = await regenerateBiography(elastic, config, id, {
        useCache: opts.useCache,
        bulkGenerateBatch: batchId
      });
      if (result.skippedByAssessment) counts.skippedByAssessment++;
      else counts.generated++;
      log.write({
        ts: new Date().toISOString(),
        id,
        outcome: result.skippedByAssessment ? 'insufficient_data' : 'generated',
        status: result.status,
        writer: result.writer,
        reviewer: result.reviewer,
        batchId
      });
      const done = counts.generated + counts.skippedByAssessment + counts.alreadyExists + counts.errors;
      if (done % 25 === 0 || done === candidateIds.length) {
        const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);
        console.log('bulk-generate: ' + done + '/' + candidateIds.length +
          ' · generated=' + counts.generated +
          ', skipped=' + counts.skippedByAssessment +
          ', existed=' + counts.alreadyExists +
          ', errors=' + counts.errors +
          ' · ' + elapsedSec + 's elapsed');
      }
    } catch (err) {
      counts.errors++;
      console.error('bulk-generate:', id, '- error:', err.message);
      log.write({
        ts: new Date().toISOString(),
        id,
        outcome: 'error',
        error: err.message,
        batchId
      });
    }
  }, opts.concurrency);

  log.close();

  const totalSec = ((Date.now() - started) / 1000).toFixed(1);
  console.log('');
  console.log('=== bulk-regen summary ===');
  console.log('  batch-id:            ' + batchId);
  console.log('  log:                 ' + logPath);
  console.log('  total candidates:    ' + candidateIds.length);
  console.log('  generated:           ' + counts.generated);
  console.log('  insufficient data:   ' + counts.skippedByAssessment);
  console.log('  already existed:     ' + counts.alreadyExists);
  console.log('  errors:              ' + counts.errors);
  console.log('  elapsed:             ' + totalSec + 's');

  process.exit(counts.errors > 0 ? 1 : 0);
}

main().catch(function (err) {
  console.error('Fatal:', err && err.stack ? err.stack : err);
  process.exit(1);
});
