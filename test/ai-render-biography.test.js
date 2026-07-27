'use strict';

// Tests for render-biography — merges biography sentences with curator
// decisions, returns both the flat HTML and per-sentence render state.

const test = require('tape');
const render = require('../lib/ai/render-biography');
const { signature } = require('../lib/ai/claim-signature');

function s (text, source, sourceDetail) {
  return { text, source, sourceDetail: sourceDetail || null, claimSignature: signature(text) };
}

// Strip the `<span data-signature="…">` wrappers that Task 56 added
// around each rendered sentence so tests can assert on the visible
// text content without re-computing every signature hash. The span is
// a hook for the admin detail's hover-highlight interaction — its
// presence is exercised by the "wraps sentences in span" test below.
function stripSpans (html) {
  return html.replace(/<span data-signature="[^"]*">/g, '').replace(/<\/span>/g, '');
}

// --- Publishing level filter ----------------------------------------

test('render: level 0 publishes museum only', function (t) {
  const bio = {
    sentences: [
      s('Museum fact.', 'museum'),
      s('Wikidata fact.', 'wikidata'),
      s('Inferred fact.', 'llm:inferred')
    ],
    paragraphBreaks: []
  };
  const r = render(bio, { publishingLevel: 0 });
  t.equal(r.visibleCount, 1);
  t.equal(stripSpans(r.html), '<p>Museum fact.</p>');
  t.end();
});

test('render: level 2 publishes museum + wikidata + inferred (default range)', function (t) {
  const bio = {
    sentences: [
      s('Museum fact.', 'museum'),
      s('Wikidata fact.', 'wikidata'),
      s('Inferred synthesis.', 'llm:inferred'),
      s('Era context.', 'llm:contextualising'),
      s('Training-data fact.', 'llm:general_knowledge')
    ],
    paragraphBreaks: []
  };
  const r = render(bio, { publishingLevel: 2 });
  t.equal(r.visibleCount, 3, 'museum + wikidata + llm:inferred visible');
  t.ok(r.html.indexOf('Museum fact') !== -1);
  t.ok(r.html.indexOf('Wikidata fact') !== -1);
  t.ok(r.html.indexOf('Inferred synthesis') !== -1);
  t.ok(r.html.indexOf('Era context') === -1);
  t.ok(r.html.indexOf('Training-data') === -1);
  t.end();
});

test('render: level 3 adds llm:contextualising', function (t) {
  const bio = {
    sentences: [
      s('Museum fact.', 'museum'),
      s('Era context.', 'llm:contextualising')
    ],
    paragraphBreaks: []
  };
  const r = render(bio, { publishingLevel: 3 });
  t.equal(r.visibleCount, 2);
  t.end();
});

test('render: level 4 admits llm:validated:<source>', function (t) {
  const bio = {
    sentences: [
      s('Museum fact.', 'museum'),
      s('Externally verified.', 'llm:validated:wikipedia')
    ],
    paragraphBreaks: []
  };
  const l3 = render(bio, { publishingLevel: 3 });
  t.equal(l3.visibleCount, 1, 'validated hidden at level 3');
  const l4 = render(bio, { publishingLevel: 4 });
  t.equal(l4.visibleCount, 2, 'validated visible at level 4');
  t.end();
});

test('render: level 5 admits llm:general_knowledge', function (t) {
  const bio = {
    sentences: [
      s('Museum fact.', 'museum'),
      s('LLM training-data fact.', 'llm:general_knowledge')
    ],
    paragraphBreaks: []
  };
  const l4 = render(bio, { publishingLevel: 4 });
  t.equal(l4.visibleCount, 1);
  const l5 = render(bio, { publishingLevel: 5 });
  t.equal(l5.visibleCount, 2);
  t.end();
});

test('render: unknown / out-of-range level → default level 3', function (t) {
  const bio = {
    sentences: [
      s('Era context.', 'llm:contextualising')
    ],
    paragraphBreaks: []
  };
  t.equal(render(bio, {}).visibleCount, 1, 'default level 3 admits contextualising');
  t.equal(render(bio, { publishingLevel: -1 }).visibleCount, 0, 'clamped to level 0');
  t.equal(render(bio, { publishingLevel: 999 }).visibleCount, 1, 'clamped to level 5');
  t.end();
});

