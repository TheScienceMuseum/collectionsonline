'use strict';

// Renders a source-tagged biography to HTML for the public site, and
// exposes per-sentence render state for the admin UI. The layout of the
// output is decided by two orthogonal signals:
//
//   1. Publishing level (collection-wide, 0-5) — filters sentences by
//      their source tag. See PUBLISHING_LEVELS below.
//   2. Curator decisions on the CURATOR_DECISIONS item — approvals
//      override the source-tag filter (publish anyway), rejections
//      force-hide (regardless of anything else), clarifications
//      annotate without changing visibility.
//
// Callers pass in the parsed biography + the CURATOR_DECISIONS item +
// publishingLevel. Renderer returns both the flat HTML (public site)
// and the per-sentence render-state array (admin detail page) so we
// don't double-render for the two audiences.

const wikidataLabels = require('./wikidata-property-labels');
const { getSources } = require('./parse-source-tagged-response');

// Which source tags publish at each level. Higher levels include
// everything from lower levels. `llm:validated:*` is a prefix — used
// for sentences promoted from `llm:general_knowledge` after external
// verification; matched via `startsWith`.
// Order within each tier follows the writer prompt's priority ladder:
//   museum > oxfordDNB > wikidata > gracesGuide > wikipedia >
//   llm:inferred > llm:contextualising > llm:validated:* >
//   llm:general_knowledge
//
// External input sources (oxfordDNB / gracesGuide / wikipedia) each
// enter at the tier that matches their trust level: ODNB with wikidata
// (both authoritative structured/prose), Grace's Guide + Wikipedia
// with llm:inferred (subject-expert / community-edited narrative that
// carries a verbatim citation). Earlier iterations of this table
// omitted the external tags entirely, which silently HID every
// sentence tagged wikipedia / oxfordDNB / gracesGuide via the
// weakest-source-wins rule below — a real bug once the writer began
// emitting them.
const PUBLISHING_LEVELS = [
  ['museum'], // 0
  ['museum', 'wikidata', 'oxfordDNB'], // 1
  ['museum', 'wikidata', 'oxfordDNB', 'gracesGuide', 'wikipedia', 'llm:inferred'], // 2
  ['museum', 'wikidata', 'oxfordDNB', 'gracesGuide', 'wikipedia', 'llm:inferred', 'llm:contextualising'], // 3
  ['museum', 'wikidata', 'oxfordDNB', 'gracesGuide', 'wikipedia', 'llm:inferred', 'llm:contextualising', 'llm:validated:*'], // 4
  ['museum', 'wikidata', 'oxfordDNB', 'gracesGuide', 'wikipedia', 'llm:inferred', 'llm:contextualising', 'llm:validated:*', 'llm:general_knowledge'] // 5
];
const DEFAULT_LEVEL = 3;

// Human-readable "what level N publishes" string. Used by the admin
// detail template for tooltips so the copy tracks the actual current
// level rather than the previous hardcoded "Level 3 (default)".
function describeLevel (level) {
  const src = PUBLISHING_LEVELS[level] || PUBLISHING_LEVELS[DEFAULT_LEVEL];
  return src.join(' + ');
}

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

