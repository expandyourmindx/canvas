/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { AudioEngine, DAWEvent, TransportState } from "./AudioEngine";
import { CanvasClip, PatternData, ChannelRow, CanvasProject, SamplerSettings, EQBandSettings } from "../types";
import { getLibraryManager, SampleNode } from "./SampleLibraryManager";

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
  pause: () => Promise<void>;
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
  pushToHistory: (channels: ChannelRow[]) => void;
  registerSetChannels: (cb: (channels: ChannelRow[]) => void, initialChannels?: ChannelRow[]) => void;

  // Sample loading reactivity
  sampleCount: number;
  notifySampleLoaded: () => void;

  setInsertFXSlot: (insertIndex: number, slotIndex: number, fxName: string) => void;
  setInsertFXBypass: (insertIndex: number, slotIndex: number, bypass: boolean) => void;
  updateInsertEQBand: (insertIndex: number, slotIndex: number, bandIndex: number, settings: Partial<EQBandSettings>) => void;

  // Project Save & Load Actions
  saveProject: () => void;
  loadProject: () => void;
  isDirty: boolean;
  registerDesktopSync: (sync: {
    getChannels: () => ChannelRow[];
    getChannelVols: () => Record<string, number>;
    getChannelPans: () => Record<string, number>;
    getChannelMixers: () => Record<string, number>;
    setChannels: (channels: ChannelRow[]) => void;
    setChannelVols: (vols: Record<string, number>) => void;
    setChannelPans: (pans: Record<string, number>) => void;
    setChannelMixers: (mixers: Record<string, number>) => void;
    setSamplerSettings: (settings: Record<string, SamplerSettings>) => void;
  }) => void;
  autosaveProject: CanvasProject | null;
  restoreAutosave: () => void;
  dismissAutosave: () => void;
  missingSamples: string[] | null;
  dismissMissingSamples: () => void;
}

export const AudioEngineContext = createContext<AudioEngineContextType | null>(null);

interface AudioEngineProviderProps {
  children: ReactNode;
}

interface ProjectState {
  events: DAWEvent[];
  canvasClips: CanvasClip[];
  patterns: PatternData[];
  channels: ChannelRow[];
}

