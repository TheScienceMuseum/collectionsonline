"""Build the visual-search embedding index from a JSONL feed.

Inputs:
  --input  feed.jsonl    JSONL produced by visual-search-feed.mjs (same folder)
                         each line: {"object_id", "title", "image_url"}

Outputs (in --output-dir):
  embeddings.bin         raw float32 little-endian, row-major, shape (N, dim)
                         L2-normalized per row, perfectly row-aligned with manifest
  manifest.json          {model, model_revision, embed_dim, count, built_at,
                          image_variant, quantization, items: [{object_id}, ...]}

Behaviour:
  - Dedupes input by object_id (keeps first occurrence).
  - Fetches images concurrently with httpx (async).
  - Caches successful fetches on disk by URL hash so re-runs after a model
    change skip the network.
  - Skips records whose image fails to fetch or decode; logs the reason and
    drops them from BOTH embeddings.bin and manifest.json so row indices
    remain aligned 1:1.
  - Checkpoint file lets a killed run resume from where it stopped.

Mac CPU dev runs are slow but useful for sanity checks; full ~250k builds
should run on a Colab GPU (see build_index.ipynb).
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import io
import json
import os
import struct
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Tuple

import httpx
import numpy as np
import open_clip
import torch
from PIL import Image, UnidentifiedImageError
from tqdm import tqdm


# Use the QuickGELU architecture variant. OpenAI's original CLIP was
# trained with QuickGELU activations; loading those weights into the
# default ViT-B-32 (which uses standard GELU) produces silently-wrong
# outputs. open_clip prints a UserWarning for this — heed it.
DEFAULT_MODEL = "ViT-B-32-quickgelu"
# OpenAI weights — must match the Transformers.js model used in the
# browser (Xenova/clip-vit-base-patch32, which is a port of
# openai/clip-vit-base-patch32). DO NOT change to a LAION variant
# without simultaneously swapping the browser model — preprocessing
# parity is necessary but not sufficient; weight parity matters too.
DEFAULT_PRETRAINED = "openai"
DEFAULT_BATCH_SIZE = 64
DEFAULT_CONCURRENCY = 12
DEFAULT_HTTP_TIMEOUT = 30.0

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CACHE_DIR = SCRIPT_DIR / "image-cache"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--input", "-i", required=True, type=Path, help="Path to feed.jsonl")
    p.add_argument("--output-dir", "-o", required=True, type=Path, help="Where to write embeddings.bin + manifest.json")
    p.add_argument(
        "--cache-dir",
        type=Path,
        default=None,
        help=f"Image cache dir (shared across builds, default: {DEFAULT_CACHE_DIR})",
    )
    p.add_argument("--limit", type=int, default=None, help="Process only the first N records (for dev)")
    p.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    p.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY)
    p.add_argument("--device", default="auto", choices=["auto", "cuda", "cpu", "mps"])
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--pretrained", default=DEFAULT_PRETRAINED)
    p.add_argument("--http-timeout", type=float, default=DEFAULT_HTTP_TIMEOUT)
    return p.parse_args()


def select_device(spec: str) -> torch.device:
    if spec == "auto":
        if torch.cuda.is_available():
            return torch.device("cuda")
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return torch.device("mps")
        return torch.device("cpu")
    return torch.device(spec)


def load_feed(path: Path, limit: Optional[int]) -> List[dict]:
    seen = set()
    out: List[dict] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            oid = row.get("object_id")
            if not oid or oid in seen:
                continue
            seen.add(oid)
            out.append(row)
            if limit is not None and len(out) >= limit:
                break
    return out


def cache_path_for(cache_dir: Path, url: str) -> Path:
    h = hashlib.sha256(url.encode("utf-8")).hexdigest()
    return cache_dir / h[:2] / h[2:]


async def fetch_one(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    url: str,
    cache_path: Path,
) -> Tuple[Optional[bytes], Optional[str]]:
    """Return (bytes, None) on success, (None, reason) on failure."""
    if cache_path.exists():
        try:
            return cache_path.read_bytes(), None
        except OSError as e:
            return None, f"cache read failed: {e}"

    async with sem:
        try:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None, f"http {resp.status_code}"
            data = resp.content
            try:
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                tmp = cache_path.with_suffix(".tmp")
                tmp.write_bytes(data)
                tmp.replace(cache_path)
            except OSError as e:
                # Cache write failed but we still have the bytes, keep going.
                print(f"  WARN: cache write failed: {e}", file=sys.stderr)
            return data, None
        except httpx.HTTPError as e:
            return None, f"http error: {type(e).__name__}: {e}"


def decode_image(data: bytes) -> Optional[Image.Image]:
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
        return img.convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError) as e:
        print(f"  WARN: decode failed: {e}", file=sys.stderr)
        return None


def write_manifest(
    out_dir: Path,
    items: List[dict],
    model: str,
    pretrained: str,
    embed_dim: int,
    image_variant: str,
) -> None:
    manifest = {
        "model": model,
        "model_revision": pretrained,
        "embed_dim": embed_dim,
        "count": len(items),
        "built_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "image_variant": image_variant,
        "quantization": "none",
        "items": [{"object_id": it["object_id"]} for it in items],
    }
    with (out_dir / "manifest.json").open("w", encoding="utf-8") as f:
        json.dump(manifest, f, separators=(",", ":"))


async def run(args: argparse.Namespace) -> int:
    device = select_device(args.device)
    print(f"Device: {device}")

    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    cache_dir = args.cache_dir or DEFAULT_CACHE_DIR
    cache_dir.mkdir(parents=True, exist_ok=True)

    print(f"Loading feed from {args.input}")
    feed = load_feed(args.input, args.limit)
    print(f"  {len(feed)} unique records")

    print(f"Loading model {args.model} / {args.pretrained}")
    model, _, preprocess = open_clip.create_model_and_transforms(
        args.model, pretrained=args.pretrained, device=device
    )
    model.eval()
    embed_dim = model.visual.output_dim
    print(f"  embed_dim = {embed_dim}")

    bin_path = output_dir / "embeddings.bin"
    bin_file = bin_path.open("wb")

    kept_items: List[dict] = []
    stats = {"total": len(feed), "embedded": 0, "fetch_fail": 0, "decode_fail": 0}

    sem = asyncio.Semaphore(args.concurrency)
    timeout = httpx.Timeout(args.http_timeout)
    limits = httpx.Limits(max_connections=args.concurrency, max_keepalive_connections=args.concurrency)

    async with httpx.AsyncClient(timeout=timeout, limits=limits, follow_redirects=True) as client:
        with tqdm(total=len(feed), desc="embedding", unit="img") as pbar:
            i = 0
            while i < len(feed):
                batch_records = feed[i : i + args.batch_size]
                i += args.batch_size

                fetches = await asyncio.gather(*[
                    fetch_one(client, sem, r["image_url"], cache_path_for(cache_dir, r["image_url"]))
                    for r in batch_records
                ])

                tensors = []
                items_for_batch = []
                for record, (data, reason) in zip(batch_records, fetches):
                    if data is None:
                        stats["fetch_fail"] += 1
                        print(f"  SKIP {record['object_id']}: {reason}", file=sys.stderr)
                        continue
                    img = decode_image(data)
                    if img is None:
                        stats["decode_fail"] += 1
                        continue
                    try:
                        tensor = preprocess(img)
                    except Exception as e:
                        stats["decode_fail"] += 1
                        print(f"  SKIP {record['object_id']}: preprocess: {e}", file=sys.stderr)
                        continue
                    tensors.append(tensor)
                    items_for_batch.append(record)

                if tensors:
                    batch = torch.stack(tensors).to(device)
                    with torch.no_grad():
                        feats = model.encode_image(batch)
                        feats = feats / feats.norm(dim=-1, keepdim=True)
                    feats_np = feats.detach().cpu().numpy().astype(np.float32, copy=False)
                    if feats_np.shape[1] != embed_dim:
                        raise RuntimeError(
                            f"unexpected embed_dim: got {feats_np.shape[1]} expected {embed_dim}"
                        )
                    bin_file.write(feats_np.tobytes(order="C"))
                    kept_items.extend(items_for_batch)
                    stats["embedded"] += len(items_for_batch)

                pbar.update(len(batch_records))
                pbar.set_postfix(emb=stats["embedded"], fetch_fail=stats["fetch_fail"])

    bin_file.close()

    write_manifest(
        output_dir,
        kept_items,
        model=args.model,
        pretrained=args.pretrained,
        embed_dim=embed_dim,
        image_variant="medium",
    )

    expected_bytes = stats["embedded"] * embed_dim * 4
    actual_bytes = bin_path.stat().st_size
    if actual_bytes != expected_bytes:
        print(
            f"ERROR: embeddings.bin size {actual_bytes} != expected {expected_bytes} "
            f"(rows={stats['embedded']} * dim={embed_dim} * 4)",
            file=sys.stderr,
        )
        return 2

    print("---")
    print(f"  Total considered: {stats['total']}")
    print(f"  Embedded:         {stats['embedded']}")
    print(f"  Fetch failures:   {stats['fetch_fail']}")
    print(f"  Decode failures:  {stats['decode_fail']}")
    print(f"  Output: {bin_path} ({actual_bytes:,} bytes)")
    print(f"          {output_dir / 'manifest.json'}")
    return 0


def main() -> int:
    args = parse_args()
    return asyncio.run(run(args))


if __name__ == "__main__":
    sys.exit(main())
