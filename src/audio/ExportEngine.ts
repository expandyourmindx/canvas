import { ParametricEQ } from "./effects/ParametricEQ";
import { Reverb } from "./effects/Reverb";

export interface ExportableEngine {
  getBpm(): number;
  getCanvasClips(): any[];
  getPatterns(): Record<string, any[]>;
  getSampleBuffer(id: string): AudioBuffer | undefined;
  getLoopSettings?(): { loopStart: number; loopEnd: number };
  getActivePatternId(): string;
  resolveChannelId?(referenceId: string): string | undefined;
  getChannelSamplerSettings?(channelId: string): any;
  getMixerInserts?(): any[];
  getChannelMixerTarget?(channelId: string): number;
  awaitStretchJob?(clipId: string): Promise<void>;
  getWAMChannels?(): Array<{
    channelId: string;
    url: string;
    state: any;
    mixerTarget: number;
  }>;
  getWAMInstance?(channelId: string): any;
}

export interface ExportSettings {
  format: "wav" | "mp3";
  range: "full" | "loop";
  normalize: boolean;
  renderTail: boolean;
  duration?: number;
}

/**
 * Genuine Web Audio Offline Audio Exporter
 * Compiles the entire timeline (samples and synth notes) sample-accurately
 * inside an OfflineAudioContext, and encodes it into 16-bit PCM WAV.
 */
export class ExportEngine {
  /**
   * Primary offline rendering pipeline. Schedules all arranger canvas clips
   * and synth voices, then runs the fast hardware compile thread.
   */
  public static async renderAudio(engine: ExportableEngine, settings: ExportSettings): Promise<AudioBuffer> {
    const bpm = engine.getBpm();
    const canvasClips = engine.getCanvasClips() || [];
    const patterns = engine.getPatterns() || {};

    let durationSeconds = 16; // default fallback
    
    // Retrieve loop settings if they exist using optional chaining
    const loopSettings = engine.getLoopSettings?.() || { loopStart: 0, loopEnd: 4 };
    const loopStart = settings.range === "loop" ? loopSettings.loopStart : 0;
    const loopEnd = settings.range === "loop" ? loopSettings.loopEnd : Infinity;

    if (settings.range === "loop") {
      const loopLenBeats = (loopSettings.loopEnd || 4) - (loopSettings.loopStart || 0);
      durationSeconds = loopLenBeats * (60 / bpm);
    } else if (canvasClips.length > 0) {
      const maxBeat = Math.max(...canvasClips.map((c: any) => c.startBeat + c.duration));
      durationSeconds = maxBeat * (60 / bpm);
    } else {
      // Fallback: active pattern looping
      durationSeconds = 32 * (60 / bpm);
    }

    if (settings.renderTail) {
      durationSeconds += 2.0; // Decay tail margin
    }

    const sampleRate = 44100;
    const totalSamples = Math.ceil(sampleRate * durationSeconds);
    const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);



    // Reconstruct full 16-channel Mixer inserts inside the OfflineAudioContext
    const offlineInserts: {
      index: number;
      inputNode: GainNode;
      gainNode: GainNode;
      pannerNode: StereoPannerNode | null;
    }[] = [];

    const insertsData = engine.getMixerInserts ? engine.getMixerInserts() : [];

    // 1. Create all insert nodes
    for (let i = 0; i <= 15; i++) {
      const data = insertsData.find((ins: any) => ins.index === i) || {
        index: i,
        volume: 80,
        pan: 0,
        fxSlots: Array(8).fill(""),
        fxBypass: Array(8).fill(false),
        eqSettings: {},
        reverbSettings: {}
      };

      const inputNode = offlineCtx.createGain();
      const gainNode = offlineCtx.createGain();
      const pannerNode = offlineCtx.createStereoPanner ? offlineCtx.createStereoPanner() : null;

      // Apply fader volume
      const volVal = (data.volume / 80) * 0.8;
      gainNode.gain.setValueAtTime(volVal, 0);

      // Apply pan fader
      if (pannerNode) {
        pannerNode.pan.setValueAtTime(data.pan / 50, 0);
      }

      offlineInserts[i] = {
        index: i,
        inputNode,
        gainNode,
        pannerNode
      };
    }

    // 2. Connect the nodes and build their active FX chains
    const masterInsert = offlineInserts[0];

