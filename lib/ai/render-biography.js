'use strict';

// Renders a source-tagged biography to HTML for the public site, and
// exposes per-sentence render state for the admin UI. The layout of the
// output is decided by three orthogonal signals:
//
//   1. Publishing level (collection-wide, 0-5) — filters sentences by
//      their source tag. See PUBLISHING_LEVELS below.
//   2. Curator decisions on the CURATOR_DECISIONS item — approvals
//      override the source-tag filter (publish anyway), rejections
//      force-hide (regardless of anything else), clarifications
//      annotate without changing visibility.
//   3. Open review findings on any REVIEW# item — high-confidence
//      errors force-hide by default (defensive-by-default); lower-
//      severity errors and info findings annotate without hiding.
//
// Callers pass in the parsed biography + the CURATOR_DECISIONS item +
// the open review findings + publishingLevel. Renderer returns both
// the flat HTML (public site) and the per-sentence render-state array
// (admin detail page) so we don't double-render for the two audiences.

const wikidataLabels = require('./wikidata-property-labels');

// Which source tags publish at each level. Higher levels include
// everything from lower levels. `llm:validated:*` is a prefix — used
// for sentences promoted from `llm:general_knowledge` after external
// verification; matched via `startsWith`.
const PUBLISHING_LEVELS = [
  ['museum'], // 0
  ['museum', 'wikidata'], // 1
  ['museum', 'wikidata', 'llm:inferred'], // 2
  ['museum', 'wikidata', 'llm:inferred', 'llm:contextualising'], // 3
  ['museum', 'wikidata', 'llm:inferred', 'llm:contextualising', 'llm:validated:*'], // 4
  ['museum', 'wikidata', 'llm:inferred', 'llm:contextualising', 'llm:validated:*', 'llm:general_knowledge'] // 5
];
const DEFAULT_LEVEL = 3;

// Severity ordering for open findings on a single sentence — pick the
// highest so the render state reflects the worst outstanding concern.
// Higher index = more severe.
const FINDING_PRIORITY = {
  'info:low': 0,
  'info:medium': 1,
  'info:high': 2,
  'error:low': 3,
  'error:medium': 4,
  'error:high': 5
};

function sourceIsPublishable (source, level) {
  const allowed = PUBLISHING_LEVELS[level] || PUBLISHING_LEVELS[DEFAULT_LEVEL];
  for (const tag of allowed) {
    if (tag.endsWith('*')) {
      const prefix = tag.slice(0, -1);
      if (typeof source === 'string' && source.indexOf(prefix) === 0) return true;
    } else if (source === tag) {
      return true;
    }
  }
  return false;
}

// Group curator-decision entries by claim signature for O(1) lookup at
// render time. Rejection dominates approval when both exist (should be
// impossible per the UI but robust here). Clarification is orthogonal.
function indexDecisions (decisions) {
  const idx = new Map();
  const arr = decisions || {};
  (arr.approvals || []).forEach(function (a) {
    if (!a || !a.claimSignature) return;
    const entry = idx.get(a.claimSignature) || {};
    entry.approved = true;
    entry.approvedNote = a.note || null;
    idx.set(a.claimSignature, entry);
  });
  (arr.rejections || []).forEach(function (r) {
    if (!r || !r.claimSignature) return;
    const entry = idx.get(r.claimSignature) || {};
    entry.rejected = true;
    entry.rejectedRationale = r.rationale || null;
    idx.set(r.claimSignature, entry);
  });
  (arr.clarifications || []).forEach(function (c) {
    if (!c || !c.claimSignature) return;
    const entry = idx.get(c.claimSignature) || {};
    entry.clarification = c.clarification || null;
    idx.set(c.claimSignature, entry);
  });
  return idx;
}

// Group review findings by claim signature, keeping only the
// highest-severity finding per signature.
//
// TASK 60 CHANGE: previously took `openFindings` (pending only). Now
// takes ALL findings (pending + resolved). The finding-based hide
// gate below applies based on the finding's `kind` + `confidence`,
// not its `resolution` status — so dismissing an error:high finding
// no longer accidentally un-hides the sentence. Only a curator
// approval can override the gate. Findings' resolution status is
// carried on the indexed result for the template to show (dismissed
// / accepted / clarified pills), but not used for gating.
function indexFindings (findings) {
  const idx = new Map();
  (findings || []).forEach(function (f) {
    if (!f || !f.claimSignature) return;
    const kind = f.kind === 'error' ? 'error' : 'info';
    const conf = f.confidence === 'high' || f.confidence === 'medium' || f.confidence === 'low'
      ? f.confidence
      : 'low';
    const priority = FINDING_PRIORITY[kind + ':' + conf] || 0;
    const existing = idx.get(f.claimSignature);
    if (!existing || priority > existing._priority) {
      idx.set(f.claimSignature, {
        kind,
        confidence: conf,
        concern: f.concern || '',
        resolution: f.resolution || 'pending',
        _priority: priority
      });
    }
  });
  return idx;
}

