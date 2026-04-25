'use strict';

const adminAuth = require('../lib/ai/admin-auth');
const biographyStore = require('../lib/ai/biography-store');
const dynamo = require('../lib/ai/dynamo');
const extractPersonData = require('../lib/ai/extract-person-data');
const generateBiography = require('../lib/ai/generate-biography');
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

            // Fetch staff notes, flags, snapshots, public flags, and AI
            // reviews in parallel
            const [rawNotes, snapshots, staffFlags, rawPublicFlags, rawReviews] = await Promise.all([
              biographyStore.listStaffNotes(id).catch(function () { return []; }),
              biographyStore.listHistory(id).catch(function () { return []; }),
              biographyStore.listStaffFlags(id).catch(function () { return []; }),
              flagStore.getFlags(id).catch(function () { return null; }),
              biographyStore.listReviews(id).catch(function () { return []; })
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
              const stale = !!(
                r.biographyPromptVersion &&
                record.promptVersion &&
                (
                  r.biographyPromptVersion !== record.promptVersion ||
                  (r.biographyGeneratedAt && record.generatedAt && r.biographyGeneratedAt !== record.generatedAt)
                )
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
              canRun: !!(config.aiBiographyReviewEnabled && record.biographyHtml),
              model: reviewModel,
              modelLabel: (reviewModelInfo && reviewModelInfo.label) || reviewModel,
              estimatedCost: reviewEstimate ? reviewEstimate.perBioFormatted : null
            };

            return h.view('admin-ai-detail', {
              record,
              notes,
              reviews,
              reviewConfig,
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
  const result = await generateBiography(
    personData, allItems, wikidataContext,
    config.anthropicApiKey, useModel, promptVersion, customPrompt
  );

  if (!result) {
    // Transient Claude failure (empty response / JSON parse error /
    // missing biography field in the response — all logged by
    // generateBiography itself). Do NOT persist as insufficient_data:
    // that would silently mark an otherwise-healthy record dormant, and
    // the sufficiency pre-check above has already gated on genuine data
    // thinness. The canonical record stays in whatever state it was
    // already in; staff sees an error redirect and can retry.
    console.warn('Admin regenerate: generation returned null for', id,
      '— treating as transient, canonical record unchanged. Check the preceding log line for root cause.');
    throw new Error('Generation returned null (transient); check logs and retry');
  }

  const status = result.confidence <= generateBiography.CONFIDENCE_INSUFFICIENT_AT_OR_BELOW ? 'insufficient_data' : 'live';
  await biographyStore.saveBiography(id, {
    status,
    personName: personData.name,
    pageUrl: '/people/' + id,
    existingDescriptionChars: personData.descriptionChars,
    biographyHtml: result.biographyHtml,
    contextHtml: result.contextHtml,
    model: result.model,
    promptVersion: result.promptVersion,
    confidence: result.confidence,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    prompt: result.prompt,
    systemPrompt: result.systemPrompt,
    references: result.references,
    sources: result.sources,
    signalScore: assessment.score,
    signalMaxScore: assessment.maxScore,
    signalCount: assessment.signalCount,
    signalsPresent: assessment.present,
    signalsMissing: assessment.missing,
    subjectStatus: subjStatus,
    // Badge for workshop / A/B experiments — 'custom' snapshots are
    // distinguishable from named-version ones in the compare view.
    customPromptLabel: customPrompt ? (customPrompt.label || 'custom') : null,
    skipReason: result.confidence <= generateBiography.CONFIDENCE_INSUFFICIENT_AT_OR_BELOW ? 'Low confidence (model self-reported ' + result.confidence + '/10) on regeneration' : undefined
  }, { snapshotOnly });
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
