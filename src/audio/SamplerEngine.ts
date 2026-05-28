/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DAWEvent } from "./AudioEngine";
import { SampleRegistry } from "./SampleRegistry";
import { CanvasClip, SamplerSettings } from "../types";
// @ts-expect-error Vite worker import query suffix is not declared in TS
import StretchWorker from "../workers/soundstretch.worker.ts?worker";

export interface SamplerEngineDelegate {
  getChannelNodes: (channelId: string) => { gain: GainNode; panner: StereoPannerNode | null };
  getMixerInsertGainNode: (index: number) => GainNode;
  getChannelVolume: (channelId: string) => number;
  getChannelPan: (channelId: string) => number;
  getChannelMixerTarget: (channelId: string) => number;
  beatsToSeconds: (beats: number) => number;
  getBPM?: () => number;
  notifySampleLoaded?: () => void;
}

export class SamplerEngine {
  private audioContext: AudioContext;
  private masterGainNode: GainNode;
  private sampleRegistry: SampleRegistry;
  private delegate: SamplerEngineDelegate;

  // Sampler state and voice tracking
  private activeSamplerVoices: Map<string, any[]> = new Map();
  private samplerSettings: Record<string, SamplerSettings> = {};
  private channelSampleIds: Record<string, string> = {};
  private originalChannelSampleIds: Record<string, string> = {};
  private stretchWorker: Worker | null = null;
  private stretchDebounceTimers: Record<string, any> = {};

  constructor(
    audioContext: AudioContext,
    masterGainNode: GainNode,
    sampleRegistry: SampleRegistry,
    delegate: SamplerEngineDelegate
  ) {
    this.audioContext = audioContext;
    this.masterGainNode = masterGainNode;
    this.sampleRegistry = sampleRegistry;
    this.delegate = delegate;
  }

  private getOrCreateWorker(): Worker {
    if (!this.stretchWorker) {
      // Instantiate using Vite's classic worker constructor
      this.stretchWorker = new StretchWorker();
      
      this.stretchWorker.onmessage = (e) => {
        console.log("Received stretched audio from worker for channel:", e.data.channelId);
        const { stretchedAudio, channels, totalFrames, error, channelId } = e.data;
        if (error) {
          console.error("SoundStretch Web Worker error:", error);
          return;
        }
        
        // Construct new AudioBuffer in the Web Audio context
        const buffer = this.audioContext.createBuffer(
          channels,
          totalFrames,
          this.audioContext.sampleRate
        );
        
        // De-interleave flat Float32Array PCM back into individual channel buffers
        for (let c = 0; c < channels; c++) {
          const channelData = buffer.getChannelData(c);
          for (let i = 0; i < totalFrames; i++) {
            channelData[i] = stretchedAudio[i * channels + c];
          }
        }
        
        // Store in SampleRegistry under a stretched ID using the public API
        const stretchedId = `${channelId}_stretched`;
        this.sampleRegistry.setSampleBuffer(stretchedId, buffer);
        
        // Update active slot
        this.channelSampleIds[channelId] = stretchedId;
        
        console.log(`Stretched buffer registered for channel ${channelId}: duration=${buffer.duration.toFixed(2)}s`);
        
        // Trigger UI redraw
        if (this.delegate.notifySampleLoaded) {
          this.delegate.notifySampleLoaded();
        }
      };
    }
    return this.stretchWorker;
  }

  public calculateTempoRatio(channelId: string, originalDuration: number): number {
    const settings = this.samplerSettings[channelId];
    if (!settings) return 1.0;
    
    const mode = settings.stretchMode?.toUpperCase();
    if (mode !== "STRETCH" && mode !== "RESAMPLE") return 1.0;
    
    const timeInBeats = settings.stretchTime || 0;
    const multiplier = settings.stretchMul || 1.0;
    
    let baseTempoRatio = 1.0;
    if (timeInBeats > 0) {
      const bpm = this.delegate.getBPM ? this.delegate.getBPM() : 120;
      const targetDurationSeconds = (timeInBeats / bpm) * 60;
      baseTempoRatio = originalDuration / targetDurationSeconds;
    }
    return baseTempoRatio * multiplier;
  }