// --- Curator decisions --------------------------------------------

test('curator approval: publishes even below publishing level', function (t) {
  const gnFact = s('Training-data fact.', 'llm:general_knowledge');
  const bio = { sentences: [gnFact], paragraphBreaks: [] };
  const decisions = {
    approvals: [{ claimSignature: gnFact.claimSignature, claimText: gnFact.text, approvedBy: 'jamie' }]
  };
  const r = render(bio, { publishingLevel: 3, decisions });
  t.equal(r.visibleCount, 1, 'approved sentence publishes');
  t.equal(r.sentences[0].curatorDecision, 'approved');
  t.end();
});

test('curator rejection: hides even above publishing level', function (t) {
  const museumFact = s('Museum fact.', 'museum');
  const bio = { sentences: [museumFact], paragraphBreaks: [] };
  const decisions = {
    rejections: [{ claimSignature: museumFact.claimSignature, claimText: museumFact.text, rejectedBy: 'jamie', rationale: 'not right' }]
  };
  const r = render(bio, { publishingLevel: 3, decisions });
  t.equal(r.visibleCount, 0, 'rejected sentence hidden');
  t.equal(r.sentences[0].hiddenReason, 'curator_rejected');
  t.equal(r.sentences[0].curatorDecision, 'rejected');
  t.end();
});

test('curator clarification: attaches text but does not affect visibility', function (t) {
  const museumFact = s('Museum fact.', 'museum');
  const bio = { sentences: [museumFact], paragraphBreaks: [] };
  const decisions = {
    clarifications: [{ claimSignature: museumFact.claimSignature, claimText: museumFact.text, clarification: 'use historic name' }]
  };
  const r = render(bio, { publishingLevel: 3, decisions });
  t.equal(r.visibleCount, 1);
  t.equal(r.sentences[0].clarification, 'use historic name');
  t.end();
});

test('rejection dominates approval when both are present', function (t) {
  const museumFact = s('Museum fact.', 'museum');
  const bio = { sentences: [museumFact], paragraphBreaks: [] };
  const decisions = {
    approvals: [{ claimSignature: museumFact.claimSignature, claimText: museumFact.text, approvedBy: 'jamie' }],
    rejections: [{ claimSignature: museumFact.claimSignature, claimText: museumFact.text, rejectedBy: 'jamie' }]
  };
  const r = render(bio, { publishingLevel: 3, decisions });
  t.equal(r.visibleCount, 0);
  t.end();
});

// --- Paragraph rendering --------------------------------------------

test('paragraphBreaks: split into <p> blocks', function (t) {
  const bio = {
    sentences: [
      s('First.', 'museum'),
      s('Second.', 'museum'),
      s('Third.', 'museum'),
      s('Fourth.', 'museum')
    ],
    paragraphBreaks: [1, 3]
  };
  const r = render(bio, { publishingLevel: 3 });
  t.equal(stripSpans(r.html), '<p>First. Second.</p><p>Third. Fourth.</p>');
  t.end();
});

test('paragraphBreaks: empty paragraphs (all hidden) dropped', function (t) {
  const bio = {
    sentences: [
      s('First.', 'museum'),
      s('Hidden.', 'llm:general_knowledge'),
      s('Second.', 'museum')
    ],
    paragraphBreaks: [0, 1]
  };
  const r = render(bio, { publishingLevel: 3 });
  t.equal(stripSpans(r.html), '<p>First.</p><p>Second.</p>', 'empty paragraph collapsed');
  t.end();
});

test('paragraphBreaks: no breaks → single paragraph', function (t) {
  const bio = {
    sentences: [
      s('First.', 'museum'),
      s('Second.', 'museum')
    ],
    paragraphBreaks: []
  };
  const r = render(bio, { publishingLevel: 3 });
  t.equal(stripSpans(r.html), '<p>First. Second.</p>');
  t.end();
});

// --- Empty / missing inputs -----------------------------------------

