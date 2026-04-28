#!/bin/bash
# Creates the AI biographies table in local DynamoDB.
# Usage: ./devops/dynamodb-local/create-table.sh [endpoint]
#   endpoint defaults to http://localhost:8100
#
# Prerequisites:
#   - AWS CLI installed
#   - Local DynamoDB running (docker compose up -d dynamodb-local)
#   - For local DynamoDB, set dummy credentials:
#     export AWS_ACCESS_KEY_ID=local
#     export AWS_SECRET_ACCESS_KEY=local
#
# --- Data model ---
#
# Single-table design. Partition key PK = biography record ID (e.g. cp37054).
# Sort key SK determines the item kind:
#
#   SK = BIOGRAPHY               The canonical public-facing biography
#                                (one per record). Carries `entityType`,
#                                `status`, `generatedAt`, `updatedAt` so it
#                                projects into both GSIs.
#
#   SK = HISTORY#<timestamp>     A full snapshot taken on every save, for
#                                the admin compare view and audit trail.
#                                Does NOT carry `entityType` or `status`, so
#                                snapshots are base-table only — not in any
#                                GSI.
#
#   SK = STAFF_NOTE#<ts>         Staff-authored free-text note. Base-table
#                                only (queried by PK + SK prefix).
#
#   SK = STAFF_FLAG#<staff>      Per-staff flag (upsert). Base-table only.
#
# --- GSIs ---
#
# StatusIndex — hash=status, range=updatedAt
#   Drives the admin list's status tabs. Sorted by updatedAt so records that
#   have just changed status (flagged, hidden, etc.) bubble to the top of
#   their tab — the triage queue. Only canonical BIOGRAPHY items are
#   projected (only they carry `status`).
#
# CreatedAtIndex — hash=entityType, range=generatedAt
#   Drives the "All" list view. Queried with entityType='BIOGRAPHY'; returns
#   every canonical biography in reverse chronological order of generation.
#   Constant partition key means every biography lives in one partition for
#   straightforward cursor-paginated sorts. Only canonical items project
#   (only they carry `entityType`).

ENDPOINT="${1:-http://localhost:8100}"
TABLE="collectionsonline-ai"

echo "Creating table '$TABLE' at $ENDPOINT..."

aws dynamodb create-table \
  --table-name "$TABLE" \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=status,AttributeType=S \
    AttributeName=updatedAt,AttributeType=S \
    AttributeName=generatedAt,AttributeType=S \
    AttributeName=entityType,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes \
    '[
      {"IndexName":"StatusIndex","KeySchema":[{"AttributeName":"status","KeyType":"HASH"},{"AttributeName":"updatedAt","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}},
      {"IndexName":"CreatedAtIndex","KeySchema":[{"AttributeName":"entityType","KeyType":"HASH"},{"AttributeName":"generatedAt","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}
    ]' \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url "$ENDPOINT" \
  --region eu-west-1 \
  --no-cli-pager

echo "Done."
