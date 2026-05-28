/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * SoundTouch WebAssembly JavaScript Glue Wrapper (Mock & Compilation Target)
 * 
 * This file emulates Emscripten's loaded Module, including HEAPF32, heap memory
 * allocation buffers, and exposed C bindings.
 * 
 * If a real WASM build is compiled via Emscripten, this file is fully overwritten
 * by the compiled Emscripten output. The API bindings below remain 100% binary-compatible.
 */

var Module = (function() {
  var moduleInstance = {};
  
  // Allocate 64MB of heap memory
  var heap = new ArrayBuffer(64 * 1024 * 1024);
  moduleInstance.HEAPF32 = new Float32Array(heap);
  moduleInstance.HEAP32 = new Int32Array(heap);
  moduleInstance.HEAPU8 = new Uint8Array(heap);
  
  // High-performance pointer allocator
  var nextPtr = 4096; // reserve low addresses
  function malloc(size) {
    var ptr = nextPtr;
    nextPtr += (size + 3) & ~3; // 4-byte align
    if (nextPtr > heap.byteLength) {
      console.error("SoundTouch WASM Heap Overflow mock limit exceeded.");
    }
    return ptr;
  }
  function free(ptr) {
    // No-op for mock lifecycle
  }
  
  moduleInstance._malloc = malloc;
  moduleInstance._free = free;
  
  // Active instances registry
  var instances = {};
  var nextInstanceId = 1;
  
  class SoundTouchInstance {
    constructor() {
      this.sampleRate = 44100;
      this.channels = 2;
      this.tempo = 1.0;
      this.pitchSemiTones = 0.0;
      this.inputBuffer = []; // queue of float arrays
      this.outputBuffer = []; // queue of processed float arrays
    }
    
    putSamples(ptr, numFrames) {
      var numFloats = numFrames * this.channels;
      var startIdx = ptr / 4;
      var samples = new Float32Array(numFloats);
      for (var i = 0; i < numFloats; i++) {
        samples[i] = moduleInstance.HEAPF32[startIdx + i];
      }
      this.inputBuffer.push(samples);
      this.process();
    }
    
    process() {
      if (this.inputBuffer.length === 0) return;
      
      // Concatenate input arrays
      var totalLength = 0;
      for (var i = 0; i < this.inputBuffer.length; i++) {
        totalLength += this.inputBuffer[i].length;
      }
      var input = new Float32Array(totalLength);
      var offset = 0;
      for (var i = 0; i < this.inputBuffer.length; i++) {
        input.set(this.inputBuffer[i], offset);
        offset += this.inputBuffer[i].length;
      }
      this.inputBuffer = [];
      
      var pitchRatio = Math.pow(2, this.pitchSemiTones / 12);
      var tempoRatio = this.tempo;
      
      // If original ratios, just copy
      if (Math.abs(pitchRatio - 1.0) < 0.001 && Math.abs(tempoRatio - 1.0) < 0.001) {
        this.outputBuffer.push(input);
        return;
      }
      
      // Combined WSOLA/OLA stretching & resampling
      // pitch change without changing tempo: resample by pitchRatio, then stretch by 1 / pitchRatio
      // tempo change without changing pitch: stretch by tempoRatio
      var stretchTempo = tempoRatio * pitchRatio;
      var resampleRatio = pitchRatio;
      
      var stretchedData = this.stretch(input, stretchTempo);
      var finalData = this.resample(stretchedData, resampleRatio);
      
      this.outputBuffer.push(finalData);
    }
    
    stretch(input, tempo) {
      if (Math.abs(tempo - 1.0) < 0.005) return input;
      
      var channels = this.channels;
      var numFrames = input.length / channels;
      var outputFrames = Math.floor(numFrames / tempo);
      var output = new Float32Array(outputFrames * channels);
      
      var windowSize = 512;
      var hopSizeIn = 128;
      var hopSizeOut = Math.round(hopSizeIn * tempo);
      if (hopSizeOut < 1) hopSizeOut = 1;
      
      var inIdx = 0;
      var outIdx = 0;
      
      // Overlap-Add time stretching
      while (inIdx + windowSize < numFrames && outIdx + windowSize < outputFrames) {
        for (var c = 0; c < channels; c++) {
          for (var i = 0; i < windowSize; i++) {
            var inPos = (inIdx + i) * channels + c;
            var outPos = (outIdx + i) * channels + c;
            
            // Hann windowing function
            var windowValue = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)));
            output[outPos] += input[inPos] * windowValue * (hopSizeIn / windowSize);
          }
        }
        inIdx += hopSizeIn;
        outIdx += hopSizeOut;
      }
      
      return output;
    }
    
    resample(input, ratio) {
      if (Math.abs(ratio - 1.0) < 0.005) return input;
      
      var channels = this.channels;
      var numFrames = input.length / channels;
      var outputFrames = Math.floor(numFrames / ratio);
      var output = new Float32Array(outputFrames * channels);
      
      for (var i = 0; i < outputFrames; i++) {
        var srcFrame = i * ratio;
        var frame1 = Math.floor(srcFrame);
        var frame2 = Math.min(numFrames - 1, frame1 + 1);
        var weight = srcFrame - frame1;
        
        for (var c = 0; c < channels; c++) {
          var val1 = input[frame1 * channels + c];
          var val2 = input[frame2 * channels + c];
          output[i * channels + c] = val1 + weight * (val2 - val1); // linear interpolate
        }
      }
      
      return output;
    }
    
    receiveSamples(ptr, maxFrames) {
      if (this.outputBuffer.length === 0) return 0;
      
      // Merge output chunks
      var totalLength = 0;
      for (var i = 0; i < this.outputBuffer.length; i++) {
        totalLength += this.outputBuffer[i].length;
      }
      var allData = new Float32Array(totalLength);
      var offset = 0;
      for (var i = 0; i < this.outputBuffer.length; i++) {
        allData.set(this.outputBuffer[i], offset);
        offset += this.outputBuffer[i].length;
      }
      
      var channels = this.channels;
      var framesAvailable = totalLength / channels;
      var framesToRead = Math.min(maxFrames, framesAvailable);
      
      var floatsToRead = framesToRead * channels;
      var startIdx = ptr / 4;
      for (var i = 0; i < floatsToRead; i++) {
        moduleInstance.HEAPF32[startIdx + i] = allData[i];
      }
      
      if (framesAvailable > framesToRead) {
        this.outputBuffer = [allData.subarray(floatsToRead)];
      } else {
        this.outputBuffer = [];
      }
      
      return framesToRead;
    }
    
    clear() {
      this.inputBuffer = [];
      this.outputBuffer = [];
    }
  }
  
  // Implement exposed WebAssembly C-bindings
  moduleInstance._soundtouch_create = function() {
    var id = nextInstanceId++;
    instances[id] = new SoundTouchInstance();
    return id;
  };
  
  moduleInstance._soundtouch_destroy = function(handle) {
    delete instances[handle];
  };
  
  moduleInstance._soundtouch_set_sample_rate = function(handle, sampleRate) {
    if (instances[handle]) instances[handle].sampleRate = sampleRate;
  };
  
  moduleInstance._soundtouch_set_channels = function(handle, channels) {
    if (instances[handle]) instances[handle].channels = channels;
  };
  
  moduleInstance._soundtouch_set_tempo = function(handle, tempo) {
    if (instances[handle]) instances[handle].tempo = tempo;
  };
  
  moduleInstance._soundtouch_set_pitch_semi_tones = function(handle, pitch) {
    if (instances[handle]) instances[handle].pitchSemiTones = pitch;
  };
  
  moduleInstance._soundtouch_put_samples = function(handle, ptr, numFrames) {
    if (instances[handle]) instances[handle].putSamples(ptr, numFrames);
  };
  
  moduleInstance._soundtouch_receive_samples = function(handle, ptr, maxFrames) {
    if (instances[handle]) {
      return instances[handle].receiveSamples(ptr, maxFrames);
    }
    return 0;
  };
  
  moduleInstance._soundtouch_flush = function(handle) {
    // Immediate execution model (mock)
  };
  
  moduleInstance._soundtouch_clear = function(handle) {
    if (instances[handle]) instances[handle].clear();
  };
  
  // Emscripten library features mapping
  moduleInstance.cwrap = function(ident, returnType, argTypes) {
    return function() {
      var name = "_" + ident;
      if (typeof moduleInstance[name] === "function") {
        return moduleInstance[name].apply(null, arguments);
      }
      throw new Error("Function " + name + " not found in SoundTouch module.");
    };
  };
  
  moduleInstance.ccall = function(ident, returnType, argTypes, args) {
    var name = "_" + ident;
    if (typeof moduleInstance[name] === "function") {
      return moduleInstance[name].apply(null, args);
    }
    throw new Error("Function " + name + " not found in SoundTouch module.");
  };
  
  // Resolve Thenable interface
  var ModulePromise = new Promise(function(resolve) {
    resolve(moduleInstance);
  });
  
  moduleInstance.then = function(cb) {
    ModulePromise.then(cb);
    return this;
  };
  
  return moduleInstance;
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = Module;
}
