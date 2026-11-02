'use strict';

// Tests for the optional visitor note on the public "Report a problem"
// route (routes/ai-biography.js) and the flagMessageEnabled switch on the
// public biography response.
//
// Stores and the renderer are stubbed in the require cache while the route
// module loads, then the previous cache entries are put back so other test
// files see what they expect.

const test = require('tape');

const submitted = [];
const fakeFlagStore = {
  isValidReason: function (r) { return ['factually_incorrect', 'offensive', 'doesnt_match', 'other'].indexOf(r) !== -1; },
  isReady: function () { return true; },
  submitFlag: function (id, reason, generatedAt, message) {
    submitted.push({ id, reason, generatedAt, message });
    return Promise.resolve({});
  }
};
const fakeBiographyStore = {
  fetchBiography: function (id) {
    return Promise.resolve({ PK: id, status: 'flagged', generatedAt: 'gen-1', sentences: [{ text: 'x' }] });
  },
  updateStatus: function () { return Promise.resolve(); }
};
const stubs = {
  '../lib/ai/flag-store': fakeFlagStore,
  '../lib/ai/biography-store': fakeBiographyStore,
  '../lib/ai/dynamo': { isReady: function () { return true; } },
  '../lib/ai/curator-decisions-store': { get: function () { return Promise.resolve(null); } },
  '../lib/ai/render-biography': function () { return { biographyHtml: '<p>x</p>', contextHtml: '', sources: [] }; }
};

const saved = {};
Object.keys(stubs).forEach(function (rel) {
  const p = require.resolve(rel);
  saved[p] = require.cache[p];
  require.cache[p] = { id: p, filename: p, loaded: true, exports: stubs[rel] };
});
const routePath = require.resolve('../routes/ai-biography');
const savedRoute = require.cache[routePath];
delete require.cache[routePath];
const aiBiographyRoutes = require('../routes/ai-biography');
if (savedRoute) require.cache[routePath] = savedRoute; else delete require.cache[routePath];
Object.keys(saved).forEach(function (p) {
  if (saved[p]) require.cache[p] = saved[p]; else delete require.cache[p];
});

const BASE_CONFIG = {
  aiBiographyEnabled: true,
  aiBiographyPublicFlagEnabled: true,
  aiBiographyPublicDisplayEnabled: true,
  aiBiographySuppressExistingChars: 0
};

function routesFor (overrides) {
  const config = Object.assign({}, BASE_CONFIG, overrides);
  const routes = aiBiographyRoutes(null, config);
  return {
    flag: routes.find(function (r) { return r.method === 'POST'; }),
    biography: routes.find(function (r) { return r.method === 'GET'; })
  };
}

function fakeH () {
  return {
    response: function (body) {
      return {
        body,
        statusCode: 200,
        code: function (c) { this.statusCode = c; return this; },
        state: function () { return this; },
        type: function () { return this; },
        header: function () { return this; }
      };
    }
  };
}

function post (route, payload) {
  return route.config.handler({ params: { id: 'cp1' }, payload }, fakeH());
}

test('flag route: payload capped at 4 KB', function (t) {
  t.equal(routesFor().flag.config.payload.maxBytes, 4096);
  t.end();
});

test('flag route: note ignored while the message switch is off', async function (t) {
  submitted.length = 0;
  const res = await post(routesFor({ aiBiographyPublicFlagMessageEnabled: false }).flag, {
    reason: 'other', message: 'x'.repeat(500)
  });
  t.equal(res.statusCode, 200, 'over-long note does not matter when off');
  t.equal(submitted.length, 1);
  t.equal(submitted[0].message, null, 'nothing stored');
  t.end();
});

test('flag route: note cleaned before storage when the switch is on', async function (t) {
  submitted.length = 0;
  const res = await post(routesFor({ aiBiographyPublicFlagMessageEnabled: true }).flag, {
    reason: 'factually_incorrect', message: '<b>Wrong</b> - see https://en.wikipedia.org/wiki/X?u=a@b.com'
  });
  t.equal(res.statusCode, 200);
  t.equal(submitted[0].message, 'Wrong - see [link: en.wikipedia.org]');
  t.equal(submitted[0].reason, 'factually_incorrect');
  t.end();
});

test('flag route: over-long note rejected and nothing stored', async function (t) {
  submitted.length = 0;
  const res = await post(routesFor({ aiBiographyPublicFlagMessageEnabled: true }).flag, {
    reason: 'other', message: 'x'.repeat(201)
  });
  t.equal(res.statusCode, 400);
  t.equal(submitted.length, 0);
  t.end();
});

test('flag route: link spam still counts the report but drops the note', async function (t) {
  submitted.length = 0;
  const res = await post(routesFor({ aiBiographyPublicFlagMessageEnabled: true }).flag, {
    reason: 'other', message: 'a.com b.com c.com'
  });
  t.equal(res.statusCode, 200);
  t.equal(submitted.length, 1, 'report counted');
  t.equal(submitted[0].message, null, 'note dropped');
  t.end();
});

test('flag route: no note is fine when the switch is on', async function (t) {
  submitted.length = 0;
  const res = await post(routesFor({ aiBiographyPublicFlagMessageEnabled: true }).flag, { reason: 'offensive' });
  t.equal(res.statusCode, 200);
  t.equal(submitted[0].message, null);
  t.end();
});

test('biography route: flagMessageEnabled needs both switches', async function (t) {
  const get = function (overrides) {
    return routesFor(overrides).biography.config.handler({ params: { id: 'cp1' } }, fakeH());
  };
  t.equal((await get({ aiBiographyPublicFlagMessageEnabled: true })).body.flagMessageEnabled, true);
  t.equal((await get({ aiBiographyPublicFlagMessageEnabled: false })).body.flagMessageEnabled, false);
  t.equal((await get({ aiBiographyPublicFlagEnabled: false, aiBiographyPublicFlagMessageEnabled: true })).body.flagMessageEnabled, false,
    'note box never shown without the report button');
  t.end();
});
