/**
 * Regression tests for object page query behaviour.
 *
 * These tests guard against regressions when changing:
 *   - How getSimilarObjects() builds its ES query (item 5 — searchWeights simplification)
 *   - How the object route runs its ES queries (item 8 — parallelisation)
 *
 * They verify that the object page response still contains the data users see:
 * similar objects in the included/related section and child records for parent objects.
 */

const testWithServer = require('./helpers/test-with-server');

// ─── Similar objects ──────────────────────────────────────────────────────────

testWithServer(
  'Object JSON:API response — included array is present (similar objects section)',
  {},
  async function (t, ctx) {
    t.plan(2);

    const res = await ctx.server.inject({
      method: 'GET',
      url: '/objects/co37959',
      headers: { Accept: 'application/vnd.api+json' }
    });

    const result = JSON.parse(res.payload);

    t.equal(res.statusCode, 200, 'object page returns 200');
    t.ok(Array.isArray(result.included), 'response has an included array (similar objects section)');
    t.end();
  }
);

testWithServer(
  'Object HTML page — similar objects section is rendered',
  {},
  async function (t, ctx) {
    t.plan(2);

    const res = await ctx.server.inject({
      method: 'GET',
      url: '/objects/co37959',
      headers: { Accept: 'text/html' }
    });

    t.equal(res.statusCode, 200, 'object page returns 200');
    // Similar objects are rendered inside a section with class "record-related"
    t.ok(
      res.payload.indexOf('record-related') > -1,
      'page HTML contains the record-related section (similar objects)'
    );
    t.end();
  }
);

// ─── Child records ────────────────────────────────────────────────────────────

testWithServer(
  'Object JSON:API response — child records are present for an SPH parent',
  {},
  async function (t, ctx) {
    t.plan(3);

    // co8094437 is a known SPH parent; co8244487 is its first child
    const res = await ctx.server.inject({
      method: 'GET',
      url: '/objects/co8094437',
      headers: { Accept: 'application/vnd.api+json' }
    });

    const result = JSON.parse(res.payload);

    t.equal(res.statusCode, 200, 'SPH parent page returns 200');
    t.ok(result.data.children, 'response has a children array');
    t.ok(result.data.children.length > 0, 'children array is non-empty');
    t.end();
  }
);

testWithServer(
  'Object HTML page — child records section is rendered for an SPH parent',
  {},
  async function (t, ctx) {
    t.plan(2);

    const res = await ctx.server.inject({
      method: 'GET',
      url: '/objects/co8094437',
      headers: { Accept: 'text/html' }
    });

    t.equal(res.statusCode, 200, 'SPH parent page returns 200');
    // SPH child records are rendered inside a section with class "sph-records"
    t.ok(
      res.payload.indexOf('sph-records') > -1,
      'page HTML contains the sph-records section (child records)'
    );
    t.end();
  }
);

// ─── Both together ────────────────────────────────────────────────────────────

testWithServer(
  'Object JSON:API response — both similar objects and child records are returned together',
  {},
  async function (t, ctx) {
    t.plan(3);

    // co8094437 is an SPH parent so it exercises both getSimilarObjects and getChildRecords
    const res = await ctx.server.inject({
      method: 'GET',
      url: '/objects/co8094437',
      headers: { Accept: 'application/vnd.api+json' }
    });

    const result = JSON.parse(res.payload);

    t.equal(res.statusCode, 200, 'page returns 200');
    t.ok(Array.isArray(result.included), 'included array is present (similar objects)');
    t.ok(Array.isArray(result.data.children), 'children array is present (child records)');
    t.end();
  }
);
