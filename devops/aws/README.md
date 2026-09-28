# AWS operations — AI biographies

Ops guide for the AWS-hosted staging + production DynamoDB tables backing
the AI biographies feature. Local-dev DDB lives at
[../dynamodb-local/README.md](../dynamodb-local/README.md); this folder is
for AWS-side tasks only.

## Contents

- `wipe-and-recreate-table.sh` — **idempotent**. If the table exists,
  prompts + deletes + recreates. If it doesn't exist, just creates.
  Same one-liner for both "wipe + recreate" and "create from scratch
  after a manual delete". Used before a fresh deploy when the DDB
  state needs to start empty, or when a table has been dropped and
  needs to come back with the current schema.
- `backup-table.sh` — read-only; dumps the table's contents to a
  local JSON file via `aws dynamodb scan`. Use before a wipe if you
  might want the data back for inspection, or any time you want an
  offline snapshot for analysis. Not a replacement for PITR /
  on-demand backups.

## Environment mapping

The app reads its DynamoDB configuration via [`config.js`](../../config.js)
using the `rc` module. Any `co_dynamodb__*` env var overrides the
corresponding `dynamodb.*` field. In Elastic Beanstalk, set these as
environment properties on the environment configuration:

| Env var                     | Config key            | Example                              |
|-----------------------------|-----------------------|--------------------------------------|
| `co_dynamodb__tableName`    | `dynamodb.tableName`  | `collectionsonline-ai-staging`       |
| `co_dynamodb__region`       | `dynamodb.region`     | `eu-west-1`                          |
| `co_dynamodb__endpoint`     | `dynamodb.endpoint`   | (leave unset for real AWS)           |

AWS credentials come from the EB instance's IAM role — don't set access
keys as env vars. The role must include a policy granting the app read/
write access to the target table + its GSIs.

## Table naming convention

| Environment | Table name                       | Region     |
|-------------|----------------------------------|------------|
| Local dev   | `collectionsonline-ai`           | (local)    |
| Staging     | `collectionsonline-ai-staging`   | eu-west-1  |
| Production  | `collectionsonline-ai`           | eu-west-1  |

Same schema across all three; only the name + region differ. The staging
name is prefixed distinctly so the wipe script can't accidentally hit
production by shell-history typo — the script has no default table name
and requires the caller to type it twice (arg + confirmation prompt).

## Wiping the staging table

