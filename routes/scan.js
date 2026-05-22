// Routes for the visual-search feature.
// Exports three named factories so they can be registered conditionally
// (only when config.visualSearchEnabled is true) — matches the existing
// pattern used by routes/museum.js, routes/redirects.js, etc.
//
//   page   — GET  /scan
//   search — POST /api/scan/search   application/octet-stream of dim×4 bytes
//   health — GET  /api/scan/health
//
// Search keeps the embedding index in memory (lib/visual-search/state.js
// holds the singleton). Display data — title, image, slug — comes from a
// fresh ES `mget` for the top-K IDs, so titles/images stay current with
// daily catalogue updates without rebuilding the index.

const Boom = require('@hapi/boom');
const slug = require('slugg');
const visualSearch = require('../lib/visual-search/state');
const search = require('../lib/visual-search/search');
const sortImages = require('../lib/helpers/jsonapi-response/sort-images');

const MAX_QUERY_BYTES = 8192;
const DEFAULT_TOP_K = 20;

function pickThumbnailLocation (multimedia) {
  if (!Array.isArray(multimedia) || multimedia.length === 0) return null;
  const sorted = sortImages(multimedia);
  for (let i = 0; i < sorted.length; i++) {
    const processed = sorted[i] && sorted[i]['@processed'];
    const variant = processed && (processed.large_thumbnail || processed.medium);
    if (variant && variant.location) return variant.location;
  }
  return null;
}

function getCategory (source) {
  // ES field is `category` (singular), array of objects with .name.
  if (Array.isArray(source.category) && source.category[0]) {
    return source.category[0].name || '';
  }
  return '';
}

function getDate (source) {
  // ES doc: source.creation.date[0].value (creation is an object, not
  // an array, despite what the JSON:API-shaped templates make it look
  // like — the transform layer reshapes this to lifecycle.creation).
  const creation = source.creation;
  if (creation && Array.isArray(creation.date) && creation.date[0]) {
    return creation.date[0].value || '';
  }
  return '';
}

function getMaker (source) {
  const creation = source.creation;
  if (creation && Array.isArray(creation.maker) && creation.maker[0]) {
    const m = creation.maker[0];
    if (m.summary && m.summary.title) return m.summary.title;
  }
  return '';
}

function getObjectType (source) {
  // Object-type signal for analytics: "what kind of physical thing is
  // this?" — e.g. 'wristwatch', 'television receiver', 'locomotive'.
  // Distinct from category (broad museum classification). Prefer the
  // canonical 'catalogue name'; fall back to the first name entry with
  // a value if absent. Records often have multiple name variants;
  // we take the first for broad analytics signal — fine-grained
  // disambiguation isn't the point.
  if (!Array.isArray(source.name)) return '';
  const cat = source.name.find(n => n && n.type === 'catalogue name');
  if (cat && cat.value) return cat.value;
  const first = source.name.find(n => n && n.value);
  return (first && first.value) || '';
}

