'use strict';

const adminAuth = require('../lib/ai/admin-auth');
const biographyStore = require('../lib/ai/biography-store');
const dynamo = require('../lib/ai/dynamo');
const extractPersonData = require('../lib/ai/extract-person-data');
const getRelatedItems = require('../lib/get-related-items');
const sortRelated = require('../lib/sort-related-items');
const TypeMapping = require('../lib/type-mapping');
const normaliseWikidata = require('../lib/helpers/normalise-wikidata');
const fetchWikidataLive = require('../lib/ai/fetch-wikidata-live');
const prompts = require('../lib/ai/prompts/biography');
const modelsRegistry = require('../lib/ai/models');
const assessSufficiency = require('../lib/ai/assess-sufficiency');
const classifySubject = require('../lib/ai/classify-subject');
const subjectStatus = require('../lib/ai/subject-status');
const flagStore = require('../lib/ai/flag-store');
const dashboardStats = require('../lib/ai/dashboard-stats');
const exportCsv = require('../lib/ai/export-csv');
const reviewBiography = require('../lib/ai/review-biography');
const linkifySources = require('../lib/ai/linkify-sources');
const curatorDecisionsStore = require('../lib/ai/curator-decisions-store');
const reviewStore = require('../lib/ai/review-store');
const renderBiography = require('../lib/ai/render-biography');
const verifyExternal = require('../lib/ai/verify-external');
const generateSourceTaggedBiography = require('../lib/ai/generate-source-tagged-biography');
const reviewBiographyTagged = require('../lib/ai/review-biography-tagged');
const findingFilters = require('../lib/ai/finding-filters');
const zlib = require('zlib');

// Public-visibility hint for list rows. Currently two-valued ('full' or
// 'hidden') but structured as a helper so a future "context only" / partial
// state can be slotted in without rewriting the call sites.
//
//   full    — record would be served normally if a visitor hit it
//   hidden  — record is status=live/flagged but the living-person policy
//             suppresses it at render time (aiBiographyIncludeLiving=false)
//
// Only computed for records that would otherwise be public (live/flagged).
// For hidden/insufficient_data the status badge already tells the story.
// Turns a stored skipReason string into one of a small set of categories
// the detail template renders an explanatory paragraph for. Prefixes are
// stable — they're written by this module and `routes/ai-biography.js`,
// grep'able and easy to update. Returns null for anything unmatched.
function classifySkipReason (reason) {
  if (typeof reason !== 'string' || !reason) return null;
  if (reason.indexOf('Generation failed:') === 0) return 'failed';
  if (reason.indexOf('Living person') === 0) return 'living';
  if (reason.indexOf('Insufficient data') === 0) return 'insufficient';
  if (reason.indexOf('Low confidence') === 0) return 'low_confidence';
  return null;
}

function publicVisibilityFor (record, config) {
  if (!record) return 'full';
  const normallyVisible = record.status === 'live' || record.status === 'flagged';
  if (!normallyVisible) return 'full';
  if (subjectStatus.isSuppressedOnPublicSite(record.subjectStatus, config)) return 'hidden';
  return 'full';
}

function staffOf (request) {
  return adminAuth.getStaffIdentity
    ? adminAuth.getStaffIdentity(request) || 'admin'
    : 'admin';
}

function redirectToLogin (h) {
  return h.redirect('/admin/ai/login');
}

// Admin search accepts three input shapes:
//   1. Bare record ID — e.g. `cp37054`, `ap12345` — direct lookup
//   2. URL fragment   — e.g. `/people/cp37054` or a full collection URL —
//                       ID is extracted from the `/people/<id>` segment
//   3. Name fragment  — anything else is treated as a case-insensitive
//                       substring search over `personName`
// Returns { kind: 'id' | 'name', id?, q? } or null for empty input.
function parseSearch (input) {
  const s = (input || '').trim();
  if (!s) return null;
  // URL form — extract the ID segment whether it's a path (`/people/cp1`) or
  // a full URL (`https://collection.sciencemuseumgroup.org.uk/people/cp1`).
  // Tolerates trailing slash / querystring / hash via word boundary.
  const urlMatch = s.match(/(?:^|\/)people\/([a-z]{2}\d+)\b/i);
  if (urlMatch) return { kind: 'id', id: urlMatch[1].toLowerCase() };
  // Bare ID — two letters followed by digits. Case-insensitive to forgive
  // `CP37054` pasted from an email.
  if (/^[a-z]{2}\d+$/i.test(s)) return { kind: 'id', id: s.toLowerCase() };
  // Everything else is a name fragment.
  return { kind: 'name', q: s };
}

function requireAuth (request, h, config) {
  if (!adminAuth.validateAdminToken(request, config)) {
    return redirectToLogin(h);
  }
  return null;
}

// Derive the { id, title, link } references list saved on the
// BIOGRAPHY item. Same behaviour as the identically-named helper in
// routes/ai-biography.js — parses sourceDetail for `relatedItem:*`
// citations, looks each up in the flattened related-items list, and
// dedupes on ID. Kept local rather than shared because it's short and
// the two routes don't otherwise cross-import. Different name so the
// linter can't miss the duplication if/when it ever matters.
function deriveAdminReferencesFromSentences (sentences, relatedItems) {
  if (!Array.isArray(sentences) || sentences.length === 0) return [];
  const byId = {};
  (relatedItems || []).forEach(function (item) {
    if (item && item.id) byId[item.id] = item;
  });
  const out = [];
  const seen = new Set();
  sentences.forEach(function (s) {
    if (!s || !s.sourceDetail || typeof s.sourceDetail !== 'string') return;
    s.sourceDetail.split(/[,;]/).forEach(function (piece) {
      const trimmed = piece.trim().toLowerCase();
      if (trimmed.indexOf('relateditem:') !== 0) return;
      const refId = trimmed.slice('relateditem:'.length);
      if (seen.has(refId)) return;
      seen.add(refId);
      const item = byId[refId];
      if (!item) return;
      out.push({
        id: item.id,
        title: item.title || '',
        link: item.link || null,
        type: item.type || null
      });
    });
  });
  return out;
}

// Count curator decisions that would fold into the NEXT regeneration.
// Approvals are instant-render (no writer-prompt injection) so they're
// excluded. Rejections + clarifications ARE injected into the writer
// prompt as subject-specific constraints — those are the ones the regen
// banner exists to nudge the curator to apply. A decision is "pending"
// when its timestamp is newer than the current biography's generatedAt
// (i.e. added since the last generation).
function computePendingChanges (decisions, generatedAt) {
  if (!decisions) return 0;
  const gen = generatedAt ? new Date(generatedAt).getTime() : 0;
  const isNewer = function (iso) {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && t > gen;
  };
  let n = 0;
  (decisions.rejections || []).forEach(function (r) { if (isNewer(r.rejectedAt)) n += 1; });
  (decisions.clarifications || []).forEach(function (c) { if (isNewer(c.addedAt)) n += 1; });
  return n;
}

// Order pending findings so the highest-severity items surface first —
// mirrors the render-biography severity map. Both arrays feed the same
// template, so keeping the ordering in one place avoids inconsistent
// display between the biography's per-sentence pills and the findings
// panel's list.
const FINDING_PRIORITY = {
  'error:high': 5,
  'error:medium': 4,
  'error:low': 3,
  'info:high': 2,
  'info:medium': 1,
  'info:low': 0
};
function sortOpenFindings (findings) {
  return (findings || []).slice().sort(function (a, b) {
    const ka = (a.kind || 'error') + ':' + (a.confidence || 'low');
    const kb = (b.kind || 'error') + ':' + (b.confidence || 'low');
    return (FINDING_PRIORITY[kb] || 0) - (FINDING_PRIORITY[ka] || 0);
  });
}

// Task 60: for a curator action on a sentence, we need TWO things:
//   1. The sentence's `precedingState` at the moment of action —
//      { visible, decidedBy, concern } — persisted on the curator
//      decision so audit queries can answer "was there a pending
//      finding when curator X rejected this?" (the moment the
//      decision was taken.)
//   2. Any pending findings on the same claimSignature — those get
//      auto-resolved by the curator's action. The mapping to
//      resolution:
//        approve  → findings marked 'dismissed' (curator disagreed)
//        reject   → findings marked 'accepted'  (curator agreed)
//        clarify  → findings marked 'clarified'
//      resolvedBy captures the curator identity so the audit shows
//      the action cascaded from a sentence action rather than an
//      explicit finding resolution.
async function loadPrecedingStateAndPendingFindings (id, claimSignature, config) {
  const [record, decisions, reviews] = await Promise.all([
    biographyStore.fetchBiography(id),
    curatorDecisionsStore.get(id).catch(function () { return null; }),
    reviewStore.listReviews(id).catch(function () { return []; })
  ]);
  if (!record || !Array.isArray(record.sentences)) {
    return { precedingState: null, pendingFindingsByReviewSK: [] };
  }
  // All findings across all reviews — render's finding gate uses
  // kind + confidence, not resolution, so we need the full set.
  const allFindings = [];
  const pendingFindingsByReviewSK = [];
  reviews.forEach(function (rv) {
    (rv.findings || []).forEach(function (f) {
      allFindings.push(f);
      if (f.resolution === 'pending' && f.claimSignature === claimSignature) {
        pendingFindingsByReviewSK.push({ reviewSK: rv.SK });
      }
    });
  });
  // De-dupe the pending list by reviewSK — one finding-per-signature
  // per REVIEW# item is the store's invariant, but be defensive.
  const seenReviewSK = new Set();
  const dedupedPending = pendingFindingsByReviewSK.filter(function (e) {
    if (seenReviewSK.has(e.reviewSK)) return false;
    seenReviewSK.add(e.reviewSK);
    return true;
  });
  const rendered = renderBiography(record, {
    decisions,
    openFindings: allFindings,
    publishingLevel: (config && config.aiBiographyPublishingLevel),
    references: record.references || []
  });
  const sentence = (rendered.sentences || []).find(function (s) {
    return s.claimSignature === claimSignature;
  });
  return {
    precedingState: sentence ? sentence.state : null,
    pendingFindingsByReviewSK: dedupedPending
  };
}

