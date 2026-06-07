/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CanvasClip, PatternData, PatternNote, SamplerSettings, DAWEvent, MixerInsert, EQBandSettings, ReverbSettings } from "../types";
import { SamplerEngine } from "./SamplerEngine";
import { SampleRegistry } from "./SampleRegistry";
import { MixerManager } from "./MixerManager";
import { TransportState, TransportScheduler } from "./TransportScheduler";
import { generateDrumSampleWav } from "./sampleGenerator";

export type { DAWEvent, MixerInsert, EQBandSettings } from "../types";
export type { TransportState } from "./TransportScheduler";

/**
 * Headless DAW Audio Engine (Version 2.0) - Core Audio Master Engine (AudioEngine.ts)
 * 
 * CORE DESIGN PATTERNS IMPLEMENTED:
 * 1. "A Tale of Two Clocks" (Lookahead Scheduler):
 *    Web Audio API schedules audio nodes in absolute hardware timeline seconds (`audioContext.currentTime`).
 *    JS clocks are jittery. This class sits in the middle: it evaluates upcoming events on the transport
 *    beat timeline, maps them to absolute hardware audio context times, and schedules them in advance
 *    of their play event.
 * 
 * 2. Continuous Time Foundation:
 *    Unlike step-sequencers that count ticks or integers, this timeline tracks continuous floating-point resolution.
 *    Beats and seconds are mapped as floating point values, allowing smooth tempo ramps, swing, and micro-timing.
 * 
 * 3. Hardware-Accurate Transport (Play/Pause/Stop/Looping):
 *    Every state shift updates the anchor relation:
 *    Timeline Position = Pause Offset + (Current Audio Context Time - Audio Context Start Time Anchor)
 *    When paused, we freeze the time to sample accuracy, preserving sub-millisecond precision.
 */


export interface AudioEngineOptions {
  bpm?: number;
  lookaheadMs?: number;      // How far in advance to schedule events (default 100ms)
  tickIntervalMs?: number;   // Background interval tick rate (default 25ms)
}

export class AudioEngine {
  private audioContext: AudioContext;
  private masterGainNode: GainNode;
  public scheduler: TransportScheduler;

  // Active musical event patterns queue
  private patterns: Record<string, DAWEvent[]> = {};
  private activePatternId: string = "pattern1";
  private patternNames: Record<string, string> = {};

  // Master hybrid arranger clips
  private canvasClips: CanvasClip[] = [];

  // Audio Buffer Registry: Decoupled manager handling cached sample buffers
  public sampleRegistry: SampleRegistry;



  // State Change Event Callbacks (allowing any UI layer to subscribe to transport updates)

  // Channel state and routing cache for interactive hardware previewing
  private channelVols: Record<string, number> = {};
  private channelPans: Record<string, number> = {};
  private channelInstrumentTypes: Record<string, "sampler" | "wam"> = {};
  public samplerEngine: SamplerEngine;
  public focusedChannelId: string | null = "obsidian_default";
  private channelNodes: Map<string, { gain: GainNode; panner: StereoPannerNode | null }> = new Map();
  private channelMixerTargets: Record<string, number> = {};
  public mixerManager: MixerManager;
  public onSampleLoadedCallback: (() => void) | null = null;
  public onClipDurationChangedCallback: ((clipId: string, durationBeats: number) => void) | null = null;
  private sampleBrowserPreviewSource: AudioBufferSourceNode | null = null;

  private wamInstances: Map<string, any> = new Map();
  private wamUrls: Map<string, string> = new Map();
  private wamGroupId: string | null = null;


  constructor(options: AudioEngineOptions = {}) {
    const bpm = options.bpm ?? 120;
    const lookaheadMs = options.lookaheadMs ?? 100;
    const tickIntervalMs = options.tickIntervalMs ?? 25;

    // Gracefully initialize Web Audio context
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass();
    this.sampleRegistry = new SampleRegistry(this.audioContext);


    // Set up standard sound-routing node tree
    this.masterGainNode = this.audioContext.createGain();
    this.masterGainNode.gain.setValueAtTime(0.8, this.audioContext.currentTime); // default comfortable volume
    this.masterGainNode.connect(this.audioContext.destination);

    // Initialize sampler engine!
    this.samplerEngine = new SamplerEngine(
      this.audioContext,
      this.masterGainNode,
      this.sampleRegistry,
      {
        getChannelNodes: (channelId) => this.getOrCreateChannelNodes(channelId),
        getMixerInsertGainNode: (index) => this.getOrCreateMixerInsert(index).inputNode || this.getOrCreateMixerInsert(index).gainNode,
        getChannelVolume: (channelId) => this.channelVols[channelId] ?? 80,
        getChannelPan: (channelId) => this.channelPans[channelId] ?? 0,
        getChannelMixerTarget: (channelId) => this.channelMixerTargets[channelId] ?? 1,
        beatsToSeconds: (beats) => this.beatsToSeconds(beats),
        getBPM: () => this.getBpm(),
        notifySampleLoaded: () => {
          if (this.onSampleLoadedCallback) {
            this.onSampleLoadedCallback();
          }
        },
        getCanvasClips: () => this.canvasClips,
        onClipDurationChanged: (clipId: string, durationBeats: number) => {
          if (this.onClipDurationChangedCallback) {
            this.onClipDurationChangedCallback(clipId, durationBeats);
          }
        }
      }
    );

    // Initialize mixer!
    this.mixerManager = new MixerManager(this.audioContext, this.masterGainNode);

    // Seed preset patterns for the visual workspace
    this.registerDefaultPatterns();

    // Auto-seed high-fidelity synthesized trap drum samples in memory
    this.seedDefaultSamples();

    // Initialize high-precision lookahead scheduler sub-module
    this.scheduler = new TransportScheduler(
      this.audioContext,
      this.masterGainNode,
      {
        scheduleTimelineSegment: (start, end, scheduledIds) => this.scheduleTimelineSegment(start, end, scheduledIds),
        triggerMetronomeClick: (beat, time) => this.triggerMetronomeClick(beat, time),
        getPatternLength: () => {
          const events = this.getEvents();
          if (events.length === 0) return 4;
          let maxBeat = 4;
          for (const e of events) {
            const endBeat = e.time + e.duration;
            if (endBeat > maxBeat) {
              maxBeat = endBeat;
            }
          }
          return Math.max(4, Math.ceil(maxBeat / 4) * 4);
        },
        onLoopWrap: (loopEndHardwareTime: number) => {
          this.wamInstances.forEach(instance => {
            try {
              if (typeof instance.noteOff === 'function') {
                for (let n = 0; n < 128; n++) instance.noteOff(n);
              } else if (typeof instance.scheduleEvents === 'function') {
                for (let n = 0; n < 128; n++) {
                  instance.scheduleEvents({
                    type: 'wam-midi',
                    time: this.audioContext.currentTime,
                    data: { bytes: new Uint8Array([0x80, n, 0]) }
                  });
                }
              }
            } catch (_) {}
          });
          this.wamInstances.forEach(instance => {
            try { instance.clearSchedule(); } catch (_) {}
          });
          this.samplerEngine.stopAll(0.03, loopEndHardwareTime);
        }
      },
      { bpm, lookaheadMs, tickIntervalMs }
    );
  }

