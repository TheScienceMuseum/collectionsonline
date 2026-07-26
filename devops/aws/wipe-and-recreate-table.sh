#!/bin/bash
#
# Ensure a DynamoDB table exists on AWS with the current AI biographies
# schema. Idempotent:
#   - Table already exists → prompts for confirmation, DELETES, then recreates
#   - Table doesn't exist  → skips the delete step, just creates
#
# Same one-liner covers both "wipe + recreate for a fresh start" and
# "create from scratch after a manual delete".
#
# Usage:
#   ./devops/aws/wipe-and-recreate-table.sh --table-name <name> [--region <r>] [--yes]
#
# Example:
#   ./devops/aws/wipe-and-recreate-table.sh --table-name collectionsonline-ai-staging
#
# What it does:
#   1. Checks whether the table exists
#   2. If it exists: prompts for confirmation (retype the table name)
#      unless --yes is passed, then deletes + waits for the delete
#   3. Creates the table with the AI-biographies schema (PK/SK +
#      StatusIndex GSI + CreatedAtIndex GSI + PAY_PER_REQUEST billing)
#   4. Waits for the new table to reach ACTIVE
#
# When it deletes, it wipes ALL data. Point-in-Time Recovery + on-demand
# backups are lost with the delete — run backup-table.sh first if you
# might want the data back. See devops/aws/README.md for the full workflow.
#
# Preflight:
#   - AWS CLI configured with credentials that have DeleteTable + CreateTable
#     + DescribeTable on the target table's ARN
#   - Confirm which table your target environment is actually pointed at
#     (co_dynamodb__tableName env var on the EB config, or the target .corc)
#   - Region matches your target environment (default eu-west-1)
#
# **The schema block below MUST be kept in sync with
# devops/dynamodb-local/create-table.sh.** Both scripts encode the same table
# shape; a divergence causes local-vs-AWS drift that only surfaces on GSI
# queries. If you change one, change the other in the same commit.

set -euo pipefail

REGION="eu-west-1"
TABLE_NAME=""
SKIP_CONFIRM="false"

usage () {
  echo "Usage: $0 --table-name <name> [--region <region>] [--yes]"
  echo ""
  echo "  --table-name <name>  DynamoDB table to wipe + recreate (REQUIRED)"
  echo "  --region <region>    AWS region (default: eu-west-1)"
  echo "  --yes                Skip the confirmation prompt (for scripted use)"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --table-name)  TABLE_NAME="${2:-}"; shift 2 ;;
    --region)      REGION="${2:-}";     shift 2 ;;
    --yes)         SKIP_CONFIRM="true"; shift ;;
    -h|--help)     usage ;;
    *)             echo "Unknown flag: $1"; usage ;;
  esac
done

if [[ -z "$TABLE_NAME" ]]; then
  echo "ERROR: --table-name is required. No default (safety)."
  usage
fi

echo ""
echo "  Table:  $TABLE_NAME"
echo "  Region: $REGION"
echo ""

# Detect whether the table already exists — describe-table exits non-zero
# with ResourceNotFoundException when it doesn't. Suppress stderr so the
# "table not found" case doesn't print an alarming-looking error.
if aws dynamodb describe-table \
     --table-name "$TABLE_NAME" \
     --region "$REGION" \
     --no-cli-pager >/dev/null 2>&1; then
  TABLE_EXISTS="true"
else
  TABLE_EXISTS="false"
fi

if [[ "$TABLE_EXISTS" == "true" ]]; then
  # Wipe + recreate path — confirmation required.
  if [[ "$SKIP_CONFIRM" != "true" ]]; then
    echo "Table EXISTS. This will DELETE it and recreate it empty."
    echo "All items are lost. Point-in-Time Recovery is lost."
    echo ""
    read -r -p "Retype the table name to confirm: " CONFIRM
    if [[ "$CONFIRM" != "$TABLE_NAME" ]]; then
      echo "Confirmation did not match. Aborting."
      exit 1
    fi
  fi

  echo ""
  echo "[1/4] Deleting table '$TABLE_NAME'..."
  aws dynamodb delete-table \
    --table-name "$TABLE_NAME" \
    --region "$REGION" \
    --no-cli-pager

  echo ""
  echo "[2/4] Waiting for delete to complete (may take 10-30s)..."
  aws dynamodb wait table-not-exists \
    --table-name "$TABLE_NAME" \
    --region "$REGION"

  echo ""
  echo "[3/4] Creating table '$TABLE_NAME' with current schema..."
else
  # Create-only path — no delete needed. Still print the "will create"
  # step number so the output structure matches the wipe case.
  echo "Table does NOT exist. Skipping delete; creating fresh."
  echo ""
  echo "[1/2] Creating table '$TABLE_NAME' with current schema..."
fi
# --- BEGIN SCHEMA BLOCK — keep in sync with devops/dynamodb-local/create-table.sh
aws dynamodb create-table \
  --table-name "$TABLE_NAME" \
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
  --region "$REGION" \
  --no-cli-pager
# --- END SCHEMA BLOCK

echo ""
if [[ "$TABLE_EXISTS" == "true" ]]; then
  echo "[4/4] Waiting for the new table to reach ACTIVE..."
else
  echo "[2/2] Waiting for the new table to reach ACTIVE..."
fi
aws dynamodb wait table-exists \
  --table-name "$TABLE_NAME" \
  --region "$REGION"

echo ""
echo "Done. Table '$TABLE_NAME' is empty and ready in region '$REGION'."
echo ""
echo "Next steps:"
echo "  - Deploy your app; the AI biographies pipeline will populate the"
echo "    table on the next generation call."
echo "  - If Point-in-Time Recovery was on before, re-enable it:"
echo "      aws dynamodb update-continuous-backups \\"
echo "        --table-name '$TABLE_NAME' \\"
echo "        --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \\"
echo "        --region '$REGION'"