// Fire-and-await a batch of finding auto-resolutions. Errors on
// individual resolutions are logged but non-fatal — the curator's
// primary action (approve/reject/clarify) already committed.
async function autoResolvePendingFindings (id, claimSignature, resolution, resolvedBy, pendingFindingsByReviewSK) {
  for (const entry of (pendingFindingsByReviewSK || [])) {
    try {
      await reviewStore.updateFindingResolution(id, entry.reviewSK, claimSignature, {
        resolution,
        resolvedBy
      });
    } catch (err) {
      console.warn('Admin AI: auto-resolve of finding failed for', id, entry.reviewSK, claimSignature, '-', err.message);
    }
  }
}

// Compute the affected sentence's current publishing state for a
// finding. Similar to render-biography's classifyPublishingState but
// doesn't recompute the sentence's decision/finding state — reuses the
// already-computed `publishingState` when we have it, and inlines a
// small mapping to the label the template's status chip renders.
// The `label`/`variant` pair drives which coloured chip appears on
// each finding card.
function computeSentenceStateForFinding (sentence, finding) {
  const s = sentence.publishingState;
  if (s === 'curator_approved') return { label: 'publishing (curator approved)', variant: 'publishing', tone: 'positive' };
  if (s === 'curator_rejected') return { label: 'hidden (curator rejected)', variant: 'hidden', tone: 'danger' };
  if (s === 'hidden_finding') return { label: 'hidden (blocking finding)', variant: 'hidden', tone: 'danger' };
  if (s === 'hidden_below_level') return { label: 'hidden (below publishing level)', variant: 'hidden', tone: 'muted' };
  if (s === 'auto_publishing_clean') return { label: 'publishing (auto)', variant: 'publishing', tone: 'positive' };
  if (s === 'auto_publishing_info') {
    return { label: 'publishing (info-tier does not block)', variant: 'publishing', tone: 'positive' };
  }
  if (s === 'auto_publishing_error') {
    // For an error at low/medium severity: publishing but with a
    // caution tone so a curator knows the reviewer flagged it.
    return { label: 'publishing (severity does not block)', variant: 'publishing', tone: 'caution' };
  }
  return { label: sentence.visible ? 'publishing' : 'hidden', variant: sentence.visible ? 'publishing' : 'hidden', tone: 'neutral' };
}

// Flatten resolved findings across every REVIEW# item into one array
// for the admin detail's "Resolved findings" audit collapsible. Same
// shape as openFindings + a `resolvedAt` / `resolvedBy` / `resolution`
// so the template can render a distinct pill per outcome (accepted /
// dismissed / clarified). Sorted most-recent-resolution first — that's
// the useful ordering for an audit view.
function collectResolvedFindings (rawReviews) {
  const out = [];
  (rawReviews || []).forEach(function (rv) {
    (rv.findings || []).forEach(function (f) {
      if (!f || f.resolution === 'pending' || !f.resolution) return;
      out.push(Object.assign({}, f, { reviewSK: rv.SK, reviewedAt: rv.reviewedAt }));
    });
  });
  return out.sort(function (a, b) {
    const ta = a.resolvedAt ? new Date(a.resolvedAt).getTime() : 0;
    const tb = b.resolvedAt ? new Date(b.resolvedAt).getTime() : 0;
    return tb - ta;
  });
}

