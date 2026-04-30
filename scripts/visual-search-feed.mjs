// Walk the Elasticsearch catalogue and emit one JSONL line per object that
// has at least one usable image. The output is the input to the Python
// embedder in scripts/visual-search-build/.
//
// Each emitted line:
//   { "object_id": "co154990", "title": "Thumbscrew, France, 1601-1850",
//     "image_url": "https://coimages.../medium_a67686__0002_.jpg" }
//
// Usage:
//   node scripts/visual-search-feed.mjs                 # full run
//   node scripts/visual-search-feed.mjs --limit 5000    # cap for dev
//   node scripts/visual-search-feed.mjs --out feed.jsonl
//
// Reuses lib/helpers/jsonapi-response/sort-images.js for the canonical
// first-image picker (position-then-upload-date sort) — do not reimplement.

import { Client } from '@elastic/elasticsearch';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const config = require('../config');
const sortImages = require('../lib/helpers/jsonapi-response/sort-images');
const TypeMapping = require('../lib/type-mapping');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs (argv) {
  const out = { limit: Infinity, outPath: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') out.limit = parseInt(argv[++i], 10);
    else if (a === '--out') out.outPath = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/visual-search-feed.mjs [--limit N] [--out path]');
      process.exit(0);
    }
  }
  if (out.outPath == null) {
    out.outPath = path.join(__dirname, 'visual-search-out', 'feed.jsonl');
  }
  return out;
}

const args = parseArgs(process.argv);

if (!config.elasticsearch.node) {
  console.error('ELASTIC_HOST is not set. Configure .corc or env vars before running.');
  process.exit(1);
}

fs.mkdirSync(path.dirname(args.outPath), { recursive: true });
const outStream = fs.createWriteStream(args.outPath, { flags: 'w' });

const elastic = new Client(config.elasticsearch);

const SCROLL_TTL = '2m';
const PAGE_SIZE = 500;

const stats = {
  considered: 0,
  emitted: 0,
  skippedNoMultimedia: 0,
  skippedNoMediumVariant: 0,
  skippedNoLocation: 0
};

function pickImageUrl (multimedia) {
  if (!Array.isArray(multimedia) || multimedia.length === 0) return null;
  const sorted = sortImages(multimedia);
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const processed = entry && entry['@processed'];
    const medium = processed && processed.medium;
    const location = medium && medium.location;
    if (location) return location;
  }
  return null;
}

function handlePage (hits) {
  for (let i = 0; i < hits.length; i++) {
    if (stats.emitted >= args.limit) return false;
    stats.considered++;
    const hit = hits[i];
    const src = hit._source || {};

    if (!src.multimedia || !src.multimedia.length) {
      stats.skippedNoMultimedia++;
      continue;
    }

    const relativeLocation = pickImageUrl(src.multimedia);
    if (!relativeLocation) {
      stats.skippedNoMediumVariant++;
      continue;
    }

    const objectId = TypeMapping.toExternal(hit._id);
    const title = (src.summary && src.summary.title) ||
      (src.title && src.title.value) ||
      '';

    const imageUrl = config.mediaPath
      ? config.mediaPath.replace(/\/$/, '') + '/' + relativeLocation.replace(/^\//, '')
      : relativeLocation;

    outStream.write(JSON.stringify({
      object_id: objectId,
      title,
      image_url: imageUrl
    }) + '\n');

    stats.emitted++;
  }
  return true;
}

async function run () {
  console.log(`Scrolling ${config.elasticIndex} for objects with multimedia (limit=${args.limit === Infinity ? 'none' : args.limit})...`);

  const initial = await elastic.search({
    index: config.elasticIndex,
    scroll: SCROLL_TTL,
    size: PAGE_SIZE,
    _source: ['multimedia', 'summary.title', 'title.value', '@admin'],
    body: {
      query: {
        bool: {
          filter: [
            { term: { '@datatype.base': 'object' } },
            { exists: { field: 'multimedia' } }
          ]
        }
      }
    }
  });

  const total = initial.body.hits.total && (initial.body.hits.total.value || initial.body.hits.total);
  console.log(`  Match count: ${total}`);

  let scrollId = initial.body._scroll_id;
  if (!handlePage(initial.body.hits.hits)) {
    await endScroll(scrollId);
    return;
  }

  while (true) {
    if (stats.emitted >= args.limit) break;
    const next = await elastic.scroll({ scrollId, scroll: SCROLL_TTL });
    const hits = next.body.hits.hits;
    if (!hits || hits.length === 0) break;
    scrollId = next.body._scroll_id;
    const cont = handlePage(hits);
    if (!cont) break;
    if (stats.considered % 5000 < PAGE_SIZE) {
      console.log(`  considered=${stats.considered} emitted=${stats.emitted}`);
    }
  }

  await endScroll(scrollId);
}

async function endScroll (scrollId) {
  try {
    if (scrollId) await elastic.clearScroll({ scrollId });
  } catch (err) {
    // non-fatal
  }
}

run()
  .then(() => new Promise(resolve => outStream.end(resolve)))
  .then(() => {
    console.log('---');
    console.log('Done.');
    console.log(`  Considered:               ${stats.considered}`);
    console.log(`  Emitted:                  ${stats.emitted}`);
    console.log(`  Skipped (no multimedia):  ${stats.skippedNoMultimedia}`);
    console.log(`  Skipped (no medium var):  ${stats.skippedNoMediumVariant}`);
    console.log(`  Output: ${args.outPath}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Feed failed:', err);
    outStream.end();
    process.exit(1);
  });
