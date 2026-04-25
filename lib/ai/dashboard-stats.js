'use strict';

// Aggregate metrics for the admin dashboard — top-level counts, cost totals,
// activity over time, flag and skip-reason breakdowns.
//
// Approach: one full-table scan, aggregated incrementally page-by-page so
// peak memory stays at ~1MB (one DynamoDB page). Result cached in-process
// for 5 minutes. Both the main list page's headline strip and the full
// dashboard page read from this cache via getStats().
//
// At current scale (<25k records) a scan is cheap and the cache hit rate
// is very high. When/if volume grows past ~250k records the migration path
// is a denormalised STATS item updated on writes — not needed yet.

const modelsRegistry = require('./models');
const subjectStatus = require('./subject-status');

// 15 seconds — short enough that admin changes (hide/regenerate/flag/etc.)
// are reflected on the dashboard within a single browsing beat, long enough
// that rapid-click sessions don't thrash the DynamoDB scan. Raise if scan
// cost ever becomes visible (not imminent at <25k records).
const TTL_MS = 15 * 1000;
const SCAN_PAGE_SIZE = 500;

// Single-entry cache. Not a keyed map — one global aggregate, replaced on
// each recompute, so memory is O(1) regardless of load.
let cached = null; // { value, computedAt }
let inFlight = null; // Promise, so concurrent callers share one scan

async function getStats (dynamo, config) {
  const now = Date.now();
  if (cached && (now - cached.computedAt) < TTL_MS) {
    return cached.value;
  }
  if (inFlight) return inFlight;
  inFlight = compute(dynamo, config)
    .then(function (value) {
      cached = { value, computedAt: Date.now() };
      return value;
    })
    .finally(function () { inFlight = null; });
  return inFlight;
}

// Exposed for tests and for the admin "force refresh" path if ever needed.
function invalidate () {
  cached = null;
}

async function compute (dynamo, config) {
  if (!dynamo.isReady()) {
    return emptyStats();
  }

  const acc = makeAccumulator(config);

  let lastKey = null;
  do {
    const page = await dynamo.scan(SCAN_PAGE_SIZE, lastKey);
    (page.items || []).forEach(function (item) { ingest(item, acc); });
    lastKey = page.lastKey;
  } while (lastKey);

  return finalise(acc);
}

// Shape of the accumulator. Plain object so aggregation is fast and
// memory-small. Finalised into the public shape by finalise().
function makeAccumulator (config) {
  return {
    config,
    // Biography canonical items
    totals: {
      biographies: 0,
      live: 0,
      flagged: 0,
      hidden: 0,
      insufficient_data: 0,
      // Policy-driven suppression — records with content that the public
      // route returns 204 for because the subject is living and the
      // aiBiographyIncludeLiving flag is off. Tracked per source status
      // so the UI can split "live but hidden" from "flagged but hidden".
      liveSuppressed: 0,
      flaggedSuppressed: 0,
      // Total records that HAVE content but aren't on the public site, via
      // any mechanism: manual hide, or living-person suppression on a live
      // or flagged record. Excludes `insufficient_data` — those records
      // have no content, so they aren't "hidden" in the sense a curator
      // would recognise.
      hiddenFromPublic: 0
    },
    subjects: {
      person: 0,
      company: 0,
      organisation: 0,
      unknown: 0
    },
    // Cost aggregation — sum over all canonical biographies with a known
    // model in the registry. Unknown-model entries (legacy snapshots from
    // retired models) are tracked separately so they aren't silently dropped.
    costs: {
      lifetime: 0,
      thisMonth: 0,
      last30Days: 0,
      byModel: Object.create(null), // id → { cost, count }
      unknownModelCount: 0
    },
    // Activity — records per ISO week over the last 8 weeks, plus this/last
    // week counts.
    activity: {
      thisWeek: 0,
      lastWeek: 0,
      byWeek: Object.create(null) // weekStartIso → count
    },
    // Public flag aggregate items. Pending counters are resolved in
    // finalise() — we need each record's canonical `status` to decide
    // whether its pending reports still belong in the "inbox" headline.
    // Raw flag items are collected here, aggregated after the scan when
    // both biography statuses and flag items are known.
    flags: {
      lifetimeReports: 0,
      byReason: Object.create(null), // reason → lifetime count
      // Resolved in finalise():
      pendingReports: 0,
      pendingAcrossRecords: 0
    },
    // PK → status  (from canonical BIOGRAPHY items, for status lookup in finalise)
    biographyStatusByPk: Object.create(null),
    // PK → raw FLAGS item  (kept until finalise so pending counts can be
    // scoped by the corresponding biography's current status)
    publicFlagsByPk: Object.create(null),
    // Staff activity
    staff: {
      flaggedRecords: new Set(), // PKs with any STAFF_FLAG item
      notes: 0
    },
    // Why records land at insufficient_data
    skipReasons: Object.create(null) // reason → count
  };
}