test('render: empty biography → empty output', function (t) {
  const r = render({ sentences: [], paragraphBreaks: [] }, { publishingLevel: 3 });
  t.equal(r.html, '');
  t.equal(r.visibleCount, 0);
  t.equal(r.hiddenCount, 0);
  t.deepEqual(r.sentences, []);
  t.end();
});

test('render: null biography does not crash', function (t) {
  t.doesNotThrow(function () { render(null, {}); });
  t.doesNotThrow(function () { render(undefined, {}); });
  t.end();
});

// --- Combined structure returned to admin ---------------------------

test('render: returns rich per-sentence array with paragraphBreak flags', function (t) {
  const bio = {
    sentences: [
      s('A.', 'museum'),
      s('B.', 'museum'),
      s('C.', 'museum')
    ],
    paragraphBreaks: [1]
  };
  const r = render(bio, { publishingLevel: 3 });
  t.equal(r.sentences[0].paragraphBreak, false);
  t.equal(r.sentences[1].paragraphBreak, true, 'break at index 1');
  t.equal(r.sentences[2].paragraphBreak, false);
  t.ok(r.sentences[0].claimSignature, 'signature preserved on render output');
  t.end();
});

// --- linkifyObjectMarkers -------------------------------------------

test('linkifyObjectMarkers: converts {coXXXX|Title} to a safe anchor', function (t) {
  const out = render.linkifyObjectMarkers('is captured in {co66081|Einstein in Norfolk}, a photograph');
  t.equal(
    out,
    'is captured in <a class="ai-object-chip ai-object-chip--inline" href="/objects/co66081" title="View this object in the collection">Einstein in Norfolk</a>, a photograph'
  );
  t.end();
});

test('linkifyObjectMarkers: multiple markers in one string all substitute', function (t) {
  const out = render.linkifyObjectMarkers('The {co1|First} and the {co2|Second}.');
  t.ok(out.indexOf('href="/objects/co1"') !== -1);
  t.ok(out.indexOf('href="/objects/co2"') !== -1);
  t.equal(out.match(/<a /g).length, 2);
  t.end();
});

test('linkifyObjectMarkers: href is constrained to /objects/co<digits>', function (t) {
  // Bogus id that doesn't match the co\d+ pattern is left as literal text.
  const out = render.linkifyObjectMarkers('Try to inject {javascript:alert(1)|X}.');
  t.equal(out.indexOf('href=') === -1, true, 'no anchor href leaks through');
  t.ok(out.indexOf('{javascript:alert(1)|X}') !== -1, 'marker stays literal');
  t.end();
});

test('linkifyObjectMarkers: no marker → unchanged', function (t) {
  const s = 'A plain sentence with no markers.';
  t.equal(render.linkifyObjectMarkers(s), s);
  t.end();
});

// Regression — 2026-07-27. cp37726 on staging rendered orphan `}`
// characters after several linkified items ("Lacock Abbey}",
// "The Pencil of Nature},"). Cause: writer emitted the marker with
// extra closing braces (e.g. `{coXXXX|Title}}`); the regex only
// consumed one and left the rest as visible text. Fix: tolerate 1+
// braces on both ends.
test('linkifyObjectMarkers: extra trailing brace is consumed (regression)', function (t) {
  const out = render.linkifyObjectMarkers('the {co4028|Windows from Lacock Abbey}}, the oldest.');
  t.equal(out.indexOf('}') === -1 || out.indexOf('}') > out.indexOf('</a>'), true, 'no orphan brace before </a>');
  t.equal(/Abbey<\/a>,/.test(out), true, 'anchor closes cleanly, no trailing } between </a> and ,');
  t.end();
});

test('linkifyObjectMarkers: double brace on both sides is consumed (regression)', function (t) {
  const out = render.linkifyObjectMarkers('the {{co4028|Windows from Lacock Abbey}}, the oldest.');
  t.equal(/[{}]/.test(out), false, 'no orphan braces remain');
  t.equal(/Abbey<\/a>,/.test(out), true, 'anchor closes cleanly');
  t.end();
});

test('linkifyObjectMarkers: leading extra brace is consumed (regression)', function (t) {
  const out = render.linkifyObjectMarkers('the {{co4028|Windows}, an item.');
  t.equal(/[{}]/.test(out), false, 'no orphan braces remain');
  t.end();
});

