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
  // Living-person and active-company suppression flags.
  //
  // aiBiographyIncludeLiving: gates BIOGRAPHIES of living PEOPLE. Lift only
  // after comms/legal are comfortable with the surface for contemporary
  // named individuals — defamation risk is highest here.
  //
  // aiBiographyIncludeActiveCompanies: gates BIOGRAPHIES of active/current
  // companies and organisations. Added 2026-08 after curator review flagged
  // the risk is HIGHER for companies than previously modelled — a modern
  // corporation whose biography implies continuity with a founder's harmful
  // beliefs can actively deter people from services. Default off; lift
  // per-flag when comms/legal have reviewed the current-company surface.
  //
  // Both default to false. Dissolved companies + deceased people are
  // always eligible regardless (no suppression); the flags only gate the
  // "still operating" / "still alive" case.
  aiBiographyIncludeLiving: process.env.AI_BIOGRAPHY_INCLUDE_LIVING === 'true',
  aiBiographyIncludeActiveCompanies: process.env.AI_BIOGRAPHY_INCLUDE_ACTIVE_COMPANIES === 'true',
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

  // On-demand external claim verification against Wikipedia + Wikidata
  // deep + Phase-2 authorities as they ship. NOT Meta's Chain-of-
  // Verification (CoVe) — that's a distinct intrinsic self-verification
  // technique tracked as separate roadmap work; this feature retrieves
  // authoritative external evidence for a specific claim. Gates the
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
  aiBiographyExternalValidationMaxSources: parseInt(process.env.AI_BIOGRAPHY_EXTERNAL_VALIDATION_MAX_SOURCES, 10) || 3,

  // --- Writer self-review flags ---
  //
  // Both control whether the writer prompt INCLUDES a `selfReview`
  // section in its response schema. Turning a flag off drops the
  // corresponding instructions from the prompt AND stops the parser
  // from expecting the sub-field.

  // Structured abstention: writer emits `selfReview.skipped[]` for
  // claims it wanted to make but could not source from the provided
  // context. Converts "no source → fabricate" into "no source →
  // record refusal + reason". Admin-only visibility; never on the
  // public JSON API.
  aiBiographyStructuredAbstentionEnabled: process.env.AI_BIOGRAPHY_STRUCTURED_ABSTENTION_ENABLED !== 'false',

  // Writer self-checks: writer emits `selfReview.planningNotes` +
  // `selfReview.checks` describing what it verified before writing
  // (temporal consistency, attribution audit, currentness check,
  // etc.). Ordered BEFORE the sentences in the response schema so the
  // model plans before writing rather than rationalising after.
  // Admin-only visibility.
  aiBiographyWriterSelfChecksEnabled: process.env.AI_BIOGRAPHY_WRITER_SELF_CHECKS_ENABLED !== 'false',

  // Wikipedia summary as an input-mode source. Fetches the first
  // ~2000 chars of the subject's Wikipedia article intro (via the
  // MediaWiki API, sitelink-resolved from the Wikidata Q code when
  // available). Feeds into the writer prompt as narrative context —
  // complements Wikidata's structured claims. Every fact the writer
  // draws from Wikipedia must be tagged `wikipedia` and cited via
  // `wikipedia:<article title>` in the sentence's citations[] array.
  //
  // **Default ON as of 2026-07-18.** Reversed from the earlier
  // "scholarly-sources-first" default (2026-07-17) after evaluating
  // the launch corpus: only 24.5% of agent records carry a Wikidata
  // Q-code, and even for that slice the OFF default produced flat
  // biographies that read as bullet-point structured-data summaries.
  // Wikipedia is community-edited but every fact drawn from it
  // still gets cited via `wikipedia:<article-title>` with a verbatim
  // excerpt validated at parse time — the citation trail is the
  // safety net, not the source's authority tier. Set
  // AI_BIOGRAPHY_WIKIPEDIA_ENABLED=false to turn off for a run.
  aiBiographyWikipediaEnabled: process.env.AI_BIOGRAPHY_WIKIPEDIA_ENABLED !== 'false',

  // Adaptive-fetch gates for Wikipedia (only consulted when
  // aiBiographyWikipediaEnabled is true AND aiBiographyWikipedia-
  // AdaptiveDisabled is false).
  //
  // **Default: gates DISABLED as of 2026-07-18** (Wikipedia fetches
  // for every subject that has a Q-code). Earlier tuning skipped
  // Wikipedia for subjects with plenty of Wikidata + museum content
  // as a cost saver, but the effect was to strip narrative colour
  // from exactly the well-known subjects where Wikipedia adds most
  // (Einstein, Lipton). The cost is a couple of pence per record;
  // the readability win is large. Set
  // AI_BIOGRAPHY_WIKIPEDIA_ADAPTIVE_DISABLED=false to re-engage the
  // gates (useful for cost-sensitive batch runs).
  //
  // When re-engaged: Wikipedia fires only when Wikidata claim count
  // < aiBiographyWikipediaAdaptiveMinWikidataClaims AND combined
  // museum biography + briefBiography char count <
  // aiBiographyWikipediaAdaptiveMinMuseumChars.
  aiBiographyWikipediaAdaptiveDisabled: process.env.AI_BIOGRAPHY_WIKIPEDIA_ADAPTIVE_DISABLED !== 'false',
  aiBiographyWikipediaAdaptiveMinWikidataClaims: parseInt(process.env.AI_BIOGRAPHY_WIKIPEDIA_ADAPTIVE_MIN_WIKIDATA_CLAIMS || '8', 10),
  aiBiographyWikipediaAdaptiveMinMuseumChars: parseInt(process.env.AI_BIOGRAPHY_WIKIPEDIA_ADAPTIVE_MIN_MUSEUM_CHARS || '500', 10),

  // Oxford Dictionary of National Biography (ODNB) as an input-mode
  // source — peer-reviewed British biographical scholarship, Tier A
  // authority. Ships OFF by default (needs institutional API access).
  // Three-key contract: master flag + endpoint URL + bearer token,
  // all three must be set for the fetch to fire. The adapter is
  // additionally gated on the subject having a Wikidata P1415
  // (ODNB ID) property — no P1415 means the subject doesn't have an
  // ODNB article, skip. See lib/ai/fetch-odnb-summary.js.
  //
  // The `oxfordDNB` source tag sits above `wikidata` in priority
  // when both cover the same fact — ODNB is peer-reviewed prose
  // whereas Wikidata is community-curated structured claims. When
  // Grace's Guide lands next, its priority sits between wikidata
  // and wikipedia.
  aiBiographyOdnbEnabled: process.env.AI_BIOGRAPHY_ODNB_ENABLED === 'true',
  aiBiographyOdnbApiUrl: process.env.AI_BIOGRAPHY_ODNB_API_URL || '',
  aiBiographyOdnbApiToken: process.env.AI_BIOGRAPHY_ODNB_API_TOKEN || '',

  // Grace's Guide as an input-mode source. UK industrial history wiki
  // (engineers, engineering firms, railways, manufacturers, ceramics,
  // mines) — well-matched to the SMG collection's transport / Victorian-
  // industry weight. Free public wiki (MediaWiki-backed), no API key
  // needed. Adapter is gated on Wikidata property P3074 (Grace's Guide
  // ID) — no P3074 means the subject doesn't have a Grace's Guide
  // article; skip without fetching. See lib/ai/fetch-graces-guide-summary.js.
  //
  // Priority: below wikidata / above wikipedia — Grace's Guide is
  // subject-expert prose but community-edited, not peer-reviewed.
  aiBiographyGracesGuideEnabled: process.env.AI_BIOGRAPHY_GRACES_GUIDE_ENABLED !== 'false',

  // Cross-source contradiction detection. Runs after all fetches, before
  // the writer call — compares structured facts (birth/death date +
  // place, occupation, nationality) between museum personData and
  // Wikidata claims, and produces a list of disagreements with a
  // priority-picked authoritative value. Feeds a CONTRADICTIONS section
  // into the writer prompt so the model uses the winning value instead
  // of writing "sources disagree" prose. Emergency kill switch — off
  // drops the detection call, and the writer prompt just doesn't get
  // the section. See lib/ai/detect-contradictions.js.
  aiBiographyContradictionDetectionEnabled: process.env.AI_BIOGRAPHY_CONTRADICTION_DETECTION_ENABLED !== 'false',

  // Extended-thinking tuning knobs for the writer. Passed through to
  // Anthropic's thinking config on every generation. maxOutputTokens
  // must exceed thinkingBudgetTokens (SDK enforces this).
  aiBiographyThinkingBudgetTokens: parseInt(process.env.AI_BIOGRAPHY_THINKING_BUDGET_TOKENS || '4000', 10),
  aiBiographyMaxOutputTokens: parseInt(process.env.AI_BIOGRAPHY_MAX_OUTPUT_TOKENS || '24000', 10)
});
