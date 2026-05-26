/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TransportState = "playing" | "paused" | "stopped";

export interface SchedulerDelegate {
  scheduleTimelineSegment: (startSeconds: number, endSeconds: number) => void;
  triggerMetronomeClick: (beatNumber: number, absoluteContextTime: number) => void;
  getPatternLength?: () => number;
}

/**
 * TransportScheduler encapsulates all lookahead timeline scheduling maths, playhead coordinates,
 * BPM state, looping wrappers, subscriber broadcasts, and Web Worker thread operations.
 * Decoupled from AudioEngine.ts as part of Phase 3 Refactoring.
 */
export class TransportScheduler {
  private audioContext: AudioContext;
  private masterGainNode: GainNode;
  private delegate: SchedulerDelegate;

  // Clocks and timing variables
  private state: TransportState = "stopped";
  private bpm: number = 120;
  private playbackMode: "pattern" | "song" = "pattern";

  private lookaheadMs: number = 100;
  private tickIntervalMs: number = 25;
  private customStartPosition: number = 0;

  // Anchors for high-precision timeline calculations (public so facade delegate can read them)
  public audioContextStartTime: number = 0;
  public pausedTimelinePosition: number = 0;
  public nextTimelineTimeToSchedule: number = 0;

  // Loop bounding settings
  private isLooping: boolean = false;
  private loopStart: number = 0;
  private loopEnd: number = 4;

  // Metronome state
  private metronomeEnabled: boolean = false;
  private nextMetronomeBeatToSchedule: number = 0;

  // background thread Web Worker
  private worker: Worker | null = null;

  // State Change Event Callbacks
  private onStateChangeCallbacks: Array<(state: TransportState) => void> = [];
  private onTimelineTickCallbacks: Array<(currentPositionSeconds: number, currentPositionBeats: number) => void> = [];

  constructor(
    audioContext: AudioContext,
    masterGainNode: GainNode,
    delegate: SchedulerDelegate,
    options: { bpm?: number; lookaheadMs?: number; tickIntervalMs?: number } = {}
  ) {
    this.audioContext = audioContext;
    this.masterGainNode = masterGainNode;
    this.delegate = delegate;
    this.bpm = options.bpm ?? 120;
    this.lookaheadMs = options.lookaheadMs ?? 100;
    this.tickIntervalMs = options.tickIntervalMs ?? 25;

    this.initWorker();
  }

  /**
   * Initializes the Web Worker thread and registers our lookahead trigger listener.
   */
  private initWorker() {
    try {
      // Modern Vite Worker integration pattern
      this.worker = new Worker(
        new URL("./scheduler.worker.ts", import.meta.url),
        { type: "module" }
      );

      // Tell worker how fast to emit tick checks
      this.worker.postMessage({ action: "setInterval", interval: this.tickIntervalMs });

      // Handle the tick messages posted from our background thread worker
      this.worker.onmessage = (event: MessageEvent) => {
        if (event.data.type === "tick") {
          this.executeSchedulerTick();
        }
      };
    } catch (error) {
      console.error("Failed to spin up DAW scheduling Worker. Fallback timers will be used.", error);
    }
  }

  /**
   * Convert linear beat units to high-precision hardware audio timeline seconds.
   */
  public beatsToSeconds(beats: number): number {
    return (beats / this.bpm) * 60;
  }

  /**
   * Convert hardware audio timeline seconds back into beat-relative units.
   */
  public secondsToBeats(seconds: number): number {
    return (seconds / 60) * this.bpm;
  }

  /**
   * Regulates dynamic metadata settings.
   */
  public setBpm(newBpm: number) {
    if (newBpm <= 0) return;

    // To allow real-time tempo changes WITHOUT audio warping or transport glitches,
    // we must lock in our current physical playhead position in seconds before changing the BPM scaling.
    const currentPositionSeconds = this.getCurrentPosition("seconds");

    this.bpm = newBpm;

    if (this.state === "playing") {
      // Re-anchor the timeline with updated BPM projection parameters
      this.audioContextStartTime = this.audioContext.currentTime;
      this.pausedTimelinePosition = currentPositionSeconds;
      this.nextTimelineTimeToSchedule = currentPositionSeconds;
    } else {
      this.pausedTimelinePosition = currentPositionSeconds;
      this.nextTimelineTimeToSchedule = currentPositionSeconds;
    }
  }

