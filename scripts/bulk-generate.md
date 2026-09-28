# bulk-generate.js

Companion documentation for [`scripts/bulk-generate.js`](./bulk-generate.js) and
its candidate-source modules under
[`scripts/bulk-generate-sources/`](./bulk-generate-sources/).

Bulk-generates AI biographies against a live DynamoDB table by iterating a
candidate list, running the writer + reviewer pipeline for each subject, and
persisting the result. Designed for two workflows:

1. **Pre-launch seeding.** Pick the top-N popular records that don't yet have a
   biography and generate one for each. Enables prompt caching so the batch
   input cost drops ~90% vs cold calls.
2. **Post-change propagation.** After changing anti-patterns / tone / model,
   regenerate every existing biography so the collection stays consistent.

Uses the same code path as the admin "Regenerate" button
(`lib/ai/regenerate-biography.js`) — the batch is not a separate pipeline.

### Prerequisites

- Node ≥ the version pinned in `package.json`.
- `.corc` in the project root with dev config (or set `co_*` env vars).
- `.corc.batch` in the project root (gitignored) for prod overrides — AWS
  credentials + prod DynamoDB table name + prod Elasticsearch endpoint. Any
  key from `.corc` can be overridden; deep-merges on top.
- Anthropic API key available via `anthropicApiKey` (in `.corc`, `.corc.batch`,
  or the `ANTHROPIC_API_KEY` env var).

Example `.corc.batch`:

```json
{
  "dynamodb": {
    "region": "eu-west-1",
    "tableName": "collectionsonline-ai-prod"
  },
  "elasticsearch": {
    "node": "https://ciim-prod.internal/",
    "auth": { "username": "...", "password": "..." }
  },
  "anthropicApiKey": "sk-ant-..."
}
```

### CLI

```
node scripts/bulk-generate.js [options]
```

| Option | Default | Purpose |
|---|---|---|
| `--source <name>` | `es-threshold` | Candidate source (see below) |
| `--limit <N>` | none | Cap subjects processed — use for smoke tests |
| `--concurrency <N>` | `5` | Parallel workers |
| `--min-analytics <N>` | `500` | For `es-threshold`: minimum analytics count |
| `--csv <path>` | — | For `csv-file`: path to CSV / plaintext ID list |
| `--status <status>` | — | For `by-status`: live / flagged / hidden / insufficient_data |
| `--no-cache` | off (cache on) | Disable prompt caching |
| `--force` | off | Regenerate subjects that already have a biography |
| `--dry-run` | off | Print the plan; skip Claude + writes |
| `--log <path>` | `bulk-generate-<batchId>.jsonl` | Progress log path |
| `--batch-id <id>` | timestamp | Batch identifier stamped onto every touched item |

### Candidate sources

Each source module lives at `scripts/bulk-generate-sources/<name>.js` and
exports a single async function `list(elastic, config, opts) → [id]`. The
runner picks one by `--source <name>`. No registry — drop a file, use the name.

**`es-threshold`** (default)

Top-N `type: agent` records from Elasticsearch by
`enhancement.analytics.current.cumulative_views ≥ minAnalytics`, sorted
popularity-descending. Ideal for pre-launch seeding — you get the biographies
that most page-views will hit.

```
node scripts/bulk-generate.js --source es-threshold --min-analytics 500
```

The runner then skips any returned id that already has a biography (unless
`--force`), so re-running is safe.

**`csv-file`**

Read a list of IDs from disk. First column of each CSV row is the ID;
everything after the first comma is ignored. Blank lines and `#`-prefixed
lines are skipped.

```
node scripts/bulk-generate.js --source csv-file --csv seed-list.csv
```

Example `seed-list.csv`:

```
# Priority records for launch — curator-supplied 2026-07
cp37054,Albert Einstein
cp42536,Unilever
cp125074,Lipton
```

**`regen-existing`**

Every existing BIOGRAPHY item. Requires `--force` (without it the runner
would filter every id via its idempotence check). Use for full-collection
propagation after a class-wide prompt change.

```
node scripts/bulk-generate.js --source regen-existing --force
```

Curator decisions + review history are NOT touched — they live at separate
DynamoDB SK prefixes and survive the regen; only the canonical BIOGRAPHY
item is overwritten.

**`by-status`**

