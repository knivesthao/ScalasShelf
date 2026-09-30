#!/usr/bin/env python3
# pyright: basic
"""
Scala’s Shelf Content Packaging Script

Runs on the RunPod GPU machine after UE5 finishes rendering.
Compresses rendered images to WebP, generates a scene manifest,
uploads everything to Cloudflare R2, and inserts metadata into Supabase.

Usage:
    python package_content.py --input ./render_output/ --title "The Brave Buffalo"
        --language lao --reading-level beginner --price 5000 --creator "Somsack"

Requires: pip install -r gpu/requirements.txt
"""

import argparse
import hashlib
import hmac
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen

import requests  # pyright: ignore
from PIL import Image as PilImage

MAX_WIDTH = 800
WEBP_QUALITY = 75
TARGET_TOTAL_MB = 5

# ---- Configuration (from environment) ----

R2_ACCESS_KEY = os.environ.get("R2_ACCESS_KEY", "")
R2_SECRET_KEY = os.environ.get("R2_SECRET_KEY", "")
R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID", "")
R2_BUCKET = os.environ.get("R2_BUCKET", "lmm-content")
R2_PUBLIC_URL = os.environ.get("R2_PUBLIC_URL", "")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")


# ---- Image compression ----


def compress(input_path: str, output_path: str) -> int:
    """Compress image to WebP. Returns file size in bytes."""
    img = PilImage.open(input_path)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGBA")

    width = img.width
    if width > MAX_WIDTH:
        ratio = MAX_WIDTH / float(width)
        new_size = (MAX_WIDTH, int(float(img.height) * ratio))
        img = img.resize(new_size, PilImage.Resampling.LANCZOS)

    img.save(output_path, "WEBP", quality=WEBP_QUALITY)
    return os.path.getsize(output_path)


# ---- Cloudflare R2 upload (direct HTTP, no AWS SDK) ----


