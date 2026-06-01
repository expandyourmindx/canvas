# Canvas DAW v0.19.0 — Codebase Audit Report

Full diagnostic scan of every source file in `src/`. Issues are prioritized into three tiers: **Critical** (bugs / memory leaks / data-loss risks), **Important** (code-health / performance problems that will compound), and **Nice to Have** (housekeeping that keeps the codebase maintainable).

---

## 🔴 Critical

### C-1 · Console.log Flooding in Hot Audio Paths
**Files:** [SamplerEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/audio/SamplerEngine.ts), [AudioEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/audio/AudioEngine.ts), [soundstretch.worker.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/workers/soundstretch.worker.ts), [KeyboardMidiListener.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/components/KeyboardMidiListener.tsx)

`SamplerEngine` alone has **~15 `console.log` calls** that fire on every single note trigger, every canvas clip playback start, and every stretch worker interaction. These print multi-line diagnostic dumps (see `triggerCanvasSample` at L691–L827). In a loop at 140 BPM with 8 clips, this creates **hundreds of log lines per second**, causing:
- **Garbage-collector pressure** from string interpolation allocations on every beat
- **Main-thread jank** serializing and flushing strings to DevTools
- **Masked real errors** buried in noise

Similarly, `KeyboardMidiListener` logs on every MIDI note-on/off (L102, L108), and the stretch worker emits full diagnostic blocks after every buffer process.

**Recommendation:** Strip all `console.log` calls from audio-hot paths. Keep `console.error`/`console.warn` for genuine failure cases. Optionally gate behind a `DEBUG` flag for development.

---

### C-2 · `AudioEngineProvider` useEffect Hooks Have No Cleanup Returns
**File:** [AudioEngineProvider.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/audio/AudioEngineProvider.tsx)

The provider creates an `AudioEngine` singleton inside a `useEffect`, spawns a Web Worker for the scheduler, and sets up `requestAnimationFrame` loops — but **no cleanup function is returned from any `useEffect`**. In React 18 Strict Mode (development), effects fire twice, meaning:
- Two `AudioEngine` instances could be created
- Two scheduler workers running simultaneously
- RAF loops that never cancel

While the provider is unlikely to unmount in practice (it wraps `<App>`), this is a correctness hazard and makes the component unsafe to reuse.

**Recommendation:** Return cleanup callbacks from all effects: `engine.dispose()`, worker termination, and `cancelAnimationFrame`.

---

