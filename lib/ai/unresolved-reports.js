'use strict';

// "Pending reports" view for the admin list — which records still have
// unresolved public reports, whatever their status.
//
// A record has unresolved reports while its FLAGS item has pendingFlags > 0:
// visitors reported a problem and nobody has clicked "Mark as reviewed"
// since. Status is a separate axis. Hiding a record takes it off the public
// site but leaves its pending reports in place, and the dashboard's Pending
// reports inbox only counts live/flagged records — so without this view,
// hidden-but-unreviewed records were only findable by paging the Hidden tab.
//
// Staff flags are opt-in (includeStaffFlags). They have no review state: a
// STAFF_FLAG item exists until the staff member who set it clears it, so
// counting them by default would keep every hidden-after-staff-flag record
// in the view indefinitely.
//
// The index is built once per dashboard-stats scan (cached, see
// dashboard-stats.js) from the FLAGS + STAFF_FLAG items it already reads, so
// the list view only has to fetch the biographies on the current page.

// entry: { pendingReports, staffFlags } — counts for one record.
function hasUnresolved (entry, opts) {
  if (!entry) return false;
  if ((entry.pendingReports || 0) > 0) return true;
  return !!(opts && opts.includeStaffFlags && (entry.staffFlags || 0) > 0);
}

// statusByPk:          PK → canonical BIOGRAPHY status
// publicFlagsByPk:     PK → raw FLAGS item
// staffFlagCountByPk:  PK → number of STAFF_FLAG items
//
// Returns one entry per record with pending reports or staff flags, most
// pending reports first, then most recently reported. FLAGS / STAFF_FLAG
// items whose biography no longer exists are skipped — there's nothing to
// link to.
function buildIndex (statusByPk, publicFlagsByPk, staffFlagCountByPk) {
  const pks = new Set(Object.keys(publicFlagsByPk).concat(Object.keys(staffFlagCountByPk)));
  const entries = [];
  pks.forEach(function (pk) {
    if (!Object.prototype.hasOwnProperty.call(statusByPk, pk)) return;
    const flags = publicFlagsByPk[pk];
    const pendingReports = (flags && flags.pendingFlags) || 0;
    const staffFlags = staffFlagCountByPk[pk] || 0;
    if (pendingReports <= 0 && staffFlags <= 0) return;
    entries.push({
      pk,
      status: statusByPk[pk] || null,
      pendingReports,
      staffFlags,
      lastFlaggedAt: (flags && flags.lastFlaggedAt) || null
    });
  });
  entries.sort(compareEntries);
  return entries;
}

function compareEntries (a, b) {
  if (b.pendingReports !== a.pendingReports) return b.pendingReports - a.pendingReports;
  const aAt = a.lastFlaggedAt || '';
  const bAt = b.lastFlaggedAt || '';
  if (aAt !== bAt) return aAt < bAt ? 1 : -1;
  return a.pk < b.pk ? -1 : (a.pk > b.pk ? 1 : 0);
}

// opts: { status, includeStaffFlags }. status 'all' (or empty) = any status.
function filterIndex (entries, opts) {
  opts = opts || {};
  const status = opts.status && opts.status !== 'all' ? opts.status : null;
  return (entries || []).filter(function (e) {
    if (status && e.status !== status) return false;
    return hasUnresolved(e, opts);
  });
}

module.exports = { hasUnresolved, buildIndex, filterIndex };