  public getBpm(): number {
    return this.bpm;
  }

  /**
   * Standard Transport Controls: PLAY
   */
  public play() {
    if (this.state === "playing") return;

    // Browser restriction safeguard: Audio contexts are muted/suspended until user interaction occurs
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }

    this.state = "playing";
    this.broadcastStateChange();

    // Capture the hardware audio clocks anchor state with a 50ms pre-roll delay
    // This allows the background web worker thread and Audio Context nodes to initialize cleanly
    // and completely prevents the lookahead clock start-up note bunching bug.
    this.audioContextStartTime = this.audioContext.currentTime + 0.050;

    // Start lookahead cursor from where the playhead currently sits
    this.nextTimelineTimeToSchedule = this.pausedTimelinePosition;

    // Synchronize the metronome scheduler cursor beats
    this.nextMetronomeBeatToSchedule = Math.ceil(this.secondsToBeats(this.pausedTimelinePosition));

    // Spin up the background web worker setInterval loop
    if (this.worker) {
      this.worker.postMessage({ action: "start" });
    }

    // De-clicking: ramp master gain back up to standard level (0.8) aligned with start time
    const now = this.audioContext.currentTime;
    this.masterGainNode.gain.cancelScheduledValues(now);
    this.masterGainNode.gain.setValueAtTime(0, now);
    this.masterGainNode.gain.linearRampToValueAtTime(0.8, this.audioContextStartTime + 0.010);
  }

  /**
   * Standard Transport Controls: PAUSE
   */
  public pause() {
    if (this.state !== "playing") return;

    this.state = "paused";
    this.broadcastStateChange();

    // Apply exact 10ms fade-out curve to master gain to suppress click
    const now = this.audioContext.currentTime;
    this.masterGainNode.gain.cancelScheduledValues(now);
    this.masterGainNode.gain.setValueAtTime(0.8, now);
    this.masterGainNode.gain.linearRampToValueAtTime(0, now + 0.010);

    // Freeze background heartbeat lookahead checks after 12ms
    setTimeout(() => {
      if (this.worker) {
        this.worker.postMessage({ action: "stop" });
      }

      // Freeze the playhead instantly with sub-millisecond precision
      const elapsedContextTime = this.audioContext.currentTime - this.audioContextStartTime;
      this.pausedTimelinePosition += elapsedContextTime;

      // Restore master gain to 0.8 for live preview and keyboard play while transport is stopped/paused
      const nowRamp = this.audioContext.currentTime;
      this.masterGainNode.gain.cancelScheduledValues(nowRamp);
      this.masterGainNode.gain.setValueAtTime(0, nowRamp);
      this.masterGainNode.gain.linearRampToValueAtTime(0.8, nowRamp + 0.010);
    }, 12);
  }

  /**
   * Standard Transport Controls: STOP
   */
  public stop() {
    if (this.state === "stopped") {
      // A subsequent press of the Stop button (when already stopped) resets the playhead completely back to 0:00
      this.customStartPosition = 0;
      this.pausedTimelinePosition = 0;
      this.nextTimelineTimeToSchedule = 0;
      this.nextMetronomeBeatToSchedule = 0;
      this.broadcastStateChange();
      this.broadcastTimelineTick();
      return;
    }

    this.state = "stopped";
    this.broadcastStateChange();

    // Apply exact 10ms fade-out curve to master gain to suppress click
    const now = this.audioContext.currentTime;
    this.masterGainNode.gain.cancelScheduledValues(now);
    this.masterGainNode.gain.setValueAtTime(0.8, now);
    this.masterGainNode.gain.linearRampToValueAtTime(0, now + 0.010);

    // Cancel state completely after 12ms fade-out
    setTimeout(() => {
      // Freeze the background clock
      if (this.worker) {
        this.worker.postMessage({ action: "stop" });
      }

      // Return playhead to the custom start placement, not 0:00
      this.pausedTimelinePosition = this.customStartPosition;
      this.nextTimelineTimeToSchedule = this.customStartPosition;
      this.nextMetronomeBeatToSchedule = Math.ceil(this.secondsToBeats(this.customStartPosition));
      this.broadcastTimelineTick();

      // Restore master gain to 0.8 for live preview and keyboard play while transport is stopped/paused
      const nowRamp = this.audioContext.currentTime;
      this.masterGainNode.gain.cancelScheduledValues(nowRamp);
      this.masterGainNode.gain.setValueAtTime(0, nowRamp);
      this.masterGainNode.gain.linearRampToValueAtTime(0.8, nowRamp + 0.010);
    }, 12);
  }

  /**
   * Custom starting position setter for clicking timeline ruler
   */
  public setPlayheadPosition(beats: number) {
    const seconds = this.beatsToSeconds(beats);
    this.customStartPosition = seconds;
    this.pausedTimelinePosition = seconds;
    this.nextTimelineTimeToSchedule = seconds;
    this.nextMetronomeBeatToSchedule = Math.ceil(beats);

    if (this.state === "playing") {
      this.audioContextStartTime = this.audioContext.currentTime;
    }

    this.broadcastTimelineTick();
  }

  /**
   * Retrieves the current human-readable transport string.
   */
  public getState(): TransportState {
    return this.state;
  }

  public getPlaybackMode(): "pattern" | "song" {
    return this.playbackMode;
  }

  public setPlaybackMode(mode: "pattern" | "song") {
    this.playbackMode = mode;
  }

  /**
   * Configure loop points.
   */
  public setLoop(active: boolean, startBeats?: number, endBeats?: number) {
    this.isLooping = active;
    if (startBeats !== undefined) this.loopStart = startBeats;
    if (endBeats !== undefined) this.loopEnd = endBeats;
  }

  public getLoopSettings() {
    return {
      isLooping: this.isLooping,
      loopStart: this.loopStart,
      loopEnd: this.loopEnd,
    };
  }

  /**
   * Metronome click toggle.
   */
  public toggleMetronome(override?: boolean) {
    this.metronomeEnabled = override ?? !this.metronomeEnabled;
  }

  public isMetronomeEnabled(): boolean {
    return this.metronomeEnabled;
  }

  /**
   * Live Playhead Projection Utility:
   * Provides dynamic, sub-millisecond hardware-derived transport positions to any UI widget.
   */
  public getCurrentPosition(unit: "seconds" | "beats" = "seconds"): number {
    if (this.state === "playing") {
      const elapsedHardwareTime = this.audioContext.currentTime - this.audioContextStartTime;
      const totalSeconds = this.pausedTimelinePosition + Math.max(0, elapsedHardwareTime);
      return unit === "seconds" ? totalSeconds : this.secondsToBeats(totalSeconds);
    }

    return unit === "seconds" ? this.pausedTimelinePosition : this.secondsToBeats(this.pausedTimelinePosition);
  }

  /**
   * THE CORE AUDIO SCHEDULER ENGINE:
   * Evaluates the time delta between the lookahead boundaries and prepares hardware-accurate signals ahead of time.
   */
  private executeSchedulerTick() {
    if (this.state !== "playing") return;

    const currentContextTime = this.audioContext.currentTime;

    // Get the exact hardware context target boundary
    const lookaheadEndContextTime = currentContextTime + (this.lookaheadMs / 1000);

    // Map this hardware time frame back to the relative DAW timeline seconds
    const startTimelineSeconds = this.nextTimelineTimeToSchedule;
    let endTimelineSeconds = this.pausedTimelinePosition + (lookaheadEndContextTime - this.audioContextStartTime);

    // Calculate loop bounding conditions
    let loopedEndSeconds: number | null = null;
    const activeIsLooping = this.playbackMode === "pattern" ? true : this.isLooping;
    const loopStartSeconds = this.playbackMode === "pattern" ? 0 : this.beatsToSeconds(this.loopStart);

    const patternBeats = this.playbackMode === "pattern" && this.delegate.getPatternLength
      ? this.delegate.getPatternLength()
      : 4;
    const loopEndSeconds = this.playbackMode === "pattern"
      ? this.beatsToSeconds(patternBeats)
      : this.beatsToSeconds(this.loopEnd);

    if (activeIsLooping && endTimelineSeconds >= loopEndSeconds) {
      // Capture overlap that crosses loop boundary
      loopedEndSeconds = endTimelineSeconds - loopEndSeconds;

      // Cut this scheduling wave short at loopEndSeconds
      endTimelineSeconds = loopEndSeconds;
    }

    // 1. Schedule all matching events in our current window segment
    this.delegate.scheduleTimelineSegment(startTimelineSeconds, endTimelineSeconds);

    // Handlers for metronome ticking if audio output testing is active
    if (this.metronomeEnabled) {
      let nextBeatToSchedule = this.nextMetronomeBeatToSchedule;
      const endBeats = this.secondsToBeats(endTimelineSeconds);
      const startBeats = this.secondsToBeats(startTimelineSeconds);
      while (nextBeatToSchedule < endBeats) {
        if (nextBeatToSchedule >= startBeats) {
          const beatSecs = this.beatsToSeconds(nextBeatToSchedule);
          const targetHardwareTime = this.audioContextStartTime + (beatSecs - this.pausedTimelinePosition);

          this.delegate.triggerMetronomeClick(nextBeatToSchedule, targetHardwareTime);
        }
        nextBeatToSchedule++;
      }
      this.nextMetronomeBeatToSchedule = nextBeatToSchedule;
    }

    // 2. Perform looping wrap-around math if a boundary was crossed
    if (activeIsLooping && loopedEndSeconds !== null) {
      // Reposition our anchor offsets:
      // We physically shift the audio start time anchor forward by the loop length.
      // In the context of "t_timeline = t_start_timeline + (t_context - t_start_audio)",
      // shifting t_start_audio forward resets our timeline playhead back to loopStartSeconds.
      const loopDurationSeconds = loopEndSeconds - loopStartSeconds;
      this.audioContextStartTime += loopDurationSeconds;

      // BUGFIX: Also reset pausedTimelinePosition to loopStartSeconds.
      // getCurrentPosition() computes: pausedTimelinePosition + (currentTime - audioContextStartTime).
      // Without this, pausedTimelinePosition still points to the pre-wrap seconds value,
      // causing the displayed playhead to jump backward after every loop wrap.
      this.pausedTimelinePosition = loopStartSeconds;

      // Wrap lookahead scheduling window back to loopStartSeconds
      this.nextTimelineTimeToSchedule = loopStartSeconds;

      // Schedule the remaining wrapped timeline section
      const nextEnd = loopStartSeconds + loopedEndSeconds;
      this.delegate.scheduleTimelineSegment(loopStartSeconds, nextEnd);

      // Handle looped metronome ticking
      if (this.metronomeEnabled) {
        let nextBeatLooped = Math.ceil(this.secondsToBeats(loopStartSeconds));
        const endBeatsLooped = this.secondsToBeats(nextEnd);
        const startBeatsLooped = this.secondsToBeats(loopStartSeconds);
        while (nextBeatLooped < endBeatsLooped) {
          if (nextBeatLooped >= startBeatsLooped) {
            const beatSecs = this.beatsToSeconds(nextBeatLooped);
            const targetHardwareTime = this.audioContextStartTime + (beatSecs - this.pausedTimelinePosition);

            this.delegate.triggerMetronomeClick(nextBeatLooped, targetHardwareTime);
          }
          nextBeatLooped++;
        }
        this.nextMetronomeBeatToSchedule = nextBeatLooped;
      }

      this.nextTimelineTimeToSchedule = nextEnd;
    } else {
      // Increment scheduler track position to the end of the evaluated lookahead window
      this.nextTimelineTimeToSchedule = endTimelineSeconds;
    }

    // Inform subscribing classes of new real-time coordinate position changes
    this.broadcastTimelineTick();
  }

  /**
   * Listeners for transport state changes.
   */
  public subscribeToStateChange(callback: (state: TransportState) => void): () => void {
    this.onStateChangeCallbacks.push(callback);
    return () => {
      this.onStateChangeCallbacks = this.onStateChangeCallbacks.filter(c => c !== callback);
    };
  }

  /**
   * Listeners for timeline playhead ticks.
   */
  public subscribeToTimelineTick(callback: (seconds: number, beats: number) => void): () => void {
    this.onTimelineTickCallbacks.push(callback);
    return () => {
      this.onTimelineTickCallbacks = this.onTimelineTickCallbacks.filter(c => c !== callback);
    };
  }

  private broadcastStateChange() {
    this.onStateChangeCallbacks.forEach(callback => callback(this.state));
  }

  private broadcastTimelineTick() {
    const secs = this.getCurrentPosition("seconds");
    const beats = this.getCurrentPosition("beats");
    this.onTimelineTickCallbacks.forEach(callback => callback(secs, beats));
  }
}
