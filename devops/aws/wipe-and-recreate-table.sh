#!/bin/bash
#
# Wipe + recreate a DynamoDB table on AWS with the current AI biographies
# schema. Destructive — see confirmation prompt below.
#
# Usage:
#   ./devops/aws/wipe-and-recreate-table.sh --table-name <name> [--region <r>] [--yes]
#
# Example:
#   ./devops/aws/wipe-and-recreate-table.sh --table-name collectionsonline-ai-staging
#
# What it does:
#   1. Prompts for confirmation (retype the table name) unless --yes is passed
#   2. Deletes the table
#   3. Waits for the delete to complete
#   4. Recreates it with the AI-biographies schema (PK/SK + StatusIndex GSI
#      + CreatedAtIndex GSI + PAY_PER_REQUEST billing)
#   5. Waits for the new table to reach ACTIVE
#
# Wipes ALL data. Point-in-Time Recovery + on-demand backups are lost with
# the delete — export a backup first if you might want the data back. See
# devops/aws/README.md for the recovery workflow.
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

# Confirmation — the user must retype the table name. Guards against
# accidentally hitting production by muscle memory or shell history.
if [[ "$SKIP_CONFIRM" != "true" ]]; then
  echo "This will DELETE the table and recreate it empty."
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
echo "[4/4] Waiting for the new table to reach ACTIVE..."
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
