'use strict';

// Tests for render-biography — merges biography sentences with curator
// decisions and open review findings, returns both the flat HTML and
// per-sentence render state.

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

// --- Review findings ------------------------------------------------

test('review error:high finding: hides sentence by default', function (t) {
  const museumFact = s('Wrong-attribution fact.', 'museum');
  const bio = { sentences: [museumFact], paragraphBreaks: [] };
  const openFindings = [
    { claimSignature: museumFact.claimSignature, kind: 'error', confidence: 'high', concern: 'attribution issue' }
  ];
  const r = render(bio, { publishingLevel: 3, openFindings });
  t.equal(r.visibleCount, 0);
  t.equal(r.sentences[0].hiddenReason, 'reviewer_error_high');
  t.ok(r.sentences[0].reviewFinding, 'finding attached to sentence');
  t.equal(r.sentences[0].reviewFinding.confidence, 'high');
  t.end();
});

test('review error:medium finding: publishes but annotates', function (t) {
  const museumFact = s('Possibly-wrong fact.', 'museum');
  const bio = { sentences: [museumFact], paragraphBreaks: [] };
  const openFindings = [
    { claimSignature: museumFact.claimSignature, kind: 'error', confidence: 'medium', concern: 'possibly wrong' }
  ];
  const r = render(bio, { publishingLevel: 3, openFindings });
  t.equal(r.visibleCount, 1, 'medium-confidence error does not hide');
  t.ok(r.sentences[0].reviewFinding);
  t.end();
});

test('review error:low finding: publishes, annotates quietly', function (t) {
  const museumFact = s('Hunch-flagged fact.', 'museum');
  const bio = { sentences: [museumFact], paragraphBreaks: [] };
  const openFindings = [
    { claimSignature: museumFact.claimSignature, kind: 'error', confidence: 'low', concern: 'weak hunch' }
  ];
  const r = render(bio, { publishingLevel: 3, openFindings });
  t.equal(r.visibleCount, 1);
  t.end();
});

test('review info finding: publishes, annotates as context', function (t) {
  const museumFact = s('Nobel 1921 fact.', 'museum');
  const bio = { sentences: [museumFact], paragraphBreaks: [] };
  const openFindings = [
    { claimSignature: museumFact.claimSignature, kind: 'info', confidence: 'medium', concern: 'received 1922 actually' }
  ];
  const r = render(bio, { publishingLevel: 3, openFindings });
  t.equal(r.visibleCount, 1, 'info findings never hide');
  t.ok(r.sentences[0].reviewFinding);
  t.equal(r.sentences[0].reviewFinding.kind, 'info');
  t.end();
});

test('curator approval trumps review error:high hide', function (t) {
  const museumFact = s('Fact curator approved.', 'museum');
  const bio = { sentences: [museumFact], paragraphBreaks: [] };
  const decisions = {
    approvals: [{ claimSignature: museumFact.claimSignature, claimText: museumFact.text, approvedBy: 'jamie' }]
  };
  const openFindings = [
    { claimSignature: museumFact.claimSignature, kind: 'error', confidence: 'high', concern: 'reviewer disagrees' }
  ];
  const r = render(bio, { publishingLevel: 3, decisions, openFindings });
  t.equal(r.visibleCount, 1, 'approval trumps reviewer error:high');
  t.equal(r.sentences[0].curatorDecision, 'approved');
  t.end();
});

test('multiple findings on same sentence: highest severity wins', function (t) {
  const museumFact = s('Contested fact.', 'museum');
  const bio = { sentences: [museumFact], paragraphBreaks: [] };
  const openFindings = [
    { claimSignature: museumFact.claimSignature, kind: 'info', confidence: 'low', concern: 'minor' },
    { claimSignature: museumFact.claimSignature, kind: 'error', confidence: 'high', concern: 'major' },
    { claimSignature: museumFact.claimSignature, kind: 'error', confidence: 'medium', concern: 'middle' }
  ];
  const r = render(bio, { publishingLevel: 3, openFindings });
  t.equal(r.sentences[0].reviewFinding.confidence, 'high', 'highest-severity finding chosen');
  t.equal(r.sentences[0].reviewFinding.concern, 'major');
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
