'use strict';

// Tests for lib/ai/export-csv.js — the records export honours the list
// page's Pending reports filter (?pending=1, &staff=1), and the summary
// export carries the hidden-with-unresolved-reports figure. Fake dynamo
// with a single scan page, no AWS SDK involved.

const test = require('tape');
const exportCsv = require('../lib/ai/export-csv');

function makeFakeDynamo (items) {
  return {
    isReady: function () { return true; },
    scan: function () {
      return Promise.resolve({ items: items.slice(), lastKey: null });
    }
  };
}

const CONFIG = { rootUrl: 'https://example.test' };

function biographyItem (pk, status) {
  return { entityType: 'BIOGRAPHY', PK: pk, SK: 'BIOGRAPHY', status, personName: 'Person ' + pk };
}

function flagsItem (pk, pending, total) {
  return { entityType: 'PUBLIC_FLAG', PK: pk, SK: 'FLAGS', pendingFlags: pending, totalFlags: total };
}

function staffFlagItem (pk, staff) {
  return { entityType: 'STAFF_FLAG', PK: pk, SK: 'STAFF_FLAG#' + staff, reason: 'inaccurate' };
}

const ITEMS = [
  biographyItem('cp1', 'flagged'),
  flagsItem('cp1', 2, 2),
  biographyItem('cp2', 'hidden'),
  flagsItem('cp2', 1, 3),
  biographyItem('cp3', 'hidden'),
  flagsItem('cp3', 0, 4), // reviewed
  biographyItem('cp4', 'hidden'),
  staffFlagItem('cp4', 'staff-a'),
  biographyItem('cp5', 'live')
];

// Pull the ID column out of the CSV body (column 2), skipping the header.
function ids (csv) {
  return csv.body.replace(/^\ufeff/, '').split('\r\n').slice(1)
    .filter(Boolean)
    .map(function (line) { return line.split(',')[1]; })
    .sort();
}

test('export-csv: without pending, all records for the status are exported', async function (t) {
  const csv = await exportCsv.buildRecordsCsv(makeFakeDynamo(ITEMS), CONFIG, { status: 'all' });
  t.deepEqual(ids(csv), ['cp1', 'cp2', 'cp3', 'cp4', 'cp5']);
  t.end();
});

test('export-csv: pending exports only records with unresolved public reports, any status', async function (t) {
  const csv = await exportCsv.buildRecordsCsv(makeFakeDynamo(ITEMS), CONFIG, { status: 'all', pending: true });
  t.deepEqual(ids(csv), ['cp1', 'cp2']);
  t.ok(/-pending-reports-/.test(csv.filename), 'filename says it is the pending-reports view');
  t.end();
});

test('export-csv: pending stacks with the status filter', async function (t) {
  const csv = await exportCsv.buildRecordsCsv(makeFakeDynamo(ITEMS), CONFIG, { status: 'hidden', pending: true });
  t.deepEqual(ids(csv), ['cp2'], 'hidden + still pending only');
  t.end();
});

test('export-csv: includeStaffFlags adds records with open staff flags', async function (t) {
  const csv = await exportCsv.buildRecordsCsv(makeFakeDynamo(ITEMS), CONFIG, { status: 'hidden', pending: true, includeStaffFlags: true });
  t.deepEqual(ids(csv), ['cp2', 'cp4']);
  t.end();
});

test('export-csv: includeStaffFlags is ignored without pending', async function (t) {
  const csv = await exportCsv.buildRecordsCsv(makeFakeDynamo(ITEMS), CONFIG, { status: 'hidden', includeStaffFlags: true });
  t.deepEqual(ids(csv), ['cp2', 'cp3', 'cp4']);
  t.notOk(/-pending-reports-/.test(csv.filename));
  t.end();
});

test('export-csv: summary includes hidden-with-unresolved-reports rows', function (t) {
  const stats = {
    totals: { biographies: 0, live: 0, liveSuppressed: 0, flagged: 0, hidden: 0, insufficient_data: 0 },
    subjects: { person: 0, company: 0, organisation: 0, unknown: 0 },
    flags: {
      pendingReports: 2,
      pendingAcrossRecords: 1,
      hiddenWithPendingReports: 3,
      hiddenPendingReports: 5,
      pendingAllStatusesRecords: 4,
      lifetimeReports: 9,
      topReasons: []
    },
    staff: { flaggedRecords: 0, notes: 0 },
    costs: { thisMonthFormatted: '£0', last30DaysFormatted: '£0', lifetimeFormatted: '£0', byKind: [], byModel: [], reviewsByModel: [] },
    activity: { thisWeek: 0, lastWeek: 0 },
    computedAt: '2026-11-02T00:00:00.000Z'
  };
  const body = exportCsv.buildSummaryCsv(stats).body;
  t.ok(body.indexOf('Hidden with unresolved reports (records),3') !== -1);
  t.ok(body.indexOf('Hidden with unresolved reports (reports),5') !== -1);
  t.ok(body.indexOf('Records with unreviewed reports — any status,4') !== -1);
  t.end();
});
