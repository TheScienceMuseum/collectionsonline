'use strict';

// Tests for the admin list's Pending reports view: the shared
// "has unresolved reports" rule (lib/ai/unresolved-reports.js), the index
// dashboard-stats builds from its cached scan, and the "Hidden with
// unresolved reports" figure. Same fake-dynamo pattern as
// test/ai-dashboard-stats-reviews.test.js — no AWS SDK involved.

const test = require('tape');
const unresolvedReports = require('../lib/ai/unresolved-reports');
const dashboardStats = require('../lib/ai/dashboard-stats');

function makeFakeDynamo (items) {
  return {
    isReady: function () { return true; },
    scan: function () {
      return Promise.resolve({ items: items.slice(), lastKey: null });
    }
  };
}

const CONFIG = { aiBiographyGbpPerUsd: 0.8 };

function biographyItem (overrides) {
  return Object.assign({
    entityType: 'BIOGRAPHY',
    PK: 'cp1',
    SK: 'BIOGRAPHY',
    status: 'live',
    generatedAt: new Date().toISOString()
  }, overrides);
}

function flagsItem (overrides) {
  return Object.assign({
    entityType: 'PUBLIC_FLAG',
    PK: 'cp1',
    SK: 'FLAGS',
    totalFlags: 1,
    pendingFlags: 1,
    count_other: 1,
    count_pending_other: 1,
    lastFlaggedAt: '2026-10-20T10:00:00.000Z'
  }, overrides);
}

function staffFlagItem (overrides) {
  return Object.assign({
    entityType: 'STAFF_FLAG',
    PK: 'cp1',
    SK: 'STAFF_FLAG#staff-a',
    reason: 'inaccurate'
  }, overrides);
}

// --- hasUnresolved -----------------------------------------------------

test('unresolved-reports: pending public reports count as unresolved', function (t) {
  t.ok(unresolvedReports.hasUnresolved({ pendingReports: 2, staffFlags: 0 }));
  t.notOk(unresolvedReports.hasUnresolved({ pendingReports: 0, staffFlags: 0 }));
  t.notOk(unresolvedReports.hasUnresolved(null), 'null entry is not unresolved');
  t.end();
});

test('unresolved-reports: staff flags only count when includeStaffFlags is set', function (t) {
  const entry = { pendingReports: 0, staffFlags: 1 };
  t.notOk(unresolvedReports.hasUnresolved(entry), 'excluded by default');
  t.notOk(unresolvedReports.hasUnresolved(entry, { includeStaffFlags: false }));
  t.ok(unresolvedReports.hasUnresolved(entry, { includeStaffFlags: true }));
  t.end();
});

// --- buildIndex / filterIndex ------------------------------------------

test('unresolved-reports: buildIndex keeps records with pending reports or staff flags, any status', function (t) {
  const index = unresolvedReports.buildIndex(
    { cp1: 'live', cp2: 'hidden', cp3: 'flagged', cp4: 'insufficient_data', cp5: 'live' },
    {
      cp1: { pendingFlags: 1 },
      cp2: { pendingFlags: 3 },
      cp3: { pendingFlags: 0, totalFlags: 4 }, // all reviewed
      cp4: { pendingFlags: 2 }
    },
    { cp5: 1 }
  );
  const pks = index.map(function (e) { return e.pk; }).sort();
  t.deepEqual(pks, ['cp1', 'cp2', 'cp4', 'cp5'], 'reviewed-only record is left out');
  const cp2 = index.find(function (e) { return e.pk === 'cp2'; });
  t.equal(cp2.status, 'hidden');
  t.equal(cp2.pendingReports, 3);
  t.equal(cp2.staffFlags, 0);
  const cp5 = index.find(function (e) { return e.pk === 'cp5'; });
  t.equal(cp5.pendingReports, 0);
  t.equal(cp5.staffFlags, 1);
  t.end();
});

test('unresolved-reports: buildIndex skips flags whose biography no longer exists', function (t) {
  const index = unresolvedReports.buildIndex(
    { cp1: 'live' },
    { cp1: { pendingFlags: 1 }, cpGone: { pendingFlags: 5 } },
    { cpGone2: 2 }
  );
  t.deepEqual(index.map(function (e) { return e.pk; }), ['cp1']);
  t.end();
});

test('unresolved-reports: buildIndex sorts by pending reports, then most recently reported', function (t) {
  const index = unresolvedReports.buildIndex(
    { a: 'live', b: 'hidden', c: 'flagged', d: 'live' },
    {
      a: { pendingFlags: 1, lastFlaggedAt: '2026-10-01T00:00:00Z' },
      b: { pendingFlags: 7, lastFlaggedAt: '2026-09-01T00:00:00Z' },
      c: { pendingFlags: 1, lastFlaggedAt: '2026-10-15T00:00:00Z' }
    },
    { d: 1 }
  );
  t.deepEqual(index.map(function (e) { return e.pk; }), ['b', 'c', 'a', 'd']);
  t.end();
});

