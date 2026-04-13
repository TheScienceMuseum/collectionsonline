#!/bin/bash
# Creates the AI biographies table in local DynamoDB.
# Usage: ./scripts/create-dynamodb-table.sh [endpoint]
#   endpoint defaults to http://localhost:8100
#
# Prerequisites:
#   - AWS CLI installed
#   - Local DynamoDB running (docker compose up -d dynamodb-local)
#   - For local DynamoDB, set dummy credentials:
#     export AWS_ACCESS_KEY_ID=local
#     export AWS_SECRET_ACCESS_KEY=local

ENDPOINT="${1:-http://localhost:8100}"
TABLE="collectionsonline-ai"

echo "Creating table '$TABLE' at $ENDPOINT..."

aws dynamodb create-table \
  --table-name "$TABLE" \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=status,AttributeType=S \
    AttributeName=generatedAt,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes \
    '[{"IndexName":"StatusIndex","KeySchema":[{"AttributeName":"status","KeyType":"HASH"},{"AttributeName":"generatedAt","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}]' \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url "$ENDPOINT" \
  --region eu-west-1 \
  --no-cli-pager

echo "Done."
