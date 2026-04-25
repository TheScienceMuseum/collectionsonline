'use strict';

// CSV export builders for the admin /admin/ai/export.csv route family.
//
// Two shapes:
//   buildRecordsCsv(dynamo, config, filter) — one row per biography record,
//                                             filterable by status / search /
//                                             promptVersion (matches the
//                                             list-page filter semantics).
//   buildSummaryCsv(stats)                  — Metric / Value vertical table
//                                             for management reporting.
//
// Records export: single full-table scan, aggregate per-record in memory
// (canonical + public flags + staff note/flag counts), then filter + emit.
// At <25k records this is well under 100 ms. Output is UTF-8 with a BOM so
// Excel / Sheets open £ and accented characters correctly, and uses CRLF
// line endings per RFC 4180 for maximum compatibility.

const UTF8_BOM = '\ufeff';
const CRLF = '\r\n';
const SCAN_PAGE_SIZE = 500;

// Column order chosen for scanability — reviewers want Name + Status +
// Pending reports up front; Model / Prompt / Confidence go at the end as
// "nerd columns". Public URL last so it's easy to click-through without
// distracting from the at-a-glance review.
const RECORD_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'id', label: 'ID' },
  { key: 'type', label: 'Type' },
  { key: 'status', label: 'Status' },
  { key: 'hiddenOnSite', label: 'Hidden on site?' },
  { key: 'pendingReports', label: 'Pending reports' },
  { key: 'lifetimeReports', label: 'Lifetime reports' },
  { key: 'topReportReason', label: 'Top report reason' },
  { key: 'staffFlags', label: 'Staff flags' },
  { key: 'staffNotes', label: 'Staff notes' },
  { key: 'lastGenerated', label: 'Last generated' },
  { key: 'model', label: 'Model' },
  { key: 'promptVersion', label: 'Prompt version' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'publicUrl', label: 'Public URL' }
];

async function buildRecordsCsv (dynamo, config, filter) {
  filter = filter || {};

  // Collect per-PK aggregates in a single scan. Every item contributes one
  // field or another: canonical biographies populate everything, PUBLIC_FLAG
  // items populate the report counts, STAFF_* items bump the staff counts.
  const byId = new Map();
  const ensure = function (pk) {
    if (!byId.has(pk)) {
      byId.set(pk, {
        record: null,
        publicFlags: null,
        staffFlags: 0,
        staffNotes: 0
      });
    }
    return byId.get(pk);
  };

  let lastKey = null;
  do {
    const page = await dynamo.scan(SCAN_PAGE_SIZE, lastKey);
    (page.items || []).forEach(function (item) {
      if (!item || !item.PK) return;
      const slot = ensure(item.PK);
      if (item.entityType === 'BIOGRAPHY') slot.record = item;
      else if (item.entityType === 'PUBLIC_FLAG') slot.publicFlags = item;
      else if (item.entityType === 'STAFF_FLAG') slot.staffFlags += 1;
      else if (item.entityType === 'STAFF_NOTE') slot.staffNotes += 1;
    });
    lastKey = page.lastKey;
  } while (lastKey);

  // Apply the same filters the list page does, so clicking "Export CSV" on
  // the Flagged tab exports exactly what the tab shows.
  const status = filter.status || 'all';
  const search = (filter.search || '').trim().toLowerCase();
  const promptVersion = filter.promptVersion || '';
  const model = filter.model || '';

  const rows = [];
  byId.forEach(function (slot) {
    const r = slot.record;
    if (!r) return; // staff notes / public-flag items on orphan PKs — skip
    if (status && status !== 'all' && r.status !== status) return;
    if (promptVersion && r.promptVersion !== promptVersion) return;
    if (model && r.model !== model) return;
    if (search) {
      const matchesId = r.PK.toLowerCase() === search;
      const matchesName = (r.personName || '').toLowerCase().indexOf(search) !== -1;
      if (!matchesId && !matchesName) return;
    }
    rows.push(buildRecordRow(r, slot, config));
  });

  // Sort by Name asc so the output is predictable. Stable across exports.
  rows.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });

  const lines = [headerLine(RECORD_COLUMNS)];
  rows.forEach(function (row) { lines.push(rowLine(RECORD_COLUMNS, row)); });

  const filename = 'ai-biographies-' + status + '-' + today() + '.csv';
  const body = UTF8_BOM + lines.join(CRLF) + CRLF;
  return { filename, body, rowCount: rows.length };
}