// Task 60: map a finding's { kind, confidence } to the concern axis of
// the new 3-axis publishing-state triple. Reduces the 6-cell severity
// grid (info/error × high/medium/low) to three visible levels:
//   info    — reviewer noted context; low signal; publishes with a note
//   warning — reviewer suspects a problem at medium confidence;
//             publishes with a warning
//   block   — reviewer's high-confidence error; hides the sentence
//             (unless curator explicitly approves)
//
// The mapping deliberately collapses error:low with info-tier — a
// hunch that isn't blocking is functionally an "info" annotation from
// the reader's perspective.
function computeConcern (finding) {
  if (!finding) return null;
  if (finding.kind === 'info') return 'info';
  if (finding.confidence === 'high') return 'block';
  if (finding.confidence === 'medium') return 'warning';
  return 'info'; // error:low → info-tier concern
}

// Task 61: `classifyPublishingState` — the legacy 7-value enum — is
// GONE. All consumers now read the 3-axis `state` triple below.
// admin-ai.js's finding-status chip computation (formerly reading
// sentence.publishingState) now reads sentence.state directly.

// Compute the render state for a single sentence given decisions +
// findings + publishing level. Returns:
//   { visible, hiddenReason, curatorDecision, clarification, reviewFinding, publishingState }
function sentenceRenderState (sentence, decisionsIdx, findingsIdx, publishingLevel) {
  const decision = decisionsIdx.get(sentence.claimSignature) || {};
  const finding = findingsIdx.get(sentence.claimSignature) || null;

  let visible;
  let hiddenReason;
  let curatorDecision;

  // Rejection: unconditional hide.
  if (decision.rejected) {
    visible = false;
    hiddenReason = 'curator_rejected';
    curatorDecision = 'rejected';
  } else if (finding && finding.kind === 'error' && finding.confidence === 'high' && !decision.approved) {
    // High-confidence error finding: defensive hide unless curator has
    // explicitly approved. Approval trumps review's hide.
    visible = false;
    hiddenReason = 'reviewer_error_high';
    curatorDecision = null;
  } else if (decision.approved) {
    // Approval: publish regardless of source-tag filter.
    visible = true;
    hiddenReason = null;
    curatorDecision = 'approved';
  } else {
    // Base case: source tag filter decides visibility.
    visible = sourceIsPublishable(sentence.source, publishingLevel);
    hiddenReason = visible ? null : 'below_publishing_level';
    curatorDecision = null;
  }

  return {
    visible,
    hiddenReason,
    curatorDecision,
    clarification: decision.clarification || null,
    reviewFinding: finding,
    // 3-axis state triple. `visible` is the gate result. `decidedBy`
    // distinguishes an auto-decision (system rules) from a curator
    // override. `concern` names the reviewer's flag (if any),
    // orthogonal to visibility — a sentence can be curator-approved
    // AND still carry a reviewer's info-tier concern, or curator-
    // rejected with no concern at all.
    state: {
      visible,
      decidedBy: (decision.approved || decision.rejected) ? 'curator' : 'auto',
      concern: computeConcern(finding)
    }
  };
}

// Split a `sourceDetail` string into its citations, extracting
// `relatedItem:*` IDs. sourceDetail values are typically comma- or
// semicolon-separated ("relateditem:coXXX, relateditem:coYYY;
// existingbiography"). Lowercased comparison — writer sometimes emits
// mixed case.
function relatedItemIdsFromSourceDetail (sourceDetail) {
  if (!sourceDetail || typeof sourceDetail !== 'string') return [];
  const out = [];
  sourceDetail.split(/[,;]/).forEach(function (piece) {
    const trimmed = piece.trim().toLowerCase();
    if (trimmed.indexOf('relateditem:') === 0) {
      out.push(trimmed.slice('relateditem:'.length));
    }
  });
  return out;
}

// True when the sentence is contextual — cites at least one specific
// museum object. Drives the split between the main biography block and
// the "In the collection" block at render time.
function sentenceIsInCollection (sentence) {
  return relatedItemIdsFromSourceDetail(sentence && sentence.sourceDetail).length > 0;
}