function ingest (item, acc) {
  if (!item) return;
  if (item.entityType === 'BIOGRAPHY') {
    ingestBiography(item, acc);
  } else if (item.entityType === 'PUBLIC_FLAG') {
    ingestPublicFlag(item, acc);
  } else if (item.entityType === 'STAFF_FLAG') {
    acc.staff.flaggedRecords.add(item.PK);
  } else if (item.entityType === 'STAFF_NOTE') {
    acc.staff.notes += 1;
  }
  // Everything else (history snapshots) is ignored. Snapshots don't carry
  // entityType and wouldn't be counted even without an explicit filter.
}

function ingestBiography (item, acc) {
  acc.totals.biographies += 1;
  if (item.status && Object.prototype.hasOwnProperty.call(acc.totals, item.status)) {
    acc.totals[item.status] += 1;
  }
  // Remember status per PK so finalise() can scope pending-report counts to
  // records still publicly visible (live / flagged). Records with status
  // hidden or insufficient_data drop out of the headline "inbox".
  acc.biographyStatusByPk[item.PK] = item.status;

  // Hidden-from-public accounting. Three routes to invisibility on the
  // public site (all require biography content to actually count):
  //   1. status=hidden            — manually hidden by a staff member
  //   2. living-person policy on status=live
  //   3. living-person policy on status=flagged
  // `hiddenFromPublic` is the union, used by the Live card's hint line
  // to answer "how many records have content but aren't on site?". The
  // two *Suppressed counters let the tooltip break that number down by
  // reason. `insufficient_data` records are deliberately excluded —
  // they don't have content, so "hidden" isn't the right word for them.
  //
  // The policy check itself lives in subject-status.isSuppressedOnPublicSite
  // so the three call sites (public route, admin visibility helper, this
  // dashboard aggregator) agree on one rule — in particular, companies /
  // organisations are always eligible regardless of `isLiving`.
  const config = acc.config;
  const policySuppresses = subjectStatus.isSuppressedOnPublicSite(item.subjectStatus, config);
  if (item.status === 'live' && policySuppresses) {
    acc.totals.liveSuppressed += 1;
  }
  if (item.status === 'flagged' && policySuppresses) {
    acc.totals.flaggedSuppressed += 1;
  }
  if (item.biographyHtml) {
    if (item.status === 'hidden') {
      acc.totals.hiddenFromPublic += 1;
    } else if ((item.status === 'live' || item.status === 'flagged') && policySuppresses) {
      acc.totals.hiddenFromPublic += 1;
    }
  }

  // Subject breakdown. subjectType was added mid-project so older records
  // may lack it — those count as 'unknown' rather than being dropped.
  const subjectType = item.subjectStatus && item.subjectStatus.subjectType;
  if (subjectType && Object.prototype.hasOwnProperty.call(acc.subjects, subjectType)) {
    acc.subjects[subjectType] += 1;
  } else {
    acc.subjects.unknown += 1;
  }

  // Cost — only records with a model from the current registry contribute
  // to the totals. Unknown-model (retired models / legacy) records are
  // tallied separately so we don't silently misrepresent spend.
  if (item.model && item.inputTokens != null && item.outputTokens != null) {
    const cost = modelsRegistry.calculateCost(item.model, item.inputTokens, item.outputTokens, acc.config.aiBiographyGbpPerUsd);
    if (cost) {
      acc.costs.lifetime += cost.perBio;
      const generatedAt = item.generatedAt ? new Date(item.generatedAt) : null;
      if (generatedAt && !Number.isNaN(generatedAt.getTime())) {
        if (isSameCalendarMonth(generatedAt, new Date())) {
          acc.costs.thisMonth += cost.perBio;
        }
        if (withinDays(generatedAt, 30)) {
          acc.costs.last30Days += cost.perBio;
        }
      }
      const modelAcc = acc.costs.byModel[item.model] || (acc.costs.byModel[item.model] = { cost: 0, count: 0 });
      modelAcc.cost += cost.perBio;
      modelAcc.count += 1;
    } else {
      acc.costs.unknownModelCount += 1;
    }
  }

  // Activity — bucket by ISO-week start. Only last 8 weeks (including this
  // week) are kept; older buckets are dropped at finalise time.
  const generatedAt = item.generatedAt ? new Date(item.generatedAt) : null;
  if (generatedAt && !Number.isNaN(generatedAt.getTime())) {
    if (withinDays(generatedAt, 7)) acc.activity.thisWeek += 1;
    else if (withinDays(generatedAt, 14)) acc.activity.lastWeek += 1;
    const weekStart = startOfIsoWeek(generatedAt).toISOString().slice(0, 10);
    acc.activity.byWeek[weekStart] = (acc.activity.byWeek[weekStart] || 0) + 1;
  }

  // Skip reasons — only for records that actually ended up skipped.
  if (item.status === 'insufficient_data' && item.skipReason) {
    // Collapse to the prefix up to the first em-dash or open-paren so near-
    // identical reasons ("Low confidence (3/10) …", "Low confidence (2/10) …")
    // bucket together.
    const key = item.skipReason.split(/[—(]/)[0].trim();
    acc.skipReasons[key] = (acc.skipReasons[key] || 0) + 1;
  }
}

function ingestPublicFlag (item, acc) {
  const total = item.totalFlags || 0;
  acc.flags.lifetimeReports += total;
  // Lifetime per-reason counts are always aggregated — they're historical,
  // not "inbox" signals, and scoping them by status would make lifetime
  // totals jump around as records change status.
  Object.keys(item).forEach(function (k) {
    if (k.indexOf('count_') === 0 && k.indexOf('count_pending_') !== 0) {
      const reason = k.slice('count_'.length);
      acc.flags.byReason[reason] = (acc.flags.byReason[reason] || 0) + (item[k] || 0);
    }
  });
  // Pending counts are resolved in finalise(), once we know the status of
  // each FLAGS item's sibling BIOGRAPHY — hidden records drop out of the
  // pending-reports "inbox" count.
  acc.publicFlagsByPk[item.PK] = item;
}

function finalise (acc) {
  // Derived: records actually visible to the public (status=live minus
  // those suppressed by the living-person policy). Computed once here so
  // the Live-biographies headline card can show a number that matches
  // what visitors actually see on the site.
  acc.totals.livePublic = Math.max(0, acc.totals.live - acc.totals.liveSuppressed);

  // Resolve pending public-report counts scoped to records that are still
  // publicly visible. The dashboard "Pending reports" card is meant as an
  // inbox — items needing staff attention right now. Once a record is
  // hidden, the public-harm signal is resolved (visitors can't see it
  // anymore) so its pending reports drop out of the headline count. The
  // lifetime totals + per-record report columns on the list are unaffected
  // and still surface the reports when drilling into the Hidden tab.
  Object.keys(acc.publicFlagsByPk).forEach(function (pk) {
    const item = acc.publicFlagsByPk[pk];
    const pending = item.pendingFlags || 0;
    if (pending <= 0) return;
    const status = acc.biographyStatusByPk[pk];
    const publiclyVisible = status === 'live' || status === 'flagged';
    if (!publiclyVisible) return;
    acc.flags.pendingReports += pending;
    acc.flags.pendingAcrossRecords += 1;
  });

  // Convert byModel map → sorted array (most-used first)
  const byModel = Object.keys(acc.costs.byModel).map(function (id) {
    const m = modelsRegistry.getModel(id);
    return {
      id,
      label: m ? m.label : id,
      cost: acc.costs.byModel[id].cost,
      costFormatted: formatGbp(acc.costs.byModel[id].cost),
      count: acc.costs.byModel[id].count
    };
  }).sort(function (a, b) { return b.count - a.count; });

  // Build the last 8 ISO-weeks (oldest → newest) so the bar chart renders
  // left-to-right in time order, with zero counts for weeks that had no
  // generation activity.
  const byWeek = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (i * 7));
    const weekStart = startOfIsoWeek(d).toISOString().slice(0, 10);
    byWeek.push({
      weekStart,
      count: acc.activity.byWeek[weekStart] || 0
    });
  }

  const topSkipReasons = Object.keys(acc.skipReasons)
    .map(function (r) { return { reason: r, count: acc.skipReasons[r] }; })
    .sort(function (a, b) { return b.count - a.count; })
    .slice(0, 6);

  const topFlagReasons = Object.keys(acc.flags.byReason)
    .map(function (r) { return { reason: r, count: acc.flags.byReason[r] }; })
    .sort(function (a, b) { return b.count - a.count; })
    .filter(function (r) { return r.count > 0; });

  return {
    computedAt: new Date().toISOString(),
    totals: acc.totals,
    subjects: acc.subjects,
    costs: {
      lifetime: acc.costs.lifetime,
      lifetimeFormatted: formatGbp(acc.costs.lifetime),
      thisMonth: acc.costs.thisMonth,
      thisMonthFormatted: formatGbp(acc.costs.thisMonth),
      last30Days: acc.costs.last30Days,
      last30DaysFormatted: formatGbp(acc.costs.last30Days),
      byModel,
      unknownModelCount: acc.costs.unknownModelCount
    },
    activity: {
      thisWeek: acc.activity.thisWeek,
      lastWeek: acc.activity.lastWeek,
      byWeek,
      maxWeekCount: byWeek.reduce(function (max, w) { return Math.max(max, w.count); }, 0)
    },
    flags: {
      pendingReports: acc.flags.pendingReports,
      pendingAcrossRecords: acc.flags.pendingAcrossRecords,
      lifetimeReports: acc.flags.lifetimeReports,
      topReasons: topFlagReasons
    },
    staff: {
      flaggedRecords: acc.staff.flaggedRecords.size,
      notes: acc.staff.notes
    },
    skipReasons: topSkipReasons
  };
}