Use case: staging DB has drifted (old-shape items, test records piled up,
or the code's expectations have moved). Wipe + recreate is faster than
sifting through what to keep.

```bash
# 1. Preflight — confirm which table your staging EB env actually points at
aws elasticbeanstalk describe-configuration-settings \
  --application-name <app-name> \
  --environment-name <staging-env-name> \
  --region eu-west-1 \
  | jq '.ConfigurationSettings[0].OptionSettings[] | select(.OptionName=="co_dynamodb__tableName")'

# 2. (Optional) Back up first if you might want the data back
./devops/aws/backup-table.sh --table-name collectionsonline-ai-staging

# 3. Wipe + recreate
./devops/aws/wipe-and-recreate-table.sh --table-name collectionsonline-ai-staging

# 4. (Optional) Re-enable Point-in-Time Recovery if it was on before
aws dynamodb update-continuous-backups \
  --table-name collectionsonline-ai-staging \
  --region eu-west-1 \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

# 5. Deploy the app to staging — the AI biographies pipeline will
#    populate the empty table on the next generation call.
```

The script prompts you to retype the table name before deleting. That's
the safety net for typo protection — don't disable with `--yes` unless
you're driving this from another script that has its own confirmation.

## Recreating a table that's already been deleted

If the table has been manually deleted (via the AWS console, another
script, or an earlier run of wipe-and-recreate that you didn't follow up
on), just run the same script — it detects the missing table, skips the
delete step, and creates fresh. No confirmation prompt in the create-only
path (nothing destructive to guard against).

```bash
./devops/aws/wipe-and-recreate-table.sh --table-name collectionsonline-ai-staging
# → "Table does NOT exist. Skipping delete; creating fresh."
```

## Taking a snapshot for offline analysis

```bash
# Default output: ~/Downloads/<table>-YYYYMMDD-HHMM.json
./devops/aws/backup-table.sh --table-name collectionsonline-ai-staging

# Custom output path
./devops/aws/backup-table.sh \
  --table-name collectionsonline-ai-staging \
  --out /tmp/staging-inspect.json
```

The output is raw `aws dynamodb scan` JSON — item count + LastEvaluatedKey
present when the scan paginates. For genuinely large tables, prefer AWS's
native `export-table-to-point-in-time` — it exports to S3 and doesn't
consume read capacity.

## What NOT to do

- **Do not run `wipe-and-recreate-table.sh` against production without a
  fresh export.** Production has PITR on, but PITR is destroyed when the
  table is deleted; only an on-demand backup taken BEFORE deletion
  survives. There is currently no automated pre-flight backup — the
  script assumes the caller has decided whether one is needed.

- **Do not use `--yes` interactively.** The confirmation prompt exists
  because AWS table names look similar (staging vs prod) and a wrong
  wipe is unrecoverable without a backup.

- **Do not manually run `create-table` scripts against a table that
  already exists.** DynamoDB rejects the call with
  `ResourceInUseException`; the wipe-and-recreate script sequences the
  delete + wait + create so that failure mode never fires.

## Recovery workflow

If you wiped a table and now want it back:

**If you have an on-demand backup or PITR export from before the wipe:**

```bash
# Point-in-Time Recovery (only if PITR was enabled before the delete AND
# you never actually completed the delete):
aws dynamodb restore-table-to-point-in-time \
  --source-table-name collectionsonline-ai-staging \
  --target-table-name collectionsonline-ai-staging-restored \
  --restore-date-time "2026-07-24T14:00:00Z" \
  --region eu-west-1

# From an on-demand backup:
aws dynamodb restore-table-from-backup \
  --target-table-name collectionsonline-ai-staging-restored \
  --backup-arn arn:aws:dynamodb:eu-west-1:...:backup/... \
  --region eu-west-1
```

Restored tables come in under a different name to avoid clobbering — you
can then swap names via delete + rename.

**If you have neither (just a `dynamodb scan` JSON dump like step 2 above)**:

You'll need to write a small batch-import script that reads the JSON and
calls `dynamo.put()` per item. Not built — see the `restore-from-backup.js`
sketch in `scripts/` for the outline. Reasonable for staging-scale corpora
(low tens of thousands of items).

**If you have nothing:** the data is gone. Regenerate the biographies via
`scripts/bulk-generate.js` — the pipeline is deterministic given the same
inputs + prompt version, so a fresh batch produces equivalent output.

## Schema changes

The AI biographies table is single-table. If the schema (attributes,
keys, GSIs, billing) ever needs to change:

1. Update `devops/aws/wipe-and-recreate-table.sh` and
   `devops/dynamodb-local/create-table.sh` **in the same commit**. Both
   scripts have `--- BEGIN SCHEMA BLOCK` / `--- END SCHEMA BLOCK` markers
   to make the sync-required section obvious.
2. Update the schema documentation at the top of
   `devops/dynamodb-local/create-table.sh` (the data-model / GSI comment).
3. If the change is backwards-incompatible (removing an attribute a GSI
   projects on, restructuring keys), plan a two-step migration: create a
   new table alongside the old, backfill, cut over, delete the old.
   Never edit a live GSI in place.

## Cost + throughput

Both tables use `PAY_PER_REQUEST` billing (on-demand). Rough steady-state
cost at the current record volumes:

- Staging: negligible (~cents/month)
- Production at 25k records + ongoing curator activity: single-digit £/month

No provisioned-capacity tuning needed. If ever migrating to provisioned,
review `lib/ai/dynamo.js` for hot-partition risk on `queryByCreatedAt`
(single partition-key value for the CreatedAtIndex GSI).
