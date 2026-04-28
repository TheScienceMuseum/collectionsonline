# Local DynamoDB

Self-contained setup for running DynamoDB locally during development of
the AI biographies feature. Production uses real AWS DynamoDB — this
folder only covers the local-dev path.

## Files

| File | Purpose |
|---|---|
| `docker-compose.example.yml` | Committed template. Copy to `development/docker-compose.yml` and tweak. |
| `create-table.sh` | Creates the `collectionsonline-ai` table (single-table design with two GSIs). Idempotent — safe to re-run. |

## First-time setup

```bash
# 1. Copy the template into your gitignored working folder
cp devops/dynamodb-local/docker-compose.example.yml development/docker-compose.yml

# 2. Bring the container up (creates the named volume on first run)
docker compose -f development/docker-compose.yml up -d

# 3. Create the table schema
AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local \
  ./devops/dynamodb-local/create-table.sh
```

That's it. The app's `.corc` already points at `http://127.0.0.1:6379` for
Redis and `http://localhost:8100` for DynamoDB local — no further wiring
needed.

## Daily commands

```bash
docker compose -f development/docker-compose.yml up -d        # start
docker compose -f development/docker-compose.yml stop         # stop, keep data
docker compose -f development/docker-compose.yml restart      # quick bounce
docker compose -f development/docker-compose.yml down         # remove container, KEEP volume
docker compose -f development/docker-compose.yml down -v      # ⚠ removes volume, WIPES data
```

Stash this in a shell alias if you find yourself typing it often:

```bash
alias ddb='docker compose -f development/docker-compose.yml'
# Then: ddb up -d / ddb logs / ddb stop
```

## Gotchas to know about

### 1. Named volume permission issue (`[14] unable to open database file`)

The `amazon/dynamodb-local` image runs as user `dynamodblocal` (UID 1000),
but Docker creates the named-volume mount point as `root:root` — so the
JVM can't write its SQLite file. The compose template includes
`user: root` to sidestep this. Don't remove that line; it's not a security
concern (Docker isolates the container regardless).

### 2. Project name lock

The compose template has `name: collectionsonline` at the top. Without
this, Compose would derive the project name from the directory the file
sits in — running from `development/` would create a different volume
(`development_dynamodb-data`) than running from elsewhere
(`collectionsonline_dynamodb-data`), silently splitting your data across
two volumes. The `name:` lock guarantees the same volume regardless of
where you run from.

### 3. `docker compose down -v` wipes data

The named-volume persistence works as long as you don't pass `-v`. Plain
`down` is fine — only `-v` removes the volume.

### 4. In-memory mode trap

If you ever see records disappearing on container restart, check the
container's actual command:

```bash
docker inspect collectionsonline-dynamodb --format '{{.Config.Cmd}}'
```

Should be `[-jar DynamoDBLocal.jar -sharedDb -dbPath /home/dynamodblocal/data]`.
If it's `-inMemory` instead, you've inadvertently brought up a different
container (e.g., via `docker run` ad-hoc instead of compose). Stop and
remove it; bring the compose-defined one back up.

## Backups

For local-dev belt-and-braces, dump the table periodically:

```bash
AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local \
  aws dynamodb scan \
    --endpoint-url http://localhost:8100 --region eu-west-1 \
    --table-name collectionsonline-ai > ~/Downloads/ai-biographies-$(date +%Y%m%d).json
```

Production has its own backup tooling (DynamoDB PITR + scheduled exports —
see the AI biographies plan). This folder is local-only.
