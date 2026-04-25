'use strict';

const parseBriefBiographyDates = require('./parse-brief-biography-dates');

// Pre-flight data-sufficiency check.
//
// Scores source data against a fixed list of concrete signals. Records below
// the configured minimum score are marked `insufficient_data` without calling
// the LLM — this avoids cost, reduces hallucination risk (models tend to fill
// gaps from training when data is thin), and avoids confusion on ambiguous
// names where a thin record shares a name with other entities.
//
// Signals are WEIGHTED. Richer signals that contribute substantive content
// to the prompt (description text, collection relationships, related
// people/organisations, Wikidata) count double; biographical facts that are
// already shown in the sidebar (dates, place, occupation, nationality)
// count once. The threshold is a SCORE (sum of weights of present signals).

const SIGNALS = [
  {
    key: 'birthOrInception',
    label: 'Birth / inception date',
    weight: 1,
    check: function (pd) { return !!(pd && pd.birthDate); }
  },
  {
    key: 'deathOrDissolution',
    label: 'Death / dissolution date',
    weight: 1,
    check: function (pd) { return !!(pd && pd.deathDate); }
  },
  {
    key: 'place',
    label: 'Birth place / HQ location',
    weight: 1,
    check: function (pd) { return !!(pd && pd.birthPlace); }
  },
  {
    key: 'occupation',
    label: 'Occupation / industry',
    weight: 1,
    check: function (pd) { return !!(pd && pd.occupation); }
  },
  {
    key: 'nationality',
    label: 'Nationality / country',
    weight: 1,
    check: function (pd) { return !!(pd && pd.nationality); }
  },
  {
    key: 'existingDescription',
    label: 'Existing description (100+ chars)',
    weight: 2,
    check: function (pd) { return !!(pd && pd.descriptionChars >= 100); }
  },
  {
    key: 'briefBiographyDates',
    label: 'Date text in brief biography',
    weight: 1,
    // Brief biographies frequently carry "active YYYY-YYYY", "b. YYYY",
    // bare "YYYY-YYYY" or decade markers in the text. For records with no
    // structured birth/death date these are often the only date anchor.
    // Don't backfill birthDate from this — "active" != "born" — but credit
    // it as a date signal so e.g. cp52967 ("active 1817-1839") clears the
    // sufficiency floor.
    check: function (pd) {
      return !!(pd && pd.briefBiography && parseBriefBiographyDates(pd.briefBiography));
    }
  },
  {
    key: 'relatedItems',
    label: 'Related collection items',
    weight: 2,
    check: function (pd, items) { return Array.isArray(items) && items.length > 0; }
  },
  {
    key: 'relatedPeople',
    label: 'Related people / organisations',
    weight: 2,
    check: function (pd) { return !!(pd && pd.relatedPeople && pd.relatedPeople.length > 0); }
  },
  {
    key: 'wikidataId',
    label: 'Wikidata Q-code',
    weight: 2,
    check: function (pd) { return !!(pd && pd.wikidata); }
  },
  {
    key: 'wikidataClaims',
    label: 'Useful Wikidata claims',
    weight: 2,
    // Usable claims beyond just description + wikipediaUrl (which are very
    // thin on their own). Anything else present means Wikidata added factual
    // detail to the prompt.
    check: function (pd, items, wikidata) {
      if (!wikidata) return false;
      const keys = Object.keys(wikidata).filter(function (k) {
        return k !== 'description' && k !== 'wikipediaUrl';
      });
      return keys.length > 0;
    }
  }
];

const MAX_SCORE = SIGNALS.reduce(function (sum, s) { return sum + s.weight; }, 0);

function assess (personData, relatedItems, wikidataContext, minScore) {
  const min = (typeof minScore === 'number' && minScore >= 0) ? minScore : 3;
  const results = SIGNALS.map(function (sig) {
    const present = !!sig.check(personData, relatedItems, wikidataContext);
    return { key: sig.key, label: sig.label, weight: sig.weight, present };
  });
  const score = results.reduce(function (sum, r) {
    return sum + (r.present ? r.weight : 0);
  }, 0);
  const signalCount = results.filter(function (r) { return r.present; }).length;
  return {
    sufficient: score >= min,
    score,
    maxScore: MAX_SCORE,
    minScore: min,
    signalCount,
    totalSignals: SIGNALS.length,
    signals: results,
    present: results.filter(function (r) { return r.present; }).map(function (r) { return r.key; }),
    missing: results.filter(function (r) { return !r.present; }).map(function (r) { return r.key; })
  };
}

function skipReason (assessment) {
  return 'Insufficient source data: score ' + assessment.score + '/' +
    assessment.maxScore + ' (' + assessment.signalCount + '/' +
    assessment.totalSignals + ' signals), minimum score ' +
    assessment.minScore + ' required.';
}

module.exports = { assess, skipReason, SIGNALS, MAX_SCORE };