    for (let i = 0; i <= 15; i++) {
      const data = insertsData.find((ins: any) => ins.index === i) || {
        index: i,
        volume: 80,
        pan: 0,
        fxSlots: Array(8).fill(""),
        fxBypass: Array(8).fill(false),
        eqSettings: {},
        reverbSettings: {}
      };

      const insertNodes = offlineInserts[i];
      let lastNode: AudioNode = insertNodes.inputNode;

      const fxSlots = data.fxSlots || Array(8).fill("");
      const fxBypass = data.fxBypass || Array(8).fill(false);
      const eqSettings = data.eqSettings || {};
      const reverbSettings = data.reverbSettings || {};

      for (let slotIdx = 0; slotIdx < 8; slotIdx++) {
        const fxName = fxSlots[slotIdx];
        const isBypassed = fxBypass[slotIdx];

        if (fxName === "EQ" && !isBypassed && eqSettings[slotIdx]) {
          const eq = new ParametricEQ(offlineCtx as unknown as AudioContext);
          eq.deserialize(eqSettings[slotIdx]);
          
          lastNode.connect(eq.input);
          eq.updateConnections();
          lastNode = eq.output;
        } else if (fxName === "Reverb" && !isBypassed && reverbSettings[slotIdx]) {
          const reverb = new Reverb(offlineCtx as unknown as AudioContext);
          reverb.deserialize(reverbSettings[slotIdx]);
          
          lastNode.connect(reverb.input);
          reverb.updateConnections();
          lastNode = reverb.output;
        }
      }

      // Chain the end of active FX to fader gain node
      lastNode.connect(insertNodes.gainNode);

      // Route insert outputs (inserts 1-15 sum to masterInsert; masterInsert sums to offline destination)
      if (i === 0) {
        if (insertNodes.pannerNode) {
          insertNodes.gainNode.connect(insertNodes.pannerNode);
          insertNodes.pannerNode.connect(offlineCtx.destination);
        } else {
          insertNodes.gainNode.connect(offlineCtx.destination);
        }
      } else {
        if (insertNodes.pannerNode) {
          insertNodes.gainNode.connect(insertNodes.pannerNode);
          insertNodes.pannerNode.connect(masterInsert.inputNode);
        } else {
          insertNodes.gainNode.connect(masterInsert.inputNode);
        }
      }
    }

    const wamChannels = engine.getWAMChannels?.() 
      ?? (engine as any).getWamChannels?.() 
      ?? [];
    const offlineWAMNodes = new Map<string, AudioWorkletNode>();

    if (wamChannels.length > 0) {
      try {
        const { initializeWamHost } = await import(
          '@webaudiomodules/sdk'
        );
        const [offlineGroupId] = await initializeWamHost(
          offlineCtx as unknown as AudioContext
        );
        for (const wamChan of wamChannels) {
          try {
            const { default: WAMClass } = await import(
              /* @vite-ignore */ wamChan.url
            );
            const offlineInstance = await WAMClass.createInstance(
              offlineGroupId,
              offlineCtx as unknown as AudioContext
            );
            if (wamChan.state) {
              await offlineInstance.setState(wamChan.state);
            }
            const target = Math.max(0, Math.min(15, 
              wamChan.mixerTarget ?? 1
            ));
            offlineInstance.audioNode.connect(
              offlineInserts[target].inputNode
            );
            offlineWAMNodes.set(wamChan.channelId, 
              offlineInstance.audioNode
            );
            console.log(`[ExportEngine] WAM loaded for 
              ${wamChan.channelId}`);
          } catch (err) {
            console.error(`[ExportEngine] WAM failed for 
              ${wamChan.channelId}:`, err);
          }
        }
      } catch (err) {
        console.error('[ExportEngine] WAM host init failed:', err);
      }
    }

    // Helper mapping beats to absolute offline seconds
    const beatToTime = (beat: number) => {
      if (settings.range === "loop") {
        return (beat - loopStart) * (60 / bpm);
      }
      return beat * (60 / bpm);
    };