  public processSampleStretch(channelId: string) {
    console.log("Triggering stretch worker for channel:", channelId);
    const settings = this.samplerSettings[channelId];
    if (!settings) return;

    const originalSampleId = this.originalChannelSampleIds[channelId] || this.channelSampleIds[channelId];
    if (!originalSampleId) return;

    const pristineBuffer = this.sampleRegistry.getSampleBuffer(originalSampleId);
    if (!pristineBuffer) return;

    // In Resample or normal mode, restore playback slot to pristine buffer and bypass worker
    if (settings.stretchMode?.toUpperCase() !== "STRETCH") {
      this.channelSampleIds[channelId] = originalSampleId;
      if (this.delegate.notifySampleLoaded) {
        this.delegate.notifySampleLoaded();
      }
      return;
    }

    const worker = this.getOrCreateWorker();
    
    // Interleave Pristine AudioBuffer channels into flat Float32Array
    const channels = pristineBuffer.numberOfChannels;
    const numFrames = pristineBuffer.length;
    const interleavedData = new Float32Array(numFrames * channels);
    
    for (let i = 0; i < numFrames; i++) {
      for (let c = 0; c < channels; c++) {
        interleavedData[i * channels + c] = pristineBuffer.getChannelData(c)[i];
      }
    }
    
    const pitchCents = settings.stretchPitch || 0;
    const timeInBeats = settings.stretchTime || 0;
    const multiplier = settings.stretchMul || 1.0;
    const sampleRate = pristineBuffer.sampleRate;
    
    // Calculate tempoRatio
    let baseTempoRatio = 1.0;
    if (timeInBeats > 0) {
      const bpm = this.delegate.getBPM ? this.delegate.getBPM() : 120;
      const targetDurationSeconds = (timeInBeats / bpm) * 60;
      baseTempoRatio = pristineBuffer.duration / targetDurationSeconds;
    }
    const tempoRatio = baseTempoRatio * multiplier;

    console.log("Sending to worker: pitchCents =", pitchCents, "tempoRatio =", tempoRatio);

    worker.postMessage({
      audioData: interleavedData,
      channels: channels,
      pitchCents: pitchCents,
      tempoRatio: tempoRatio,
      sampleRate: sampleRate,
      channelId: channelId
    }, [interleavedData.buffer]);
  }

  public updateChannelSamplerSettings(channelId: string, settings: SamplerSettings) {
    this.samplerSettings[channelId] = settings;
    
    // Debounce the worker processing to prevent stuttering mid-drag
    if (this.stretchDebounceTimers[channelId]) {
      clearTimeout(this.stretchDebounceTimers[channelId]);
    }
    
    this.stretchDebounceTimers[channelId] = setTimeout(() => {
      this.processSampleStretch(channelId);
      delete this.stretchDebounceTimers[channelId];
    }, 180);
  }

  public updateChannelSampleId(channelId: string, sampleId: string) {
    this.channelSampleIds[channelId] = sampleId;
    if (!sampleId.endsWith("_stretched")) {
      this.originalChannelSampleIds[channelId] = sampleId;
    }
  }

  public getChannelSampleId(channelId: string): string | undefined {
    return this.channelSampleIds[channelId];
  }

  public getChannelSamplerSettings(channelId: string): SamplerSettings | undefined {
    return this.samplerSettings[channelId];
  }

  public getAllSamplerSettings(): Record<string, SamplerSettings> {
    return this.samplerSettings;
  }

  public restoreAllSamplerSettings(settings: Record<string, SamplerSettings>): void {
    this.samplerSettings = { ...settings };
  }

