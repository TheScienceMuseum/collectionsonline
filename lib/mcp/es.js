'use strict';

// Thin guard around Elasticsearch for MCP tools:
//  - caps how many heavy aggregation queries run at once per instance, so a
//    burst of agent group-bys can't pile onto ES (rate limiting itself is
//    CloudFront WAF's job);
//  - flags results that may be incomplete (timeouts, shard failures) instead
//    of presenting them as exact;
//  - turns ES failures into short messages that are safe to show the agent.

const config = require('../../config');
const { ToolError } = require('./errors');

const TIMEOUT = '8s';
const REQUEST_TIMEOUT = 10000;
const QUEUE_WAIT_MS = 2000;

const maxHeavy = () => parseInt(config.mcpMaxConcurrentAggregations, 10) || 3;

let active = 0;
const queue = [];

const acquire = () => new Promise((resolve, reject) => {
  if (active < maxHeavy()) {
    active++;
    return resolve();
  }
  const entry = { resolve };
  entry.timer = setTimeout(() => {
    queue.splice(queue.indexOf(entry), 1);
    reject(new ToolError('The collection is busy answering other questions. Please retry in a few seconds.'));
  }, QUEUE_WAIT_MS);
  queue.push(entry);
});

const release = () => {
  const next = queue.shift();
  if (next) {
    clearTimeout(next.timer);
    next.resolve();
  } else {
    active--;
  }
};

const isExact = (body) => !body.timed_out &&
  !(body._shards && body._shards.failed > 0) &&
  !(body.hits && body.hits.total && body.hits.total.relation && body.hits.total.relation !== 'eq');

const toToolError = (error) => {
  if (error instanceof ToolError) return error;
  const status = error.meta && error.meta.statusCode;
  console.error('MCP elasticsearch error:', {
    name: error.name,
    status,
    message: error.message,
    reason: error.meta && error.meta.body && error.meta.body.error
  });
  if (error.name === 'TimeoutError' || (error.message || '').includes('timed out')) {
    return new ToolError('The query took too long. Try narrowing it with more filters.');
  }
  if (status === 400) {
    return new ToolError('The collection search could not run that query. Check the filter values.');
  }
  return new ToolError('The collection search service is unavailable right now. Please retry shortly.');
};

/**
 * Run fn(elastic) with the heavy-query cap and error mapping applied.
 * @param {Function} fn - async () => ES response
 * @param {Object} opts - { heavy: true for aggregation-heavy queries }
 */
const guarded = async (fn, { heavy = false } = {}) => {
  if (heavy) await acquire();
  try {
    const res = await fn();
    return { body: res.body, exact: isExact(res.body) };
  } catch (error) {
    throw toToolError(error);
  } finally {
    if (heavy) release();
  }
};

/** POST /_search with the MCP timeouts. */
const search = (elastic, body, opts = {}) => guarded(() => elastic.search({
  index: config.elasticIndex,
  body: Object.assign({ timeout: TIMEOUT }, body)
}, { requestTimeout: REQUEST_TIMEOUT }), opts);

/** GET one record by id; resolves to null when it doesn't exist. */
const get = async (elastic, id) => {
  try {
    const res = await elastic.get({ index: config.elasticIndex, id }, { requestTimeout: REQUEST_TIMEOUT });
    return res.body;
  } catch (error) {
    if (error.meta && error.meta.statusCode === 404) return null;
    throw toToolError(error);
  }
};

module.exports = {
  guarded,
  search,
  get,
  TIMEOUT,
  REQUEST_TIMEOUT,
  // for tests
  _state: () => ({ active, queued: queue.length })
};
