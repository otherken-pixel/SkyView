#!/usr/bin/env python3
"""
FAA VFR Sectional Chart Downloader → Firebase Storage
======================================================
Scrapes the FAA Digital Products VFR page to find the latest VFR
Sectional GeoTIFF ZIP files, downloads and extracts them, uploads
the raw .tif files to a Google Cloud Storage bucket linked to your
Firebase project, then cleans up all temporary local files.

Requirements:
    pip install requests beautifulsoup4 firebase-admin

Usage:
    # Authenticate with a service account key:
    export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
    # Or set FIREBASE_BUCKET env var (defaults to <project-id>.appspot.com):
    export FIREBASE_BUCKET="your-project-id.appspot.com"
    python faa_charts_download.py

The script uploads to:
    gs://<FIREBASE_BUCKET>/faa-charts/sectional/<chart-name>.tif
"""

import os
import re
import sys
import time
import zipfile
import tempfile
import logging
from pathlib import Path

import requests
from bs4 import BeautifulSoup
import firebase_admin
from firebase_admin import credentials, storage

# ── Configuration ──────────────────────────────────────────────────────────────
FAA_VFR_URL = "https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/vfr/"
STORAGE_FOLDER = "faa-charts/sectional"
# Matches only the Sectional GeoTIFF zips (not TAC/Caribbean/etc.)
SECTIONAL_PATTERN = re.compile(r"Sectional.*?GeoTIFF", re.IGNORECASE)
DOWNLOAD_TIMEOUT = 120   # seconds per file
CHUNK_SIZE = 8 * 1024 * 1024  # 8 MB streaming chunks

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)


# ── Firebase init ───────────────────────────────────────────────────────────────
def init_firebase() -> storage.bucket:
    """
    Initialise firebase-admin using Application Default Credentials
    (service account key pointed to by GOOGLE_APPLICATION_CREDENTIALS)
    or the key file at SERVICE_ACCOUNT_KEY env var.

    Returns the GCS bucket object.
    """
    bucket_name = os.environ.get("FIREBASE_BUCKET")
    if not bucket_name:
        raise EnvironmentError(
            "FIREBASE_BUCKET environment variable is not set.\n"
            "Set it to your bucket name, e.g. 'my-project.appspot.com'."
        )

    key_path = os.environ.get("SERVICE_ACCOUNT_KEY")
    if key_path and Path(key_path).exists():
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred, {"storageBucket": bucket_name})
    else:
        # Falls back to Application Default Credentials (ADC / GOOGLE_APPLICATION_CREDENTIALS)
        firebase_admin.initialize_app(options={"storageBucket": bucket_name})

    log.info("Firebase initialised — bucket: gs://%s", bucket_name)
    return storage.bucket()


# ── Scraping ────────────────────────────────────────────────────────────────────
def scrape_sectional_links(page_url: str) -> list[dict]:
    """
    Fetch the FAA VFR page and return a list of dicts:
        { 'name': str, 'url': str }
    for every Sectional GeoTIFF ZIP found on the page.
    """
    log.info("Fetching FAA VFR product page: %s", page_url)
    try:
        resp = requests.get(page_url, timeout=30, headers={"User-Agent": "SkyView/1.0"})
        resp.raise_for_status()
    except requests.RequestException as exc:
        log.error("Failed to fetch FAA page: %s", exc)
        raise

    soup = BeautifulSoup(resp.text, "html.parser")
    links = []

    for anchor in soup.find_all("a", href=True):
        href: str = anchor["href"]
        text: str = anchor.get_text(strip=True)

        # We want links whose visible text mentions "Sectional" + "GeoTIFF"
        # and whose href ends in .zip (case-insensitive)
        if SECTIONAL_PATTERN.search(text) and href.lower().endswith(".zip"):
            # Make absolute URL if relative
            if href.startswith("http"):
                full_url = href
            else:
                from urllib.parse import urljoin
                full_url = urljoin(page_url, href)

            # Derive a clean chart name from the filename, e.g.
            # "Atlanta_SEC_GeoTIFF.zip" → "Atlanta_SEC_GeoTIFF"
            filename = Path(href).stem
            links.append({"name": filename, "url": full_url})

    if not links:
        log.warning(
            "No Sectional GeoTIFF ZIP links found — "
            "the FAA page layout may have changed. Check %s",
            page_url,
        )
    else:
        log.info("Found %d sectional chart ZIP(s)", len(links))

    return links


