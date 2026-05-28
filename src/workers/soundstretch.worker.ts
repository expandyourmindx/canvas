/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Declare standard worker scope and importScripts for compiler happiness
declare const self: any;
declare function importScripts(...urls: string[]): void;

// Import compiled SoundTouch Emscripten glue from public served root
importScripts("/soundtouch.js");

// Declare global Module injected by soundtouch.js
declare const Module: any;

interface SoundStretchWorkerMessage {
  audioData: Float32Array; // Interleaved Float32Array of PCM channels (L R L R ...)
  channels: number;
  pitchCents: number;
  tempoRatio: number;
  sampleRate: number;
  channelId: string;
}

let soundtouchModule: any = null;

// Initialize SoundTouch WASM Module
Module.then((loadedModule: any) => {
  soundtouchModule = loadedModule;
  console.log("SoundTouch WebAssembly module successfully loaded in Worker.");
});

self.onmessage = (e: MessageEvent<SoundStretchWorkerMessage>) => {
  const { audioData, channels, pitchCents, tempoRatio, sampleRate, channelId } = e.data;

  if (!soundtouchModule) {
    // Wait for the Module initialization promise to complete
    const checkInterval = setInterval(() => {
      if (soundtouchModule) {
        clearInterval(checkInterval);
        processAudio();
      }
    }, 10);
    return;
  }

  processAudio();

  function processAudio() {
    try {
      // 1. Map exposed Emscripten-compiled C functions
      const soundtouch_create = soundtouchModule.cwrap("soundtouch_create", "number", []);
      const soundtouch_destroy = soundtouchModule.cwrap("soundtouch_destroy", "void", ["number"]);
      const soundtouch_set_sample_rate = soundtouchModule.cwrap("soundtouch_set_sample_rate", "void", ["number", "number"]);
      const soundtouch_set_channels = soundtouchModule.cwrap("soundtouch_set_channels", "void", ["number", "number"]);
      const soundtouch_set_tempo = soundtouchModule.cwrap("soundtouch_set_tempo", "void", ["number", "number"]);
      const soundtouch_set_pitch_semi_tones = soundtouchModule.cwrap("soundtouch_set_pitch_semi_tones", "void", ["number", "number"]);
      const soundtouch_put_samples = soundtouchModule.cwrap("soundtouch_put_samples", "void", ["number", "number", "number"]);
      const soundtouch_receive_samples = soundtouchModule.cwrap("soundtouch_receive_samples", "number", ["number", "number", "number"]);
      const soundtouch_flush = soundtouchModule.cwrap("soundtouch_flush", "void", ["number"]);

      const malloc = soundtouchModule._malloc;
      const free = soundtouchModule._free;

      // 2. Instantiate SoundTouch DSP engine inside the WASM heap
      const handle = soundtouch_create();
      soundtouch_set_sample_rate(handle, sampleRate);
      soundtouch_set_channels(handle, channels);
      soundtouch_set_tempo(handle, tempoRatio);
      
      // Convert cents pitch adjustment into fractional semitones (1 semitone = 100 cents)
      const pitchSemitones = pitchCents / 100;
      soundtouch_set_pitch_semi_tones(handle, pitchSemitones);

      const numFrames = audioData.length / channels;

      // 3. Allocate Float32 PCM memory buffer inside WASM Heap
      const bytesPerSample = 4; // float32 is 4 bytes
      const inputBufferPtr = malloc(audioData.length * bytesPerSample);
      
      // Copy Float32 input PCM data into WASM memory space
      soundtouchModule.HEAPF32.set(audioData, inputBufferPtr / bytesPerSample);

      // Feed input samples into the DSP queue
      soundtouch_put_samples(handle, inputBufferPtr, numFrames);
      soundtouch_flush(handle);

      // 4. Read back processed samples in structured batches
      // Estimate maximum possible frames based on tempo ratio (adding margin of 1024)
      const maxOutFrames = Math.ceil(numFrames * Math.max(2.0, 1.1 / tempoRatio)) + 1024;
      const outputBufferPtr = malloc(maxOutFrames * channels * bytesPerSample);

      let totalFramesReceived = 0;
      const batchSize = 4096;
      const batchBufferPtr = malloc(batchSize * channels * bytesPerSample);

      while (true) {
        const framesReceived = soundtouch_receive_samples(handle, batchBufferPtr, batchSize);
        if (framesReceived === 0) break;

        const destOffset = (outputBufferPtr + totalFramesReceived * channels * bytesPerSample) / bytesPerSample;
        const srcOffset = batchBufferPtr / bytesPerSample;
        const floatsToCopy = framesReceived * channels;

        soundtouchModule.HEAPF32.copyWithin(destOffset, srcOffset, srcOffset + floatsToCopy);
        totalFramesReceived += framesReceived;
      }

      // 5. Package output data into JS-native typed array
      const processedFloats = totalFramesReceived * channels;
      const outputData = new Float32Array(processedFloats);
      const heapOffset = outputBufferPtr / bytesPerSample;
      
      outputData.set(soundtouchModule.HEAPF32.subarray(heapOffset, heapOffset + processedFloats));

      // 6. Deallocate WASM heap memory buffers and destroy SoundTouch C++ handle
      free(inputBufferPtr);
      free(outputBufferPtr);
      free(batchBufferPtr);
      soundtouch_destroy(handle);

      // 7. Post message back to the main thread with transferable array to avoid copies
      self.postMessage({
        stretchedAudio: outputData,
        channels: channels,
        totalFrames: totalFramesReceived,
        channelId: channelId
      }, [outputData.buffer]);

    } catch (err: any) {
      console.error("Web Worker DSP execution exception failure:", err);
      self.postMessage({ error: err.message });
    }
  }
};
