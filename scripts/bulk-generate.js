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
//   --min-analytics <N>   For es-threshold + es-thin-with-wikidata: min analytics count.
//   --max-existing-chars <N>  For es-thin-with-wikidata: post-filter to records where
//                             existing biography is shorter than N (default 500). Records
//                             with zero existing content are also excluded (they typically
//                             trip the insufficient_data gate and generate stubs anyway).
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
// Auth-error circuit breaker
// -------------------------------------------------------------------
//
// The existence-check GetItem runs per subject before we call Claude.
// When it fails with an auth-shaped error (e.g. broken AWS_PROFILE),
// the DDB write at the end will fail too — so calling Claude just
// burns tokens on output we can never save. A workshop-prep batch on
// 2026-08-04 lost ~£0.30 to this before anyone noticed.
//
// Two-layer guard:
//   1. Per-subject:  if the existence-check auth-fails, skip Claude
//                    for THAT subject (still logs an error).
//   2. Batch-wide:   after AUTH_ABORT_THRESHOLD consecutive auth-shape
//                    failures, mark the batch aborted so no further
//                    subjects even try.
//
// Non-auth existence-check failures (transient DDB blip, throttle,
// etc.) still fall through to a generation attempt — the write may
// well succeed on retry, and skipping would be over-cautious.

const LONG_PROMPT_TOKENS = 100000;
const AUTH_ABORT_THRESHOLD = 3;
const AUTH_ERROR_PATTERN = /Could not load credentials|security token|AccessDenied|UnrecognizedClientException|ExpiredToken|InvalidClientTokenId|SignatureDoesNotMatch/i;

