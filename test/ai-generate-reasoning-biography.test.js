'use strict';

// Tests for the reasoning-mode writer wrapper. Focus on contract:
// return shape matches generateSourceTaggedBiography's, prompt-module
// wiring drops selfReview, streaming path used, defensive error
// paths populate diagnostics correctly.
//
// The Anthropic client is injected as a stub; no live API calls.

const test = require('tape');
const generateReasoningBiography = require('../lib/ai/generate-reasoning-biography');

// Minimal happy-path stream — fake `messages.stream()` returning an
// object with `finalMessage()` that resolves to a valid Message shape.
function makeStubClient (finalMessage, opts) {
  opts = opts || {};
  const capturedParams = [];
  return {
    _capturedParams: capturedParams,
    messages: {
      stream: function (params) {
        capturedParams.push(params);
        if (opts.shouldThrow) {
          throw opts.shouldThrow;
        }
        return {
          finalMessage: function () {
            return Promise.resolve(finalMessage);
          }
        };
      }
    }
  };
}

function validResponse (rawJson) {
  return {
    content: [
      { type: 'thinking', thinking: 'some reasoning...' },
      { type: 'text', text: rawJson }
    ],
    usage: {
      input_tokens: 1234,
      output_tokens: 456,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0
    }
  };
}

const VALID_PARSED_JSON = JSON.stringify({
  sentences: [
    { text: 'Einstein was born in 1879.', source: 'museum', sourceDetail: 'personData.birthDate', citations: [] }
  ],
  paragraphBreaks: [],
  confidence: 8,
  notes: 'Editorial reasoning trace here'
});

// --- basic happy path ------------------------------------------------

test('returns matching shape to generateSourceTaggedBiography on happy path', async function (t) {
  const client = makeStubClient(validResponse(VALID_PARSED_JSON));
  const result = await generateReasoningBiography(
    { name: 'Einstein', birthDate: '1879-03-14' },
    [],
    null,
    { client, apiKey: 'x' }
  );
  t.ok(result, 'returns a result');
  // Shape parity — every field the source-tagged writer returns
  const expectedFields = [
    'sentences', 'paragraphBreaks', 'confidence', 'notes',
    'verificationCandidates',
    'model', 'promptVersion',
    'inputTokens', 'outputTokens', 'cacheCreationTokens', 'cacheReadTokens',
    'systemPrompt', 'prompt', 'rawResponse', 'citationDrops'
  ];
  expectedFields.forEach(function (f) {
    t.ok(Object.prototype.hasOwnProperty.call(result, f), 'has field: ' + f);
  });
  // Plus reasoning-mode-specific: thinkingChars
  t.equal(typeof result.thinkingChars, 'number');
  t.end();
});

test('token usage propagates unchanged from response.usage', async function (t) {
  const client = makeStubClient(validResponse(VALID_PARSED_JSON));
  const result = await generateReasoningBiography(
    { name: 'x' }, [], null, { client, apiKey: 'x' }
  );
  t.equal(result.inputTokens, 1234);
  t.equal(result.outputTokens, 456);
  t.equal(result.cacheCreationTokens, 0);
  t.equal(result.cacheReadTokens, 0);
  t.end();
});

test('thinkingChars sums length of all thinking blocks in response', async function (t) {
  const client = makeStubClient({
    content: [
      { type: 'thinking', thinking: 'first block reasoning' },
      { type: 'thinking', thinking: 'second block more reasoning' },
      { type: 'text', text: VALID_PARSED_JSON }
    ],
    usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }
  });
  const result = await generateReasoningBiography(
    { name: 'x' }, [], null, { client, apiKey: 'x' }
  );
  const expected = 'first block reasoning'.length + 'second block more reasoning'.length;
  t.equal(result.thinkingChars, expected, 'sums across all thinking blocks');
  t.end();
});

// --- API-call shape --------------------------------------------------