// Weakest-source-wins: a multi-source sentence publishes only when
// EVERY source in its array clears the current publishing level. See
// internal-docs/multi-source-sentence-tagging-spec.md § publishing
// filter for the rationale (defensive-by-default; a mixed
// wikidata+llm:inferred sentence is capped by its LLM component).
function sourcesArePublishable (sources, level) {
  if (!Array.isArray(sources) || sources.length === 0) return false;
  return sources.every(function (s) { return sourceIsPublishable(s, level); });
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

// Compute the render state for a single sentence given decisions +
// publishing level. Returns:
//   { visible, hiddenReason, curatorDecision, clarification, state }
function sentenceRenderState (sentence, decisionsIdx, publishingLevel) {
  const decision = decisionsIdx.get(sentence.claimSignature) || {};

  let visible;
  let hiddenReason;
  let curatorDecision;

  // Rejection: unconditional hide.
  if (decision.rejected) {
    visible = false;
    hiddenReason = 'curator_rejected';
    curatorDecision = 'rejected';
  } else if (decision.approved) {
    // Approval: publish regardless of source-tag filter.
    visible = true;
    hiddenReason = null;
    curatorDecision = 'approved';
  } else {
    // Base case: source tag filter decides visibility. For multi-
    // source sentences the WEAKEST source wins — a mixed
    // wikidata+llm:inferred sentence is capped by the inferred
    // component and only publishes at levels that admit it.
    visible = sourcesArePublishable(getSources(sentence), publishingLevel);
    hiddenReason = visible ? null : 'below_publishing_level';
    curatorDecision = null;
  }

  return {
    visible,
    hiddenReason,
    curatorDecision,
    clarification: decision.clarification || null,
    // Two-axis state. `visible` is the gate result. `decidedBy`
    // distinguishes an auto-decision (system rules) from a curator
    // override.
    state: {
      visible,
      decidedBy: (decision.approved || decision.rejected) ? 'curator' : 'auto'
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

// Reshape a sourceDetail string for compact display alongside the
// source pill. Two operations:
//
// 1. Strip the leading source prefix from each citation when it
//    matches the sentence's declared source. The source pill already
//    carries the source name, so repeating it in every citation
//    ("wikidata · wikidata:P106 (occupation)") is noisy + causes
//    overflow in the hover rail.
// 2. Strip `relatedItem:*` citations entirely — the trailing object
//    hyperlink chips below the pill already surface the item's title
//    and link. Re-displaying `relatedItem:coXXX` in the source pill
//    is redundant (Task 62 UX). Non-relatedItem pieces on the same
//    sentence (e.g. `personData.birthDate`) still show.
//
// Case-insensitive match on prefixes. Returns empty string when the
// resulting citation list is empty — the template then renders just
// the source name.
function stripRedundantSourcePrefix (sourceDetail, source) {
  if (!sourceDetail || !source || typeof sourceDetail !== 'string') return sourceDetail || '';
  const prefix = source.toLowerCase() + ':';
  const pieces = sourceDetail.split(/([,;])/);
  const kept = [];
  for (let i = 0; i < pieces.length; i += 1) {
    const piece = pieces[i];
    if (piece === ',' || piece === ';') {
      kept.push(piece);
      continue;
    }
    const trimmed = piece.trim();
    const trimmedLower = trimmed.toLowerCase();
    // Drop relatedItem:* citations entirely — object chips carry it.
    if (trimmedLower.indexOf('relateditem:') === 0) continue;
    // Strip redundant source prefix.
    if (trimmedLower.indexOf(prefix) === 0) {
      const leading = piece.match(/^\s*/)[0];
      const trailing = piece.match(/\s*$/)[0];
      kept.push(leading + trimmed.slice(prefix.length) + trailing);
      continue;
    }
    kept.push(piece);
  }
  // Clean up: if the kept list starts/ends with separators (because
  // we dropped a relatedItem piece from either end), trim them.
  while (kept.length && (kept[0] === ',' || kept[0] === ';' || kept[0].trim() === '')) kept.shift();
  while (kept.length && (kept[kept.length - 1] === ',' || kept[kept.length - 1] === ';' || kept[kept.length - 1].trim() === '')) kept.pop();
  // Also collapse any consecutive separators (e.g. "a; ; b" after a
  // drop) down to one.
  const collapsed = [];
  for (let j = 0; j < kept.length; j += 1) {
    const p = kept[j];
    if ((p === ',' || p === ';') && collapsed.length && (collapsed[collapsed.length - 1] === ',' || collapsed[collapsed.length - 1] === ';')) {
      continue;
    }
    collapsed.push(p);
  }
  return collapsed.join('').trim();
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

// Convert writer-emitted `{coXXXX|Title}` markers into safe anchor
// tags AFTER escapeHtml runs. Two-step design:
//   1. escapeHtml turns any HTML the writer emitted into inert text
//      (defence-in-depth against the model injecting <script> etc.)
//   2. this substitution replaces the marker syntax with an anchor.
//      The href is constrained to `/objects/co\d+` (only digits in the
//      ID part of the regex) — no user-supplied URL can leak through.
//      The visible title has already been escaped in step 1, so any
//      HTML/quotes inside the title render as text, not markup.
// If a marker's ID isn't in the references list, the marker still
// substitutes (curators can approve the URL manually) but the anchor
// title falls through unchanged.
//
// The brace-counts are `\{+` and `\}+` (one or more) rather than a
// single brace on each end so we tolerate writer malformations:
//   {{coXXXX|Title}}       — double brace on each side
//   {coXXXX|Title}}        — extra trailing brace only
//   {{coXXXX|Title}        — extra leading brace only
// All three collapse to the same anchor. Without this we saw orphan
// `}` characters trailing anchors in prose (cp37726 in the collection
// text — user report 2026-07-27). `co\d+` still gates the ID so
// non-marker prose containing braces (rare, but possible) is
// untouched — `{prose text}` doesn't match because no `co\d+` follows.
function linkifyObjectMarkers (escapedText) {
  return String(escapedText).replace(
    /\{+(co\d+)\|([^}]+)\}+/g,
    function (_, id, title) {
      return '<a class="ai-object-chip ai-object-chip--inline" href="/objects/' + id + '" title="View this object in the collection">' + title + '</a>';
    }
  );
}

// Build a paragraphed HTML block from a subset of sentences. `subset`
// is a list of { text, index, claimSignature? } — index refers back
// to the original sentences array so paragraphBreaks that fall
// between kept sentences still fire. Each sentence is wrapped in a
// `<span data-signature="...">` so the admin detail's hover-highlight
// script can map rendered prose back to per-sentence Claims rows.
// Text is escaped, then writer-emitted `{coXXXX|Title}` markers get
// converted to safe object-page anchors inline (see linkifyObjectMarkers).
//
// Note: earlier iterations also emitted a "In the collection: [Chip1]
// [Chip2] …" strip below each paragraph as a summary of the catalogue
// items cited. That was useful before the writer started weaving item
// titles into flowing prose as inline anchors — the strip was the
// only clickable route to the object pages. Once inline linkification
// via the marker syntax became reliable, the strip was pure
// duplication. Removed. `entry.chips` is still populated by the
// caller (chipsForSentence) for the render-time data model, but the
// output HTML no longer includes it.
function buildParagraphedHtml (subset, paragraphBreaks) {
  if (!subset.length) return '';
  const breakSet = new Set(paragraphBreaks || []);
  const paragraphs = [[]];
  subset.forEach(function (entry) {
    const sigAttr = entry.claimSignature ? ' data-signature="' + entry.claimSignature + '"' : '';
    paragraphs[paragraphs.length - 1].push(
      '<span' + sigAttr + '>' + linkifyObjectMarkers(escapeHtml(entry.text)) + '</span>'
    );
    // Fire a paragraph break AFTER this sentence if either
    //   (a) the original index is a paragraphBreak, OR
    //   (b) this was the last kept sentence before a gap where
    //       intervening sentences all landed in the other block.
    if (breakSet.has(entry.index)) {
      paragraphs.push([]);
    }
  });
  return paragraphs
    .filter(function (p) { return p.length > 0; })
    .map(function (spans) { return '<p>' + spans.join(' ') + '</p>'; })
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

// Annotate each citation with a `chipType` field so the admin template
// can render icon + name/title without doing prefix-string checks in
// Handlebars. Types:
//   person     — relatedPerson:cp<n> or ap<n> (people + organisations)
//   object     — relatedItem:coXXXX  (physical catalogue objects)
//   document   — relatedItem:apXXXX  (archive / documents)
//   wikidata   — wikidata:P<n>
//   personData — personData.<key>   (museum-side freetext / structured field)
//   unknown    — anything else (older records, unrecognised prefix)
// Also carries through the enrichment fields the validator attached
// (name, role, href, title, itemType) so the template can render them
// directly. Old-shape citations without enrichment fall back gracefully.
// Turn the raw citations[] array into a curator-facing "Citations"
// list, grouped by field so identical labels don't repeat. Every group
// carries an `anchors` list — the value / excerpt entries that support
// that specific field — so the template can render:
//
//   [icon] biography
//          "excerpt one"
//          "excerpt two"
//
// (Groups with a single anchor collapse to a one-liner via CSS.)
//
// Also does the enrichment lookups that the write-time validator does
// on new records but that old records won't have: title from
// referencesById for relatedItem, human property label for wikidata,
// href fallback. So old records look identical to fresh regens.
//
// Redundant-value cleanup: when the writer emits value=<the ID again>
// (e.g. {field: 'relatedItem:co83634', value: 'co83634'}), we drop the
// anchor entirely so the row doesn't read "Statue of Hygeia = co83634".
// Same for relatedPerson.
//
// Returns a flat array of groups:
//   [{ field, chipType, chipLabel, name?, role?, href?, anchors: [
//     { kind: 'excerpt' | 'value', text }
//   ] }]
function annotateCitationTypes (citations, referencesById) {
  if (!Array.isArray(citations) || citations.length === 0) return [];
  const refs = referencesById || Object.create(null);
  const groups = Object.create(null);
  const order = [];

  citations.forEach(function (c) {
    if (!c || typeof c !== 'object' || !c.field) return;
    const field = c.field;
    let group = groups[field];
    if (!group) {
      group = buildGroupHeader(c, refs);
      groups[field] = group;
      order.push(field);
    }
    // Compute the anchor for this citation (if any). Redundant value
    // cleanup happens inside pickAnchor — it knows what the group's
    // chipLabel is and can suppress a value that just repeats it.
    const anchor = pickAnchor(c, group);
    if (anchor) group.anchors.push(anchor);
  });

  // Compute a `soleAnchor` hint per group so the template can render
  // one-anchor rows inline (`birthDate → 1879-03-14`) and multi-anchor
  // rows stacked (label on its own line, anchors indented beneath).
  // Only inline when there's exactly one anchor and it's a value —
  // single excerpts still get their own line so long quoted text
  // doesn't overflow the header.
  return order.map(function (f) {
    const g = groups[f];
    if (g.anchors.length === 1 && g.anchors[0].kind === 'value') {
      g.soleAnchor = g.anchors[0];
    } else {
      g.soleAnchor = null;
    }
    return g;
  });
}

// Build the header row for a citation group — icon type, human label,
// linked href, and (for persons) role. Data flows through from the
// validator's enrichment first; missing pieces fall back to lookups
// against referencesById + the wikidata property-label map.
function buildGroupHeader (c, refs) {
  const field = c.field;
  const header = { field, chipType: 'unknown', chipLabel: field, href: c.href || null, anchors: [] };

  if (field.indexOf('relatedPerson:') === 0) {
    header.chipType = 'person';
    // Lookup path: validator enrichment (new records) → references[]
    // (populated at write time by deriveReferencesFromSentences, which
    // now walks both sourceDetail AND citations[] and includes
    // persons) → raw id fallback.
    const id = field.slice('relatedPerson:'.length);
    const ref = refs[id] || refs[id.toLowerCase()];
    header.chipLabel = c.name || (ref && ref.title) || id;
    const role = c.role || (ref && ref.role) || null;
    if (role) header.role = role;
    if (!header.href && ref && ref.link) header.href = ref.link;
  } else if (field.indexOf('relatedItem:') === 0) {
    header.chipType = (c.itemType === 'document') ? 'document' : 'object';
    const id = field.slice('relatedItem:'.length);
    const ref = refs[id] || refs[id.toLowerCase()];
    header.chipLabel = c.title || (ref && ref.title) || id;
    if (!header.href && ref && ref.link) header.href = ref.link;
  } else if (field.indexOf('wikidata:') === 0) {
    header.chipType = 'wikidata';
    const pcode = field.slice('wikidata:'.length).toUpperCase();
    const label = wikidataLabels.labelFor(pcode);
    // Prefix with "wikidata:" so curators know the source without
    // needing the parent group header — matters especially when this
    // citation appears under a "primarily llm:inferred" group where
    // a bare "P108 employer" reads as orphaned metadata.
    header.chipLabel = label ? 'wikidata:' + pcode + ' ' + label : 'wikidata:' + pcode;
  } else if (field.indexOf('personData.') === 0) {
    header.chipType = 'personData';
    // Same rationale as the wikidata case above — explicit source
    // prefix on the label so it stands on its own.
    header.chipLabel = 'personData: ' + field.slice('personData.'.length);
  } else if (field.indexOf('wikipedia:') === 0) {
    header.chipType = 'wikipedia';
    // Article title after the colon; prepend the source name so the
    // pill reads coherently on its own (matches the wikidata / personData
    // convention above).
    header.chipLabel = 'wikipedia: ' + field.slice('wikipedia:'.length);
  } else if (field.indexOf('oxfordDNB:') === 0) {
    header.chipType = 'oxfordDNB';
    header.chipLabel = 'oxfordDNB: ' + field.slice('oxfordDNB:'.length);
  } else if (field.indexOf('gracesGuide:') === 0) {
    header.chipType = 'gracesGuide';
    header.chipLabel = 'gracesGuide: ' + field.slice('gracesGuide:'.length);
  }
  return header;
}

// Pick the anchor to display for one citation. Returns null when the
// citation's value is redundant with what the header already conveys.
function pickAnchor (c, group) {
  if (c.excerpt != null && String(c.excerpt).trim() !== '') {
    return { kind: 'excerpt', text: String(c.excerpt) };
  }
  if (c.value == null) return null;
  const text = String(c.value);
  if (text === '') return null;

  // Suppress values that just repeat the ID / label / name for
  // person + item citations. Wikidata + personData values are the
  // actual data ("ETH Zurich", "1879-03-14") and always shown.
  if (group.chipType === 'object' || group.chipType === 'document') {
    const id = c.field.slice('relatedItem:'.length);
    if (text === id || text === group.chipLabel) return null;
  } else if (group.chipType === 'person') {
    const id = c.field.slice('relatedPerson:'.length);
    if (text === id || text === group.chipLabel) return null;
  }
  return { kind: 'value', text };
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

  const states = sentences.map(function (s) {
    return sentenceRenderState(s, decisionsIdx, publishingLevel);
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
      citations: annotateCitationTypes(s.citations),
      inCollection: sentenceIsInCollection(s),
      // Pre-rendered HTML variant of the sentence text: escaped +
      // linkified {coXXXX|Title} markers. The Claims-list template
      // uses this (triple-brace) so curators see the same clickable
      // links the public prose has, not the raw {co…|…} syntax. The
      // plain `text` field stays untouched — that's the canonical
      // form used in claim-signature computation and the hidden POST
      // inputs that carry the sentence back to the reject / approve
      // handlers.
      textHtml: linkifyObjectMarkers(escapeHtml(s.text || '')),
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
      ),
      // Canonical multi-source array on the rendered sentence.
      // Handles both freshly-parsed records (which carry `sources` and
      // `source`) and legacy DynamoDB records (which only have
      // `source`). Downstream templates can always trust `.sources`.
      sources: getSources(s),
      // Bucket for the admin "Group by source" view. The spec puts
      // mixed sentences in their weakest-source bucket, matching the
      // publishing-filter policy — same mental model everywhere.
      // Single-source sentences: bucketSource === sources[0].
      bucketSource: getSources(s)[getSources(s).length - 1],
      // Per-clause hover-highlight. Each part's text is escape+
      // linkified the same way the whole sentence's textHtml is, so
      // {coXXXX|Title} markers still turn into anchors even inside a
      // part span. Null when the sentence has no parts (single-source
      // or parts-dropped-by-parser); the template falls back to the
      // plain textHtml render in that case.
      partsHtml: Array.isArray(s.parts) && s.parts.length >= 2
        ? s.parts.map(function (p) {
          return { source: p.source, textHtml: linkifyObjectMarkers(escapeHtml(p.text || '')) };
        })
        : null,
      // Decorated chip stack — every source in sources[] with a flag
      // saying whether the writer failed to attribute any prose span
      // to it. Template uses `uncovered` to badge the pill. Falls
      // through cleanly on legacy records: no `uncoveredSources`
      // field → empty set → all pills unflagged.
      pillData: getSources(s).map(function (src) {
        return {
          source: src,
          uncovered: Array.isArray(s.uncoveredSources) && s.uncoveredSources.indexOf(src) !== -1
        };
      })
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
module.exports.describeLevel = describeLevel;
module.exports.linkifyObjectMarkers = linkifyObjectMarkers;
module.exports.DEFAULT_LEVEL = DEFAULT_LEVEL;
module.exports.sourceIsPublishable = sourceIsPublishable;
module.exports.sentenceRenderState = sentenceRenderState;
module.exports.sentenceIsInCollection = sentenceIsInCollection;
module.exports.relatedItemIdsFromSourceDetail = relatedItemIdsFromSourceDetail;
