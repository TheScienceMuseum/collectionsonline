'use strict';

// Registry of Anthropic models available for AI biography generation.
//
// This is a curated list rather than a live API lookup — keeps startup fast,
// lets us annotate each model with a human label and pricing, and avoids
// exposing every experimental model in the admin UI.
//
// When Anthropic publishes a new model worth offering:
//   1. Verify it's available on your account:
//      curl https://api.anthropic.com/v1/models \
//        -H "x-api-key: $ANTHROPIC_API_KEY" \
//        -H "anthropic-version: 2023-06-01"
//   2. UPDATE the existing entry in place (one per family — Haiku/Sonnet/Opus).
//      Don't append; historical `model` IDs on old snapshots stay known to
//      the system via stored data.
//   3. (Optional) change the default in .corc / config.aiBiographyModel.
//
// Prices are per 1 MILLION tokens (USD). Source:
//   https://www.anthropic.com/pricing  — verify before relying on aggregate
//   cost figures. Anthropic does not publish a pricing API.

const MODELS = [
  {
    id: 'claude-haiku-4-5-20251001',
    label: 'Haiku 4.5',
    tier: 'fast',
    inputPerMTok: 1.00,
    outputPerMTok: 5.00,
    description: 'Fast, cheap. Suitable default.'
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Sonnet 4.6',
    tier: 'balanced',
    inputPerMTok: 3.00,
    outputPerMTok: 15.00,
    description: 'Step up for tone and nuance — ~3× cost of Haiku.'
  },
  {
    id: 'claude-opus-4-7',
    label: 'Opus 4.7',
    tier: 'premium',
    inputPerMTok: 15.00,
    outputPerMTok: 75.00,
    description: 'Top tier — reserve for edge cases.'
  }
];

function listModels () {
  return MODELS.slice();
}

function getModel (id) {
  return MODELS.find(function (m) { return m.id === id; }) || null;
}

function isKnown (id) {
  return !!getModel(id);
}

/**
 * Cost of one generation given token counts, plus an extrapolation to 1,000
 * biographies. Returns null if the model isn't in the registry (legacy
 * snapshots generated with a model that's since been removed from the list).
 *
 * Anthropic bills in USD; `inputPerMTok` / `outputPerMTok` above are USD per
 * million tokens. The optional `gbpRate` (typically `config.aiBiographyGbpPerUsd`)
 * converts the returned numeric values and formatted strings to GBP. If
 * omitted it falls back to 1.0 so the function still works standalone —
 * but callers with config should always pass the rate so admin displays
 * are in £ consistently.
 *
 * perBio    — cost for this single snapshot (in GBP when rate provided)
 * per1kBio  — cost if the same shape were produced 1,000 times
 */
function calculateCost (modelId, inputTokens, outputTokens, gbpRate) {
  const m = getModel(modelId);
  if (!m) return null;
  const input = Number(inputTokens) || 0;
  const output = Number(outputTokens) || 0;
  const rate = Number(gbpRate) || 1;
  const perBio = ((input * m.inputPerMTok + output * m.outputPerMTok) / 1000000) * rate;
  return {
    perBio,
    per1kBio: perBio * 1000,
    perBioFormatted: formatGbp(perBio),
    per1kBioFormatted: formatGbp(perBio * 1000)
  };
}

function formatGbp (value) {
  if (value == null || Number.isNaN(value)) return '—';
  if (value === 0) return '£0';
  if (value < 0.01) return '<£0.01';
  if (value < 1) return '£' + value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '.0');
  if (value < 100) return '£' + value.toFixed(2);
  return '£' + Math.round(value);
}

module.exports = { listModels, getModel, isKnown, calculateCost, formatGbp };