test('always passes thinking config (extended thinking on)', async function (t) {
  const client = makeStubClient(validResponse(VALID_PARSED_JSON));
  await generateReasoningBiography(
    { name: 'x' }, [], null,
    { client, apiKey: 'x', budgetTokens: 4000, maxTokens: 16000 }
  );
  const params = client._capturedParams[0];
  t.deepEqual(params.thinking, { type: 'enabled', budget_tokens: 4000 });
  t.equal(params.max_tokens, 16000);
  t.end();
});

test('Haiku 5.5 gets adaptive thinking at medium effort, no budget_tokens', async function (t) {
  const client = makeStubClient(validResponse(VALID_PARSED_JSON));
  await generateReasoningBiography(
    { name: 'x' }, [], null,
    { client, apiKey: 'x', model: 'claude-haiku-5-5', budgetTokens: 4000, maxTokens: 24000 }
  );
  const params = client._capturedParams[0];
  t.deepEqual(params.thinking, { type: 'adaptive' });
  t.deepEqual(params.output_config, { effort: 'medium' });
  t.equal(params.max_tokens, 24000);
  t.end();
});

test('honours opts.effort on adaptive models', async function (t) {
  const client = makeStubClient(validResponse(VALID_PARSED_JSON));
  await generateReasoningBiography(
    { name: 'x' }, [], null,
    { client, apiKey: 'x', model: 'claude-haiku-5-5', effort: 'high' }
  );
  t.deepEqual(client._capturedParams[0].output_config, { effort: 'high' });
  t.end();
});

test('4.5-era models get budget thinking and no output_config', async function (t) {
  const client = makeStubClient(validResponse(VALID_PARSED_JSON));
  await generateReasoningBiography(
    { name: 'x' }, [], null,
    { client, apiKey: 'x', model: 'claude-haiku-4-5-20251001', effort: 'high' }
  );
  const params = client._capturedParams[0];
  t.equal(params.thinking.type, 'enabled');
  t.equal(params.output_config, undefined);
  t.end();
});

test('throws on an unknown effort for adaptive models', async function (t) {
  try {
    await generateReasoningBiography(
      { name: 'x' }, [], null,
      { apiKey: 'x', model: 'claude-haiku-5-5', effort: 'extreme' }
    );
    t.fail('should have thrown');
  } catch (err) {
    t.ok(/effort "extreme"/.test(err.message), 'names the bad value');
  }
  t.end();
});

test('budgetTokens >= maxTokens is not an error on adaptive models', async function (t) {
  const client = makeStubClient(validResponse(VALID_PARSED_JSON));
  const result = await generateReasoningBiography(
    { name: 'x' }, [], null,
    { client, apiKey: 'x', model: 'claude-haiku-5-5', budgetTokens: 16000, maxTokens: 16000 }
  );
  t.ok(result);
  t.end();
});

test('defaults to Haiku 4.5 when opts.model not specified', async function (t) {
  const client = makeStubClient(validResponse(VALID_PARSED_JSON));
  await generateReasoningBiography(
    { name: 'x' }, [], null, { client, apiKey: 'x' }
  );
  t.equal(client._capturedParams[0].model, 'claude-haiku-4-5-20251001');
  t.end();
});

test('honours opts.model override', async function (t) {
  const client = makeStubClient(validResponse(VALID_PARSED_JSON));
  await generateReasoningBiography(
    { name: 'x' }, [], null,
    { client, apiKey: 'x', model: 'claude-sonnet-4-5-20250929' }
  );
  t.equal(client._capturedParams[0].model, 'claude-sonnet-4-5-20250929');
  t.end();
});

test('honours useCache flag by wrapping system in cache_control block', async function (t) {
  const client = makeStubClient(validResponse(VALID_PARSED_JSON));
  await generateReasoningBiography(
    { name: 'x' }, [], null, { client, apiKey: 'x', useCache: true }
  );
  const params = client._capturedParams[0];
  t.ok(Array.isArray(params.system), 'system becomes array when useCache=true');
  t.equal(params.system[0].cache_control.type, 'ephemeral');
  t.end();
});

