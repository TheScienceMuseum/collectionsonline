'use strict';

// One-sentence plain-English tooltip for a sentence's source pill.
// Same wording pattern the Claims-panel legend uses, so a curator
// sees consistent copy whether they read the legend once or hover
// a pill on every sentence. Ends with "See Citations below…" on
// sources whose specifics are surfaced in the per-sentence Citations
// block — that's how a curator learns which excerpt / property /
// object contributed the fact.
//
// Falls through to the raw source string for unknown / future tags
// so we never render an empty tooltip.

const DESCRIPTIONS = {
  museum: 'Museum — catalogue metadata, related-object descriptions, existing biography, or structured fields. See Citations below for the exact excerpts and objects this sentence drew from.',
  oxfordDNB: 'Oxford DNB — peer-reviewed biographical scholarship (Tier A authority). See Citations below for the quoted excerpt.',
  wikidata: 'Wikidata — structured facts from the linked Wikidata entity. See Citations below for the specific properties.',
  gracesGuide: 'Grace’s Guide — UK industrial-history wiki (engineers, engineering firms, railways, manufacturers). See Citations below for the article excerpt.',
  wikipedia: 'Wikipedia — subject article intro (community-edited). See Citations below for the excerpt.',
  'llm:inferred': 'LLM inferred — writer synthesised this from the museum / Wikidata inputs. Traceable to those inputs, not a direct quote.',
  'llm:contextualising': 'LLM background — general era or domain colour without a specific claim about the subject. Publishes from Level 3.',
  'llm:general_knowledge': 'LLM training data — the writer’s own knowledge, not verifiable from the catalogue. Hidden by default.'
};

module.exports = function (source) {
  if (typeof source !== 'string') return '';
  if (DESCRIPTIONS[source]) return DESCRIPTIONS[source];
  if (source.indexOf('llm:validated:') === 0) {
    const tool = source.slice('llm:validated:'.length);
    return 'LLM validated — the writer’s claim was checked against an external source (' + tool + ') and confirmed. Publishes from Level 4.';
  }
  return source;
};
