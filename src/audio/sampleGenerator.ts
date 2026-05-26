/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Procedurally generates standard uncompressed PCM (.wav) audio format binaries in memory.
 * Emits Kicks, Snares, and Hi-hats as raw ArrayBuffers ready for registry decoding.
 */

function generateWavHeader(numSamples: number, sampleRate: number): ArrayBuffer {
  // WAV header is exactly 44 bytes
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  
  // 1-4 RIFF descriptor
  writeString(view, 0, "RIFF");
  // 5-8 Total file size - 8 bytes
  view.setUint32(4, 36 + numSamples * 2, true);
  // 9-12 WAVE signature
  writeString(view, 8, "WAVE");
  // 13-16 Format chunk description header
  writeString(view, 12, "fmt ");
  // 17-20 Format header chunk size
  view.setUint32(16, 16, true);
  // 21-22 Audio format (1 = PCM)
  view.setUint16(20, 1, true);
  // 23-24 Channels (1 = Mono)
  view.setUint16(22, 1, true);
  // 25-28 Hardware Sample Rate
  view.setUint32(24, sampleRate, true);
  // 29-32 Byte rate (SampleRate * blockAlign)
  view.setUint32(28, sampleRate * 2, true);
  // 33-34 Block align
  view.setUint16(32, 2, true);
  // 35-36 Bits per sample (16 bit depth)
  view.setUint16(34, 16, true);
  // 37-40 Data payload identifier
  writeString(view, 36, "data");
  // 41-44 Data sub-chunk bytes length
  view.setUint32(40, numSamples * 2, true);
  
  return buffer;
}

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

export function generateDrumSampleWav(type: "kick" | "snare" | "hihat"): ArrayBuffer {
  const sampleRate = 44100;
  let duration = 0.35; // Kick duration in seconds
  if (type === "hihat") duration = 0.07;
  if (type === "snare") duration = 0.25;
  
  const numSamples = Math.floor(sampleRate * duration);
  const mainBuffer = generateWavHeader(numSamples, sampleRate);
  const view = new DataView(mainBuffer);
  
  const maxAmplitude = 32760; // Comfortably within 16-bit signed limit (32767)
  const dataOffset = 44;      // Skip WAV header payload

  // Highpass filter state memory for snares and hihats
  let prevNoise = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let value = 0;

    if (type === "kick") {
      // 1. Extreme initial pitch sweep drop for the hard knock click (200Hz -> 52Hz)
      const pitchEnv = 200 * Math.exp(-t * 60) + 52;
      const phase = 2 * Math.PI * pitchEnv * t;
      
      // 2. Beater skin click transient (very fast sine burst at 1.5kHz)
      const clickFreq = 1500;
      const clickPhase = 2 * Math.PI * clickFreq * t;
      const clickEnv = Math.exp(-t * 350) * 0.18;
      const click = Math.sin(clickPhase) * clickEnv;

      // 3. Sub-oscillator kick body
      const body = Math.sin(phase);

      // 4. Amplitude Envelope: 2ms smooth fade-in to prevent digital pop + fat exponential decay
      const attackEnv = Math.min(1.0, t / 0.002);
      const decayEnv = Math.exp(-t * 7.5);
      const ampEnvelope = attackEnv * decayEnv;

      value = (body + click) * ampEnvelope;

      // 5. Tape Saturation: Add roundness, analog harmonics, and compression
      value = Math.tanh(value * 2.2) * 0.85;

    } else if (type === "snare") {
      // 1. Mid-frequency tone burst representing the snare shell crack
      const tonePitch = 180 + 220 * Math.exp(-t * 80);
      const tonePhase = 2 * Math.PI * tonePitch * t;
      const toneEnv = Math.exp(-t * 40) * 0.35;
      const tone = Math.sin(tonePhase) * toneEnv;

      // 2. High-frequency crisp wire rattle noise
      const rawNoise = Math.random() * 2.0 - 1.0;
      // 1-pole high-pass difference filter to clean up low/mid rumble
      const hpNoise = rawNoise - prevNoise;
      prevNoise = rawNoise;

      const noiseEnv = Math.exp(-t * 15.0) * 0.55;
      const snareNoise = hpNoise * noiseEnv;

      value = tone + snareNoise;

      // 3. Master volume envelope with 1.5ms attack and a clean release to prevent clicking
      const releaseEnv = Math.min(1.0, (duration - t) / 0.01);
      value *= Math.min(1.0, t / 0.0015) * Math.max(0, releaseEnv);

      // 4. Boost and clip fatter snare harmonics
      value = Math.tanh(value * 1.8) * 0.8;

    } else if (type === "hihat") {
      // 1. Dual metallic ring oscillators mixed with white noise
      const rawNoise = Math.random() * 2.0 - 1.0;
      const hpNoise = rawNoise - prevNoise;
      prevNoise = rawNoise;

      const metallicRing = Math.sin(2 * Math.PI * 9500 * t) * 0.15 + Math.sin(2 * Math.PI * 13000 * t) * 0.1;
      value = (hpNoise * 0.8 + metallicRing) * 0.7;

      // 2. Ultra-tight decay volume envelope to create a clean modern trap tick
      const ampEnvelope = Math.min(1.0, t / 0.001) * Math.exp(-t * 90);
      value *= ampEnvelope;

      // 3. Peak limiting
      value = Math.tanh(value * 1.5) * 0.9;
    }

    // Convert floating point audio waveform to signed 16-bit PCM buffer integers
    const clampedFloatValue = Math.max(-1.0, Math.min(1.0, value));
    const pcmSample = clampedFloatValue * maxAmplitude;
    view.setInt16(dataOffset + i * 2, pcmSample, true);
  }

  return mainBuffer;
}
