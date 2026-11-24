'use strict';

// Fake DynamoDB for tests that run lib/ai/dashboard-stats.js. No AWS SDK.
//
// scan(limit, lastKey, opts) behaves like the real one in the ways the
// stats code depends on:
//   - parallel scan: each item comes back from exactly one segment
//   - pagination: a segment is returned a few items per page with a lastKey
//   - projection: with opts.attributes, only those top-level attributes
//     come back
// So an attribute missing from dashboard-stats' SCAN_ATTRIBUTES fails the
// tests that check the figure it feeds, instead of quietly reading as zero.
//
// `calls`, if given, collects the opts of every scan() call.

const PAGE_SIZE = 2;

function pick (item, attributes) {
  const out = {};
  attributes.forEach(function (name) {
    if (Object.prototype.hasOwnProperty.call(item, name)) out[name] = item[name];
  });
  return out;
}

function makeFakeStatsDynamo (items, calls) {
  return {
    isReady: function () { return true; },
    scan: function (limit, lastKey, opts) {
      const o = opts || {};
      if (calls) calls.push(o);
      const total = o.totalSegments || 1;
      const segment = o.segment || 0;
      const slice = items.filter(function (item, i) { return i % total === segment; });
      const start = lastKey ? lastKey.offset : 0;
      const page = slice.slice(start, start + PAGE_SIZE).map(function (item) {
        return o.attributes ? pick(item, o.attributes) : Object.assign({}, item);
      });
      const next = start + PAGE_SIZE < slice.length ? { offset: start + PAGE_SIZE } : null;
      return Promise.resolve({ items: page, lastKey: next });
    }
  };
}

module.exports = { makeFakeStatsDynamo };
