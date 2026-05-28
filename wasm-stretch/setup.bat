@echo off
:: Fetch SoundTouch C++ library source code from the official Codeberg repository

SET SRC_DIR=soundtouch-src

if exist %SRC_DIR% (
    echo SoundTouch source code directory (%SRC_DIR%) already exists. Skipping download.
) else (
    echo Cloning stable SoundTouch library from Codeberg...
    git clone --depth 1 https://codeberg.org/soundtouch/soundtouch.git %SRC_DIR%
    echo SoundTouch source successfully downloaded.
)
