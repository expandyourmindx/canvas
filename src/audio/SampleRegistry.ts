/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SampleRegistry manages the decoding, caching, and retrieval of AudioBuffers with LRU eviction.
 * Decoupled from AudioEngine.ts as part of Phase 1 Refactoring.
 */
export class SampleRegistry {
  private audioContext: AudioContext;
  private sampleBuffers: Map<string, AudioBuffer> = new Map();
  private accessOrder: string[] = [];
  private readonly maxCacheSize: number;

  constructor(audioContext: AudioContext, maxCacheSize: number = 150) {
    this.audioContext = audioContext;
    this.maxCacheSize = maxCacheSize;
  }

  public async loadSample(id: string, arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    // Return cached buffer if already loaded — move to front of access order
    const existing = this.sampleBuffers.get(id);
    if (existing) {
      this.touchAccessOrder(id);
      return existing;
    }

    try {
      const decodedData = await this.audioContext.decodeAudioData(arrayBuffer);
      this.sampleBuffers.set(id, decodedData);
      this.accessOrder.push(id);
      this.evictIfNeeded();
      return decodedData;
    } catch (error) {
      console.error(`Error decoding audio sample for ID: ${id}`, error);
      throw error;
    }
  }

  public getSampleBuffer(id: string): AudioBuffer | undefined {
    const buffer = this.sampleBuffers.get(id);
    if (buffer) {
      this.touchAccessOrder(id);
    }
    return buffer;
  }

  public getLoadedSampleIds(): string[] {
    return Array.from(this.sampleBuffers.keys());
  }

  /**
   * Directly register a pre-decoded AudioBuffer into the cache.
   * Used by the stretch worker pipeline to store processed buffers
   * without going through decodeAudioData.
   */
  public setSampleBuffer(id: string, buffer: AudioBuffer): void {
    this.sampleBuffers.set(id, buffer);
    this.touchAccessOrder(id);
    this.evictIfNeeded();
  }

  public removeSample(id: string): void {
    this.sampleBuffers.delete(id);
    this.accessOrder = this.accessOrder.filter(k => k !== id);
  }

  public clearAll(): void {
    this.sampleBuffers.clear();
    this.accessOrder = [];
  }

  private touchAccessOrder(id: string): void {
    this.accessOrder = this.accessOrder.filter(k => k !== id);
    this.accessOrder.push(id);
  }

  private evictIfNeeded(): void {
    while (this.sampleBuffers.size > this.maxCacheSize) {
      const oldest = this.accessOrder.shift();
      if (oldest) {
        this.sampleBuffers.delete(oldest);
      }
    }
  }
}

