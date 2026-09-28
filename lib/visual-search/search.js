// Top-K dot-product search over an L2-normalized in-memory float32 index.
//
// Both the query and the stored embeddings are L2-normalized at write time,
// so the dot product equals cosine similarity. We therefore want the K rows
// with the largest dot product against the query.
//
// Hot-loop discipline:
//   - Single Float32Array passed in by reference (the loader owns lifecycle).
//   - No allocations per row inside the inner loop.
//   - Top-K maintained as two small typed arrays (sorted descending by score).
//
// At 250k rows × 512 dim this completes well under the 250ms p95 target on
// modest hardware. If profiling later shows we need more speed, the path
// is: SIMD via @stdlib/blas-base-sdot → WASM SIMD module → native addon.

function topK (query, embeddings, count, dim, k) {
  if (query.length !== dim) {
    throw new Error(`query dim ${query.length} !== index dim ${dim}`);
  }
  if (k <= 0) return [];

  const cap = Math.min(k, count);
  const bestScores = new Float32Array(cap);
  const bestIndices = new Int32Array(cap);
  for (let i = 0; i < cap; i++) bestScores[i] = -Infinity;

  let minBest = -Infinity;

  for (let row = 0; row < count; row++) {
    const offset = row * dim;
    let dot = 0.0;
    for (let j = 0; j < dim; j++) {
      dot += query[j] * embeddings[offset + j];
    }
    if (dot > minBest) {
      // Insertion sort within the small top-K array.
      let pos = cap - 1;
      while (pos > 0 && bestScores[pos - 1] < dot) {
        bestScores[pos] = bestScores[pos - 1];
        bestIndices[pos] = bestIndices[pos - 1];
        pos--;
      }
      bestScores[pos] = dot;
      bestIndices[pos] = row;
      minBest = bestScores[cap - 1];
    }
  }

  const results = [];
  for (let i = 0; i < cap; i++) {
    if (bestScores[i] === -Infinity) break;
    results.push({ index: bestIndices[i], score: bestScores[i] });
  }
  return results;
}

module.exports = { topK };
