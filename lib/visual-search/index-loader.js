// Loads embeddings.bin + manifest.json from the configured base URL (or a
// local file path) and returns the in-memory representation used by the
// search module. Validates dim/count/finiteness so a corrupt index fails
// loudly at startup, before any /api/snap/search request hits it.

const fs = require('fs');
const path = require('path');

const EXPECTED_BYTES_PER_FLOAT = 4;

class IndexLoadError extends Error {
  constructor (message) {
    super(message);
    this.name = 'IndexLoadError';
  }
}

async function fetchJsonAtUrl (url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new IndexLoadError(`fetch ${url} -> HTTP ${res.status}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Streams the response body straight into a single pre-allocated Buffer
// of the expected size. Avoids the ~2× memory peak of
// `await res.arrayBuffer()`, which internally accumulates chunks then
// `Buffer.concat`s them — that's enough to OOM-kill the process on a
// 2 GB t4g.small while loading a 520 MB embeddings.bin (the chunks +
// the final concat are alive simultaneously).
async function fetchIntoBufferAtUrl (url, expectedBytes, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new IndexLoadError(`fetch ${url} -> HTTP ${res.status}`);
    }
    if (!res.body) {
      throw new IndexLoadError(`fetch ${url} -> response has no body stream`);
    }
    const buf = Buffer.alloc(expectedBytes);
    let offset = 0;
    const reader = res.body.getReader();
    // eslint-disable-next-line no-unmodified-loop-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (offset + value.length > expectedBytes) {
        throw new IndexLoadError(
          `${url}: response longer than expected ${expectedBytes} bytes ` +
          `(saw ${offset + value.length})`
        );
      }
      buf.set(value, offset);
      offset += value.length;
    }
    if (offset !== expectedBytes) {
      throw new IndexLoadError(
        `${url}: streamed ${offset} bytes, expected ${expectedBytes}`
      );
    }
    return buf;
  } finally {
    clearTimeout(timer);
  }
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

  // Step 1: load and parse the manifest first. Small (~6 MB), cheap,
  // and we need its `count` + `embed_dim` to allocate the embeddings
  // buffer at the exact right size. Trading the previous parallel
  // fetch for sequential — costs us a second or so, lets us avoid
  // the doubled-allocation peak in step 2.
  let manifest;
  try {
    if (useUrl) {
      const url = base.replace(/\/$/, '') + '/manifest.json';
      manifest = await fetchJsonAtUrl(url, timeoutMs);
    } else {
      const buf = await fs.promises.readFile(path.join(base, 'manifest.json'));
      manifest = JSON.parse(buf.toString('utf8'));
    }
  } catch (err) {
    if (err instanceof IndexLoadError) throw err;
    if (err instanceof SyntaxError) {
      throw new IndexLoadError(`manifest.json is not valid JSON: ${err.message}`);
    }
    throw new IndexLoadError(`manifest.json load failed: ${err.message}`);
  }

  validateManifest(manifest);

  const expectedBinBytes = manifest.count * manifest.embed_dim * EXPECTED_BYTES_PER_FLOAT;

  // Step 2: load embeddings.bin into a single pre-sized Buffer.
  // - URL: stream chunks straight into the pre-allocated Buffer; peak
  //   memory is exactly one `expectedBinBytes` allocation.
  // - Local path: fs.readFile pre-allocates based on fstat, so it
  //   doesn't suffer the doubling either; safe to use as-is.
  let binBuf;
  try {
    if (useUrl) {
      const url = base.replace(/\/$/, '') + '/embeddings.bin';
      binBuf = await fetchIntoBufferAtUrl(url, expectedBinBytes, timeoutMs);
    } else {
      binBuf = await fs.promises.readFile(path.join(base, 'embeddings.bin'));
    }
  } catch (err) {
    if (err instanceof IndexLoadError) throw err;
    throw new IndexLoadError(`embeddings.bin load failed: ${err.message}`);
  }

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
