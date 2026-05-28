# SoundTouch WebAssembly Build Environment

This directory houses an isolated C++ to WebAssembly compilation configuration for the open-source **SoundTouch** audio processing library.

SoundTouch enables high-quality, independent manipulation of **tempo (time-stretching)** and **pitch (transposition)**. WebAssembly allows this heavy digital signal processing (DSP) math to run at native speeds directly in the browser.

---

## Folder Structure

* `soundtouch-src/` — Stable, lightweight C++ source code fetched from the official Codeberg repository.
* `SoundTouchGlue.cpp` — Simple, high-performance C-style API wrappers exposed for JavaScript binding.
* `setup.sh` / `setup.bat` — Automates fetching the clean library source code.
* `build-wasm.sh` / `build-wasm.bat` — Compiles the C++ files into optimized WASM and JavaScript glue modules.
* `soundtouch.js` / `soundtouch.wasm` — **[Target Outputs]** Compiled JS glue and WASM binary module.

---

## Setup & Compilation Steps

### Step 1: Fetch SoundTouch Source Code
If `soundtouch-src/` is missing, you can download the library source code by running the appropriate setup file in your terminal:
- **Bash / Linux / macOS / WSL**:
  ```bash
  ./setup.sh
  ```
- **Windows Command Prompt**:
  ```cmd
  setup.bat
  ```

### Step 2: Install and Activate Emscripten (emsdk)
Emscripten compiles C++ source code into WebAssembly. If you do not have Emscripten installed:
1. Clone the Emscripten SDK repository:
   ```bash
   git clone https://github.com/emscripten-core/emsdk.git
   cd emsdk
   ```
2. Download and install the latest stable SDK toolchain:
   ```bash
   ./emsdk install latest
   ```
3. Activate the latest SDK:
   ```bash
   ./emsdk activate latest
   ```
4. Set up your path environment variables:
   - **Linux / macOS**: `source ./emsdk_env.sh`
   - **Windows**: `emsdk_env.bat`

Verify your installation by running:
```bash
emcc -v
```

### Step 3: Compile to WebAssembly
With `emcc` active in your path, run the build script in this directory:
- **Bash / Linux / macOS / WSL**:
  ```bash
  chmod +x build-wasm.sh
  ./build-wasm.sh
  ```
- **Windows Command Prompt**:
  ```cmd
  build-wasm.bat
  ```

---

## Exposed JavaScript & WebAssembly APIs

The wrapper compiles with `-O3` maximum optimizations, allows dynamic heap expansion (`ALLOW_MEMORY_GROWTH=1`), and forces float32 precision to match the Web Audio API natively.

Exposed C functions in `SoundTouchGlue.cpp` can be mapped in JavaScript via `Module.cwrap` or `Module.ccall`:

### 1. Lifecycle & Config
* `soundtouch_create()` — Instantiates `soundtouch::SoundTouch` and returns a numeric pointer handle.
* `soundtouch_destroy(handle)` — Deletes the C++ instance to prevent memory leaks.
* `soundtouch_set_sample_rate(handle, sampleRate)` — Set sample rate (e.g., `44100`, `48000`).
* `soundtouch_set_channels(handle, channels)` — Set channel count (`1` = mono, `2` = stereo).

### 2. DSP Control Parameters
* `soundtouch_set_tempo(handle, tempo)` — Set tempo/stretch speed factor (`1.0` = normal, `0.5` = half speed, `2.0` = double speed).
* `soundtouch_set_pitch_semi_tones(handle, pitch)` — Set pitch transposition in semitones (e.g. `-12.0` to `+12.0`, supports decimals/cents).

### 3. Audio Streaming I/O
* `soundtouch_put_samples(handle, floatBufferPtr, numFrames)` — Push float32 PCM frames into the processing buffer. Interleaved multi-channel audio is expected (e.g., `L R L R ...`).
* `soundtouch_receive_samples(handle, outputFloatBufferPtr, maxFrames)` — Retrieve stretched/pitched PCM data. Returns the number of frames written.
* `soundtouch_flush(handle)` — Forces the internal pipeline to process and output any remaining cached samples.
* `soundtouch_clear(handle)` — Instantly empties the queue.

---

## Example Usage in JavaScript

```javascript
// Initialize WebAssembly Glue
const SoundTouchWASM = {
  create: Module.cwrap('soundtouch_create', 'number', []),
  destroy: Module.cwrap('soundtouch_destroy', 'void', ['number']),
  setSampleRate: Module.cwrap('soundtouch_set_sample_rate', 'void', ['number', 'number']),
  setChannels: Module.cwrap('soundtouch_set_channels', 'void', ['number', 'number']),
  setTempo: Module.cwrap('soundtouch_set_tempo', 'void', ['number', 'number']),
  setPitch: Module.cwrap('soundtouch_set_pitch_semi_tones', 'void', ['number', 'number']),
  putSamples: Module.cwrap('soundtouch_put_samples', 'void', ['number', 'number', 'number']),
  receiveSamples: Module.cwrap('soundtouch_receive_samples', 'number', ['number', 'number', 'number']),
  flush: Module.cwrap('soundtouch_flush', 'void', ['number']),
  clear: Module.cwrap('soundtouch_clear', 'void', ['number'])
};

// 1. Create instance
const stHandle = SoundTouchWASM.create();
SoundTouchWASM.setSampleRate(stHandle, 44100);
SoundTouchWASM.setChannels(stHandle, 2);

// 2. Apply stretch settings
SoundTouchWASM.setTempo(stHandle, 1.25); // 25% faster
SoundTouchWASM.setPitch(stHandle, -3.00); // 3 semitones lower

// 3. Feeding samples to heap memory
// (Allocate buffer in WASM heap, copy JS PCM array, putSamples, receiveSamples)
// Complete JS wrapper audio node utility is detailed in Phase 3.
```
