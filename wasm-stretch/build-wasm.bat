@echo off
:: Compile SoundTouch C++ library into WebAssembly using Emscripten on Windows Cmd
SET OUT_JS=soundtouch.js
SET OUT_WASM=soundtouch.wasm
echo Compiling SoundTouch C++ code to WebAssembly...
call emcc -O3 -s WASM=1 ^
  -s EXPORTED_RUNTIME_METHODS="['cwrap', 'ccall', 'getValue', 'setValue']" ^
  -s ALLOW_MEMORY_GROWTH=1 ^
  -D SOUNDTOUCH_FLOAT_SAMPLES ^
  -I.\soundtouch-src\include ^
  -I.\soundtouch-src\source\SoundTouch ^
  soundtouch-src\source\SoundTouch\AAFilter.cpp ^
  soundtouch-src\source\SoundTouch\FIFOSampleBuffer.cpp ^
  soundtouch-src\source\SoundTouch\FIRFilter.cpp ^
  soundtouch-src\source\SoundTouch\RateTransposer.cpp ^
  soundtouch-src\source\SoundTouch\SoundTouch.cpp ^
  soundtouch-src\source\SoundTouch\TDStretch.cpp ^
  soundtouch-src\source\SoundTouch\InterpolateLinear.cpp ^
  soundtouch-src\source\SoundTouch\InterpolateCubic.cpp ^
  soundtouch-src\source\SoundTouch\InterpolateShannon.cpp ^
  soundtouch-src\source\SoundTouch\cpu_detect_x86.cpp ^
  SoundTouchGlue.cpp ^
  -s EXPORT_ES6=1 -s MODULARIZE=1 -s EXPORT_NAME="createSoundTouchModule" ^
  -o %OUT_JS%
if %ERRORLEVEL% EQU 0 (
    echo Compilation successful! Generated %OUT_JS% and %OUT_WASM%.
    copy /Y %OUT_JS% ..\src\workers\
    copy /Y %OUT_WASM% ..\public\
) else (
    echo Compilation failed with exit code %ERRORLEVEL%.
)