'use strict';

// Holdout-report — regenerates biographies for a fixed subject list and
// prints a compact impact report. Used to demonstrate the cumulative
// effect of the Track 1 + 1b hallucination-reduction work on a set of
// subjects mixing "known problem cases we designed the rules against"
// with "fresh subjects the rules haven't been tuned on".
//
// Serial (not concurrent) — the report cares about per-subject detail
// more than throughput, and Anthropic's 5-minute prompt cache TTL
// benefits from the sequential replay of the same system prompt.
//
// Writes:
//   holdout-report-<batch-id>.jsonl — one line per subject with all
//     numeric measurements. Kept alongside the bulk-regen logs.
//   stdout — human-readable summary table.
//
// Requires DynamoDB Local reachable (persisted BIOGRAPHY items are the
// source of truth for contradictions / selfReview.skipped counts).

const path = require('path');
const fs = require('fs');
const { Client } = require('@elastic/elasticsearch');
const config = require('../config');
const dynamo = require('../lib/ai/dynamo');
const biographyStore = require('../lib/ai/biography-store');
const regenerateBiography = require('../lib/ai/regenerate-biography');

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

function batchId () {
  return 'holdout-' + new Date().toISOString().replace(/[:.]/g, '-');
}

function tallySources (sentences) {
  const dist = {};
  (sentences || []).forEach(function (s) {
    if (!s || !s.source) return;
    dist[s.source] = (dist[s.source] || 0) + 1;
  });
  return dist;
}

async function processSubject (elastic, subject, logPath) {
  const startedAt = Date.now();
  const line = { id: subject.id, label: subject.label, cohort: subject.cohort };

  try {
    const summary = await regenerateBiography(elastic, config, subject.id, {});
    const elapsedMs = Date.now() - startedAt;
    line.status = summary.status;
    line.confidence = summary.writer && summary.writer.confidence;
    line.inputTokens = summary.writer && summary.writer.inputTokens;
    line.outputTokens = summary.writer && summary.writer.outputTokens;
    line.elapsedMs = elapsedMs;

    const rec = await biographyStore.fetchBiography(subject.id);
    if (rec) {
      line.sentenceCount = (rec.sentences || []).length;
      line.sourceDist = tallySources(rec.sentences);
      line.contradictions = (rec.contradictions || []).map(function (c) {
        return { factKey: c.factKey, winner: c.winner };
      });
      line.contradictionCount = (rec.contradictions || []).length;
      line.skippedCount = ((rec.selfReview && rec.selfReview.skipped) || []).length;
      line.hasWikipedia = (rec.sentences || []).some(function (s) { return s.source === 'wikipedia'; });
      line.hasGracesGuide = (rec.sentences || []).some(function (s) { return s.source === 'gracesGuide'; });
      line.hasOdnb = (rec.sentences || []).some(function (s) { return s.source === 'oxfordDNB'; });
    }

    line.ok = true;
  } catch (err) {
    line.ok = false;
    line.error = err && err.message;
    console.error('holdout: ' + subject.id + ' FAILED:', err && err.message);
  }

  fs.appendFileSync(logPath, JSON.stringify(line) + '\n');
  return line;
}

function printSummary (results) {
  const rule = '-'.repeat(120);
  console.log('');
  console.log(rule);
  console.log('HOLDOUT REPORT');
  console.log(rule);
  console.log([
    padRight('id', 12),
    padRight('label', 22),
    padRight('cohort', 12),
    padRight('sent', 5),
    padRight('conf', 5),
    padRight('in', 6),
    padRight('out', 6),
    padRight('sec', 5),
    padRight('contra', 7),
    padRight('skip', 5),
    padRight('sources', 30)
  ].join(' '));
  console.log(rule);
  results.forEach(function (r) {
    const sources = [
      (r.sourceDist || {}).museum ? 'M:' + r.sourceDist.museum : '',
      (r.sourceDist || {}).wikidata ? 'Wd:' + r.sourceDist.wikidata : '',
      (r.sourceDist || {}).wikipedia ? 'W:' + r.sourceDist.wikipedia : '',
      (r.sourceDist || {}).gracesGuide ? 'G:' + r.sourceDist.gracesGuide : '',
      (r.sourceDist || {}).oxfordDNB ? 'O:' + r.sourceDist.oxfordDNB : '',
      (r.sourceDist || {})['llm:inferred'] ? 'i:' + r.sourceDist['llm:inferred'] : '',
      (r.sourceDist || {})['llm:contextualising'] ? 'c:' + r.sourceDist['llm:contextualising'] : ''
    ].filter(Boolean).join(',');
    console.log([
      padRight(r.id, 12),
      padRight(r.label || '', 22),
      padRight(r.cohort || '', 12),
      padRight(String(r.sentenceCount || 0), 5),
      padRight(String(r.confidence != null ? r.confidence : ''), 5),
      padRight(String(r.inputTokens || 0), 6),
      padRight(String(r.outputTokens || 0), 6),
      padRight(String(Math.round((r.elapsedMs || 0) / 1000)), 5),
      padRight(String(r.contradictionCount || 0), 7),
      padRight(String(r.skippedCount || 0), 5),
      padRight(sources, 30)
    ].join(' '));
  });
  console.log(rule);
  const totals = results.reduce(function (acc, r) {
    acc.in += r.inputTokens || 0;
    acc.out += r.outputTokens || 0;
    acc.elapsed += r.elapsedMs || 0;
    acc.contra += r.contradictionCount || 0;
    acc.skip += r.skippedCount || 0;
    return acc;
  }, { in: 0, out: 0, elapsed: 0, contra: 0, skip: 0 });
  console.log('TOTALS: in=' + totals.in + ' out=' + totals.out +
    ' wall=' + Math.round(totals.elapsed / 1000) + 's' +
    ' contradictions=' + totals.contra + ' skipped-claims=' + totals.skip);
  console.log(rule);
}

function padRight (s, n) {
  s = String(s || '');
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

async function main () {
  const elastic = new Client(config.elasticsearch);
  dynamo.init(config);

  const id = batchId();
  const logPath = path.resolve(process.cwd(), 'holdout-report-' + id + '.jsonl');
  console.log('holdout: batch-id=' + id);
  console.log('holdout: log=' + logPath);
  console.log('holdout: subjects=' + HOLDOUT_SUBJECTS.length + ' (' +
    HOLDOUT_SUBJECTS.filter(function (s) { return s.cohort === 'carry-over'; }).length + ' carry-over + ' +
    HOLDOUT_SUBJECTS.filter(function (s) { return s.cohort === 'fresh'; }).length + ' fresh)');

  const results = [];
  for (let i = 0; i < HOLDOUT_SUBJECTS.length; i += 1) {
    const s = HOLDOUT_SUBJECTS[i];
    console.log('[' + (i + 1) + '/' + HOLDOUT_SUBJECTS.length + '] ' + s.id + ' (' + s.label + ')...');
    const r = await processSubject(elastic, s, logPath);
    results.push(r);
    console.log('  → ' + (r.ok ? 'ok' : 'ERROR') +
      (r.confidence != null ? ', conf=' + r.confidence : '') +
      (r.sentenceCount != null ? ', ' + r.sentenceCount + ' sentences' : '') +
      (r.contradictionCount != null ? ', ' + r.contradictionCount + ' contra' : '') +
      (r.skippedCount != null ? ', ' + r.skippedCount + ' skipped' : '')
    );
  }

  printSummary(results);
  process.exit(0);
}

main().catch(function (err) {
  console.error('holdout: fatal:', err && err.stack);
  process.exit(1);
});
