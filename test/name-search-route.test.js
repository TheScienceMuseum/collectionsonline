'use strict';

// Route-level tests for the admin list's name search (/admin/ai?search=…).
// Same setup as pending-reports-route.test.js, and not named ai-* for the
// same reason (it must load after the ai-* files that swap modules in
// require.cache). dashboard-stats runs for real over a fake scan, so the
// name index comes from the records' personName as in production.

const testWithServer = require('./helpers/test-with-server');
const adminAuth = require('../lib/ai/admin-auth');
const dynamo = require('../lib/ai/dynamo');
const flagStore = require('../lib/ai/flag-store');
const biographyStore = require('../lib/ai/biography-store');
const dashboardStats = require('../lib/ai/dashboard-stats');
const makeFakeStatsDynamo = require('./helpers/fake-stats-dynamo').makeFakeStatsDynamo;

function bio (pk, name, generatedAt) {
  return { entityType: 'BIOGRAPHY', PK: pk, SK: 'BIOGRAPHY', status: 'live', personName: name, generatedAt };
}

// 60 newer records, then the one being searched for. Paging CreatedAtIndex
// 9 records at a time for 5 pages (the old search) never reached it.
const BIOS = {};
for (let i = 0; i < 60; i++) {
  const day = String(1 + (i % 28)).padStart(2, '0');
  BIOS['cp' + (100 + i)] = bio('cp' + (100 + i), 'Smith Number ' + i, '2026-11-' + day + 'T00:00:00.000Z');
}
BIOS.cp50270 = bio('cp50270', 'Royal Raymond Rife', '2026-10-14T00:00:00.000Z');

function patch (t, obj, name, value) {
  const had = Object.prototype.hasOwnProperty.call(obj, name);
  const original = obj[name];
  obj[name] = value;
  t.teardown(function () {
    if (had) obj[name] = original;
    else delete obj[name];
  });
}

function stubStores (t) {
  dashboardStats.invalidate();
  t.teardown(function () { dashboardStats.invalidate(); });
  const getStats = dashboardStats.getStats;
  const fakeDynamo = makeFakeStatsDynamo(Object.values(BIOS));
  const getBio = function (pk) { return Promise.resolve(BIOS[pk] || null); };
  patch(t, adminAuth, 'validateAdminToken', function () { return true; });
  patch(t, dynamo, 'isReady', function () { return true; });
  patch(t, dashboardStats, 'getStats', function (d, config) { return getStats(fakeDynamo, config); });
  patch(t, biographyStore, 'fetchBiography', getBio);
  patch(t, biographyStore, 'listStaffFlags', function () { return Promise.resolve([]); });
  patch(t, biographyStore, 'listStaffNotes', function () { return Promise.resolve([]); });
  patch(t, biographyStore, 'listBiographies', function () {
    return Promise.reject(new Error('name search must not page the status / createdAt indexes'));
  });
  patch(t, flagStore, 'getFlags', function () { return Promise.resolve(null); });
  patch(t, flagStore, 'buildView', function () { return null; });
}

testWithServer('Admin AI name search: finds a record older than the newest few dozen', {}, async (t, ctx) => {
  stubStores(t);
  const res = await ctx.server.inject({ method: 'GET', url: '/admin/ai?search=rife' });
  t.equal(res.statusCode, 200);
  t.ok(res.payload.indexOf('/admin/ai/cp50270"') !== -1, 'Royal Raymond Rife listed');
  t.equal(res.payload.indexOf('/admin/ai/cp100"'), -1, 'non-matching records left out');
  t.equal(res.payload.indexOf('Showing the'), -1, 'no "showing N of M" note for a single match');
  t.end();
});

testWithServer('Admin AI name search: more matches than the page shows says so', {}, async (t, ctx) => {
  stubStores(t);
  const res = await ctx.server.inject({ method: 'GET', url: '/admin/ai?search=smith&limit=10' });
  t.equal(res.statusCode, 200);
  const rows = (res.payload.match(/href="\/admin\/ai\/cp1\d\d"/g) || []);
  t.equal(new Set(rows).size, 10, 'first 10 matches listed');
  t.ok(res.payload.indexOf('Showing the 10 newest of 60 records whose name contains') !== -1, 'note gives the full count');
  t.end();
});

testWithServer('Admin AI name search: no match explains the index lag', {}, async (t, ctx) => {
  stubStores(t);
  const res = await ctx.server.inject({ method: 'GET', url: '/admin/ai?search=nobody+here' });
  t.equal(res.statusCode, 200);
  t.ok(res.payload.indexOf('No biography records have a name containing') !== -1, 'name-search empty message');
  t.ok(res.payload.indexOf('search by its ID') !== -1, 'points at ID search');
  t.end();
});
