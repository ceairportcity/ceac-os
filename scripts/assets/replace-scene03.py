#!/usr/bin/env python3
"""Replace failed auto-crop with genuinely scenic CC0 photograph, maintaining reproducible provenance.
Source: Wikimedia Commons File:Lake Bohinj 2013 (3).jpg, Aleš Krivec, published 2015.
Verified https://commons.wikimedia.org/wiki/File:Lake_Bohinj_2013_(3).jpg .
CC0 licence: https://creativecommons.org/publicdomain/zero/1.0/
Run AFTER scripts/assets/fetch-ceac-landscapes.mjs to fix photo 03.
"""
import hashlib
import io
import json
import pathlib
import urllib.request

from PIL import Image

root = pathlib.Path(__file__).resolve().parents[2]
folder = root / "public/assets/ceac-landscapes"
manifest_path = folder / "manifest.json"
catalog_path = root / "src/lib/ceacLandscapeCatalog.js"
curated_path = root / "scripts/assets/ceac-landscapes-curated.json"
url = "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fa/Lake_Bohinj_2013_%283%29.jpg/1280px-Lake_Bohinj_2013_%283%29.jpg"
request = urllib.request.Request(url, headers={"User-Agent": "CEAC-OS-asset-curation/1.0 (Wikimedia CC0 image source verification)"})
with urllib.request.urlopen(request, timeout=25) as response:
    original = response.read(4_000_001)
if len(original) < 50000 or len(original) > 4_000_000:
    raise ValueError("Unexpected source photograph size")
image = Image.open(io.BytesIO(original)).convert("RGB")
width, height = image.size
if width < 1200 or height < 600:
    raise ValueError("Insufficient original photograph resolution")
# Crop the vertical centre of the mountain/lake photo to the actual banner's 1600:620 aspect.
target_ratio = 1600 / 620
if width / height > target_ratio:
    crop_width = round(height * target_ratio)
    left = (width - crop_width) // 2
    image = image.crop((left, 0, left + crop_width, height))
else:
    crop_height = round(width / target_ratio)
    upper = max(0, (height - crop_height) // 2)
    image = image.crop((0, upper, width, upper + crop_height))
image = image.resize((1600, 620), Image.Resampling.LANCZOS)
buffer = io.BytesIO()
image.save(buffer, format="WEBP", quality=79, method=6)
bytes_ = buffer.getvalue()
if len(bytes_) < 20000 or len(bytes_) > 2_000_000:
    raise ValueError("Unexpected optimised image size")
assert bytes_[:4] == b"RIFF" and bytes_[8:12] == b"WEBP"
path = folder / "scene-03.webp"
path.write_bytes(bytes_)
sha256 = hashlib.sha256(bytes_).hexdigest()
record = {
    "src": "/assets/ceac-landscapes/scene-03.webp",
    "alt": "Panoramic Lake Bohinj with forested mountains reflected in calm water",
    "photographer": "Aleš Krivec",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Lake_Bohinj_2013_(3).jpg",
    "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
    "verifiedOn": "2026-10-16",
    "sha256": sha256,
    "bytes": len(bytes_),
}
manifest = json.loads(manifest_path.read_text())
assert len(manifest["images"]) == 10
manifest["images"][2] = record
manifest["source"] = "Nine Unsplash-licensed genuine stock landscapes; one Commons-verified CC0 photograph"
manifest["licence"] = "Per-image licenseUrl (Unsplash License and CC0)"
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
catalog = [{key: item[key] for key in ("src", "alt", "photographer", "sourceUrl", "licenseUrl")} for item in manifest["images"]]
catalog_path.write_text(
    "// Real locally stored CEAC stock photography. Provenance/hashes in public/assets/ceac-landscapes/manifest.json.\n"
    "export const ceacLandscapeCatalog = Object.freeze(" + json.dumps(catalog, ensure_ascii=False, indent=2) + ");\n"
)
curated = json.loads(curated_path.read_text())
curated["images"][2] = {
    "id": "03", "photoId": "wikimedia-cc0-lake-bohinj-ales-krivec",
    "photographer": record["photographer"],
    "sourceUrl": record["sourceUrl"], "licenseUrl": record["licenseUrl"],
    "alt": record["alt"], "downloadUrl": url,
    "downloader": "scripts/assets/replace-scene03.py",
}
curated["verification"] = "Nine Unsplash License photographs, plus one separately verified CC0 photograph from Wikimedia Commons."
curated_path.write_text(json.dumps(curated, ensure_ascii=False, indent=2) + "\n")
print("scene-03 replaced with CC0 panoramic alpine lake:", sha256, len(bytes_))
