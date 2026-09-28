"""Round-trip embedding parity check.

Embeds a single image with the Python pipeline (the same OpenCLIP +
preprocess used by build_index.py), and prints the first 16 components
of the L2-normalised vector to stdout.

You then take the same image, drop it on /scan in your browser, and
read back the vector that the browser actually POSTs. The two should
agree to ~3 decimal places. If they don't, preprocessing or weights
are out of sync between Python and Transformers.js — the brief's
biggest documented failure mode.

How to capture the browser-side vector:
  Open DevTools -> Network on /scan, scan the same image, find the
  POST to /api/scan/search, copy the request payload bytes (raw
  binary). The first 64 bytes (16 floats LE) of that buffer should
  match the values printed here within ±0.005 or so.

  Or, in the browser console after a scan:
      // The controller stashes the most recent embedding for debug:
      // (we'll add this below if it isn't already present)

Usage:
  python round_trip_check.py --image /path/to/photo.jpg
"""

from __future__ import annotations

import argparse
import io
from pathlib import Path

import numpy as np
import open_clip
import torch
from PIL import Image


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--image", "-i", required=True, type=Path, help="Path to a JPEG/PNG to embed")
    p.add_argument("--model", default="ViT-B-32-quickgelu")
    p.add_argument("--pretrained", default="openai")
    p.add_argument("--device", default="auto", choices=["auto", "cuda", "cpu", "mps"])
    args = p.parse_args()

    if args.device == "auto":
        if torch.cuda.is_available():
            device = torch.device("cuda")
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            device = torch.device("mps")
        else:
            device = torch.device("cpu")
    else:
        device = torch.device(args.device)

    print(f"Device: {device}")
    print(f"Model:  {args.model} / {args.pretrained}")
    print(f"Image:  {args.image}")

    model, _, preprocess = open_clip.create_model_and_transforms(
        args.model, pretrained=args.pretrained, device=device
    )
    model.eval()

    img = Image.open(args.image).convert("RGB")
    tensor = preprocess(img).unsqueeze(0).to(device)
    with torch.no_grad():
        feats = model.encode_image(tensor)
        feats = feats / feats.norm(dim=-1, keepdim=True)
    vec = feats[0].detach().cpu().numpy().astype(np.float32)

    norm = float(np.linalg.norm(vec))
    print(f"\nL2 norm: {norm:.6f}  (expect ~1.000000)")
    print(f"\nFirst 16 components (compare these to the browser POST body):")
    for i, v in enumerate(vec[:16]):
        print(f"  [{i:2d}]  {v:+.5f}")
    print()
    print("Tip: the browser's POST body to /api/scan/search is exactly this same vector,")
    print("encoded as 2048 bytes of float32-LE. Match the first 64 bytes against the")
    print("values above (interpret as 16 little-endian float32) — they should agree to")
    print("about 3 decimal places. Larger diffs = preprocessing/weight mismatch.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
