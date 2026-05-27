import { MixerInsert } from "../types";
export type { MixerInsert };

/**
 * MixerManager encapsulates the state, node tree routing, volume/pan faders,
 * mute/solo hierarchies, and real-time peak/RMS calculations of all inserts.
 * Decoupled from AudioEngine.ts as part of Phase 2 Refactoring.
 */
export class MixerManager {
  private audioContext: AudioContext;
  private masterGainNode: GainNode;
  private inserts: MixerInsert[] = [];

  constructor(audioContext: AudioContext, masterGainNode: GainNode) {
    this.audioContext = audioContext;
    this.masterGainNode = masterGainNode;
    this.initializeMixer();
  }

  /**
   * Mixer Console Configuration & Routing Tree
   */
  private initializeMixer() {
    this.inserts = [];
    // Ensure index 0 (Master) is created first
    this.inserts[0] = this.createMixerInsertNodeChain(0);
    // Create track inserts 1 to 15
    for (let i = 1; i <= 15; i++) {
      this.inserts[i] = this.createMixerInsertNodeChain(i);
    }
  }

  private createMixerInsertNodeChain(index: number): MixerInsert {
    const name = index === 0 ? "Master" : `Insert ${index}`;
    const gainNode = this.audioContext.createGain();
    // Default 80 volume corresponds to 0.8 gain
    gainNode.gain.setValueAtTime(0.8, this.audioContext.currentTime);

    const pannerNode = this.audioContext.createStereoPanner ? this.audioContext.createStereoPanner() : null;
    const analyserNode = this.audioContext.createAnalyser();
    analyserNode.fftSize = 1024;

    if (pannerNode) {
      gainNode.connect(pannerNode);
      pannerNode.connect(analyserNode);
    } else {
      gainNode.connect(analyserNode);
    }

    if (index === 0) {
      // Direct connection of Master Insert output to the Global Transport Gate node
      analyserNode.connect(this.masterGainNode);
    } else {
      const masterInsert = this.inserts[0];
      if (masterInsert) {
        analyserNode.connect(masterInsert.gainNode);
      }
    }

    return {
      index,
      name,
      volume: 80,
      pan: 0,
      isMuted: false,
      isSoloed: false,
      gainNode,
      pannerNode,
      analyserNode,
      fxSlots: Array(8).fill("")
    };
  }

  public getOrCreateMixerInsert(index: number): MixerInsert {
    if (!this.inserts[index]) {
      // Fill intermediate inserts if we skip ahead
      for (let i = 0; i <= index; i++) {
        if (!this.inserts[i]) {
          this.inserts[i] = this.createMixerInsertNodeChain(i);
        }
      }
    }
    return this.inserts[index];
  }

  public renameInsert(index: number, newName: string) {
    const insert = this.getOrCreateMixerInsert(index);
    insert.name = newName;
  }

  public getInserts(): MixerInsert[] {
    return this.inserts;
  }

  public updateInsertVolume(index: number, volume: number) {
    const insert = this.getOrCreateMixerInsert(index);
    insert.volume = volume;
    const gainVal = (volume / 80) * 0.8;
    const now = this.audioContext.currentTime;
    insert.gainNode.gain.cancelScheduledValues(now);

    if (insert.isMuted) {
      insert.gainNode.gain.setValueAtTime(0, now);
    } else {
      insert.gainNode.gain.linearRampToValueAtTime(gainVal, now + 0.01);
    }
  }

  public updateInsertPan(index: number, pan: number) {
    const insert = this.getOrCreateMixerInsert(index);
    insert.pan = pan;
    if (insert.pannerNode) {
      const now = this.audioContext.currentTime;
      insert.pannerNode.pan.cancelScheduledValues(now);
      insert.pannerNode.pan.linearRampToValueAtTime(pan / 50, now + 0.01);
    }
  }

  public updateInsertMute(index: number, isMuted: boolean) {
    const insert = this.getOrCreateMixerInsert(index);
    insert.isMuted = isMuted;
    this.updateInsertVolume(index, insert.volume);
  }

  public updateInsertSolo(index: number, isSoloed: boolean) {
    const insert = this.getOrCreateMixerInsert(index);
    insert.isSoloed = isSoloed;

    // Solo mapping hierarchy
    const anySoloed = this.inserts.some(ins => ins.index > 0 && ins.isSoloed);

    for (let i = 1; i < this.inserts.length; i++) {
      const ins = this.inserts[i];
      const now = this.audioContext.currentTime;
      ins.gainNode.gain.cancelScheduledValues(now);

      const isMutedBySolo = anySoloed && !ins.isSoloed;
      if (ins.isMuted || isMutedBySolo) {
        ins.gainNode.gain.setValueAtTime(0, now);
      } else {
        const gainVal = (ins.volume / 80) * 0.8;
        ins.gainNode.gain.linearRampToValueAtTime(gainVal, now + 0.01);
      }
    }
  }

  public getInsertLevels(index: number): { rms: number; peak: number } {
    const insert = this.getOrCreateMixerInsert(index);
    const analyser = insert.analyserNode;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(dataArray);

    let sum = 0;
    let peak = 0;
    for (let i = 0; i < bufferLength; i++) {
      const val = dataArray[i];
      sum += val * val;
      const absVal = Math.abs(val);
      if (absVal > peak) {
        peak = absVal;
      }
    }
    const rms = Math.sqrt(sum / bufferLength);
    return { rms, peak };
  }

  public restoreMixerInserts(inserts: MixerInsert[]): void {
    if (!inserts) return;
    inserts.forEach((ins) => {
      const target = this.getOrCreateMixerInsert(ins.index);
      target.name = ins.name;
      target.isMuted = ins.isMuted;
      target.isSoloed = ins.isSoloed;
      this.updateInsertVolume(ins.index, ins.volume);
      this.updateInsertPan(ins.index, ins.pan);
      if (ins.fxSlots) {
        target.fxSlots = [...ins.fxSlots];
      }
    });
    // Re-evaluate solo mapping hierarchy
    this.updateInsertSolo(0, false);
  }
}
