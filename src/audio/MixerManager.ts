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

  private recorderNodes: Map<number, AudioWorkletNode> = new Map();
  private micSources: Map<number, MediaStreamAudioSourceNode> = new Map();
  private monoSummers: Map<number, GainNode> = new Map();
  private micStreams: Map<number, MediaStream> = new Map();
  private recordedChunks: Map<number, Float32Array[][]> = new Map();
  private peakMins: Map<number, number[]> = new Map();
  private peakMaxs: Map<number, number[]> = new Map();

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
      eqSettings: {},
      sends: [],
      routesToMaster: true,
      sendGainNodes: new Map<number, GainNode>()
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
    try {
      lastNode.connect(gainNode);
    } catch (e) {
      console.error("Failed to connect end of FX chain to gainNode", e);
    }
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

      // Restore routesToMaster
      const routesToMaster = ins.routesToMaster !== undefined ? ins.routesToMaster : true;
      const masterInsert = this.getOrCreateMixerInsert(0);
      const masterDestination = masterInsert.inputNode || masterInsert.gainNode;
      if (target.index > 0 && target.analyserNode && masterDestination) {
        try {
          target.analyserNode.disconnect(masterDestination);
        } catch (e) {}
        if (routesToMaster) {
          try {
            target.analyserNode.connect(masterDestination);
          } catch (e) {
            console.error("Failed to connect to master during restore", e);
          }
        }
      }
      target.routesToMaster = routesToMaster;

      // Clean up existing sends
      if (target.sendGainNodes) {
        target.sendGainNodes.forEach((node) => {
          try {
            if (target.analyserNode) {
              target.analyserNode.disconnect(node);
            }
          } catch (e) {}
          try {
            node.disconnect();
          } catch (e) {}
        });
        target.sendGainNodes.clear();
      } else {
        target.sendGainNodes = new Map<number, GainNode>();
      }

      target.sends = [];
      if (ins.sends) {
        ins.sends.forEach((send) => {
          const toInsert = this.getOrCreateMixerInsert(send.targetInsertIndex);
          const sendGainNode = this.audioContext.createGain();
          sendGainNode.gain.setValueAtTime(send.sendGain, this.audioContext.currentTime);

          if (target.analyserNode && toInsert.inputNode) {
            try {
              target.analyserNode.connect(sendGainNode);
              sendGainNode.connect(toInsert.inputNode);
            } catch (e) {
              console.error("Failed to connect send during restore", e);
            }
          }
          target.sends.push({ targetInsertIndex: send.targetInsertIndex, sendGain: send.sendGain });
          target.sendGainNodes!.set(send.targetInsertIndex, sendGainNode);
        });
      }
    });
    // Re-evaluate solo mapping hierarchy
    this.updateInsertSolo(0, false);
  }

  public reorderInsertFX(insertIndex: number, fromSlot: number, toSlot: number) {
    const insert = this.getOrCreateMixerInsert(insertIndex);
    if (!insert) return;

    // Swap fxSlots (ensure fully populated with strings, length 8)
    const newSlots = Array(8).fill("");
    for (let i = 0; i < 8; i++) {
      if (insert.fxSlots && insert.fxSlots[i] !== undefined && insert.fxSlots[i] !== null) {
        newSlots[i] = insert.fxSlots[i];
      }
    }
    const tempSlot = newSlots[fromSlot];
    newSlots[fromSlot] = newSlots[toSlot];
    newSlots[toSlot] = tempSlot;
    insert.fxSlots = newSlots;

    // Swap fxBypass (ensure fully populated with booleans, length 8)
    const newBypass = Array(8).fill(false);
    for (let i = 0; i < 8; i++) {
      if (insert.fxBypass && insert.fxBypass[i] !== undefined && insert.fxBypass[i] !== null) {
        newBypass[i] = insert.fxBypass[i];
      }
    }
    const tempBypass = newBypass[fromSlot];
    newBypass[fromSlot] = newBypass[toSlot];
    newBypass[toSlot] = tempBypass;
    insert.fxBypass = newBypass;

    // Swap fxInstances (ensure fully populated with null/instances, length 8)
    const newInstances = Array(8).fill(null);
    const oldInstances = (insert as any).fxInstances || [];
    for (let i = 0; i < 8; i++) {
      if (oldInstances[i] !== undefined) {
        newInstances[i] = oldInstances[i];
      }
    }
    const tempInstance = newInstances[fromSlot];
    newInstances[fromSlot] = newInstances[toSlot];
    newInstances[toSlot] = tempInstance;
    (insert as any).fxInstances = newInstances;

    // Swap eqSettings
    const newEq = insert.eqSettings ? { ...insert.eqSettings } : {};
    const tempEq = newEq[fromSlot];
    if (newEq[toSlot] !== undefined) {
      newEq[fromSlot] = newEq[toSlot];
    } else {
      delete newEq[fromSlot];
    }
    if (tempEq !== undefined) {
      newEq[toSlot] = tempEq;
    } else {
      delete newEq[toSlot];
    }
    insert.eqSettings = newEq;

    // Swap reverbSettings
    const newReverb = insert.reverbSettings ? { ...insert.reverbSettings } : {};
    const tempReverb = newReverb[fromSlot];
    if (newReverb[toSlot] !== undefined) {
      newReverb[fromSlot] = newReverb[toSlot];
    } else {
      delete newReverb[fromSlot];
    }
    if (tempReverb !== undefined) {
      newReverb[toSlot] = tempReverb;
    } else {
      delete newReverb[toSlot];
    }
    insert.reverbSettings = newReverb;

    // Rebuild fx chain
    this.rebuildFXChain(insertIndex);
  }

  private wouldCreateCycle(fromIndex: number, toIndex: number): boolean {
    if (fromIndex === toIndex) return true;

    const visited = new Set<number>();
    const queue: number[] = [toIndex];
    visited.add(toIndex);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === fromIndex) {
        return true;
      }
      const insert = this.inserts[current];
      if (insert && insert.sends) {
        for (const send of insert.sends) {
          if (!visited.has(send.targetInsertIndex)) {
            visited.add(send.targetInsertIndex);
            queue.push(send.targetInsertIndex);
          }
        }
      }
    }

    return false;
  }

  public addSend(fromIndex: number, toIndex: number) {
    if (this.wouldCreateCycle(fromIndex, toIndex)) {
      return;
    }
    if (toIndex === 0) {
      throw new Error("Cannot send to master (index 0) via addSend");
    }

    const fromInsert = this.getOrCreateMixerInsert(fromIndex);
    const toInsert = this.getOrCreateMixerInsert(toIndex);

    if (!fromInsert.sends) {
      fromInsert.sends = [];
    }
    if (!fromInsert.sendGainNodes) {
      fromInsert.sendGainNodes = new Map<number, GainNode>();
    }

    // Check if send already exists
    if (fromInsert.sends.some(s => s.targetInsertIndex === toIndex)) {
      return; // Already exists
    }

    const sendGainNode = this.audioContext.createGain();
    sendGainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);

    if (fromInsert.analyserNode && toInsert.inputNode) {
      fromInsert.analyserNode.connect(sendGainNode);
      sendGainNode.connect(toInsert.inputNode);
    }

    fromInsert.sends.push({ targetInsertIndex: toIndex, sendGain: 1.0 });
    fromInsert.sendGainNodes.set(toIndex, sendGainNode);
  }

  public removeSend(fromIndex: number, toIndex: number) {
    const fromInsert = this.getOrCreateMixerInsert(fromIndex);
    if (!fromInsert.sends) {
      fromInsert.sends = [];
    }
    if (!fromInsert.sendGainNodes) {
      fromInsert.sendGainNodes = new Map<number, GainNode>();
    }

    const sendGainNode = fromInsert.sendGainNodes.get(toIndex);
    if (sendGainNode) {
      try {
        if (fromInsert.analyserNode) {
          fromInsert.analyserNode.disconnect(sendGainNode);
        }
      } catch (e) {
        console.warn("Error disconnecting analyserNode from sendGainNode", e);
      }
      try {
        sendGainNode.disconnect();
      } catch (e) {
        console.warn("Error disconnecting sendGainNode", e);
      }
      fromInsert.sendGainNodes.delete(toIndex);
    }

    fromInsert.sends = fromInsert.sends.filter(s => s.targetInsertIndex !== toIndex);
  }

  public updateSendLevel(fromIndex: number, toIndex: number, gain: number) {
    const fromInsert = this.getOrCreateMixerInsert(fromIndex);
    if (!fromInsert.sends) {
      fromInsert.sends = [];
    }
    const send = fromInsert.sends.find(s => s.targetInsertIndex === toIndex);
    if (send) {
      send.sendGain = gain;
    }

    if (fromInsert.sendGainNodes) {
      const sendGainNode = fromInsert.sendGainNodes.get(toIndex);
      if (sendGainNode) {
        const now = this.audioContext.currentTime;
        sendGainNode.gain.cancelScheduledValues(now);
        sendGainNode.gain.linearRampToValueAtTime(gain, now + 0.01);
      }
    }
  }

  public setRoutesToMaster(fromIndex: number, routesToMaster: boolean) {
    if (fromIndex === 0) return; // Master cannot route to itself

    const fromInsert = this.getOrCreateMixerInsert(fromIndex);
    const masterInsert = this.getOrCreateMixerInsert(0);
    const masterDestination = masterInsert.inputNode || masterInsert.gainNode;

    if (fromInsert.routesToMaster === routesToMaster) return;

    if (fromInsert.analyserNode && masterDestination) {
      if (!routesToMaster) {
        try {
          fromInsert.analyserNode.disconnect(masterDestination);
        } catch (e) {
          console.warn(`Failed to disconnect insert ${fromIndex} from master`, e);
        }
      } else {
        try {
          fromInsert.analyserNode.connect(masterDestination);
        } catch (e) {
          console.warn(`Failed to connect insert ${fromIndex} to master`, e);
        }
      }
    }

    fromInsert.routesToMaster = routesToMaster;
  }

  public connectMic(insertIndex: number, stream: MediaStream, audioContext: AudioContext): void {
    // Disconnect and clean up any existing mic source for this insert index first
    this.disconnectMic(insertIndex);

    const insert = this.getOrCreateMixerInsert(insertIndex);
    const source = audioContext.createMediaStreamSource(stream);
    const monoSummer = audioContext.createGain();
    monoSummer.channelCount = 1;
    monoSummer.channelCountMode = 'explicit';
    monoSummer.channelInterpretation = 'speakers';
    source.connect(monoSummer);
    monoSummer.connect(insert.inputGainNode!);
    this.monoSummers.set(insertIndex, monoSummer);

    const recorderNode = new AudioWorkletNode(audioContext, 'recorder-processor');
    insert.inputGainNode!.connect(recorderNode);
    // Do NOT connect recorderNode output anywhere — it is a tap only

    recorderNode.port.onmessage = (e) => {
      if (e.data.type !== 'chunk') return;
      const chunks = this.recordedChunks.get(insertIndex);
      const mins = this.peakMins.get(insertIndex);
      const maxs = this.peakMaxs.get(insertIndex);
      if (!chunks) return;
      const channelData: Float32Array[] = e.data.channelData;
      channelData.forEach((ch, i) => {
        if (!chunks[i]) chunks[i] = [];
        chunks[i].push(ch);
      });
      // Accumulate one peak per chunk (128 samples) for real-time waveform
      if (mins && maxs) {
        const ch0 = channelData[0];
        let min = ch0[0], max = ch0[0];
        for (let i = 1; i < ch0.length; i++) {
          if (ch0[i] < min) min = ch0[i];
          if (ch0[i] > max) max = ch0[i];
        }
        mins.push(min);
        maxs.push(max);
      }
    };

    this.micStreams.set(insertIndex, stream);
    this.micSources.set(insertIndex, source);
    this.recorderNodes.set(insertIndex, recorderNode);
  }

  public disconnectMic(insertIndex: number): void {
    this.micStreams.get(insertIndex)?.getTracks().forEach(t => t.stop());
    try { this.micSources.get(insertIndex)?.disconnect(); } catch(_) {}
    try { this.monoSummers.get(insertIndex)?.disconnect(); } catch(_) {}
    this.monoSummers.delete(insertIndex);
    try { this.recorderNodes.get(insertIndex)?.disconnect(); } catch(_) {}
    this.micStreams.delete(insertIndex);
    this.micSources.delete(insertIndex);
    this.recorderNodes.delete(insertIndex);
    this.recordedChunks.delete(insertIndex);
    this.peakMins.delete(insertIndex);
    this.peakMaxs.delete(insertIndex);
  }

  public beginCapture(insertIndices: number[]): void {
    for (const insertIndex of insertIndices) {
      this.recordedChunks.set(insertIndex, []);
      this.peakMins.set(insertIndex, []);
      this.peakMaxs.set(insertIndex, []);
      this.recorderNodes.get(insertIndex)?.port.postMessage({ type: 'start' });
    }
  }

  public endCapture(insertIndices: number[]): Map<number, Float32Array[][]> {
    for (const insertIndex of insertIndices) {
      this.recorderNodes.get(insertIndex)?.port.postMessage({ type: 'stop' });
    }
    // Build snapshot of current recordedChunks for the given indices
    const snapshot = new Map<number, Float32Array[][]>();
    for (const insertIndex of insertIndices) {
      const chunks = this.recordedChunks.get(insertIndex);
      if (chunks) {
        snapshot.set(insertIndex, chunks.map(ch => [...ch]));
      }
      this.recordedChunks.delete(insertIndex);
      this.peakMins.delete(insertIndex);
      this.peakMaxs.delete(insertIndex);
    }
    return snapshot;
  }

  public getPeakData(insertIndex: number): { mins: Float32Array; maxs: Float32Array } | null {
    const mins = this.peakMins.get(insertIndex);
    const maxs = this.peakMaxs.get(insertIndex);
    if (!mins || !maxs || mins.length === 0) return null;
    return { mins: new Float32Array(mins), maxs: new Float32Array(maxs) };
  }

  public setInsertArmed(insertIndex: number, armed: boolean, deviceId?: string): void {
    const insert = this.getOrCreateMixerInsert(insertIndex);
    insert.armed = armed;
    if (deviceId !== undefined) insert.inputDeviceId = deviceId;
  }

  public getArmedInsertIndices(): number[] {
    return this.inserts.filter(ins => ins.armed).map(ins => ins.index);
  }
}