function buildResult (id, score, source, config) {
  const title =
    (source.summary && source.summary.title) ||
    (source.title && source.title.value) ||
    '';
  const slugValue = title ? slug(title).toLowerCase() : '';
  const link = `${config.rootUrl || ''}/objects/${id}${slugValue ? '/' + slugValue : ''}`;
  const thumbLocation = pickThumbnailLocation(source.multimedia);
  const figure = thumbLocation && config.mediaPath
    ? config.mediaPath.replace(/\/$/, '') + '/' + thumbLocation.replace(/^\//, '')
    : thumbLocation || null;

  return {
    type: 'objects',
    objectId: id,
    title,
    link,
    figure,
    maker: getMaker(source),
    date: getDate(source),
    category: getCategory(source),
    objectType: getObjectType(source),
    score
  };
}

function confidenceTier (topScore, config) {
  const hi = config.visualSearchHighConfidenceThreshold;
  const med = config.visualSearchMediumConfidenceThreshold;
  if (topScore >= hi) return 'high';
  if (topScore >= med) return 'medium';
  return 'low';
}

// Page handler (shared by both /snap and the /scan alias). Doesn't
// depend on elastic or config — reads from the visualSearch singleton
// and renders the same view at either URL.
function pageHandler (request, h) {
  const data = require('../fixtures/data');
  return h.view('scan', Object.assign({}, data, {
    navigation: require('../fixtures/navigation'),
    museums: require('../fixtures/museums'),
    titlePage: 'Snap It | Science Museum Group Collection',
    ready: visualSearch.isReady(),
    // GTM dataLayer payload — fires on initial render via the
    // dataLayer.push({{{ layer }}}) in templates/layouts/default.html.
    // SPA navigation pushes an equivalent object from
    // client/routes/scan.js.
    layer: JSON.stringify({
      pagetype: 'snap',
      pagename: 'Snap It',
      event: 'snapEvent'
    })
  }));
}

// /snap is the canonical URL; /scan is kept as an alias for the
// earlier-deployed URL so any bookmarks / inbound links keep working.
// Both serve the same page directly (no redirect — simpler caching,
// no extra hop, no behavioural difference between the two URLs).
exports.page = () => [
  { method: 'GET', path: '/snap', config: { handler: pageHandler } },
  { method: 'GET', path: '/scan', config: { handler: pageHandler } }
];

exports.search = (elastic, config) => {
  const payload = {
    allow: 'application/octet-stream',
    maxBytes: MAX_QUERY_BYTES,
    output: 'data',
    parse: false
  };
  const handler = async function (request, h) {
    if (!visualSearch.isReady()) {
      return Boom.serverUnavailable('visual search index not loaded');
    }
    const idx = visualSearch.getIndex();
    const expectedBytes = idx.dim * 4;

    const buf = request.payload;
    if (!Buffer.isBuffer(buf)) {
      return Boom.badRequest('expected application/octet-stream body');
    }
    if (buf.length !== expectedBytes) {
      return Boom.badRequest(
        `query length ${buf.length} bytes, expected ${expectedBytes} (dim=${idx.dim} × 4)`
      );
    }
    // Build a Float32Array view over the request buffer (zero-copy).
    // Buffer's underlying ArrayBuffer may be larger than the slice we
    // care about, hence byteOffset + dim args.
    let queryVec;
    try {
      queryVec = new Float32Array(buf.buffer, buf.byteOffset, idx.dim);
    } catch (err) {
      return Boom.badRequest(`could not interpret payload as Float32: ${err.message}`);
    }
    // Finiteness + (loose) normalisation check. The browser is supposed
    // to L2-normalise before POSTing; if not, scores will be off.
    let sumSq = 0;
    for (let i = 0; i < idx.dim; i++) {
      const v = queryVec[i];
      if (!Number.isFinite(v)) return Boom.badRequest(`non-finite value at dim ${i}`);
      sumSq += v * v;
    }
    const norm = Math.sqrt(sumSq);
    if (norm < 0.5 || norm > 1.5) {
      return Boom.badRequest(`query not L2-normalised (||q||=${norm.toFixed(3)})`);
    }

    const t0 = Date.now();
    const hits = search.topK(queryVec, idx.embeddings, idx.count, idx.dim, DEFAULT_TOP_K);
    const searchMs = Date.now() - t0;

    if (hits.length === 0) {
      return { results: [], confidence: 'low', searchMs };
    }

    const ids = hits.map(h => idx.ids[h.index]);
    let mgetBody;
    try {
      const res = await elastic.mget({
        index: config.elasticIndex,
        body: { ids }
      });
      mgetBody = res.body;
    } catch (err) {
      request.log(['error', 'visual-search'], `mget failed: ${err.message}`);
      return Boom.serverUnavailable('catalogue lookup failed');
    }

    // mget preserves order. Some IDs may have been deleted from ES
    // since the index was built — those come back with `found: false`
    // and are dropped from the results.
    const docsById = {};
    for (let i = 0; i < mgetBody.docs.length; i++) {
      const d = mgetBody.docs[i];
      if (d && d.found && d._source) docsById[d._id] = d._source;
    }

    const results = [];
    for (let i = 0; i < hits.length; i++) {
      const id = ids[i];
      const source = docsById[id];
      if (!source) continue;
      results.push(buildResult(id, hits[i].score, source, config));
    }

    const topScore = results.length > 0 ? results[0].score : 0;
    const tier = confidenceTier(topScore, config);

    return {
      results,
      confidence: tier,
      topScore,
      searchMs,
      builtAt: idx.builtAt
    };
  };
  // Same handler at both URLs. The canonical client calls /api/snap/...;
  // /api/scan/... stays alive for cached client bundles from the earlier
  // soft-launch.
  return [
    { method: 'POST', path: '/api/snap/search', config: { payload, handler } },
    { method: 'POST', path: '/api/scan/search', config: { payload, handler } }
  ];
};

exports.health = () => {
  const handler = function (request, h) {
    const status = visualSearch.status();
    return h.response(status).code(status.ready ? 200 : 503);
  };
  return [
    { method: 'GET', path: '/api/snap/health', config: { handler } },
    { method: 'GET', path: '/api/scan/health', config: { handler } }
  ];
};
