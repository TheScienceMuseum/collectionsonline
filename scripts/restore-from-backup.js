#!/usr/bin/env node
'use strict';

// Restore the AI-biographies DynamoDB table from a JSONL backup.
//
// Usage:
//   node scripts/restore-from-backup.js <backup.jsonl[.gz]> [--dry-run]
//
// The backup file is one DynamoDB item per line, as emitted by the
// /admin/ai/backup.jsonl.gz admin route. Gzipped or plain — auto-detected
// from the filename.
//
// In dry-run mode the script reads every line, compares against the live
// table, and classifies each item:
//   INSERT    — not in the live table (new write)
//   OVERWRITE — in the live table, content differs (would be replaced)
//   UNCHANGED — in the live table, content identical (skipped)
// A summary line totals the three. No writes happen.
//
// Without --dry-run, the same classification happens, then INSERT +
// OVERWRITE items are written via PutItem. UNCHANGED items are skipped.
// After writing: a summary line + exit 0.
//
// For a fully wiped DB: expect "N INSERT, 0 OVERWRITE, 0 UNCHANGED".
// For a partially damaged DB: the mix tells you whether to proceed.

const fs = require('fs');
const readline = require('readline');
const zlib = require('zlib');
const path = require('path');

const DynamoDBClient = require('@aws-sdk/client-dynamodb').DynamoDBClient;
const DynamoDBDocumentClient = require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient;
const GetCommand = require('@aws-sdk/lib-dynamodb').GetCommand;
const PutCommand = require('@aws-sdk/lib-dynamodb').PutCommand;

function loadConfig () {
  // Use `rc` the same way bin/server.mjs does — reads .corc + env vars.
  const rc = require('rc');
  return rc('co', { dynamodb: {} });
}

function buildClient (config) {
  const dynamoConfig = config.dynamodb || {};
  const clientConfig = { region: dynamoConfig.region || 'eu-west-1' };
  if (dynamoConfig.endpoint) clientConfig.endpoint = dynamoConfig.endpoint;
  const client = new DynamoDBClient(clientConfig);
  return {
    docClient: DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true }
    }),
    tableName: dynamoConfig.tableName || 'collectionsonline-ai'
  };
}

// Deep-equals for plain-JSON shapes. Enough because DynamoDB items round-
// trip through JSON in both directions — if both sides serialise to the
// same string, they're equivalent. Keys sorted so `{a:1,b:2}` and
// `{b:2,a:1}` compare equal.
function canonicalJson (obj) {
  if (obj == null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJson).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(function (k) { return JSON.stringify(k) + ':' + canonicalJson(obj[k]); }).join(',') + '}';
}

function equalItems (a, b) { return canonicalJson(a) === canonicalJson(b); }

function openInput (filePath) {
  const stream = fs.createReadStream(filePath);
  if (filePath.endsWith('.gz')) {
    return stream.pipe(zlib.createGunzip());
  }
  return stream;
}

async function main () {
  const args = process.argv.slice(2);
  const dryRun = args.indexOf('--dry-run') !== -1;
  const filePath = args.find(function (a) { return !a.startsWith('--'); });

  if (!filePath) {
    console.error('Usage: node scripts/restore-from-backup.js <backup.jsonl[.gz]> [--dry-run]');
    process.exit(2);
  }
  if (!fs.existsSync(filePath)) {
    console.error('File not found: ' + filePath);
    process.exit(2);
  }

  const config = loadConfig();
  const { docClient, tableName } = buildClient(config);

  const compressed = filePath.endsWith('.gz');
  console.log('[' + (dryRun ? 'DRY-RUN' : 'LIVE') + '] Reading backup: ' + path.basename(filePath) + (compressed ? ' (compressed)' : ''));
  console.log('                Table: ' + tableName);
  if (config.dynamodb && config.dynamodb.endpoint) {
    console.log('                Endpoint: ' + config.dynamodb.endpoint);
  }
  console.log('');

  const counts = { INSERT: 0, OVERWRITE: 0, UNCHANGED: 0, ERROR: 0 };
  let lineNo = 0;

  const rl = readline.createInterface({
    input: openInput(filePath),
    crlfDelay: Infinity
  });

  for await (const rawLine of rl) {
    lineNo++;
    const line = rawLine.trim();
    if (!line) continue;

    let item;
    try { item = JSON.parse(line); } catch (err) {
      console.error('LINE ' + lineNo + ': parse error — ' + err.message);
      counts.ERROR++;
      continue;
    }
    if (!item || !item.PK || !item.SK) {
      console.error('LINE ' + lineNo + ': missing PK/SK — skipping');
      counts.ERROR++;
      continue;
    }

    // Classify against the live table.
    let classification;
    try {
      const existing = await docClient.send(new GetCommand({
        TableName: tableName,
        Key: { PK: item.PK, SK: item.SK }
      }));
      if (!existing.Item) {
        classification = 'INSERT';
      } else if (equalItems(existing.Item, item)) {
        classification = 'UNCHANGED';
      } else {
        classification = 'OVERWRITE';
      }
    } catch (err) {
      console.error('LINE ' + lineNo + ' (' + item.PK + ' / ' + item.SK + '): GetItem failed — ' + err.message);
      counts.ERROR++;
      continue;
    }

    console.log(classification.padEnd(10) + ' ' + item.PK + ' ' + item.SK);
    counts[classification]++;

    // Write only if live and classification indicates a change.
    if (!dryRun && (classification === 'INSERT' || classification === 'OVERWRITE')) {
      try {
        await docClient.send(new PutCommand({ TableName: tableName, Item: item }));
      } catch (err) {
        console.error('  → PutItem failed: ' + err.message);
        counts.ERROR++;
      }
    }
  }

  console.log('');
  console.log('=== Summary ===');
  console.log('  INSERT:     ' + counts.INSERT);
  console.log('  OVERWRITE:  ' + counts.OVERWRITE);
  console.log('  UNCHANGED:  ' + counts.UNCHANGED);
  if (counts.ERROR) console.log('  ERRORS:     ' + counts.ERROR);
  console.log('  TOTAL READ: ' + (counts.INSERT + counts.OVERWRITE + counts.UNCHANGED));
  if (dryRun) {
    console.log('');
    console.log('DRY RUN COMPLETE — no writes performed. Re-run without --dry-run to apply.');
  } else {
    console.log('');
    console.log('RESTORE COMPLETE — ' + (counts.INSERT + counts.OVERWRITE) + ' items written.');
  }

  process.exit(counts.ERROR ? 1 : 0);
}

main().catch(function (err) {
  console.error('Fatal:', err && err.stack ? err.stack : err);
  process.exit(1);
});
