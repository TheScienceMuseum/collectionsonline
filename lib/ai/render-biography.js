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

// Group OPEN review findings by claim signature, keeping only the
// highest-severity finding per signature. Findings with resolved
// resolutions are skipped by the caller (they're not "open").
function indexFindings (openFindings) {
  const idx = new Map();
  (openFindings || []).forEach(function (f) {
    if (!f || !f.claimSignature) return;
    const kind = f.kind === 'error' ? 'error' : 'info';
    const conf = f.confidence === 'high' || f.confidence === 'medium' || f.confidence === 'low'
      ? f.confidence
      : 'low';
    const priority = FINDING_PRIORITY[kind + ':' + conf] || 0;
    const existing = idx.get(f.claimSignature);
    if (!existing || priority > existing._priority) {
      idx.set(f.claimSignature, { kind, confidence: conf, concern: f.concern || '', _priority: priority });
    }
  });
  return idx;
}

// Compute the render state for a single sentence given decisions +
// findings + publishing level. Returns:
//   { visible, hiddenReason, curatorDecision, clarification, reviewFinding }
function sentenceRenderState (sentence, decisionsIdx, findingsIdx, publishingLevel) {
  const decision = decisionsIdx.get(sentence.claimSignature) || {};
  const finding = findingsIdx.get(sentence.claimSignature) || null;

  // Rejection: unconditional hide.
  if (decision.rejected) {
    return {
      visible: false,
      hiddenReason: 'curator_rejected',
      curatorDecision: 'rejected',
      clarification: decision.clarification || null,
      reviewFinding: finding
    };
  }

  // High-confidence error finding: defensive hide unless curator has
  // explicitly approved. Approval trumps review's hide.
  if (finding && finding.kind === 'error' && finding.confidence === 'high') {
    if (!decision.approved) {
      return {
        visible: false,
        hiddenReason: 'reviewer_error_high',
        curatorDecision: null,
        clarification: decision.clarification || null,
        reviewFinding: finding
      };
    }
  }

  // Approval: publish regardless of source-tag filter.
  if (decision.approved) {
    return {
      visible: true,
      hiddenReason: null,
      curatorDecision: 'approved',
      clarification: decision.clarification || null,
      reviewFinding: finding
    };
  }

  // Base case: source tag filter decides visibility.
  const visible = sourceIsPublishable(sentence.source, publishingLevel);
  return {
    visible,
    hiddenReason: visible ? null : 'below_publishing_level',
    curatorDecision: null,
    clarification: decision.clarification || null,
    reviewFinding: finding
  };
}

// Build the flat HTML for the public site — visible sentences only,
// wrapped in <p> tags per paragraphBreaks.
function buildPublicHtml (sentences, states, paragraphBreaks) {
  const breakSet = new Set(paragraphBreaks || []);
  const paragraphs = [[]];
  for (let i = 0; i < sentences.length; i += 1) {
    if (states[i].visible) {
      paragraphs[paragraphs.length - 1].push(sentences[i].text);
    }
    if (breakSet.has(i)) {
      paragraphs.push([]);
    }
  }
  return paragraphs
    .map(function (arr) { return arr.join(' '); })
    .filter(function (p) { return p.length > 0; })
    .map(function (p) { return '<p>' + p + '</p>'; })
    .join('');
}

// Public entry point. Returns both the flat HTML and the per-sentence
// render state so callers don't double-render.
//
// opts = {
//   decisions: CURATOR_DECISIONS item (or null),
//   openFindings: array of open review findings (or null),
//   publishingLevel: 0-5 (defaults to 3),
//   config: (optional — used to override PUBLISHING_LEVELS in tests)
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

  // Combined per-sentence array for admin — sentence + state + break flag
  const breakSet = new Set(paragraphBreaks);
  const sentenceRenderData = sentences.map(function (s, i) {
    return Object.assign({}, s, states[i], { paragraphBreak: breakSet.has(i) });
  });

  return {
    html: buildPublicHtml(sentences, states, paragraphBreaks),
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
