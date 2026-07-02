'use strict';

// Tests for the per-generation reviewer wrapper.

const test = require('tape');
const review = require('../lib/ai/review-biography-tagged');
const { signature } = require('../lib/ai/claim-signature');

function makeFakeClient (rawTextResponse, usage) {
  const state = { calls: [] };
  state.client = {
    messages: {
      create: function (params) {
        state.calls.push(params);
        return Promise.resolve({
          content: [{ type: 'text', text: rawTextResponse }],
          usage: usage || { input_tokens: 800, output_tokens: 200 }
        });
      }
    }
  };
  return state;
}

function bioSentence (text, source) {
  return { text, source: source || 'museum', sourceDetail: null, claimSignature: signature(text) };
}

function biography () {
  return {
    sentences: [
      bioSentence('Einstein was born in Ulm in 1879.'),
      bioSentence('He worked at the Federal Office for Intellectual Property.'),
      bioSentence('The 1919 eclipse expedition confirmed general relativity.', 'wikidata')
    ],
    paragraphBreaks: [2],
    writerNotes: 'Sample writer notes.'
  };
}

// --- Happy path ------------------------------------------------------

test('review: valid response → normalised findings + metadata', async function (t) {
  const raw = JSON.stringify({
    overallVerdict: 'possible_issues',
    verdictReasoning: 'Sample review.',
    factualIssues: [
      {
        claim: 'The 1919 eclipse expedition confirmed general relativity.',
        kind: 'error',
        confidence: 'high',
        concern: 'Two teams, only one attributable to subject.'
      }
    ]
  });
  const fake = makeFakeClient(raw);
  const out = await review(biography(), { apiKey: 'sk-test', client: fake.client });
  t.ok(out, 'returned a result');
  t.equal(out.findings.length, 1);
  t.equal(out.findings[0].kind, 'error');
  t.equal(out.findings[0].confidence, 'high');
  t.equal(out.findings[0].concern.indexOf('Two teams') !== -1, true);
  t.ok(out.findings[0].claimSignature, 'signature computed');
  t.equal(out.overallVerdict, 'possible_issues');
  t.equal(out.inputTokens, 800);
  t.equal(out.outputTokens, 200);
  t.ok(out.model);
  t.end();
});

// --- Findings normalisation -----------------------------------------

test('normaliseFindings: exact-text match → uses biography sentence signature', function (t) {
  const bio = biography();
  const findings = review.normaliseFindings([
    {
      claim: 'Einstein was born in Ulm in 1879.',
      kind: 'error',
      confidence: 'medium',
      concern: 'test'
    }
  ], bio);
  t.equal(findings.length, 1);
  t.equal(findings[0].claimSignature, bio.sentences[0].claimSignature,
    'signature matches biography sentence 0 exactly');
  t.end();
});

test('normaliseFindings: near-match text → fuzzy signature match', function (t) {
  const bio = biography();
  const findings = review.normaliseFindings([
    {
      claim: 'Einstein was born in Ulm in 1879',
      kind: 'error',
      confidence: 'medium'
    }
  ], bio);
  t.equal(findings[0].claimSignature, bio.sentences[0].claimSignature,
    'fuzzy match hit biography sentence 0 (trailing period stripped)');
  t.end();
});

test('normaliseFindings: quote completely unrelated to bio → uses signature of quote text', function (t) {
  const bio = biography();
  const findings = review.normaliseFindings([
    {
      claim: 'Some completely unrelated claim about Charles Darwin.',
      kind: 'error',
      confidence: 'medium'
    }
  ], bio);
  t.equal(findings.length, 1);
  t.ok(findings[0].claimSignature, 'signature computed from raw quote');
  t.notEqual(findings[0].claimSignature, bio.sentences[0].claimSignature);
  t.end();
});

test('normaliseFindings: unknown kind → error; unknown confidence → low', function (t) {
  const findings = review.normaliseFindings([
    {
      claim: 'A claim.',
      kind: 'bogus',
      confidence: 'super-high',
      concern: 'test'
    }
  ], biography());
  t.equal(findings[0].kind, 'error');
  t.equal(findings[0].confidence, 'low');
  t.end();
});

