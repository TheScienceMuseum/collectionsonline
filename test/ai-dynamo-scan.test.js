'use strict';

// lib/ai/dynamo.js scan(): the Scan request it builds for the optional
// projection and parallel-segment options (used by dashboard-stats).
//
// The DynamoDB document client is replaced with a fake that records each
// command's input, so no AWS calls are made. ai-biography-store.test.js
// stubs dynamo in the require cache, so a fresh copy is loaded here and the
// cache entry put back afterwards (same pattern as
// ai-flag-store-messages.test.js).

const test = require('tape');
const libDynamodb = require('@aws-sdk/lib-dynamodb');

const sent = [];
const fakeDocClient = {
  send: function (command) {
    sent.push(command.input);
    return Promise.resolve({ Items: [{ PK: 'cp1' }], LastEvaluatedKey: { PK: 'cp1', SK: 'BIOGRAPHY' } });
  }
};

const dynamoPath = require.resolve('../lib/ai/dynamo');
const cached = require.cache[dynamoPath];
delete require.cache[dynamoPath];
const dynamo = require('../lib/ai/dynamo');
if (cached) require.cache[dynamoPath] = cached;

const realFrom = libDynamodb.DynamoDBDocumentClient.from;
libDynamodb.DynamoDBDocumentClient.from = function () { return fakeDocClient; };
dynamo.init({ dynamodb: { tableName: 'test-table', region: 'eu-west-1' } });
libDynamodb.DynamoDBDocumentClient.from = realFrom;

test('dynamo.scan: without options, a plain scan as before', async function (t) {
  sent.length = 0;
  const page = await dynamo.scan(500, { PK: 'cp0', SK: 'BIOGRAPHY' });
  t.deepEqual(sent[0], {
    TableName: 'test-table',
    Limit: 500,
    ExclusiveStartKey: { PK: 'cp0', SK: 'BIOGRAPHY' }
  }, 'no projection, no segment');
  t.deepEqual(page, { items: [{ PK: 'cp1' }], lastKey: { PK: 'cp1', SK: 'BIOGRAPHY' } }, 'page shape unchanged');
  t.end();
});

test('dynamo.scan: attributes become a placeholder projection, segments a parallel scan', async function (t) {
  sent.length = 0;
  await dynamo.scan(500, null, {
    attributes: ['PK', 'status', 'count_other'],
    segment: 2,
    totalSegments: 4
  });
  const input = sent[0];
  t.equal(input.ProjectionExpression, '#p0, #p1, #p2', 'every name is a placeholder');
  t.deepEqual(input.ExpressionAttributeNames, { '#p0': 'PK', '#p1': 'status', '#p2': 'count_other' },
    'placeholders map to the names (status is a reserved word)');
  t.equal(input.Segment, 2);
  t.equal(input.TotalSegments, 4);
  t.notOk('ExclusiveStartKey' in input, 'no start key on a first page');
  t.end();
});

test('dynamo.scan: segment 0 is sent; one segment means no parallel scan', async function (t) {
  sent.length = 0;
  await dynamo.scan(500, null, { segment: 0, totalSegments: 4 });
  await dynamo.scan(500, null, { totalSegments: 1 });
  t.equal(sent[0].Segment, 0, 'segment 0 kept');
  t.notOk('Segment' in sent[1] || 'TotalSegments' in sent[1], 'single segment leaves the request alone');
  t.notOk('ProjectionExpression' in sent[1], 'no projection without attributes');
  t.end();
});