Every BIOGRAPHY item with a given status. Requires `--status` and `--force`.

```
node scripts/bulk-generate.js --source by-status --status flagged --force
```

Useful patterns:

- `--status flagged` — after fixing whatever was causing the flags.
- `--status insufficient_data` — after loosening the sufficiency threshold
  or after wikidata coverage improved.
- `--status live` — to backfill a new stored field across all live records.

### Adding a source

1. Create `scripts/bulk-generate-sources/<my-source>.js`.
2. Export a single async function `list(elastic, config, opts)` that returns
   an array of external IDs (e.g. `['cp37054', 'ap12345']`).
3. Run with `--source <my-source>`.

Sources should filter defensively where possible (e.g. only return ids that
are plausibly generatable), but the runner also does a per-subject
GetItem-based idempotence check — belt + braces.

### Progress log

Every processed subject produces one JSONL line:

```json
{"ts":"2026-07-08T09:14:22Z","id":"cp37054","outcome":"generated","status":"live",
 "writer":{"inputTokens":300,"outputTokens":900,"cacheCreationTokens":0,"cacheReadTokens":5200,
   "model":"claude-sonnet-4-20250514","promptVersion":"2026-07-v8-collection-flow","confidence":7},
 "reviewer":{"inputTokens":180,"outputTokens":220,"cacheCreationTokens":0,"cacheReadTokens":1400,
   "model":"claude-sonnet-4-20250514","findingsCount":1,"spend":0.0013},
 "batchId":"batch-2026-07-08T09-14-01Z"}
```

Outcome values:

| Outcome | Meaning |
|---|---|
| `generated` | Writer + reviewer completed; BIOGRAPHY item saved. The final persisted `status` may be `live`, `insufficient_data` (writer self-reported low confidence), or `admin_only` (existing catalogue description prevails). Check the `status` field for the actual landing. |
| `insufficient_data` | Pre-flight assessment failed; Claude not called; item saved with skip reason and `status: insufficient_data`. |
| `admin_only` | Pre-flight bailed because the existing catalogue description exceeds the AI-generation threshold; item saved with `status: admin_only`. |
| `skip_already_exists` | Subject had a BIOGRAPHY item and `--force` was not set. |
| `error` | Writer or store threw; `error` field carries the message. |

Re-running the script with the same source is safe (idempotent). Point a
future `--source csv-file --csv failed-ids.csv` at the log's error lines to
retry just the failures.

### Summary output

At end-of-run the script prints two independent breakdowns:

- **Code-path counters** — `writer ran`, `pre-flight skipped`, `already existed`,
  `errors`. `writer ran` is the cost-relevant number (writer + reviewer tokens
  were spent on each of these subjects).
- **Persisted status** — `live`, `insufficient_data`, `admin_only`. This bucket
  reflects what actually landed in DynamoDB, and is independent of which code
  path arrived. A writer-ran subject can still land as `insufficient_data` (low
  writer confidence) or `admin_only` (existing catalogue prevails), so the two
  breakdowns will disagree whenever those crossovers happen — that's expected.
  The persisted-status bucket is authoritative for "how many records ended up
  as X".

### Cost expectations

Typical per-subject cost with caching on (`~15s wall clock`):

- Writer: ~£0.010–£0.020 uncached; ~£0.001–£0.003 for cache hits (subject #2
  onwards within the 5-min TTL).
- Reviewer: ~£0.001–£0.002 uncached; ~£0.0001–£0.0003 cached.
- Combined uncached (`--no-cache`): ~£0.011–£0.022 per record.
- Combined cached (default in batch): ~£0.0015–£0.004 per record after the
  first (~90% savings).

At 5,000 records with caching on: **~£8–£20** for the whole batch. Without
caching (`--no-cache`): ~£55–£110.

### Safety

- `.corc.batch` is gitignored. Verify with `git check-ignore -v .corc.batch`.
- The runner always writes to whichever DynamoDB table `config.dynamodb.tableName`
  points at, so the point of `.corc.batch` is to make that table explicit at
  invocation time. Don't rely on `.corc` alone in dev.
- `--dry-run` fetches candidates but does NOT call Claude and does NOT write
  to DynamoDB. Use it to confirm the candidate list before spending money.
- Errors don't halt the run — they're logged to the JSONL and the runner
  continues. Total error count appears in the summary at exit.