function emptyStats () {
  return {
    computedAt: new Date().toISOString(),
    totals: { biographies: 0, live: 0, flagged: 0, hidden: 0, insufficient_data: 0, liveSuppressed: 0, flaggedSuppressed: 0, hiddenFromPublic: 0 },
    subjects: { person: 0, company: 0, organisation: 0, unknown: 0 },
    costs: {
      lifetime: 0,
      lifetimeFormatted: '£0',
      thisMonth: 0,
      thisMonthFormatted: '£0',
      last30Days: 0,
      last30DaysFormatted: '£0',
      byModel: [],
      unknownModelCount: 0
    },
    activity: { thisWeek: 0, lastWeek: 0, byWeek: [], maxWeekCount: 0 },
    flags: { pendingReports: 0, pendingAcrossRecords: 0, lifetimeReports: 0, topReasons: [] },
    staff: { flaggedRecords: 0, notes: 0 },
    skipReasons: [],
    unavailable: true
  };
}

const formatGbp = modelsRegistry.formatGbp;

// Pure helpers — kept here so the module has no runtime dependencies beyond
// the models registry.
function isSameCalendarMonth (a, b) {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

function withinDays (date, days) {
  const diffMs = Date.now() - date.getTime();
  return diffMs >= 0 && diffMs < days * 24 * 60 * 60 * 1000;
}

// ISO weeks start Monday. We use the date (midnight UTC) at the start of
// the week that contains `d`, so bucketing is stable and independent of
// local time zones.
function startOfIsoWeek (d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7; // Sunday=0 → 7
  if (day !== 1) date.setUTCDate(date.getUTCDate() - (day - 1));
  return date;
}

module.exports = { getStats, invalidate };
