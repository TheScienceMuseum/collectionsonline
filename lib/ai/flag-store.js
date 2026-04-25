'use strict';

// Public "Report a problem" flag counters.
//
// Stored as a single aggregate item per biography record under SK=FLAGS.
// No individual flag rows are kept — just counters by reason code — which
// sidesteps GDPR exposure (no IPs, no cookie hashes stored in DynamoDB) and
// keeps storage effectively constant regardless of flag volume.
//
// Counters are TOP-LEVEL attributes (count_<reason>, count_pending_<reason>)
// rather than nested in a map, so we can use DynamoDB's atomic ADD to
// increment multiple counters in a single round-trip.
//
// Concepts:
//   LIFETIME   — count_<reason>, totalFlags. Never reset. Historical context.
//   PENDING    — count_pending_<reason>, pendingFlags. Cleared ONLY when the
//                staff member explicitly clicks "Mark as reviewed". Headline on
//                the admin UI.
//   PRE-BIO MARKER — pendingFromPreviousBio (boolean). Set true when the
//                biography is regenerated while pending flags exist, so the
//                admin UI can show "⚠ some pending flags were submitted
//                against an earlier biography". Cleared by Mark as reviewed.
//
// Regenerating does NOT clear pending flags. A new biography may or may not
// address the underlying issue, and a silent clear loses the audit trail.
// The pre-bio marker tells the next staff member "check whether these still apply".
//
// `reviewedAt` / `reviewedBy` are stored on Mark as reviewed for audit.

const DynamoDBClient = require('@aws-sdk/client-dynamodb').DynamoDBClient;
const DynamoDBDocumentClient = require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient;
const GetCommand = require('@aws-sdk/lib-dynamodb').GetCommand;
const UpdateCommand = require('@aws-sdk/lib-dynamodb').UpdateCommand;
const DeleteCommand = require('@aws-sdk/lib-dynamodb').DeleteCommand;

const SK = 'FLAGS';

const VALID_REASONS = [
  'factually_incorrect',
  'offensive',
  'doesnt_match',
  'other'
];

const REASON_LABELS = {
  factually_incorrect: 'Factually incorrect',
  offensive: 'Offensive',
  doesnt_match: "Doesn't match the person / org",
  other: 'Other'
};

let docClient = null;
let tableName = null;
let ready = false;

function init (config) {
  // Flag-store shares the base table with biography-store — same DynamoDB
  // client config.
  const dynamoConfig = config.dynamodb || {};
  tableName = dynamoConfig.tableName || 'collectionsonline-ai';
  const clientConfig = { region: dynamoConfig.region || 'eu-west-1' };
  if (dynamoConfig.endpoint) clientConfig.endpoint = dynamoConfig.endpoint;
  try {
    const client = new DynamoDBClient(clientConfig);
    docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true }
    });
    ready = true;
  } catch (err) {
    console.warn('Flag store init failed:', err.message);
    ready = false;
  }
}

function isReady () { return ready; }

function isValidReason (reason) {
  return VALID_REASONS.indexOf(reason) !== -1;
}

/**
 * Increment counters atomically for a submitted public flag.
 * currentBioGeneratedAt — the generatedAt of the canonical biography the
 * visitor was looking at. Used to check "has the biography been regenerated
 * since this flag counter was last reset?" on the read side.
 */
function submitFlag (id, reason, currentBioGeneratedAt) {
  if (!ready) return Promise.resolve(null);
  if (!isValidReason(reason)) {
    return Promise.reject(new Error('Invalid flag reason: ' + reason));
  }

  const now = new Date().toISOString();
  const countAttr = 'count_' + reason; // lifetime
  const pendingCountAttr = 'count_pending_' + reason; // cleared on regen OR mark-reviewed

  // Atomic increment: ADD handles "attribute doesn't exist yet" automatically
  // by treating it as zero.
  return docClient.send(new UpdateCommand({
    TableName: tableName,
    Key: { PK: id, SK },
    UpdateExpression:
      'ADD totalFlags :one, pendingFlags :one, #cnt :one, #pendCnt :one ' +
      'SET lastFlaggedAt = :now, ' +
      'entityType = if_not_exists(entityType, :etype), ' +
      'currentBioGeneratedAt = if_not_exists(currentBioGeneratedAt, :currGen)',
    ExpressionAttributeNames: { '#cnt': countAttr, '#pendCnt': pendingCountAttr },
    ExpressionAttributeValues: {
      ':one': 1,
      ':now': now,
      ':etype': 'PUBLIC_FLAG',
      ':currGen': currentBioGeneratedAt || ''
    },
    ReturnValues: 'ALL_NEW'
  })).then(function (result) {
    return result.Attributes || null;
  });
}