# ── Download ────────────────────────────────────────────────────────────────────
def download_file(url: str, dest_path: Path) -> None:
    """Stream-download *url* to *dest_path*, showing progress."""
    log.info("Downloading %s → %s", url, dest_path.name)
    try:
        with requests.get(url, stream=True, timeout=DOWNLOAD_TIMEOUT,
                          headers={"User-Agent": "SkyView/1.0"}) as resp:
            resp.raise_for_status()
            total = int(resp.headers.get("content-length", 0))
            downloaded = 0
            with open(dest_path, "wb") as fh:
                for chunk in resp.iter_content(chunk_size=CHUNK_SIZE):
                    fh.write(chunk)
                    downloaded += len(chunk)
                    if total:
                        pct = downloaded / total * 100
                        print(f"\r  {pct:5.1f}%  ({downloaded // 1_048_576} / {total // 1_048_576} MB)",
                              end="", flush=True)
        print()  # newline after progress
        log.info("Download complete — %s (%.1f MB)", dest_path.name, dest_path.stat().st_size / 1_048_576)
    except requests.RequestException as exc:
        dest_path.unlink(missing_ok=True)
        raise RuntimeError(f"Download failed for {url}: {exc}") from exc


# ── Extract ─────────────────────────────────────────────────────────────────────
def extract_tifs(zip_path: Path, extract_dir: Path) -> list[Path]:
    """
    Extract all .tif / .tiff files from *zip_path* into *extract_dir*.
    Returns a list of extracted file paths.
    """
    log.info("Extracting %s", zip_path.name)
    tif_paths: list[Path] = []
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            members = [m for m in zf.namelist()
                       if m.lower().endswith((".tif", ".tiff"))]
            if not members:
                log.warning("No .tif files found inside %s", zip_path.name)
                return []
            for member in members:
                zf.extract(member, extract_dir)
                tif_paths.append(extract_dir / member)
                log.info("  Extracted: %s", member)
    except zipfile.BadZipFile as exc:
        raise RuntimeError(f"Bad ZIP file {zip_path}: {exc}") from exc

    return tif_paths


# ── Upload ───────────────────────────────────────────────────────────────────────
def upload_tif(bucket, local_path: Path, storage_folder: str) -> str:
    """
    Upload *local_path* to *bucket* under *storage_folder*.
    Returns the public-ish GCS URI (gs://…).
    """
    blob_name = f"{storage_folder}/{local_path.name}"
    blob = bucket.blob(blob_name)

    log.info("Uploading %s → gs://%s/%s", local_path.name, bucket.name, blob_name)
    try:
        blob.upload_from_filename(str(local_path), content_type="image/tiff",
                                  timeout=300)
    except Exception as exc:
        raise RuntimeError(f"Upload failed for {local_path.name}: {exc}") from exc

    gcs_uri = f"gs://{bucket.name}/{blob_name}"
    log.info("Upload complete: %s", gcs_uri)
    return gcs_uri


# ── Cleanup ──────────────────────────────────────────────────────────────────────
def cleanup(paths: list[Path]) -> None:
    """Delete each path in *paths* (silently ignores missing files)."""
    for p in paths:
        try:
            p.unlink(missing_ok=True)
            log.debug("Deleted: %s", p)
        except OSError as exc:
            log.warning("Could not delete %s: %s", p, exc)


# ── Main ─────────────────────────────────────────────────────────────────────────
def main() -> None:
    bucket = init_firebase()
    chart_links = scrape_sectional_links(FAA_VFR_URL)

    if not chart_links:
        log.error("No charts to process — exiting.")
        sys.exit(1)

    successes, failures = 0, 0

    with tempfile.TemporaryDirectory(prefix="faa_charts_") as tmp_dir:
        tmp = Path(tmp_dir)

        for chart in chart_links:
            chart_name: str = chart["name"]
            chart_url: str = chart["url"]
            zip_path = tmp / f"{chart_name}.zip"
            to_cleanup: list[Path] = [zip_path]

            log.info("── Processing: %s ──", chart_name)
            try:
                # 1. Download
                download_file(chart_url, zip_path)

                # 2. Extract
                tif_files = extract_tifs(zip_path, tmp)
                to_cleanup.extend(tif_files)

                if not tif_files:
                    log.warning("Skipping %s — no TIF files extracted.", chart_name)
                    failures += 1
                    cleanup(to_cleanup)
                    continue

                # 3. Upload each TIF
                for tif in tif_files:
                    upload_tif(bucket, tif, STORAGE_FOLDER)

                successes += 1

            except Exception as exc:  # noqa: BLE001
                log.error("Error processing %s: %s", chart_name, exc)
                failures += 1
            finally:
                # 4. Clean up local files regardless of success/failure
                cleanup(to_cleanup)

            # Brief pause between charts to be polite to the FAA server
            time.sleep(1)

    log.info("Done — %d succeeded, %d failed.", successes, failures)
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
