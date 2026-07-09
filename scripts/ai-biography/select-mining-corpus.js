'use strict';

/*
 * Candidate selection for the 45-record anti-pattern mining corpus.
 *
 * Queries Elasticsearch (agent index) for a broad pool of person +
 * organisation records, categorises each candidate into one of the six
 * failure-class buckets we care about, samples N per bucket, and writes
 * a CSV that the bulk-generate `csv-file` source can consume.
 *
 * Six buckets:
 *   1. living-scientists          — living / recent scientists + engineers
 *   2. historical-orgs            — extinct organisations (name change, M&A history)
 *   3. artists-makers             — artists / makers with rich object catalogues
 *   4. modern-brands              — active consumer brands with heritage
 *   5. thin-historical            — thin historical craftspeople / lesser-known figures
 *   6. wildcards                  — very short bios, wikidata-heavy but no bio, edge shapes
 *
 * Each candidate lands in AT MOST ONE bucket (priority order above).
 *
 * The 6 keep-list PKs (Einstein / Unilever / Lipton / Smith / Machaon /
 * Hygeia) are always excluded so we don't waste a slot on a record we
 * already have data for.
 *
 * Usage:
 *   node scripts/ai-biography/select-mining-corpus.js
 *   node scripts/ai-biography/select-mining-corpus.js --out=path/to.csv
 *   node scripts/ai-biography/select-mining-corpus.js --pool=1200 --seed=42
 *
 * The output CSV has one ID per line with an inline `#` annotation
 * naming the bucket + a couple of source hints — so a human can
 * eyeball and hand-edit the list before it's used to spend money.
 * Blank lines between buckets group visually.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('@elastic/elasticsearch');

const config = require('../../config');
const TypeMapping = require('../../lib/type-mapping');

const KEEP_LIST = new Set(['cp37054', 'cp42536', 'cp125074', 'cp102300', 'cp69752', 'cp97864']);

const BUCKET_TARGETS = [
  { key: 'recent-scientists', label: 'Recent scientists + engineers (post-1950 or living)', target: 8 },
  { key: 'historical-orgs', label: 'Historical extinct organisations', target: 8 },
  { key: 'artists-makers', label: 'Artists / makers with rich object catalogues', target: 8 },
  { key: 'modern-brands', label: 'Modern brands / consumer products', target: 8 },
  { key: 'thin-historical', label: 'Thin historical craftspeople / lesser-known', target: 8 },
  { key: 'wildcards', label: 'Wildcards (edge shapes)', target: 5 }
];

const SCIENTIST_RE = /(scientist|engineer|physicist|chemist|biologist|mathematician|geneticist|astronomer|inventor|computer|technologist|programmer|researcher)/i;
const MAKER_RE = /(artist|painter|sculptor|instrument.?maker|watchmaker|clockmaker|silversmith|goldsmith|ceramicist|engraver|illustrator|potter|printmaker|photographer|designer)/i;
const HISTORICAL_CRAFT_RE = /(apothecary|surgeon|physician|craftsman|smith|weaver|carpenter|joiner|cabinetmaker|shipwright|mason|blacksmith)/i;

function parseArgs () {
  const args = process.argv.slice(2);
  function flag (name, defaultValue) {
    const found = args.find(function (a) { return a.indexOf('--' + name + '=') === 0; });
    return found ? found.slice(name.length + 3) : defaultValue;
  }
  return {
    out: flag('out', path.join(__dirname, 'mining-corpus.csv')),
    pool: parseInt(flag('pool', '1200'), 10) || 1200,
    seed: parseInt(flag('seed', '42'), 10) || 42
  };
}

// Extract just the fields we need to categorise a hit. Tolerates missing
// paths — the CIIM schema is nested + optional in many places, and a
// hit that's missing a field just means that categorisation signal is
// unknown for that record (which is fine).
function summarise (hit) {
  const s = hit._source || {};
  const externalId = TypeMapping.toExternal(hit._id);
  if (!externalId) return null;

  const typeType = ((s.type && s.type.type) || '').toLowerCase();
  const subType = ((s.type && s.type.sub_type && s.type.sub_type[0]) || '').toLowerCase();
  const datatypeActual = ((s['@datatype'] && s['@datatype'].actual) || '').toLowerCase();
  const isOrganisation = (
    datatypeActual === 'organisation' ||
    subType === 'organisation' ||
    typeType === 'institution'
  );

  // Occupation can be string, {value: string}, array of either — normalise to lowercase joined string.
  const occFlat = flattenText(s.occupation).toLowerCase();

  // Biography text lives in description[] with type 'biography' or 'brief biography'.
  const desc = Array.isArray(s.description) ? s.description : [];
  let bio = '';
  let brief = '';
  desc.forEach(function (d) {
    const t = ((d && d.type) || '').toLowerCase();
    if (t === 'brief biography' && !brief) brief = d.value || '';
    else if (t === 'biography' && !bio) bio = d.value || '';
    else if (!bio && !brief && d && d.value) bio = d.value;
  });
  const bioChars = (bio || brief).length;

  const birthYear = parseYear((s.birth && s.birth.date && (s.birth.date.value || s.birth.date.from)) || '');
  const deathYear = parseYear((s.death && s.death.date && (s.death.date.value || s.death.date.to)) || '');

  const hasWikidata = !!(s.wikidata && Object.keys(s.wikidata).length);
  const analytics = (s.enhancement && s.enhancement.analytics && s.enhancement.analytics.current &&
    s.enhancement.analytics.current.cumulative_views) || 0;

  const title = (s.summary && s.summary.title) || (s.name && s.name[0] && s.name[0].value) || '(no title)';

  return {
    id: externalId,
    title,
    isOrganisation,
    occupation: occFlat,
    bioChars,
    briefChars: brief.length,
    birthYear,
    deathYear,
    hasWikidata,
    analytics
  };
}

function flattenText (raw) {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw.map(flattenText).join(', ');
  if (typeof raw === 'object') return flattenText(raw.value);
  return String(raw);
}

function parseYear (str) {
  if (!str) return null;
  const m = String(str).match(/(-?\d{1,4})/);
  return m ? parseInt(m[1], 10) : null;
}

// Priority-order categorisation — first bucket that accepts wins. Order
// matches BUCKET_TARGETS. Falls through to null if no bucket matches
// (candidate is discarded from the corpus).
function categorise (c) {
  const isPerson = !c.isOrganisation;

  // Widened from "strictly living" (too few — SMG collection skews
  // historical, only a handful of recorded-living scientists) to
  // "modern bio shape": no death OR post-1950 death. Captures the
  // 20th–21st century subject class whose biographies read differently
  // from Victorian-era ones (active affiliations, later Wikidata, etc.).
  if (isPerson && SCIENTIST_RE.test(c.occupation) && c.bioChars >= 100 &&
      (!c.deathYear || c.deathYear >= 1950)) {
    return 'recent-scientists';
  }
  if (c.isOrganisation && c.deathYear && c.bioChars >= 200) {
    return 'historical-orgs';
  }
  if (isPerson && MAKER_RE.test(c.occupation) && c.bioChars >= 150) {
    return 'artists-makers';
  }
  if (c.isOrganisation && !c.deathYear && c.bioChars >= 100) {
    return 'modern-brands';
  }
  if (isPerson && c.bioChars > 0 && c.bioChars < 300 &&
      ((c.birthYear && c.birthYear < 1900) || HISTORICAL_CRAFT_RE.test(c.occupation))) {
    return 'thin-historical';
  }
  // Wildcards — record has SOME signal we could work with but doesn't
  // fit a neat bucket. Very short bio, or wikidata-only, or unusual.
  if (c.bioChars < 100 && (c.hasWikidata || c.briefChars > 0)) {
    return 'wildcards';
  }
  return null;
}

// Deterministic shuffle so re-runs with the same seed produce the same
// candidate list. Mulberry32 PRNG — cheap and good enough for sampling.
function shuffle (arr, seed) {
  let a = seed >>> 0;
  function next () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function fetchPool (elastic, index, poolSize) {
  console.log('Querying', index, '· type=agent · pool=' + poolSize);

  // Two-query blend: half the pool comes from top-analytics records
  // (famous, high-signal), the other half from a random_score sweep so
  // we don't miss the long tail (thin subjects are LOW-analytics almost
  // by definition). Merge + dedupe by _id.
  const halfSize = Math.floor(poolSize / 2);

  const topByAnalytics = await elastic.search({
    index,
    body: {
      query: { bool: { must: [{ term: { '@datatype.base': 'agent' } }] } },
      sort: [{ 'enhancement.analytics.current.cumulative_views': { order: 'desc' } }],
      size: halfSize,
      _source: sourceIncludes()
    }
  });

  const randomAgents = await elastic.search({
    index,
    body: {
      query: {
        function_score: {
          query: { bool: { must: [{ term: { '@datatype.base': 'agent' } }] } },
          random_score: { seed: 20260709, field: '_seq_no' },
          boost_mode: 'replace'
        }
      },
      size: halfSize,
      _source: sourceIncludes()
    }
  });

  const merged = new Map();
  (topByAnalytics.body.hits.hits || []).forEach(function (h) { merged.set(h._id, h); });
  (randomAgents.body.hits.hits || []).forEach(function (h) { if (!merged.has(h._id)) merged.set(h._id, h); });

  console.log('  top-analytics hits:', topByAnalytics.body.hits.hits.length);
  console.log('  random-score hits: ', randomAgents.body.hits.hits.length);
  console.log('  merged unique:     ', merged.size);
  return Array.from(merged.values());
}

function sourceIncludes () {
  return [
    'summary.title',
    'name',
    '@datatype',
    'type',
    'occupation',
    'nationality',
    'description',
    'birth',
    'death',
    'wikidata',
    'agent',
    'organisations',
    'enhancement.analytics.current.cumulative_views'
  ];
}

async function main () {
  const opts = parseArgs();
  console.log('Output:', opts.out);
  console.log('Pool size target:', opts.pool);
  console.log('Shuffle seed:    ', opts.seed);
  console.log();

  const elastic = new Client(config.elasticsearch);
  const index = config.elasticIndex || 'ciim';

  const rawHits = await fetchPool(elastic, index, opts.pool);
  console.log();

  const candidates = rawHits.map(summarise).filter(Boolean).filter(function (c) { return !KEEP_LIST.has(c.id); });
  console.log('Candidates after keep-list exclusion:', candidates.length);

  // Bucket assignment (priority order).
  const buckets = {};
  BUCKET_TARGETS.forEach(function (b) { buckets[b.key] = []; });
  candidates.forEach(function (c) {
    const bucket = categorise(c);
    if (bucket) buckets[bucket].push(c);
  });

  console.log();
  console.log('Bucket pool sizes (before sampling):');
  BUCKET_TARGETS.forEach(function (b) {
    console.log('  ' + b.key.padEnd(22) + buckets[b.key].length);
  });
  console.log();

  // Sample N per bucket via seeded shuffle. Warn if a bucket is short.
  const sampled = {};
  BUCKET_TARGETS.forEach(function (b) {
    const shuffled = shuffle(buckets[b.key], opts.seed + b.key.length);
    sampled[b.key] = shuffled.slice(0, b.target);
    if (sampled[b.key].length < b.target) {
      console.warn('WARN: bucket ' + b.key + ' has only ' + sampled[b.key].length +
        '/' + b.target + ' candidates — consider widening the filter.');
    }
  });

  const totalPicked = BUCKET_TARGETS.reduce(function (n, b) { return n + sampled[b.key].length; }, 0);
  console.log('Total picked:', totalPicked, '/ target 45');
  console.log();

  // Write CSV. First column is the id; everything after the first comma
  // is treated as a comment by the csv-file source. We use that to
  // annotate bucket + occupation + bio length for human review.
  const lines = [];
  lines.push('# Mining corpus — 45-record fresh generation for anti-pattern discovery.');
  lines.push('# Generated by scripts/ai-biography/select-mining-corpus.js.');
  lines.push('# Edit freely — bulk-generate --source csv-file --csv <this> reads column 1 only.');
  lines.push('# Blank lines and #-comments are ignored by the source.');
  lines.push('');
  BUCKET_TARGETS.forEach(function (b) {
    lines.push('# ---- ' + b.label + ' (' + sampled[b.key].length + '/' + b.target + ') ----');
    sampled[b.key].forEach(function (c) {
      const occ = c.occupation ? c.occupation.slice(0, 40).replace(/\s+/g, ' ') : '(no occupation)';
      const dates = [c.birthYear || '?', c.deathYear || (c.isOrganisation ? '(active)' : '(living)')].join('–');
      const wk = c.hasWikidata ? 'wd' : 'no-wd';
      const analytics = c.analytics ? c.analytics + 'v' : '0v';
      const title = c.title.slice(0, 40).replace(/\s+/g, ' ');
      lines.push(c.id + ',' + b.key + ',' + dates + ',bio=' + c.bioChars + 'c,' + wk +
        ',' + analytics + ',' + occ + ',' + title);
    });
    lines.push('');
  });

  fs.writeFileSync(opts.out, lines.join('\n'), 'utf8');
  console.log('Wrote CSV to:', opts.out);
  console.log();
  console.log('Next: eyeball the CSV, edit/swap ids as you see fit, then:');
  console.log('  node scripts/bulk-generate.js --source csv-file --csv ' + opts.out);
}

main().catch(function (err) {
  console.error('Selection failed:', err);
  process.exit(1);
});