  /**
   * Delegated Transport & Scheduling wrappers.
   * Delegating all operations to TransportScheduler to maintain backward compatibility.
   */
  public beatsToSeconds(beats: number): number {
    return this.scheduler.beatsToSeconds(beats);
  }

  public secondsToBeats(seconds: number): number {
    return this.scheduler.secondsToBeats(seconds);
  }

  public setBpm(newBpm: number) {
    this.scheduler.setBpm(newBpm);
    this.samplerEngine.invalidateStretchCacheForBpmChange();
  }

  public getBpm(): number {
    return this.scheduler.getBpm();
  }

  public play() {
    this.scheduler.play();
  }

  public async pause(): Promise<void> {
    await this.scheduler.pause();
    this.wamInstances.forEach(instance => {
      try {
        if (typeof instance.noteOff === 'function') {
          for (let n = 0; n < 128; n++) instance.noteOff(n);
        } else if (typeof instance.scheduleEvents === 'function') {
          for (let n = 0; n < 128; n++) {
            instance.scheduleEvents({
              type: 'wam-midi',
              time: this.audioContext.currentTime,
              data: { bytes: new Uint8Array([0x80, n, 0]) }
            });
          }
        }
      } catch (_) {}
    });
    this.wamInstances.forEach(instance => {
      try { instance.clearSchedule(); } catch (_) {}
    });
    this.samplerEngine.stopAll();
  }

  public stop() {
    this.scheduler.stop();
    this.wamInstances.forEach(instance => {
      try {
        if (typeof instance.noteOff === 'function') {
          for (let n = 0; n < 128; n++) instance.noteOff(n);
        } else if (typeof instance.scheduleEvents === 'function') {
          for (let n = 0; n < 128; n++) {
            instance.scheduleEvents({
              type: 'wam-midi',
              time: this.audioContext.currentTime,
              data: { bytes: new Uint8Array([0x80, n, 0]) }
            });
          }
        }
      } catch (_) {}
    });
    this.wamInstances.forEach(instance => {
      try { instance.clearSchedule(); } catch (_) {}
    });
    this.samplerEngine.stopAll();
    this.samplerEngine.stopPreview(); // stop any in-flight channel preview
    this.stopSampleBrowserPreview();  // stop any in-flight browser preview
  }

  public stopPreview(): void {
    this.samplerEngine.stopPreview();
  }

