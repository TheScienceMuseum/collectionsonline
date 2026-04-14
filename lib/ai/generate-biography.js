'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const prompts = require('./prompts/biography');
const validateReferences = require('./validate-references');
const buildSourcesSummary = require('./build-sources-summary');

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

function extractQCode (wikidata) {
  const match = (wikidata || '').match(/Q\d+$/);
  return match ? match[0] : null;
}

function generateBiography (personData, relatedItems, wikidataCache, apiKey, model) {
  if (!apiKey) {
    console.error('AI Biography: No Anthropic API key configured');
    return Promise.resolve(null);
  }

  const allItems = relatedItems || [];
  const userPrompt = prompts.buildUserPrompt(personData, allItems, wikidataCache);

  const useModel = model || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey });

  return client.messages.create({
    model: useModel,
    max_tokens: 1500,
    temperature: 0.3,
    system: prompts.systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  }).then(function (response) {
    const text = response.content && response.content[0] && response.content[0].text;
    if (!text) {
      console.error('AI Biography: Empty response from Claude API');
      return null;
    }

    const jsonStr = text.replace(/^```json?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (err) {
      console.error('AI Biography: Failed to parse response JSON:', err.message);
      return null;
    }

    if (!parsed.biography) {
      console.error('AI Biography: Response missing biography field');
      return null;
    }

    // Build combined list of all valid linkable items (objects, documents, and related people)
    const allValidItems = allItems.slice();
    if (personData.relatedPeople) {
      personData.relatedPeople.forEach(function (p) {
        allValidItems.push({ id: p.id, title: p.name, link: p.link, type: 'people' });
      });
    }

    const validatedBiography = validateReferences(parsed.biography, allValidItems);
    const validatedContext = validateReferences(parsed.context || '', allValidItems);

    const validIds = {};
    allValidItems.forEach(function (item) { validIds[item.id] = true; });
    const references = (parsed.referencedItems || parsed.referencedObjects || [])
      .filter(function (ref) { return validIds[ref.id]; });

    const usage = response.usage || {};

    return {
      biographyHtml: validatedBiography,
      contextHtml: validatedContext,
      references,
      confidence: parsed.confidence || 'medium',
      sourcesSummary: buildSourcesSummary(personData, allItems, wikidataCache, references, extractQCode(personData.wikidata)),
      sources: wikidataCache ? ['collection', 'wikidata'] : ['collection'],
      model: useModel,
      promptVersion: prompts.version,
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      prompt: userPrompt,
      systemPrompt: prompts.systemPrompt,
      generatedAt: new Date().toISOString()
    };
  }).catch(function (err) {
    console.error('AI Biography: Generation failed:', err.status || '', err.message);
    const apiError = new Error('API call failed: ' + err.message);
    apiError.isApiError = true;
    apiError.statusCode = err.status || 500;
    throw apiError;
  });
}

module.exports = generateBiography;
