#!/bin/bash
# Compile SoundTouch C++ library into WebAssembly using Emscripten

set -e

# Target outputs
OUT_JS="soundtouch.js"
OUT_WASM="soundtouch.wasm"

echo "Compiling SoundTouch C++ code to WebAssembly..."

emcc -O3 -s WASM=1 \
  -s EXPORTED_RUNTIME_METHODS='["cwrap", "ccall", "getValue", "setValue"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -D SOUNDTOUCH_FLOAT_SAMPLES \
  -I./soundtouch-src/include \
  -I./soundtouch-src/source/SoundTouch \
  soundtouch-src/source/SoundTouch/AAFilter.cpp \
  soundtouch-src/source/SoundTouch/FIFOSampleBuffer.cpp \
  soundtouch-src/source/SoundTouch/FIRFilter.cpp \
  soundtouch-src/source/SoundTouch/RateTransposer.cpp \
  soundtouch-src/source/SoundTouch/SoundTouch.cpp \
  soundtouch-src/source/SoundTouch/TDStretch.cpp \
  soundtouch-src/source/SoundTouch/InterpolateLinear.cpp \
  soundtouch-src/source/SoundTouch/InterpolateCubic.cpp \
  soundtouch-src/source/SoundTouch/InterpolateShannon.cpp \
  SoundTouchGlue.cpp \
  -o "$OUT_JS"

echo "Compilation successful! Generated $OUT_JS and $OUT_WASM."
