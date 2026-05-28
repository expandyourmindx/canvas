#!/bin/bash
# Fetch SoundTouch C++ library source code from the official Codeberg repository

set -e

# Target directory
SRC_DIR="soundtouch-src"

if [ -d "$SRC_DIR" ]; then
    echo "SoundTouch source code directory ($SRC_DIR) already exists. Skipping download."
else
    echo "Cloning stable SoundTouch library from Codeberg..."
    git clone --depth 1 https://codeberg.org/soundtouch/soundtouch.git "$SRC_DIR"
    echo "SoundTouch source successfully downloaded."
fi
