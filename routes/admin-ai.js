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
const renderBiography = require('../lib/ai/render-biography');
const generateSourceTaggedBiography = require('../lib/ai/generate-source-tagged-biography');
const regenerateBiography = require('../lib/ai/regenerate-biography');
const flattenRelated = regenerateBiography.flattenRelated;
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

// (Reviewer-adjacent helpers removed with the review-store pipeline.)

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

            // Fetch staff notes, staff flags, public flags, and curator
            // decisions in parallel. curatorDecisions is v2-shape; it
            // comes back null for records produced by the pre-v2
            // pipeline, which the render layer + template both tolerate.
            const [rawNotes, staffFlags, rawPublicFlags, curatorDecisions] = await Promise.all([
              biographyStore.listStaffNotes(id).catch(function () { return []; }),
              biographyStore.listStaffFlags(id).catch(function () { return []; }),
              flagStore.getFlags(id).catch(function () { return null; }),
              curatorDecisionsStore.get(id).catch(function () { return null; })
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

            // v2 template data: sentence-level render state + the
            // regen-banner counter. Only computed for records produced
            // by the v2 writer (identified by having a sentences[]
            // array on the record).
            const hasSentences = Array.isArray(record.sentences) && record.sentences.length > 0;
            const renderedBiography = hasSentences
              ? (function () {
                  const rendered = renderBiography(record, {
                    decisions: curatorDecisions,
                    publishingLevel: config.aiBiographyPublishingLevel,
                    references: record.references || []
                  });
                  return Object.assign({}, rendered, { totalCount: rendered.sentences.length });
                })()
              : null;

            const pendingChangeCount = computePendingChanges(curatorDecisions, record.generatedAt);
            const regenRecommended = pendingChangeCount > 0;
            const pendingChangeSingular = pendingChangeCount === 1;

            return h.view('admin-ai-detail', {
              record,
              notes,
              renderedBiography,
              publishingLevelDescription: (renderedBiography && Number.isInteger(renderedBiography.publishingLevel))
                ? renderBiography.describeLevel(renderedBiography.publishingLevel)
                : null,
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
            const staff = staffOf(request);
            // Remove any prior rejection for the same signature — approving
            // IS taking back a rejection, and the render precedence in
            // render-biography.js unconditionally hides rejected sentences.
            // Leaving a stale rejection in the DB makes Un-reject a silent
            // no-op. This keeps at most one curator "final answer" per
            // signature and unblocks oscillation.
            await curatorDecisionsStore.removeEntry(id, 'rejection', claimSignature);
            await curatorDecisionsStore.addApproval(id, {
              claimSignature, claimText, note, approvedBy: staff
            });
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
            const staff = staffOf(request);
            // Remove any prior approval for the same signature — rejecting
            // IS taking back an approval. Symmetric with the /approve
            // handler's removeEntry('rejection') call. Keeps the DB at
            // most one curator "final answer" per signature so curators
            // can oscillate without stale entries piling up.
            await curatorDecisionsStore.removeEntry(id, 'approval', claimSignature);
            await curatorDecisionsStore.addRejection(id, {
              claimSignature, claimText, rationale, rejectedBy: staff
            });
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
            const staff = staffOf(request);
            await curatorDecisionsStore.addClarification(id, {
              claimSignature, claimText, clarification, addedBy: staff
            });
            // Clarification changes writer prompt, so the regen banner
            // will fire on next render. No auto-regen.
            return h.redirect('/admin/ai/' + id + '#biography');
          } catch (err) {
            console.error('Admin AI sentence-clarify error:', err.message);
            return h.redirect('/admin/ai/' + id + '?error=clarify_failed');
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
