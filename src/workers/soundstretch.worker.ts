/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// @ts-ignore
import { SoundTouch, SimpleFilter } from 'soundtouchjs';

declare const self: any;

interface SoundStretchWorkerMessage {
  audioData: Float32Array; // Flat interleaved Float32Array of input PCM
  channels: number;
  pitchCents: number;
  tempoRatio: number;
  sampleRate: number;
  channelId: string;
}

class ArraySource {
  private data: Float32Array;
  private numFrames: number;

  constructor(data: Float32Array) {
    this.data = data;
    this.numFrames = data.length / 2;
  }

  extract(target: Float32Array, numFrames: number, position: number): number {
    const sourceOffset = position * 2;
    const framesExtracted = Math.min(numFrames, this.numFrames - position);
    const samplesToCopy = framesExtracted * 2;
    target.set(this.data.subarray(sourceOffset, sourceOffset + samplesToCopy));
    return framesExtracted;
  }
}

self.onmessage = (e: MessageEvent<SoundStretchWorkerMessage>) => {
  const { audioData, channels, pitchCents, tempoRatio, sampleRate, channelId } = e.data;

  try {
    const numInputFrames = audioData.length / channels;

    // soundtouch-js FifoSampleBuffer is hardcoded for stereo (2 channels).
    // If the input is mono, we upmix to stereo; if stereo, we use it directly.
    let stereoInputData: Float32Array;
    if (channels === 1) {
      stereoInputData = new Float32Array(numInputFrames * 2);
      for (let i = 0; i < numInputFrames; i++) {
        const val = audioData[i];
        stereoInputData[i * 2] = val;
        stereoInputData[i * 2 + 1] = val;
      }
    } else {
      stereoInputData = audioData;
    }

    // Calculate exact expected output frames to prevent windowing residue drift
    const expectedOutputFrames = Math.floor(numInputFrames / tempoRatio);

    // soundtouch-js has internal latency and requires extra frames at the end to flush
    // the remaining samples through the pipeline. We pad the input with trailing silence.
    const paddingFrames = 32768;
    const paddedInputData = new Float32Array(stereoInputData.length + paddingFrames * 2);
    paddedInputData.set(stereoInputData);

    // Initialize SoundTouch
    const soundTouch = new SoundTouch();
    soundTouch.tempo = tempoRatio;
    soundTouch.pitchSemitones = pitchCents / 100;

    // Optimized parameters for musical content (reduces stuttering artifacts compared to speech defaults)
    soundTouch.sequenceMs = 40;
    soundTouch.seekWindowMs = 15;
    soundTouch.overlapMs = 8;

    // Create custom ArraySource and SimpleFilter
    const source = new ArraySource(paddedInputData);
    const filter = new SimpleFilter(source, soundTouch);

    // Extract all processed samples
    const bufferSize = 4096;
    const tempBuffer = new Float32Array(bufferSize * 2);
    const outputChunks: Float32Array[] = [];
    let totalFramesExtracted = 0;

    while (true) {
      const framesExtracted = filter.extract(tempBuffer, bufferSize);
      if (framesExtracted === 0) {
        break;
      }
      const chunk = new Float32Array(framesExtracted * 2);
      chunk.set(tempBuffer.subarray(0, framesExtracted * 2));
      outputChunks.push(chunk);
      totalFramesExtracted += framesExtracted;
    }

    // Merge chunks
    const processedStereoData = new Float32Array(totalFramesExtracted * 2);
    let offset = 0;
    for (const chunk of outputChunks) {
      processedStereoData.set(chunk, offset);
      offset += chunk.length;
    }

    // Trim the output to exactly the expected target frames
    const trimmedStereoData = processedStereoData.subarray(0, expectedOutputFrames * 2);

    // Downmix back to mono if input was mono
    let finalProcessedData: Float32Array;
    if (channels === 1) {
      finalProcessedData = new Float32Array(expectedOutputFrames);
      for (let i = 0; i < expectedOutputFrames; i++) {
        finalProcessedData[i] = trimmedStereoData[i * 2];
      }
    } else {
      finalProcessedData = trimmedStereoData;
    }

    // Diagnostic logging
    let minVal = Infinity;
    let maxVal = -Infinity;
    let hasNaN = false;
    for (let i = 0; i < finalProcessedData.length; i++) {
      const v = finalProcessedData[i];
      if (isNaN(v)) {
        hasNaN = true;
      } else {
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
    }

    const flushFrames = Math.max(0, totalFramesExtracted - expectedOutputFrames);
    const flushSamplesCollected = flushFrames * channels;

    console.log(
      `[SoundStretch Worker Diagnostic] Channel/Clip: ${channelId}\n` +
      `- Total output samples collected: ${finalProcessedData.length}\n` +
      `- Any zero-length chunks during receive loop: ${outputChunks.some(c => c.length === 0)}\n` +
      `- Final buffer Min value: ${minVal === Infinity ? 0 : minVal}\n` +
      `- Final buffer Max value: ${maxVal === -Infinity ? 0 : maxVal}\n` +
      `- Final buffer contains NaN: ${hasNaN}\n` +
      `- Flush samples collected: ${flushSamplesCollected}`
    );

    self.postMessage({
      processedData: finalProcessedData,
      channels: channels,
      totalFrames: expectedOutputFrames,
      channelId: channelId
    }, [finalProcessedData.buffer]);

  } catch (err: any) {
    console.error("Web Worker DSP execution exception failure:", err);
    self.postMessage({ error: err.message, channelId: channelId });
  }
};