    if (canvasClips.length > 0) {
      for (const clip of canvasClips) {
        // Filter elements out of loop bounds
        if (clip.startBeat + clip.duration <= loopStart || clip.startBeat >= loopEnd) {
          continue;
        }

        const clipStartBeat = Math.max(loopStart, clip.startBeat);
        const clipEndBeat = Math.min(loopEnd, clip.startBeat + clip.duration);
        const activeClipDurationBeats = clipEndBeat - clipStartBeat;

        const startTime = beatToTime(clipStartBeat);
        const cropStart = clip.cropStart || 0;
        const offsetBeats = cropStart + (clipStartBeat - clip.startBeat);

        if (clip.type === "sample") {
          let sampleId = clip.referenceId;
          const clipChannelId = engine.resolveChannelId ? engine.resolveChannelId(clip.referenceId) : undefined;
          const clipSettings = (clipChannelId && engine.getChannelSamplerSettings)
            ? engine.getChannelSamplerSettings(clipChannelId)
            : null;
          const stretchMode = clipSettings?.stretchMode?.toUpperCase();

          if (stretchMode === "STRETCH") {
            const stretchedId = `${clip.id}_stretched`;
            if (engine.getSampleBuffer(stretchedId)) {
              sampleId = stretchedId;
              console.log(`[ExportEngine] Using cached stretched buffer for clip ${clip.id}: ${stretchedId}`);
            } else {
              console.warn(`[ExportEngine] Stretched buffer not found for clip ${clip.id}, falling back to original: ${clip.referenceId}`);
            }
          }

          const buffer = engine.getSampleBuffer(sampleId);
          if (buffer) {
            const source = offlineCtx.createBufferSource();
            source.buffer = buffer;

            // Mirror SamplerEngine.triggerCanvasSample: apply playbackRate for RESAMPLE mode
            if (stretchMode === "RESAMPLE" && clipSettings) {
              const stretchPitchSemitones = (clipSettings.stretchPitch || 0) / 100;
              const canvasPitchRate = Math.pow(2, stretchPitchSemitones / 12);
              const timeInBeats = clipSettings.stretchTime || 0;
              const multiplier = clipSettings.stretchMul || 1.0;
              let baseTempoRatio = 1.0;
              if (timeInBeats > 0) {
                const targetDurationSecs = (timeInBeats / bpm) * 60;
                baseTempoRatio = buffer.duration / targetDurationSecs;
              }
              source.playbackRate.value = canvasPitchRate * (baseTempoRatio * multiplier);
            }

            const gainNode = offlineCtx.createGain();
            gainNode.gain.value = 0.8;
            source.connect(gainNode);
            const targetMixerIndex = (clipChannelId && engine.getChannelMixerTarget)
              ? engine.getChannelMixerTarget(clipChannelId)
              : 1;
            gainNode.connect(offlineInserts[targetMixerIndex].inputNode);

            const offsetSecs = offsetBeats * (60 / bpm);
            const durSecs = activeClipDurationBeats * (60 / bpm);

            const delaySecs = offsetSecs < 0 ? -offsetSecs : 0;
            const playOffsetSecs = offsetSecs < 0 ? 0 : offsetSecs;
            const playStartTime = startTime + delaySecs;
            const remainingDurSecs = durSecs - delaySecs;

            if (remainingDurSecs > 0) {
              source.start(playStartTime, playOffsetSecs, remainingDurSecs);
            }
          }
        } else if (clip.type === "pattern") {
          // Trigger Pattern Notes
          const pEvents = patterns[clip.referenceId] || [];
          for (const note of pEvents) {
            const noteBeat = clip.startBeat + (note.time - cropStart);
            if (noteBeat < clipStartBeat || noteBeat >= clipEndBeat) {
              continue; // cropped out
            }

            const noteStartTime = beatToTime(noteBeat);
            const noteDurBeats = Math.min(note.duration, clip.startBeat + clip.duration - noteBeat);

            if (note.sampleId) {
              const buffer = engine.getSampleBuffer(note.sampleId);
              if (buffer) {
                const source = offlineCtx.createBufferSource();
                source.buffer = buffer;
                const gainNode = offlineCtx.createGain();
                gainNode.gain.value = note.velocity || 0.8;
                source.connect(gainNode);
                const channelId = note.channelId;
                const targetMixerIndex = (channelId && engine.getChannelMixerTarget)
                  ? engine.getChannelMixerTarget(channelId)
                  : 1;
                gainNode.connect(offlineInserts[targetMixerIndex].inputNode);
                source.start(noteStartTime);
              }
            } else if (note.pitch !== undefined) {
              const nChannelId = note.channelId;
              if (nChannelId) {
                const offlineNode = offlineWAMNodes.get(nChannelId);
                if (offlineNode) {
                  const velocity = Math.round((note.velocity ?? 0.8) * 127);
                  const noteDurBeats = note.duration ?? 0.5;
                  const durSecs = noteDurBeats * (60 / bpm);
                  (offlineNode as AudioWorkletNode).port.postMessage({
                    type: 'scheduleNote',
                    data: {
                      time: noteStartTime,
                      noteType: 'noteOn',
                      note: note.pitch,
                      velocity,
                    }
                  });
                  (offlineNode as AudioWorkletNode).port.postMessage({
                    type: 'scheduleNote',
                    data: {
                      time: noteStartTime + durSecs,
                      noteType: 'noteOff',
                      note: note.pitch,
                      velocity: 0,
                    }
                  });
                }
              }
            }
          }
        }
      }
    } else {
      // Direct active pattern looper fallback
      const activePatId = engine.getActivePatternId();
      const pEvents = patterns[activePatId] || [];
      const endLimit = settings.range === "loop" ? loopEnd : 32;

      for (let offset = 0; offset < endLimit; offset += 4) {
        for (const note of pEvents) {
          const noteBeat = offset + note.time;
          if (noteBeat < loopStart || noteBeat >= endLimit) {
            continue;
          }
          const noteDurBeats = note.duration ?? 0.5;
          const noteStartTime = beatToTime(noteBeat);

          if (note.sampleId) {
            const buffer = engine.getSampleBuffer(note.sampleId);
            if (buffer) {
              const source = offlineCtx.createBufferSource();
              source.buffer = buffer;
              const gainNode = offlineCtx.createGain();
              gainNode.gain.value = note.velocity || 0.8;
              source.connect(gainNode);
              const channelId = note.channelId;
              const targetMixerIndex = (channelId && engine.getChannelMixerTarget)
                ? engine.getChannelMixerTarget(channelId)
                : 1;
              gainNode.connect(offlineInserts[targetMixerIndex].inputNode);
              source.start(noteStartTime);
            }
          } else if (note.pitch !== undefined) {
            const nChannelId = note.channelId;
            if (nChannelId) {
              const offlineNode = offlineWAMNodes.get(nChannelId);
              if (offlineNode) {
                const velocity = Math.round((note.velocity ?? 0.8) * 127);
                const noteDurBeats = note.duration ?? 0.5;
                const durSecs = noteDurBeats * (60 / bpm);
                (offlineNode as AudioWorkletNode).port.postMessage({
                  type: 'scheduleNote',
                  data: {
                    time: noteStartTime,
                    noteType: 'noteOn',
                    note: note.pitch,
                    velocity,
                  }
                });
                (offlineNode as AudioWorkletNode).port.postMessage({
                  type: 'scheduleNote',
                  data: {
                    time: noteStartTime + durSecs,
                    noteType: 'noteOff',
                    note: note.pitch,
                    velocity: 0,
                  }
                });
              }
            }
          }
        }
      }
    }