test('normaliseFindings: empty claim / missing claim → dropped', function (t) {
  const findings = review.normaliseFindings([
    { claim: '', kind: 'error' },
    { kind: 'error' },
    { claim: 'Valid.', kind: 'error', confidence: 'medium' }
  ], biography());
  t.equal(findings.length, 1, 'only valid finding kept');
  t.end();
});

test('normaliseFindings: reasoning field aliased to concern for backward compat', function (t) {
  const findings = review.normaliseFindings([
    { claim: 'A claim.', kind: 'error', reasoning: 'concern via reasoning field' }
  ], biography());
  t.equal(findings[0].concern, 'concern via reasoning field');
  t.end();
});

// --- Missing API key / empty biography ------------------------------

test('review: no apiKey + no client → returns null', async function (t) {
  const out = await review(biography(), {});
  t.equal(out, null);
  t.end();
});

test('review: empty biography sentences → returns empty result (no LLM call)', async function (t) {
  const fake = makeFakeClient(JSON.stringify({ factualIssues: [] }));
  const out = await review({ sentences: [] }, { apiKey: 'sk-test', client: fake.client });
  t.equal(out.findings.length, 0);
  t.equal(fake.calls.length, 0, 'Anthropic not called for empty biography');
  t.end();
});

// --- Anthropic call fails -------------------------------------------

test('review: Anthropic call throws → returns null', async function (t) {
  const client = {
    messages: {
      create: function () { return Promise.reject(new Error('timeout')); }
    }
  };
  const out = await review(biography(), { apiKey: 'sk-test', client });
  t.equal(out, null);
  t.end();
});

test('review: unparseable response → returns null', async function (t) {
  const fake = makeFakeClient('this is not JSON');
  const out = await review(biography(), { apiKey: 'sk-test', client: fake.client });
  t.equal(out, null);
  t.end();
});

// --- Anti-patterns injection ----------------------------------------

test('review: anti-patterns appended to system prompt', async function (t) {
  const fake = makeFakeClient(JSON.stringify({ factualIssues: [] }));
  await review(biography(), { apiKey: 'sk-test', client: fake.client });
  const call = fake.calls[0];
  t.ok(call.system.indexOf('Class-wide rules') !== -1);
  t.end();
});

// --- Sentence numbering visible to reviewer -------------------------

test('review: user prompt shows sentences numbered [S1], [S2], …', async function (t) {
  const fake = makeFakeClient(JSON.stringify({ factualIssues: [] }));
  await review(biography(), { apiKey: 'sk-test', client: fake.client });
  const userText = fake.calls[0].messages[0].content;
  t.ok(userText.indexOf('[S1]') !== -1, 'S1 present');
  t.ok(userText.indexOf('[S2]') !== -1, 'S2 present');
  t.ok(userText.indexOf('[S3]') !== -1, 'S3 present');
  t.end();
});

// --- Writer notes surfacing -----------------------------------------

test('review: writerNotes flow into user prompt', async function (t) {
  const fake = makeFakeClient(JSON.stringify({ factualIssues: [] }));
  await review(biography(), { apiKey: 'sk-test', client: fake.client });
  const userText = fake.calls[0].messages[0].content;
  t.ok(userText.indexOf('Sample writer notes.') !== -1);
  t.end();
});

// --- personData surfacing -------------------------------------------

test('review: personData appears in user prompt when passed', async function (t) {
  const fake = makeFakeClient(JSON.stringify({ factualIssues: [] }));
  await review(biography(), {
    apiKey: 'sk-test',
    client: fake.client,
    personData: { name: 'Einstein', birthDate: '1879', deathDate: '1955' }
  });
  const userText = fake.calls[0].messages[0].content;
  t.ok(userText.indexOf('Name: Einstein') !== -1);
  t.ok(userText.indexOf('Born: 1879') !== -1);
  t.end();
});

// --- Overall verdict defaults ---------------------------------------

test('review: missing overallVerdict → defaults to possible_issues', async function (t) {
  const fake = makeFakeClient(JSON.stringify({ factualIssues: [] }));
  const out = await review(biography(), { apiKey: 'sk-test', client: fake.client });
  t.equal(out.overallVerdict, 'possible_issues');
  t.end();
});