function buildRecordRow (r, slot, config) {
  const isLiving = r.subjectStatus && r.subjectStatus.isLiving;
  const hiddenOnSite = !!(
    (r.status === 'live' || r.status === 'flagged') &&
    isLiving &&
    !config.aiBiographyIncludeLiving
  );

  const pending = slot.publicFlags && slot.publicFlags.pendingFlags ? slot.publicFlags.pendingFlags : 0;
  const lifetime = slot.publicFlags && slot.publicFlags.totalFlags ? slot.publicFlags.totalFlags : 0;
  const topReason = topLifetimeReason(slot.publicFlags);

  const rootUrl = (config.rootUrl || '').replace(/\/$/, '');
  return {
    id: r.PK,
    name: r.personName || '',
    type: (r.subjectStatus && r.subjectStatus.subjectType) || '',
    status: r.status || '',
    hiddenOnSite: hiddenOnSite ? 'yes' : 'no',
    pendingReports: pending,
    lifetimeReports: lifetime,
    topReportReason: topReason || '',
    staffFlags: slot.staffFlags,
    staffNotes: slot.staffNotes,
    lastGenerated: r.generatedAt ? r.generatedAt.slice(0, 10) : '',
    model: r.model || '',
    promptVersion: r.promptVersion || '',
    confidence: r.confidence == null ? '' : r.confidence,
    publicUrl: rootUrl + '/people/' + r.PK
  };
}

function topLifetimeReason (flagsItem) {
  if (!flagsItem) return '';
  let topReason = '';
  let topCount = 0;
  Object.keys(flagsItem).forEach(function (k) {
    if (k.indexOf('count_') !== 0 || k.indexOf('count_pending_') === 0) return;
    const v = flagsItem[k] || 0;
    if (v > topCount) {
      topCount = v;
      topReason = k.slice('count_'.length);
    }
  });
  return topReason;
}

// Management summary — vertical Metric / Value layout. Easier to eyeball
// for a small monthly report than a wide one-row snapshot. Section headers
// are emitted as blank-value rows so Excel groups them naturally.
function buildSummaryCsv (stats) {
  const rows = [];
  const add = function (metric, value) { rows.push({ metric, value }); };
  const section = function (label) { rows.push({ metric: label, value: '' }); };

  section('Totals');
  add('Biographies', stats.totals.biographies);
  add('Live', stats.totals.live);
  add('Live — suppressed on public site (living-person policy)', stats.totals.liveSuppressed);
  add('Flagged', stats.totals.flagged);
  add('Hidden', stats.totals.hidden);
  add('Insufficient data', stats.totals.insufficient_data);

  section('Subjects');
  add('People', stats.subjects.person);
  add('Companies', stats.subjects.company);
  add('Organisations', stats.subjects.organisation);
  add('Unknown (older records)', stats.subjects.unknown);

  section('Public reports');
  add('Pending', stats.flags.pendingReports);
  add('Pending across records', stats.flags.pendingAcrossRecords);
  add('Lifetime', stats.flags.lifetimeReports);
  (stats.flags.topReasons || []).forEach(function (r) {
    add('Lifetime — reason: ' + r.reason, r.count);
  });

  section('Staff activity');
  add('Flagged records', stats.staff.flaggedRecords);
  add('Notes', stats.staff.notes);

  section('Spend (GBP)');
  add('This month', stats.costs.thisMonthFormatted);
  add('Last 30 days', stats.costs.last30DaysFormatted);
  add('Lifetime', stats.costs.lifetimeFormatted);
  (stats.costs.byModel || []).forEach(function (m) {
    add('By model — ' + m.label, m.costFormatted + ' (' + m.count + ' records)');
  });
  if (stats.costs.unknownModelCount) {
    add('Records with unknown / retired model (cost excluded from totals)', stats.costs.unknownModelCount);
  }

  section('Activity');
  add('New this week', stats.activity.thisWeek);
  add('New last week', stats.activity.lastWeek);

  section('Meta');
  add('Computed at', stats.computedAt);

  const columns = [{ key: 'metric', label: 'Metric' }, { key: 'value', label: 'Value' }];
  const lines = [headerLine(columns)];
  rows.forEach(function (row) { lines.push(rowLine(columns, row)); });
  const filename = 'ai-biographies-summary-' + today() + '.csv';
  const body = UTF8_BOM + lines.join(CRLF) + CRLF;
  return { filename, body, rowCount: rows.length };
}

// --- CSV primitives ---

function headerLine (columns) {
  return columns.map(function (c) { return csvEscape(c.label); }).join(',');
}

function rowLine (columns, row) {
  return columns.map(function (c) { return csvEscape(row[c.key]); }).join(',');
}

function csvEscape (value) {
  if (value == null) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function today () {
  return new Date().toISOString().slice(0, 10);
}

module.exports = { buildRecordsCsv, buildSummaryCsv };
