'use strict';

// ES candidate source — top-analytics agents where the existing catalogue
// biography is THIN and Wikidata is present. Written for the 2026-09
// public launch batch of ~500 records where the value proposition is:
// AI biographies add most where existing content is thin AND there's
// external structured data to enrich from.
//
// Query shape:
//   type: agent (i.e. @datatype.base == 'agent')
//   wikidata field exists (i.e. record links to a Wikidata Q-code)
//   optionally: enhancement.analytics.current.cumulative_views >= opts.minAnalytics
//   sorted by cumulative views desc (most-viewed first)
//
// Post-filter in Node (ES can't range-filter on string length):
//   existing biography (biography OR briefBiography.length) < opts.maxExistingChars
//
// We over-fetch by 5x the limit to give the post-filter room; if too
// few candidates survive, the runner just processes fewer. The
// over-fetch factor is empirical — will tune once we see the pass
// rate on real corpus data.
//
// Usage:
//   node scripts/bulk-generate.js --source es-thin-with-wikidata --limit 500 --max-existing-chars 500 --min-analytics 100

const TypeMapping = require('../../lib/type-mapping');

const MAX_HITS = 10000;
const OVERFETCH_FACTOR = 5;

module.exports = async function list (elastic, config, opts) {
  const limit = Number.isInteger(opts.limit) ? opts.limit : 500;
  const minAnalytics = Number.isInteger(opts.minAnalytics) ? opts.minAnalytics : 0;
  const maxExistingChars = Number.isInteger(opts.maxExistingChars) ? opts.maxExistingChars : 500;

  const size = Math.min(limit * OVERFETCH_FACTOR, MAX_HITS);

  console.log('es-thin-with-wikidata: querying', config.elasticIndex || 'ciim',
    '· type=agent · has wikidata · min analytics=' + minAnalytics +
    ' · max existing chars=' + maxExistingChars +
    ' · fetching up to ' + size + ' · target limit=' + limit);

  const must = [
    { term: { '@datatype.base': 'agent' } },
    { exists: { field: 'wikidata' } }
  ];
  if (minAnalytics > 0) {
    must.push({ range: { 'enhancement.analytics.current.cumulative_views': { gte: minAnalytics } } });
  }

  const body = {
    query: { bool: { must } },
    sort: [
      { 'enhancement.analytics.current.cumulative_views': { order: 'desc' } }
    ],
    // Need description[] to compute existing biography length in the
    // same shape extract-person-data.js reads: typed entries under
    // description[] with type='biography' / 'brief biography' /
    // primary:true. See extract-person-data.js:68-96 for the canonical
    // extraction logic — this source mirrors it.
    _source: ['@datatype', 'description', 'wikidata', 'enhancement.analytics.current.cumulative_views'],
    size
  };

  const response = await elastic.search({
    index: config.elasticIndex || 'ciim',
    body
  });

  const hits = (response.body.hits && response.body.hits.hits) || [];
  console.log('es-thin-with-wikidata: ES returned ' + hits.length + ' hits before filtering.');

  const passed = [];
  let filteredNoWikidata = 0; // Belt-and-braces (ES already filtered)
  let filteredTooLong = 0;
  let filteredNoContent = 0;

  for (const hit of hits) {
    if (passed.length >= limit) break;

    const s = hit._source || {};
    if (!s.wikidata) { filteredNoWikidata++; continue; }

    const chars = computeExistingChars(s);
    if (chars === 0) {
      // Record has no biography content AT ALL — probably a stub.
      // Do NOT include: with zero content the generation pipeline
      // likely trips the insufficient_data sufficiency gate and
      // returns admin_only anyway. Skip to save the Claude call.
      filteredNoContent++;
      continue;
    }
    if (chars >= maxExistingChars) {
      filteredTooLong++;
      continue;
    }

    try {
      const external = TypeMapping.toExternal(hit._id);
      if (external) passed.push(external);
    } catch (err) {
      console.warn('es-thin-with-wikidata: skipping unmappable id', hit._id, '-', err.message);
    }
  }

  console.log('es-thin-with-wikidata: post-filter results:');
  console.log('  passed:            ' + passed.length + ' (target ' + limit + ')');
  console.log('  filtered no wikidata: ' + filteredNoWikidata + ' (should be 0 — ES filtered)');
  console.log('  filtered no content:  ' + filteredNoContent);
  console.log('  filtered too long:    ' + filteredTooLong + ' (existing chars >= ' + maxExistingChars + ')');
  if (passed.length < limit) {
    console.warn('es-thin-with-wikidata: WARNING: only ' + passed.length + ' candidates passed vs target ' + limit +
      '. Consider raising --limit or lowering --min-analytics or raising --max-existing-chars.');
  }

  return passed;
};

// Mirrors extract-person-data.js:68-95 — surface the char count that
// the public visitor would see if no AI biography exists. Fallback
// order: biography field, brief biography field, first description
// entry (matches template getFirst behaviour for records with only
// non-typed descriptions).
function computeExistingChars (source) {
  const descArr = Array.isArray(source.description) ? source.description : [];
  let biography = '';
  let briefBiography = '';
  for (const d of descArr) {
    if (!d || !d.value) continue;
    const t = (d.type || '').toLowerCase();
    if (t === 'brief biography') {
      briefBiography = d.value;
    } else if (t === 'biography' || d.primary) {
      if (!biography) biography = d.value;
    }
  }
  if (!biography && !briefBiography && descArr[0] && descArr[0].value) {
    biography = descArr[0].value;
  }
  return (biography || briefBiography || '').length;
}
