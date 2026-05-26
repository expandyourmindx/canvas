/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { AudioEngine, DAWEvent, TransportState } from "./AudioEngine";
import { CanvasClip, PatternData } from "../types";

export interface AudioEngineContextType {
  /** The raw AudioEngine instance, if direct low-level API access is required. */
  engine: AudioEngine;

  /** Active playing, paused, or stopped transport state. */
  playbackState: TransportState;

  /** Active playback routing: pattern mode vs song master mode. */
  playbackMode: "pattern" | "song";

  /** Throttled current playhead coordinates (for smooth 60fps UI playhead movement). */
  position: { seconds: number; beats: number };

  /** Current Tempo in Beats Per Minute (BPM). */
  bpm: number;

  /** Enables/disables the auditable metronome ticks. */
  metronomeEnabled: boolean;

  /** Looping active and bounding configurations. */
  loopSettings: { isLooping: boolean; loopStart: number; loopEnd: number };

  /** Active MIDI events. */
  events: DAWEvent[];

  /** Arranger Canvas Clips */
  canvasClips: CanvasClip[];

  /** Registered MIDI Patterns */
  patterns: PatternData[];

  /** The active playing or editing pattern ID */
  activePatternId: string;

  // Core Actions
  play: () => void;
  pause: () => void;
  stop: () => void;
  setBpm: (bpm: number) => void;
  setPlaybackMode: (mode: "pattern" | "song") => void;
  toggleMetronome: (override?: boolean) => void;
  setLoop: (active: boolean, startBeats?: number, endBeats?: number) => void;
  setPlayheadPosition: (beats: number) => void;

  // Note List Modifiers
  setEvents: (events: DAWEvent[] | ((prev: DAWEvent[]) => DAWEvent[])) => void;
  addEvent: (event: DAWEvent) => void;
  clearEvents: () => void;

  // Arranger Canvas Modifiers
  setCanvasClips: (clips: CanvasClip[] | ((prev: CanvasClip[]) => CanvasClip[])) => void;
  addCanvasClip: (clip: CanvasClip) => void;
  removeCanvasClip: (id: string) => void;

  // Custom Sampler Utility
  getSampleBuffer: (sampleId: string) => AudioBuffer | undefined;
  previewChannel: (channelId: string, sampleId?: string, volume?: number, pan?: number, settings?: any) => void;
  triggerNoteOn: (channelId: string | null | undefined, midiNote: number, velocity?: number) => void;
  triggerNoteOff: (channelId: string | null | undefined, midiNote: number) => void;

  // Pattern management actions
  setActivePatternId: (id: string) => void;
  createPattern: (id: string, name: string) => void;
  renamePattern: (id: string, newName: string) => void;
  deletePattern: (id: string) => void;

  // Keyboard MIDI Global State
  pcKeyboardMidiActive: boolean;
  setPcKeyboardMidiActive: (active: boolean) => void;
  baseOctave: number;
  setBaseOctave: (octave: number) => void;
  focusedChannelId: string | null;
  setFocusedChannelId: (id: string | null) => void;
  activeMidiNotes: Record<number, boolean>;

  // Undo / Redo Actions
  undo: () => void;
  redo: () => void;
  pushToHistory: () => void;

  // Sample loading reactivity
  sampleCount: number;
  notifySampleLoaded: () => void;
}

export const AudioEngineContext = createContext<AudioEngineContextType | null>(null);

interface AudioEngineProviderProps {
  children: ReactNode;
}

interface ProjectState {
  events: DAWEvent[];
  canvasClips: CanvasClip[];
  patterns: PatternData[];
}