function getFlags (id) {
  if (!ready) return Promise.resolve(null);
  return docClient.send(new GetCommand({
    TableName: tableName,
    Key: { PK: id, SK }
  })).then(function (result) {
    return result.Item || null;
  });
}

/**
 * Clear pending counters. Called only when the staff member explicitly clicks
 * "Mark as reviewed" — the action that says "I've looked at all pending
 * flags and decided what to do (if anything)". Lifetime counters preserved.
 *
 * Also clears the pre-bio marker because "reviewed" means reviewed across
 * all biographies that produced these flags.
 *
 * No-op if no FLAGS item exists yet for this record.
 */
function clearPending (id, opts) {
  if (!ready) return Promise.resolve(null);
  opts = opts || {};

  const sets = ['pendingFlags = :zero', 'pendingFromPreviousBio = :false'];
  const names = {};
  const values = { ':zero': 0, ':false': false };
  VALID_REASONS.forEach(function (r, i) {
    const placeholder = '#p' + i;
    names[placeholder] = 'count_pending_' + r;
    sets.push(placeholder + ' = :zero');
  });

  if (opts.reviewer) {
    sets.push('reviewedAt = :now', 'reviewedBy = :reviewer');
    values[':now'] = new Date().toISOString();
    values[':reviewer'] = opts.reviewer;
  }

  return docClient.send(new UpdateCommand({
    TableName: tableName,
    Key: { PK: id, SK },
    UpdateExpression: 'SET ' + sets.join(', '),
    ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
    ExpressionAttributeValues: values,
    ConditionExpression: 'attribute_exists(PK)'
  })).then(
    function (result) { return result; },
    function (err) {
      if (err.name === 'ConditionalCheckFailedException') return null;
      throw err;
    }
  );
}

/**
 * Called when the canonical biography is regenerated. Pending flag counters
 * are NOT reset (staff member hasn't reviewed them). Instead, if any pending
 * flags exist, mark them as "from a previous biography version" so the
 * admin UI can warn the next reviewer that the content they're looking at
 * is different from what was flagged.
 *
 * No-op if no FLAGS item exists or no pending flags.
 */
function markPendingStale (id, newGeneratedAt) {
  if (!ready) return Promise.resolve(null);
  return docClient.send(new UpdateCommand({
    TableName: tableName,
    Key: { PK: id, SK },
    UpdateExpression:
      'SET pendingFromPreviousBio = :true, currentBioGeneratedAt = :newGen',
    ExpressionAttributeValues: {
      ':true': true,
      ':newGen': newGeneratedAt,
      ':zero': 0
    },
    ConditionExpression: 'attribute_exists(PK) AND pendingFlags > :zero'
  })).then(
    function (result) { return result; },
    function (err) {
      if (err.name === 'ConditionalCheckFailedException') return null;
      throw err;
    }
  );
}

function deleteFlags (id) {
  if (!ready) return Promise.resolve(null);
  return docClient.send(new DeleteCommand({
    TableName: tableName,
    Key: { PK: id, SK }
  }));
}

/**
 * Build a view-model from a raw FLAGS item for admin UI use.
 * Returns null if no flags exist on this record.
 *
 * Headline is `pendingFlags` + `pendingCounts` (reason breakdown). That's
 * what needs staff attention. Lifetime data is returned alongside as
 * muted/historical context.
 */
function buildView (raw) {
  if (!raw || !raw.totalFlags) return null;

  const pendingCounts = VALID_REASONS.map(function (r) {
    return {
      reason: r,
      label: REASON_LABELS[r],
      count: raw['count_pending_' + r] || 0
    };
  }).filter(function (c) { return c.count > 0; });

  const lifetimeCounts = VALID_REASONS.map(function (r) {
    return {
      reason: r,
      label: REASON_LABELS[r],
      count: raw['count_' + r] || 0
    };
  }).filter(function (c) { return c.count > 0; });

  // "From previous biography" only makes sense if there are actually pending
  // flags. If pendingFlags is 0 the marker is irrelevant noise.
  const pendingFromPreviousBio = !!(raw.pendingFromPreviousBio && (raw.pendingFlags || 0) > 0);

  return {
    pendingFlags: raw.pendingFlags || 0,
    pendingCounts,
    pendingFromPreviousBio,
    totalFlags: raw.totalFlags || 0,
    lifetimeCounts,
    currentBioGeneratedAt: raw.currentBioGeneratedAt || null,
    lastFlaggedAt: raw.lastFlaggedAt || null,
    reviewedAt: raw.reviewedAt || null,
    reviewedBy: raw.reviewedBy || null
  };
}

module.exports = {
  init,
  isReady,
  isValidReason,
  submitFlag,
  getFlags,
  clearPending,
  markPendingStale,
  deleteFlags,
  buildView,
  VALID_REASONS,
  REASON_LABELS
};
