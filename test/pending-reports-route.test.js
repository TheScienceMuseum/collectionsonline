'use strict';

// Route-level tests for the admin list's Pending reports view
// (/admin/ai?pending=1). The stores the route calls are patched per test —
// and createServer() never initialises the real DynamoDB clients (that
// happens in bin/server.mjs) — so nothing here can reach AWS.
//
// Not named ai-*: tape runs every file in one process, alphabetically, and
// ai-biography-store / ai-curator-decisions-store swap in fake dynamo and
// flag-store modules via require.cache. Loading the server first would bind
// the real ones under them, so this file sorts after them (as the other
// server tests do). It then sees those fakes too, which don't define every
// method — hence patch() rather than sinon.stub().

const testWithServer = require('./helpers/test-with-server');
const adminAuth = require('../lib/ai/admin-auth');
const dynamo = require('../lib/ai/dynamo');
const flagStore = require('../lib/ai/flag-store');
const biographyStore = require('../lib/ai/biography-store');
const dashboardStats = require('../lib/ai/dashboard-stats');

// The real flag-store, loaded past any fake in require.cache — the list
// route needs its (pure) buildView, which the fakes don't provide.
const realFlagStore = (function () {
  const p = require.resolve('../lib/ai/flag-store');
  const cached = require.cache[p];
  delete require.cache[p];
  const real = require(p);
  if (cached) require.cache[p] = cached;
  return real;
})();

function biographyItem (pk, status) {
  return { entityType: 'BIOGRAPHY', PK: pk, SK: 'BIOGRAPHY', status, personName: 'Person ' + pk, generatedAt: '2026-10-01T00:00:00.000Z' };
}

function flagsItem (pk, pending, total) {
  return { entityType: 'PUBLIC_FLAG', PK: pk, SK: 'FLAGS', pendingFlags: pending, totalFlags: total, count_other: total, count_pending_other: pending };
}

const BIOS = {
  cp1: biographyItem('cp1', 'flagged'),
  cp2: biographyItem('cp2', 'hidden'),
  cp3: biographyItem('cp3', 'hidden'),
  cp4: biographyItem('cp4', 'live')
};

const FLAGS = {
  cp1: flagsItem('cp1', 2, 2),
  cp2: flagsItem('cp2', 3, 3),
  cp3: flagsItem('cp3', 0, 4) // hidden, reviewed
};

// Replace obj[name] until the test ends; restores (or deletes) on teardown.
function patch (t, obj, name, value) {
  const had = Object.prototype.hasOwnProperty.call(obj, name);
  const original = obj[name];
  obj[name] = value;
  t.teardown(function () {
    if (had) obj[name] = original;
    else delete obj[name];
  });
}

// Patch the stores the admin routes call. dashboard-stats runs for real
// over a fake scan. `freshFlags` overrides the per-record getFlags read, to
// simulate a record marked as reviewed after the stats cache was built.
function stubStores (t, freshFlags) {
  dashboardStats.invalidate();
  t.teardown(function () { dashboardStats.invalidate(); });
  const getStats = dashboardStats.getStats;
  const fakeDynamo = {
    isReady: function () { return true; },
    scan: function () {
      return Promise.resolve({ items: Object.values(BIOS).concat(Object.values(FLAGS)), lastKey: null });
    }
  };
  patch(t, adminAuth, 'validateAdminToken', function () { return true; });
  patch(t, dynamo, 'isReady', function () { return true; });
  patch(t, dashboardStats, 'getStats', function (d, config) { return getStats(fakeDynamo, config); });
  patch(t, biographyStore, 'fetchBiography', function (pk) { return Promise.resolve(BIOS[pk] || null); });
  patch(t, biographyStore, 'listStaffFlags', function () { return Promise.resolve([]); });
  patch(t, biographyStore, 'listStaffNotes', function () { return Promise.resolve([]); });
  patch(t, biographyStore, 'listBiographies', function () {
    return Promise.reject(new Error('pending view must not page the status / createdAt indexes'));
  });
  patch(t, flagStore, 'buildView', realFlagStore.buildView);
  patch(t, flagStore, 'getFlags', function (pk) {
    const flags = Object.assign({}, FLAGS, freshFlags || {});
    return Promise.resolve(flags[pk] || null);
  });
}

testWithServer('Admin AI list: ?pending=1 lists records with pending reports, any status', {}, async (t, ctx) => {
  stubStores(t);
  const res = await ctx.server.inject({ method: 'GET', url: '/admin/ai?pending=1' });
  t.equal(res.statusCode, 200);
  t.ok(res.payload.indexOf('/admin/ai/cp1"') !== -1, 'flagged record with pending reports listed');
  t.ok(res.payload.indexOf('/admin/ai/cp2"') !== -1, 'hidden record with pending reports listed');
  t.equal(res.payload.indexOf('/admin/ai/cp3"'), -1, 'hidden record with reviewed reports left out');
  t.equal(res.payload.indexOf('/admin/ai/cp4"'), -1, 'record without reports left out');
  t.ok(res.payload.indexOf('reports not reviewed') !== -1, 'hidden + pending row is marked');
  t.ok(/>Unreviewed reports · 2</.test(res.payload), 'toggle counts both records');
  t.ok(res.payload.indexOf('across 1 record · 1 more on hidden') !== -1, 'Pending reports card points at the hidden one');
  t.end();
});

testWithServer('Admin AI list: ?pending=1&status=hidden narrows to hidden records', {}, async (t, ctx) => {
  stubStores(t);
  const res = await ctx.server.inject({ method: 'GET', url: '/admin/ai?pending=1&status=hidden' });
  t.equal(res.statusCode, 200);
  t.ok(res.payload.indexOf('/admin/ai/cp2"') !== -1);
  t.equal(res.payload.indexOf('/admin/ai/cp1"'), -1, 'flagged record not in the hidden view');
  t.ok(/href="\/admin\/ai\/export\.csv\?status=hidden&amp;pending&#x3D;1/.test(res.payload), 'CSV export link carries the filter');
  t.end();
});

testWithServer('Admin AI list: rows reviewed since the stats cache was built drop out', {}, async (t, ctx) => {
  stubStores(t, { cp2: flagsItem('cp2', 0, 3) });
  const res = await ctx.server.inject({ method: 'GET', url: '/admin/ai?pending=1' });
  t.equal(res.statusCode, 200);
  t.ok(res.payload.indexOf('/admin/ai/cp1"') !== -1);
  t.equal(res.payload.indexOf('/admin/ai/cp2"'), -1, 'fresh read shows no pending reports');
  t.end();
});

testWithServer('Admin AI dashboard: shows hidden-with-unresolved-reports figure', {}, async (t, ctx) => {
  stubStores(t);
  const res = await ctx.server.inject({ method: 'GET', url: '/admin/ai/dashboard' });
  t.equal(res.statusCode, 200);
  t.ok(res.payload.indexOf('Hidden with unresolved reports') !== -1);
  t.ok(/href="\/admin\/ai\?status=hidden&amp;pending=1"[^>]*>1</.test(res.payload), 'one hidden record, linked to the filtered list');
  t.end();
});