test('useCache=false leaves system as plain string', async function (t) {
  const client = makeStubClient(validResponse(VALID_PARSED_JSON));
  await generateReasoningBiography(
    { name: 'x' }, [], null, { client, apiKey: 'x', useCache: false }
  );
  t.equal(typeof client._capturedParams[0].system, 'string');
  t.end();
});

// --- error paths ----------------------------------------------------

test('returns null + populates diagnostics on API failure', async function (t) {
  const client = makeStubClient(null, { shouldThrow: new Error('rate limited') });
  const diagnostics = {};
  const result = await generateReasoningBiography(
    { name: 'x' }, [], null, { client, apiKey: 'x', diagnostics }
  );
  t.equal(result, null);
  t.equal(diagnostics.failureMode, 'api_call_failed');
  t.equal(diagnostics.apiError, 'rate limited');
  t.ok(diagnostics.systemPrompt, 'captures prompt for post-mortem');
  t.ok(diagnostics.prompt);
  t.end();
});

test('returns null + populates diagnostics on unparseable response', async function (t) {
  const client = makeStubClient(validResponse('not valid json {'));
  const diagnostics = {};
  const result = await generateReasoningBiography(
    { name: 'x' }, [], null, { client, apiKey: 'x', diagnostics }
  );
  t.equal(result, null);
  t.equal(diagnostics.failureMode, 'parse_failed');
  t.ok(diagnostics.parseError);
  t.ok(diagnostics.rawResponse);
  t.end();
});

test('returns null + failureMode=max_tokens when truncated JSON hits the cap', async function (t) {
  const truncated = validResponse(VALID_PARSED_JSON.slice(0, 60));
  truncated.stop_reason = 'max_tokens';
  const client = makeStubClient(truncated);
  const diagnostics = {};
  const result = await generateReasoningBiography(
    { name: 'x' }, [], null, { client, apiKey: 'x', diagnostics }
  );
  t.equal(result, null);
  t.equal(diagnostics.failureMode, 'max_tokens');
  t.equal(diagnostics.stopReason, 'max_tokens');
  t.ok(diagnostics.rawResponse, 'keeps the truncated text for post-mortem');
  t.end();
});

test('returns null + failureMode=refusal when the model declines', async function (t) {
  const refused = validResponse(VALID_PARSED_JSON);
  refused.stop_reason = 'refusal';
  refused.stop_details = { type: 'refusal', category: 'general_harms', explanation: '' };
  const client = makeStubClient(refused);
  const diagnostics = {};
  const result = await generateReasoningBiography(
    { name: 'x' }, [], null,
    { client, apiKey: 'x', model: 'claude-haiku-5-5', diagnostics }
  );
  t.equal(result, null, 'does not persist a declined response even if it parses');
  t.equal(diagnostics.failureMode, 'refusal');
  t.equal(diagnostics.refusalCategory, 'general_harms');
  t.end();
});

test('returns null + failureMode=no_api_key when neither client nor key supplied', async function (t) {
  const diagnostics = {};
  const result = await generateReasoningBiography(
    { name: 'x' }, [], null, { diagnostics }
  );
  t.equal(result, null);
  t.equal(diagnostics.failureMode, 'no_api_key');
  t.end();
});

// --- config validation ----------------------------------------------

test('throws if budgetTokens >= maxTokens (Anthropic constraint)', async function (t) {
  try {
    await generateReasoningBiography(
      { name: 'x' }, [], null,
      { apiKey: 'x', budgetTokens: 16000, maxTokens: 16000 }
    );
    t.fail('should have thrown');
  } catch (err) {
    t.ok(/must be strictly less than/.test(err.message), 'clear error message');
  }
  t.end();
});
