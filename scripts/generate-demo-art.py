#!/usr/bin/env python3
"""
Generate the Studio's demo art pack with Cloudflare Workers AI (FLUX.1 Schnell).

Demo mode (localhost/?demo=1) serves these images instead of placeholder shapes,
matched by scene-description keywords (backgrounds) and speaker names (characters).
See src/lib/stubArt.ts. Output: public/demo-art/*.webp + pack.json.

Usage:
    CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... python3 scripts/generate-demo-art.py [--only noy,buffalo]

The token needs Workers AI access. If Python reports CERTIFICATE_VERIFY_FAILED on macOS, run
"Install Certificates.command" from your Python folder, or `pip install certifi`. Uses the free daily allowance; a full run is 8 images.
FLUX on Workers AI takes no seed, so reruns give new images; the committed files are the pack.
Requires Pillow (already in gpu/requirements.txt).
"""

import argparse
import base64
import io
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

MODEL = "@cf/black-forest-labs/flux-1-schnell"

try:  # python.org builds on macOS ship without root certificates; certifi fixes that if present
    import certifi

    SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:  # otherwise honors SSL_CERT_FILE
    SSL_CONTEXT = ssl.create_default_context()
OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "demo-art"

STYLE = (
    "children's picture book illustration, soft flat colors, clean outlines, "
    "gentle warm lighting, no text, no letters, no words"
)

BACKGROUNDS = [
    {
        "id": "bg-ricefield-sunrise",
        "keywords": ["rice", "field", "paddy", "farm", "sunrise", "morning"],
        "prompt": "wide view of green rice paddies in rural Laos at sunrise, a narrow dirt path along the paddy, "
        "distant misty mountains, empty landscape with no people and no animals",
    },
    {
        "id": "bg-village-path",
        "keywords": ["path", "road", "grass", "village", "walk", "stops"],
        "prompt": "a dirt path through a Lao village with tall grass, banana trees and wooden houses on stilts, "
        "bright morning, empty scene with no people and no animals",
    },
    {
        "id": "bg-school",
        "keywords": ["school", "classroom", "teacher", "yard", "class"],
        "prompt": "a small plain one-story rural schoolhouse painted cream with blue wooden shutters and a tin roof, "
        "blank unmarked walls with no sign, a dusty schoolyard with a mango tree, bright day, empty scene",
    },
    {
        "id": "bg-market",
        "keywords": ["market", "stall", "shop", "buy", "sell", "mango"],
        "prompt": "close view of empty wooden market stalls piled with mangoes, bananas and vegetables under "
        "colorful umbrellas, early morning golden light, a quiet empty street before the market opens",
    },
]

CHARACTERS = [
    {
        "id": "ch-noy",
        "names": ["noy", "girl"],
        "prompt": "a cheerful 9-year-old Lao girl with a black bob haircut, wearing a white school shirt and a "
        "dark blue skirt, small backpack, full body, standing, facing the viewer",
    },
    {
        "id": "ch-buffalo",
        "names": ["buffalo"],
        "prompt": "a friendly gray water buffalo with big curved horns and gentle eyes, full body, side view, standing",
    },
    {
        "id": "ch-teacher",
        "names": ["teacher", "khru"],
        "prompt": "a kind Lao woman teacher in her thirties, hair in a bun, white blouse and a long patterned skirt, "
        "holding a book, full body, standing, facing the viewer",
    },
    {
        "id": "ch-vendor",
        "names": ["vendor", "seller", "grandmother", "grandma"],
        "prompt": "a smiling older Lao woman market vendor with a straw hat, holding a basket of mangoes, "
        "full body, standing, facing the viewer",
    },
]


def generate(prompt: str) -> Image.Image:
    account = os.environ["CLOUDFLARE_ACCOUNT_ID"]
    token = os.environ["CLOUDFLARE_API_TOKEN"]
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{MODEL}",
        data=json.dumps({"prompt": prompt, "steps": 8}).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120, context=SSL_CONTEXT) as resp:
                body = json.load(resp)
            return Image.open(io.BytesIO(base64.b64decode(body["result"]["image"]))).convert("RGB")
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:300]
            if e.code in (401, 403):
                sys.exit(f"Cloudflare rejected the token ({e.code}): {detail}")
            print(f"  attempt {attempt + 1} failed ({e.code}): {detail}", file=sys.stderr)
        except (urllib.error.URLError, TimeoutError, KeyError) as e:
            print(f"  attempt {attempt + 1} failed: {e}", file=sys.stderr)
        time.sleep(3 * (attempt + 1))
    sys.exit("Giving up after 3 attempts")


