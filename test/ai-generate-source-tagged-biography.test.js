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

// --- opts.diagnostics -------------------------------------------------

test('diagnostics: no_api_key when key + client both missing', async function (t) {
  const diagnostics = {};
  const out = await generate(personData(), [], {}, { diagnostics });
  t.equal(out, null);
  t.equal(diagnostics.failureMode, 'no_api_key');
  t.end();
});

test('diagnostics: api_call_failed when Anthropic client throws', async function (t) {
  const diagnostics = {};
  const client = {
    messages: {
      create: function () { return Promise.reject(new Error('overloaded_error')); }
    }
  };
  const out = await generate(personData(), [], {}, { apiKey: 'sk-test', client, diagnostics });
  t.equal(out, null);
  t.equal(diagnostics.failureMode, 'api_call_failed');
  t.equal(diagnostics.apiError, 'overloaded_error');
  t.ok(diagnostics.model, 'model captured');
  t.ok(diagnostics.promptVersion, 'promptVersion captured');
  t.ok(diagnostics.systemPrompt, 'systemPrompt captured');
  t.ok(diagnostics.prompt, 'user prompt captured');
  t.end();
});

test('diagnostics: parse_failed on malformed JSON response', async function (t) {
  const diagnostics = {};
  const fake = makeFakeClient('this is not JSON at all');
  const out = await generate(personData(), [], {}, {
    apiKey: 'sk-test', client: fake.client, diagnostics
  });
  t.equal(out, null);
  t.equal(diagnostics.failureMode, 'parse_failed');
  t.ok(diagnostics.parseError, 'parseError string set');
  t.equal(diagnostics.rawResponse, 'this is not JSON at all');
  t.ok(diagnostics.model);
  t.ok(diagnostics.promptVersion);
  t.end();
});

test('diagnostics: empty_response when Claude returned nothing', async function (t) {
  const diagnostics = {};
  const fake = makeFakeClient('');
  const out = await generate(personData(), [], {}, {
    apiKey: 'sk-test', client: fake.client, diagnostics
  });
  t.equal(out, null);
  t.equal(diagnostics.failureMode, 'empty_response');
  t.equal(diagnostics.rawResponse, '');
  t.end();
});

test('diagnostics: not populated on success', async function (t) {
  const diagnostics = {};
  const fake = makeFakeClient(validResponse());
  const out = await generate(personData(), [], {}, {
    apiKey: 'sk-test', client: fake.client, diagnostics
  });
  t.ok(out, 'success payload returned');
  t.notOk(diagnostics.failureMode, 'diagnostics untouched on success');
  t.end();
});

test('diagnostics: omitting diagnostics arg does not throw on failure', async function (t) {
  // Backwards-compat guard: existing callers not passing opts.diagnostics
  // must still work — the populateDiagnostics helper is a no-op when the
  // out-param is undefined.
  const fake = makeFakeClient('not JSON');
  const out = await generate(personData(), [], {}, {
    apiKey: 'sk-test', client: fake.client
    // no diagnostics
  });
  t.equal(out, null, 'still returns null');
  t.pass('no throw');
  t.end();
});

// --- Prompt caching (opt-in) -----------------------------------------

test('caching: default (no useCache) → system sent as plain string', async function (t) {
  const fake = makeFakeClient(validResponse());
  await generate(personData(), [], {}, { apiKey: 'sk-test', client: fake.client });
  t.equal(typeof fake.calls[0].system, 'string',
    'system is a plain string when useCache is not set');
  t.end();
});

test('caching: useCache:true → system sent as ephemeral cache block', async function (t) {
  const fake = makeFakeClient(validResponse());
  await generate(personData(), [], {}, {
    apiKey: 'sk-test', client: fake.client, useCache: true
  });
  const system = fake.calls[0].system;
  t.ok(Array.isArray(system), 'system is an array of content blocks');
  t.equal(system.length, 1);
  t.equal(system[0].type, 'text');
  t.deepEqual(system[0].cache_control, { type: 'ephemeral' },
    'cache_control marks the block as ephemeral');
  t.ok(system[0].text.indexOf('Class-wide rules') !== -1,
    'system text still carries the full assembled prompt');
  t.end();
});

test('caching: cache token counts surface on the returned payload', async function (t) {
  const fake = makeFakeClient(validResponse(), {
    input_tokens: 300,
    output_tokens: 500,
    cache_creation_input_tokens: 1200,
    cache_read_input_tokens: 0
  });
  const out = await generate(personData(), [], {}, {
    apiKey: 'sk-test', client: fake.client, useCache: true
  });
  t.equal(out.cacheCreationTokens, 1200, 'cache write tokens surface');
  t.equal(out.cacheReadTokens, 0, 'cache read tokens surface');
  t.end();
});

test('caching: absent usage cache fields default to 0', async function (t) {
  const fake = makeFakeClient(validResponse()); // usage lacks cache_* fields
  const out = await generate(personData(), [], {}, {
    apiKey: 'sk-test', client: fake.client
  });
  t.equal(out.cacheCreationTokens, 0);
  t.equal(out.cacheReadTokens, 0);
  t.end();
});