test('linkifyObjectMarkers: prose with unrelated braces is untouched', function (t) {
  // JSON-shaped content (opens with `"`, contains `:`) must NOT be
  // stripped by the bare-title fallback pass.
  const s = 'JSON payload: {"key": "value"} — stays as-is.';
  t.equal(render.linkifyObjectMarkers(s), s);
  t.end();
});

// Regression — 2026-07-27. cp60883 (Vickers) rendered visible braces
// around item titles the writer wrapped without a `coXXXX|` prefix:
//   "the {M4000 Series Universal Microscope} and the {Vickers M41
//   photoplan microscope}"
// The writer knew these were catalogue items but omitted the IDs.
// Fallback pass strips the braces — no hyperlink (there's no ID to
// link to) but clean prose.
test('linkifyObjectMarkers: bare title without co-id has braces stripped (regression)', function (t) {
  const out = render.linkifyObjectMarkers('the {M4000 Series Universal Microscope} and the {Vickers M41 photoplan microscope}');
  t.equal(out, 'the M4000 Series Universal Microscope and the Vickers M41 photoplan microscope');
  t.end();
});

test('linkifyObjectMarkers: valid marker + bare title mixed in one string', function (t) {
  const out = render.linkifyObjectMarkers('the {co505729|Patholette} and the {Vickers M41}');
  t.ok(/href="\/objects\/co505729"/.test(out), 'valid marker still linkified');
  t.ok(/the Vickers M41(?!<)/.test(out), 'bare title has braces stripped, no anchor');
  t.equal(/[{}]/.test(out), false, 'no orphan braces remain');
  t.end();
});

test('linkifyObjectMarkers: nested braces (JSON-shaped) untouched', function (t) {
  // A more adversarial case — content that starts with `{` should NOT
  // be stripped as a bare title.
  const s = 'Config: {{outer: "value"}}';
  t.equal(render.linkifyObjectMarkers(s), s);
  t.end();
});

test('render: sentence text with markers produces textHtml with anchor + preserves raw text', function (t) {
  const bio = {
    sentences: [{
      text: 'is captured in {co66081|Einstein in Norfolk}, a photograph.',
      source: 'museum',
      sourceDetail: 'relatedItem:co66081',
      claimSignature: signature('is captured in {co66081|Einstein in Norfolk}, a photograph.')
    }],
    paragraphBreaks: []
  };
  const r = render(bio, { publishingLevel: 3 });
  t.equal(r.sentences[0].text, 'is captured in {co66081|Einstein in Norfolk}, a photograph.', 'raw text unchanged');
  t.ok(r.sentences[0].textHtml.indexOf('href="/objects/co66081"') !== -1, 'textHtml has anchor');
  t.ok(r.sentences[0].textHtml.indexOf('Einstein in Norfolk') !== -1, 'title preserved');
  t.equal(r.sentences[0].textHtml.indexOf('{co66081'), -1, 'marker syntax gone from textHtml');
  t.end();
});

// --- Multi-source publishing filter (spec: internal-docs/multi-source-sentence-tagging-spec.md)

function sm (text, sources) {
  return { text, sources, source: sources[0], sourceDetail: null, claimSignature: signature(text) };
}

test('multi-source: sentence publishes at level 3 when all sources clear (wikidata + llm:inferred)', function (t) {
  const r = render({
    sentences: [sm('Mixed at 3.', ['wikidata', 'llm:inferred'])],
    paragraphBreaks: []
  }, { publishingLevel: 3 });
  t.equal(r.sentences[0].visible, true, 'level 3 admits both wikidata and llm:inferred');
  t.end();
});

test('multi-source: sentence hides at level 1 because llm:inferred fails weakest-source check', function (t) {
  const r = render({
    sentences: [sm('Mixed at 1.', ['wikidata', 'llm:inferred'])],
    paragraphBreaks: []
  }, { publishingLevel: 1 });
  t.equal(r.sentences[0].visible, false, 'level 1 only admits museum + wikidata; llm:inferred is the ceiling');
  t.equal(r.sentences[0].hiddenReason, 'below_publishing_level');
  t.end();
});

