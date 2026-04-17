const fs = require('fs');
const path = require('path');
const sortImages = require('./helpers/jsonapi-response/sort-images');
const encodeFilterValue = require('./helpers/encode-filter-value');
const widgetConfig = require('../config/name-collections.json');
const collectionDescriptions = require('../description-boxes/collection.json');
const anniversary = require('./anniversary');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

module.exports = async function getNameCollectionsData (elastic, config) {
  if (!widgetConfig.enabled) return null;

  try {
    const count = widgetConfig.count || 10;
    const featured = Array.isArray(widgetConfig.featured) ? widgetConfig.featured : [];
    const featuredNames = featured.map(function (f) { return f.collector; });

    const topCollectors = await fetchTopCollectors(elastic, widgetConfig.poolSize || 30);

    // Random pool excludes any featured names so we don't duplicate.
    const randomPool = topCollectors.filter(function (name) {
      return featuredNames.indexOf(name) === -1;
    });

    const seed = periodSeed();
    // Over-fetch so we still have enough after dropping image-less collections.
    const overFetch = Math.max(count * 2, count + 5);
    const randomPicks = seededSample(randomPool, Math.max(0, overFetch - featured.length), seed);

    const combined = featured.concat(randomPicks.map(function (name) { return { collector: name }; }));

    const resolved = await Promise.all(combined.map(function (entry) {
      return resolveEntry(entry, elastic, config);
    }));

    const items = resolved
      .filter(function (x) { return x && x.figure; })
      .slice(0, count);

    if (items.length === 0) return null;

    return {
      carousel: {
        title: widgetConfig.title || 'Explore our collections',
        items: items
      }
    };
  } catch (err) {
    console.error('Name collections widget error:', err.message || err);
    return null;
  }
};

module.exports.secondsUntilNextPeriodUTC = function () {
  return anniversary.secondsUntilNextPeriodUTC(
    (widgetConfig.cache && widgetConfig.cache.refreshPeriodHours) || 4
  );
};

async function fetchTopCollectors (elastic, size) {
  const body = {
    size: 0,
    query: {
      bool: {
        must_not: [
          {
            terms: {
              'cumulation.collector.summary.title.keyword':
                widgetConfig.excludeCollectors || []
            }
          }
        ]
      }
    },
    aggs: {
      collections: {
        terms: {
          size,
          field: 'cumulation.collector.summary.title.keyword',
          exclude: '.*;.*'
        }
      }
    }
  };

  const result = await elastic.search({ index: 'ciim', body });
  const buckets = (result.body &&
    result.body.aggregations &&
    result.body.aggregations.collections &&
    result.body.aggregations.collections.buckets) || [];

  return buckets.map(function (b) { return b.key; });
}

async function resolveEntry (entry, elastic, config) {
  const name = entry.collector;
  const description = getDescription(name);
  const link = buildLink(name);

  // Prefer configured figure, but only if the file actually exists on disk.
  // Otherwise fall back to the most-viewed object image for that collector.
  let figure = null;
  if (entry.figure && assetExists(entry.figure)) {
    figure = entry.figure;
  } else {
    figure = await fetchCollectorImage(name, elastic, config);
  }

  if (!figure) return null;

  return {
    title: name,
    description: description,
    figure: figure,
    link: link
  };
}

function assetExists (figurePath) {
  if (!figurePath || typeof figurePath !== 'string') return false;
  if (!figurePath.startsWith('/')) return false;
  try {
    return fs.existsSync(path.join(PUBLIC_DIR, figurePath));
  } catch (err) {
    return false;
  }
}

function getDescription (collectorName) {
  const entry = collectionDescriptions[collectorName];
  if (!entry || !entry.description) return '';

  const desc = entry.description.trim();
  // Cut at first sentence-ending full stop. Handles ". " and "." at end.
  const match = desc.match(/^([^.]*\.)/);
  if (match) return match[1].trim();
  return desc;
}

function buildLink (collectorName) {
  return '/search/collection/' + encodeFilterValue(collectorName);
}

async function fetchCollectorImage (collectorName, elastic, config) {
  try {
    const body = {
      size: 1,
      _source: ['multimedia'],
      query: {
        function_score: {
          query: {
            bool: {
              must: [
                { term: { 'cumulation.collector.summary.title.keyword': collectorName } },
                { exists: { field: 'multimedia.@processed.large_thumbnail.location' } }
              ]
            }
          },
          field_value_factor: {
            field: 'enhancement.analytics.current.cumulative_views',
            modifier: 'log1p',
            missing: 0
          },
          boost_mode: 'replace'
        }
      }
    };

    const result = await elastic.search({ index: 'ciim', body });
    const hits = (result.body && result.body.hits && result.body.hits.hits) || [];
    if (hits.length === 0) return null;

    return getImage(hits[0]._source || {}, config);
  } catch (err) {
    return null;
  }
}

function getImage (source, config) {
  const multimedia = source.multimedia;
  if (!multimedia) return null;

  const sorted = sortImages(Array.isArray(multimedia) ? multimedia : [multimedia]);
  const first = sorted[0];
  if (!first) return null;

  const processed = first['@processed'];
  if (!processed) return null;

  const thumb = processed.large_thumbnail || processed.large;
  if (!thumb || !thumb.location) return null;

  const mediaPath = (config && config.mediaPath) || '';
  return mediaPath + thumb.location;
}

// Seed rotates with the configured cache window so random picks are stable
// within a cache period but rotate across refreshes.
function periodSeed () {
  const periodHours = (widgetConfig.cache && widgetConfig.cache.refreshPeriodHours) || 4;
  const now = new Date();
  const periodIndex = Math.floor(now.getUTCHours() / periodHours);
  return now.getUTCFullYear() * 100000 +
    (now.getUTCMonth() + 1) * 10000 +
    now.getUTCDate() * 100 +
    periodIndex;
}

function seededRandom (seed) {
  let t = (seed + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function seededSample (items, count, seed) {
  if (count <= 0) return [];
  if (items.length <= count) return items.slice();
  const pool = items.slice();
  const result = [];
  let s = seed;
  while (result.length < count && pool.length > 0) {
    s = s * 16807 + 1;
    const idx = Math.floor(seededRandom(s) * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

module.exports._getDescription = getDescription;
module.exports._buildLink = buildLink;
module.exports._seededSample = seededSample;
module.exports._assetExists = assetExists;
