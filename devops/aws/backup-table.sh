#!/bin/bash
#
# Backup a DynamoDB table's contents to a local JSON file via
# `aws dynamodb scan`. Safe (read-only). No AWS-side backup resources
# created — just a client-side JSON dump you keep locally.
#
# Usage:
#   ./devops/aws/backup-table.sh --table-name <name> [--region <r>] [--out <path>]
#
# Example:
#   ./devops/aws/backup-table.sh --table-name collectionsonline-ai-staging
#     → writes ~/Downloads/collectionsonline-ai-staging-YYYYMMDD-HHMM.json
#
#   ./devops/aws/backup-table.sh \
#     --table-name collectionsonline-ai-staging \
#     --out /tmp/staging.json
#
# When to use this:
#   - Before running wipe-and-recreate-table.sh, if you might want the
#     data back for inspection later. Restoring from this dump requires
#     a client-side re-import script (not built — see
#     scripts/restore-from-backup.js sketch).
#   - On demand, when you want a snapshot for offline analysis of the
#     current state (e.g. "how many biographies with sentences[] do we
#     have right now").
#
# NOT a replacement for:
#   - AWS Point-in-Time Recovery (PITR) — enable via
#       aws dynamodb update-continuous-backups --point-in-time-recovery-specification ...
#     PITR is the recovery mechanism for production; this script is a
#     lightweight complement for staging + ad-hoc inspection.
#   - AWS on-demand backups — those are AWS-side, restorable via
#       aws dynamodb restore-table-from-backup ...
#     They cost less than a scan (no read-request charges) and are
#     restorable via native tooling. Prefer them for anything you
#     genuinely intend to restore.
#
# Caveat: scan-based backup reads EVERY item. On a large table this
# consumes read capacity units (PAY_PER_REQUEST: costs pennies for
# ~25k items). Not appropriate for tables that are actively serving
# heavy production traffic.

set -euo pipefail

REGION="eu-west-1"
TABLE_NAME=""
OUT_PATH=""

usage () {
  echo "Usage: $0 --table-name <name> [--region <region>] [--out <path>]"
  echo ""
  echo "  --table-name <name>  DynamoDB table to back up (REQUIRED)"
  echo "  --region <region>    AWS region (default: eu-west-1)"
  echo "  --out <path>         Output JSON path"
  echo "                       (default: ~/Downloads/<table>-YYYYMMDD-HHMM.json)"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --table-name)  TABLE_NAME="${2:-}"; shift 2 ;;
    --region)      REGION="${2:-}";     shift 2 ;;
    --out)         OUT_PATH="${2:-}";   shift 2 ;;
    -h|--help)     usage ;;
    *)             echo "Unknown flag: $1"; usage ;;
  esac
done

if [[ -z "$TABLE_NAME" ]]; then
  echo "ERROR: --table-name is required."
  usage
fi

if [[ -z "$OUT_PATH" ]]; then
  TS=$(date +%Y%m%d-%H%M)
  OUT_PATH="$HOME/Downloads/${TABLE_NAME}-${TS}.json"
fi

# Make sure parent directory exists — the default is ~/Downloads which
# should, but a custom --out could point anywhere.
OUT_DIR=$(dirname "$OUT_PATH")
mkdir -p "$OUT_DIR"

echo ""
echo "  Table:  $TABLE_NAME"
echo "  Region: $REGION"
echo "  Output: $OUT_PATH"
echo ""

echo "Scanning table (this may take a moment for large tables)..."
aws dynamodb scan \
  --table-name "$TABLE_NAME" \
  --region "$REGION" \
  --no-cli-pager \
  > "$OUT_PATH"

# Report item count + file size for a sanity check the caller can eyeball.
ITEM_COUNT=$(python3 -c "import json,sys; print(json.load(open('$OUT_PATH'))['Count'])" 2>/dev/null || echo "?")
FILE_SIZE=$(du -h "$OUT_PATH" | awk '{print $1}')

echo ""
echo "Done. Wrote $ITEM_COUNT items to $OUT_PATH ($FILE_SIZE)."
echo ""
echo "If scan pagination kicked in (table > 1MB of items), the output"
echo "may be TRUNCATED and carry a LastEvaluatedKey field. Rerun with"
echo "the --starting-token flag on aws dynamodb scan for subsequent"
echo "pages, or use aws dynamodb export-table-to-point-in-time for"
echo "large tables where scan-and-write is impractical."