test('unresolved-reports: filterIndex applies status and the staff-flag opt-in', function (t) {
  const index = [
    { pk: 'cp1', status: 'hidden', pendingReports: 2, staffFlags: 0 },
    { pk: 'cp2', status: 'live', pendingReports: 1, staffFlags: 1 },
    { pk: 'cp3', status: 'hidden', pendingReports: 0, staffFlags: 1 }
  ];
  const pks = function (entries) { return entries.map(function (e) { return e.pk; }); };
  t.deepEqual(pks(unresolvedReports.filterIndex(index)), ['cp1', 'cp2'], 'default: public reports only, any status');
  t.deepEqual(pks(unresolvedReports.filterIndex(index, { status: 'all' })), ['cp1', 'cp2']);
  t.deepEqual(pks(unresolvedReports.filterIndex(index, { status: 'hidden' })), ['cp1']);
  t.deepEqual(pks(unresolvedReports.filterIndex(index, { status: 'hidden', includeStaffFlags: true })), ['cp1', 'cp3']);
  t.deepEqual(pks(unresolvedReports.filterIndex(index, { includeStaffFlags: true })), ['cp1', 'cp2', 'cp3']);
  t.deepEqual(unresolvedReports.filterIndex(undefined), [], 'missing index is an empty list');
  t.end();
});

// --- dashboard-stats integration ---------------------------------------

test('dashboard-stats: hidden records with pending reports are counted separately from the inbox', async function (t) {
  dashboardStats.invalidate();
  const stats = await dashboardStats.getStats(makeFakeDynamo([
    biographyItem({ PK: 'cp1', status: 'flagged' }),
    flagsItem({ PK: 'cp1', pendingFlags: 2, totalFlags: 2 }),
    biographyItem({ PK: 'cp2', status: 'hidden' }),
    flagsItem({ PK: 'cp2', pendingFlags: 3, totalFlags: 4 }),
    biographyItem({ PK: 'cp3', status: 'hidden' }),
    flagsItem({ PK: 'cp3', pendingFlags: 1, totalFlags: 1 }),
    // Hidden, all reports reviewed — not unresolved
    biographyItem({ PK: 'cp4', status: 'hidden' }),
    flagsItem({ PK: 'cp4', pendingFlags: 0, totalFlags: 5 }),
    // Insufficient data with pending reports — off the inbox, not "hidden"
    biographyItem({ PK: 'cp5', status: 'insufficient_data' }),
    flagsItem({ PK: 'cp5', pendingFlags: 1, totalFlags: 1 })
  ]), CONFIG);

  t.equal(stats.flags.pendingReports, 2, 'inbox unchanged: only live/flagged records');
  t.equal(stats.flags.pendingAcrossRecords, 1);
  t.equal(stats.flags.hiddenWithPendingReports, 2, 'two hidden records still have pending reports');
  t.equal(stats.flags.hiddenPendingReports, 4, 'sum of their pending reports');
  t.equal(stats.flags.pendingAllStatusesRecords, 4, 'every record with pending reports, any status');
  t.end();
});

test('dashboard-stats: unresolvedIndex carries status and staff-flag counts per record', async function (t) {
  dashboardStats.invalidate();
  const stats = await dashboardStats.getStats(makeFakeDynamo([
    biographyItem({ PK: 'cp1', status: 'hidden' }),
    flagsItem({ PK: 'cp1', pendingFlags: 2 }),
    biographyItem({ PK: 'cp2', status: 'flagged' }),
    staffFlagItem({ PK: 'cp2', SK: 'STAFF_FLAG#staff-a' }),
    staffFlagItem({ PK: 'cp2', SK: 'STAFF_FLAG#staff-b' }),
    biographyItem({ PK: 'cp3', status: 'live' })
  ]), CONFIG);

  t.equal(stats.unresolvedIndex.length, 2, 'records with nothing outstanding are left out');
  const byPk = {};
  stats.unresolvedIndex.forEach(function (e) { byPk[e.pk] = e; });
  t.equal(byPk.cp1.status, 'hidden');
  t.equal(byPk.cp1.pendingReports, 2);
  t.equal(byPk.cp2.staffFlags, 2, 'one per STAFF_FLAG item');
  t.equal(stats.flags.pendingAllStatusesRecords, 1, 'staff-only record not counted as pending reports');
  t.equal(stats.staff.flaggedRecords, 1, 'existing staff flagged-records count unchanged');
  t.end();
});

test('dashboard-stats: empty stats include the new fields', async function (t) {
  dashboardStats.invalidate();
  const stats = await dashboardStats.getStats({ isReady: function () { return false; } }, CONFIG);
  t.equal(stats.flags.hiddenWithPendingReports, 0);
  t.equal(stats.flags.hiddenPendingReports, 0);
  t.equal(stats.flags.pendingAllStatusesRecords, 0);
  t.deepEqual(stats.unresolvedIndex, []);
  dashboardStats.invalidate();
  t.end();
});
