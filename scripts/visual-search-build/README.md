# Visual search — index build tooling

Offline tooling that builds the CLIP embedding index behind the "Snap It"
visual search feature (`/scan`). Run these to (re)build the index when the
catalogue changes enough to matter; the running app never invokes anything
here.

> This README covers **how to run the pipeline** only. Internal decisions,
> validation/recall numbers, and calibrated thresholds are deliberately kept
> out of this public repo — they live in the private plan file referenced at
> the bottom.

## Pipeline at a glance

```
  visual-search-feed.mjs        build_index.py                 manual upload
  (Node, local)                 (Python, Colab GPU)            (you)
┌────────────────────┐   ┌─────────────────────────────┐   ┌──────────────────┐
│ Scroll ES for      │   │ Fetch each image, run CLIP,  │   │ Put the two files │
│ objects with an    │ → │ L2-normalise, write:         │ → │ on the CDN under  │
│ image → feed.jsonl │   │  • embeddings.bin            │   │ /models/ so the   │
│                    │   │  • manifest.json             │   │ app loads them at │
│                    │   │ (rows aligned 1:1)           │   │ startup           │
└────────────────────┘   └─────────────────────────────┘   └──────────────────┘
```

The one hard invariant: the **model and preprocessing must match on both
sides**. The offline embedder uses OpenCLIP `ViT-B-32-quickgelu` with the
`openai` weights; the browser uses `Xenova/clip-vit-base-patch32` (a port of
the same OpenAI weights). Changing one without the other silently breaks
search quality — see the parity check below.

## Files in this folder

| File | Role |
|------|------|
| `visual-search-feed.mjs` | Step 1. Node script; scrolls Elasticsearch and emits one JSONL line (`object_id`, `title`, `image_url`) per object that has a usable image. |
| `build_index.py` | Step 2. Python embedder; reads the feed, fetches + embeds each image, writes `embeddings.bin` + `manifest.json`. |
| `build_index.ipynb` | Colab notebook wrapper around `build_index.py` for the full GPU run. |
| `requirements.txt` | Python deps for `build_index.py` / `round_trip_check.py`. |
| `round_trip_check.py` | Parity checker; embeds one image in Python so you can compare against the vector the browser POSTs. |
| `README.md` | This file. |

Build outputs (`out/`, `image-cache/`, `.venv/`, checkpoints, logs) are all
gitignored.

## Prerequisites

- **Node** — use the repo's existing install (`npm ci` at the repo root). The
  feed script reuses `config.js` and helpers from `lib/`.
- **Elasticsearch access** — the feed script reads the same ES config as the
  app (`.corc` or the usual `ELASTIC_*` env vars). It refuses to run if the ES
  host is unset.
- **Python 3.10+** — for the embedder. `pip install -r requirements.txt`
  (Colab already has torch/numpy/pillow/tqdm; you only add `open_clip_torch`
  and `httpx` there).

## Step 1 — generate the feed (local, Node)

```bash
# Full catalogue
node scripts/visual-search-build/visual-search-feed.mjs

# Small cap for a dev/smoke build
node scripts/visual-search-build/visual-search-feed.mjs --limit 5000

# Custom output path (default: scripts/visual-search-build/out/feed.jsonl)
node scripts/visual-search-build/visual-search-feed.mjs --out /tmp/feed.jsonl
```

Prints a summary (considered / emitted / skipped) on completion. The default
output lands in the gitignored `out/` dir next to the embedder's output.

## Step 2 — build the index

**Full ~250k build → Colab GPU.** Open `build_index.ipynb`, switch the runtime
to GPU, run all cells; it prompts you to upload `build_index.py` and your
`feed.jsonl`, runs the build, verifies the outputs, and downloads
`embeddings.bin` + `manifest.json`. HTTP image fetches usually dominate the
first run; a warm image cache makes re-runs much faster.

**Dev/smoke build → local Mac.** Slow on CPU/MPS but fine for a sanity check:

```bash
pip install -r scripts/visual-search-build/requirements.txt

python scripts/visual-search-build/build_index.py \
    --input  scripts/visual-search-build/out/feed.jsonl \
    --output-dir scripts/visual-search-build/out \
    --limit 200
```

`build_index.py --help` lists all flags (batch size, concurrency, device,
model/pretrained overrides). The output byte count is checked against
`rows × dim × 4` before it exits, so a truncated write fails loudly.

## Step 3 — verify parity (do this whenever the model changes)

The highest-risk failure mode is the offline embeddings drifting from what the
browser produces. To check:

```bash
python scripts/visual-search-build/round_trip_check.py --image /path/to/photo.jpg
```

It prints the first 16 components of the L2-normalised vector. Drop the same
image on `/scan` in a browser, grab the vector it POSTs to
`/api/scan/search` (DevTools → Network → request payload, 4 bytes per
float, little-endian), and confirm the two agree to ~3 decimal places. Large
diffs mean the model or preprocessing is out of sync between the two sides.

## Step 4 — publish

Upload `embeddings.bin` and `manifest.json` to the `/models/` path on the
image CDN (the base URL is `visualSearchModelsBaseUrl` in `config.js`, settable
via `VISUAL_SEARCH_MODELS_BASE_URL`). The app fetches both at startup; restart
the app (or the affected instances) to pick up a new index.

## Internal notes

Decisions, validation/recall results, threshold calibration, and infra notes
are **not** in this repo (it's public). They live in the private plan file
under `~/.claude/plans/` — ask Jamie if you need it.