  /**
   * Triggers a sample instrument key-playback event interactively (MIDI / Keyboard).
   */
  public noteOn(channelId: string, midiNote: number, velocity: number = 80, time?: number) {
    console.log("Playing buffer reference for channel:", channelId, "Active ID:", this.channelSampleIds[channelId]);
    const now = time !== undefined ? time : this.audioContext.currentTime;

    const activeSampleId = this.channelSampleIds[channelId];
    if (!activeSampleId) return;

    const buffer = this.sampleRegistry.getSampleBuffer(activeSampleId);
    if (!buffer) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.audioContext.createGain();

    const nodes = this.delegate.getChannelNodes(channelId);
    source.connect(gainNode);
    if (nodes && nodes.gain) {
      gainNode.connect(nodes.gain);
    } else {
      const mixerTarget = this.delegate.getChannelMixerTarget(channelId);
      const insertGain = this.delegate.getMixerInsertGainNode(mixerTarget);
      gainNode.connect(insertGain);
    }

    const settings = this.samplerSettings[channelId] ?? {
      pitch: 0,
      sampleStart: 0,
      envelopeOn: false,
      attack: 15,
      decay: 30,
      sustain: 70,
      release: 40,
      stretchMode: "resample" as const,
      stretchPitch: 0,
      stretchMul: 1.0,
      stretchTime: 0,
    };

    const notePitchOffset = midiNote - 60;
    let finalTransposition = notePitchOffset + (settings.pitch || 0);
    
    // Only apply stretch pitch via playbackRate in RESAMPLE mode.
    // In STRETCH mode the worker already bakes pitch into the buffer.
    let resampleTempoRatio = 1.0;
    if (settings.stretchMode?.toUpperCase() === "RESAMPLE") {
      const stretchPitchSemitones = (settings.stretchPitch || 0) / 100;
      finalTransposition += stretchPitchSemitones;
      resampleTempoRatio = this.calculateTempoRatio(channelId, buffer.duration);
    }
    
    source.playbackRate.setValueAtTime(Math.pow(2, finalTransposition / 12) * resampleTempoRatio, now);

    const velFactor = velocity / 127;

    if (settings.envelopeOn) {
      const attackSecs = (settings.attack / 100) * 0.4;
      const decaySecs = (settings.decay / 100) * 0.4;
      const sustainLevel = (settings.sustain / 100) * velFactor;

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(velFactor, now + attackSecs);
      gainNode.gain.linearRampToValueAtTime(sustainLevel, now + attackSecs + decaySecs);

      const samplerVoice = {
        channelId,
        midiNote,
        noteId: `midi-sampler-${channelId}-${midiNote}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
        source,
        gainNode,
        settings,
        startTime: now
      };

      const activeSVoices = this.activeSamplerVoices.get(channelId) || [];
      activeSVoices.push(samplerVoice);
      this.activeSamplerVoices.set(channelId, activeSVoices);

      source.onended = () => {
        try {
          source.disconnect();
          gainNode.disconnect();
        } catch (err) { }
        const current = this.activeSamplerVoices.get(channelId) || [];
        this.activeSamplerVoices.set(channelId, current.filter(v => v.noteId !== samplerVoice.noteId));
      };

      source.start(now);
    } else {
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(velFactor, now + 0.005);

      const bufferDurationScaled = buffer.duration / source.playbackRate.value;
      const endFadeTime = now + bufferDurationScaled;
      gainNode.gain.setValueAtTime(velFactor, Math.max(now + 0.005, endFadeTime - 0.010));
      gainNode.gain.linearRampToValueAtTime(0, endFadeTime);

      source.onended = () => {
        try {
          source.disconnect();
          gainNode.disconnect();
        } catch (err) { }
      };

      source.start(now);
      source.stop(endFadeTime);
    }
  }

  /**
   * Terminate/Release a triggered sampler voice.
   */
  public noteOff(channelId: string, midiNote: number, time?: number) {
    const now = time !== undefined ? time : this.audioContext.currentTime;

    const activeSVoices = this.activeSamplerVoices.get(channelId) || [];
    const matches = activeSVoices.filter(v => v.midiNote === midiNote);

    matches.forEach((voice) => {
      const releaseSecs = ((voice.settings.release || 40) / 100) * 0.8;

      voice.gainNode.gain.cancelScheduledValues(now);
      voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, now);
      voice.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + releaseSecs);

      const stopTime = now + releaseSecs + 0.05;
      try {
        voice.source.stop(stopTime);
      } catch (e) { }
    });
  }

  /**
   * Auditions a specific sampler channel directly with dynamic parameter overrides.
   */
  public previewChannel(
    channelId: string,
    sampleId?: string,
    volume?: number,
    pan?: number,
    settings?: any
  ) {
    const activeSampleId = sampleId ?? this.channelSampleIds[channelId];
    if (!activeSampleId) {
      console.warn(`No sampleId registered for channel preview: ${channelId}`);
      return;
    }

    const buffer = this.sampleRegistry.getSampleBuffer(activeSampleId);
    if (!buffer) {
      console.warn(`Sample buffer not loaded for preview channel: ${channelId}, ID: ${activeSampleId}`);
      return;
    }

    const activeVol = volume ?? this.delegate.getChannelVolume(channelId);
    const activePan = pan ?? this.delegate.getChannelPan(channelId);
    const activeSettings = settings ?? this.samplerSettings[channelId] ?? {
      pitch: 0,
      sampleStart: 0,
      envelopeOn: false,
      attack: 15,
      decay: 30,
      sustain: 70,
      release: 40,
      stretchMode: "resample" as const,
      stretchPitch: 0,
      stretchMul: 1.0,
      stretchTime: 0,
    };

    // Keep settings cache updated
    if (sampleId) this.channelSampleIds[channelId] = sampleId;
    if (settings) this.samplerSettings[channelId] = settings;

    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }

    const now = this.audioContext.currentTime;
    const nodes = this.delegate.getChannelNodes(channelId);

    // Create custom trigger buffer source
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    // Route: source -> channel Gain (enveloped) -> channel Panner
    source.connect(nodes.gain);

    // Apply Pitch Transpose (playbackRate ratio = 2^(pitch/12))
    // Only add stretch pitch in RESAMPLE mode — STRETCH mode bakes it into the buffer.
    let totalPitchSemitones = activeSettings.pitch || 0;
    let resampleTempoRatio = 1.0;
    if (activeSettings.stretchMode?.toUpperCase() === "RESAMPLE") {
      const stretchPitchSemitones = (activeSettings.stretchPitch || 0) / 100;
      totalPitchSemitones += stretchPitchSemitones;
      resampleTempoRatio = this.calculateTempoRatio(channelId, buffer.duration);
    }
    source.playbackRate.setValueAtTime(Math.pow(2, totalPitchSemitones / 12) * resampleTempoRatio, now);

    // Apply Pan to our StereoPannerNode
    const mappedPan = activePan / 50; // map [-50, 50] to [-1, 1]
    if (nodes.panner) {
      nodes.panner.pan.setValueAtTime(mappedPan, now);
    }

    // Apply Volume multiplier
    const volMultiplier = activeVol / 100;

    // Apply Envelope (GainNode)
    const gainParam = nodes.gain.gain;
    gainParam.cancelScheduledValues(now);

    const startOffsetPercent = activeSettings.sampleStart; // 0% to 100%
    const startOffsetSeconds = (startOffsetPercent / 100) * buffer.duration;

    if (activeSettings.envelopeOn) {
      // Linear ADSR Scaling
      const attackSecs = (activeSettings.attack / 100) * 0.4;  // max 400ms attack
      const decaySecs = (activeSettings.decay / 100) * 0.4;    // max 400ms decay
      const sustainMultiplier = activeSettings.sustain / 100;
      const sustainLevel = sustainMultiplier * volMultiplier;
      const releaseSecs = (activeSettings.release / 100) * 0.8; // max 800ms release

      // Sequence
      gainParam.setValueAtTime(0, now);
      gainParam.linearRampToValueAtTime(volMultiplier, now + attackSecs);
      gainParam.linearRampToValueAtTime(sustainLevel, now + attackSecs + decaySecs);

      // Audition hold of 0.45s of sustain
      const holdSecs = 0.45;
      const releaseStart = now + attackSecs + decaySecs + holdSecs;
      gainParam.setValueAtTime(sustainLevel, releaseStart);
      gainParam.exponentialRampToValueAtTime(0.0001, releaseStart + releaseSecs);

      const totalPlayDuration = attackSecs + decaySecs + holdSecs + releaseSecs;
      source.start(now, startOffsetSeconds);
      source.stop(now + totalPlayDuration);
    } else {
      gainParam.setValueAtTime(volMultiplier, now);
      source.start(now, startOffsetSeconds);
    }
  }

  /**
   * Timeline event triggers for patterns.
   */
  public triggerSample(event: DAWEvent, absoluteContextTime: number, sampleOffsetSeconds: number = 0) {
    if (!event.sampleId) return;

    // Determine the playing channel by matching registered sample IDs or channel ID prefix
    const channelId = event.channelId ?? Object.keys(this.originalChannelSampleIds).find(
      (key) => this.originalChannelSampleIds[key] === event.sampleId
    ) ?? Object.keys(this.channelSampleIds).find(
      (key) => this.channelSampleIds[key] === event.sampleId
    );

    if (channelId) {
      console.log("Playing buffer reference for channel:", channelId, "Active ID:", this.channelSampleIds[channelId]);
    }

    const activeSampleId = channelId ? (this.channelSampleIds[channelId] || event.sampleId) : event.sampleId;

    const buffer = this.sampleRegistry.getSampleBuffer(activeSampleId);
    if (!buffer) {
      console.warn(`Sample buffer with ID "${activeSampleId}" was not loaded yet.`);
      return;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.audioContext.createGain();

    const nodes = channelId ? this.delegate.getChannelNodes(channelId) : null;

    // Wire up nodes: Source -> Gain (ADSR) -> Track/Channel Node or Master Insert
    source.connect(gainNode);
    if (nodes && nodes.gain) {
      gainNode.connect(nodes.gain);
    } else {
      const mixerTarget = channelId ? this.delegate.getChannelMixerTarget(channelId) : 1;
      const insert = this.delegate.getMixerInsertGainNode(mixerTarget);
      gainNode.connect(insert);
    }

    const eventDurationSeconds = this.delegate.beatsToSeconds(event.duration);
    const durationSecondsRemaining = eventDurationSeconds - sampleOffsetSeconds;

    // Resolve if there's an active ADSR envelope matching this sample's channel
    let envelopeOn = false;
    let attack = 0;
    let decay = 0;
    let sustain = 100;
    let release = 0;
    let channelSettingsPitch = 0;

    if (channelId) {
      const settings = this.samplerSettings[channelId];
      if (settings) {
        channelSettingsPitch = settings.pitch || 0;
        if (settings.envelopeOn) {
          envelopeOn = true;
          attack = settings.attack;
          decay = settings.decay;
          sustain = settings.sustain;
          release = settings.release;
        }
      }
    }

    // Apply pitch transpositions (both manual transpose knob & MIDI piano note values)
    let notePitchOffset = 0;
    if (event.pitch !== undefined) {
      notePitchOffset = event.pitch - 60; // relative to Middle C (60)
    }
    let finalTransposition = notePitchOffset + channelSettingsPitch;
    
    // Only apply stretch pitch via playbackRate in RESAMPLE mode.
    // In STRETCH mode the worker already bakes pitch into the buffer.
    let resampleTempoRatio = 1.0;
    if (channelId) {
      const settings = this.samplerSettings[channelId];
      if (settings && settings.stretchMode?.toUpperCase() === "RESAMPLE") {
        const stretchPitchSemitones = (settings.stretchPitch || 0) / 100;
        finalTransposition += stretchPitchSemitones;
        resampleTempoRatio = this.calculateTempoRatio(channelId, buffer.duration);
      }
    }
    
    source.playbackRate.setValueAtTime(Math.pow(2, finalTransposition / 12) * resampleTempoRatio, absoluteContextTime);

    if (durationSecondsRemaining > 0) {
      if (envelopeOn) {
        // Precise custom Sampler ADSR envelope mapping
        const attackSecs = (attack / 100) * 0.4;  // max 400ms attack
        const decaySecs = (decay / 100) * 0.4;    // max 400ms decay
        const sustainLevel = (sustain / 100) * event.velocity;
        const releaseSecs = (release / 100) * 0.8; // max 800ms release

        const attackEnd = absoluteContextTime + attackSecs;
        const decayEnd = attackEnd + decaySecs;
        const releaseStart = absoluteContextTime + durationSecondsRemaining;

        gainNode.gain.setValueAtTime(0, absoluteContextTime);
        gainNode.gain.linearRampToValueAtTime(event.velocity, Math.min(attackEnd, releaseStart));

        if (decayEnd < releaseStart) {
          gainNode.gain.linearRampToValueAtTime(sustainLevel, decayEnd);
          gainNode.gain.setValueAtTime(sustainLevel, releaseStart);
        } else {
          gainNode.gain.linearRampToValueAtTime(sustainLevel, releaseStart);
        }
        gainNode.gain.exponentialRampToValueAtTime(0.0001, releaseStart + releaseSecs);

        source.start(absoluteContextTime, sampleOffsetSeconds);
        source.stop(releaseStart + releaseSecs);
      } else {
        // Mandatory micro-fades de-clicking (No ADSR setup)
        const playDuration = Math.min(durationSecondsRemaining, buffer.duration - sampleOffsetSeconds);
        const stopTime = absoluteContextTime + playDuration;

        // Apply a clean 5ms fade-in
        gainNode.gain.setValueAtTime(0, absoluteContextTime);
        gainNode.gain.linearRampToValueAtTime(event.velocity, absoluteContextTime + 0.005);

        // Apply a clean 10ms fade-out right before stopping
        const fadeOutStartTime = Math.max(absoluteContextTime + 0.005, stopTime - 0.010);
        gainNode.gain.setValueAtTime(event.velocity, fadeOutStartTime);
        gainNode.gain.linearRampToValueAtTime(0, stopTime);

        source.start(absoluteContextTime, sampleOffsetSeconds);
        source.stop(stopTime);
      }
    }
  }

  /**
   * Plays a registered sample event with a hardware-accurate timeline target and optional offset.
   */
  public triggerCanvasSample(clip: CanvasClip, absoluteContextTime: number, sampleOffsetSeconds: number = 0) {
    const isChannelId = clip.referenceId.startsWith("sampler_");
    
    // Determine the playing channel by matching registered sample IDs or channel ID prefix
    const channelId = isChannelId ? clip.referenceId : (
      Object.keys(this.originalChannelSampleIds).find(
        (key) => this.originalChannelSampleIds[key] === clip.referenceId
      ) ?? Object.keys(this.channelSampleIds).find(
        (key) => this.channelSampleIds[key] === clip.referenceId
      )
    );

    if (channelId) {
      console.log("Playing buffer reference for channel:", channelId, "Active ID:", this.channelSampleIds[channelId]);
    }

    const sampleId = channelId ? (this.channelSampleIds[channelId] || clip.referenceId) : clip.referenceId;
    const buffer = this.sampleRegistry.getSampleBuffer(sampleId);
    if (!buffer) {
      console.warn(`Sample buffer with ID "${sampleId}" was not loaded yet.`);
      return;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.audioContext.createGain();
    source.connect(gainNode);

    const nodes = channelId ? this.delegate.getChannelNodes(channelId) : null;

    if (nodes && nodes.gain) {
      gainNode.connect(nodes.gain);
    } else {
      const mixerTarget = channelId ? this.delegate.getChannelMixerTarget(channelId) : 1;
      const insert = this.delegate.getMixerInsertGainNode(mixerTarget);
      gainNode.connect(insert);
    }

    // Dynamic gain based on scale or visual volume overrides
    gainNode.gain.setValueAtTime(0.8, absoluteContextTime);

    let resampleTempoRatio = 1.0;
    let canvasPitchRate = 1.0;
    if (channelId) {
      const settings = this.samplerSettings[channelId];
      if (settings && settings.stretchMode?.toUpperCase() === "RESAMPLE") {
        // Only apply stretch pitch via playbackRate in RESAMPLE mode.
        // In STRETCH mode the worker already bakes pitch into the buffer.
        const stretchPitchSemitones = (settings.stretchPitch || 0) / 100;
        canvasPitchRate = Math.pow(2, stretchPitchSemitones / 12);
        resampleTempoRatio = this.calculateTempoRatio(channelId, buffer.duration);
      }
    }
    source.playbackRate.setValueAtTime(canvasPitchRate * resampleTempoRatio, absoluteContextTime);

    // Track active length
    let effectiveBeats = clip.duration;
    if (channelId) {
      const settings = this.samplerSettings[channelId];
      if (settings && (settings.stretchTime || settings.stretchMul !== undefined || settings.stretchPitch)) {
        const stretchTime = settings.stretchTime || 0;
        const multiplier = settings.stretchMul ?? 1.0;
        const pitchCents = settings.stretchPitch || 0;
        
        if (stretchTime > 0) {
          if (settings.stretchMode?.toUpperCase() === "RESAMPLE") {
            const pitchRatio = Math.pow(2, pitchCents / 1200);
            effectiveBeats = stretchTime / (multiplier * pitchRatio);
          } else {
            effectiveBeats = stretchTime / multiplier;
          }
        } else {
          if (settings.stretchMode?.toUpperCase() === "RESAMPLE") {
            const pitchRatio = Math.pow(2, pitchCents / 1200);
            effectiveBeats = clip.duration / (multiplier * pitchRatio);
          } else {
            effectiveBeats = clip.duration / multiplier;
          }
        }
      }
    }

    const settings = channelId ? this.samplerSettings[channelId] : null;
    const isStretchActive = settings && settings.stretchMode?.toUpperCase() === "STRETCH";
    const targetBeats = isStretchActive ? effectiveBeats : clip.duration;
    const clipDurationSeconds = this.delegate.beatsToSeconds(targetBeats);
    const delay = sampleOffsetSeconds < 0 ? -sampleOffsetSeconds : 0;
    const offset = sampleOffsetSeconds < 0 ? 0 : sampleOffsetSeconds;
    const playStartTime = absoluteContextTime + delay;
    const durationSecondsRemaining = clipDurationSeconds - delay;

    // Register source into activeSamplerVoices BEFORE start() so that if the clip
    // ends immediately (very short duration or past-due absoluteContextTime), onended
    // fires against an already-registered voice and removes it cleanly — preventing
    // the zombie-voice bug where onended would fire before registration and then the
    // code below would re-add a ghost entry that could never be removed.
    const trackingId = channelId || "canvas";
    const canvasVoice = {
      channelId: trackingId,
      midiNote: -1,
      noteId: `canvas-${clip.referenceId}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      source,
      gainNode,
      settings: {},
      startTime: playStartTime
    };

    const existingVoices = this.activeSamplerVoices.get(trackingId) || [];
    existingVoices.push(canvasVoice);
    this.activeSamplerVoices.set(trackingId, existingVoices);

    source.onended = () => {
      try {
        source.disconnect();
        gainNode.disconnect();
      } catch (err) {}
      const current = this.activeSamplerVoices.get(trackingId) || [];
      this.activeSamplerVoices.set(
        trackingId,
        current.filter(v => v.noteId !== canvasVoice.noteId)
      );
    };

    if (durationSecondsRemaining > 0) {
      source.start(playStartTime, offset);

      // Stop sample playhead if clip ends early
      if (durationSecondsRemaining < buffer.duration - offset) {
        source.stop(playStartTime + durationSecondsRemaining);
      }
    }
  }

  public stopAll(fadeOutSeconds: number = 0.05, stopTime?: number): void {
    const now = stopTime !== undefined ? stopTime : this.audioContext.currentTime;
    this.activeSamplerVoices.forEach((voices) => {
      voices.forEach((voice: any) => {
        try {
          voice.gainNode.gain.cancelScheduledValues(now);
          voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, now);
          voice.gainNode.gain.linearRampToValueAtTime(0.0001, now + fadeOutSeconds);
          try { voice.source.stop(now + fadeOutSeconds + 0.01); } catch (e) {}
        } catch (err) {}
      });
    });
    this.activeSamplerVoices.clear();
  }
}