### C-3 · ObsidianEngine Voice Map Uses `any[]` — No Type Safety for Audio Nodes
**Files:** [ObsidianEngine.ts:L11](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/audio/ObsidianEngine.ts#L11), [SamplerEngine.ts:L31](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/audio/SamplerEngine.ts#L31)

Both engines store active voice objects as `Map<string, any[]>`. The voice objects contain ~15 interconnected audio nodes (oscillators, gain nodes, filter nodes, LFO chains), but their shape is never declared. Every access throughout both files uses `(voice: any)`, `(osc: any)`, etc. This means:
- Typos like `voice.filterNod` (missing `e`) would silently produce `undefined`
- No IDE autocompletion for complex nested structures
- Any refactoring of the voice shape is guaranteed to introduce silent runtime breakage

**Recommendation:** Define `ObsidianVoice` and `SamplerVoice` interfaces and type both Maps properly.

---

### C-4 · LRU Cache `touchAccessOrder` Is O(n) on Every Sample Access
**File:** [SampleRegistry.ts:L74-L76](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/audio/SampleRegistry.ts#L74-L76)

```ts
private touchAccessOrder(id: string): void {
  this.accessOrder = this.accessOrder.filter(k => k !== id);
  this.accessOrder.push(id);
}
```

This creates a **new array allocation** and iterates the entire access order list on every `getSampleBuffer()` call. Since `getSampleBuffer` is called from the scheduling hot path (every note trigger, every canvas clip playback), with a 150-entry cache this allocates and discards arrays at audio-rate frequency.

**Recommendation:** Replace with a proper `Map`-based LRU (insertion-ordered Map already gives LRU semantics for free) or use a doubly-linked list.

---

## 🟡 Important

### I-1 · Zero `React.memo` Usage Across All Components
**Affected:** Every component in `src/components/` and `src/plugins/`

No component in the entire codebase uses `React.memo`. Combined with the state architecture where `Desktop.tsx` lifts `channels`, `channelVols`, `channelPans`, `channelMixers`, `samplerSettings` and passes them down through props:
- **Every fader drag** triggers a `setState` in Desktop → re-renders the entire component tree (Canvas, ChannelRack, PianoRoll, Mixer, Sampler, Obsidian)
- Canvas alone renders 50 lane elements and all clips on every tick
- ArrangerClip renders a full `<canvas>` waveform element per clip

**Recommendation:** Apply `React.memo` to: `ArrangerClip`, `ArrangerSourcePicker`, `ArrangerRuler`, `ChannelRack`, `PianoRoll`, `Mixer`, `Sampler`, `Obsidian`, `DraggableWindow`. Start with the heaviest re-renders first (ArrangerClip — has canvas waveform drawing).

---

### I-2 · Inline Function Closures Recreated Every Render in Canvas.tsx
**File:** [Canvas.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/components/Canvas.tsx)

Functions like `handleCellClick`, `handleClipSplit`, `handleClipDoubleClick`, `getClipMetadata`, `getGridStyle`, `getActiveSelectionDetails`, `handleAudioFileImport`, `clearArrangement` are all declared as plain `const` inside the component body without `useCallback`. Since Canvas re-renders on every playhead position tick, these functions are recreated **60 times per second** during playback.

Only `getSampleBufferWrapper` and `setZoomXClamped` use `useCallback`.

**Recommendation:** Wrap stable functions with `useCallback`, especially those passed as props to child components (which would benefit from `React.memo`).

---

### I-3 · Duplicate Channel Creation Logic (Canvas + ChannelRack)
**Files:** [Canvas.tsx L182-237](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/components/Canvas.tsx#L182-L237) `handleAudioFileImport`, [Canvas.tsx L904-936](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/components/Canvas.tsx#L904-L936) `onDrop handler`, [ChannelRack.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/components/ChannelRack.tsx) `onDrop handler`

The exact same 8-step "create a new sampler channel" sequence appears in three places:
1. `handleAudioFileImport` (Canvas)
2. The canvas lane `onDrop` handler (Canvas)
3. The channel rack's `onDrop` handler (ChannelRack)

Each duplicates: ID generation → `loadSample` → `setChannels` → `setChannelVols` → `setChannelMixers` → `engine.updateChannelVolume` → `engine.updateChannelPan` → `engine.updateChannelMixerTarget` → `engine.updateChannelSampleId` → `engine.updateChannelInstrumentType`.

**Recommendation:** Extract a shared `createSamplerChannel(engine, file, channels, setters)` utility.

---

### I-4 · `ExportEngine` Re-implements `beatsToSeconds` Inline (8 times)
**File:** [ExportEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/audio/ExportEngine.ts)

The export engine uses `beat * (60 / bpm)` inline **8 separate times** instead of calling through the established `beatsToSeconds` method. It also duplicates the entire mixer insert chain reconstruction logic (L80-185) rather than sharing it with the live `MixerManager`.

**Recommendation:** Accept a `beatsToSeconds` function from the `ExportableEngine` interface and use it consistently. Consider extracting shared mixer chain construction.

---

### I-5 · Stretched Buffer Cache Not Invalidated on BPM Change
**Files:** [SamplerEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/audio/SamplerEngine.ts), [AudioEngineProvider.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/audio/AudioEngineProvider.tsx)

When the user changes BPM, stretched sample buffers (keyed as `${clipId}_stretched`) remain in the `SampleRegistry` with their old tempo-ratio baked in. The stretch calculation in `calculateTempoRatio` (L202-219) depends on BPM (`this.delegate.getBPM()`), but there's no invalidation hook that re-stretches when BPM changes.

**Recommendation:** On BPM change, iterate all clips with active stretch settings and call `ensureClipStretched(clip, true)` to force recompute.

---

### I-6 · `getLibraryManager` Re-exported Through `SampleBrowser.tsx` Component
**Files:** [SampleBrowser.tsx:L30](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/components/SampleBrowser.tsx#L30), [Canvas.tsx:L20](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/components/Canvas.tsx#L20), [ChannelRack.tsx:L10](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/components/ChannelRack.tsx#L10)

Canvas and ChannelRack both `import { getLibraryManager } from "./SampleBrowser"`, which is a **UI component**. The actual manager lives in `audio/SampleLibraryManager.ts`. This creates an inappropriate dependency from layout components to a specific UI component.

**Recommendation:** Import `getLibraryManager` directly from `audio/SampleLibraryManager.ts`.

---

### I-7 · ArrangerClip Renders Full Waveform Canvas Without Throttling
**File:** [ArrangerClip.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/components/ArrangerClip.tsx)

Each `ArrangerClip` uses a `<canvas>` element to draw waveform/note visualizations. The drawing effect likely re-triggers on every parent re-render (since Canvas.tsx re-renders on playhead position). With 20+ clips visible, this means 20+ full canvas redraws at 60fps.

**Recommendation:** Gate waveform drawing behind clip data changes only (memoize or use a separate `useEffect` with narrow deps). Consider `OffscreenCanvas` for heavy drawings.

---

## 🟢 Nice to Have

### N-1 · Dead Imports in `App.tsx`
**File:** [App.tsx:L6-9](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/App.tsx#L6-L9)

```ts
import React, { useEffect } from "react";          // useEffect unused
import { useAudioEngine } from "./audio/useAudioEngine"; // unused
import { generateDrumSampleWav } from "./audio/sampleGenerator"; // unused
```

Three unused imports. `useAudioEngine` can't even be called outside the provider, and `generateDrumSampleWav` is only used inside `AudioEngine.ts`.

**Recommendation:** Remove all three unused imports.

---

### N-2 · `FrictionPoints.md` is an Empty Skeleton
**File:** [FrictionPoints.md](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/FrictionPoints.md)

Contains only section headers with no content. Either populate it or remove it to avoid confusion.

---

### N-3 · `CLIP_HEIGHT_PX` and `CLIP_TOP_OFFSET_PX` Exported But Unused
**File:** [config.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/config.ts)

`CLIP_HEIGHT_PX` is imported in `Canvas.tsx` but appears to be the same value as `LANE_HEIGHT_PX` (both 48). `CLIP_TOP_OFFSET_PX` is 0 and likely vestigial.

**Recommendation:** Audit usage; if truly redundant, consolidate to `LANE_HEIGHT_PX` only.

---

### N-4 · `sampleCount` Check in `handleAudioFileImport` Does Nothing
**File:** [Canvas.tsx:L196-198](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/components/Canvas.tsx#L196-L198)

```ts
if (sampleCount !== undefined) {
  // Notify the reactive system (sampleCount is from context, notifySampleLoaded increments it)
}
```

Empty `if` block with only a comment. The actual `notifySampleLoaded()` call is never made here.

**Recommendation:** Either call `notifySampleLoaded()` or remove the dead block.

---

### N-5 · `stretchDebounceTimers` Uses `Record<string, any>` for Timer IDs
**File:** [SamplerEngine.ts:L36](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/audio/SamplerEngine.ts#L36)

Timer IDs are stored as `any`. Use `ReturnType<typeof setTimeout>` for type safety.

---

### N-6 · Inconsistent React Import Style
**Across codebase**

Some files use `React.useMemo` / `React.useCallback` (Canvas.tsx) while others destructure `import { useMemo, useCallback } from "react"` (PianoRoll.tsx). This is cosmetic but inconsistent.

---

### N-7 · `PATTERN_LENGTH_BEATS` Exported but Potentially Ignored
**File:** [config.ts:L13](file:///c:/Users/elija/Desktop/Coding/Canvas%200.19.0/src/config.ts#L13)

`PATTERN_LENGTH_BEATS = 32` is exported but the PianoRoll dynamically calculates `totalBeats` from actual note positions + scroll offset. Verify this constant is still meaningful or remove it.

---

## Summary Table

| Priority | ID | Category | Effort |
|---|---|---|---|
| 🔴 Critical | C-1 | Console noise / GC pressure | Low (grep & delete) |
| 🔴 Critical | C-2 | Memory leak / double-init | Medium |
| 🔴 Critical | C-3 | Type safety (audio voices) | Medium |
| 🔴 Critical | C-4 | Performance (cache hot path) | Low |
| 🟡 Important | I-1 | React perf (re-renders) | Medium |
| 🟡 Important | I-2 | React perf (closures) | Medium |
| 🟡 Important | I-3 | Duplicate logic | Medium |
| 🟡 Important | I-4 | Duplicate logic | Low |
| 🟡 Important | I-5 | Audio reliability | Medium |
| 🟡 Important | I-6 | Architecture | Low |
| 🟡 Important | I-7 | React perf (canvas draws) | Medium |
| 🟢 Nice | N-1 | Dead code | Trivial |
| 🟢 Nice | N-2 | Dead file | Trivial |
| 🟢 Nice | N-3 | Dead exports | Trivial |
| 🟢 Nice | N-4 | Dead code | Trivial |
| 🟢 Nice | N-5 | Type safety | Trivial |
| 🟢 Nice | N-6 | Consistency | Trivial |
| 🟢 Nice | N-7 | Dead constant | Trivial |

---

## Open Questions

> [!IMPORTANT]
> **Which items should I implement?** I can tackle all of them, a specific tier, or cherry-pick individual items. Let me know your priority order and I'll proceed with a task checklist.

> [!NOTE]
> **Scope clarification:** I intentionally excluded cosmetic CSS issues, Tailwind class ordering, and component naming conventions from this audit since the user request focused on dead code, duplication, memory leaks, performance, audio reliability, type safety, and console noise.