export function AudioEngineProvider({ children }: AudioEngineProviderProps) {
  // 1. Singleton Instantiation of our pure high-precision lookahead hardware engine.
  // We initialize the AudioEngine inside a useRef so it acts as a persistent singleton
  // that survives hot-module reloading and reactive re-renders.
  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new AudioEngine();
  }
  const engine = engineRef.current;

  // History / Undo / Redo Ref stack
  const historyRef = useRef<ProjectState[]>([]);
  const historyIndexRef = useRef<number>(-1);

  // React state elements for UI consumption
  const [playbackState, setPlaybackState] = useState<TransportState>(engine.getState());
  const [playbackMode, setPlaybackModeState] = useState<"pattern" | "song">(engine.getPlaybackMode());
  const [bpm, setBpmState] = useState<number>(engine.getBpm());
  const [metronomeEnabled, setMetronomeEnabled] = useState<boolean>(engine.isMetronomeEnabled());
  const [loopSettings, setLoopSettings] = useState(engine.getLoopSettings());
  const [events, setEventsState] = useState<DAWEvent[]>(engine.getEvents());
  const [canvasClips, setCanvasClipsState] = useState<CanvasClip[]>(engine.getCanvasClips());
  const [patterns, setPatternsState] = useState<PatternData[]>(engine.getPatternsList());
  const [activePatternId, setActivePatternIdState] = useState<string>(engine.getActivePatternId());

  // React state elements for Keyboard MIDI support
  const [pcKeyboardMidiActive, setPcKeyboardMidiActive] = useState<boolean>(true);
  const [baseOctave, setBaseOctave] = useState<number>(4);
  const [focusedChannelId, setFocusedChannelId] = useState<string | null>("obsidian_default");
  const [activeMidiNotes, setActiveMidiNotes] = useState<Record<number, boolean>>({});

  useEffect(() => {
    engine.focusedChannelId = focusedChannelId;
  }, [engine, focusedChannelId]);

  // 4. Undo/Redo State Serialization stack
  const pushToHistory = useCallback(() => {
    const stateToPush: ProjectState = {
      events: structuredClone(engine.getEvents()),
      canvasClips: structuredClone(engine.getCanvasClips()),
      patterns: structuredClone(engine.getPatternsList()),
    };

    const currentHistory = historyRef.current.slice(0, historyIndexRef.current + 1);

    // Check if identical to prevent duplicating history frames
    const lastState = currentHistory[currentHistory.length - 1];
    if (lastState) {
      const isIdentical =
        JSON.stringify(lastState.events) === JSON.stringify(stateToPush.events) &&
        JSON.stringify(lastState.canvasClips) === JSON.stringify(stateToPush.canvasClips) &&
        JSON.stringify(lastState.patterns) === JSON.stringify(stateToPush.patterns);
      if (isIdentical) return;
    }

    currentHistory.push(stateToPush);
    if (currentHistory.length > 50) {
      currentHistory.shift();
    }

    historyRef.current = currentHistory;
    historyIndexRef.current = currentHistory.length - 1;
    console.log(`[Undo/Redo System] Pushed state to history. Index: ${historyIndexRef.current}`);
  }, [engine]);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const targetState = historyRef.current[historyIndexRef.current];

      engine.setEvents(structuredClone(targetState.events));
      engine.setCanvasClips(structuredClone(targetState.canvasClips));
      engine.setPatternsList(structuredClone(targetState.patterns));

      // Sync React state
      setEventsState(engine.getEvents());
      setCanvasClipsState(engine.getCanvasClips());
      setPatternsState(engine.getPatternsList());
      console.log(`[Undo/Redo System] Executed Undo. Index: ${historyIndexRef.current}`);
    }
  }, [engine]);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const targetState = historyRef.current[historyIndexRef.current];

      engine.setEvents(structuredClone(targetState.events));
      engine.setCanvasClips(structuredClone(targetState.canvasClips));
      engine.setPatternsList(structuredClone(targetState.patterns));

      // Sync React state
      setEventsState(engine.getEvents());
      setCanvasClipsState(engine.getCanvasClips());
      setPatternsState(engine.getPatternsList());
      console.log(`[Undo/Redo System] Executed Redo. Index: ${historyIndexRef.current}`);
    }
  }, [engine]);

  // Seed initial project state into history
  useEffect(() => {
    const initialState: ProjectState = {
      events: structuredClone(engine.getEvents()),
      canvasClips: structuredClone(engine.getCanvasClips()),
      patterns: structuredClone(engine.getPatternsList()),
    };
    historyRef.current = [initialState];
    historyIndexRef.current = 0;
  }, [engine]);

  // Keyboard shortcut listener for global Undo/Redo commands
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key === "z" || e.key === "Z") {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (e.key === "y" || e.key === "Y") {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts);
  }, [undo, redo]);

  // High-performance continuous position coordinates state.
  const [position, setPosition] = useState({ seconds: 0, beats: 0 });

  // Refs for tracking active lifecycle, throttle flags and requestAnimationFrame
  const isMountedRef = useRef(true);
  const latestPositionRef = useRef({ seconds: 0, beats: 0 });
  const rafPendingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  // Throttled UI coordinate broadcaster (running at approximately 60fps / monitor refresh sync)
  const updateReactPosition = () => {
    if (isMountedRef.current) {
      setPosition(latestPositionRef.current);
    }
    rafPendingRef.current = false;
  };

  useEffect(() => {
    isMountedRef.current = true;

    // 2. State Subscriptions: Bind context hooks onto the underlying Web-Audio / Web-Worker scheduler clocks.
    const unsubscribeState = engine.subscribeToStateChange((newState) => {
      if (isMountedRef.current) {
        setPlaybackState(newState);

        // Also capture the playhead immediately on transport state changes to avoid UI visual stutters
        const currentSeconds = engine.getCurrentPosition("seconds");
        const currentBeats = engine.getCurrentPosition("beats");
        latestPositionRef.current = { seconds: currentSeconds, beats: currentBeats };
        setPosition({ seconds: currentSeconds, beats: currentBeats });
      }
    });

    const unsubscribeTick = engine.subscribeToTimelineTick((seconds, beats) => {
      latestPositionRef.current = { seconds, beats };

      // 3. Throttled UI Updates: Web worker emits ticks every 25ms. Directly pushing state updates to 
      // React at high freq causes render performance drops. requestAnimationFrame ensures we buffer 
      // coordinates and fire React render frames synchronous with the native UI painting cycle.
      if (!rafPendingRef.current) {
        rafPendingRef.current = true;
        rafIdRef.current = requestAnimationFrame(updateReactPosition);
      }
    });

    // Cleanup handles on component destruction
    return () => {
      isMountedRef.current = false;
      unsubscribeState();
      unsubscribeTick();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [engine]);

  // Command wrappers that update both the Web-Audio model and the reactive state hook
  const play = useCallback(() => engine.play(), [engine]);
  const pause = useCallback(() => engine.pause(), [engine]);

  const stop = useCallback(() => {
    engine.stop();
    // Flush immediate positions back to 0 for responsive UI resets
    latestPositionRef.current = { seconds: 0, beats: 0 };
    setPosition({ seconds: 0, beats: 0 });
    setActiveMidiNotes({});
  }, [engine]);

  const setBpm = useCallback((newBpm: number) => {
    engine.setBpm(newBpm);
    setBpmState(engine.getBpm());
  }, [engine]);

  const setPlaybackMode = useCallback((mode: "pattern" | "song") => {
    engine.setPlaybackMode(mode);
    setPlaybackModeState(mode);
  }, [engine]);

  const toggleMetronome = useCallback((override?: boolean) => {
    engine.toggleMetronome(override);
    setMetronomeEnabled(engine.isMetronomeEnabled());
  }, [engine]);

  const setLoop = useCallback((active: boolean, startBeats: number = 0, endBeats: number = 4) => {
    engine.setLoop(active, startBeats, endBeats);
    setLoopSettings(engine.getLoopSettings());
  }, [engine]);

  const setPlayheadPosition = useCallback((beats: number) => {
    engine.setPlayheadPosition(beats);
    const seconds = engine.beatsToSeconds(beats);
    setPosition({ seconds, beats });
  }, [engine]);

  const setEvents = useCallback((newEventsOrFunc: DAWEvent[] | ((prev: DAWEvent[]) => DAWEvent[])) => {
    let finalEvents: DAWEvent[];
    if (typeof newEventsOrFunc === "function") {
      finalEvents = newEventsOrFunc(engine.getEvents());
    } else {
      finalEvents = newEventsOrFunc;
    }
    engine.setEvents(finalEvents);
    setEventsState([...engine.getEvents()]);
    setPatternsState([...engine.getPatternsList()]);
  }, [engine]);

  const addEvent = useCallback((newEvent: DAWEvent) => {
    engine.addEvent(newEvent);
    setEventsState([...engine.getEvents()]);
    setPatternsState([...engine.getPatternsList()]);
    pushToHistory();
  }, [engine, pushToHistory]);

  const clearEvents = useCallback(() => {
    engine.clearEvents();
    setEventsState([...engine.getEvents()]);
    setPatternsState([...engine.getPatternsList()]);
    pushToHistory();
  }, [engine, pushToHistory]);

  const setCanvasClips = useCallback((newClipsOrFunc: CanvasClip[] | ((prev: CanvasClip[]) => CanvasClip[])) => {
    let finalClips: CanvasClip[];
    if (typeof newClipsOrFunc === "function") {
      finalClips = newClipsOrFunc(engine.getCanvasClips());
    } else {
      finalClips = newClipsOrFunc;
    }
    engine.setCanvasClips(finalClips);
    setCanvasClipsState([...engine.getCanvasClips()]);
  }, [engine]);

  const addCanvasClip = useCallback((newClip: CanvasClip) => {
    engine.addCanvasClip(newClip);
    setCanvasClipsState([...engine.getCanvasClips()]);
    pushToHistory();
  }, [engine, pushToHistory]);

  const removeCanvasClip = useCallback((id: string) => {
    engine.removeCanvasClip(id);
    setCanvasClipsState([...engine.getCanvasClips()]);
    pushToHistory();
  }, [engine, pushToHistory]);

  const getSampleBuffer = useCallback((sampleId: string) => {
    return engine.getSampleBuffer(sampleId);
  }, [engine]);

  // Reactive counter: bumped each time a new sample is loaded into the registry
  const [sampleCount, setSampleCount] = useState(0);
  const notifySampleLoaded = useCallback(() => {
    setSampleCount((prev) => prev + 1);
  }, []);

  const previewChannel = useCallback((channelId: string, sampleId?: string, volume?: number, pan?: number, settings?: any) => {
    engine.previewChannel(channelId, sampleId, volume, pan, settings);
  }, [engine]);

  const triggerNoteOn = useCallback((channelId: string | null | undefined, midiNote: number, velocity?: number) => {
    engine.triggerNoteOn(channelId, midiNote, velocity);
    if (channelId === focusedChannelId) {
      setActiveMidiNotes(prev => ({ ...prev, [midiNote]: true }));
    }
  }, [engine, focusedChannelId]);

  const triggerNoteOff = useCallback((channelId: string | null | undefined, midiNote: number) => {
    engine.triggerNoteOff(channelId, midiNote);
    if (channelId === focusedChannelId) {
      setActiveMidiNotes(prev => {
        const next = { ...prev };
        delete next[midiNote];
        return next;
      });
    }
  }, [engine, focusedChannelId]);

  const setActivePatternId = useCallback((id: string) => {
    engine.setActivePatternId(id);
    setActivePatternIdState(engine.getActivePatternId());
    setEventsState([...engine.getEvents()]);
  }, [engine]);

  const createPattern = useCallback((id: string, name: string) => {
    engine.createPattern(id, name);
    setPatternsState(engine.getPatternsList());
    pushToHistory();
  }, [engine, pushToHistory]);

  const renamePattern = useCallback((id: string, newName: string) => {
    engine.renamePattern(id, newName);
    setPatternsState(engine.getPatternsList());
    pushToHistory();
  }, [engine, pushToHistory]);

  const deletePattern = useCallback((id: string) => {
    engine.deletePattern(id);
    setPatternsState(engine.getPatternsList());
    setCanvasClipsState(engine.getCanvasClips());
    setActivePatternIdState(engine.getActivePatternId());
    setEventsState([...engine.getEvents()]);
    pushToHistory();
  }, [engine, pushToHistory]);

  const contextValue: AudioEngineContextType = {
    engine,
    playbackState,
    playbackMode,
    position,
    bpm,
    metronomeEnabled,
    loopSettings,
    events,
    canvasClips,
    patterns,
    activePatternId,
    play,
    pause,
    stop,
    setBpm,
    setPlayheadPosition,
    setPlaybackMode,
    toggleMetronome,
    setLoop,
    setEvents,
    addEvent,
    clearEvents,
    setCanvasClips,
    addCanvasClip,
    removeCanvasClip,
    getSampleBuffer,
    previewChannel,
    triggerNoteOn,
    triggerNoteOff,
    setActivePatternId,
    createPattern,
    renamePattern,
    deletePattern,
    pcKeyboardMidiActive,
    setPcKeyboardMidiActive,
    baseOctave,
    setBaseOctave,
    focusedChannelId,
    setFocusedChannelId,
    activeMidiNotes,
    undo,
    redo,
    pushToHistory,
    sampleCount,
    notifySampleLoaded,
  };

  return (
    <AudioEngineContext.Provider value={contextValue}>
      {children}
    </AudioEngineContext.Provider>
  );
}
