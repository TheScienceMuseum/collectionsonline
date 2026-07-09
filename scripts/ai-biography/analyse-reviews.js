'use strict';

/*
 * Read-only analysis of REVIEW# items in the AI biographies table.
 *
 * Pulls every REVIEW# item, unpacks its findings[], and reports:
 *   1. Total findings + spread by kind (error vs info) + confidence tier.
 *   2. Findings-per-record distribution — mean, median, per-subject counts.
 *   3. Prompt-version + reviewer-model breakdown (so we know which findings
 *      came from which iteration of the pipeline).
 *   4. Resolution status spread — how many pending / accepted / dismissed
 *      / clarified across the pool.
 *   5. A short sample of concern phrases per kind × confidence bucket to
 *      eyeball whether patterns are present.
 *
 * No writes. Standalone; safe to re-run.
 *
 * Usage: node scripts/ai-biography/analyse-reviews.js
 */

const config = require('../../config');
const dynamo = require('../../lib/ai/dynamo');

function bucket (kind, confidence) {
  return (kind || '?') + '·' + (confidence || '?');
}

async function main () {
  dynamo.init(config);
  if (!dynamo.isReady()) {
    console.error('DynamoDB client not ready — check config.dynamodb');
    process.exit(1);
  }

  console.log('Endpoint:', config.dynamodb.endpoint || '(default AWS)');
  console.log('Table:   ', config.dynamodb.tableName);
  console.log();

  const reviews = [];
  let lastKey = null;
  do {
    const page = await dynamo.scan(500, lastKey);
    page.items.forEach(function (item) {
      if (item.entityType === 'REVIEW' || (item.SK || '').indexOf('REVIEW#') === 0) {
        reviews.push(item);
      }
    });
    lastKey = page.lastKey;
  } while (lastKey);

  console.log('REVIEW# items found:', reviews.length);
  const uniqueSubjects = new Set(reviews.map(function (r) { return r.PK; }));
  console.log('Unique subjects:    ', uniqueSubjects.size);
  console.log();

  // Findings
  let totalFindings = 0;
  const perBucket = {};
  const perSubject = {};
  const perResolution = {};
  const perReviewerModel = {};
  const perWriterPromptVersion = {};
  const perWriterModel = {};
  const conceptTallies = { museum: 0, wikidata: 0 };
  const samples = {};

  reviews.forEach(function (r) {
    const findings = Array.isArray(r.findings) ? r.findings : [];
    perSubject[r.PK] = (perSubject[r.PK] || 0) + findings.length;
    perReviewerModel[r.reviewerModel || '(unknown)'] = (perReviewerModel[r.reviewerModel || '(unknown)'] || 0) + findings.length;
    perWriterPromptVersion[r.writerPromptVersion || '(unknown)'] = (perWriterPromptVersion[r.writerPromptVersion || '(unknown)'] || 0) + findings.length;
    perWriterModel[r.writerModel || '(unknown)'] = (perWriterModel[r.writerModel || '(unknown)'] || 0) + findings.length;
    findings.forEach(function (f) {
      totalFindings += 1;
      const b = bucket(f.kind, f.confidence);
      perBucket[b] = (perBucket[b] || 0) + 1;
      perResolution[f.resolution || 'pending'] = (perResolution[f.resolution || 'pending'] || 0) + 1;
      if (!samples[b]) samples[b] = [];
      if (samples[b].length < 4 && f.concern) samples[b].push({ concern: f.concern, claim: f.claimText || '' });
      // Lightweight keyword tally so we can spot common patterns
      const concern = (f.concern || '').toLowerCase();
      if (concern.indexOf('museum') !== -1) conceptTallies.museum += 1;
      if (concern.indexOf('wikidata') !== -1) conceptTallies.wikidata += 1;
    });
  });

  console.log('Total findings:', totalFindings);
  console.log('Mean per subject:  ', uniqueSubjects.size ? (totalFindings / uniqueSubjects.size).toFixed(1) : '-');
  console.log('Mean per review:   ', reviews.length ? (totalFindings / reviews.length).toFixed(1) : '-');
  console.log();

  console.log('Findings by kind · confidence:');
  Object.keys(perBucket).sort().forEach(function (k) {
    console.log('  ' + k.padEnd(16) + perBucket[k]);
  });
  console.log();

  console.log('Findings per subject:');
  Object.keys(perSubject).sort().forEach(function (pk) {
    console.log('  ' + pk.padEnd(14) + perSubject[pk]);
  });
  console.log();

  console.log('Resolution status:');
  Object.keys(perResolution).sort().forEach(function (r) {
    console.log('  ' + r.padEnd(14) + perResolution[r]);
  });
  console.log();

  console.log('Reviewer model:');
  Object.keys(perReviewerModel).sort().forEach(function (m) {
    console.log('  ' + m.padEnd(38) + perReviewerModel[m]);
  });
  console.log();

  console.log('Writer prompt version:');
  Object.keys(perWriterPromptVersion).sort().forEach(function (v) {
    console.log('  ' + v.padEnd(38) + perWriterPromptVersion[v]);
  });
  console.log();

  console.log('Writer model:');
  Object.keys(perWriterModel).sort().forEach(function (m) {
    console.log('  ' + m.padEnd(38) + perWriterModel[m]);
  });
  console.log();

  console.log('Keyword hits in concern text:');
  Object.keys(conceptTallies).forEach(function (c) {
    console.log('  "' + c + '"'.padEnd(14) + conceptTallies[c]);
  });
  console.log();

  console.log('Concern samples per bucket (first 4 each):');
  Object.keys(samples).sort().forEach(function (b) {
    console.log('  [' + b + ']');
    samples[b].forEach(function (s, i) {
      const claim = (s.claim || '').slice(0, 90).replace(/\s+/g, ' ');
      const concern = s.concern.slice(0, 160).replace(/\s+/g, ' ');
      console.log('    ' + (i + 1) + '. claim: ' + (claim ? '"' + claim + '…"' : '(none)'));
      console.log('       concern: ' + concern + (s.concern.length > 160 ? '…' : ''));
    });
  });
}

main().catch(function (err) {
  console.error('Analyse failed:', err);
  process.exit(1);
});
