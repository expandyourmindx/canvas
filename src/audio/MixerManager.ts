import { MixerInsert, EQBandSettings, ParametricEQSettings, ReverbSettings } from "../types";
import { ParametricEQ } from "./effects/ParametricEQ";
import { Reverb } from "./effects/Reverb";
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
    // Default 100 volume corresponds to 1.0 gain
    gainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);

    const inputGainNode = this.audioContext.createGain();
    inputGainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);

    const inputNode = this.audioContext.createGain();

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
        analyserNode.connect(masterInsert.inputNode || masterInsert.gainNode);
      }
    }

    const insert: MixerInsert = {
      index,
      name,
      volume: 100,
      pan: 0,
      isMuted: false,
      isSoloed: false,
      gainNode,
      inputNode: inputGainNode,
      inputGainNode,
      inputGain: 1.0,
      pannerNode,
      analyserNode,
      fxSlots: Array(8).fill(""),
      fxBypass: Array(8).fill(false),
      eqSettings: {}
    };

    (insert as any).fxInputNode = inputNode;
    (insert as any).fxInstances = Array(8).fill(null);

    // Connect inputGainNode to fxInputNode
    inputGainNode.connect(inputNode);

    // Connect fxInputNode to gainNode by default
    inputNode.connect(gainNode);

    return insert;
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
    const gainVal = volume <= 100 ? (volume / 100) : 1.0 + (volume - 100) / 25;
    const now = this.audioContext.currentTime;
    insert.gainNode.gain.cancelScheduledValues(now);

    if (insert.isMuted) {
      insert.gainNode.gain.setValueAtTime(0, now);
    } else {
      insert.gainNode.gain.linearRampToValueAtTime(gainVal, now + 0.01);
    }
  }

  public updateInsertInputGain(insertIndex: number, gain: number) {
    const insert = this.getOrCreateMixerInsert(insertIndex);
    insert.inputGain = gain;
    if (insert.inputGainNode) {
      const now = this.audioContext.currentTime;
      insert.inputGainNode.gain.cancelScheduledValues(now);
      insert.inputGainNode.gain.linearRampToValueAtTime(gain, now + 0.01);
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
        const gainVal = ins.volume <= 100 ? (ins.volume / 100) : 1.0 + (ins.volume - 100) / 25;
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

  public rebuildFXChain(index: number) {
    const insert = this.inserts[index];
    if (!insert) return;

    const fxInputNode = (insert as any).fxInputNode;
    const gainNode = insert.gainNode;
    if (!fxInputNode || !gainNode) return;

    // Disconnect fxInputNode
    try {
      fxInputNode.disconnect();
    } catch (e) {}

    const fxInstances = (insert as any).fxInstances || Array(8).fill(null);
    const fxBypass = insert.fxBypass || Array(8).fill(false);

    for (let i = 0; i < 8; i++) {
      const effect = fxInstances[i];
      if (effect && typeof effect.disconnect === "function") {
        try {
          effect.disconnect();
        } catch (e) {}
      }
    }

    // Reconnect chain in series
    let lastNode: AudioNode = fxInputNode;
    for (let i = 0; i < 8; i++) {
      const slotName = insert.fxSlots[i];
      const effect = fxInstances[i];
      const isBypassed = fxBypass[i];

      if (slotName && effect && !isBypassed) {
        try {
          lastNode.connect(effect.input);
          if (typeof effect.updateConnections === "function") {
            effect.updateConnections();
          }
          lastNode = effect.output;
        } catch (e) {
          console.error("Failed to connect FX slot " + i, e);
        }
      }
    }

    // Connect the end of FX chain to the fader (gainNode)
    lastNode.connect(gainNode);
  }

  public setInsertFXSlot(insertIndex: number, slotIndex: number, fxName: string) {
    const insert = this.getOrCreateMixerInsert(insertIndex);
    if (!insert) return;

    const fxInstances = (insert as any).fxInstances || Array(8).fill(null);
    const oldInstance = fxInstances[slotIndex];
    if (oldInstance && typeof oldInstance.disconnect === "function") {
      try { oldInstance.disconnect(); } catch (e) {}
    }

    insert.fxSlots[slotIndex] = fxName;

    if (fxName === "EQ") {
      const eq = new ParametricEQ(this.audioContext);
      fxInstances[slotIndex] = eq;
      if (!insert.eqSettings) insert.eqSettings = {};
      if (!insert.eqSettings[slotIndex]) {
        insert.eqSettings[slotIndex] = eq.serialize();
      } else {
        eq.deserialize(insert.eqSettings[slotIndex]);
      }
    } else if (fxName === "Reverb") {
      const reverb = new Reverb(this.audioContext);
      fxInstances[slotIndex] = reverb;
      if (!insert.reverbSettings) insert.reverbSettings = {};
      if (!insert.reverbSettings[slotIndex]) {
        insert.reverbSettings[slotIndex] = reverb.serialize();
      } else {
        reverb.deserialize(insert.reverbSettings[slotIndex]);
      }
    } else {
      fxInstances[slotIndex] = null;
    }

    (insert as any).fxInstances = fxInstances;
    this.rebuildFXChain(insertIndex);
  }

  public setInsertFXBypass(insertIndex: number, slotIndex: number, bypass: boolean) {
    const insert = this.getOrCreateMixerInsert(insertIndex);
    if (!insert) return;

    if (!insert.fxBypass) insert.fxBypass = Array(8).fill(false);
    insert.fxBypass[slotIndex] = bypass;

    this.rebuildFXChain(insertIndex);
  }

  public updateInsertEQBand(insertIndex: number, slotIndex: number, bandIndex: number, settings: Partial<EQBandSettings>) {
    const insert = this.getOrCreateMixerInsert(insertIndex);
    if (!insert) return;

    const fxInstances = (insert as any).fxInstances || [];
    const eq = fxInstances[slotIndex];
    if (eq && eq instanceof ParametricEQ) {
      eq.updateBand(bandIndex, settings);
      if (!insert.eqSettings) insert.eqSettings = {};
      insert.eqSettings[slotIndex] = eq.serialize();
    }
  }

  public updateInsertReverbParam(insertIndex: number, slotIndex: number, settings: Partial<ReverbSettings>) {
    const insert = this.getOrCreateMixerInsert(insertIndex);
    if (!insert) return;

    const fxInstances = (insert as any).fxInstances || [];
    const reverb = fxInstances[slotIndex];
    if (reverb && reverb instanceof Reverb) {
      reverb.updateParams(settings);
      if (!insert.reverbSettings) insert.reverbSettings = {};
      insert.reverbSettings[slotIndex] = reverb.serialize();
    }
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
      this.updateInsertInputGain(ins.index, ins.inputGain ?? 1.0);
      
      if (ins.fxSlots) {
        target.fxSlots = [...ins.fxSlots];
      } else {
        target.fxSlots = Array(8).fill("");
      }

      if (ins.fxBypass) {
        target.fxBypass = [...ins.fxBypass];
      } else {
        target.fxBypass = Array(8).fill(false);
      }

      if (ins.eqSettings) {
        target.eqSettings = structuredClone(ins.eqSettings);
      } else {
        target.eqSettings = {};
      }

      if (ins.reverbSettings) {
        target.reverbSettings = structuredClone(ins.reverbSettings);
      } else {
        target.reverbSettings = {};
      }

      const fxInstances = Array(8).fill(null);
      for (let i = 0; i < 8; i++) {
        const fxName = target.fxSlots[i];
        if (fxName === "EQ") {
          const eq = new ParametricEQ(this.audioContext);
          if (target.eqSettings && target.eqSettings[i]) {
            eq.deserialize(target.eqSettings[i]);
          }
          fxInstances[i] = eq;
        } else if (fxName === "Reverb") {
          const reverb = new Reverb(this.audioContext);
          if (target.reverbSettings && target.reverbSettings[i]) {
            reverb.deserialize(target.reverbSettings[i]);
          }
          fxInstances[i] = reverb;
        }
      }
      (target as any).fxInstances = fxInstances;
      this.rebuildFXChain(ins.index);
    });
    // Re-evaluate solo mapping hierarchy
    this.updateInsertSolo(0, false);
  }

  public reorderInsertFX(insertIndex: number, fromSlot: number, toSlot: number) {
    const insert = this.getOrCreateMixerInsert(insertIndex);
    if (!insert) return;

    // Swap fxSlots
    const tempSlot = insert.fxSlots[fromSlot];
    insert.fxSlots[fromSlot] = insert.fxSlots[toSlot];
    insert.fxSlots[toSlot] = tempSlot;

    // Swap fxBypass
    if (!insert.fxBypass) insert.fxBypass = Array(8).fill(false);
    const tempBypass = insert.fxBypass[fromSlot];
    insert.fxBypass[fromSlot] = insert.fxBypass[toSlot];
    insert.fxBypass[toSlot] = tempBypass;

    // Swap fxInstances
    const fxInstances = (insert as any).fxInstances || Array(8).fill(null);
    const tempInstance = fxInstances[fromSlot];
    fxInstances[fromSlot] = fxInstances[toSlot];
    fxInstances[toSlot] = tempInstance;
    (insert as any).fxInstances = fxInstances;

    // Swap eqSettings
    if (!insert.eqSettings) insert.eqSettings = {};
    const tempEq = insert.eqSettings[fromSlot];
    if (insert.eqSettings[toSlot] !== undefined) {
      insert.eqSettings[fromSlot] = insert.eqSettings[toSlot];
    } else {
      delete insert.eqSettings[fromSlot];
    }
    if (tempEq !== undefined) {
      insert.eqSettings[toSlot] = tempEq;
    } else {
      delete insert.eqSettings[toSlot];
    }

    // Swap reverbSettings
    if (!insert.reverbSettings) insert.reverbSettings = {};
    const tempReverb = insert.reverbSettings[fromSlot];
    if (insert.reverbSettings[toSlot] !== undefined) {
      insert.reverbSettings[fromSlot] = insert.reverbSettings[toSlot];
    } else {
      delete insert.reverbSettings[fromSlot];
    }
    if (tempReverb !== undefined) {
      insert.reverbSettings[toSlot] = tempReverb;
    } else {
      delete insert.reverbSettings[toSlot];
    }

    // Rebuild fx chain
    this.rebuildFXChain(insertIndex);
  }
}
