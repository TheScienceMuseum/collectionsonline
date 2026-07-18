'use strict';

// Read-only inspector for the 10 holdout subjects. Reads the persisted
// BIOGRAPHY items for each and prints a full report. Used to inspect
// the results of scripts/holdout-report.js without re-running the
// regen.

const config = require('../config');
const dynamo = require('../lib/ai/dynamo');
const biographyStore = require('../lib/ai/biography-store');

const HOLDOUT_SUBJECTS = [
  { id: 'cp37054', label: 'Einstein', cohort: 'carry-over' },
  { id: 'cp125074', label: 'Lipton', cohort: 'carry-over' },
  { id: 'cp69752', label: 'Machaon', cohort: 'carry-over' },
  { id: 'cp42536', label: 'Unilever', cohort: 'carry-over' },
  { id: 'cp102300', label: 'James Smith', cohort: 'carry-over' },
  { id: 'cp6644', label: 'Great Northern Railway', cohort: 'carry-over' },
  { id: 'cp37187', label: 'Marie Curie', cohort: 'fresh' },
  { id: 'cp43169', label: 'Robert Hooke', cohort: 'fresh' },
  { id: 'cp75420', label: 'Robert Koch', cohort: 'fresh' },
  { id: 'cp127921', label: 'Paillard-Bolex', cohort: 'fresh' }
];

function tallySources (sentences) {
  const dist = {};
  (sentences || []).forEach(function (s) {
    if (!s || !s.source) return;
    dist[s.source] = (dist[s.source] || 0) + 1;
  });
  return dist;
}

function padRight (s, n) {
  s = String(s || '');
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

async function main () {
  dynamo.init(config);

  const results = [];
  for (let i = 0; i < HOLDOUT_SUBJECTS.length; i += 1) {
    const s = HOLDOUT_SUBJECTS[i];
    const rec = await biographyStore.fetchBiography(s.id);
    if (!rec) {
      results.push({ id: s.id, label: s.label, cohort: s.cohort, missing: true });
      continue;
    }
    results.push({
      id: s.id,
      label: s.label,
      cohort: s.cohort,
      status: rec.status,
      confidence: rec.writerConfidence,
      sentenceCount: (rec.sentences || []).length,
      sourceDist: tallySources(rec.sentences),
      contradictions: rec.contradictions || [],
      skipped: (rec.selfReview && rec.selfReview.skipped) || [],
      inputTokens: rec.inputTokens,
      outputTokens: rec.outputTokens
    });
  }

  const rule = '-'.repeat(130);
  console.log(rule);
  console.log('HOLDOUT REPORT — 10 subjects, all layers active (steps 1-7)');
  console.log(rule);
  console.log([
    padRight('id', 11),
    padRight('label', 24),
    padRight('cohort', 11),
    padRight('sent', 5),
    padRight('conf', 5),
    padRight('in', 6),
    padRight('out', 5),
    padRight('contr', 6),
    padRight('skip', 5),
    padRight('sources', 46)
  ].join(' '));
  console.log(rule);

  results.forEach(function (r) {
    if (r.missing) {
      console.log(padRight(r.id, 11) + ' ' + padRight(r.label, 24) + ' MISSING');
      return;
    }
    const sources = Object.keys(r.sourceDist).sort().map(function (k) {
      const short = k
        .replace('museum', 'M')
        .replace('wikidata', 'Wd')
        .replace('wikipedia', 'W')
        .replace('gracesGuide', 'G')
        .replace('oxfordDNB', 'O')
        .replace('llm:inferred', 'i')
        .replace('llm:contextualising', 'c')
        .replace('llm:general_knowledge', 'gk');
      return short + ':' + r.sourceDist[k];
    }).join(',');
    console.log([
      padRight(r.id, 11),
      padRight(r.label, 24),
      padRight(r.cohort, 11),
      padRight(String(r.sentenceCount), 5),
      padRight(String(r.confidence != null ? r.confidence : ''), 5),
      padRight(String(r.inputTokens || 0), 6),
      padRight(String(r.outputTokens || 0), 5),
      padRight(String(r.contradictions.length), 6),
      padRight(String(r.skipped.length), 5),
      padRight(sources, 46)
    ].join(' '));
  });
  console.log(rule);

  console.log('');
  console.log('DETAIL — contradictions detected:');
  results.forEach(function (r) {
    if (!r.contradictions || !r.contradictions.length) return;
    console.log('  [' + r.id + ' ' + r.label + ']');
    r.contradictions.forEach(function (c) {
      console.log('    · ' + c.factLabel + ' — winner: ' + c.winner + ' (' + c.winnerValue + ')');
      const others = (c.values || []).filter(function (v) { return v.source !== c.winner; });
      others.forEach(function (v) {
        console.log('        ' + v.source + ' says: ' + v.value);
      });
    });
  });

  console.log('');
  console.log('DETAIL — skipped claims (writer wanted to say but couldn\'t source):');
  results.forEach(function (r) {
    if (!r.skipped || !r.skipped.length) return;
    console.log('  [' + r.id + ' ' + r.label + '] ' + r.skipped.length + ' skipped');
    r.skipped.forEach(function (s) {
      console.log('    · [' + s.reason + '] "' + (s.desiredText || '').slice(0, 120) + '"');
    });
  });

  process.exit(0);
}

main().catch(function (err) {
  console.error('holdout-inspect: fatal:', err && err.stack);
  process.exit(1);
});