  public playSampleBrowserPreview(buffer: AudioBuffer): void {
    this.stopSampleBrowserPreview();
    if (this.audioContext.state === "suspended") this.audioContext.resume();
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.masterGainNode);
    source.start(0);
    this.sampleBrowserPreviewSource = source;
    source.onended = () => {
      if (this.sampleBrowserPreviewSource === source) {
        this.sampleBrowserPreviewSource = null;
      }
    };
  }

  public stopSampleBrowserPreview(): void {
    if (this.sampleBrowserPreviewSource) {
      try { this.sampleBrowserPreviewSource.stop(); } catch (_) {}
      try { this.sampleBrowserPreviewSource.disconnect(); } catch (_) {}
      this.sampleBrowserPreviewSource = null;
    }
  }

  public setPlayheadPosition(beats: number) {
    this.scheduler.setPlayheadPosition(beats);
    // Flush/cut off active voices on playhead jumps to prevent chaotic note overlapping
    this.samplerEngine.stopAll();
  }

  public getState(): TransportState {
    return this.scheduler.getState();
  }

  public getCurrentPosition(unit: "seconds" | "beats" = "seconds"): number {
    return this.scheduler.getCurrentPosition(unit);
  }



  public setLoop(active: boolean, startBeats?: number, endBeats?: number) {
    this.scheduler.setLoop(active, startBeats, endBeats);
  }

  public getLoopSettings(): { loopStart: number; loopEnd: number; loopEnabled: boolean; isLooping: boolean } {
    const s = this.scheduler.getLoopSettings();
    return {
      loopStart: s.loopStart,
      loopEnd: s.loopEnd,
      loopEnabled: s.isLooping,
      isLooping: s.isLooping
    };
  }

  public setLoopSettings(settings: { loopStart: number; loopEnd: number; loopEnabled: boolean }): void {
    this.scheduler.setLoop(settings.loopEnabled, settings.loopStart, settings.loopEnd);
  }

  public getPlaybackMode(): "pattern" | "song" {
    return this.scheduler.getPlaybackMode();
  }

  public setPlaybackMode(mode: "pattern" | "song") {
    this.scheduler.setPlaybackMode(mode);
  }

  public toggleMetronome(override?: boolean) {
    this.scheduler.toggleMetronome(override);
  }

  public isMetronomeEnabled(): boolean {
    return this.scheduler.isMetronomeEnabled();
  }

  public subscribeToStateChange(callback: (state: TransportState) => void): () => void {
    return this.scheduler.subscribeToStateChange(callback);
  }

  public subscribeToTimelineTick(callback: (seconds: number, beats: number) => void): () => void {
    return this.scheduler.subscribeToTimelineTick(callback);
  }

  /**
   * Searches and processes all sequence notes inside the requested timeline frame.
   * Maps relative sequence times to absolute Web Audio hardware clock seconds.
   */
  private scheduleTimelineSegment(
    startSeconds: number,
    endSeconds: number,
    scheduledIds?: Set<string>
  ): void {
    const startBeats = this.secondsToBeats(startSeconds);
    const endBeats = this.secondsToBeats(endSeconds);
    const playbackMode = this.getPlaybackMode();

    if (playbackMode === "pattern") {
      // Process custom defined notes/events (backward compatibility)
      for (const event of this.getEvents()) {
        const eventSecs = this.beatsToSeconds(event.time);
        const eventDurationSecs = this.beatsToSeconds(event.duration);
        const eventEndSecs = eventSecs + eventDurationSecs;

        // Case 1: Event starts within the current scheduling interval
        const eventStartsInWindow = event.time >= startBeats && event.time < endBeats;

        // Case 2: Event started before the current scheduling interval, but ends after startSeconds,
        // AND this is the very first tick of starting/resuming playback (to play ongoing mid-loaded samples/notes)
        const isStartInstantOfPlayback = this.scheduler.isGenuinePlaybackStart && Math.abs(startSeconds - this.scheduler.pausedTimelinePosition) < 0.075;
        const playheadIsInsideEvent = eventSecs < startSeconds && eventEndSecs > startSeconds;
        const eventIntersectionInPlaybackStart = isStartInstantOfPlayback && playheadIsInsideEvent;

        if (eventStartsInWindow || eventIntersectionInPlaybackStart) {
          const eventKey = `${event.channelId ?? 'default'}-${event.time}-${event.pitch ?? event.id}`;
          if (scheduledIds) {
            if (scheduledIds.has(eventKey)) continue;
            scheduledIds.add(eventKey);
          }

          if (event.sampleId) {
            // Trigger the sampler engine play function
            let targetHardwareTime = 0;
            let calculatedOffset = 0;

            if (eventStartsInWindow) {
              targetHardwareTime = this.scheduler.audioContextStartTime + (eventSecs - this.scheduler.pausedTimelinePosition);
              calculatedOffset = 0;
            } else {
              // Playhead started inside event boundaries (resume midpoint offset playback)
              targetHardwareTime = this.scheduler.audioContextStartTime;
              calculatedOffset = this.scheduler.pausedTimelinePosition - eventSecs;
            }

            this.triggerSample(event, targetHardwareTime, calculatedOffset);
          } else if (event.pitch !== undefined) {
            // Trigger the synthesizer play function
            if (eventStartsInWindow) {
              const targetHardwareTime = this.scheduler.audioContextStartTime + (eventSecs - this.scheduler.pausedTimelinePosition);
              this.synthesizeEvent(event, targetHardwareTime);
            }
          }
        }
      }
    } else {
      // Process unbound arranger Canvas clips
      for (const clip of this.canvasClips) {
        const clipStartSecs = this.beatsToSeconds(clip.startBeat);
        const clipDurationSecs = this.beatsToSeconds(clip.duration);
        const clipEndSecs = clipStartSecs + clipDurationSecs;

        if (clip.type === "sample") {
          const clipStartsInWindow = clip.startBeat >= startBeats && clip.startBeat < endBeats;
          const isStartInstantOfPlayback = this.scheduler.isGenuinePlaybackStart && Math.abs(startSeconds - this.scheduler.pausedTimelinePosition) < 0.075;
          const playheadIsInsideClip = clipStartSecs < startSeconds && clipEndSecs > startSeconds;
          const clipIntersectionInPlaybackStart = isStartInstantOfPlayback && playheadIsInsideClip;

          if (clipStartsInWindow || clipIntersectionInPlaybackStart) {
            const eventKey = `clip-sample-${clip.id}`;
            if (scheduledIds) {
              if (scheduledIds.has(eventKey)) continue;
              scheduledIds.add(eventKey);
            }

            let targetHardwareTime = 0;
            let calculatedOffset = this.beatsToSeconds(clip.cropStart || 0);

            if (clipStartsInWindow) {
              targetHardwareTime = this.scheduler.audioContextStartTime + (clipStartSecs - this.scheduler.pausedTimelinePosition);
              calculatedOffset += 0;
            } else {
              // Playhead coordinates started inside sample clip range (continuous midpoint alignment)
              targetHardwareTime = this.scheduler.audioContextStartTime;
              calculatedOffset += this.scheduler.pausedTimelinePosition - clipStartSecs;
            }

            this.triggerCanvasSample(clip, targetHardwareTime, calculatedOffset);
          }
        } else if (clip.type === "pattern") {
          const patternEvents = this.patterns[clip.referenceId];
          if (patternEvents) {
            const cropStart = clip.cropStart || 0;
            for (const note of patternEvents) {
              const visibleTime = note.time - cropStart;
              // Respect visual crop bounds
              if (visibleTime < 0 || visibleTime >= clip.duration) continue;

              const absoluteNoteBeat = clip.startBeat + visibleTime;
              const remainingDuration = Math.min(note.duration, clip.duration - visibleTime);
              if (remainingDuration <= 0) continue;

              const absoluteNoteSecs = this.beatsToSeconds(absoluteNoteBeat);
              const absoluteNoteDurationSecs = this.beatsToSeconds(remainingDuration);
              const absoluteNoteEndSecs = absoluteNoteSecs + absoluteNoteDurationSecs;

              const noteStartsInWindow = absoluteNoteBeat >= startBeats && absoluteNoteBeat < endBeats;
              const isStartInstantOfPlayback = this.scheduler.isGenuinePlaybackStart && Math.abs(startSeconds - this.scheduler.pausedTimelinePosition) < 0.075;
              const playheadIsInsideNote = absoluteNoteSecs < startSeconds && absoluteNoteEndSecs > startSeconds;
              const noteIntersectionInPlaybackStart = isStartInstantOfPlayback && playheadIsInsideNote;

              if (noteStartsInWindow || noteIntersectionInPlaybackStart) {
                const eventKey = `clip-pattern-${clip.id}-${note.id || (note.time + '-' + note.pitch)}`;
                if (scheduledIds) {
                  if (scheduledIds.has(eventKey)) continue;
                  scheduledIds.add(eventKey);
                }

                let targetHardwareTime = 0;
                let noteOffsetSecs = 0;

                if (noteStartsInWindow) {
                  targetHardwareTime = this.scheduler.audioContextStartTime + (absoluteNoteSecs - this.scheduler.pausedTimelinePosition);
                  noteOffsetSecs = 0;
                } else {
                  targetHardwareTime = this.scheduler.audioContextStartTime;
                  noteOffsetSecs = this.scheduler.pausedTimelinePosition - absoluteNoteSecs;
                }

                const actualDurationBeats = remainingDuration - this.secondsToBeats(noteOffsetSecs);
                if (actualDurationBeats > 0) {
                  if (note.sampleId) {
                    this.triggerSample(note, targetHardwareTime, noteOffsetSecs);
                  } else if (note.pitch !== undefined) {
                    const channelId = note.channelId || "obsidian_default";
                    const dawEvent: DAWEvent = {
                      id: `song-mode-note-${note.id || Date.now()}`,
                      time: absoluteNoteBeat,
                      duration: actualDurationBeats,
                      pitch: note.pitch,
                      velocity: note.velocity !== undefined ? note.velocity : 0.8,
                      channelId: channelId
                    };
                    this.synthesizeEvent(dawEvent, targetHardwareTime);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * Decodes an ArrayBuffer of an audio file and registers it as a reusable sample buffer.
   */
  public async loadSample(id: string, arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    return this.sampleRegistry.loadSample(id, arrayBuffer);
  }

  /**
   * Retrieves loaded sample identifiers.
   */
  public getLoadedSampleIds(): string[] {
    return this.sampleRegistry.getLoadedSampleIds();
  }

  /**
   * Retrieves specific loaded sample buffer.
   */
  public getSampleBuffer(id: string): AudioBuffer | undefined {
    let sampleId = id;
    if (id.startsWith("sampler_")) {
      const chanSampleId = this.samplerEngine.getChannelSampleId(id);
      if (chanSampleId) {
        sampleId = chanSampleId;
      }
    }
    return this.sampleRegistry.getSampleBuffer(sampleId);
  }

  /**
   * Dynamic updater methods for mirroring React state controls inside the Engine registry.
   */
  public updateChannelVolume(channelId: string, vol: number) {
    this.channelVols[channelId] = vol;
    const nodes = this.channelNodes.get(channelId);
    if (nodes) {
      const gainVal = vol / 100;
      const now = this.audioContext.currentTime;
      nodes.gain.gain.cancelScheduledValues(now);
      nodes.gain.gain.linearRampToValueAtTime(gainVal, now + 0.01);
    }
  }

  public updateChannelPan(channelId: string, pan: number) {
    this.channelPans[channelId] = pan;
    const nodes = this.channelNodes.get(channelId);
    if (nodes?.panner) {
      const now = this.audioContext.currentTime;
      nodes.panner.pan.cancelScheduledValues(now);
      nodes.panner.pan.linearRampToValueAtTime(pan / 50, now + 0.01);
    }
  }

  public updateChannelSamplerSettings(channelId: string, settings: SamplerSettings) {
    this.samplerEngine.updateChannelSamplerSettings(channelId, settings);
  }

  public getChannelSamplerSettings(channelId: string): SamplerSettings | undefined {
    return this.samplerEngine.getChannelSamplerSettings(channelId);
  }

  public updateChannelSampleId(channelId: string, sampleId: string) {
    this.samplerEngine.updateChannelSampleId(channelId, sampleId);
  }

  public updateChannelInstrumentType(channelId: string, type: "sampler" | "wam") {
    this.channelInstrumentTypes[channelId] = type;
  }

  public updateChannelMixerTarget(channelId: string, target: number) {
    const oldTarget = this.channelMixerTargets[channelId];
    this.channelMixerTargets[channelId] = target;

    const insert = this.getOrCreateMixerInsert(target);

    // If channel nodes already exist, reconnect them to the new Mixer insert
    const nodes = this.channelNodes.get(channelId);
    if (nodes && oldTarget !== target) {
      if (nodes.panner) {
        nodes.panner.disconnect();
        nodes.panner.connect(insert.inputNode || insert.gainNode);
      } else {
        nodes.gain.disconnect();
        nodes.gain.connect(insert.inputNode || insert.gainNode);
      }
    }
  }

  /**
   * Retrieves or creates cache-persistent audio routing nodes per channel.
   */
  private getOrCreateChannelNodes(channelId: string): { gain: GainNode; panner: StereoPannerNode | null } {
    let nodes = this.channelNodes.get(channelId);
    if (!nodes) {
      const gain = this.audioContext.createGain();
      const panner = this.audioContext.createStereoPanner ? this.audioContext.createStereoPanner() : null;

      const mixerTarget = this.channelMixerTargets[channelId] ?? 1;
      const insert = this.getOrCreateMixerInsert(mixerTarget);

      if (panner) {
        gain.connect(panner);
        panner.connect(insert.inputNode || insert.gainNode);
      } else {
        gain.connect(insert.inputNode || insert.gainNode);
      }

      nodes = { gain, panner };
      this.channelNodes.set(channelId, nodes);
    }
    return nodes;
  }

  private async ensureWamGroupInitialized(): Promise<string> {
    if (this.wamGroupId) return this.wamGroupId;
    const { initializeWamHost } = await import('@webaudiomodules/sdk');
    const [groupId] = await initializeWamHost(this.audioContext);
    this.wamGroupId = groupId;
    return groupId;
  }

  public async loadWAM(channelId: string, url: string): Promise<void> {
    try {
      const groupId = await this.ensureWamGroupInitialized();
      console.log(`[WAM] Loading WAM for channel ${channelId} from URL: ${url}`);
      const { default: WAMClass } = await import(/* @vite-ignore */ url);
      if (!WAMClass) {
        throw new Error(`WAM module at ${url} has no default export`);
      }
      if (typeof WAMClass.createInstance !== 'function') {
        throw new Error(`WAM module at ${url} does not have a createInstance method. Exported keys: ${Object.keys(WAMClass).join(', ')}`);
      }
      const instance = await WAMClass.createInstance(groupId, this.audioContext);
      console.log('[WAM] Instance keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(instance)));
      console.log('[WAM] Instance own keys:', Object.keys(instance));
      if (!instance) {
        throw new Error(`WAM createInstance returned null for ${url}`);
      }
      let audioNode = instance.audioNode;
      if (!audioNode) {
        console.log('[WAM] audioNode not ready, calling createAudioNode()');
        audioNode = await instance.createAudioNode();
      }
      if (!audioNode) {
        throw new Error(`WAM at ${url} has no audio node after createAudioNode()`);
      }

      const nodes = this.getOrCreateChannelNodes(channelId);

      const outputNode: AudioNode = (audioNode as any)._output ?? audioNode;
      console.log('[WAM] Connecting outputNode:', outputNode.constructor.name);
      outputNode.connect(nodes.gain);
      (instance as any)._canvasOutputNode = outputNode;
      this.wamInstances.set(channelId, instance);
      this.wamUrls.set(channelId, url);
      console.log(`[WAM] Successfully loaded WAM for channel ${channelId}`);
    } catch (err) {
      console.error(`[WAM] Failed to load WAM for channel ${channelId} from ${url}:`, err);
      throw err;
    }
  }

  public async unloadWAM(channelId: string): Promise<void> {
    const instance = this.wamInstances.get(channelId);
    if (!instance) return;
    try { 
      const outputNode = (instance as any)._canvasOutputNode ?? instance.audioNode;
      outputNode?.disconnect(); 
    } catch (_) {}
    try { instance.destroy?.(); } catch (_) {}
    this.wamInstances.delete(channelId);
    this.wamUrls.delete(channelId);
  }

  public getWAMState(channelId: string): any {
    const instance = this.wamInstances.get(channelId);
    if (!instance) return null;
    return instance.getState?.() ?? null;
  }

  public getWAMInstance(channelId: string): any {
    return this.wamInstances.get(channelId) ?? null;
  }


  public async setWAMState(channelId: string, state: any): Promise<void> {
    await this.wamInstances.get(channelId)?.setState(state);
  }

  public getWamChannels(): Record<string, { url: string; state: any }> {
    const result: Record<string, { url: string; state: any }> = {};
    this.wamInstances.forEach((_, channelId) => {
      result[channelId] = {
        url: this.wamUrls.get(channelId)!,
        state: this.getWAMState(channelId),
      };
    });
    return result;
  }

  public getWAMChannels(): Array<{
    channelId: string;
    url: string;
    state: any;
    mixerTarget: number;
  }> {
    const result: Array<{
      channelId: string;
      url: string;
      state: any;
      mixerTarget: number;
    }> = [];
    this.wamInstances.forEach((instance, channelId) => {
      result.push({
        channelId,
        url: this.wamUrls.get(channelId)!,
        state: instance.getState?.() ?? null,
        mixerTarget: this.getChannelMixerTarget(channelId),
      });
    });
    return result;
  }


  /**
   * Triggers a musical note on a channel interactively via MIDI (PC Keyboard or USB).
   * Automatically handles Obsidian Synth voice routing / polyphony and Sampler playback.
   */
  public triggerNoteOn(channelId: string | undefined | null, midiNote: number, velocity: number = 80, time?: number) {
    console.log('[MIDI] triggerNoteOn called — channelId:', channelId, '| targetChannelId will resolve to:', channelId || this.focusedChannelId || 'sampler_default', '| wamInstances keys:', Array.from(this.wamInstances.keys()));
    const targetChannelId = channelId || this.focusedChannelId || "sampler_default";

    const isWam = this.wamInstances.has(targetChannelId);
    if (isWam) {
      if (this.audioContext.state === 'suspended') this.audioContext.resume();
      const instance = this.wamInstances.get(targetChannelId)!;
      if (typeof instance.noteOn === 'function') {
        instance.noteOn(midiNote, velocity);
      } else {
        const audioNode = (instance as any)._audioNode ?? instance.audioNode;
        console.log('[WAM MIDI] scheduleEvents target:', audioNode, 'has scheduleEvents:', typeof audioNode?.scheduleEvents);
        if (typeof audioNode?.scheduleEvents === 'function') {
          audioNode.scheduleEvents({
            type: 'wam-midi',
            time: this.audioContext.currentTime + 0.05,
            data: { bytes: new Uint8Array([0x90, midiNote, velocity]) }
          });
        } else if (typeof instance.scheduleEvents === 'function') {
          instance.scheduleEvents({
            type: 'wam-midi',
            time: this.audioContext.currentTime + 0.05,
            data: { bytes: new Uint8Array([0x90, midiNote, velocity]) }
          });
        }
      }
      return;
    }

    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }

    const now = time !== undefined ? time : this.audioContext.currentTime;
    this.samplerEngine.noteOn(targetChannelId, midiNote, velocity, now);
  }

  /**
   * Terminate/Release a triggered musical note on a channel interactively.
   */
  public triggerNoteOff(channelId: string | undefined | null, midiNote: number, time?: number) {
    const targetChannelId = channelId || this.focusedChannelId || "sampler_default";

    const isWam = this.wamInstances.has(targetChannelId);
    if (isWam) {
      const instance = this.wamInstances.get(targetChannelId)!;
      if (typeof instance.noteOff === 'function') {
        instance.noteOff(midiNote);
      } else {
        const audioNode = (instance as any)._audioNode ?? instance.audioNode;
        console.log('[WAM MIDI] scheduleEvents target:', audioNode, 'has scheduleEvents:', typeof audioNode?.scheduleEvents);
        if (typeof audioNode?.scheduleEvents === 'function') {
          audioNode.scheduleEvents({
            type: 'wam-midi',
            time: this.audioContext.currentTime + 0.05,
            data: { bytes: new Uint8Array([0x80, midiNote, 0]) }
          });
        } else if (typeof instance.scheduleEvents === 'function') {
          instance.scheduleEvents({
            type: 'wam-midi',
            time: this.audioContext.currentTime + 0.05,
            data: { bytes: new Uint8Array([0x80, midiNote, 0]) }
          });
        }
      }
      return;
    }

    const now = time !== undefined ? time : this.audioContext.currentTime;
    this.samplerEngine.noteOff(targetChannelId, midiNote, now);
  }

  /**
   * Auditions a specific channel directly with high-precision hardware mapping,
   * routing through its GainNode, StereoPannerNode, and ADSR enveloper.
   */
  public previewChannel(
    channelId: string,
    sampleId?: string,
    volume?: number,
    pan?: number,
    settings?: any
  ) {
    if (volume !== undefined) this.channelVols[channelId] = volume;
    if (pan !== undefined) this.channelPans[channelId] = pan;

    const isWam = this.wamInstances.has(channelId);
    if (isWam) {
      const instance = this.wamInstances.get(channelId)!;
      const note = (settings?.pitch ?? 0) + 60;
      instance.noteOn(note, 100);
      setTimeout(() => instance.noteOff(note), 450);
      return;
    }

    this.samplerEngine.previewChannel(channelId, sampleId, volume, pan, settings);
  }

  /**
   * Triggers a public preview tone, routed cleanly through channel insert or master nodes,
   * avoiding exposing private AudioContext/gain node internals.
   */
  public triggerTonePreview(
    channelId: string,
    frequency: number,
    duration: number,
    waveformType: OscillatorType = "sine"
  ) {
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    osc.type = waveformType;
    osc.frequency.setValueAtTime(frequency, now);

    const volVal = this.channelVols[channelId] !== undefined ? this.channelVols[channelId] : 80;
    const multiplier = volVal / 100;

    // Use channel nodes or fallback to mixer insert target gain node
    const nodes = this.getOrCreateChannelNodes(channelId);
    let destination: AudioNode = this.masterGainNode;
    if (nodes && nodes.gain) {
      destination = nodes.gain;
    } else {
      const mixerTarget = this.channelMixerTargets[channelId] ?? 1;
      const targetInsert = this.getOrCreateMixerInsert(mixerTarget);
      destination = targetInsert.inputNode || targetInsert.gainNode;
    }

    gainNode.gain.setValueAtTime(0.2 * multiplier, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gainNode);
    gainNode.connect(destination);

    osc.start(now);
    osc.stop(now + duration);

    osc.onended = () => {
      try {
        osc.disconnect();
        gainNode.disconnect();
      } catch (err) { }
    };
  }

  /**
   * Plays a registered sample event with a hardware-accurate timeline target and optional offset.
   */
  private triggerSample(event: DAWEvent, absoluteContextTime: number, sampleOffsetSeconds: number = 0) {
    this.samplerEngine.triggerSample(event, absoluteContextTime, sampleOffsetSeconds);
  }

  /**
   * Hardware synthesizers: Translates our DAWEvent MIDI parameter into an absolute AudioNode circuit.
   */
  private synthesizeEvent(event: DAWEvent, absoluteContextTime: number) {
    if (event.pitch === undefined) return;

    const channelId = event.channelId;

    const isWam = channelId ? this.wamInstances.has(channelId) : false;
    if (isWam && channelId) {
      const instance = this.wamInstances.get(channelId)!;
      const durationSeconds = this.beatsToSeconds(event.duration);
      const velocity = Math.round((event.velocity ?? 0.8) * 127);
      
      if (typeof instance.scheduleNote === 'function') {
        instance.scheduleNote(absoluteContextTime, event.pitch, velocity);
        instance.scheduleNoteOff(absoluteContextTime + durationSeconds, event.pitch);
      } else if (typeof instance.scheduleEvents === 'function') {
        instance.scheduleEvents({
          type: 'wam-midi',
          time: absoluteContextTime,
          data: { bytes: new Uint8Array([0x90, event.pitch, velocity]) }
        });
        instance.scheduleEvents({
          type: 'wam-midi',
          time: absoluteContextTime + durationSeconds,
          data: { bytes: new Uint8Array([0x80, event.pitch, 0]) }
        });
      }
      return;
    }

    this.samplerEngine.triggerSample(event, absoluteContextTime);
  }

  /**
   * Sound generator for the standard metronome.
   */
  private triggerMetronomeClick(beatNumber: number, absoluteContextTime: number) {
    const osc = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    // Accent the downbeat of a typical 4/4 bar
    const isDownbeat = beatNumber % 4 === 0;
    osc.frequency.setValueAtTime(isDownbeat ? 1000 : 600, absoluteContextTime);
    osc.type = "triangle";

    gainNode.gain.setValueAtTime(0, absoluteContextTime);
    gainNode.gain.linearRampToValueAtTime(0.3, absoluteContextTime + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, absoluteContextTime + 0.08);

    osc.connect(gainNode);
    const masterInsert = this.getOrCreateMixerInsert(0);
    gainNode.connect(masterInsert.inputNode || masterInsert.gainNode);

    osc.start(absoluteContextTime);
    osc.stop(absoluteContextTime + 0.09);

    osc.onended = () => {
      try {
        osc.disconnect();
        gainNode.disconnect();
      } catch (err) {}
    };
  }



  /**
   * DAW Event Sequencer manipulation tools.
   */
  public setEvents(newEvents: DAWEvent[]) {
    if (!this.patterns[this.activePatternId]) {
      this.patterns[this.activePatternId] = [];
    }
    this.patterns[this.activePatternId] = [...newEvents];
  }

  public setPatternEvents(patternId: string, events: DAWEvent[]) {
    if (this.patterns[patternId]) {
      this.patterns[patternId] = [...events];
    }
  }

  public addEvent(newEvent: DAWEvent) {
    if (!this.patterns[this.activePatternId]) {
      this.patterns[this.activePatternId] = [];
    }
    this.patterns[this.activePatternId].push(newEvent);
  }

  public clearEvents() {
    this.patterns[this.activePatternId] = [];
  }

  public getEvents(): DAWEvent[] {
    if (!this.patterns[this.activePatternId]) {
      this.patterns[this.activePatternId] = [];
    }
    return this.patterns[this.activePatternId];
  }

  /**
   * Pattern management methods
   */
  public getActivePatternId(): string {
    return this.activePatternId;
  }

  public setActivePatternId(id: string) {
    if (this.patterns[id]) {
      this.activePatternId = id;
    }
  }

  public createPattern(id: string, name: string): void {
    if (!this.patterns[id]) {
      this.patterns[id] = [];
      this.patternNames[id] = name;
    }
  }

  public renamePattern(id: string, newName: string): void {
    if (this.patternNames[id] !== undefined) {
      this.patternNames[id] = newName;
    }
  }

  public deletePattern(id: string): void {
    // 1. Canvas Cleanup: remove stamped clips referencing this patternId
    this.canvasClips = this.canvasClips.filter(clip => clip.referenceId !== id);

    // 2. Delete the pattern itself
    delete this.patterns[id];
    delete this.patternNames[id];

    // 3. Fallback Safety
    const remainingIds = Object.keys(this.patterns);
    if (remainingIds.length === 0) {
      this.activePatternId = "pattern1";
      this.patterns["pattern1"] = [];
      this.patternNames["pattern1"] = "Pattern 1";
    } else if (this.activePatternId === id) {
      this.activePatternId = remainingIds[0];
    }
  }

  public getPatternNames(): Record<string, string> {
    return this.patternNames;
  }

  public getPatterns(): Record<string, DAWEvent[]> {
    return this.patterns;
  }

  public getPatternsList(): PatternData[] {
    return Object.keys(this.patterns).map(id => {
      const pEvents = this.patterns[id] || [];
      const notes: PatternNote[] = pEvents.map(e => ({
        pitch: e.pitch,
        time: e.time,
        duration: e.duration,
        velocity: e.velocity,
        sampleId: e.sampleId,
        channelId: e.channelId
      }));
      return {
        id,
        name: this.patternNames[id] || id,
        notes,
        color: "from-cyan-500/10 to-cyan-500/20 text-cyan-400 border-cyan-500/30"
      };
    });
  }

  public setPatternsList(list: PatternData[]) {
    this.patterns = {};
    this.patternNames = {};

    list.forEach(p => {
      this.patterns[p.id] = p.notes.map((n, idx) => ({
        id: `note-${p.id}-${idx}-${Date.now()}`,
        time: n.time,
        duration: n.duration,
        pitch: n.pitch,
        velocity: n.velocity ?? 0.8,
        sampleId: n.sampleId,
        channelId: n.channelId
      }));
      this.patternNames[p.id] = p.name;
    });

    if (!this.patterns[this.activePatternId]) {
      const keys = Object.keys(this.patterns);
      if (keys.length > 0) {
        this.activePatternId = keys[0];
      } else {
        this.activePatternId = "pattern1";
        this.patterns["pattern1"] = [];
        this.patternNames["pattern1"] = "Pattern 1";
      }
    }
  }



  /**
   * Seed standard visual-clip synthesis models.
   */
  private registerDefaultPatterns() {
    // Strict Default State: Exactly ONE empty pattern named "Pattern 1"
    this.patterns["pattern1"] = [];
    this.patternNames["pattern1"] = "Pattern 1";
    this.activePatternId = "pattern1";
  }

  /**
   * Auto-synthesizes Trap drum assets and registers them as memory buffers.
   */
  private async seedDefaultSamples() {
    try {
      const kickWav = generateDrumSampleWav("kick");
      const snareWav = generateDrumSampleWav("snare");
      const hihatWav = generateDrumSampleWav("hihat");

      await this.loadSample("sampler_kick_sample", kickWav);
      await this.loadSample("sampler_snare_sample", snareWav);
      await this.loadSample("sampler_hihat_sample", hihatWav);

      // Fallback for default sampler reference
      await this.loadSample("sampler_default_sample", kickWav);

      console.log("Canvas DAW: Synthesized modern trap drums successfully pre-seeded.");
    } catch (e) {
      console.error("Canvas DAW: Failed to pre-seed trap drums", e);
    }
  }

  /**
   * Instantiate an AudioBufferSourceNode for Canvas clip samples with precision offsets.
   */
  private triggerCanvasSample(clip: CanvasClip, absoluteContextTime: number, sampleOffsetSeconds: number = 0) {
    this.samplerEngine.triggerCanvasSample(clip, absoluteContextTime, sampleOffsetSeconds);
  }



  /**
   * Delegated Mixer Console & Audio Node Routing wrappers.
   * Delegating all operations to MixerManager to maintain backward compatibility.
   */
  public getOrCreateMixerInsert(index: number): MixerInsert {
    return this.mixerManager.getOrCreateMixerInsert(index);
  }

  public getInserts(): MixerInsert[] {
    return this.mixerManager.getInserts();
  }

  public renameInsert(index: number, newName: string) {
    this.mixerManager.renameInsert(index, newName);
  }

  public updateInsertVolume(index: number, volume: number) {
    this.mixerManager.updateInsertVolume(index, volume);
  }

  public updateInsertPan(index: number, pan: number) {
    this.mixerManager.updateInsertPan(index, pan);
  }

  public updateInsertMute(index: number, isMuted: boolean) {
    this.mixerManager.updateInsertMute(index, isMuted);
  }

  public updateInsertSolo(index: number, isSoloed: boolean) {
    this.mixerManager.updateInsertSolo(index, isSoloed);
  }

  public getInsertLevels(index: number): { rms: number; peak: number } {
    return this.mixerManager.getInsertLevels(index);
  }

  public getChannelMixerTarget(channelId: string): number {
    return this.channelMixerTargets[channelId] ?? 1;
  }

  public setInsertFXSlot(insertIndex: number, slotIndex: number, fxName: string) {
    this.mixerManager.setInsertFXSlot(insertIndex, slotIndex, fxName);
  }

  public setInsertFXBypass(insertIndex: number, slotIndex: number, bypass: boolean) {
    this.mixerManager.setInsertFXBypass(insertIndex, slotIndex, bypass);
  }

  public updateInsertEQBand(insertIndex: number, slotIndex: number, bandIndex: number, settings: Partial<EQBandSettings>) {
    this.mixerManager.updateInsertEQBand(insertIndex, slotIndex, bandIndex, settings);
  }

  public updateInsertReverbParam(insertIndex: number, slotIndex: number, settings: Partial<ReverbSettings>) {
    this.mixerManager.updateInsertReverbParam(insertIndex, slotIndex, settings);
  }

  /**
   * Arranger Canvas clip manipulators.
   */
  public getCanvasClips(): CanvasClip[] {
    return this.canvasClips;
  }

  public resolveChannelId(referenceId: string): string | undefined {
    return this.samplerEngine.resolveChannelId(referenceId);
  }

  public setCanvasClips(clips: CanvasClip[]) {
    this.canvasClips = [...clips];
    for (const clip of this.canvasClips) {
      if (clip.type === "sample") {
        this.samplerEngine.ensureClipStretched(clip);
      }
    }
  }

  public addCanvasClip(clip: CanvasClip) {
    this.canvasClips.push(clip);
    if (clip.type === "sample") {
      this.samplerEngine.ensureClipStretched(clip);
    }
  }

  public removeCanvasClip(id: string) {
    this.canvasClips = this.canvasClips.filter(c => c.id !== id);
  }

  public updateClipDuration(clipId: string, durationBeats: number) {
    const clip = this.canvasClips.find(c => c.id === clipId);
    if (clip) {
      clip.duration = durationBeats;
    }
  }

  public isClipLoading(clipId: string): boolean {
    return this.samplerEngine.isClipLoading(clipId);
  }

  public awaitStretchJob(clipId: string): Promise<void> {
    return this.samplerEngine.awaitStretchJob(clipId);
  }

  public getAllSamplerSettings(): Record<string, SamplerSettings> {
    return this.samplerEngine.getAllSamplerSettings();
  }

  public restoreAllSamplerSettings(settings: Record<string, SamplerSettings>): void {
    this.samplerEngine.restoreAllSamplerSettings(settings);
  }

  public getMixerInserts(): MixerInsert[] {
    return this.mixerManager.getInserts();
  }

  public restoreMixerInserts(inserts: MixerInsert[]): void {
    this.mixerManager.restoreMixerInserts(inserts);
  }
}
