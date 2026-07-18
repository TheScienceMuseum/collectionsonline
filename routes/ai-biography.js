'use strict';

const curatorDecisionsStore = require('../lib/ai/curator-decisions-store');
const renderBiography = require('../lib/ai/render-biography');
const biographyStore = require('../lib/ai/biography-store');
const dynamo = require('../lib/ai/dynamo');
const subjectStatus = require('../lib/ai/subject-status');
const flagStore = require('../lib/ai/flag-store');

const CACHE_CONTROL = process.env.NODE_ENV === 'production'
  ? 'public, max-age=3600, stale-while-revalidate=86400'
  : 'no-cache, no-store';

module.exports = function (elastic, config) {
  return [publicBiographyRoute(elastic, config), publicFlagRoute(config)];
};

function publicBiographyRoute (elastic, config) {
  return {
    method: 'GET',
    path: '/ai/biography/{id}',
    config: {
      auth: false,
      handler: async function (request, h) {
        if (!config.aiBiographyEnabled) {
          return h.response({ error: 'AI biography feature is not enabled' }).code(404);
        }

        const id = request.params.id;

        if (!/^[a-z]{2}\d+$/i.test(id)) {
          return h.response({ error: 'Invalid ID format' }).code(400);
        }

        // Look up the cached biography and decide what to return:
        //   - living person AND feature-flag off → 204 (policy suppression)
        //   - hidden / insufficient_data         → 204 (don't show publicly)
        //   - live / flagged                     → serve the cached content
        //                                          (flagged is just a triage
        //                                          marker; still public)
        //   - no record at all                   → 204 (nothing precomputed)
        //
        // This route ONLY serves what has already been generated. New
        // biographies come from admin Regenerate or scripts/bulk-generate.
        //
        // Living-person policy is enforced HERE, at render time — not at
        // generation time. Biographies are generated for everyone; the
        // public flag toggles whether they surface. Lets us enable living
        // people globally by flipping config.aiBiographyIncludeLiving to
        // true, with no batch job or status migration required.
        if (dynamo.isReady()) {
          try {
            const existing = await biographyStore.fetchBiography(id);
            if (existing) {
              if (subjectStatus.isSuppressedOnPublicSite(existing.subjectStatus, config)) {
                return h.response({}).code(204);
              }
              if (existing.status === 'hidden' || existing.status === 'insufficient_data') {
                return h.response({}).code(204);
              }
              // v2 records store `sentences[]` on the item and do NOT
              // persist a rendered `biographyHtml` — the render layer
              // composes HTML at read time so subsequent curator actions
              // (approve / reject / clarify) or filter-level tweaks apply
              // on the next page load without a regen. Records without
              // sentences[] (legacy pre-v2 shape or a partial write) 204
              // instead of falling through to a live Claude call.
              if (Array.isArray(existing.sentences) && existing.sentences.length > 0) {
                const curatorDecisions = await curatorDecisionsStore.get(id).catch(function () { return null; });
                // `opts.references` is intentionally omitted here — the
                // renderer uses it only to build per-sentence chip data
                // consumed by the admin Claims list. The public path
                // returns just biographyHtml + contextHtml (both of
                // which are complete on their own, inline anchors and
                // all). Passing an empty references list produces
                // empty chip arrays that are then dropped on the floor.
                const rendered = renderBiography({
                  sentences: existing.sentences,
                  paragraphBreaks: existing.paragraphBreaks || []
                }, {
                  decisions: curatorDecisions,
                  publishingLevel: config.aiBiographyPublishingLevel
                });
                return h.response({
                  biography: rendered.biographyHtml,
                  context: rendered.contextHtml,
                  personName: existing.personName,
                  sources: existing.sources,
                  generatedAt: existing.generatedAt,
                  model: existing.model,
                  status: existing.status,
                  suppressExisting: existing.existingDescriptionChars < config.aiBiographySuppressExistingChars,
                  flagEnabled: !!config.aiBiographyPublicFlagEnabled
                }).type('application/json').header('Cache-Control', CACHE_CONTROL);
              }
            }
          } catch (err) {
            // Log full error — AWS SDK errors don't always populate .message,
            // and a silent empty log makes misconfigured DynamoDB hard to diagnose
            console.warn('AI Biography: DynamoDB fetch failed for', id,
              '- name:', err && err.name,
              '- code:', err && (err.$metadata && err.$metadata.httpStatusCode),
              '- message:', err && err.message,
              '- stack:', err && err.stack);
          }
        } else {
          return h.response({ error: 'Storage unavailable' }).code(503);
        }

        // No cached biography → 204. The public route ONLY serves what
        // has already been generated. New biographies come from either
        // the admin Regenerate button or scripts/bulk-generate.js — a
        // walk-in visitor never triggers a Claude call. This bounds cost
        // (no long-tail public traffic can spend tokens) and matches
        // the launch model: batch-precompute what's worth publishing,
        // serve from cache.
        return h.response({}).code(204);
      }
    }
  };
}

