/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SampleRegistry manages the decoding, caching, and retrieval of AudioBuffers.
 * Decoupled from AudioEngine.ts as part of Phase 1 Refactoring.
 */
export class SampleRegistry {
  private audioContext: AudioContext;
  private sampleBuffers: Map<string, AudioBuffer> = new Map();

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  /**
   * Decodes an ArrayBuffer of an audio file and registers it as a reusable sample buffer.
   */
  public async loadSample(id: string, arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    try {
      const decodedData = await this.audioContext.decodeAudioData(arrayBuffer);
      this.sampleBuffers.set(id, decodedData);
      return decodedData;
    } catch (error) {
      console.error(`Error decoding audio sample for ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * Retrieves loaded sample identifiers.
   */
  public getLoadedSampleIds(): string[] {
    return Array.from(this.sampleBuffers.keys());
  }

  /**
   * Retrieves specific loaded sample buffer.
   */
  public getSampleBuffer(id: string): AudioBuffer | undefined {
    return this.sampleBuffers.get(id);
  }
}
