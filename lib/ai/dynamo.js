'use strict';

const DynamoDBClient = require('@aws-sdk/client-dynamodb').DynamoDBClient;
const DynamoDBDocumentClient = require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient;
const GetCommand = require('@aws-sdk/lib-dynamodb').GetCommand;
const PutCommand = require('@aws-sdk/lib-dynamodb').PutCommand;
const UpdateCommand = require('@aws-sdk/lib-dynamodb').UpdateCommand;
const DeleteCommand = require('@aws-sdk/lib-dynamodb').DeleteCommand;
const QueryCommand = require('@aws-sdk/lib-dynamodb').QueryCommand;
const ScanCommand = require('@aws-sdk/lib-dynamodb').ScanCommand;

let docClient = null;
let tableName = null;
let ready = false;

const NULL_DYNAMO = {
  get: function () { return Promise.resolve(null); },
  put: function () { return Promise.resolve(); },
  update: function () { return Promise.resolve(); },
  delete: function () { return Promise.resolve(); },
  queryByStatus: function () { return Promise.resolve({ items: [], lastKey: null }); },
  queryByCreatedAt: function () { return Promise.resolve({ items: [], lastKey: null }); },
  queryByPkPrefix: function () { return Promise.resolve({ items: [], lastKey: null }); },
  scan: function () { return Promise.resolve({ items: [], lastKey: null }); },
  isReady: function () { return false; }
};

function init (config) {
  const dynamoConfig = config.dynamodb || {};
  tableName = dynamoConfig.tableName || 'collectionsonline-ai';

  const clientConfig = {
    region: dynamoConfig.region || 'eu-west-1'
  };

  if (dynamoConfig.endpoint) {
    clientConfig.endpoint = dynamoConfig.endpoint;
  }

  try {
    const client = new DynamoDBClient(clientConfig);
    docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true }
    });
    ready = true;
  } catch (err) {
    console.warn('DynamoDB client init failed:', err.message);
    ready = false;
  }
}

function get (pk, sk) {
  if (!ready) return NULL_DYNAMO.get();
  return docClient.send(new GetCommand({
    TableName: tableName,
    Key: { PK: pk, SK: sk }
  })).then(function (result) {
    return result.Item || null;
  });
}

function put (item) {
  if (!ready) return NULL_DYNAMO.put();
  item.updatedAt = new Date().toISOString();
  return docClient.send(new PutCommand({
    TableName: tableName,
    Item: item
  }));
}

function update (pk, sk, attrs) {
  if (!ready) return NULL_DYNAMO.update();

  const keys = Object.keys(attrs);
  const expressionParts = keys.map(function (k) {
    return '#' + k + ' = :' + k;
  });
  expressionParts.push('#updatedAt = :updatedAt');

  const names = {};
  const values = {};
  keys.forEach(function (k) {
    names['#' + k] = k;
    values[':' + k] = attrs[k];
  });
  names['#updatedAt'] = 'updatedAt';
  values[':updatedAt'] = new Date().toISOString();

  return docClient.send(new UpdateCommand({
    TableName: tableName,
    Key: { PK: pk, SK: sk },
    UpdateExpression: 'SET ' + expressionParts.join(', '),
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values
  }));
}

function del (pk, sk) {
  if (!ready) return NULL_DYNAMO.delete();
  return docClient.send(new DeleteCommand({
    TableName: tableName,
    Key: { PK: pk, SK: sk }
  }));
}

function queryByStatus (status, limit, lastKey) {
  if (!ready) return NULL_DYNAMO.queryByStatus();
  // StatusIndex: PK=status, SK=updatedAt. Only canonical BIOGRAPHY items
  // carry `status` so snapshots/notes/ratings don't project into this GSI.
  // Sort descending by updatedAt so the most recently changed records in
  // each status group appear first — a natural triage queue.
  const params = {
    TableName: tableName,
    IndexName: 'StatusIndex',
    KeyConditionExpression: '#status = :status',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':status': status },
    ScanIndexForward: false,
    Limit: limit || 25
  };
  if (lastKey) {
    params.ExclusiveStartKey = lastKey;
  }
  return docClient.send(new QueryCommand(params)).then(function (result) {
    return { items: result.Items || [], lastKey: result.LastEvaluatedKey || null };
  });
}

/**
 * Query all items under a given partition key with a sort-key prefix.
 * Used for fetching history snapshots (SK=HISTORY#*) or staff notes
 * (SK=STAFF_NOTE#*) for a specific biography. Returns items in ascending
 * SK order (which is chronological because SKs are ISO timestamps).
 */
function queryByPkPrefix (pk, skPrefix) {
  if (!ready) return Promise.resolve({ items: [], lastKey: null });
  const params = {
    TableName: tableName,
    KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :skPrefix)',
    ExpressionAttributeNames: { '#pk': 'PK', '#sk': 'SK' },
    ExpressionAttributeValues: { ':pk': pk, ':skPrefix': skPrefix }
  };
  return docClient.send(new QueryCommand(params)).then(function (result) {
    return { items: result.Items || [], lastKey: result.LastEvaluatedKey || null };
  });
}

/**
 * Query the CreatedAtIndex GSI — returns biographies in reverse chronological
 * order (latest first) across all statuses, with native cursor pagination.
 * Uses a constant partition key (entityType='BIOGRAPHY') so every biography
 * lives in the same partition, sorted by generatedAt.
 */
function queryByCreatedAt (limit, lastKey) {
  if (!ready) return NULL_DYNAMO.queryByCreatedAt();
  const params = {
    TableName: tableName,
    IndexName: 'CreatedAtIndex',
    KeyConditionExpression: '#entityType = :entityType',
    ExpressionAttributeNames: { '#entityType': 'entityType' },
    ExpressionAttributeValues: { ':entityType': 'BIOGRAPHY' },
    ScanIndexForward: false,
    Limit: limit || 25
  };
  if (lastKey) {
    params.ExclusiveStartKey = lastKey;
  }
  return docClient.send(new QueryCommand(params)).then(function (result) {
    return { items: result.Items || [], lastKey: result.LastEvaluatedKey || null };
  });
}

function scan (limit, lastKey) {
  if (!ready) return NULL_DYNAMO.scan();
  const params = {
    TableName: tableName,
    Limit: limit || 25
  };
  if (lastKey) {
    params.ExclusiveStartKey = lastKey;
  }
  return docClient.send(new ScanCommand(params)).then(function (result) {
    return { items: result.Items || [], lastKey: result.LastEvaluatedKey || null };
  });
}

function isReady () {
  return ready;
}

module.exports = {
  init,
  get,
  put,
  update,
  delete: del,
  queryByStatus,
  queryByCreatedAt,
  queryByPkPrefix,
  scan,
  isReady,
  NULL_DYNAMO
};