// Public "Report a problem" submission endpoint.
//
// Design decisions (see plan section 14):
//   - Feature-flagged via config.aiBiographyPublicFlagEnabled (kill switch).
//     404 when disabled.
//   - Structured reason only — no free-text field. Honeypot input catches
//     dumb bots. WAF rate limit handles the real abuse surface.
//   - Aggregate counters only (see lib/ai/flag-store.js). No individual
//     flag records, no IPs in DynamoDB.
//   - First flag on a `live` record auto-promotes status to `flagged`.
//     Matches the staff-flag behaviour for a unified triage queue.
//   - Cookie is set on successful submission so the button hides in-browser
//     for 24h. UX hint only — server doesn't rely on it.
function publicFlagRoute (config) {
  return {
    method: 'POST',
    path: '/ai/biography/{id}/flag',
    config: {
      auth: false,
      payload: {
        output: 'data',
        parse: true,
        allow: ['application/json', 'application/x-www-form-urlencoded']
      },
      handler: async function (request, h) {
        if (!config.aiBiographyEnabled || !config.aiBiographyPublicFlagEnabled) {
          return h.response({ error: 'Not found' }).code(404);
        }

        const id = request.params.id;
        if (!/^[a-z]{2}\d+$/i.test(id)) {
          return h.response({ error: 'Invalid ID format' }).code(400);
        }

        const payload = request.payload || {};

        // Honeypot: hidden field named `website` that only bots fill in.
        // Silently accept (so bot thinks it worked) but do nothing.
        if (payload.website) {
          return h.response({ ok: true }).code(200);
        }

        const reason = (payload.reason || '').toString();
        if (!flagStore.isValidReason(reason)) {
          return h.response({ error: 'Invalid reason' }).code(400);
        }

        if (!flagStore.isReady()) {
          return h.response({ error: 'Storage unavailable' }).code(503);
        }

        try {
          // Fetch the current canonical record so we know the generatedAt
          // to tag these flags against, and can auto-promote status=live.
          const record = await biographyStore.fetchBiography(id);
          if (!record) {
            // No biography to flag. Reject gracefully — the button shouldn't
            // have been rendered in this case.
            return h.response({ error: 'No biography for this record' }).code(404);
          }

          await flagStore.submitFlag(id, reason, record.generatedAt);

          // Auto-promote status on first actionable flag. Only from 'live';
          // stronger states (hidden, insufficient_data) stay intact.
          if (record.status === 'live') {
            await biographyStore.updateStatus(id, 'flagged');
          }

          // Set a short-lived cookie so the client hides the flag button
          // for this record for 24h. Pure UX — server-side rate-limiting
          // is WAF's job.
          const response = h.response({ ok: true });
          const isProduction = config.NODE_ENV === 'production';
          response.state('aiFlagged_' + id, '1', {
            ttl: 24 * 60 * 60 * 1000,
            isHttpOnly: false,
            isSameSite: 'Lax',
            isSecure: isProduction,
            encoding: 'none',
            path: '/'
          });
          return response;
        } catch (err) {
          console.error('Public flag submit error for', id, '-', err.message);
          return h.response({ error: 'Submission failed' }).code(500);
        }
      }
    }
  };
}
