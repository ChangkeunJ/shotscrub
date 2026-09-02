#!/usr/bin/env bash
# Put tesseract's worker, core and English data where the page can serve them.
# They are not committed: 14 MB of wasm that npm already has a copy of.
set -euo pipefail
cd "$(dirname "$0")/.."
d=web/public/tess
[ -f "$d/eng.traineddata.gz" ] && exit 0
mkdir -p "$d"
cp node_modules/tesseract.js/dist/worker.min.js "$d/"
cp node_modules/tesseract.js-core/*-lstm.wasm.js "$d/"
curl -sSfL -o "$d/eng.traineddata.gz" https://tessdata.projectnaptha.com/4.0.0_fast/eng.traineddata.gz
