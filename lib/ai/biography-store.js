'use strict';

const dynamo = require('./dynamo');

const SK = 'BIOGRAPHY';

function fetchBiography (id) {
  return dynamo.get(id, SK).then(function (item) {
    if (!item) return null;
    if (item.status !== 'live') return null;
    return item;
  });
}

function fetchBiographyAny (id) {
  return dynamo.get(id, SK);
}

function saveBiography (id, data) {
  const item = Object.assign({}, data, {
    PK: id,
    SK,
    generatedAt: data.generatedAt || new Date().toISOString()
  });
  return dynamo.put(item);
}

function updateStatus (id, status) {
  return dynamo.update(id, SK, { status });
}

function deleteBiography (id) {
  return dynamo.delete(id, SK);
}

function listBiographies (status, limit, lastKey) {
  if (status && status !== 'all') {
    return dynamo.queryByStatus(status, limit, lastKey);
  }
  return dynamo.scan(limit, lastKey);
}

module.exports = {
  fetchBiography,
  fetchBiographyAny,
  saveBiography,
  updateStatus,
  deleteBiography,
  listBiographies
};