function looksLikeAuthError (message) {
  if (!message) return false;
  return AUTH_ERROR_PATTERN.test(String(message));
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
    maxExistingChars: null,
    csvPath: null,
    status: null,
    useCache: true,
    force: false,
    skipIfCurrent: false,
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
      case '--max-existing-chars': opts.maxExistingChars = parseInt(next, 10); i++; break;
      case '--csv': opts.csvPath = next; i++; break;
      case '--status': opts.status = next; i++; break;
      case '--no-cache': opts.useCache = false; break;
      case '--force': opts.force = true; break;
      case '--skip-if-current': opts.skipIfCurrent = true; break;
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
  console.log('  --min-analytics <N>   For es-threshold + es-thin-with-wikidata: min analytics count');
  console.log('  --max-existing-chars <N>  For es-thin-with-wikidata: keep records where existing biography < N chars (default 500)');
  console.log('  --csv <path>          For csv-file: path to CSV / plaintext ID list');
  console.log('  --status <status>     For by-status: live / flagged / hidden / insufficient_data / admin_only');
  console.log('  --no-cache            Disable prompt caching');
  console.log('  --force               Regenerate every subject (never skip)');
  console.log('  --skip-if-current     Skip only subjects whose existing biography matches');
  console.log('                        the current promptVersion + model. Use for incremental');
  console.log('                        prompt-version rollouts. Default (no flag) skips any');
  console.log('                        existing biography — retry-safe for interrupted runs.');
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
  // Default log location is logs/bulk-regen-<batchId>.jsonl under the repo
  // root — keeps batch audit artefacts out of the git root (where they
  // used to accumulate and clutter `ls`). --log <path> still overrides.
  // mkdir -p is idempotent and cheap.
  const logPath = opts.logPath || path.join(process.cwd(), 'logs', 'bulk-regen-' + batchId + '.jsonl');
  fs.mkdirSync(path.dirname(logPath), { recursive: true });

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
  const ruleHitTally = require('../lib/ai/rule-hit-tally');

  // Per-subject rule-hit tallies accumulate here. Aggregated in the
  // summary at end-of-run so a curator can see which anti-pattern rules
  // actually fired across the batch — enables the deferred trim pass
  // (task #88) to retire rules that never earn their keep.
  const ruleHitPerSubject = [];

  const counts = { generated: 0, skippedByAssessment: 0, alreadyExists: 0, errors: 0, abortedBeforeStart: 0 };
  // Bucket by the ACTUAL persisted status. Independent of which code path
  // reached the save: pre-flight assessment can save insufficient_data or
  // admin_only, AND the writer-completed path can also land at
  // insufficient_data (low writer confidence) or admin_only (existing
  // catalogue prevails). Bucketing by the outcome field alone undercounts
  // insufficient_data landings because the writer-completed → low-confidence
  // crossover is logged as outcome='generated' but persisted as
  // status='insufficient_data'.
  const byStatus = { live: 0, insufficient_data: 0, admin_only: 0, other: 0 };
  const circuit = { authFailCount: 0, aborted: false, firstAuthError: null };
  const tokens = {
    writerInput: 0,
    writerOutput: 0,
    writerCacheCreation: 0,
    writerCacheRead: 0,
    reviewerInput: 0,
    reviewerOutput: 0,
    reviewerCacheCreation: 0,
    reviewerCacheRead: 0,
    writerLongPromptCalls: 0
  };
  const started = Date.now();

  // Resolve the "current" prompt version + model once, up front, so the
  // per-subject skip check is a pure comparison. The prompt resolver
  // reads config.aiBiographyPromptVersion (or falls back to the newest
  // module in prompts/biographies/). If either lookup fails,
  // --skip-if-current will just fall through to matching on model only.
  let currentPromptVersion = null;
  const currentModel = config.aiBiographyModel || null;
  try {
    currentPromptVersion = require('../lib/ai/prompts/biography').activeVersion || null;
  } catch (err) {
    // Non-fatal.
  }

  await runWithConcurrency(candidateIds, async function (id, index) {
    // Circuit-breaker gate: once tripped, every remaining subject exits
    // here without hitting DynamoDB or Claude. Prior in-flight workers
    // still finish their current subject — no in-flight cancellation.
    if (circuit.aborted) {
      counts.abortedBeforeStart++;
      log.write({
        ts: new Date().toISOString(),
        id,
        outcome: 'aborted_batch',
        reason: 'auth_circuit_breaker',
        batchId
      });
      return;
    }

    // Idempotence check. Three modes:
    //   default (neither flag):  skip subjects with ANY existing biography
    //     (retry-safe for interrupted 25K launches)
    //   --skip-if-current:       skip subjects whose existing biography
    //     matches the current promptVersion + model (enables incremental
    //     prompt-version rollouts — only regen stale subjects)
    //   --force:                 never skip; regenerate every subject
    if (!opts.force) {
      try {
        const existing = await biographyStore.fetchBiography(id);
        if (existing) {
          const matchesCurrent = opts.skipIfCurrent
            ? (existing.promptVersion === currentPromptVersion && existing.model === currentModel)
            : true;
          if (matchesCurrent) {
            counts.alreadyExists++;
            log.write({
              ts: new Date().toISOString(),
              id,
              outcome: 'skip_already_exists',
              existingPromptVersion: existing.promptVersion,
              existingModel: existing.model,
              batchId
            });
            return;
          }
        }
      } catch (err) {
        console.warn('bulk-generate:', id, '- existence check failed:', err.message);
        // Auth-shaped failures: skip Claude for this subject (the write
        // will fail anyway), and trip the batch-wide breaker once we've
        // seen enough of them. Non-auth failures fall through — a
        // transient DDB blip shouldn't stop the generation attempt.
        if (looksLikeAuthError(err.message)) {
          circuit.authFailCount++;
          if (!circuit.firstAuthError) circuit.firstAuthError = err.message;
          if (circuit.authFailCount >= AUTH_ABORT_THRESHOLD && !circuit.aborted) {
            circuit.aborted = true;
            console.error('bulk-generate: AUTH CIRCUIT BREAKER TRIPPED after ' +
              circuit.authFailCount + ' credential errors. Remaining subjects will ' +
              'be skipped to prevent Claude token waste. First error: ' +
              circuit.firstAuthError);
          }
          counts.errors++;
          log.write({
            ts: new Date().toISOString(),
            id,
            outcome: 'error',
            error: 'auth_check_failed: ' + err.message,
            batchId
          });
          return;
        }
      }
    }

    try {
      const result = await regenerateBiography(elastic, config, id, {
        useCache: opts.useCache,
        bulkGenerateBatch: batchId,
        // Batch is cost-sensitive — skip generation entirely for
        // records whose existing catalogue description exceeds
        // aiBiographyMaxExistingChars. Regenerate.js writes a stub
        // BIOGRAPHY item with status='admin_only' so the record shows
        // up in the admin list; a curator can force generation later
        // via the admin Regenerate button (which does NOT pass this
        // flag, so it always generates).
        skipIfExistingPrevails: true
      });
      if (result.skippedByAssessment) counts.skippedByAssessment++;
      else counts.generated++;
      if (result.status && Object.prototype.hasOwnProperty.call(byStatus, result.status)) {
        byStatus[result.status]++;
      } else if (result.status) {
        byStatus.other++;
      }
      if (result.writer) {
        tokens.writerInput += result.writer.inputTokens || 0;
        tokens.writerOutput += result.writer.outputTokens || 0;
        tokens.writerCacheCreation += result.writer.cacheCreationTokens || 0;
        tokens.writerCacheRead += result.writer.cacheReadTokens || 0;
        const promptTokens = (result.writer.inputTokens || 0) +
          (result.writer.cacheReadTokens || 0) +
          (result.writer.cacheCreationTokens || 0);
        if (promptTokens > LONG_PROMPT_TOKENS) tokens.writerLongPromptCalls++;
      }
      if (result.reviewer) {
        tokens.reviewerInput += result.reviewer.inputTokens || 0;
        tokens.reviewerOutput += result.reviewer.outputTokens || 0;
        tokens.reviewerCacheCreation += result.reviewer.cacheCreationTokens || 0;
        tokens.reviewerCacheRead += result.reviewer.cacheReadTokens || 0;
      }
      // Rule-hit instrumentation — read back the just-persisted BIOGRAPHY
      // and tally which anti-pattern rules were cited.
      // Best-effort: a DDB miss here doesn't fail the run.
      if (!result.skippedByAssessment) {
        try {
          const persisted = await biographyStore.fetchBiography(id);
          const tally = ruleHitTally.tallyRuleHits({
            notes: persisted && persisted.writerNotes,
            selfReview: persisted && persisted.selfReview,
            findings: []
          });
          ruleHitPerSubject.push({ id, tally });
        } catch (err) {
          // Non-fatal — the tally is a diagnostic, not a launch-blocker.
        }
      }
      // Log outcome by actual persisted status so post-run analysis can
      // slice on the specific skip category. Three skipped-by-batch
      // outcomes now possible: 'insufficient_data', 'admin_only', and
      // 'generated'. Preserve the raw status for full detail.
      const outcome = result.skippedByAssessment
        ? (result.status === 'admin_only' ? 'admin_only' : 'insufficient_data')
        : 'generated';
      log.write({
        ts: new Date().toISOString(),
        id,
        outcome,
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

  // Pricing lookup keyed by model family. Anthropic list prices per 1M
  // tokens: cache-read = input × 0.1, cache-write (5-min TTL) = input × 1.25.
  // Reviewer (when present) uses the same model, so one lookup covers both.
  // Falls back to Sonnet-tier if the configured model is unrecognised; a
  // warning is printed so the caller notices.
  const modelId = config.aiBiographyModel || '';
  // Haiku 5.5 bills a request at 5× (input $0.50, output $2.50) when its
  // prompt exceeds LONG_PROMPT_TOKENS. Biography prompts sit far below
  // that, so the estimate uses the standard card and warns if any call
  // crossed the line.
  function pricingFor (id) {
    if (/haiku-5-5/i.test(id)) return { tier: 'haiku-5.5', inputUsdPerM: 0.10, outputUsdPerM: 0.50, hasLongPromptCard: true };
    if (/haiku-4-5/i.test(id)) return { tier: 'haiku-4.5', inputUsdPerM: 1.00, outputUsdPerM: 5.00 };
    if (/opus/i.test(id)) return { tier: 'opus-4.x/5', inputUsdPerM: 5.00, outputUsdPerM: 25.00 };
    if (/sonnet/i.test(id)) return { tier: 'sonnet-4.x/5', inputUsdPerM: 3.00, outputUsdPerM: 15.00 };
    return null;
  }
  let pricing = pricingFor(modelId);
  if (!pricing) {
    console.warn('bulk-generate: unknown model "' + modelId + '" — using sonnet-tier pricing for the cost estimate; edit scripts/bulk-generate.js pricingFor() to add it.');
    pricing = { tier: 'sonnet-4.x/5 (fallback)', inputUsdPerM: 3.00, outputUsdPerM: 15.00 };
  }
  const gbpPerUsd = config.aiBiographyGbpPerUsd || 0.80;
  const usdInput = pricing.inputUsdPerM / 1e6;
  const usdOutput = pricing.outputUsdPerM / 1e6;
  const usdCacheRead = usdInput * 0.1;
  const usdCacheWrite = usdInput * 1.25;
  const writerCostUsd =
    tokens.writerInput * usdInput +
    tokens.writerOutput * usdOutput +
    tokens.writerCacheRead * usdCacheRead +
    tokens.writerCacheCreation * usdCacheWrite;
  const reviewerCostUsd =
    tokens.reviewerInput * usdInput +
    tokens.reviewerOutput * usdOutput +
    tokens.reviewerCacheRead * usdCacheRead +
    tokens.reviewerCacheCreation * usdCacheWrite;
  const totalCostGbp = (writerCostUsd + reviewerCostUsd) * gbpPerUsd;
  const avgCostGbpPerGenerated = counts.generated > 0
    ? totalCostGbp / counts.generated
    : 0;

  console.log('');
  console.log('=== bulk-regen summary ===');
  console.log('  batch-id:            ' + batchId);
  console.log('  log:                 ' + logPath);
  console.log('  total candidates:    ' + candidateIds.length);
  console.log('  writer ran:          ' + counts.generated);
  console.log('  pre-flight skipped:  ' + counts.skippedByAssessment);
  console.log('  already existed:     ' + counts.alreadyExists);
  console.log('  errors:              ' + counts.errors);
  if (counts.abortedBeforeStart > 0) {
    console.log('  aborted (breaker):   ' + counts.abortedBeforeStart);
  }
  console.log('  elapsed:             ' + totalSec + 's');
  console.log('');
  // Persisted-status breakdown. Independent of the writer-ran / pre-flight
  // split above — a writer-ran subject can still land as insufficient_data
  // (low writer confidence) or admin_only (existing catalogue prevails).
  // Sum here == generated + skippedByAssessment when everything reached DDB.
  console.log('=== persisted status ===');
  console.log('  live:                ' + byStatus.live);
  console.log('  insufficient_data:   ' + byStatus.insufficient_data);
  console.log('  admin_only:          ' + byStatus.admin_only);
  if (byStatus.other > 0) {
    console.log('  other:               ' + byStatus.other);
  }
  console.log('');
  console.log('=== token usage ===');
  console.log('  writer input:        ' + tokens.writerInput.toLocaleString());
  console.log('  writer output:       ' + tokens.writerOutput.toLocaleString());
  console.log('  writer cache-read:   ' + tokens.writerCacheRead.toLocaleString() +
    (tokens.writerInput > 0
      ? ' (' + Math.round(100 * tokens.writerCacheRead / (tokens.writerInput + tokens.writerCacheRead + tokens.writerCacheCreation)) + '% of input side)'
      : ''));
  console.log('  writer cache-write:  ' + tokens.writerCacheCreation.toLocaleString());
  console.log('  reviewer input:      ' + tokens.reviewerInput.toLocaleString());
  console.log('  reviewer output:     ' + tokens.reviewerOutput.toLocaleString());
  console.log('');
  console.log('=== cost (£) — pricing: ' + pricing.tier +
    ' (input $' + pricing.inputUsdPerM.toFixed(2) +
    '/M, output $' + pricing.outputUsdPerM.toFixed(2) + '/M) ===');
  console.log('  writer:              £' + (writerCostUsd * gbpPerUsd).toFixed(3));
  console.log('  reviewer:            £' + (reviewerCostUsd * gbpPerUsd).toFixed(3));
  console.log('  TOTAL:               £' + totalCostGbp.toFixed(3));
  if (pricing.hasLongPromptCard && tokens.writerLongPromptCalls > 0) {
    console.warn('  WARNING: ' + tokens.writerLongPromptCalls + ' writer call(s) had prompts over ' +
      LONG_PROMPT_TOKENS.toLocaleString() + ' tokens, billed at 5× the rates above — TOTAL is understated.');
  }
  if (counts.generated > 0) {
    console.log('  per-subject average: £' + avgCostGbpPerGenerated.toFixed(4));
    console.log('  project to 25K:      £' + (avgCostGbpPerGenerated * 25000).toFixed(0));
  }

  // Rule-hit aggregate — enables the deferred cost-trim pass to see
  // which anti-pattern rules earned their keep in this batch. A rule
  // with zero hits across a large run is a strong retirement candidate.
  if (ruleHitPerSubject.length > 0) {
    const perRule = ruleHitTally.aggregate(ruleHitPerSubject);
    console.log('');
    console.log('=== anti-pattern rule hits (top 15) ===');
    if (perRule.length === 0) {
      console.log('  (no rules fired across this batch — every rule is a retirement candidate)');
    } else {
      perRule.slice(0, 15).forEach(function (r) {
        console.log('  ' + String(r.totalHits).padStart(4) + ' × ' + r.slug +
          ' (' + r.subjects.length + ' subj) — ' + r.heading);
      });
      if (perRule.length > 15) {
        console.log('  ...(' + (perRule.length - 15) + ' more rules below)');
      }
      // Report unfired rules explicitly — the trim-pass target.
      const firedSlugs = new Set(perRule.map(function (r) { return r.slug; }));
      const allRules = ruleHitTally.loadRules().rules;
      const unfired = allRules.filter(function (r) { return !firedSlugs.has(r.slug); });
      if (unfired.length > 0) {
        console.log('');
        console.log('  rules with ZERO hits (' + unfired.length + '/' + allRules.length + ' total):');
        unfired.forEach(function (r) {
          console.log('    · ' + r.slug + ' — ' + r.heading);
        });
      }
    }
  }

  process.exit(counts.errors > 0 ? 1 : 0);
}

// Exports for unit tests. The CLI-entry guard lets test/*.test.js
// require this file without triggering main().
module.exports = {
  looksLikeAuthError,
  AUTH_ABORT_THRESHOLD,
  AUTH_ERROR_PATTERN
};

if (require.main === module) {
  main().catch(function (err) {
    console.error('Fatal:', err && err.stack ? err.stack : err);
    process.exit(1);
  });
}