export function AudioEngineProvider({ children }: AudioEngineProviderProps) {
  // 1. Singleton Instantiation of our pure high-precision lookahead hardware engine.
  // We initialize the AudioEngine inside a useRef so it acts as a persistent singleton
  // that survives hot-module reloading and reactive re-renders.
  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new AudioEngine();
    engineRef.current.setPlaybackMode("song");
  }
  const engine = engineRef.current;

  // History / Undo / Redo Ref stack
  const historyRef = useRef<ProjectState[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const latestChannelsRef = useRef<ChannelRow[]>([]);
  const setChannelsCallbackRef = useRef<((channels: ChannelRow[]) => void) | null>(null);

  const desktopStateRef = useRef<{
    getChannels: () => ChannelRow[];
    getChannelVols: () => Record<string, number>;
    getChannelPans: () => Record<string, number>;
    getChannelMixers: () => Record<string, number>;
    setChannels: (channels: ChannelRow[]) => void;
    setChannelVols: (vols: Record<string, number>) => void;
    setChannelPans: (pans: Record<string, number>) => void;
    setChannelMixers: (mixers: Record<string, number>) => void;
    setSamplerSettings: (settings: Record<string, SamplerSettings>) => void;
  } | null>(null);

  const registerDesktopSync = useCallback((sync: any) => {
    desktopStateRef.current = sync;
  }, []);

  const [autosaveProject, setAutosaveProject] = useState<CanvasProject | null>(null);
  const [missingSamples, setMissingSamples] = useState<string[] | null>(null);
  const [projectName, setProjectName] = useState<string>("Untitled");
  const [isDirty, setIsDirty] = useState<boolean>(false);

  const registerSetChannels = useCallback((cb: (channels: ChannelRow[]) => void, initialChannels?: ChannelRow[]) => {
    setChannelsCallbackRef.current = cb;
    if (initialChannels && historyRef.current.length === 1 && historyIndexRef.current === 0) {
      historyRef.current[0].channels = structuredClone(initialChannels);
      latestChannelsRef.current = structuredClone(initialChannels);
    }
  }, []);

  // React state elements for UI consumption
  const [playbackState, setPlaybackState] = useState<TransportState>(engine.getState());
  const [playbackMode, setPlaybackModeState] = useState<"pattern" | "song">("song");
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
  const pushToHistory = useCallback((channels: ChannelRow[]) => {
    latestChannelsRef.current = channels;
    const stateToPush: ProjectState = {
      events: structuredClone(engine.getEvents()),
      canvasClips: structuredClone(engine.getCanvasClips()),
      patterns: structuredClone(engine.getPatternsList()),
      channels: structuredClone(channels),
    };

    const currentHistory = historyRef.current.slice(0, historyIndexRef.current + 1);

    // Check if identical to prevent duplicating history frames
    const lastState = currentHistory[currentHistory.length - 1];
    if (lastState) {
      const isIdentical =
        JSON.stringify(lastState.events) === JSON.stringify(stateToPush.events) &&
        JSON.stringify(lastState.canvasClips) === JSON.stringify(stateToPush.canvasClips) &&
        JSON.stringify(lastState.patterns) === JSON.stringify(stateToPush.patterns) &&
        JSON.stringify(lastState.channels) === JSON.stringify(stateToPush.channels);
      if (isIdentical) return;
    }

    currentHistory.push(stateToPush);
    if (currentHistory.length > 50) {
      currentHistory.shift();
    }

    historyRef.current = currentHistory;
    historyIndexRef.current = currentHistory.length - 1;
    setIsDirty(true);
    console.log(`[Undo/Redo System] Pushed state to history. Index: ${historyIndexRef.current}`);
  }, [engine, setIsDirty]);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const targetState = historyRef.current[historyIndexRef.current];

      engine.setEvents(structuredClone(targetState.events));
      engine.setCanvasClips(structuredClone(targetState.canvasClips));
      engine.setPatternsList(structuredClone(targetState.patterns));

      // Restore channel rack state
      if (targetState.channels && setChannelsCallbackRef.current) {
        setChannelsCallbackRef.current(structuredClone(targetState.channels));
      }

      // Sync React state
      setEventsState(engine.getEvents());
      setCanvasClipsState(engine.getCanvasClips());
      setPatternsState(engine.getPatternsList());
      setIsDirty(true);
      console.log(`[Undo/Redo System] Executed Undo. Index: ${historyIndexRef.current}`);
    }
  }, [engine, setIsDirty]);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const targetState = historyRef.current[historyIndexRef.current];

      engine.setEvents(structuredClone(targetState.events));
      engine.setCanvasClips(structuredClone(targetState.canvasClips));
      engine.setPatternsList(structuredClone(targetState.patterns));

      // Restore channel rack state
      if (targetState.channels && setChannelsCallbackRef.current) {
        setChannelsCallbackRef.current(structuredClone(targetState.channels));
      }

      // Sync React state
      setEventsState(engine.getEvents());
      setCanvasClipsState(engine.getCanvasClips());
      setPatternsState(engine.getPatternsList());
      setIsDirty(true);
      console.log(`[Undo/Redo System] Executed Redo. Index: ${historyIndexRef.current}`);
    }
  }, [engine, setIsDirty]);

  // Seed initial project state into history
  useEffect(() => {
    const initialState: ProjectState = {
      events: structuredClone(engine.getEvents()),
      canvasClips: structuredClone(engine.getCanvasClips()),
      patterns: structuredClone(engine.getPatternsList()),
      channels: [],
    };
    historyRef.current = [initialState];
    historyIndexRef.current = 0;
  }, [engine]);


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
    setIsDirty(true);
  }, [engine, setIsDirty]);

  const setPlaybackMode = useCallback((mode: "pattern" | "song") => {
    engine.setPlaybackMode(mode);
    setPlaybackModeState(mode);
    setIsDirty(true);
  }, [engine, setIsDirty]);

  const toggleMetronome = useCallback((override?: boolean) => {
    engine.toggleMetronome(override);
    setMetronomeEnabled(engine.isMetronomeEnabled());
  }, [engine]);

  const setLoop = useCallback((active: boolean, startBeats: number = 0, endBeats: number = 4) => {
    engine.setLoop(active, startBeats, endBeats);
    setLoopSettings(engine.getLoopSettings());
    setIsDirty(true);
  }, [engine, setIsDirty]);

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
    pushToHistory(latestChannelsRef.current);
  }, [engine, pushToHistory]);

  const clearEvents = useCallback(() => {
    engine.clearEvents();
    setEventsState([...engine.getEvents()]);
    setPatternsState([...engine.getPatternsList()]);
    pushToHistory(latestChannelsRef.current);
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
    pushToHistory(latestChannelsRef.current);
  }, [engine, pushToHistory]);

  const removeCanvasClip = useCallback((id: string) => {
    engine.removeCanvasClip(id);
    setCanvasClipsState([...engine.getCanvasClips()]);
    pushToHistory(latestChannelsRef.current);
  }, [engine, pushToHistory]);

  const getSampleBuffer = useCallback((sampleId: string) => {
    return engine.getSampleBuffer(sampleId);
  }, [engine]);

  // Reactive counter: bumped each time a new sample is loaded into the registry
  const [sampleCount, setSampleCount] = useState(0);
  const notifySampleLoaded = useCallback(() => {
    setSampleCount((prev) => prev + 1);
  }, []);

  const setInsertFXSlot = useCallback((insertIndex: number, slotIndex: number, fxName: string) => {
    engine.setInsertFXSlot(insertIndex, slotIndex, fxName);
    setIsDirty(true);
  }, [engine, setIsDirty]);

  const setInsertFXBypass = useCallback((insertIndex: number, slotIndex: number, bypass: boolean) => {
    engine.setInsertFXBypass(insertIndex, slotIndex, bypass);
    setIsDirty(true);
  }, [engine, setIsDirty]);

  const updateInsertEQBand = useCallback((insertIndex: number, slotIndex: number, bandIndex: number, settings: Partial<EQBandSettings>) => {
    engine.updateInsertEQBand(insertIndex, slotIndex, bandIndex, settings);
    setIsDirty(true);
  }, [engine, setIsDirty]);

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
    pushToHistory(latestChannelsRef.current);
  }, [engine, pushToHistory]);

  const renamePattern = useCallback((id: string, newName: string) => {
    engine.renamePattern(id, newName);
    setPatternsState(engine.getPatternsList());
    pushToHistory(latestChannelsRef.current);
  }, [engine, pushToHistory]);

  const deletePattern = useCallback((id: string) => {
    engine.deletePattern(id);
    setPatternsState(engine.getPatternsList());
    setCanvasClipsState(engine.getCanvasClips());
    setActivePatternIdState(engine.getActivePatternId());
    setEventsState([...engine.getEvents()]);
    pushToHistory(latestChannelsRef.current);
  }, [engine, pushToHistory]);

  const collectProjectState = useCallback((): CanvasProject | null => {
    if (!desktopStateRef.current) return null;
    return {
      version: "0.18.1",
      savedAt: new Date().toISOString(),
      projectName,
      bpm: engine.getBpm(),
      playbackMode: engine.getPlaybackMode(),
      channels: desktopStateRef.current.getChannels(),
      channelVols: desktopStateRef.current.getChannelVols(),
      channelPans: desktopStateRef.current.getChannelPans(),
      channelMixers: desktopStateRef.current.getChannelMixers(),
      events: engine.getEvents(),
      canvasClips: engine.getCanvasClips(),
      patterns: engine.getPatternsList(),
      samplerSettings: engine.getAllSamplerSettings(),
      obsidianSettings: engine.obsidian.obsidianSettings,
      mixerInserts: engine.getMixerInserts(),
      loopSettings: engine.getLoopSettings(),
      sampleIds: engine.getLoadedSampleIds(),
    };
  }, [engine, projectName]);

  const restoreProjectState = useCallback(async (project: CanvasProject) => {
    if (!project || !desktopStateRef.current) return;

    // --- ASYNC SAMPLE RESOLUTION PRE-PASS ---
    const loadedIds = engine.getLoadedSampleIds();
    const unresolvedMissing: string[] = [];

    // Helper to find a file node in SampleLibraryManager folders by path or filename
    const findSampleInLibrary = (sampleId: string): SampleNode | null => {
      const library = getLibraryManager();
      // 1. Try finding by exact virtual path
      let found = library.findNodeByPath(sampleId);
      if (found && found.type === "file") return found;

      // 2. Try finding by filename
      const filename = sampleId.split("/").pop() || sampleId;
      
      const searchByName = (nodes: SampleNode[]): SampleNode | null => {
        for (const node of nodes) {
          if (node.type === "file" && (node.name === filename || node.path === sampleId)) {
            return node;
          }
          if (node.children) {
            const res = searchByName(node.children);
            if (res) return res;
          }
        }
        return null;
      };

      for (const folder of library.getFolders()) {
        if (folder.authorized) {
          const res = searchByName(folder.children);
          if (res) return res;
        }
      }
      return null;
    };

    if (project.sampleIds) {
      for (const sampleId of project.sampleIds) {
        if (loadedIds.includes(sampleId)) continue;
        if (sampleId.startsWith("sampler_")) continue; // built-in samples are seeded/in-memory

        // Try to resolve from authorized library folders
        const matchedNode = findSampleInLibrary(sampleId);
        if (matchedNode) {
          try {
            console.log(`[Auto-resolve] Attempting to load missing sample "${sampleId}" from library at "${matchedNode.path}"`);
            const ab = await getLibraryManager().loadBuffer(matchedNode);
            await engine.loadSample(sampleId, ab);
            console.log(`[Auto-resolve] Successfully restored sample: ${sampleId}`);
            notifySampleLoaded();
            continue; // Successfully resolved!
          } catch (err) {
            console.error(`[Auto-resolve] Failed to load sample ${sampleId} from matching file`, err);
          }
        }
        
        unresolvedMissing.push(sampleId);
      }
    }

    if (unresolvedMissing.length > 0) {
      setMissingSamples(unresolvedMissing);
    } else {
      setMissingSamples(null);
    }

    // --- PROCEED WITH THE REST OF THE RESTORE SEQUENCE ---

    // 1. push undo snapshot
    pushToHistory(desktopStateRef.current.getChannels());

    // 2. engine state
    engine.setPatternsList(project.patterns);
    engine.setCanvasClips(project.canvasClips);
    engine.setEvents(project.events);

    // 3. channel rack React state
    desktopStateRef.current.setChannels(project.channels);
    desktopStateRef.current.setChannelVols(project.channelVols);
    desktopStateRef.current.setChannelPans(project.channelPans);
    desktopStateRef.current.setChannelMixers(project.channelMixers);
    desktopStateRef.current.setSamplerSettings(project.samplerSettings || {});

    // 4. channel routing / engine volume/panning/routing sync
    project.channels.forEach((chan) => {
      engine.updateChannelVolume(chan.id, project.channelVols[chan.id] ?? 80);
      engine.updateChannelPan(chan.id, project.channelPans[chan.id] ?? 0);
      engine.updateChannelMixerTarget(chan.id, project.channelMixers[chan.id] ?? chan.mixerTarget ?? 1);
      if (chan.sampleId) {
        engine.updateChannelSampleId(chan.id, chan.sampleId);
      }
      if (chan.instrumentType) {
        engine.updateChannelInstrumentType(chan.id, chan.instrumentType);
      }
    });

    // 5. instrument settings
    if (project.samplerSettings) {
      engine.restoreAllSamplerSettings(project.samplerSettings);
    }
    if (project.obsidianSettings) {
      engine.obsidian.obsidianSettings = { ...project.obsidianSettings };
    }

    // 6. mixer console
    if (project.mixerInserts) {
      engine.restoreMixerInserts(project.mixerInserts);
    }

    // 7. loop settings & playback mode & BPM
    if (project.loopSettings) {
      engine.setLoopSettings(project.loopSettings);
    }
    if (project.playbackMode) {
      engine.setPlaybackMode(project.playbackMode);
    }
    if (project.bpm) {
      engine.setBpm(project.bpm);
    }

    // 8. sync React state in AudioEngineProvider
    setEventsState(engine.getEvents());
    setCanvasClipsState(engine.getCanvasClips());
    setPatternsState(engine.getPatternsList());
    setActivePatternIdState(engine.getActivePatternId());
    setPlaybackModeState(engine.getPlaybackMode());
    setBpmState(engine.getBpm());
    const lSettings = engine.getLoopSettings();
    setLoopSettings({
      isLooping: lSettings.loopEnabled,
      loopStart: lSettings.loopStart,
      loopEnd: lSettings.loopEnd,
      loopEnabled: lSettings.loopEnabled
    });

    if (project.projectName) {
      setProjectName(project.projectName);
    }
    setIsDirty(false);

    console.log("[Project Restoration] Restored project successfully!");
  }, [engine, pushToHistory, notifySampleLoaded, setProjectName, setIsDirty]);

  const saveProject = useCallback(async () => {
    const project = collectProjectState();
    if (!project) return;

    const suggestedName = `${projectName}.cnv`;
    const jsonStr = JSON.stringify(project, null, 2);

    // Native showSaveFilePicker
    if (typeof (window as any).showSaveFilePicker !== "undefined") {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName,
          types: [{
            description: "Canvas Project File",
            accept: {
              "application/json": [".cnv"]
            }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(jsonStr);
        await writable.close();

        // Update active project name
        let savedName = handle.name;
        if (savedName.endsWith(".cnv")) savedName = savedName.slice(0, -4);
        setProjectName(savedName);
        setIsDirty(false);

        console.log("[Project Save] Project successfully saved natively!");
        return;
      } catch (err) {
        // AbortError indicates user clicked cancel; do not fall back
        if ((err as any).name === "AbortError") {
          console.log("[Project Save] Save cancelled by user");
          return;
        }
        console.warn("Native file save picker failed, falling back to download link method", err);
      }
    }

    // Traditional download fallback
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = suggestedName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsDirty(false);
    console.log("[Project Save] Project successfully saved via traditional download!");
  }, [collectProjectState, projectName, setIsDirty, setProjectName]);

  const loadProject = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".cnv,.canvas,application/json";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Extract and format project name
      let name = file.name;
      if (name.endsWith(".canvas")) name = name.slice(0, -7);
      else if (name.endsWith(".cnv")) name = name.slice(0, -4);
      else if (name.endsWith(".json")) name = name.slice(0, -5);
      setProjectName(name);

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const project = JSON.parse(event.target?.result as string) as CanvasProject;
          if (project && project.version && project.channels) {
            restoreProjectState(project);
          } else {
            alert("Invalid project file format.");
          }
        } catch (err) {
          console.error("Failed to parse project file", err);
          alert("Error loading project: Invalid JSON.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [restoreProjectState, setProjectName]);

  const restoreAutosave = useCallback(() => {
    if (autosaveProject) {
      restoreProjectState(autosaveProject);
      setAutosaveProject(null);
    }
  }, [autosaveProject, restoreProjectState]);

  const dismissAutosave = useCallback(() => {
    localStorage.removeItem("canvas_autosave");
    setAutosaveProject(null);
  }, []);

  const dismissMissingSamples = useCallback(() => {
    setMissingSamples(null);
  }, []);

  const lastSavedJsonRef = useRef<string>("");

  // Debounced auto-save effect
  useEffect(() => {
    const interval = setInterval(() => {
      if (!desktopStateRef.current) return;
      const state = collectProjectState();
      if (!state) return;
      const json = JSON.stringify(state);
      if (json !== lastSavedJsonRef.current) {
        localStorage.setItem("canvas_autosave", json);
        lastSavedJsonRef.current = json;
        console.log("[Auto-save] Saved project to localStorage");
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [collectProjectState]);

  // beforeunload guard effect
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Are you sure you want to exit? Unsaved changes will be lost.";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Check for autosave on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("canvas_autosave");
      if (raw) {
        const parsed = JSON.parse(raw) as CanvasProject;
        if (parsed && parsed.version && parsed.channels) {
          setAutosaveProject(parsed);
          lastSavedJsonRef.current = raw;
        }
      }
    } catch (e) {
      console.error("Failed to parse auto-save state", e);
    }
  }, []);

  // Keyboard shortcut listener for global Undo/Redo/Save/Load commands
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
        } else if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          saveProject();
        } else if (e.key === "o" || e.key === "O") {
          e.preventDefault();
          loadProject();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts);
  }, [undo, redo, saveProject, loadProject]);

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
    registerSetChannels,
    sampleCount,
    notifySampleLoaded,
    setInsertFXSlot,
    setInsertFXBypass,
    updateInsertEQBand,
    saveProject,
    loadProject,
    isDirty,
    registerDesktopSync,
    autosaveProject,
    restoreAutosave,
    dismissAutosave,
    missingSamples,
    dismissMissingSamples,
  };

  return (
    <AudioEngineContext.Provider value={contextValue}>
      {children}
    </AudioEngineContext.Provider>
  );
}
