'use strict';

// Admin name search over the name index the dashboard-stats scan builds
// (stats.nameIndex: every biography's { pk, name }, newest first).
//
// DynamoDB has no ILIKE / full-text. Name search used to page the
// CreatedAtIndex GSI in 5 queries of "500", but each query stops at 1 MB,
// only ~9 records at ~110 KB each, so it searched just the newest ~45
// records and missed everyone older. The stats scan already reads every
// record, so it keeps the names and the search matches here; the route
// then reads only the matching records, by key.
//
// The index is as old as the cached stats, so a record generated in the
// last minute or two may not be found by name yet (ID search always works).

// Index entries whose name contains `q`, case-insensitively, in index
// order (newest first). Blank `q` or no index matches nothing.
function match (index, q) {
  const needle = (q || '').toLowerCase().trim();
  if (!needle || !Array.isArray(index)) return [];
  return index.filter(function (e) {
    return (e.name || '').toLowerCase().indexOf(needle) !== -1;
  });
}

module.exports = { match };