module.exports = function (elastic, config) {
  return [
    // Login page
    {
      method: 'GET',
      path: '/admin/ai/login',
      config: {
        auth: false,
        handler: function (request, h) {
          return h.view('admin-login', {
            error: request.query.error || null
          }, { layout: 'admin' });
        }
      }
    },

    // Logout — clears both cookies and redirects to login. POST (not GET)
    // so bots / prefetchers / accidental link-clicks can't log you out.
    // Cookie `path` must match how setAdminCookie set them (/admin) or
    // unstate is a no-op.
    {
      method: 'POST',
      path: '/admin/ai/logout',
      config: {
        auth: false,
        handler: function (request, h) {
          const response = h.redirect('/admin/ai/login');
          response.unstate('adminToken', { path: '/admin' });
          response.unstate('adminUser', { path: '/admin' });
          return response;
        }
      }
    },

    // Login POST — token only. The server resolves which user owns
    // the token by looking it up in config.adminUsers (timing-safe
    // compare, falls through to the shared adminToken as break-glass).
    // Username is an attribution concern, not a credential — asking
    // for it at login was theatre since the token alone proves
    // identity. See lib/ai/admin-auth.js::resolveTokenToUser.
    {
      method: 'POST',
      path: '/admin/ai/login',
      config: {
        auth: false,
        handler: function (request, h) {
          const token = request.payload && request.payload.token;
          const authenticatedAs = adminAuth.resolveTokenToUser(token, config);
          if (!authenticatedAs) {
            return h.redirect('/admin/ai/login?error=invalid');
          }
          const isProduction = config.NODE_ENV === 'production';
          const response = h.redirect('/admin/ai');
          adminAuth.setAdminCookie(response, { username: authenticatedAs, token }, isProduction);
          return response;
        }
      }
    },

    // List biographies
    {
      method: 'GET',
      path: '/admin/ai',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;

          const status = request.query.status || 'all';
          const search = (request.query.search || '').trim();
          const promptVersionFilter = request.query.promptVersion || '';
          const modelFilter = request.query.model || '';
          const limit = parseInt(request.query.limit, 10) || 25;
          const lastKey = request.query.lastKey
            ? JSON.parse(decodeURIComponent(request.query.lastKey))
            : null;
          const availableVersions = prompts.listVersions();
          const availableModels = modelsRegistry.listModels();

          if (!dynamo.isReady()) {
            return h.view('admin-ai-list', {
              records: [],
              dynamoUnavailable: true,
              currentStatus: status,
              search,
              promptVersionFilter,
              modelFilter,
              availableVersions,
              availableModels,
              nextKey: null
            }, { layout: 'admin' });
          }

          // Search dispatch: the search box accepts three kinds of input —
          // a record ID (direct lookup), a collection URL (ID extracted from
          // the `/people/<id>` segment), or a free-text name fragment. See
          // parseSearch() at the top of this file.
          //
          // All three paths produce a `records` array that flows through the
          // same decoration pipeline below — keeping flag/staff summary
          // info visible regardless of how the record was found.
          const parsedSearch = parseSearch(search);

          try {
            let records;
            let nextKey = null;

            if (parsedSearch && parsedSearch.kind === 'id') {
              // Direct ID / URL lookup — ignores status + pagination on
              // purpose. A direct hit is the answer the user is looking for,
              // regardless of filter tab.
              const record = await biographyStore.fetchBiography(parsedSearch.id);
              records = record ? [record] : [];
            } else if (parsedSearch && parsedSearch.kind === 'name') {
              // Name search — case-insensitive substring over personName.
              // Like ID lookup, deliberately ignores the status tab so a
              // name match isn't hidden by the currently-selected filter.
              const result = await biographyStore.searchByName(parsedSearch.q, limit);
              records = result.items;
            } else {
              const result = await biographyStore.listBiographies(status, limit, lastKey);
              records = result.items;
              nextKey = result.lastKey ? encodeURIComponent(JSON.stringify(result.lastKey)) : null;
            }
            // Prompt-version + model filters run in-memory over the current
            // page. Rationale: DynamoDB can't index arbitrary attribute values
            // without another GSI, and at <25k records an in-page filter is
            // fine. Both filters stack — a record must match both to survive.
            if (promptVersionFilter) {
              records = records.filter(function (r) { return r.promptVersion === promptVersionFilter; });
            }
            if (modelFilter) {
              records = records.filter(function (r) { return r.model === modelFilter; });
            }
            // Decorate each record with its flag view — parallel per-record
            // fetch. At page-size 25 this is effectively one batch of small
            // GetItems; each only hits the FLAGS SK, not a scan. Records
            // without any public flags get publicReports=null and render
            // a blank in the Flags column.
            records = await Promise.all(records.map(async function (r) {
              // Per-record, parallel: public flag aggregate + staff flags +
              // staff notes. Three GetItems / Queries per record. At page
              // size 25 that's ~75 small reads — milliseconds locally, fine
              // over the wire in production. If ever a hotspot, denormalise
              // these counts onto the canonical record on write.
              const [rawFlags, staffFlags, notes] = await Promise.all([
                flagStore.getFlags(r.PK).catch(function () { return null; }),
                biographyStore.listStaffFlags(r.PK).catch(function () { return []; }),
                biographyStore.listStaffNotes(r.PK).catch(function () { return []; })
              ]);
              const publicReports = flagStore.buildView(rawFlags);
              // Colour band for the public flag column — server-side so the
              // template stays free of custom helpers. Amber for 1-5 pending,
              // red for 6+ (brigading signal), grey otherwise.
              let flagSeverity = null;
              if (publicReports && publicReports.pendingFlags > 0) {
                flagSeverity = publicReports.pendingFlags > 5 ? 'high' : 'some';
              }
              const staffSummary = {
                flagCount: staffFlags.length,
                noteCount: notes.length
              };
              // Small visibility hint for the list — see publicVisibilityFor
              // near the top of this file. Signals "this record is live but
              // suppressed on the public site by the living-person policy".
              const publicVisibility = publicVisibilityFor(r, config);
              return Object.assign({}, r, { publicReports, flagSeverity, staffSummary, publicVisibility });
            }));
            // Headline strip stats — four top-level numbers (pending reports,
            // live count, spend this month, new this week). Cheap to fetch:
            // read from the in-process dashboard cache (5-min TTL, one scan
            // amortised across both the main list and the dashboard page).
            const headlineStats = await dashboardStats.getStats(dynamo, config);
            return h.view('admin-ai-list', {
              records,
              dynamoUnavailable: false,
              currentStatus: status,
              search,
              promptVersionFilter,
              modelFilter,
              availableVersions,
              availableModels,
              nextKey,
              headlineStats
            }, { layout: 'admin' });
          } catch (err) {
            console.error('Admin AI list error:', err.message);
            return h.view('admin-ai-list', {
              records: [],
              dynamoUnavailable: true,
              currentStatus: status,
              search,
              promptVersionFilter,
              modelFilter,
              availableVersions,
              availableModels,
              nextKey: null,
              error: err.message
            }, { layout: 'admin' });
          }
        }
      }
    },

    // Dashboard — full aggregate view. Reads from the same cached stats as
    // the main list's headline strip; no extra scan cost if the cache is
    // warm. Deliberately a separate page so the list stays focused on
    // individual-record triage.
    {
      method: 'GET',
      path: '/admin/ai/dashboard',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;
          try {
            const stats = await dashboardStats.getStats(dynamo, config);
            return h.view('admin-ai-dashboard', {
              stats,
              dynamoUnavailable: !dynamo.isReady(),
              includeLiving: !!config.aiBiographyIncludeLiving
            }, { layout: 'admin' });
          } catch (err) {
            console.error('Admin AI dashboard error:', err.message);
            return h.view('admin-ai-dashboard', {
              stats: null,
              error: err.message
            }, { layout: 'admin' });
          }
        }
      }
    },

    // CSV export of records — one row per biography. Filter semantics match
    // the list page, so clicking "Export CSV" on the Flagged tab exports
    // flagged records only. UTF-8 BOM + CRLF for Excel-friendliness.
    {
      method: 'GET',
      path: '/admin/ai/export.csv',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;
          try {
            const csv = await exportCsv.buildRecordsCsv(dynamo, config, {
              status: request.query.status || 'all',
              search: request.query.search || '',
              promptVersion: request.query.promptVersion || '',
              model: request.query.model || ''
            });
            return h.response(csv.body)
              .type('text/csv; charset=utf-8')
              .header('Content-Disposition', 'attachment; filename="' + csv.filename + '"');
          } catch (err) {
            console.error('Admin AI CSV export error:', err.message);
            return h.response('Error building CSV export: ' + err.message).code(500);
          }
        }
      }
    },

    // Management summary — vertical Metric / Value table built from the
    // same cached dashboard stats. Intended as an attachment to a monthly
    // progress report; no per-record detail.
    {
      method: 'GET',
      path: '/admin/ai/export-summary.csv',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;
          try {
            const stats = await dashboardStats.getStats(dynamo, config);
            const csv = exportCsv.buildSummaryCsv(stats);
            return h.response(csv.body)
              .type('text/csv; charset=utf-8')
              .header('Content-Disposition', 'attachment; filename="' + csv.filename + '"');
          } catch (err) {
            console.error('Admin AI summary export error:', err.message);
            return h.response('Error building summary export: ' + err.message).code(500);
          }
        }
      }
    },

    // Full backup — every item in the base table, one JSON object per line,
    // streamed through gzip. Restorable via scripts/restore-from-backup.js.
    //
    // Auth: re-uses the existing admin-token cookie. When we introduce a
    // proper user/key auth system (noted in the plan), revisit — in
    // particular if we start running this on a cron we'll want a download
    // token that isn't a browser cookie.
    {
      method: 'GET',
      path: '/admin/ai/backup.jsonl.gz',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;
          try {
            const gzip = zlib.createGzip();
            const filename = 'ai-biographies-backup-' + new Date().toISOString().slice(0, 10) + '.jsonl.gz';

            // Kick off a background producer — scan page by page and push
            // each item onto the gzip stream. Peak memory stays at ~1 MB
            // (one page of items waiting to be JSON-stringified).
            (async function produce () {
              try {
                let lastKey = null;
                do {
                  const page = await dynamo.scan(500, lastKey);
                  (page.items || []).forEach(function (item) {
                    gzip.write(JSON.stringify(item) + '\n');
                  });
                  lastKey = page.lastKey;
                } while (lastKey);
                gzip.end();
              } catch (err) {
                console.error('Admin AI backup producer error:', err.message);
                gzip.destroy(err);
              }
            })();

            return h.response(gzip)
              .type('application/gzip')
              .header('Content-Disposition', 'attachment; filename="' + filename + '"');
          } catch (err) {
            console.error('Admin AI backup error:', err.message);
            return h.response('Error producing backup: ' + err.message).code(500);
          }
        }
      }
    },

    // Detail view
    {
      method: 'GET',
      path: '/admin/ai/{id}',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;

          const id = request.params.id;

          try {
            const record = await biographyStore.fetchBiography(id);
            if (!record) {
              return h.view('admin-ai-detail', {
                record: null,
                notFound: true
              }, { layout: 'admin' });
            }
            // Mirror the list-view public-visibility hint so the detail
            // header can show the same "(hidden on site)" marker.
            record.publicVisibility = publicVisibilityFor(record, config);
            // Bucket the skipReason into a category the detail template can
            // key off. Keeps the Handlebars side free of string-matching —
            // the raw skipReason is still surfaced; this is just used to
            // select the appropriate plain-English explanatory block.
            record.skipCategory = classifySkipReason(record.skipReason);

            // Fetch staff notes, flags, snapshots, public flags, AI
            // reviews, curator decisions, and per-generation review
            // findings in parallel. curatorDecisions + openFindings are
            // v2-only; they'll come back null / empty for records
            // produced by the pre-v2 pipeline, which the render layer
            // + template both tolerate.
            const [rawNotes, snapshots, staffFlags, rawPublicFlags, rawReviews, curatorDecisions, rawOpenFindings] = await Promise.all([
              biographyStore.listStaffNotes(id).catch(function () { return []; }),
              biographyStore.listHistory(id).catch(function () { return []; }),
              biographyStore.listStaffFlags(id).catch(function () { return []; }),
              flagStore.getFlags(id).catch(function () { return null; }),
              biographyStore.listReviews(id).catch(function () { return []; }),
              curatorDecisionsStore.get(id).catch(function () { return null; }),
              reviewStore.openFindings(id).catch(function () { return []; })
            ]);
            const publicReports = flagStore.buildView(rawPublicFlags);

            const currentStaff = staffOf(request);

            // Annotate staff flags with staleness (same rule as notes)
            const annotatedFlags = staffFlags.map(function (f) {
              const stale = !!(
                f.biographyPromptVersion &&
                record.promptVersion &&
                (
                  f.biographyPromptVersion !== record.promptVersion ||
                  (f.biographyGeneratedAt && record.generatedAt && f.biographyGeneratedAt !== record.generatedAt)
                )
              );
              return Object.assign({}, f, { stale, isMine: f.staff === currentStaff });
            });

            const myFlag = annotatedFlags.find(function (f) { return f.isMine; });
            const myCurrentFlag = myFlag ? myFlag.reason : '';
            const otherFlags = annotatedFlags.filter(function (f) { return !f.isMine; });

            // Annotate each note with staleness — i.e. whether it was written
            // against a different biography version than the one currently
            // displayed. Pre-computing here keeps the template simple.
            const notes = rawNotes.map(function (n) {
              const stale = !!(
                n.biographyPromptVersion &&
                record.promptVersion &&
                (
                  n.biographyPromptVersion !== record.promptVersion ||
                  (n.biographyGeneratedAt && record.generatedAt && n.biographyGeneratedAt !== record.generatedAt)
                )
              );
              return Object.assign({}, n, { stale });
            });

            // Same staleness rule for AI reviews, plus attach the formatted
            // cost of each review (computed from stored input/output tokens
            // and the review model) so the template can render "£0.12" next
            // to the timestamp without doing arithmetic in Handlebars.
            // Also transform each factual-issue's `suggestedChecks` from
            // plain strings into { text, url } objects — lets the template
            // link out to Wikipedia (the only source we can safely infer a
            // URL for) while other sources stay as plain text.
            const reviews = rawReviews.map(function (r) {
              // Two distinct staleness signals — each triggered by a different
              // change since the review was produced:
              //
              //   stale (biography regenerated): the underlying biography has
              //     been re-generated since this review ran, so the review's
              //     findings refer to a superseded snapshot.
              //
              //   reviewPromptStale (outdated review prompt): the review was
              //     produced under an older version of the review prompt
              //     (lib/ai/review-biography.js::PROMPT_VERSION). Findings
              //     may not reflect current reviewer behaviour — e.g. older
              //     versions had a field-name bug that starved Opus of the
              //     catalogue biography text, producing "no dates / addresses
              //     to anchor" complaints even when the data was present.
              //     Treated as a soft signal: the OLD findings are not
              //     necessarily wrong, but worth re-running to confirm.
              const stale = !!(
                r.biographyPromptVersion &&
                record.promptVersion &&
                (
                  r.biographyPromptVersion !== record.promptVersion ||
                  (r.biographyGeneratedAt && record.generatedAt && r.biographyGeneratedAt !== record.generatedAt)
                )
              );
              const reviewPromptStale = !!(
                r.reviewPromptVersion &&
                r.reviewPromptVersion !== reviewBiography.PROMPT_VERSION
              );
              const costObj = modelsRegistry.calculateCost(
                r.reviewModel, r.inputTokens, r.outputTokens, config.aiBiographyGbpPerUsd
              );
              const factualIssues = (r.factualIssues || []).map(function (fi) {
                return Object.assign({}, fi, {
                  suggestedChecks: (fi.suggestedChecks || []).map(linkifySources.linkify)
                });
              });
              return Object.assign({}, r, {
                stale,
                reviewPromptStale,
                currentReviewPromptVersion: reviewBiography.PROMPT_VERSION,
                costFormatted: costObj ? costObj.perBioFormatted : null,
                factualIssues
              });
            });

            const availableVersions = prompts.listVersions();
            const versionOptions = availableVersions.map(function (v) {
              return { id: v, isActive: v === prompts.activeVersion, isCurrent: v === record.promptVersion };
            });

            // Fetch the current existing description live from ES so staff
            // can compare AI output against source data. Live (rather than
            // stored) because the ES record may have been edited since
            // generation — freshness matters more than the extra round-trip.
            let existingDescription = null;
            try {
              const esResult = await elastic.get({
                index: config.elasticIndex || 'ciim',
                id: TypeMapping.toInternal(id)
              });
              const liveData = extractPersonData(esResult.body._source);
              existingDescription = {
                text: liveData.biography || '',
                chars: liveData.descriptionChars || 0,
                briefText: liveData.briefBiography || '',
                briefChars: liveData.briefBiographyChars || 0
              };
            } catch (err) {
              console.warn('Admin detail: could not fetch existing description for', id, '-', err.message);
            }

            // Determine the public-display state based on the configured
            // thresholds. Three mutually-exclusive states:
            //   suppressed — existing desc too short to show; only AI visible
            //   replaced   — existing desc long enough that AI gen is skipped
            //                (or would be); only existing shown
            //   both       — both existing desc and AI biography are visible
            const existingChars = (existingDescription && existingDescription.chars) ||
              (record && record.existingDescriptionChars) || 0;
            const suppressThreshold = config.aiBiographySuppressExistingChars;
            const maxThreshold = config.aiBiographyMaxExistingChars;
            let displayState = 'both';
            if (existingChars < suppressThreshold) displayState = 'suppressed';
            else if (existingChars >= maxThreshold) displayState = 'replaced';

            // Cost of this record's generation + extrapolation to 1,000
            // biographies of the same shape. null if the model isn't priced.
            // Converted to GBP for display via config.aiBiographyGbpPerUsd.
            const cost = modelsRegistry.calculateCost(
              record.model, record.inputTokens, record.outputTokens,
              config.aiBiographyGbpPerUsd
            );

            // Expand stored signal keys into labelled breakdown for display.
            let signalView = null;
            if (record.signalsPresent || record.signalsMissing) {
              const present = new Set(record.signalsPresent || []);
              signalView = {
                score: record.signalScore,
                maxScore: record.signalMaxScore,
                signalCount: record.signalCount,
                totalSignals: assessSufficiency.SIGNALS.length,
                minScore: config.aiBiographyMinSignals,
                signals: assessSufficiency.SIGNALS.map(function (s) {
                  return {
                    key: s.key,
                    label: s.label,
                    weight: s.weight,
                    present: present.has(s.key)
                  };
                })
              };
            }

            // Pre-compute the AI review section's context so the template
            // can render it without per-hit work. Button visibility / cost
            // estimate live here; individual review findings (reviews
            // array above) carry staleness and actual cost.
            const reviewModel = config.aiBiographyReviewModel;
            const reviewModelInfo = modelsRegistry.getModel(reviewModel);
            // Estimate: typical input / output for a review. Only used for
            // the "~£X" label on the run button — actual cost stored per
            // review once Opus has completed.
            const reviewEstimate = modelsRegistry.calculateCost(
              reviewModel, 2500, 1000, config.aiBiographyGbpPerUsd
            );
            const reviewConfig = {
              enabled: !!config.aiBiographyReviewEnabled,
              canRun: !!(config.aiBiographyReviewEnabled && (record.biographyHtml || (record.sentences && record.sentences.length))),
              model: reviewModel,
              modelLabel: (reviewModelInfo && reviewModelInfo.label) || reviewModel,
              estimatedCost: reviewEstimate ? reviewEstimate.perBioFormatted : null,
              // Task 52 will define this config key; falsy default keeps the
              // "Verify externally" buttons hidden until curators + staff
              // decide they want the extra tools available.
              externalValidationEnabled: !!config.aiBiographyExternalValidationEnabled
            };

            // v2 template data: sentence-level render state, open review
            // findings sorted by severity, and the regen-banner counter.
            // Only computed for records produced by the v2 writer
            // (identified by having a sentences[] array on the record);
            // legacy records with only biographyHtml render via the
            // template's `{{else}}` fallback branch.
            //
            // Open findings are filtered to only those whose
            // claimSignature matches a current sentence — stale ones
            // (from a previous generation where the writer produced a
            // now-rewritten sentence) sit in their REVIEW# items
            // unresolved and automatically resurface if a future regen
            // brings the same signature back. staleFindingsCount is
            // surfaced on the panel header so a curator knows N were
            // trimmed rather than assuming the panel just cleared.
            // Resolved findings are NOT filtered — the audit
            // collapsible below Open Findings shows the historical
            // picture regardless of whether the underlying sentence
            // still exists.
            const sortedOpenFindings = sortOpenFindings(rawOpenFindings || []);
            const currentSentences = (record && record.sentences) || [];
            const openFindingsFiltered = findingFilters.filterToCurrentSentences(sortedOpenFindings, currentSentences);
            const staleFindingsCount = findingFilters.countStale(sortedOpenFindings, currentSentences);
            const allResolvedFindings = collectResolvedFindings(rawReviews);

            // Findings — pre-decorate here so the template stays declarative.
            //
            //   affectedSentence — the current sentence with matching
            //     claimSignature (undefined when the finding is stale
            //     against the current biography — captured elsewhere as
            //     staleFindingsCount).
            //   affectedPublishingState — the sentence's current
            //     publishing state (curator_approved / auto_publishing_*
            //     / hidden_*). Drives the prominent green/red/amber
            //     status chip on each finding card so a curator
            //     eyeballing the panel sees at a glance whether each
            //     concern is affecting the public site right now.
            //
            // Inline the sentence's index too so a click on a finding
            // card can smooth-scroll to the corresponding Claims row —
            // wired by the small JS block at the bottom of the
            // template.
            const sentenceByCurrentSignature = new Map();
            currentSentences.forEach(function (s, i) {
              if (s && s.claimSignature) sentenceByCurrentSignature.set(s.claimSignature, { sentence: s, index: i });
            });
            const decorateFinding = function (f) {
              const match = sentenceByCurrentSignature.get(f.claimSignature);
              return Object.assign({}, f, {
                affectedSentenceIndex: match ? match.index : null,
                affectedPublishingState: match && match.sentence
                  ? computeSentenceStateForFinding(match.sentence, f)
                  : null
              });
            };
            const openFindings = openFindingsFiltered.map(decorateFinding);

            // Resolved findings — cap at RESOLVED_INLINE_CAP most recent
            // for the merged panel (grey rows below Pending). Overflow
            // exposed via resolvedOverflowCount so the template can
            // render a "…and N older" link that expands the full audit
            // list. collectResolvedFindings already sorts most-recent
            // first.
            const RESOLVED_INLINE_CAP = 5;
            const resolvedFindings = allResolvedFindings.slice(0, RESOLVED_INLINE_CAP).map(decorateFinding);
            const resolvedOverflowCount = Math.max(0, allResolvedFindings.length - RESOLVED_INLINE_CAP);
            const resolvedOverflow = allResolvedFindings.slice(RESOLVED_INLINE_CAP).map(decorateFinding);
            const hasSentences = Array.isArray(record.sentences) && record.sentences.length > 0;
            const renderedBiography = hasSentences
              ? (function () {
                  // Task 60: pass BOTH pending and resolved findings to
                  // render. Fixes the "dismiss on error:high accidentally
                  // publishes" bug — the finding gate uses kind +
                  // confidence, not resolution status, so a resolved
                  // finding still hides the sentence unless the curator
                  // explicitly approved it. Ordering doesn't matter to
                  // render; it takes the highest-severity finding per
                  // signature regardless of resolution.
                  const allFindingsForRender = [].concat(openFindingsFiltered, allResolvedFindings);
                  const rendered = renderBiography(record, {
                    decisions: curatorDecisions,
                    openFindings: allFindingsForRender,
                    publishingLevel: config.aiBiographyPublishingLevel,
                    references: record.references || []
                  });
                  // sourceDetailFormatted now decorated inside
                  // render-biography.js (Task 60); no separate map
                  // needed here.
                  return Object.assign({}, rendered, { totalCount: rendered.sentences.length });
                })()
              : null;

            const pendingChangeCount = computePendingChanges(curatorDecisions, record.generatedAt);
            const regenRecommended = pendingChangeCount > 0;
            const pendingChangeSingular = pendingChangeCount === 1;

            return h.view('admin-ai-detail', {
              record,
              notes,
              reviews,
              reviewConfig,
              renderedBiography,
              openFindings,
              staleFindingsCount,
              resolvedFindings,
              resolvedOverflow,
              resolvedOverflowCount,
              regenRecommended,
              pendingChangeCount,
              pendingChangeSingular,
              myCurrentFlag,
              otherFlags,
              snapshotCount: snapshots.length,
              notFound: false,
              versionOptions,
              activeVersion: prompts.activeVersion,
              existingDescription,
              displayState,
              cost,
              signalView,
              publicReports,
              suppressThreshold,
              maxThreshold,
              error: request.query.error || null
            }, { layout: 'admin' });
          } catch (err) {
            console.error('Admin AI detail error:', err.message);
            return h.response('Error loading record').code(500);
          }
        }
      }
    },

    // Update status
    {
      method: 'POST',
      path: '/admin/ai/{id}/status',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;

          const id = request.params.id;
          const newStatus = request.payload && request.payload.status;
          const validStatuses = ['live', 'flagged', 'hidden', 'insufficient_data'];

          if (!newStatus || validStatuses.indexOf(newStatus) === -1) {
            return h.redirect('/admin/ai/' + id + '?error=invalid_status');
          }

          try {
            await biographyStore.updateStatus(id, newStatus);
            // After a status change, return to the list — the typical
            // workflow is "I've decided what should happen with this record,
            // now on to the next". Users who want to stay on the record can
            // navigate back from the list (one click) or undo via the
            // dropdown.
            return h.redirect('/admin/ai');
          } catch (err) {
            console.error('Admin AI status update error:', err.message);
            return h.redirect('/admin/ai/' + id + '?error=update_failed');
          }
        }
      }
    },

    // Regenerate (uses active prompt by default; optional promptVersion payload for A/B)
    {
      method: 'POST',
      path: '/admin/ai/{id}/regenerate',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;

          const id = request.params.id;
          const payload = request.payload || {};
          const promptVersion = payload.promptVersion || null;
          const model = payload.model || null;
          const customSystem = (payload.customSystemPrompt || '').toString().trim();
          const customUser = (payload.customUserPromptTemplate || '').toString().trim();
          const customLabel = (payload.customLabel || '').toString().trim().slice(0, 80);

          // A one-off custom prompt needs BOTH a system and a user template.
          // If only one is supplied we ignore the custom path and fall back to
          // the selected promptVersion (or active default).
          const customPrompt = (customSystem && customUser)
            ? { systemPrompt: customSystem, userPromptTemplate: customUser, label: customLabel || 'custom' }
            : null;

          // If ANY override field was submitted (version, model, or custom
          // prompt), the request came from the compare-page experimentation
          // forms. In that case:
          //   - redirect back to compare (so the staff member sees the new snapshot
          //     alongside existing ones)
          //   - snapshotOnly=true: never overwrite the canonical public record.
          //     The staff member must explicitly click "Set as current" to promote.
          // The plain detail-page "Regenerate" button submits no override
          // fields, so canonical updates as before — that's the "refresh with
          // current defaults" path used for live content maintenance.
          const inExperimentMode = !!(promptVersion || model || customPrompt);
          const redirectTo = inExperimentMode
            ? '/admin/ai/' + id + '/compare'
            : '/admin/ai/' + id;

          try {
            await runRegenerate(elastic, config, id, promptVersion, {
              model,
              customPrompt,
              snapshotOnly: inExperimentMode
            });
            return h.redirect(redirectTo);
          } catch (err) {
            console.error('Admin AI regenerate error:', err.message);
            return h.redirect(redirectTo + '?error=regenerate_failed');
          }
        }
      }
    },

    // Delete a single history snapshot
    {
      method: 'POST',
      path: '/admin/ai/{id}/snapshots/delete',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;

          const id = request.params.id;
          const snapshotSk = request.payload && request.payload.sk;
          if (!snapshotSk || snapshotSk.indexOf('HISTORY#') !== 0) {
            return h.redirect('/admin/ai/' + id + '/compare?error=invalid_snapshot');
          }
          try {
            await biographyStore.deleteSnapshot(id, snapshotSk);
            return h.redirect('/admin/ai/' + id + '/compare');
          } catch (err) {
            console.error('Admin AI delete-snapshot error:', err.message);
            return h.redirect('/admin/ai/' + id + '/compare?error=snapshot_delete_failed');
          }
        }
      }
    },

    // Promote a snapshot to canonical (switch back/forth without regenerating)
    {
      method: 'POST',
      path: '/admin/ai/{id}/promote',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;

          const id = request.params.id;
          const snapshotSk = request.payload && request.payload.sk;
          if (!snapshotSk || snapshotSk.indexOf('HISTORY#') !== 0) {
            return h.redirect('/admin/ai/' + id + '/compare?error=invalid_snapshot');
          }
          try {
            await biographyStore.promoteSnapshot(id, snapshotSk);
            return h.redirect('/admin/ai/' + id);
          } catch (err) {
            console.error('Admin AI promote error:', err.message);
            return h.redirect('/admin/ai/' + id + '/compare?error=promote_failed');
          }
        }
      }
    },

    // Compare view — shows all historical snapshots side by side
    {
      method: 'GET',
      path: '/admin/ai/{id}/compare',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;

          const id = request.params.id;
          try {
            const record = await biographyStore.fetchBiography(id);
            const snapshots = await biographyStore.listHistory(id);
            // Tag the snapshot that currently matches the canonical record so
            // the UI can show a "current" badge instead of a "Set as current" button.
            // Also compute a per-snapshot cost (null for legacy snapshots
            // whose model has since been retired from the registry).
            // Converted to GBP via config.aiBiographyGbpPerUsd.
            const annotated = snapshots.map(function (s) {
              const isCurrent = !!(record &&
                s.generatedAt === record.generatedAt &&
                s.promptVersion === record.promptVersion &&
                s.biographyHtml === record.biographyHtml);
              const cost = modelsRegistry.calculateCost(s.model, s.inputTokens, s.outputTokens, config.aiBiographyGbpPerUsd);
              return Object.assign({}, s, { isCurrent, cost });
            });
            const availableVersions = prompts.listVersions();
            const versionOptions = availableVersions.map(function (v) {
              return { id: v, isActive: v === prompts.activeVersion };
            });
            // Starter text for the custom-prompt editor — the active version,
            // pre-rendered for the current record so staff can tweak and
            // regenerate without starting from scratch.
            let customStarter = null;
            if (record) {
              try {
                const personData = extractPersonData(
                  (await elastic.get({
                    index: config.elasticIndex || 'ciim',
                    id: TypeMapping.toInternal(id)
                  })).body._source
                );
                const sorted = sortRelated(await getRelatedItems(elastic, id), id);
                const items = flattenRelated(sorted);
                const classify = require('../lib/ai/classify-subject');
                const subject = classify(personData, null);
                customStarter = {
                  systemPrompt: prompts.systemPrompt,
                  userPromptTemplate: prompts.buildUserPrompt(personData, items, null, subject)
                };
              } catch (err) {
                console.warn('Compare: could not build custom-prompt starter —', err.message);
              }
            }
            // Decorate each model in the dropdown with a per-1k-bio cost
            // based on the current record's actual token shape (if we have a
            // canonical record). Falls back to a reasonable default shape
            // (1,400 in / 600 out) for brand-new records with no history.
            const baselineIn = (record && record.inputTokens) || 1400;
            const baselineOut = (record && record.outputTokens) || 600;
            const availableModels = modelsRegistry.listModels().map(function (m) {
              const est = modelsRegistry.calculateCost(m.id, baselineIn, baselineOut, config.aiBiographyGbpPerUsd);
              return Object.assign({}, m, {
                estPer1kBio: est ? est.per1kBioFormatted : null,
                estPerBio: est ? est.perBioFormatted : null
              });
            });

            return h.view('admin-ai-compare', {
              record,
              snapshots: annotated,
              notFound: !record && snapshots.length === 0,
              versionOptions,
              activeVersion: prompts.activeVersion,
              availableModels,
              currentModel: record && record.model,
              defaultModel: config.aiBiographyModel,
              customStarter,
              error: request.query.error || null
            }, { layout: 'admin' });
          } catch (err) {
            console.error('Admin AI compare error:', err.message);
            return h.response('Error loading compare view').code(500);
          }
        }
      }
    },

    // Staff note: add (text only now — ratings have their own endpoint)
    {
      method: 'POST',
      path: '/admin/ai/{id}/notes',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;

          const id = request.params.id;
          const payload = request.payload || {};
          const text = (payload.text || '').toString().trim().slice(0, 2000);

          if (!text) {
            return h.redirect('/admin/ai/' + id + '?error=empty_note');
          }

          try {
            // Capture the current biography context so the note is scoped to
            // the specific version it was written against.
            const currentRecord = await biographyStore.fetchBiography(id);
            await biographyStore.addStaffNote(id, {
              staff: staffOf(request),
              text,
              biographyPromptVersion: currentRecord ? currentRecord.promptVersion : null,
              biographyGeneratedAt: currentRecord ? currentRecord.generatedAt : null,
              biographyModel: currentRecord ? currentRecord.model : null
            });
            return h.redirect('/admin/ai/' + id + '#notes');
          } catch (err) {
            console.error('Admin AI add-note error:', err.message);
            return h.redirect('/admin/ai/' + id + '?error=note_failed');
          }
        }
      }
    },

    // Public reports: mark all as reviewed
    //
    // Updates totalFlagsAtLastReview = totalFlags so the "unreviewed" count
    // on the admin UI drops to zero. Does NOT change the record's status —
    // if a staff member wants to return to 'live' they use the status dropdown.
    // Two orthogonal concepts, deliberately kept separate.
    {
      method: 'POST',
      path: '/admin/ai/{id}/flags/reviewed',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;

          const id = request.params.id;
          try {
            await flagStore.clearPending(id, { reviewer: staffOf(request) });
            return h.redirect('/admin/ai/' + id + '#public-reports');
          } catch (err) {
            console.error('Admin AI mark-reviewed error for', id, '-', err.message);
            return h.redirect('/admin/ai/' + id + '?error=mark_reviewed_failed');
          }
        }
      }
    },

    // Staff flag: set or clear (one per staff member per record, upsert)
    {
      method: 'POST',
      path: '/admin/ai/{id}/flag',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;

          const id = request.params.id;
          const payload = request.payload || {};
          const reason = (payload.reason || '').toString();
          // All allowed reasons are "a problem has been identified" signals.
          // Empty string means "clear my flag". Clearing does NOT auto-unset
          // the record's status — that's a deliberate staff action.
          const validReasons = ['', 'inaccurate', 'wrong_tone', 'wrong_subject'];

          if (validReasons.indexOf(reason) === -1) {
            return h.redirect('/admin/ai/' + id + '?error=invalid_flag_reason');
          }

          const staff = staffOf(request);

          try {
            if (!reason) {
              await biographyStore.clearStaffFlag(id, staff);
            } else {
              const currentRecord = await biographyStore.fetchBiography(id);
              await biographyStore.setStaffFlag(id, staff, reason, {
                biographyPromptVersion: currentRecord ? currentRecord.promptVersion : null,
                biographyGeneratedAt: currentRecord ? currentRecord.generatedAt : null,
                biographyModel: currentRecord ? currentRecord.model : null
              });
              // Setting a flag = "this needs attention". Auto-promote status
              // to 'flagged' so the record shows up in the triage queue. Only
              // promote from 'live' — stronger states (hidden, insufficient_data)
              // stay intact.
              if (currentRecord && currentRecord.status === 'live') {
                await biographyStore.updateStatus(id, 'flagged');
              }
            }
            return h.redirect('/admin/ai/' + id + '#flag');
          } catch (err) {
            console.error('Admin AI staff-flag error:', err.message);
            return h.redirect('/admin/ai/' + id + '?error=flag_failed');
          }
        }
      }
    },

    // Staff note: delete
    {
      method: 'POST',
      path: '/admin/ai/{id}/notes/delete',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;

          const id = request.params.id;
          const sk = request.payload && request.payload.sk;
          if (!sk || sk.indexOf('STAFF_NOTE#') !== 0) {
            return h.redirect('/admin/ai/' + id + '?error=invalid_note');
          }
          try {
            await biographyStore.deleteStaffNote(id, sk);
            return h.redirect('/admin/ai/' + id + '#notes');
          } catch (err) {
            console.error('Admin AI delete-note error:', err.message);
            return h.redirect('/admin/ai/' + id + '?error=note_delete_failed');
          }
        }
      }
    },

    // Delete
    {
      method: 'POST',
      path: '/admin/ai/{id}/delete',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;

          const id = request.params.id;

          try {
            await biographyStore.deleteBiography(id);
            return h.redirect('/admin/ai');
          } catch (err) {
            console.error('Admin AI delete error:', err.message);
            return h.redirect('/admin/ai?error=delete_failed');
          }
        }
      }
    },

    // AI review — run the triage reviewer on the current biography content.
    // Synchronous: staff waits the 10-30s on the server while Opus processes.
    // Matches the existing Regenerate button UX (form-POST, redirect back).
    // Kill switch: config.aiBiographyReviewEnabled must be true, otherwise
    // the route short-circuits to 404 so a stray button click (e.g. from
    // a cached page) can't incur cost.
    {
      method: 'POST',
      path: '/admin/ai/{id}/review',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;
          if (!config.aiBiographyReviewEnabled) {
            return h.response({ error: 'Review feature not enabled' }).code(404);
          }
          const id = request.params.id;
          try {
            const record = await biographyStore.fetchBiography(id);
            if (!record || !record.biographyHtml) {
              return h.redirect('/admin/ai/' + id + '?error=nothing_to_review');
            }

            // Pull the live wikidata context and public-flag aggregate so
            // the reviewer has all the signal the public visitor's report
            // was based on. wikidata is best-effort — a miss degrades the
            // review but doesn't fail it.
            let wikidataContext = null;
            const qCode = normaliseWikidata.getQCode(record.wikidata);
            if (qCode) {
              try { wikidataContext = await fetchWikidataLive(qCode); } catch (err) {
                console.warn('Admin review: wikidata fetch failed for', qCode, '-', err.message);
              }
            }
            const rawPublicFlags = await flagStore.getFlags(id).catch(function () { return null; });
            const reportCounts = {};
            if (rawPublicFlags) {
              Object.keys(rawPublicFlags).forEach(function (k) {
                if (k.indexOf('count_') === 0 && k.indexOf('count_pending_') !== 0) {
                  reportCounts[k.slice('count_'.length)] = rawPublicFlags[k];
                }
              });
            }

            // Reconstruct the subject data from the canonical record —
            // prefer what was stored at generation time (so the review
            // matches what was actually reviewed), fall back to live ES.
            let personData = record.personData;
            if (!personData) {
              try {
                const esResult = await elastic.get({
                  index: config.elasticIndex || 'ciim',
                  id: TypeMapping.toInternal(id)
                });
                personData = extractPersonData(esResult.body._source);
              } catch (err) {
                console.warn('Admin review: ES fetch failed for', id, '-', err.message);
                personData = { name: record.personName };
              }
            }

            const result = await reviewBiography.reviewBiography({
              biographyHtml: record.biographyHtml,
              contextHtml: record.contextHtml,
              personData,
              wikidataContext,
              reportCounts,
              apiKey: config.anthropicApiKey,
              model: config.aiBiographyReviewModel
            });

            await biographyStore.addReview(id, {
              reviewModel: result.model,
              reviewPromptVersion: result.promptVersion,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              createdBy: staffOf(request),
              // Anchor to the biography version being reviewed so we can
              // mark this review as stale if the biography is regenerated.
              biographyPromptVersion: record.promptVersion || null,
              biographyGeneratedAt: record.generatedAt || null,
              biographyModel: record.model || null,
              // Findings payload (structured JSON from Opus, validated)
              overallVerdict: result.findings.overallVerdict,
              verdictReasoning: result.findings.verdictReasoning,
              offensive: result.findings.offensive,
              factualIssues: result.findings.factualIssues,
              identityConfidence: result.findings.identityConfidence
            });

            return h.redirect('/admin/ai/' + id + '#reviews');
          } catch (err) {
            console.error('Admin AI review error for', id, '-', err.message);
            return h.redirect('/admin/ai/' + id + '?error=review_failed');
          }
        }
      }
    },

    // AI review — delete a specific review by its SK. Used for pruning
    // stale or superseded reviews from the detail page.
    {
      method: 'POST',
      path: '/admin/ai/{id}/reviews/delete',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;
          const id = request.params.id;
          const sk = request.payload && request.payload.sk;
          if (!sk || sk.indexOf('REVIEW#') !== 0) {
            return h.redirect('/admin/ai/' + id + '?error=invalid_review');
          }
          try {
            await biographyStore.deleteReview(id, sk);
            return h.redirect('/admin/ai/' + id + '#reviews');
          } catch (err) {
            console.error('Admin AI review-delete error:', err.message);
            return h.redirect('/admin/ai/' + id + '?error=review_delete_failed');
          }
        }
      }
    },

    // -------------------------------------------------------------------
    // v2 sentence-level curator actions
    //
    // The five routes below back the per-sentence action forms rendered
    // by the sentence-level view in templates/pages/admin-ai-detail.html
    // (approve / reject / clarify / verify) plus one route for review-
    // finding resolution. All follow the same POST-then-redirect pattern
    // used by /status, /flag, /notes above — post-redirect-get keeps
    // browser back-button behaviour sane and lets the redirect target
    // (the detail page) re-fetch fresh state.
    //
    // Curator identity is captured via the existing staffOf(request)
    // helper — same field already used for note authorship and review
    // triggers, so no new plumbing.
    // -------------------------------------------------------------------

    {
      method: 'POST',
      path: '/admin/ai/{id}/sentences/approve',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;
          const id = request.params.id;
          const payload = request.payload || {};
          const claimSignature = (payload.claimSignature || '').toString().trim();
          const claimText = (payload.claimText || '').toString().trim() || null;
          const note = (payload.note || '').toString().trim() || null;
          if (!claimSignature) {
            return h.redirect('/admin/ai/' + id + '?error=missing_claim_signature');
          }
          try {
            // Task 60: capture the sentence's precedingState + auto-resolve
            // any attached pending findings. Approval → attached findings
            // resolve as 'dismissed' (curator disagreed with reviewer). Load
            // BEFORE writing so the state we capture is genuinely the
            // "before" state.
            const staff = staffOf(request);
            const { precedingState, pendingFindingsByReviewSK } =
              await loadPrecedingStateAndPendingFindings(id, claimSignature, config);
            await curatorDecisionsStore.addApproval(id, {
              claimSignature, claimText, note, approvedBy: staff, precedingState
            });
            await autoResolvePendingFindings(id, claimSignature, 'dismissed', staff, pendingFindingsByReviewSK);
            // Approval is instant-render (source-tag filter override) —
            // no regen needed, jump back to the biography anchor.
            return h.redirect('/admin/ai/' + id + '#biography');
          } catch (err) {
            console.error('Admin AI sentence-approve error:', err.message);
            return h.redirect('/admin/ai/' + id + '?error=approve_failed');
          }
        }
      }
    },

    {
      method: 'POST',
      path: '/admin/ai/{id}/sentences/reject',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;
          const id = request.params.id;
          const payload = request.payload || {};
          const claimSignature = (payload.claimSignature || '').toString().trim();
          const claimText = (payload.claimText || '').toString().trim() || null;
          const rationale = (payload.rationale || '').toString().trim() || null;
          if (!claimSignature) {
            return h.redirect('/admin/ai/' + id + '?error=missing_claim_signature');
          }
          try {
            // Task 60: capture precedingState + auto-resolve pending
            // findings. Rejection → findings resolve as 'accepted'
            // (curator agreed with reviewer's concern).
            const staff = staffOf(request);
            const { precedingState, pendingFindingsByReviewSK } =
              await loadPrecedingStateAndPendingFindings(id, claimSignature, config);
            await curatorDecisionsStore.addRejection(id, {
              claimSignature, claimText, rationale, rejectedBy: staff, precedingState
            });
            await autoResolvePendingFindings(id, claimSignature, 'accepted', staff, pendingFindingsByReviewSK);
            // Rejection changes writer constraints, so the regen banner
            // will fire on next render. No auto-regen (per the plan).
            return h.redirect('/admin/ai/' + id + '#biography');
          } catch (err) {
            console.error('Admin AI sentence-reject error:', err.message);
            return h.redirect('/admin/ai/' + id + '?error=reject_failed');
          }
        }
      }
    },

    {
      method: 'POST',
      path: '/admin/ai/{id}/sentences/clarify',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;
          const id = request.params.id;
          const payload = request.payload || {};
          const claimSignature = (payload.claimSignature || '').toString().trim();
          const claimText = (payload.claimText || '').toString().trim() || null;
          const clarification = (payload.clarification || '').toString().trim();
          if (!claimSignature) {
            return h.redirect('/admin/ai/' + id + '?error=missing_claim_signature');
          }
          if (!clarification) {
            return h.redirect('/admin/ai/' + id + '?error=missing_clarification');
          }
          try {
            // Task 60: capture precedingState + auto-resolve pending
            // findings. Clarify → findings resolve as 'clarified'
            // (curator addressed the concern via regen guidance).
            const staff = staffOf(request);
            const { precedingState, pendingFindingsByReviewSK } =
              await loadPrecedingStateAndPendingFindings(id, claimSignature, config);
            await curatorDecisionsStore.addClarification(id, {
              claimSignature, claimText, clarification, addedBy: staff, precedingState
            });
            await autoResolvePendingFindings(id, claimSignature, 'clarified', staff, pendingFindingsByReviewSK);
            // Clarification changes writer prompt, so the regen banner
            // will fire on next render. No auto-regen.
            return h.redirect('/admin/ai/' + id + '#biography');
          } catch (err) {
            console.error('Admin AI sentence-clarify error:', err.message);
            return h.redirect('/admin/ai/' + id + '?error=clarify_failed');
          }
        }
      }
    },

    // Verify a claim (either a sentence body OR a review-finding concern)
    // against configured external sources. Same code path either way —
    // verifyExternal is agnostic about who's asking. Behaviour split by
    // `context`:
    //   - 'sentence' (default): if verdict=supported, promote the
    //     sentence's source tag to llm:validated:<toolName> so it
    //     publishes at Level 4. If verdict!=supported, no biography
    //     mutation — the query-string flash surfaces the verdict text
    //     so the curator sees why nothing changed.
    //   - 'finding': attach the verdict to the finding on the parent
    //     REVIEW# item so the template's finding__verification block
    //     renders it inline. Curator uses that evidence to decide
    //     accept vs dismiss on the finding.
    // Both paths require aiBiographyExternalValidationEnabled — if
    // disabled, the route redirects with an error and never bills.
    {
      method: 'POST',
      path: '/admin/ai/{id}/sentences/verify',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;
          const id = request.params.id;
          const payload = request.payload || {};
          const claimSignature = (payload.claimSignature || '').toString().trim();
          const claimText = (payload.claimText || '').toString().trim();
          const context = (payload.context || 'sentence').toString().trim();
          const reviewSK = (payload.reviewSK || '').toString().trim() || null;

          if (!config.aiBiographyExternalValidationEnabled) {
            return h.redirect('/admin/ai/' + id + '?error=external_validation_disabled');
          }
          if (!claimSignature || !claimText) {
            return h.redirect('/admin/ai/' + id + '?error=missing_claim_signature');
          }

          try {
            const record = await biographyStore.fetchBiography(id);
            if (!record) return h.redirect('/admin/ai/' + id + '?error=record_missing');

            // Assemble subject context for the tools. Q-code lives on the
            // wikidata block if it was captured at generation time; name
            // is on the record. If Q-code is absent, Wikipedia can still
            // work (name-based article lookup) but wikidata-deep will
            // skip.
            const subject = {
              id,
              name: record.personName || record.name || null,
              wikidataQCode: (record.wikidata && record.wikidata.qcode) || record.wikidataQCode || null
            };

            const verdict = await verifyExternal(claimText, subject, {
              apiKey: config.anthropicApiKey,
              // Task 52 will surface a config toggle for individual tool
              // enable/disable; MVP uses the full REGISTRY (wikipedia +
              // wikidataDeep).
              toolNames: null
            });

            if (context === 'finding' && reviewSK) {
              // Fold the verdict into the finding on the REVIEW# item so
              // the template's finding__verification block renders it.
              // We read the review, find the finding by claimSignature,
              // attach verificationResult, and write back — the
              // review-store's canonical mutate pattern.
              try {
                const review = await reviewStore.getReview(id, reviewSK);
                if (review && Array.isArray(review.findings)) {
                  review.findings.forEach(function (f) {
                    if (f.claimSignature === claimSignature) {
                      f.verificationResult = {
                        verdict: verdict.verdict,
                        confidence: verdict.confidence,
                        reasoning: verdict.reasoning,
                        sourceUrl: verdict.sourceUrl,
                        ranAt: new Date().toISOString(),
                        ranBy: staffOf(request)
                      };
                    }
                  });
                  await dynamo.put(review);
                }
              } catch (err) {
                console.warn('Admin AI verify: could not attach verdict to finding', err.message);
              }
            } else if (context === 'sentence' && verdict.verdict === 'supported') {
              // Promote the sentence's source tag so it publishes at
              // Level 4. Mutate in place; other sentence fields
              // untouched. If the sentence isn't found (rare — stale
              // signature after a regen), skip silently — nothing to
              // promote.
              const toolName = (verdict.evidence && verdict.evidence[0] && verdict.evidence[0].toolName) || 'external';
              const promoted = (record.sentences || []).map(function (s) {
                if (s.claimSignature === claimSignature) {
                  return Object.assign({}, s, { source: 'llm:validated:' + toolName });
                }
                return s;
              });
              await biographyStore.saveBiography(id, Object.assign({}, record, {
                sentences: promoted
              }));
            }

            const flash = 'verified=' + encodeURIComponent(verdict.verdict) +
              '&confidence=' + encodeURIComponent(verdict.confidence);
            return h.redirect('/admin/ai/' + id + '?' + flash + '#biography');
          } catch (err) {
            console.error('Admin AI sentence-verify error:', err.message);
            return h.redirect('/admin/ai/' + id + '?error=verify_failed');
          }
        }
      }
    },

    // Resolve a review finding — Accept applies as a curator rejection
    // on the affected sentence (regen-triggering); Dismiss marks
    // resolved with no biography change; Clarified is the manual
    // "curator has attached a clarification and considers the finding
    // addressed" path (typically reached via the sentence-level
    // Clarify action followed by explicit Resolve).
    {
      method: 'POST',
      path: '/admin/ai/{id}/findings/resolve',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;
          const id = request.params.id;
          const payload = request.payload || {};
          const reviewSK = (payload.reviewSK || '').toString().trim();
          const claimSignature = (payload.claimSignature || '').toString().trim();
          const claimText = (payload.claimText || '').toString().trim() || null;
          const resolution = (payload.resolution || '').toString().trim();
          if (!reviewSK || !claimSignature) {
            return h.redirect('/admin/ai/' + id + '?error=missing_finding_ids');
          }
          if (['accepted', 'dismissed', 'clarified'].indexOf(resolution) === -1) {
            return h.redirect('/admin/ai/' + id + '?error=invalid_resolution');
          }
          try {
            await reviewStore.updateFindingResolution(id, reviewSK, claimSignature, {
              resolution, resolvedBy: staffOf(request)
            });
            // If curator Accepted the finding, cascade to a curator
            // rejection on the sentence with the reviewer's concern as
            // the rationale. That way the accepted verdict actually
            // affects rendering (hides the sentence) AND regen (excludes
            // it from next writer prompt) — otherwise a lone finding-
            // resolution has no visible effect until the next review
            // runs.
            if (resolution === 'accepted') {
              await curatorDecisionsStore.addRejection(id, {
                claimSignature,
                claimText,
                rationale: 'Accepted from reviewer finding',
                rejectedBy: staffOf(request)
              });
            }
            return h.redirect('/admin/ai/' + id + '#findings');
          } catch (err) {
            console.error('Admin AI finding-resolve error:', err.message);
            return h.redirect('/admin/ai/' + id + '?error=resolve_failed');
          }
        }
      }
    }
  ];
};

