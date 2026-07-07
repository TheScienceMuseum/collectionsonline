module.exports = require('rc')('co', {
  port: 8000,
  elasticIndex: process.env.ELASTIC_INDEX || 'ciim',
  elasticsearch: {
    node: process.env.ELASTIC_HOST || '',
    requestTimeout: 10000
  },
  // Redis / ElastiCache connection (host:port). Set ELASTICACHE_ENDPOINT in
  // production or elasticacheEndpoint in .corc for local dev.
  elasticacheEndpoint: process.env.ELASTICACHE_ENDPOINT || '',
  auth: process.env.auth !== undefined ? (process.env.auth) : false,
  user: process.env.co_auth_user,
  password: process.env.co_auth_pass,
  JWT_SECRET: process.env.JWT_SECRET,
  // Token required by /clearcache/* and /listcache/* admin routes.
  // Generate with: node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
  cacheClearToken: process.env.CACHE_CLEAR_TOKEN,
  NODE_ENV: process.env.NODE_ENV || 'test',

  // --- AI Biographies ---
  dynamodb: {
    region: process.env.AWS_REGION || 'eu-west-1',
    endpoint: process.env.DYNAMODB_ENDPOINT || '',
    tableName: process.env.DYNAMODB_TABLE || 'collectionsonline-ai'
  },
  aiBiographyEnabled: process.env.AI_BIOGRAPHY_ENABLED === 'true',
  aiBiographyModel: process.env.AI_BIOGRAPHY_MODEL || 'claude-haiku-4-5-20251001',
  // Which prompt version to use by default when generating biographies.
  // See prompts/biographies/README.md for the authoring workflow.
  // If unset, the system picks the latest version by filename sort order.
  aiBiographyPromptVersion: process.env.AI_BIOGRAPHY_PROMPT_VERSION || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  // Token for /admin/ai routes. Falls back to cacheClearToken if not set.
  adminToken: process.env.ADMIN_TOKEN || '',
  // Skip AI biography generation if existing description exceeds this (chars)
  aiBiographyMaxExistingChars: parseInt(process.env.AI_BIO_MAX_EXISTING_CHARS, 10) || 500,
  // Suppress original description and show only AI biography if under this (chars)
  aiBiographySuppressExistingChars: parseInt(process.env.AI_BIO_SUPPRESS_EXISTING_CHARS, 10) || 50,
  // Minimum concrete signals required in the source data before we call Claude.
  // Records below this threshold are marked insufficient_data without
  // generation. See lib/ai/assess-sufficiency.js for the signal list.
  aiBiographyMinSignals: parseInt(process.env.AI_BIO_MIN_SIGNALS, 10) || 2,
  // When false (default), the generator skips records for living PEOPLE —
  // subjects with no death date internally AND no death date in Wikidata.
  // Companies and organisations are always eligible regardless of whether
  // their dissolution is recorded, because (a) defamation risk is much
  // lower for corporations and (b) dissolution dates are poorly tracked in
  // the catalogue, so "active" often means "actually defunct, just not
  // recorded". Lift this flag only after comms/legal are comfortable with
  // the surface for contemporary people.
  aiBiographyIncludeLiving: process.env.AI_BIOGRAPHY_INCLUDE_LIVING === 'true',
  // Kill switch for the public "Report a problem" feature. When false the
  // flag button is not rendered on biography blocks and the flag route
  // returns 404. Default false — enable in .corc / env only when the
  // feature is intentionally live.
  aiBiographyPublicFlagEnabled: process.env.AI_BIOGRAPHY_PUBLIC_FLAG_ENABLED === 'true',
  // Named admin users — an object of { username: token } pairs. When
  // set, these take precedence over the shared adminToken for login.
  // Attributed usernames flow through to staff notes / flags / reviews
  // instead of always being 'admin'. The shared adminToken remains as a
  // break-glass fallback. See lib/ai/admin-auth.js for resolution order.
  //
  // Two ways to populate (rc merges both — match your environment):
  //
  //   Local dev (.corc, NOT committed to git):
  //     "adminUsers": { "jamie": "<token>", "alice": "<token>" }
  //
  //   Staging / production (env vars, no .corc on deploy):
  //     co_adminUsers__jamie=<token>
  //     co_adminUsers__alice=<token>
  //     (rc's double-underscore = nested key; matches how
  //      co_elasticsearch__node etc. already work in this project.)
  //
  // Tokens: generate with
  //   node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
  //
  // Revoke: remove the user's entry (delete .corc line or unset env var)
  // and restart / let nodemon pick it up. Live cookies fail the next
  // request — no server-side session store to flush.
  adminUsers: {},
  // USD→GBP conversion rate used for cost display in the admin UI. Anthropic
  // bills in USD; the museum talks about budget in GBP. Ballpark accuracy
  // is fine — update occasionally if the rate drifts noticeably. Does NOT
  // affect anything customer-facing or stored; admin display only.
  aiBiographyGbpPerUsd: parseFloat(process.env.AI_BIOGRAPHY_GBP_PER_USD) || 0.80,
  // AI Review (triage tool) — manually triggered per-record by staff to
  // fact-check / sanity-check biographies when reports come in. Uses the
  // ---------------------------------------------------------------------
  // v2 source-tagged pipeline config
  // ---------------------------------------------------------------------

  // Publishing level (collection-wide filter for which source tags
  // publish). Integer 0-5:
  //   0 = museum only
  //   1 = + wikidata
  //   2 = + llm:inferred                    (writer synthesis of inputs)
  //   3 = + llm:contextualising              (safe default — ship here)
  //   4 = + llm:validated:*                  (external-source verified)
  //   5 = + llm:general_knowledge            (full LLM freedom; NOT recommended)
  // See lib/ai/render-biography.js PUBLISHING_LEVELS + the plan for the
  // full policy rationale. Curators can override per-sentence via
  // "Approve" on the admin detail page regardless of this level.
  aiBiographyPublishingLevel: (function () {
    const raw = parseInt(process.env.AI_BIOGRAPHY_PUBLISHING_LEVEL, 10);
    if (!Number.isFinite(raw)) return 3;
    return Math.max(0, Math.min(5, raw));
  })(),

  // Per-generation reviewer (Sonnet by default — cheap, ~£0.001-0.002
  // per record). Runs after every successful writer call in the public
  // + admin regenerate flows. Findings surface in the admin detail's
  // open-findings panel. Kill switch for the case where the reviewer's
  // signal-to-noise ratio drops in production. DEFAULTS TO TRUE — the
  // whole v2 defensive-by-default design assumes this pass is running.
  aiBiographyPerGenerationReviewEnabled: process.env.AI_BIOGRAPHY_PER_GENERATION_REVIEW_ENABLED !== 'false',

  // External validation (Mode A on-demand CoVe against Wikipedia +
  // Wikidata deep + Phase-2 authorities as they ship). Gates the
  // "Verify externally" button on sentences + review findings in the
  // admin UI. Off by default — costs money per verification and needs
  // curator + operator agreement before enabling. When true, the button
  // appears wherever it's relevant; verify-external.js still runs its
  // per-tool availability checks.
  aiBiographyExternalValidationEnabled: process.env.AI_BIOGRAPHY_EXTERNAL_VALIDATION_ENABLED === 'true',

  // Maximum external sources verify-external.js will query per claim.
  // Bounds cost + latency on a single verification call — with 2 tools
  // shipped in Phase 1 (wikipedia + wikidataDeep) this is currently
  // no-op, but the ceiling matters once Phase 2 authorities land.
  aiBiographyExternalValidationMaxSources: parseInt(process.env.AI_BIOGRAPHY_EXTERNAL_VALIDATION_MAX_SOURCES, 10) || 3
});