test('multi-source: sentence hides at level 3 when it contains llm:general_knowledge', function (t) {
  const r = render({
    sentences: [sm('Mixed with general.', ['museum', 'llm:general_knowledge'])],
    paragraphBreaks: []
  }, { publishingLevel: 3 });
  t.equal(r.sentences[0].visible, false, 'general_knowledge caps the sentence at level 5');
  t.end();
});

test('multi-source: legacy single `source` still publishes at appropriate level (backwards compat)', function (t) {
  const legacy = { text: 'Legacy.', source: 'wikidata', sourceDetail: null, claimSignature: signature('Legacy.') };
  const r = render({ sentences: [legacy], paragraphBreaks: [] }, { publishingLevel: 1 });
  t.equal(r.sentences[0].visible, true, 'wikidata at level 1 → visible');
  t.deepEqual(r.sentences[0].sources, ['wikidata'], 'sources array populated on legacy render output');
  t.end();
});

test('multi-source: rendered sentence exposes canonical `sources` array', function (t) {
  const r = render({
    sentences: [sm('Rich.', ['museum', 'wikidata'])],
    paragraphBreaks: []
  }, { publishingLevel: 3 });
  t.deepEqual(r.sentences[0].sources, ['museum', 'wikidata'], 'both sources exposed to admin UI');
  t.end();
});

test('per-clause parts: rendered sentence exposes parts array when present', function (t) {
  const s = {
    text: 'A wikidata bit, plus an inferred bit.',
    source: 'wikidata',
    sources: ['wikidata', 'llm:inferred'],
    parts: [
      { text: 'A wikidata bit,', source: 'wikidata' },
      { text: ' plus an inferred bit.', source: 'llm:inferred' }
    ],
    sourceDetail: null,
    claimSignature: signature('A wikidata bit, plus an inferred bit.')
  };
  const r = render({ sentences: [s], paragraphBreaks: [] }, { publishingLevel: 3 });
  t.equal(r.sentences[0].parts.length, 2, 'parts propagate to admin UI');
  t.equal(r.sentences[0].parts[0].source, 'wikidata');
  t.end();
});

test('per-clause parts: rendered sentence has parts=null (or absent) for chip-stack-only fallback', function (t) {
  const s = { text: 'Plain.', source: 'museum', sources: ['museum'], sourceDetail: null, claimSignature: signature('Plain.') };
  const r = render({ sentences: [s], paragraphBreaks: [] }, { publishingLevel: 3 });
  t.ok(r.sentences[0].parts == null, 'no parts on the input → falsy on the output; template falls back to chip-stack render');
  t.end();
});

// --- External input sources (regression guard) ---------------------
//
// Earlier iterations of PUBLISHING_LEVELS listed only museum + wikidata
// + llm:*. Sentences the writer tagged wikipedia / oxfordDNB /
// gracesGuide were then silently hidden by the weakest-source-wins
// rule, producing empty biographies for well-known subjects whose
// facts came from Wikipedia. These tests guard against that regression.

test('wikipedia source: publishes at default level', function (t) {
  const bio = { sentences: [s('Founded 1890 by Sir Thomas Lipton.', 'wikipedia')], paragraphBreaks: [] };
  const r = render(bio, { publishingLevel: 3 });
  t.equal(r.visibleCount, 1, 'wikipedia sentence publishes at Level 3');
  t.end();
});

test('oxfordDNB source: publishes from level 1', function (t) {
  const bio = { sentences: [s('Trained as a physician.', 'oxfordDNB')], paragraphBreaks: [] };
  t.equal(render(bio, { publishingLevel: 1 }).visibleCount, 1, 'ODNB publishes at Level 1');
  t.equal(render(bio, { publishingLevel: 3 }).visibleCount, 1, 'ODNB still publishes at Level 3');
  t.equal(render(bio, { publishingLevel: 0 }).visibleCount, 0, 'ODNB hidden at Level 0 (museum only)');
  t.end();
});

