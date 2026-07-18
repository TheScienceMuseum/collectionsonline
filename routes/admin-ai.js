'use strict';

const adminAuth = require('../lib/ai/admin-auth');
const antiPatterns = require('../lib/ai/anti-patterns');
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
const curatorDecisionsStore = require('../lib/ai/curator-decisions-store');
const reviewStore = require('../lib/ai/review-store');
const renderBiography = require('../lib/ai/render-biography');
const verifyExternal = require('../lib/ai/verify-external');
const generateSourceTaggedBiography = require('../lib/ai/generate-source-tagged-biography');
const regenerateBiography = require('../lib/ai/regenerate-biography');
const flattenRelated = regenerateBiography.flattenRelated;
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
async function loadPrecedingStateAndFindings (id, claimSignature, config) {
  const [record, decisions, reviews] = await Promise.all([
    biographyStore.fetchBiography(id),
    curatorDecisionsStore.get(id).catch(function () { return null; }),
    reviewStore.listReviews(id).catch(function () { return []; })
  ]);
  if (!record || !Array.isArray(record.sentences)) {
    return { precedingState: null, findingsByReviewSK: [] };
  }
  // All findings across all reviews — render's finding gate uses
  // kind + confidence, not resolution, so we need the full set.
  //
  // findingsByReviewSK collects every review that has ANY finding for
  // this signature — not just pending ones. Curator reversals (approve
  // → reject and vice versa) need to overwrite the prior finding
  // resolution too. Restricting to pending here left "dismissed"
  // traces orphaned on the audit trail whenever a curator flipped
  // their decision.
  const allFindings = [];
  const findingsByReviewSK = [];
  reviews.forEach(function (rv) {
    let matched = false;
    (rv.findings || []).forEach(function (f) {
      allFindings.push(f);
      if (f.claimSignature === claimSignature) matched = true;
    });
    if (matched) findingsByReviewSK.push({ reviewSK: rv.SK });
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
    findingsByReviewSK
  };
}

// Fire-and-await a batch of finding auto-resolutions. Errors on
// individual resolutions are logged but non-fatal — the curator's
// primary action (approve/reject/clarify) already committed.
async function autoResolveFindings (id, claimSignature, resolution, resolvedBy, findingsByReviewSK) {
  for (const entry of (findingsByReviewSK || [])) {
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

// Task 61: compute the finding-card's status chip from the sentence's
// 3-axis state triple. Was reading the legacy publishingState enum
// (removed in Bundle B); now composes label + variant + tone directly
// from { visible, decidedBy, concern }. Same shape as before so the
// template chip renders identically.
function computeSentenceStateForFinding (sentence, finding) {
  const st = sentence && sentence.state;
  if (!st) return { label: 'unknown', variant: 'hidden', tone: 'neutral' };
  const vis = st.visible;
  const curator = st.decidedBy === 'curator';
  const concern = st.concern;

  // 5-chip design (Bundle B.6): status names either state alone or
  // state + cause via "by X". Concern severity is NOT repeated — it
  // sits on the kind pill next to this chip. The intro paragraph
  // at the top of the panel explains the general policy
  // ("Likely-error findings auto-hide, others publish automatically").
  if (vis) {
    if (curator) return { label: 'publishing (curator override)', variant: 'publishing', tone: 'positive' };
    return { label: 'publishing', variant: 'publishing', tone: 'positive' };
  }
  if (curator) return { label: 'hidden by curator', variant: 'hidden', tone: 'danger' };
  if (concern === 'block') return { label: 'hidden by this finding', variant: 'hidden', tone: 'danger' };
  return { label: 'hidden by filter', variant: 'hidden', tone: 'muted' };
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
          // Set by POST /admin/ai/generate when the input didn't parse into
          // a valid ID; template renders an inline hint next to the form.
          const generateError = request.query.error === 'generate_invalid_input';
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
              nextKey: null,
              generateError
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
              headlineStats,
              generateError
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
              generateError,
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
              // ?generating=1 arrives on the redirect from POST /admin/ai/generate
              // — the record hasn't landed in DynamoDB yet because runRegenerate
              // is running in the background. The template renders a
              // "generation in progress" panel with meta-refresh polling; on
              // the refresh that catches the finished item, this handler
              // falls into the normal path below.
              return h.view('admin-ai-detail', {
                record: null,
                notFound: true,
                generating: request.query.generating === '1',
                candidateId: id
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

            // Decorate each contradiction's values[] with an isWinner
            // boolean. Keeps the template dumb — the "Other sources say"
            // sub-list uses {{#unless this.isWinner}} rather than a
            // subexpression call to the block-form isequal helper (which
            // throws Cannot-read-fn when used as a value).
            if (Array.isArray(record.contradictions)) {
              record.contradictions = record.contradictions.map(function (c) {
                if (!c || !Array.isArray(c.values)) return c;
                return Object.assign({}, c, {
                  values: c.values.map(function (v) {
                    return Object.assign({}, v, { isWinner: v && v.source === c.winner });
                  })
                });
              });
            }

            // Fetch staff notes, staff flags, public flags, all review
            // runs (for the Recently Resolved audit trail), curator
            // decisions, and open findings in parallel. curatorDecisions
            // + openFindings + rawReviews are v2-shape; they'll come back
            // null / empty for records produced by the pre-v2 pipeline,
            // which the render layer + template both tolerate.
            const [rawNotes, staffFlags, rawPublicFlags, rawReviews, curatorDecisions, rawOpenFindings] = await Promise.all([
              biographyStore.listStaffNotes(id).catch(function () { return []; }),
              biographyStore.listStaffFlags(id).catch(function () { return []; }),
              flagStore.getFlags(id).catch(function () { return null; }),
              reviewStore.listReviews(id).catch(function () { return []; }),
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

            // reviewConfig used to expose the manual Opus reviewer button.
            // With the Opus manual reviewer retired, only the external-
            // validation-enabled flag remains — which drives per-sentence
            // "Verify externally" buttons in the Claims list.
            const reviewConfig = {
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
            // Task 62: RENDER FIRST, then decorate findings against the
            // rendered sentences (which carry the 3-axis state triple).
            // The previous order — decorate first, using raw record
            // sentences that lacked `state` — made every finding card's
            // status chip fall through to the "unknown" label.
            const sortedOpenFindings = sortOpenFindings(rawOpenFindings || []);
            const currentSentences = (record && record.sentences) || [];
            const openFindingsFiltered = findingFilters.filterToCurrentSentences(sortedOpenFindings, currentSentences);
            const staleOpenFindings = findingFilters.collectStale(sortedOpenFindings, currentSentences);
            const staleFindingsCount = staleOpenFindings.length;
            const allResolvedFindings = collectResolvedFindings(rawReviews);

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
                  return Object.assign({}, rendered, { totalCount: rendered.sentences.length });
                })()
              : null;

            // Findings — pre-decorate here so the template stays declarative.
            //
            //   affectedSentenceIndex — index of the current sentence with
            //     matching claimSignature (null when the finding is stale
            //     against the current biography).
            //   affectedPublishingState — the sentence's current publishing
            //     state triple, mapped to a status chip via
            //     computeSentenceStateForFinding. Drives the prominent
            //     green/red/amber chip on each finding card.
            //
            // Task 62 fix: the lookup map is now built from
            // renderedBiography.sentences (which carry the `state`
            // triple) rather than the raw record.sentences (which don't).
            const decoratorSentences = renderedBiography ? renderedBiography.sentences : [];
            const sentenceByCurrentSignature = new Map();
            decoratorSentences.forEach(function (s, i) {
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

            // Task 62: sort blocking-effect findings first (findings
            // whose sentence is currently hidden by them), then keep the
            // existing severity ordering within each group. Curator's
            // eye lands on the actively-hiding concerns first.
            const decoratedOpen = openFindingsFiltered.map(decorateFinding);
            const openFindings = decoratedOpen.slice().sort(function (a, b) {
              const aBlocking = a.affectedPublishingState && a.affectedPublishingState.variant === 'hidden' ? 1 : 0;
              const bBlocking = b.affectedPublishingState && b.affectedPublishingState.variant === 'hidden' ? 1 : 0;
              if (aBlocking !== bBlocking) return bBlocking - aBlocking; // hidden first
              return 0; // preserve severity order within group
            });
            const openFindingsHidingCount = openFindings.filter(function (f) {
              return f.affectedPublishingState && f.affectedPublishingState.variant === 'hidden';
            }).length;
            const openFindingsAnnotatingCount = openFindings.length - openFindingsHidingCount;

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

            const pendingChangeCount = computePendingChanges(curatorDecisions, record.generatedAt);
            const regenRecommended = pendingChangeCount > 0;
            const pendingChangeSingular = pendingChangeCount === 1;

            return h.view('admin-ai-detail', {
              record,
              notes,
              reviewConfig,
              renderedBiography,
              openFindings,
              openFindingsHidingCount,
              openFindingsAnnotatingCount,
              staleFindingsCount,
              staleOpenFindings,
              publishingLevelDescription: (renderedBiography && Number.isInteger(renderedBiography.publishingLevel))
                ? renderBiography.describeLevel(renderedBiography.publishingLevel)
                : null,
              resolvedFindings,
              resolvedOverflow,
              resolvedOverflowCount,
              regenRecommended,
              pendingChangeCount,
              pendingChangeSingular,
              myCurrentFlag,
              otherFlags,
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

    // Generate for a specific record — accepts either a public URL
    // (e.g. /people/cp37054/albert-einstein) or a bare ID (cp37054). Used
    // from the admin dashboard's "Generate for record" panel to seed
    // biographies for records that don't have one yet. Fires
    // runRegenerate() in the background (not awaited) and redirects
    // straight to the detail page with ?generating=1 — the template
    // renders a polling "in progress" panel that flips to the normal
    // detail view once the write lands.
    {
      method: 'POST',
      path: '/admin/ai/generate',
      config: {
        auth: false,
        payload: {
          output: 'data',
          parse: true,
          allow: ['application/x-www-form-urlencoded', 'application/json']
        },
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;

          const raw = ((request.payload || {}).input || '').toString();
          const parsed = parseSearch(raw);
          if (!parsed || parsed.kind !== 'id') {
            // Nothing resolved to an ID — send the curator back to the
            // dashboard with an error param so the panel can show a hint.
            return h.redirect('/admin/ai?error=generate_invalid_input');
          }
          const id = parsed.id;

          // Fire-and-forget. Errors here are logged but don't reach the
          // browser directly — the curator sees them via the failure
          // diagnostics that runRegenerate persists on the BIOGRAPHY item.
          regenerateBiography(elastic, config, id).catch(function (err) {
            console.error('Admin AI generate (background) error for', id, '-', err && err.message);
          });

          return h.redirect('/admin/ai/' + id + '?generating=1');
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
          const redirectTo = '/admin/ai/' + id;

          try {
            await regenerateBiography(elastic, config, id);
            return h.redirect(redirectTo);
          } catch (err) {
            console.error('Admin AI regenerate error:', err.message);
            return h.redirect(redirectTo + '?error=regenerate_failed');
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

    // -------------------------------------------------------------------
    // Prompt playground — workshop-style custom-prompt exploration on a
    // real record. Does NOT touch the DB — pure one-off generation for
    // demos, iterative prompt development, and staff training.
    //
    // Two routes:
    //   GET  /admin/ai/{id}/playground     — form pre-populated with the
    //                                        active prompt module's system
    //                                        + user prompt for {id}
    //   POST /admin/ai/{id}/playground/run — accepts edited prompts,
    //                                        runs a one-off Claude call,
    //                                        renders the same page with
    //                                        the result underneath
    // -------------------------------------------------------------------

    {
      method: 'GET',
      path: '/admin/ai/{id}/playground',
      config: {
        auth: false,
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;

          const id = request.params.id;
          try {
            const { personData, allItems, subject, wikidataContext } =
              await gatherPlaygroundInputs(elastic, config, id);
            return h.view('admin-ai-playground', {
              id,
              personName: personData.name,
              systemPromptDefault: prompts.systemPrompt,
              userPromptDefault: prompts.buildUserPrompt(personData, allItems, wikidataContext, subject),
              antiPatternsDefault: antiPatterns.getAntiPatternsText(),
              activeVersion: prompts.activeVersion,
              modelDefault: config.aiBiographyModel,
              systemPromptValue: null,
              userPromptValue: null,
              antiPatternsValue: null,
              modelValue: null,
              result: null,
              error: null
            }, { layout: 'admin' });
          } catch (err) {
            console.error('Admin AI playground GET error:', err.message);
            return h.response('Error loading playground: ' + err.message).code(500);
          }
        }
      }
    },

    {
      method: 'POST',
      path: '/admin/ai/{id}/playground/run',
      config: {
        auth: false,
        payload: { maxBytes: 512 * 1024 },
        handler: async function (request, h) {
          const authRedirect = requireAuth(request, h, config);
          if (authRedirect) return authRedirect;

          const id = request.params.id;
          const payload = request.payload || {};
          const systemPromptValue = (payload.systemPrompt || '').toString();
          const userPromptValue = (payload.userPrompt || '').toString();
          const antiPatternsValue = (payload.antiPatterns || '').toString();
          const modelValue = (payload.model || '').toString().trim() || config.aiBiographyModel;

          let inputs, result, error;
          try {
            inputs = await gatherPlaygroundInputs(elastic, config, id);
            // Pre-append the user's anti-patterns text to their system
            // prompt using the same header/separator the auto-append uses,
            // then tell the generator to skip its own file-based append so
            // the rules don't render twice. Empty anti-patterns text skips
            // the append entirely — playground users can iterate with
            // fewer rules by clearing the textarea.
            const trimmedAP = antiPatternsValue.trim();
            const composedSystemPrompt = trimmedAP
              ? systemPromptValue + '\n\n---\n\n## Class-wide rules (from anti-patterns.md)\n\n' + trimmedAP
              : systemPromptValue;
            const customPromptModule = {
              systemPrompt: composedSystemPrompt,
              buildUserPrompt: function () { return userPromptValue; },
              version: 'playground'
            };
            result = await generateSourceTaggedBiography(
              inputs.personData, inputs.allItems, inputs.wikidataContext, {
                apiKey: config.anthropicApiKey,
                model: modelValue,
                promptModule: customPromptModule,
                skipAntiPatterns: true
              }
            );
            if (!result) {
              error = 'Generation returned null — check the writer prompt for schema errors.';
            }
          } catch (err) {
            console.error('Admin AI playground run error:', err.message);
            error = err.message;
            inputs = inputs || await gatherPlaygroundInputs(elastic, config, id).catch(function () { return null; });
          }

          const personName = (inputs && inputs.personData && inputs.personData.name) || id;
          const cost = result
            ? modelsRegistry.calculateCost(result.model, result.inputTokens, result.outputTokens, config.aiBiographyGbpPerUsd)
            : null;

          return h.view('admin-ai-playground', {
            id,
            personName,
            systemPromptDefault: prompts.systemPrompt,
            userPromptDefault: (inputs && prompts.buildUserPrompt(inputs.personData, inputs.allItems, inputs.wikidataContext, inputs.subject)) || '',
            antiPatternsDefault: antiPatterns.getAntiPatternsText(),
            activeVersion: prompts.activeVersion,
            modelDefault: config.aiBiographyModel,
            systemPromptValue,
            userPromptValue,
            antiPatternsValue,
            modelValue,
            result: result
              ? {
                  sentences: result.sentences,
                  confidence: result.confidence,
                  notes: result.notes,
                  inputTokens: result.inputTokens,
                  outputTokens: result.outputTokens,
                  costFormatted: cost ? cost.perBioFormatted : null,
                  model: result.model
                }
              : null,
            error
          }, { layout: 'admin' });
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
            const { precedingState, findingsByReviewSK } =
              await loadPrecedingStateAndFindings(id, claimSignature, config);
            // Remove any prior rejection for the same signature — approving
            // IS taking back a rejection, and the render precedence in
            // render-biography.js unconditionally hides rejected sentences.
            // Leaving a stale rejection in the DB makes Un-reject a silent
            // no-op. This keeps at most one curator "final answer" per
            // signature and unblocks oscillation.
            await curatorDecisionsStore.removeEntry(id, 'rejection', claimSignature);
            await curatorDecisionsStore.addApproval(id, {
              claimSignature, claimText, note, approvedBy: staff, precedingState
            });
            await autoResolveFindings(id, claimSignature, 'dismissed', staff, findingsByReviewSK);
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
            const { precedingState, findingsByReviewSK } =
              await loadPrecedingStateAndFindings(id, claimSignature, config);
            // Remove any prior approval for the same signature — rejecting
            // IS taking back an approval. Symmetric with the /approve
            // handler's removeEntry('rejection') call. Keeps the DB at
            // most one curator "final answer" per signature so curators
            // can oscillate without stale entries piling up.
            await curatorDecisionsStore.removeEntry(id, 'approval', claimSignature);
            await curatorDecisionsStore.addRejection(id, {
              claimSignature, claimText, rationale, rejectedBy: staff, precedingState
            });
            await autoResolveFindings(id, claimSignature, 'accepted', staff, findingsByReviewSK);
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
            const { precedingState, findingsByReviewSK } =
              await loadPrecedingStateAndFindings(id, claimSignature, config);
            await curatorDecisionsStore.addClarification(id, {
              claimSignature, claimText, clarification, addedBy: staff, precedingState
            });
            await autoResolveFindings(id, claimSignature, 'clarified', staff, findingsByReviewSK);
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

            // Fetch wikidata live if we have a Q-code, so the GracesGuide
            // + ODNB verifiers can look up their subject identifiers
            // (P3074 for GracesGuide, P1415 for ODNB). The cache layer
            // handles repeat calls for the same subject. Failure is
            // non-fatal — verifiers that can work without it (Wikipedia
            // name-search, wikidataDeep by Q-code) still run.
            let wikidataContext = null;
            if (subject.wikidataQCode) {
              try {
                wikidataContext = await fetchWikidataLive(subject.wikidataQCode);
              } catch (err) {
                console.warn('Admin verify: wikidata fetch failed for', id, '-', err && err.message);
              }
            }

            const verdict = await verifyExternal(claimText, subject, {
              apiKey: config.anthropicApiKey,
              // Passed through to per-tool query() so ODNB / GracesGuide
              // can look up their identifiers (P1415, P3074). Wikipedia
              // + wikidataDeep don't read this field.
              wikidataContext,
              config,
              // Task 52 will surface a config toggle for individual tool
              // enable/disable; MVP uses the full REGISTRY.
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

// Assemble the ES + Wikidata inputs the writer prompt needs, for the
// prompt playground page. Same shape the generation pipeline uses;
// `flattenRelated` is re-exported from lib/ai/regenerate-biography.js
// so the playground stays in sync with the writer's actual input shape.
async function gatherPlaygroundInputs (elastic, config, id) {
  const esResult = await elastic.get({
    index: config.elasticIndex || 'ciim',
    id: TypeMapping.toInternal(id)
  });
  const personData = extractPersonData(esResult.body._source);
  let sortedRelated = { relatedObjects: [], relatedDocuments: [] };
  try {
    const relatedItems = await getRelatedItems(elastic, id);
    sortedRelated = sortRelated(relatedItems, id);
  } catch (err) {
    console.debug('Admin playground: Could not fetch related items:', err.message);
  }
  const allItems = flattenRelated(sortedRelated);
  let wikidataContext = null;
  const qCode = normaliseWikidata.getQCode(personData.wikidata);
  if (qCode) {
    try { wikidataContext = await fetchWikidataLive(qCode); } catch (err) {
      console.warn('Admin playground: Wikidata fetch failed for', qCode, '-', err.message);
    }
  }
  const subject = classifySubject(personData, wikidataContext);
  return { personData, allItems, wikidataContext, subject };
}
