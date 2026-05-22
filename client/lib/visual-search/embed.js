// Lazy CLIP image embedder. First call downloads @xenova/transformers
// and the Xenova/clip-vit-base-patch32 ONNX weights from the HF CDN
// (~30–50 MB). Subsequent calls hit the browser cache, so warm scans
// embed in well under a second.
//
// We avoid bundling Transformers.js into bundle.js because (a) it would
// bloat every page on the site, not just /scan, and (b) it's an ESM-
// first library that doesn't sit cleanly behind Browserify/Babel-ify
// preset-env when our targets list IE10. Instead we inject a
// <script type="module"> tag at runtime that does the dynamic import,
// bridges the resolved module out via a uniquely-named global, and
// memoises the promise.
//
// IMPORTANT — preprocessing parity: the Python build pipeline uses
// OpenCLIP's preprocess (resize-shortest-edge to 224 then centre-crop
// 224×224, mean/std normalise). Transformers.js's AutoProcessor for
// `Xenova/clip-vit-base-patch32` does the equivalent. Do NOT replace
// that with custom resize/normalise — preprocessing mismatch is the
// number-one cause of poor retrieval and the first thing to suspect
// if recall is bad.

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
const MODEL_ID = 'Xenova/clip-vit-base-patch32';

let modulePromise = null;
let processorPromise = null;
let modelPromise = null;

function loadTransformers () {
  if (modulePromise) return modulePromise;
  modulePromise = new Promise((resolve, reject) => {
    const handle = '__vs_module_' + Math.random().toString(36).slice(2);
    window[handle] = { resolve, reject };
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent =
      "import('" + TRANSFORMERS_URL + "')" +
      ".then(m => window['" + handle + "'].resolve(m))" +
      ".catch(e => window['" + handle + "'].reject(e));";
    script.onerror = function () {
      reject(new Error('Failed to load Transformers.js from ' + TRANSFORMERS_URL));
    };
    document.head.appendChild(script);
  });
  return modulePromise;
}

async function getProcessor () {
  if (processorPromise) return processorPromise;
  const transformers = await loadTransformers();
  processorPromise = transformers.AutoProcessor.from_pretrained(MODEL_ID);
  return processorPromise;
}

async function getModel () {
  if (modelPromise) return modelPromise;
  const transformers = await loadTransformers();
  // Tell Transformers.js not to look for /models/ on our origin —
  // weights live on the HF CDN.
  if (transformers.env) transformers.env.allowLocalModels = false;
  // Default int8-quantized ONNX (~30 MB download). We tested
  // { quantized: false } (~150 MB) and confirmed it tightens
  // *some* components vs the Python fp32 build — but a few
  // components stay ~0.03 off, which can't be explained by
  // quantization. Most likely cause: Xenova's ONNX export uses
  // standard GELU while our Python side uses QuickGELU
  // (ViT-B-32-quickgelu / openai). Same parity ceiling either
  // way, so we keep the smaller download for a saner first-visit
  // UX. Specific-match retrieval (e.g. exact watch in dense
  // wristwatch cluster) will be capped by this until we resolve
  // the activation mismatch — see followup notes.
  modelPromise = transformers.CLIPVisionModelWithProjection.from_pretrained(MODEL_ID);
  return modelPromise;
}

// Warm the pipeline (download model + processor) so the first capture
// doesn't include the cold-start cost. Returns a Promise that resolves
// when both are ready.
function preload () {
  return Promise.all([getProcessor(), getModel()]);
}

function l2Normalize (vec) {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) sumSq += vec[i] * vec[i];
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return vec;
  for (let i = 0; i < vec.length; i++) vec[i] = vec[i] / norm;
  return vec;
}

// Embed an image data URL (jpeg/png) and return an L2-normalised
// Float32Array — same shape and norm convention as the catalogue rows
// in embeddings.bin, so dot product = cosine similarity on the server.
async function embedFrame (dataUrl) {
  const transformers = await loadTransformers();
  const [processor, model] = await Promise.all([getProcessor(), getModel()]);
  const image = await transformers.RawImage.fromURL(dataUrl);
  const inputs = await processor(image);
  const output = await model(inputs);
  // CLIPVisionModelWithProjection exposes a normalised projection on
  // .image_embeds of shape [1, 512]. Older versions called this
  // .text_embeds in the audio variant, but for vision it's image_embeds.
  const tensor = output.image_embeds;
  if (!tensor || !tensor.data) {
    throw new Error('Unexpected model output shape (missing image_embeds.data)');
  }
  // tensor.data is shared with the model — copy into our own buffer so
  // we own the lifecycle and can normalise + post without surprises.
  const vec = new Float32Array(tensor.data.length);
  vec.set(tensor.data);
  l2Normalize(vec);
  // Debug stash: handy for round-trip parity checks vs the Python
  // pipeline. Read window.__vsLastEmbedding from the console after a
  // scan to compare against round_trip_check.py output.
  if (typeof window !== 'undefined') window.__vsLastEmbedding = vec;
  return vec;
}

// Expose for parity-testing from the DevTools console — paired with
// window.__vsLastEmbedding, this lets you embed a chosen dataUrl
// (e.g. the same JPEG you fed to round_trip_check.py) without going
// through the camera, so the two sides see identical pixel bytes.
if (typeof window !== 'undefined') window.__vsEmbedFrame = embedFrame;

module.exports = { embedFrame, preload };