    if (engine.awaitStretchJob) {
      const stretchWaits: Promise<void>[] = [];
      for (const clip of canvasClips) {
        if (clip.type !== "sample") continue;
        const ch = engine.resolveChannelId?.(clip.referenceId);
        const cs = ch ? engine.getChannelSamplerSettings?.(ch) : null;
        if (cs?.stretchMode?.toUpperCase() === "STRETCH") {
          stretchWaits.push(engine.awaitStretchJob(clip.id));
        }
      }
      if (stretchWaits.length > 0) await Promise.all(stretchWaits);
    }

    const renderedBuffer = await offlineCtx.startRendering();
    return renderedBuffer;
  }

  /**
   * Helper that encodes rendered floating-point dual-channel PCM AudioBuffer
   * into a fully-compliant 16-bit stereo PCM WAV ArrayBuffer.
   */
  public static bufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const numOfChan = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    let result;
    if (numOfChan === 2) {
      result = this.interleave(buffer.getChannelData(0), buffer.getChannelData(1));
    } else {
      result = buffer.getChannelData(0);
    }
    
    const bufferLength = result.length * 2; // 2 bytes per sample
    const arrayBuffer = new ArrayBuffer(44 + bufferLength);
    const view = new DataView(arrayBuffer);
    
    this.writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + bufferLength, true);
    this.writeString(view, 8, "WAVE");
    this.writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numOfChan, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numOfChan * (bitDepth / 8), true);
    view.setUint16(32, numOfChan * (bitDepth / 8), true);
    view.setUint16(34, bitDepth, true);
    this.writeString(view, 36, "data");
    view.setUint32(40, bufferLength, true);
    
    let offset = 44;
    for (let i = 0; i < result.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, result[i]));
      const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(offset, val, true);
    }
    
    return arrayBuffer;
  }

  private static interleave(inputL: Float32Array, inputR: Float32Array): Float32Array {
    const length = inputL.length + inputR.length;
    const result = new Float32Array(length);
    
    let index = 0;
    let inputIndex = 0;
    
    while (index < length) {
      result[index++] = inputL[inputIndex];
      result[index++] = inputR[inputIndex];
      inputIndex++;
    }
    return result;
  }

  private static writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}
