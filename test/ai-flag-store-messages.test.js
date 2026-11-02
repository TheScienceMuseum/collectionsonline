'use strict';

// Tests for visitor notes on the public FLAGS item (lib/ai/flag-store.js):
// stored after the counters, capped at MAX_PENDING_MESSAGES, deleted on
// Mark as reviewed, and exposed to the admin view by buildView.
//
// The DynamoDB document client is replaced with a fake that records each
// command's input, so no AWS calls are made. ai-biography-store.test.js
// stubs flag-store in the require cache, so a fresh copy is loaded here
// and the cache entry put back afterwards.

const test = require('tape');
const libDynamodb = require('@aws-sdk/lib-dynamodb');

const sent = [];
let respond = function () { return Promise.resolve({ Attributes: { PK: 'cp1' } }); };
const fakeDocClient = {
  send: function (command) {
    sent.push(command.input);
    return respond(command.input, sent.length);
  }
};

const flagStorePath = require.resolve('../lib/ai/flag-store');
const cached = require.cache[flagStorePath];
delete require.cache[flagStorePath];
const flagStore = require('../lib/ai/flag-store');
if (cached) require.cache[flagStorePath] = cached;

const realFrom = libDynamodb.DynamoDBDocumentClient.from;
libDynamodb.DynamoDBDocumentClient.from = function () { return fakeDocClient; };
flagStore.init({ dynamodb: { tableName: 'test-table', region: 'eu-west-1' } });
libDynamodb.DynamoDBDocumentClient.from = realFrom;

function reset (responder) {
  sent.length = 0;
  respond = responder || function () { return Promise.resolve({ Attributes: { PK: 'cp1' } }); };
}

function conditionalFailure () {
  const err = new Error('The conditional request failed');
  err.name = 'ConditionalCheckFailedException';
  return Promise.reject(err);
}

test('flag-store: submitFlag without a note is a single counter update', async function (t) {
  reset();
  await flagStore.submitFlag('cp1', 'other', '2026-10-01T00:00:00Z');
  t.equal(sent.length, 1);
  t.ok(/^ADD totalFlags/.test(sent[0].UpdateExpression), 'counter update');
  t.end();
});

test('flag-store: submitFlag with a note appends { text, reason, at } and nothing else', async function (t) {
  reset();
  const out = await flagStore.submitFlag('cp1', 'factually_incorrect', '2026-10-01T00:00:00Z', 'Died 1921, not 1912.');
  t.equal(sent.length, 2, 'counters, then note');
  const append = sent[1];
  t.deepEqual(append.Key, { PK: 'cp1', SK: 'FLAGS' });
  t.ok(/list_append\(if_not_exists\(pendingMessages, :empty\), :entry\)/.test(append.UpdateExpression));
  t.ok(/size\(pendingMessages\) < :max/.test(append.ConditionExpression), 'capped by condition');
  t.equal(append.ExpressionAttributeValues[':max'], flagStore.MAX_PENDING_MESSAGES);
  const entry = append.ExpressionAttributeValues[':entry'][0];
  t.deepEqual(Object.keys(entry).sort(), ['at', 'reason', 'text'], 'no identifying fields');
  t.equal(entry.text, 'Died 1921, not 1912.');
  t.equal(entry.reason, 'factually_incorrect');
  t.deepEqual(out, { PK: 'cp1' }, 'resolves with the counter attributes');
  t.end();
});

test('flag-store: a full note list counts the note as dropped instead', async function (t) {
  reset(function (input, n) { return n === 2 ? conditionalFailure() : Promise.resolve({ Attributes: {} }); });
  await flagStore.submitFlag('cp1', 'other', 'g', 'eleventh note');
  t.equal(sent.length, 3);
  t.equal(sent[2].UpdateExpression, 'ADD droppedMessages :one');
  t.end();
});

test('flag-store: a failure storing the note does not fail the report', async function (t) {
  reset(function (input, n) { return n === 2 ? Promise.reject(new Error('throttled')) : Promise.resolve({ Attributes: { PK: 'cp1' } }); });
  const warn = console.warn;
  console.warn = function () {};
  try {
    const out = await flagStore.submitFlag('cp1', 'other', 'g', 'note');
    t.deepEqual(out, { PK: 'cp1' }, 'counters still reported');
  } finally {
    console.warn = warn;
  }
  t.end();
});

test('flag-store: clearPending deletes notes and resets the dropped count', async function (t) {
  reset(function () { return Promise.resolve({}); });
  await flagStore.clearPending('cp1', { reviewer: 'staff' });
  t.equal(sent.length, 1);
  t.ok(/ REMOVE pendingMessages$/.test(sent[0].UpdateExpression), 'notes removed');
  t.ok(/droppedMessages = :zero/.test(sent[0].UpdateExpression), 'dropped count reset');
  t.ok(/pendingFlags = :zero/.test(sent[0].UpdateExpression), 'pending counter still cleared');
  t.end();
});

test('flag-store: buildView exposes notes with reason labels', function (t) {
  const view = flagStore.buildView({
    totalFlags: 3,
    pendingFlags: 2,
    pendingMessages: [
      { text: 'Wrong birth year.', reason: 'factually_incorrect', at: '2026-11-01T10:00:00Z' },
      { text: '', reason: 'other', at: '2026-11-01T11:00:00Z' },
      null,
      { text: 'Not him.', reason: 'unknown_reason' }
    ],
    droppedMessages: 4
  });
  t.deepEqual(view.messages, [
    { text: 'Wrong birth year.', reasonLabel: 'Factually incorrect', at: '2026-11-01T10:00:00Z' },
    { text: 'Not him.', reasonLabel: '', at: null }
  ], 'empty / malformed entries skipped');
  t.equal(view.droppedMessages, 4);
  t.equal(view.maxMessages, flagStore.MAX_PENDING_MESSAGES);
  t.equal(view.canMarkReviewed, true);
  t.end();
});

test('flag-store: buildView offers Mark as reviewed while notes remain, even with no pending count', function (t) {
  const withNotes = flagStore.buildView({ totalFlags: 1, pendingFlags: 0, pendingMessages: [{ text: 'x', reason: 'other' }] });
  t.equal(withNotes.canMarkReviewed, true);
  const reviewed = flagStore.buildView({ totalFlags: 1, pendingFlags: 0 });
  t.equal(reviewed.canMarkReviewed, false);
  t.deepEqual(reviewed.messages, []);
  t.end();
});
