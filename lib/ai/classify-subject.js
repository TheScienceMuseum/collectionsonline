'use strict';

/**
 * Decide the subject noun for the AI biography prompt.
 *
 * Inputs:
 *   - personData.entityType : 'person' | 'organisation' (from internal data)
 *   - wikidataContext       : optional — keys populated by fetchWikidataLive
 *
 * Output: { noun, pronoun, possessive }
 *   noun       — 'person' | 'company' | 'organisation'
 *   pronoun    — 'they'   | 'it'      | 'it'
 *   possessive — 'their'  | 'its'     | 'its'
 *
 * Why: /people pages cover people, companies, and organisations. The
 * prompt should address each correctly ("this company was founded…" vs
 * "this person was born…"). Internal data only distinguishes person vs
 * organisation; Wikidata can refine organisation → company when signals
 * like `industry` or `product or material produced` are present.
 */

function classifySubject (personData, wikidataContext) {
  if (!personData || personData.entityType === 'person') {
    return { noun: 'person', pronoun: 'they', possessive: 'their' };
  }

  // Organisation — see if Wikidata gives us company-shaped signals.
  if (wikidataContext) {
    const hasIndustry = !!(wikidataContext.industry && wikidataContext.industry.value);
    const hasProducts = !!(wikidataContext['product or material produced'] &&
      wikidataContext['product or material produced'].value);
    const hasCEO = !!(wikidataContext['chief executive officer'] &&
      wikidataContext['chief executive officer'].value);

    if (hasIndustry || hasProducts || hasCEO) {
      return { noun: 'company', pronoun: 'it', possessive: 'its' };
    }
  }

  return { noun: 'organisation', pronoun: 'it', possessive: 'its' };
}

module.exports = classifySubject;