const DESCRIPTION_MAX_CHARS = 200;

function truncateDescription (text) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (trimmed.length <= DESCRIPTION_MAX_CHARS) return trimmed;
  return trimmed.slice(0, DESCRIPTION_MAX_CHARS).replace(/\s+\S*$/, '') + '…';
}

/**
 * Full regenerate pipeline — fetch ES source, extract person data, fetch related
 * items and Wikidata, call Claude, save to DynamoDB. Reused by both the "regenerate
 * with active prompt" and "regenerate with specific prompt version" paths.
 */
async function runRegenerate (elastic, config, id, promptVersion, opts) {
  opts = opts || {};
  // Optional overrides (used by the compare-page A/B + workshop tooling):
  //   opts.model         — one-off model override, ignored if unknown
  //   opts.customPrompt  — { systemPrompt, userPromptTemplate, label } to use an
  //                        ad-hoc prompt instead of a registered version
  const modelOverride = (opts.model && modelsRegistry.isKnown(opts.model)) ? opts.model : null;
  const customPrompt = opts.customPrompt || null;

  // snapshotOnly: caller decides. All compare-page regenerations are
  // snapshot-only; the plain detail-page "Regenerate" is not. Required —
  // the route always passes it explicitly.
  const snapshotOnly = !!opts.snapshotOnly;
  const esResult = await elastic.get({
    index: config.elasticIndex || 'ciim',
    id: TypeMapping.toInternal(id)
  });
  const source = esResult.body._source;
  const personData = extractPersonData(source);

  let sortedRelated = { relatedObjects: [], relatedDocuments: [] };
  try {
    const relatedItems = await getRelatedItems(elastic, id);
    sortedRelated = sortRelated(relatedItems, id);
  } catch (err) {
    console.debug('Admin regenerate: Could not fetch related items:', err.message);
  }

  const allItems = flattenRelated(sortedRelated);

  let wikidataContext = null;
  const qCode = normaliseWikidata.getQCode(personData.wikidata);
  if (qCode) {
    try {
      wikidataContext = await fetchWikidataLive(qCode);
      if (!wikidataContext) {
        console.warn('Admin regenerate: Wikidata fetch for', qCode, '(', id, ') returned no usable properties');
      } else {
        console.log('Admin regenerate: Wikidata fetch OK for', qCode, '(', id, ') - keys:', Object.keys(wikidataContext).join(', '));
      }
    } catch (err) {
      console.warn('Admin regenerate: Wikidata fetch failed for', qCode, '(', id, ') -', err.message);
    }
  }

  // Living-people policy. Only applies to subjects classified as 'person' —
  // companies and organisations are always eligible regardless of whether
  // we have a dissolution date, because:
  //   - defamation / reputational risk is much lower for corporations
  //   - dissolution dates are unreliably recorded; many "active" records
  //     are actually defunct. Excluding them all would miss a lot of
  //     legitimately historical subjects.
  // Classify and capture subject status. Both travel with the canonical
  // record — `subjectStatus.isLiving` is what the public route's living-person
  // suppression reads when deciding whether to serve the content. Admin
  // regeneration always generates regardless of living status; visibility
  // is a render-time concern, not a generation-time one.
  const subject = classifySubject(personData, wikidataContext);
  const subjStatus = subjectStatus.inspect(personData, wikidataContext, subject.noun);

  // Pre-flight data-sufficiency check. Skip the Claude API call entirely if
  // the source data is too thin to support a meaningful biography — avoids
  // cost, hallucination risk, and ambiguous-name confusion.
  const assessment = assessSufficiency.assess(
    personData, allItems, wikidataContext, config.aiBiographyMinSignals
  );
  if (!assessment.sufficient) {
    console.log('Admin regenerate: insufficient data for', id,
      '—', assessment.signalCount, '/', assessment.totalSignals,
      'signals, minimum score', assessment.minScore, 'required.');
    if (!snapshotOnly) {
      await biographyStore.saveBiography(id, {
        status: 'insufficient_data',
        skipReason: assessSufficiency.skipReason(assessment),
        personName: personData.name,
        pageUrl: '/people/' + id,
        existingDescriptionChars: personData.descriptionChars,
        signalScore: assessment.score,
        signalMaxScore: assessment.maxScore,
        signalCount: assessment.signalCount,
        signalsPresent: assessment.present,
        signalsMissing: assessment.missing
      });
    }
    return { id, status: 'insufficient_data' };
  }

  const useModel = modelOverride || config.aiBiographyModel;

  // Compare-view workshop (customPrompt + promptVersion selection) hasn't
  // been ported to the v2 source-tagged writer yet — those params go
  // through the v1 code path which now returns "missing biography field"
  // for source-tagged prompts. Log clearly so a staff member using
  // compare knows the workshop path is temporarily degraded; the primary
  // "Regenerate" from detail page (no overrides) works fine on v2.
  if (customPrompt || promptVersion) {
    console.warn('Admin regenerate: customPrompt / promptVersion overrides are not yet wired to the v2 source-tagged writer (task 51 MVP scope). Ignoring overrides and using the default v2 pipeline for id', id);
  }

  // Curator decisions from prior review sessions — folds
  // rejections + clarifications back into the writer prompt as
  // subject-specific constraints so the regen doesn't reintroduce
  // previously-rejected claims.
  const curatorDecisions = await curatorDecisionsStore.get(id).catch(function () { return null; });

  const diagnostics = {};
  let result;
  try {
    result = await generateSourceTaggedBiography(personData, allItems, wikidataContext, {
      apiKey: config.anthropicApiKey,
      model: useModel,
      curatorDecisions,
      diagnostics
    });
  } catch (err) {
    console.error('Admin regenerate: unexpected error from v2 writer for', id, '-', err.message);
    throw new Error('Generation failed: ' + err.message);
  }

  if (!result) {
    // v2 writer returned null: either the API call failed (network / SDK
    // caught the error — no bill) OR the response was unusable (billed).
    // Same policy as the pre-v2 runRegenerate: do NOT persist as
    // insufficient_data — that would silently clobber a healthy live
    // record on a transient blip. Staff sees the error redirect and
    // can retry; if it keeps failing they'll see the reason in the
    // preceding log line + (via the public route's persistence) on the
    // admin detail page's diagnostics block on next page hit.
    console.warn('Admin regenerate: v2 writer returned null for', id,
      '— canonical record unchanged.',
      '· failureMode:', diagnostics.failureMode || 'unknown',
      '· promptVersion:', diagnostics.promptVersion || 'unknown');
    throw new Error('Generation returned null (transient); check logs and retry');
  }

  // v2 threshold constant — same 0-10 self-reported confidence gate as v1.
  const V2_CONFIDENCE_INSUFFICIENT_AT_OR_BELOW = 2;
  const status = result.confidence <= V2_CONFIDENCE_INSUFFICIENT_AT_OR_BELOW
    ? 'insufficient_data'
    : 'live';

  // Per-generation reviewer — same policy as the public route. Gated
  // on aiBiographyPerGenerationReviewEnabled (NOT aiBiographyReviewEnabled
  // — that's the Opus manual escalation button, different reviewer +
  // model). Uses the writer's model (Sonnet-tier) for cost parity with
  // the public route.
  let reviewResult = null;
  if (config.aiBiographyPerGenerationReviewEnabled !== false) {
    try {
      reviewResult = await reviewBiographyTagged(result, {
        apiKey: config.anthropicApiKey,
        model: config.aiBiographyModel,
        personData,
        gbpPerUsd: config.aiBiographyGbpPerUsd
      });
    } catch (err) {
      console.warn('Admin regenerate: per-generation review failed for', id, '-', err && err.message);
    }
  }

  // See routes/ai-biography.js for why references + systemPrompt +
  // prompt + rawResponse land on the record. Same treatment in both
  // places so admin-triggered regenerations get the same audit trail
  // as page-hit generations.
  const references = deriveAdminReferencesFromSentences(result.sentences, allItems);

  await biographyStore.saveBiography(id, {
    status,
    personName: personData.name,
    pageUrl: '/people/' + id,
    existingDescriptionChars: personData.descriptionChars,
    sentences: result.sentences,
    paragraphBreaks: result.paragraphBreaks,
    writerConfidence: result.confidence,
    writerNotes: result.notes,
    verificationCandidates: result.verificationCandidates,
    references,
    model: result.model,
    promptVersion: result.promptVersion,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    systemPrompt: result.systemPrompt || null,
    prompt: result.prompt || null,
    rawResponse: result.rawResponse || null,
    signalScore: assessment.score,
    signalMaxScore: assessment.maxScore,
    signalCount: assessment.signalCount,
    signalsPresent: assessment.present,
    signalsMissing: assessment.missing,
    subjectStatus: subjStatus,
    // Legacy customPromptLabel field kept for compare-view snapshot
    // distinguishability; currently always null on v2 (workshop path
    // not yet wired).
    customPromptLabel: null,
    skipReason: result.confidence <= V2_CONFIDENCE_INSUFFICIENT_AT_OR_BELOW
      ? 'Low confidence (writer self-reported ' + result.confidence + '/10) on regeneration'
      : undefined
  }, { snapshotOnly });

  // Save the review as a REVIEW# item — mirrors the public route's
  // ordering (biography first, then review). Snapshot-only regens
  // still emit a review (the snapshot doesn't have per-review-run
  // metadata otherwise); on the canonical path this feeds directly
  // into the admin detail's openFindings panel.
  if (reviewResult && Array.isArray(reviewResult.findings) && !snapshotOnly) {
    try {
      await reviewStore.saveReview(id, {
        reviewedAt: new Date().toISOString(),
        reviewerModel: reviewResult.model,
        spend: reviewResult.spend,
        inputTokens: reviewResult.inputTokens,
        outputTokens: reviewResult.outputTokens,
        findings: reviewResult.findings
      });
    } catch (err) {
      console.warn('Admin regenerate: review-store save failed for', id, '-', err && err.message);
    }
  }

  return { id, status, snapshotOnly };
}

function flattenRelated (sortedRelated) {
  const items = [];
  (sortedRelated.relatedObjects || []).forEach(function (item) {
    items.push({
      id: item.id,
      title: (item.attributes && item.attributes.summary_title) || item.title || item.name || '',
      description: truncateDescription(item.attributes && item.attributes.description),
      link: item.links ? item.links.self : '/objects/' + item.id,
      type: 'object',
      role: item.role || ''
    });
  });
  (sortedRelated.relatedDocuments || []).forEach(function (item) {
    items.push({
      id: item.id,
      title: (item.attributes && item.attributes.summary_title) || item.title || item.name || '',
      description: truncateDescription(item.attributes && item.attributes.description),
      link: item.links ? item.links.self : '/documents/' + item.id,
      type: 'document',
      role: item.role || ''
    });
  });
  return items;
}
