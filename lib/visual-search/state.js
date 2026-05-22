// Singleton holding the in-memory visual-search index. The route handlers
// read from here; bin/server.mjs initialises it at startup. If init fails
// (CDN down, manifest corrupt, dim mismatch, etc.) we log loudly but leave
// the rest of the app untouched — same pattern as bin/cache.js's NULL_CACHE.

const { loadIndex } = require('./index-loader');

let _index = null;
let _readyAt = null;
let _initError = null;

async function init (config) {
  if (!config.visualSearchEnabled) {
    console.log('[visual-search] disabled (config.visualSearchEnabled !== true)');
    return;
  }
  try {
    _index = await loadIndex(config);
    _readyAt = new Date().toISOString();
  } catch (err) {
    _initError = err;
    console.error('[visual-search] init failed; /api/scan/* will return 503:', err.message);
  }
}

function getIndex () {
  return _index;
}

function isReady () {
  return _index !== null;
}

function status () {
  if (_index) {
    return {
      ready: true,
      count: _index.count,
      dim: _index.dim,
      builtAt: _index.builtAt,
      model: _index.model,
      modelRevision: _index.modelRevision,
      readyAt: _readyAt
    };
  }
  return {
    ready: false,
    error: _initError ? _initError.message : 'not initialised'
  };
}

module.exports = { init, getIndex, isReady, status };
