'use strict';

// Tests for the source-tagged writer wrapper. Anthropic client stubbed
// via the `client` opt — no live API calls needed.

const test = require('tape');
const generate = require('../lib/ai/generate-source-tagged-biography');

// Build a fake Anthropic client that records the params it was called
// with and returns a canned response. Tests read `.calls` after
// awaiting the generate() call.
function makeFakeClient (rawTextResponse, usageOverride) {
  const state = { calls: [] };
  state.client = {
    messages: {
      create: function (params) {
        state.calls.push(params);
        return Promise.resolve({
          content: [{ type: 'text', text: rawTextResponse }],
          usage: usageOverride || { input_tokens: 1500, output_tokens: 500 }
        });
      }
    }
  };
  return state;
}

function personData (overrides) {
  return Object.assign({
    entityType: 'person',
    name: 'Test Subject',
    birthDate: '1879',
    occupation: 'physicist'
  }, overrides || {});
}

function validResponse () {
  return JSON.stringify({
    sentences: [
      { text: 'Subject was born in 1879.', source: 'museum', sourceDetail: 'personData.birthDate' },
      { text: 'They worked in physics.', source: 'wikidata', sourceDetail: 'wikidata:P106' }
    ],
    paragraphBreaks: [1],
    confidence: 7,
    notes: 'Solid data available.'
  });
}

// --- Happy path ------------------------------------------------------

test('generate: valid response → normalised payload with metadata', async function (t) {
  const fake = makeFakeClient(validResponse());
  const out = await generate(personData(), [], {}, {
    apiKey: 'sk-test',
    client: fake.client
  });
  t.ok(out, 'returned a payload');
  t.equal(out.sentences.length, 2);
  t.equal(out.confidence, 7);
  t.equal(out.notes, 'Solid data available.');
  t.equal(out.inputTokens, 1500);
  t.equal(out.outputTokens, 500);
  t.ok(out.promptVersion, 'promptVersion recorded');
  t.ok(out.model, 'model recorded');
  t.deepEqual(out.verificationCandidates, {
    generalKnowledgeCount: 0,
    contextualisingCount: 0,
    inferredCount: 0
  });
  t.end();
});

// --- Missing API key -------------------------------------------------

test('generate: no apiKey and no client → returns null (does not throw)', async function (t) {
  const out = await generate(personData(), [], {}, {});
  t.equal(out, null);
  t.end();
});

// --- Anthropic call fails --------------------------------------------

test('generate: Anthropic call throws → returns null (does not throw)', async function (t) {
  const client = {
    messages: {
      create: function () { return Promise.reject(new Error('rate limited')); }
    }
  };
  const out = await generate(personData(), [], {}, { apiKey: 'sk-test', client });
  t.equal(out, null);
  t.end();
});

// --- Malformed response ----------------------------------------------

test('generate: response can\'t be parsed → returns null', async function (t) {
  const fake = makeFakeClient('not JSON at all');
  const out = await generate(personData(), [], {}, { apiKey: 'sk-test', client: fake.client });
  t.equal(out, null);
  t.end();
});

// --- Anti-patterns injection ----------------------------------------

test('generate: anti-patterns block appended to system prompt', async function (t) {
  const fake = makeFakeClient(validResponse());
  await generate(personData(), [], {}, { apiKey: 'sk-test', client: fake.client });
  const call = fake.calls[0];
  t.ok(call, 'call captured');
  t.ok(call.system.indexOf('Class-wide rules') !== -1,
    'anti-patterns header included in system prompt');
  t.end();
});

// --- Curator constraints injection -----------------------------------

test('generate: rejections + clarifications injected as subject-specific constraints', async function (t) {
  const fake = makeFakeClient(validResponse());
  const decisions = {
    rejections: [
      { claimSignature: 'sig1', claimText: 'The wrong Eddington-Sobral claim.', rationale: 'attribution error' }
    ],
    clarifications: [
      { claimSignature: 'sig2', claimText: 'Fellow of the Royal Society.', clarification: 'use ForMemRS not FRS' }
    ]
  };
  await generate(personData(), [], {}, {
    apiKey: 'sk-test',
    client: fake.client,
    curatorDecisions: decisions
  });
  const call = fake.calls[0];
  t.ok(call.system.indexOf('Curator-specific constraints') !== -1,
    'constraint block header present');
  t.ok(call.system.indexOf('The wrong Eddington-Sobral claim.') !== -1,
    'rejection text injected');
  t.ok(call.system.indexOf('attribution error') !== -1, 'rejection rationale injected');
  t.ok(call.system.indexOf('use ForMemRS not FRS') !== -1, 'clarification injected');
  t.end();
});

test('generate: empty rejections + clarifications → no constraint block appended', async function (t) {
  const fake = makeFakeClient(validResponse());
  await generate(personData(), [], {}, {
    apiKey: 'sk-test',
    client: fake.client,
    curatorDecisions: { approvals: [{ claimSignature: 'sig1' }] }
  });
  const call = fake.calls[0];
  t.ok(call.system.indexOf('Curator-specific constraints') === -1,
    'no constraint block when no rejections/clarifications');
  t.end();
});

test('generate: null curatorDecisions handled (fresh subject)', async function (t) {
  const fake = makeFakeClient(validResponse());
  const out = await generate(personData(), [], {}, {
    apiKey: 'sk-test',
    client: fake.client,
    curatorDecisions: null
  });
  t.ok(out, 'no crash with null decisions');
  t.end();
});

// --- appendCuratorConstraints (unit test the helper) -----------------

test('appendCuratorConstraints: returns base unchanged when no constraints', function (t) {
  t.equal(generate.appendCuratorConstraints('BASE', null), 'BASE');
  t.equal(generate.appendCuratorConstraints('BASE', {}), 'BASE');
  t.equal(generate.appendCuratorConstraints('BASE', { approvals: [] }), 'BASE');
  t.equal(generate.appendCuratorConstraints('BASE', { rejections: [], clarifications: [] }), 'BASE');
  t.end();
});

test('appendCuratorConstraints: rejections without claimText are filtered out', function (t) {
  const out = generate.appendCuratorConstraints('BASE', {
    rejections: [
      { claimSignature: 'a' },
      { claimSignature: 'b', claimText: 'Real rejection.' }
    ]
  });
  t.ok(out.indexOf('Real rejection.') !== -1);
  t.equal((out.match(/^- /gm) || []).length, 1, 'only one bullet emitted');
  t.end();
});

// --- Model + promptVersion metadata ---------------------------------

test('generate: opts.model overrides DEFAULT_MODEL', async function (t) {
  const fake = makeFakeClient(validResponse());
  const out = await generate(personData(), [], {}, {
    apiKey: 'sk-test',
    client: fake.client,
    model: 'custom-model-x'
  });
  t.equal(out.model, 'custom-model-x');
  t.end();
});

test('generate: passes model into Anthropic call', async function (t) {
  const fake = makeFakeClient(validResponse());
  await generate(personData(), [], {}, {
    apiKey: 'sk-test',
    client: fake.client,
    model: 'custom-model-x'
  });
  t.equal(fake.calls[0].model, 'custom-model-x');
  t.end();
});