// Strip the leading source prefix from each citation in a sourceDetail
// string when it matches the sentence's declared source. Purely display —
// the source pill already carries the source name, so repeating it in
// every citation ("wikidata · wikidata:P106 (occupation)") is noisy +
// causes overflow in the hover rail.
//
// Only strips when the piece STARTS with `<source>:` — leaves compound
// citations that mix sources ("wikidata:P106, existingbiography")
// alone for the pieces that don't match. Case-insensitive match on the
// prefix.
function stripRedundantSourcePrefix (sourceDetail, source) {
  if (!sourceDetail || !source || typeof sourceDetail !== 'string') return sourceDetail || '';
  const prefix = source.toLowerCase() + ':';
  return sourceDetail
    .split(/([,;])/)
    .map(function (piece) {
      if (piece === ',' || piece === ';') return piece;
      const leading = piece.match(/^\s*/)[0];
      const trailing = piece.match(/\s*$/)[0];
      const trimmed = piece.trim();
      if (trimmed.toLowerCase().indexOf(prefix) === 0) {
        return leading + trimmed.slice(prefix.length) + trailing;
      }
      return piece;
    })
    .join('');
}

// Basic HTML escape for sentence text going into biographyHtml /
// contextHtml. Sentences are prose so this is defence-in-depth against
// a writer that accidentally emits a `<` or an unescaped `&` — the
// public template renders these blocks via {{{triple-brace}}} which
// bypasses Handlebars' escaping.
function escapeHtml (s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Build a paragraphed HTML block from a subset of sentences. `subset`
// is a list of { text, index, chips?, claimSignature? } — index refers
// back to the original sentences array so paragraphBreaks that fall
// between kept sentences still fire. Each sentence is wrapped in a
// `<span data-signature="...">` so the admin detail's hover-highlight
// script can map rendered prose back to per-sentence Claims rows.
// Text is escaped; optional chips are appended after the span.
function buildParagraphedHtml (subset, paragraphBreaks) {
  if (!subset.length) return '';
  const breakSet = new Set(paragraphBreaks || []);
  const paragraphs = [[]];
  subset.forEach(function (entry, i) {
    const chips = (entry.chips || []).map(function (c) {
      return ' <a class="ai-object-chip" href="' + c.href + '" title="View this object in the collection">' + escapeHtml(c.title || c.id) + '</a>';
    }).join('');
    const sigAttr = entry.claimSignature ? ' data-signature="' + entry.claimSignature + '"' : '';
    paragraphs[paragraphs.length - 1].push('<span' + sigAttr + '>' + escapeHtml(entry.text) + '</span>' + chips);
    // Fire a paragraph break AFTER this sentence if either
    //   (a) the original index is a paragraphBreak, OR
    //   (b) this was the last kept sentence before a gap where
    //       intervening sentences all landed in the other block.
    if (breakSet.has(entry.index)) {
      paragraphs.push([]);
    }
  });
  return paragraphs
    .map(function (arr) { return arr.join(' '); })
    .filter(function (p) { return p.length > 0; })
    .map(function (p) { return '<p>' + p + '</p>'; })
    .join('');
}

// Look up chip metadata for a set of related-item IDs. Uses the
// references list stored on the biography item (populated at generate
// time from the input allItems) so the render layer doesn't need to
// re-fetch related items. Missing IDs are skipped silently — safer
// than rendering a broken link.
function chipsForSentence (sentence, referencesById) {
  const ids = relatedItemIdsFromSourceDetail(sentence.sourceDetail);
  const chips = [];
  ids.forEach(function (id) {
    const ref = referencesById[id];
    if (!ref) return;
    chips.push({
      id: ref.id,
      title: ref.title || ref.id,
      href: ref.link || ('/objects/' + ref.id)
    });
  });
  return chips;
}

// Build the flat HTML for the public site — kept for legacy consumers.
// The v2 template consumes biographyHtml + contextHtml instead of this
// single flat block, but the field stays for any downstream that
// hasn't migrated.
function buildPublicHtml (sentences, states, paragraphBreaks, referencesById) {
  const subset = [];
  for (let i = 0; i < sentences.length; i += 1) {
    if (!states[i].visible) continue;
    subset.push({
      text: sentences[i].text,
      index: i,
      claimSignature: sentences[i].claimSignature,
      chips: chipsForSentence(sentences[i], referencesById)
    });
  }
  return buildParagraphedHtml(subset, paragraphBreaks);
}

// Split visible sentences into the two rendered blocks:
//   biographyHtml — main prose. Sentences without any relatedItem:*
//                   citation. This is the "who is this person / what
//                   did they do" section.
//   contextHtml   — In-the-collection prose. Sentences that cite one
//                   or more collection objects — restores the v1
//                   "Collection Context" split the admin PDF flagged
//                   as missing. Each cited object appears as a
//                   trailing hyperlinked chip, restoring the v1
//                   object-hyperlink behaviour.
function buildSplitHtml (sentences, states, paragraphBreaks, referencesById) {
  const bio = [];
  const context = [];
  for (let i = 0; i < sentences.length; i += 1) {
    if (!states[i].visible) continue;
    const entry = {
      text: sentences[i].text,
      index: i,
      claimSignature: sentences[i].claimSignature,
      chips: chipsForSentence(sentences[i], referencesById)
    };
    if (sentenceIsInCollection(sentences[i])) {
      context.push(entry);
    } else {
      bio.push(entry);
    }
  }
  return {
    biographyHtml: buildParagraphedHtml(bio, paragraphBreaks),
    contextHtml: buildParagraphedHtml(context, paragraphBreaks)
  };
}

// Public entry point. Returns both the flat HTML and the per-sentence
// render state so callers don't double-render.
//
// opts = {
//   decisions: CURATOR_DECISIONS item (or null),
//   openFindings: array of open review findings (or null),
//   publishingLevel: 0-5 (defaults to 3),
//   references: array of { id, title, link } for related-item
//     lookup. Typically read off the BIOGRAPHY item's `references`
//     field (stored at generate time). Missing/absent: chips are
//     omitted (regression-safe for records pre-Task-56).
// }
function render (biography, opts) {
  opts = opts || {};
  const publishingLevel = Number.isInteger(opts.publishingLevel)
    ? Math.min(Math.max(opts.publishingLevel, 0), PUBLISHING_LEVELS.length - 1)
    : DEFAULT_LEVEL;
  const sentences = (biography && biography.sentences) || [];
  const paragraphBreaks = (biography && biography.paragraphBreaks) || [];

  const decisionsIdx = indexDecisions(opts.decisions);
  const findingsIdx = indexFindings(opts.openFindings);

  const states = sentences.map(function (s) {
    return sentenceRenderState(s, decisionsIdx, findingsIdx, publishingLevel);
  });

  // Index references by id for O(1) chip lookup. Passed via opts so
  // the same reference list flows through public + admin render paths
  // without a second Dynamo lookup.
  const referencesById = Object.create(null);
  (opts.references || []).forEach(function (ref) {
    if (ref && ref.id) referencesById[ref.id] = ref;
  });

  // Combined per-sentence array for admin — sentence + state + break flag
  // + chips (so the admin per-sentence view can show "→ view object" chips
  // alongside the Claims list without a second walk over references).
  const breakSet = new Set(paragraphBreaks);
  const sentenceRenderData = sentences.map(function (s, i) {
    return Object.assign({}, s, states[i], {
      paragraphBreak: breakSet.has(i),
      chips: chipsForSentence(s, referencesById),
      inCollection: sentenceIsInCollection(s),
      // Task 60: sourceDetailFormatted moved from route handler to
      // render layer. Public + admin routes both benefit; downstream
      // consumers no longer need their own copy of the property-labels
      // module. Idempotent — writer output that already carries labels
      // (`wikidata:P69 (educated at)`) passes through unchanged.
      sourceDetailFormatted: wikidataLabels.formatSourceDetail(s.sourceDetail),
      // Task 61 UX fix: display-friendly version with the redundant
      // source prefix stripped. When source is 'wikidata' and every
      // sourceDetail citation carries the redundant 'wikidata:' prefix
      // ("wikidata · wikidata:P106 (occupation)"), the source pill
      // reads awkwardly + overflows the rail. sourceDetailShort strips
      // just the redundant lead so the pill becomes
      // "wikidata · P106 (occupation)" — same information, cleaner.
      // Non-wikidata sources + mixed compound sourceDetails pass through
      // unchanged (nothing to strip that isn't redundant).
      sourceDetailShort: stripRedundantSourcePrefix(
        wikidataLabels.formatSourceDetail(s.sourceDetail),
        s.source
      )
    });
  });

  const split = buildSplitHtml(sentences, states, paragraphBreaks, referencesById);

  return {
    // Flat single-block HTML — kept for legacy consumers that haven't
    // migrated to the split block model yet.
    html: buildPublicHtml(sentences, states, paragraphBreaks, referencesById),
    // v2 admin + public site consumes these two.
    biographyHtml: split.biographyHtml,
    contextHtml: split.contextHtml,
    sentences: sentenceRenderData,
    paragraphBreaks,
    publishingLevel,
    visibleCount: states.filter(function (s) { return s.visible; }).length,
    hiddenCount: states.filter(function (s) { return !s.visible; }).length
  };
}

module.exports = render;
module.exports.PUBLISHING_LEVELS = PUBLISHING_LEVELS;
module.exports.DEFAULT_LEVEL = DEFAULT_LEVEL;
module.exports.sourceIsPublishable = sourceIsPublishable;
module.exports.sentenceRenderState = sentenceRenderState;
module.exports.computeConcern = computeConcern;
module.exports.sentenceIsInCollection = sentenceIsInCollection;
module.exports.relatedItemIdsFromSourceDetail = relatedItemIdsFromSourceDetail;
