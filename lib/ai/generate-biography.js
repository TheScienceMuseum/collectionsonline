'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const prompts = require('./prompts/biography');
const validateReferences = require('./validate-references');

const MODEL = 'claude-sonnet-4-20250514';

function generateBiography (personData, relatedItems, wikidataCache, apiKey) {
  if (!apiKey) {
    console.error('AI Biography: No Anthropic API key configured');
    return Promise.resolve(null);
  }

  const allItems = relatedItems || [];
  const userPrompt = prompts.buildUserPrompt(personData, allItems, wikidataCache);

  const client = new Anthropic({ apiKey });

  return client.messages.create({
    model: MODEL,
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

    const validatedBiography = validateReferences(parsed.biography, allItems);
    const validatedContext = validateReferences(parsed.context || '', allItems);

    const validIds = {};
    allItems.forEach(function (item) { validIds[item.id] = true; });
    const references = (parsed.referencedItems || parsed.referencedObjects || [])
      .filter(function (ref) { return validIds[ref.id]; });

    const usage = response.usage || {};

    return {
      biographyHtml: validatedBiography,
      contextHtml: validatedContext,
      references,
      confidence: parsed.confidence || 'medium',
      sourcesSummary: parsed.sourcesSummary || '',
      sources: wikidataCache ? ['collection', 'wikidata'] : ['collection'],
      model: MODEL,
      promptVersion: prompts.version,
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      prompt: userPrompt,
      systemPrompt: prompts.version,
      generatedAt: new Date().toISOString()
    };
  }).catch(function (err) {
    console.error('AI Biography: Generation failed:', err.message);
    return null;
  });
}

module.exports = generateBiography;
