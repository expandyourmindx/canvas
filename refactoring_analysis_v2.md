# Canvas 0.18 — Codebase Refactoring & Performance Analysis

> Comprehensive audit covering: audio correctness, memory management, React/audio state coherence, render performance, type safety, dead code, and architectural debt.

---

## Phase 1 — Critical (Ship-Blocking / Data-Loss / Audio-Corruption)

---

### 1.1 — Transport pause() relies on a hardcoded 20ms setTimeout race

| Key | Value |
|-----|-------|
| **Area** | Audio Correctness |
| **File** | [AudioEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngine.ts#L176-L183) |
| **Root Cause** | `pause()` calls `obsidian.stopAll()` and `samplerEngine.stopAll()` inside a `setTimeout(() => { … }, 20)` to "wait past" the scheduler's own 12 ms `setTimeout` inside `TransportScheduler.pause()`. Two chained `setTimeout`s are not ordered by spec — under any GC pause, tab throttle, or high CPU load, the 20 ms callback can fire *before* the 12 ms one, causing the playhead to be frozen at the wrong position. |
| **Impact** | 🔴 High — At ≥200 BPM or under CPU pressure, pausing will non-deterministically drop the playhead by tens of milliseconds. Resume-from-pause then replays audio from the wrong point. |
| **Fix** | Replace both `setTimeout` chains with a single deterministic flow: have `TransportScheduler.pause()` return a `Promise` that resolves after it commits `pausedTimelinePosition`, then `await` it in `AudioEngine.pause()` before calling `stopAll()`. Eliminates the race entirely. |

---

### 1.2 — Loop boundary crossing can double-schedule notes

| Key | Value |
|-----|-------|
| **Area** | Audio Correctness — Scheduling |
| **File** | [TransportScheduler.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/TransportScheduler.ts#L353-L424) |
| **Root Cause** | When a lookahead window spans a loop boundary, the code first schedules `[startSeconds … loopEndSeconds]`, then schedules the wrap-around `[loopStartSeconds … nextEnd]`. If a note sits exactly at `loopEndSeconds`, the `>=` / `<` half-open interval check in `scheduleTimelineSegment` will include it in the first window, and the wrap recalculates `nextEnd` from `loopedEndSeconds` which can encompass beat 0 again. The note fires twice. |
| **Impact** | 🔴 High — Audible double-triggers at loop points, especially noticeable on kick/snare hits. Gets worse at high BPM because the lookahead window covers more beats. |
| **Fix** | Pass an explicit `excludeStartBeat` parameter to the second `scheduleTimelineSegment` call, or deduplicate by keeping a `Set<string>` of already-scheduled event IDs per tick cycle. |

---

### 1.3 — ExportEngine takes `engine: any`, bypassing all type checking

| Key | Value |
|-----|-------|
| **Area** | Type Safety / Audio Correctness |
| **File** | [ExportEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/ExportEngine.ts#L21) |
| **Root Cause** | `renderAudio(engine: any, …)` — the entire export pipeline accesses `.getBpm()`, `.getCanvasClips()`, `.getPatterns()`, `.getSampleBuffer()`, `.getLoopSettings()`, `.obsidian.obsidianSettings` without any compile-time validation. A refactor that renames any of these methods will cause a silent runtime crash during export only — a path users rarely test. |
| **Impact** | 🔴 High — Silent export failure on any API surface rename. No compiler guard. |
| **Fix** | Create an `ExportableEngine` interface with exactly the methods ExportEngine needs, and type the parameter as `ExportableEngine`. |

---

### 1.4 — `SampleRegistry` never evicts buffers — unbounded memory growth

| Key | Value |
|-----|-------|
| **Area** | Memory Management |
| **File** | [SampleRegistry.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/SampleRegistry.ts) |
| **Root Cause** | `sampleBuffers: Map<string, AudioBuffer>` has no `removeSample()`, no eviction, no size cap. Every sample loaded via the browser, drag-and-drop, or file import is retained permanently. A user importing 50 samples across a session accumulates hundreds of MB of decoded PCM data that can never be freed. |
| **Impact** | 🔴 High — Tab crash on long sessions with many sample imports. Mobile/low-RAM machines hit this faster. |
| **Fix** | Add `removeSample(id)` and `clear()` methods. Implement an LRU strategy or let the user explicitly unload samples. Wire delete logic through `ChannelRack.deleteChannelRow()` and sample replacement flows. |

---

### 1.5 — Export creates a throwaway `ObsidianEngine` but never disposes it

| Key | Value |
|-----|-------|
| **Area** | Memory Management |
| **File** | [ExportEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/ExportEngine.ts#L52) |
| **Root Cause** | `const offlineObsidian = new ObsidianEngine(offlineCtx)` creates voices, oscillators, filter nodes, and LFO nodes inside the OfflineAudioContext. After `startRendering()` resolves, these nodes are never disconnected and the `offlineObsidian.activeObsidianVoices` Map is never cleared. The entire offline node graph leaks until GC (which cannot collect connected AudioNodes). |
| **Impact** | 🟠 Medium-High — Repeated exports accumulate orphaned audio node graphs. Each export of a synth-heavy project leaks dozens of oscillator nodes. |
| **Fix** | Call `offlineObsidian.stopAll()` after `startRendering()` resolves. |

---

## Phase 2 — High (Correctness / Reliability / Performance Regression)

---

### 2.1 — `ObsidianEngine` voice object is completely untyped (`any`)

| Key | Value |
|-----|-------|
| **Area** | Type Safety |
| **File** | [ObsidianEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/ObsidianEngine.ts#L11) |
| **Root Cause** | `activeObsidianVoices: Map<string, any[]>` — the `createVoice()` method returns `any`. Every property access on voice objects (`voice.oscillators`, `voice.filterNode`, `voice.ampVca`, `voice.masterVca`, `voice.midiNote`, `voice.isReleasing`, `voice.stopTime`, `voice.pitch`) is unchecked. Custom properties are attached to OscillatorNodes via `(oscNode as any).coarseOffset`. |
| **Impact** | 🟠 High — Any typo in a voice property name causes a silent `undefined` read rather than a compile error. This is the #1 source of hard-to-reproduce synth bugs. |
| **Fix** | Define an `ObsidianVoice` interface with all fields. Replace `any[]` with `ObsidianVoice[]`. Define a `TunedOscillatorNode` type extending `OscillatorNode` with `coarseOffset`, `fineOffset`, `unisonOffset`. |

---

### 2.2 — `SamplerEngine` voice object is also untyped (`any`)

| Key | Value |
|-----|-------|
| **Area** | Type Safety |
| **File** | [SamplerEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/SamplerEngine.ts#L26) |
| **Root Cause** | `activeSamplerVoices: Map<string, any[]>` — same problem as Obsidian. The sampler voice objects have `source`, `gainNode`, `settings`, `midiNote`, `noteId`, `channelId`, `startTime` — all accessed without typing. |
| **Impact** | 🟠 High — Same category of silent runtime failures as 2.1. |
| **Fix** | Define a `SamplerVoice` interface and replace `any[]`. |

---

### 2.3 — `AudioEngine.onStateChangeCallbacks` and `onTimelineTickCallbacks` are orphaned

| Key | Value |
|-----|-------|
| **Area** | Dead Code |
| **File** | [AudioEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngine.ts#L72-L73) |
| **Root Cause** | After extracting `TransportScheduler`, the callback arrays on `AudioEngine` were left behind. They are declared on line 72–73 but never written to or read — all subscription logic now goes through `this.scheduler`. They occupy memory for every `AudioEngine` instance and are misleading to anyone reading the code. |
| **Impact** | 🟡 Medium — Cognitive confusion, wasted memory. |
| **Fix** | Delete both lines. |

---

### 2.4 — `synthesizeCanvasNote()` is dead code

| Key | Value |
|-----|-------|
| **Area** | Dead Code |
| **File** | [AudioEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngine.ts#L857-L881) |
| **Root Cause** | `private synthesizeCanvasNote(…)` is never called anywhere in the codebase. It was superseded by the Obsidian `triggerVoice()` path in `synthesizeEvent()`, but the old fallback method was left behind. It duplicates oscillator + gain creation logic, creating a maintenance hazard. |
| **Impact** | 🟡 Medium — 25 lines of dead code that will rot and confuse. |
| **Fix** | Delete the method entirely. |

---

### 2.5 — `getCurrentTime()` is a dead wrapper

| Key | Value |
|-----|-------|
| **Area** | Dead Code |
| **File** | [AudioEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngine.ts#L206-L208) |
| **Root Cause** | `public getCurrentTime(): number` simply calls `getCurrentPosition("seconds")`. It's never called from any consumer — every callsite uses `getCurrentPosition()` directly. |
| **Impact** | 🟢 Low — API surface clutter. |
| **Fix** | Remove the method. |

---

### 2.6 — Metronome click nodes never disconnect

| Key | Value |
|-----|-------|
| **Area** | Memory Management |
| **File** | [AudioEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngine.ts#L655-L673) |
| **Root Cause** | `triggerMetronomeClick()` creates an `OscillatorNode` and `GainNode`, connects them to the mixer, starts/stops the oscillator, but never registers an `onended` callback to disconnect them. At 120 BPM, that's 2 orphaned node pairs per second during playback. |
| **Impact** | 🟠 Medium-High — A 10-minute session with metronome on leaks ~2400 node pairs. |
| **Fix** | Add `osc.onended = () => { osc.disconnect(); gainNode.disconnect(); }` |

---

### 2.7 — `synthesizeEvent()` fallback oscillator nodes never disconnect

| Key | Value |
|-----|-------|
| **Area** | Memory Management |
| **File** | [AudioEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngine.ts#L607-L650) |
| **Root Cause** | The non-Obsidian fallback path in `synthesizeEvent()` creates `OscillatorNode` + `GainNode`, starts/stops them, but never disconnects them. Same leak pattern as the metronome. |
| **Impact** | 🟠 Medium — Leaks accumulate proportional to note density. A 64-note pattern at 180 BPM leaks fast. |
| **Fix** | Add `osc.onended` disconnect handler, same as the metronome fix. |

---

### 2.8 — `triggerTonePreview()` swallows errors silently

| Key | Value |
|-----|-------|
| **Area** | Audio Correctness |
| **File** | [AudioEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngine.ts#L589-L594) |
| **Root Cause** | `catch (err) {}` — the empty catch in the `onended` handler hides any `InvalidStateError` from double-disconnect. While harmless for disconnect, this pattern masks real bugs if the node graph is in an unexpected state. |
| **Impact** | 🟡 Low — Debugging difficulty. |
| **Fix** | At minimum, log a warning: `catch (err) { /* expected on hot-disconnect */ }` with a comment. |

---

### 2.9 — ChannelRack playhead LED re-renders entire step grid every 25ms

| Key | Value |
|-----|-------|
| **Area** | Render Performance |
| **File** | [ChannelRack.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/ChannelRack.tsx#L497) |
| **Root Cause** | `const activePlayheadIndex = Math.floor((position.beats % 4) / 0.25);` is computed directly in the render body. Since `position` changes every ~25ms during playback (via the RAF-throttled provider), the entire `ChannelRack` component re-renders at 40-60fps. This triggers re-render of every `channel.map(…)` row, every 16-step grid cell, every knob, and every button — even though only one LED dot changed. |
| **Impact** | 🟠 High — This is the single largest render bottleneck during playback. With 8+ channels, each tick renders 8×16 = 128 step cells + all channel controls. |
| **Fix** | Extract the LED row into a memoized component that subscribes to `position` independently. Wrap each channel row in `React.memo`. The step grid cells only need to re-render when `events` change, not when the playhead moves. |

---

### 2.10 — Canvas arranger playhead updates via `position.beats` cause full re-render

| Key | Value |
|-----|-------|
| **Area** | Render Performance |
| **File** | [Canvas.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/Canvas.tsx#L222-L227) |
| **Root Cause** | The playhead is moved via `useEffect` using direct DOM manipulation (`playheadRef.current.style.left`), which is good. However, `position` is still destructured from `useAudioEngine()`, which means the component re-renders anyway on every tick. The DOM mutation in the effect is efficient but the React reconciliation pass on 50 lane divs + all clips is not. |
| **Impact** | 🟠 Medium-High — 50 lane `.map()` iterations + all clip `.map()` iterations per tick. |
| **Fix** | Subscribe to position via a lightweight `useRef`-based subscription instead of context state. Or extract the playhead into its own component that is the sole consumer of `position`. |

---

### 2.11 — PianoRoll re-renders 85 MIDI rows on every playhead tick

| Key | Value |
|-----|-------|
| **Area** | Render Performance |
| **File** | [PianoRoll.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/PianoRoll.tsx#L122-L155) |
| **Root Cause** | Same pattern — `position` from context triggers full re-render. The playhead line is updated via ref, but the component body still runs, iterating `MIDI_NOTES.map(…)` (85 rows) and `filteredEvents.map(…)` (all notes). |
| **Impact** | 🟠 Medium-High — Especially costly with dense patterns (50+ notes). |
| **Fix** | Same as Canvas — isolate position subscription or extract playhead to child component. |

---

### 2.12 — `previewChannel()` settings parameter is `any` throughout the stack

| Key | Value |
|-----|-------|
| **Area** | Type Safety |
| **Files** | [AudioEngine.ts:522](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngine.ts#L522), [SamplerEngine.ts:186](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/SamplerEngine.ts#L186), [AudioEngineProvider.tsx:66](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngineProvider.tsx#L66) |
| **Root Cause** | `settings?: any` flows from the context type definition, through the provider callback, into both `AudioEngine.previewChannel()` and `SamplerEngine.previewChannel()`. The actual shape used is `{ pitch: number, sampleStart: number, envelopeOn: boolean }` but this is never enforced. |
| **Impact** | 🟡 Medium — A typo like `{ ptich: 0 }` silently does nothing. |
| **Fix** | Create a `PreviewSettings` interface (subset of `SamplerSettings`) and use it. |

---

### 2.13 — `ArrangerSourcePicker` prop `engine` is typed as `any`

| Key | Value |
|-----|-------|
| **Area** | Type Safety |
| **File** | [ArrangerSourcePicker.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/ArrangerSourcePicker.tsx#L12) |
| **Root Cause** | `engine: any;` in the interface. The component calls `.getLoadedSampleIds()` and `.getSampleBuffer()` on the engine prop without type checking. |
| **Impact** | 🟡 Medium — Same pattern of silent failures on API changes. |
| **Fix** | Type as `AudioEngine` import. |

---

## Phase 3 — Medium (Code Quality / Maintainability / Subtle Bugs)

---

### 3.1 — Undo/Redo uses `JSON.stringify` for equality, `structuredClone` for copies

| Key | Value |
|-----|-------|
| **Area** | React/Audio State Coherence |
| **File** | [AudioEngineProvider.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngineProvider.tsx#L139-L166) |
| **Root Cause** | `pushToHistory` serializes the entire project state with `structuredClone` and then checks equality with `JSON.stringify`. This is O(n) for every undo push. With 500+ events, this can take 5-10ms — noticeable when dragging notes (which call `pushToHistory` on every pointer-up). Additionally, `JSON.stringify` doesn't guarantee key ordering, so two semantically identical states could hash differently depending on object creation order. |
| **Impact** | 🟡 Medium — Performance jank on undo pushes during fast editing; potential duplicate history frames. |
| **Fix** | Use a monotonic dirty-counter or hash instead of full serialization comparison. Or debounce `pushToHistory` by 100ms. |

---

### 3.2 — `setPlayheadPosition` during playback causes a scheduling gap

| Key | Value |
|-----|-------|
| **Area** | Audio Correctness |
| **File** | [TransportScheduler.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/TransportScheduler.ts#L254-L266) |
| **Root Cause** | `setPlayheadPosition()` resets `audioContextStartTime = audioContext.currentTime` and all timeline anchors, but does not re-trigger `executeSchedulerTick()`. The worker's next tick may not fire for up to 25ms. During that gap, no events are scheduled, causing audible silence if notes should be playing at the new position. |
| **Impact** | 🟡 Medium — Brief silence glitch when scrubbing during playback at high BPM. |
| **Fix** | Call `executeSchedulerTick()` synchronously after repositioning during playback. |

---

### 3.3 — `isStartInstantOfPlayback` uses a magic threshold of 75ms

| Key | Value |
|-----|-------|
| **Area** | Audio Correctness |
| **File** | [AudioEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngine.ts#L263) |
| **Root Cause** | `Math.abs(startSeconds - this.scheduler.pausedTimelinePosition) < 0.075` — this 75ms threshold is used to detect "first tick after play" and retrigger mid-position notes. At 300 BPM, a beat is 200ms, so 75ms is nearly half a beat. At low BPM (60 BPM), a beat is 1000ms, so 75ms is just 7.5% of a beat. The threshold should be relative to the tick interval (25ms × lookahead factor), not absolute. |
| **Impact** | 🟡 Medium — At very high BPM, the "resume mid-note" feature may accidentally fire for notes that genuinely started 75ms ago, causing double-triggers. |
| **Fix** | Use `< (this.scheduler.tickIntervalMs * 3) / 1000` or a similar tick-relative bound. |

---

### 3.4 — Mixer insert `getInsertLevels()` allocates a new `Float32Array` every call

| Key | Value |
|-----|-------|
| **Area** | Render Performance |
| **File** | [MixerManager.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/MixerManager.ts#L162-L181) |
| **Root Cause** | `const dataArray = new Float32Array(bufferLength)` — the Mixer component calls this at ~60fps per visible insert (up to 16 inserts). That's 16 × 60 = 960 allocations per second, each of size 512 floats (2 KB). This creates GC pressure that can cause audio glitches. |
| **Impact** | 🟡 Medium — GC microstutters during playback with the mixer visible. |
| **Fix** | Pre-allocate one `Float32Array` per insert (stored on the `MixerInsert` object) and reuse it. |

---

### 3.5 — Channel state never cleans up deleted channels from engine internals

| Key | Value |
|-----|-------|
| **Area** | Memory Management / React-Audio Coherence |
| **Files** | [Desktop.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/Desktop.tsx#L119-L167), [AudioEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngine.ts) |
| **Root Cause** | When `ChannelRack.deleteChannelRow()` removes a channel from React state, the `useEffect` sync in `Desktop.tsx` only syncs *current* channels forward — it never tells the engine to clean up the deleted channel's `channelVols`, `channelPans`, `channelInstrumentTypes`, `channelMixerTargets`, or `channelNodes` Map entries. These accumulate as zombie entries. |
| **Impact** | 🟡 Medium — Memory leak of orphaned `GainNode`/`StereoPannerNode` pairs in `channelNodes`. Connected nodes can't be GC'd. |
| **Fix** | Add `AudioEngine.removeChannel(id)` that cleans up all maps, disconnects nodes, and remove sampler/obsidian settings. Call it from the Desktop sync effect when a channel disappears from the diff. |

---

### 3.6 — `channelVols`, `channelPans`, `channelMixerTargets` are duplicated across React and engine

| Key | Value |
|-----|-------|
| **Area** | Architectural Debt / React-Audio Coherence |
| **Files** | [Desktop.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/Desktop.tsx#L53-L74), [AudioEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngine.ts#L76-L78) |
| **Root Cause** | Channel volumes, pans, and mixer targets exist as `Record<string, number>` in React state *and* as separate `Record<string, number>` inside `AudioEngine`. The `useEffect` in Desktop manually diffs and syncs them. This is the classic "two sources of truth" problem — if any code path updates the engine directly without going through React, the UI drifts. If React updates without syncing to the engine (e.g., a missed dependency), audio drifts. |
| **Impact** | 🟡 Medium — Root cause of subtle audio-vs-UI discrepancy bugs. Will compound as more channel-level features are added. |
| **Fix** | Make the engine the single source of truth for channel state, and have React read from it via subscriptions or poll. Or, make React state authoritative and sync downward via the existing effect but add proper cleanup. |

---

### 3.7 — `AVAILABLE_SAMPLES` config IDs don't match engine seed IDs

| Key | Value |
|-----|-------|
| **Area** | Audio Correctness |
| **Files** | [config.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/config.ts#L4-L8), [AudioEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngine.ts#L828-L845) |
| **Root Cause** | `config.ts` defines `AVAILABLE_SAMPLES` with IDs `kick_sample`, `snare_sample`, `hihat_sample`. But `seedDefaultSamples()` registers them as `sampler_kick_sample`, `sampler_snare_sample`, `sampler_hihat_sample`. The config IDs will never match a loaded buffer — `getSampleBuffer("kick_sample")` returns `undefined`. |
| **Impact** | 🟡 Medium — The `getSampleName()` fallback in Canvas.tsx masks this by formatting any ID nicely. But if any code tries to play a sample using the config IDs, it silently fails. |
| **Fix** | Align the IDs. Either change config to `sampler_kick_sample` or change the seed to `kick_sample`. |

---

### 3.8 — `clearChannelNotes` in ChannelRack matches by pitch, not by channelId

| Key | Value |
|-----|-------|
| **Area** | Audio Correctness |
| **File** | [ChannelRack.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/ChannelRack.tsx#L416-L422) |
| **Root Cause** | For pitch channels: `events.filter(e => e.pitch !== channel.pitch)` — this deletes ALL events with that pitch across ALL channels, not just the target channel's events. If two Obsidian channels use the same pitch (C4), clearing one clears both. |
| **Impact** | 🟡 Medium — Data loss when users have multiple synth channels. |
| **Fix** | Filter by `e.channelId !== channel.id` instead of (or in addition to) pitch matching. |

---

### 3.9 — `handleStepToggle` calls `setChannels(prev => [...prev])` as a render hack

| Key | Value |
|-----|-------|
| **Area** | Render Performance |
| **File** | [ChannelRack.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/ChannelRack.tsx#L340) |
| **Root Cause** | `setChannels(prev => [...prev])` forces a re-render of the entire Desktop component tree (since `channels` is lifted state). It does not change any data — it's purely a "force rerender" hack. This is called on every single step toggle click. |
| **Impact** | 🟡 Medium — Unnecessary full-tree re-render on every step click. |
| **Fix** | Remove the line. The step grid should react to `events` state changes (which happen on the next line), not to channels. |

---

### 3.10 — Duplicated grid style generation in Canvas and PianoRoll

| Key | Value |
|-----|-------|
| **Area** | Architectural Debt |
| **Files** | [Canvas.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/Canvas.tsx#L179-L209), [PianoRoll.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/PianoRoll.tsx#L210-L240) |
| **Root Cause** | `getGridStyle()` is copy-pasted between Canvas and PianoRoll with identical logic. Any change to grid rendering must be applied twice. |
| **Impact** | 🟡 Low-Medium — Maintenance burden, divergence risk. |
| **Fix** | Extract to `utils/gridStyle.ts` and import from both. |

---

## Phase 4 — Low (Polish / Future-Proofing / Minor Debt)

---

### 4.1 — KeyboardMidiListener uses `any` extensively for Web MIDI API

| Key | Value |
|-----|-------|
| **Area** | Type Safety |
| **File** | [KeyboardMidiListener.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/KeyboardMidiListener.tsx#L181-L229) |
| **Root Cause** | `const nav = navigator as any`, `let midiAccess: any`, `(event: any)`, `(access: any)`, `(input: any)`, `(err: any)` — the entire USB MIDI integration is untyped. |
| **Impact** | 🟢 Low — Works fine but will break silently if the Web MIDI API interface changes or if someone adds features. |
| **Fix** | Install `@types/webmidi` or declare the necessary interfaces locally. |

---

### 4.2 — `Mixer` component uses `any[]` for insert state

| Key | Value |
|-----|-------|
| **Area** | Type Safety |
| **File** | [Mixer.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/Mixer.tsx#L130) |
| **Root Cause** | `const [insertsState, setInsertsState] = useState<any[]>([])` — the insert state is fetched from `engine.getInserts()` which returns `MixerInsert[]`, but the React state drops that type. |
| **Impact** | 🟢 Low — Easy fix. |
| **Fix** | Type as `useState<MixerInsert[]>([])` and import `MixerInsert`. |

---

### 4.3 — `SampleLibraryManager.loadNodeBuffer` decodes directly into browser's AudioContext

| Key | Value |
|-----|-------|
| **Area** | Memory Management |
| **File** | [SampleLibraryManager.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/SampleLibraryManager.ts#L348-L370) |
| **Root Cause** | `loadNodeBuffer` takes an `AudioContext` parameter and calls `audioContext.decodeAudioData(arrayBuffer)`, but the returned `AudioBuffer` is used by the caller to register in `SampleRegistry` — creating *two* copies: one from `decodeAudioData` inside `loadNodeBuffer`, and one from `SampleRegistry.loadSample()` which also calls `decodeAudioData`. |
| **Impact** | 🟡 Low-Medium — Double decoding doubles memory usage for user-imported samples and doubles the CPU time. |
| **Fix** | `loadNodeBuffer` should return the raw `ArrayBuffer` and let `SampleRegistry.loadSample()` handle the single decode. Or have `SampleRegistry.registerDecodedBuffer(id, buffer)` that accepts a pre-decoded `AudioBuffer`. |

---

### 4.4 — No `destroy()` / cleanup method on `AudioEngine`

| Key | Value |
|-----|-------|
| **Area** | Architectural Debt |
| **File** | [AudioEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngine.ts) |
| **Root Cause** | The `AudioEngine` creates an `AudioContext`, a Web Worker, numerous `GainNode`s, and persistent Map structures — none of which are ever torn down. In a dev environment with HMR, this means every hot reload creates a new AudioContext (browsers limit these to ~6 per page) and a new orphaned Worker thread. |
| **Impact** | 🟡 Medium — HMR-related audio failures during development. Not user-facing in production, but slows iteration. |
| **Fix** | Add `destroy()` method that calls `this.audioContext.close()`, `this.worker.terminate()`, `this.obsidian.stopAll()`, `this.samplerEngine.stopAll()`, and clears all Maps. Wire it into `AudioEngineProvider`'s cleanup return. |

---

### 4.5 — `updateReactPosition` is defined as a plain function inside the component

| Key | Value |
|-----|-------|
| **Area** | Render Performance |
| **File** | [AudioEngineProvider.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngineProvider.tsx#L255-L260) |
| **Root Cause** | `const updateReactPosition = () => { … }` is declared outside of `useCallback` and outside of the `useEffect`, meaning it's re-created on every render. Since it's only used as a `requestAnimationFrame` callback, it should be defined inside the effect or wrapped in `useCallback`. |
| **Impact** | 🟢 Low — Minimal perf impact since it's not passed as a prop, but it's a code smell. |
| **Fix** | Move the function inside the `useEffect` body. |

---

### 4.6 — `Obsidian.tsx` casts subOscWave as `any`

| Key | Value |
|-----|-------|
| **Area** | Type Safety |
| **File** | [Obsidian.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/plugins/Obsidian.tsx#L284) |
| **Root Cause** | `e.target.value as any` when setting `subOscWave`. The `ObsidianSettings.subOscWave` type is `"off" | "sine" | "square" | "sawtooth" | "triangle"` — the `as any` is unnecessary because `e.target.value` is `string`, which can be safely cast to the union with `as ObsidianSettings["subOscWave"]`. |
| **Impact** | 🟢 Low — Bypasses type validation on a constrained field. |
| **Fix** | Cast to the union type directly. |

---

### 4.7 — `ExportEngine` claims "24-bit PCM" but encodes 16-bit

| Key | Value |
|-----|-------|
| **Area** | Audio Correctness |
| **Files** | [ExportWindow.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/ExportWindow.tsx#L174), [ExportEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/ExportEngine.ts#L207) |
| **Root Cause** | The UI displays "44.1 kHz, 24-bit PCM Dual Waveform" but `bufferToWav()` uses `bitDepth = 16` and writes `Int16` samples. The file is 16-bit PCM. |
| **Impact** | 🟡 Low-Medium — Misleading quality claim. Users expecting 24-bit dynamic range get 16-bit. |
| **Fix** | Either change the label to "16-bit" or implement actual 24-bit encoding. |

---

### 4.8 — `ExportEngine` MP3 button exists but no MP3 encoding is implemented

| Key | Value |
|-----|-------|
| **Area** | Architectural Debt |
| **File** | [ExportWindow.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/ExportWindow.tsx#L159-L171), [ExportEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/ExportEngine.ts) |
| **Root Cause** | The "MP3 (Capped 320kb)" format button sets `format: "mp3"`, but `ExportEngine.renderAudio()` always returns a WAV-encoded buffer. The download extension will be `.mp3` but the actual content is PCM WAV. |
| **Impact** | 🟡 Medium — Corrupt file delivered to user. Some players will play it (they detect headers), others will reject it. |
| **Fix** | Either remove the MP3 option until encoding is implemented (e.g., via lamejs), or add a clear "WAV only" notice. |

---

## Architectural Debt Summary — Blockers Before Next Feature Layers

> [!IMPORTANT]
> These items must be resolved before building **effects chains**, **time stretching**, or **MIDI export**.

| Blocker | Blocks | Why |
|---------|--------|-----|
| No `AudioEngine.destroy()` | Effects, any plugin system | Effects chains need to insert/remove audio nodes. Without a cleanup path, you can't hot-swap plugin instances or unload them. |
| Voice objects are `any` | Time stretching, MIDI export | Time stretching needs to manipulate voice playback rate in real time. MIDI export needs to serialize voice note-on/note-off events. Both require typed voice objects. |
| `SampleRegistry` has no eviction | Sample-heavy projects | Effects on samples (e.g., reverse, normalize) will create new buffers. Without eviction, memory doubles on every effect apply. |
| Channel state is split React/Engine | Effects routing, sidechain | Effects need to know channel routing. Currently you'd have to read from both React state and engine state to get the full picture. Single source of truth is prerequisite. |
| `ExportEngine` uses `any` for engine | MIDI export | MIDI export needs to access patterns, channels, and instrument types — the same API surface that's currently untyped. |
| No per-voice cleanup in OfflineAudioContext | Accurate export with effects | Effects need to be replicated in the offline context. Without proper voice lifecycle management, effect tails will be cut off or leak. |

---

## Quick Wins (< 30 minutes each)

| # | Task | Files |
|---|------|-------|
| 1 | Delete `onStateChangeCallbacks` / `onTimelineTickCallbacks` from AudioEngine | AudioEngine.ts L72–73 |
| 2 | Delete `synthesizeCanvasNote()` | AudioEngine.ts L857–881 |
| 3 | Delete `getCurrentTime()` | AudioEngine.ts L206–208 |
| 4 | Add `osc.onended` disconnect to metronome click | AudioEngine.ts L655–673 |
| 5 | Add `osc.onended` disconnect to `synthesizeEvent` fallback | AudioEngine.ts L607–650 |
| 6 | Call `offlineObsidian.stopAll()` after export render | ExportEngine.ts L196 |
| 7 | Fix 16-bit vs 24-bit label | ExportWindow.tsx L174 |
| 8 | Remove `setChannels(prev => [...prev])` render hack | ChannelRack.tsx L340 |
| 9 | Fix `clearChannelNotes` to filter by `channelId` | ChannelRack.tsx L416–422 |
| 10 | Type `ArrangerSourcePicker.engine` prop | ArrangerSourcePicker.tsx L12 |
| 11 | Type `Mixer` insert state | Mixer.tsx L130 |
| 12 | Remove or disable the MP3 export button | ExportWindow.tsx L159–171 |
