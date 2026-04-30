// Loads embeddings.bin + manifest.json from the configured base URL (or a
// local file path) and returns the in-memory representation used by the
// search module. Validates dim/count/finiteness so a corrupt index fails
// loudly at startup, before any /api/scan/search request hits it.

const fs = require('fs');
const path = require('path');

const EXPECTED_BYTES_PER_FLOAT = 4;

class IndexLoadError extends Error {
  constructor (message) {
    super(message);
    this.name = 'IndexLoadError';
  }
}

async function fetchBuffer (url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new IndexLoadError(`fetch ${url} -> HTTP ${res.status}`);
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } finally {
    clearTimeout(timer);
  }
}

async function loadFromUrl (baseUrl, name, timeoutMs) {
  const url = baseUrl.replace(/\/$/, '') + '/' + name;
  return fetchBuffer(url, timeoutMs);
}

async function loadFromPath (basePath, name) {
  return fs.promises.readFile(path.join(basePath, name));
}

function isUrl (s) {
  return /^https?:\/\//i.test(s);
}

function validateManifest (manifest) {
  const required = ['model', 'model_revision', 'embed_dim', 'count', 'built_at', 'items'];
  for (const k of required) {
    if (!(k in manifest)) {
      throw new IndexLoadError(`manifest missing required field: ${k}`);
    }
  }
  if (!Array.isArray(manifest.items)) {
    throw new IndexLoadError('manifest.items must be an array');
  }
  if (manifest.items.length !== manifest.count) {
    throw new IndexLoadError(
      `manifest.count (${manifest.count}) !== items.length (${manifest.items.length})`
    );
  }
  if (!Number.isInteger(manifest.embed_dim) || manifest.embed_dim <= 0) {
    throw new IndexLoadError(`manifest.embed_dim invalid: ${manifest.embed_dim}`);
  }
}

function buildEmbeddingsView (binBuf, count, dim) {
  const expectedBytes = count * dim * EXPECTED_BYTES_PER_FLOAT;
  if (binBuf.length !== expectedBytes) {
    throw new IndexLoadError(
      `embeddings.bin size mismatch: got ${binBuf.length} bytes, expected ${expectedBytes} ` +
      `(count=${count} * dim=${dim} * 4)`
    );
  }
  // Build a Float32Array that views the underlying buffer with no copy.
  // The buffer's byteOffset must be 4-byte aligned for the view to work;
  // Buffer.from(arrayBuffer) preserves that.
  return new Float32Array(binBuf.buffer, binBuf.byteOffset, count * dim);
}

function spotCheckFinite (embeddings, count, dim, sampleSize) {
  // Catches data corruption (NaN/Inf) that a length check would miss.
  // Full N*dim scan would be ~128M checks at 250k*512; we sample instead.
  const stride = Math.max(1, Math.floor(count / sampleSize));
  for (let row = 0; row < count; row += stride) {
    const offset = row * dim;
    for (let j = 0; j < dim; j++) {
      const v = embeddings[offset + j];
      if (!Number.isFinite(v)) {
        throw new IndexLoadError(
          `embeddings.bin contains non-finite value at row=${row} dim=${j}: ${v}`
        );
      }
    }
  }
}

async function loadIndex (config) {
  const base = config.visualSearchModelsBaseUrl;
  if (!base) throw new IndexLoadError('config.visualSearchModelsBaseUrl is not set');
  const timeoutMs = config.visualSearchLoadTimeoutMs || 60000;
  const useUrl = isUrl(base);

  const t0 = Date.now();
  const [manifestBuf, binBuf] = await Promise.all([
    useUrl ? loadFromUrl(base, 'manifest.json', timeoutMs) : loadFromPath(base, 'manifest.json'),
    useUrl ? loadFromUrl(base, 'embeddings.bin', timeoutMs) : loadFromPath(base, 'embeddings.bin')
  ]);

  let manifest;
  try {
    manifest = JSON.parse(manifestBuf.toString('utf8'));
  } catch (err) {
    throw new IndexLoadError(`manifest.json is not valid JSON: ${err.message}`);
  }

  validateManifest(manifest);

  const embeddings = buildEmbeddingsView(binBuf, manifest.count, manifest.embed_dim);
  spotCheckFinite(embeddings, manifest.count, manifest.embed_dim, 1000);

  const ids = new Array(manifest.count);
  for (let i = 0; i < manifest.count; i++) {
    const item = manifest.items[i];
    if (!item || !item.object_id) {
      throw new IndexLoadError(`manifest.items[${i}] has no object_id`);
    }
    ids[i] = item.object_id;
  }

  const elapsedMs = Date.now() - t0;
  console.log(
    `[visual-search] loaded ${manifest.count} embeddings (dim=${manifest.embed_dim}, ` +
    `model=${manifest.model}, built_at=${manifest.built_at}) in ${elapsedMs}ms`
  );

  return {
    embeddings,
    ids,
    dim: manifest.embed_dim,
    count: manifest.count,
    builtAt: manifest.built_at,
    model: manifest.model,
    modelRevision: manifest.model_revision,
    quantization: manifest.quantization || 'none'
  };
}

module.exports = { loadIndex, IndexLoadError };