test('gracesGuide source: publishes at default level', function (t) {
  const bio = { sentences: [s('Stephenson built locomotives at Killingworth.', 'gracesGuide')], paragraphBreaks: [] };
  t.equal(render(bio, { publishingLevel: 3 }).visibleCount, 1, 'Grace\'s Guide publishes at Level 3');
  t.equal(render(bio, { publishingLevel: 1 }).visibleCount, 0, 'Grace\'s Guide hidden at Level 1 (needs Level 2+)');
  t.end();
});

test('mixed wikidata + wikipedia sources: publishes at default level (Lipton bug regression)', function (t) {
  // Exact repro of the shape the reasoning writer emits for Lipton
  // after Wikipedia was enabled as an input. Weakest source is
  // wikipedia, which must be in the Level-3 allowed list or every
  // wikipedia-tagged sentence disappears from the biography.
  const sentence = {
    text: 'Lipton is a British food and beverage brand founded in 1890.',
    source: 'wikidata',
    sources: ['wikidata', 'wikipedia'],
    sourceDetail: 'wikidata:P571',
    claimSignature: signature('Lipton is a British food and beverage brand founded in 1890.')
  };
  const r = render({ sentences: [sentence], paragraphBreaks: [] }, { publishingLevel: 3 });
  t.equal(r.visibleCount, 1, 'mixed wikidata+wikipedia sentence publishes at Level 3');
  t.end();
});

// --- Citation chipType detection (icon-mapping regression guard) ---
//
// The admin detail template renders each citation with an SVG icon
// selected via `#entity-icon-<chipType>`. Wikipedia / Oxford DNB /
// Grace's Guide sources previously fell through to chipType='unknown'
// and rendered a broken icon reference. These tests protect the
// chipType detection so the icons render for every source we ship.

test('citation chipType: wikipedia field maps to chipType=wikipedia', function (t) {
  const sent = {
    text: 'A wikipedia-sourced sentence.',
    source: 'wikipedia',
    sources: ['wikipedia'],
    sourceDetail: 'wikipedia:Lipton',
    claimSignature: signature('A wikipedia-sourced sentence.'),
    citations: [{ field: 'wikipedia:Lipton', excerpt: 'Lipton is a British brand.' }]
  };
  const r = render({ sentences: [sent], paragraphBreaks: [] }, { publishingLevel: 3 });
  const c = r.sentences[0].citations[0];
  t.equal(c.chipType, 'wikipedia');
  t.equal(c.chipLabel, 'wikipedia: Lipton');
  t.end();
});

test('citation chipType: oxfordDNB field maps to chipType=oxfordDNB', function (t) {
  const sent = {
    text: 'An ODNB-sourced sentence.',
    source: 'oxfordDNB',
    sources: ['oxfordDNB'],
    sourceDetail: 'oxfordDNB:Anderson, Elizabeth Garrett',
    claimSignature: signature('An ODNB-sourced sentence.'),
    citations: [{ field: 'oxfordDNB:Anderson, Elizabeth Garrett', excerpt: 'first female doctor to qualify in England.' }]
  };
  const r = render({ sentences: [sent], paragraphBreaks: [] }, { publishingLevel: 3 });
  const c = r.sentences[0].citations[0];
  t.equal(c.chipType, 'oxfordDNB');
  t.equal(c.chipLabel, 'oxfordDNB: Anderson, Elizabeth Garrett');
  t.end();
});

test('citation chipType: gracesGuide field maps to chipType=gracesGuide', function (t) {
  const sent = {
    text: 'A Grace\'s Guide-sourced sentence.',
    source: 'gracesGuide',
    sources: ['gracesGuide'],
    sourceDetail: 'gracesGuide:Robert Stephenson',
    claimSignature: signature('A Grace\'s Guide-sourced sentence.'),
    citations: [{ field: 'gracesGuide:Robert Stephenson', excerpt: 'apprenticed at Killingworth colliery.' }]
  };
  const r = render({ sentences: [sent], paragraphBreaks: [] }, { publishingLevel: 3 });
  const c = r.sentences[0].citations[0];
  t.equal(c.chipType, 'gracesGuide');
  t.equal(c.chipLabel, 'gracesGuide: Robert Stephenson');
  t.end();
});