def portrait(img: Image.Image) -> Image.Image:
    """Center-crop the square render to the 9:16 panel shape."""
    w, h = img.size
    crop_w = round(h * 9 / 16)
    left = (w - crop_w) // 2
    return img.crop((left, 0, left + crop_w, h))


def cut_out(img: Image.Image) -> Image.Image:
    """Remove the plain white background by flood-filling from the edges, then trim."""
    marker = (255, 0, 255)
    filled = img.copy()
    w, h = filled.size
    seeds = [(x, y) for x in range(0, w, w // 16) for y in (0, h - 1)]
    seeds += [(x, y) for y in range(0, h, h // 16) for x in (0, w - 1)]
    for xy in seeds:
        r, g, b = filled.getpixel(xy)
        if min(r, g, b) > 215:
            ImageDraw.floodfill(filled, xy, marker, thresh=45)
    px = filled.load()
    mask = Image.new("L", (w, h), 255)
    mpx = mask.load()
    for y in range(h):
        for x in range(w):
            if px[x, y] == marker:
                mpx[x, y] = 0
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1))
    out = img.convert("RGBA")
    out.putalpha(mask)
    bbox = mask.point(lambda v: 255 if v > 16 else 0).getbbox()
    return out.crop(bbox) if bbox else out


def save_webp(img: Image.Image, path: Path, max_side: int) -> int:
    img.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    img.save(path, "WEBP", quality=78, method=6)
    return path.stat().st_size


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only", help="comma-separated ids to (re)generate, e.g. ch-noy,bg-school")
    args = parser.parse_args()
    if not os.environ.get("CLOUDFLARE_ACCOUNT_ID") or not os.environ.get("CLOUDFLARE_API_TOKEN"):
        sys.exit("Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN")
    only = set(args.only.split(",")) if args.only else None

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    pack_path = OUT_DIR / "pack.json"
    pack = json.loads(pack_path.read_text()) if pack_path.exists() else {"backgrounds": [], "characters": []}

    def record(kind: str, entry: dict) -> None:
        pack[kind] = [e for e in pack[kind] if e["id"] != entry["id"]] + [entry]

    for bg in BACKGROUNDS:
        if only and bg["id"] not in only:
            continue
        print(f"{bg['id']}…")
        img = portrait(generate(f"{bg['prompt']}, vertical composition, {STYLE}"))
        size = save_webp(img, OUT_DIR / f"{bg['id']}.webp", 1024)
        record("backgrounds", {"id": bg["id"], "file": f"{bg['id']}.webp", "keywords": bg["keywords"],
                               "width": img.width, "height": img.height, "bytes": size})
        print(f"  {img.width}x{img.height}, {size // 1024} KB")

    for ch in CHARACTERS:
        if only and ch["id"] not in only:
            continue
        print(f"{ch['id']}…")
        img = cut_out(generate(f"{ch['prompt']}, isolated on a plain pure white background, no shadow, {STYLE}"))
        size = save_webp(img, OUT_DIR / f"{ch['id']}.webp", 800)
        record("characters", {"id": ch["id"], "file": f"{ch['id']}.webp", "names": ch["names"],
                              "width": img.width, "height": img.height, "bytes": size})
        print(f"  {img.width}x{img.height}, {size // 1024} KB")

    pack["backgrounds"].sort(key=lambda e: e["id"])
    pack["characters"].sort(key=lambda e: e["id"])
    pack_path.write_text(json.dumps(pack, indent=2) + "\n")
    print(f"Wrote {pack_path.relative_to(Path.cwd()) if pack_path.is_relative_to(Path.cwd()) else pack_path}")


if __name__ == "__main__":
    main()