def _sign(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def _get_signature_key(
    secret_key: str, date_stamp: str, region: str, service: str
) -> bytes:
    k_date = _sign(("AWS4" + secret_key).encode("utf-8"), date_stamp)
    k_region = _sign(k_date, region)
    k_service = _sign(k_region, service)
    return _sign(k_service, "aws4_request")


def upload_r2(key: str, file_path: str) -> str:
    """Upload a file to Cloudflare R2 using S3-compatible REST API."""
    if not all([R2_ACCESS_KEY, R2_SECRET_KEY, R2_ACCOUNT_ID]):
        print(
            f"Warning: R2 not configured, skipping upload of {key}",
            file=sys.stderr,
        )
        if R2_PUBLIC_URL:
            return f"{R2_PUBLIC_URL}/{key}"
        return ""

    host = f"{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    endpoint = f"https://{host}/{R2_BUCKET}/{key}"
    region = "auto"
    service = "s3"

    with open(file_path, "rb") as f:
        body = f.read()

    now = datetime.now(timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")

    canonical_uri = f"/{R2_BUCKET}/{key}"
    canonical_headers = (
        f"host:{host}\n"
        f"x-amz-content-sha256:{hashlib.sha256(body).hexdigest()}\n"
        f"x-amz-date:{amz_date}\n"
    )
    signed_headers = "host;x-amz-content-sha256;x-amz-date"
    payload_hash = hashlib.sha256(body).hexdigest()

    canonical_request = (
        f"PUT\n{canonical_uri}\n\n"
        f"{canonical_headers}\n{signed_headers}\n{payload_hash}"
    )

    algorithm = "AWS4-HMAC-SHA256"
    credential_scope = f"{date_stamp}/{region}/{service}/aws4_request"
    string_to_sign = (
        f"{algorithm}\n{amz_date}\n{credential_scope}\n"
        f"{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}"
    )

    signing_key = _get_signature_key(R2_SECRET_KEY, date_stamp, region, service)
    signature = hmac.new(
        signing_key, string_to_sign.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    authorization_header = (
        f"{algorithm} Credential={R2_ACCESS_KEY}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )

    req = Request(
        endpoint,
        data=body,
        method="PUT",
        headers={
            "Host": host,
            "x-amz-content-sha256": payload_hash,
            "x-amz-date": amz_date,
            "Authorization": authorization_header,
            "Content-Type": "image/webp",
        },
    )

    try:
        urlopen(req)
    except Exception as e:
        raise RuntimeError(f"R2 upload failed for {key}: {e}") from e

    if R2_PUBLIC_URL:
        return f"{R2_PUBLIC_URL}/{key}"
    return f"https://pub-{R2_ACCOUNT_ID}.r2.dev/{key}"


# ---- Supabase metadata ----


def insert_metadata(meta: dict[str, Any]) -> str:
    """Insert content metadata into Supabase REST API. Returns the content ID."""
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/content",
        headers={
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        json=meta,
    )
    resp.raise_for_status()
    data: list[dict[str, Any]] = resp.json()
    return str(data[0]["id"])


# ---- Main ----


def main() -> None:
    parser = argparse.ArgumentParser(description="Package Scala’s Shelf content")
    parser.add_argument("--input", required=True)
    parser.add_argument("--title", required=True)
    parser.add_argument("--language", required=True, choices=["lao", "english"])
    parser.add_argument(
        "--reading-level",
        required=True,
        dest="reading_level",
        choices=["beginner", "intermediate", "advanced"],
    )
    parser.add_argument("--price", required=True, type=int)
    parser.add_argument("--creator", required=True)
    parser.add_argument("--description", default="")
    parser.add_argument("--out", default="./packaged")
    args = parser.parse_args()

    input_dir = Path(args.input)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    images = sorted(input_dir.glob("*.png")) + sorted(input_dir.glob("*.jpg"))
    if not images:
        print("Error: No images found", file=sys.stderr)
        sys.exit(1)

    print(f"Packaging {len(images)} scenes...")

    scenes: list[dict[str, Any]] = []
    total = 0

    for i, img in enumerate(images):
        n = i + 1
        out = out_dir / f"scene_{n:02d}.webp"
        size = compress(str(img), str(out))
        total += size
        scenes.append(
            {
                "number": n,
                "url": f"/content/temp/scene_{n:02d}.webp",
                "size_bytes": size,
            }
        )
        print(f"  Scene {n}: {size:,} bytes ({size / 1024:.1f} KB)")

    total_mb = total / (1024 * 1024)
    print(f"Total: {total_mb:.1f} MB / {TARGET_TOTAL_MB} MB target")

    # Build and write manifest
    manifest: dict[str, Any] = {
        "total_scenes": len(scenes),
        "total_size_bytes": total,
        "scenes": scenes,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))

    # Upload metadata to Supabase
    content_id: str | None = None
    if not SUPABASE_URL:
        print("Warning: SUPABASE_URL not set — metadata will not be recorded")
    else:
        try:
            content_id = insert_metadata(
                {
                    "title": args.title,
                    "language": args.language,
                    "reading_level": args.reading_level,
                    "price_kip": args.price,
                    "creator_name": args.creator,
                    "description": args.description,
                    "cover_image_url": scenes[0]["url"] if scenes else "",
                }
            )
            print(f"Content ID: {content_id}")
        except Exception as e:
            print(f"Warning: Failed to insert metadata: {e}", file=sys.stderr)

    # Upload images to R2
    if not R2_ACCESS_KEY:
        print(f"Warning: R2 not configured — files saved to {out_dir}")
    elif content_id:
        for i, img in enumerate(images):
            n = i + 1
            file = out_dir / f"scene_{n:02d}.webp"
            key = f"content/{content_id}/scene_{n:02d}.webp"
            url = upload_r2(key, str(file))
            scenes[i]["url"] = url

        manifest["scenes"] = scenes
        (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
        upload_r2(f"content/{content_id}/manifest.json", str(out_dir / "manifest.json"))
        print("Uploaded to R2")

    print("Done.")


if __name__ == "__main__":
    main()
