# Canvas 0.18.0 — Refactoring Opportunity Analysis

> **Goal**: Prioritize engine and interface responsiveness + easier code editing.
> No changes have been made. This is an analysis-only document.

---

## 🔴 Priority 1 — Engine & Audio Responsiveness

### 1. `setCanvasClips` fires a full-array replace on every drag-move frame

**File**: [`AudioEngineProvider.tsx`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngineProvider.tsx#L365-L374), [`Canvas.tsx`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/Canvas.tsx#L793-L820)

During clip drag (`handleClipPointerMove`), `setCanvasClips` is called on **every pointermove event**. This:
1. Calls `JSON.stringify` deep-clone on the whole clips array (inside `pushToHistory` pathway if accidentally triggered)
2. Triggers a full React re-render, re-laying out all 50 lanes × N clips

**Fix**: Use a `useRef` for in-flight drag state, only committing to React state on `pointerup`. This is the same pattern already used for `resizeStateRef` and `dragPlacementRef` (refs updated imperatively), but clips themselves still go through React state on every mousemove.

---

### 2. Undo/Redo `pushToHistory` uses `JSON.parse(JSON.stringify(...))` triple deep-clone

**File**: [`AudioEngineProvider.tsx`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngineProvider.tsx#L139-L166)

Every `pushToHistory` call performs **three** full `JSON.parse(JSON.stringify(...))` round-trips on `events`, `canvasClips`, and `patterns`. This runs synchronously on the main thread during pointer events (note placement, clip placement, resize complete). On larger projects with many patterns/clips this will stutter.

**Fix**: Use [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/structuredClone) which is faster and native. Or better: debounce `pushToHistory` so rapid sequential operations (like drag-on-place) only push once per interaction.

---

### 3. Playhead `requestAnimationFrame` loops: duplicated in Canvas and PianoRoll

**Files**: [`Canvas.tsx L270-L284`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/Canvas.tsx#L270-L284), [`PianoRoll.tsx L143-L200`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/PianoRoll.tsx#L143-L200)

Both components independently run their own `requestAnimationFrame` loops that poll `engine.getCurrentTime()` every frame (~60fps). This means two separate RAF loops are running simultaneously querying the same engine method. The `AudioEngineProvider` already has a RAF loop for its `position` state — making **three total active loops** when both windows are open.

**Fix**: Expose the engine's `position.beats` from the provider context directly into both playhead loops, eliminating the direct `engine.getCurrentTime()` calls and consolidating to one RAF source of truth.

---

### 4. `SamplerEngine.triggerCanvasSample` bypasses channel routing — ignores volume/pan

**File**: [`SamplerEngine.ts L386-L413`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/SamplerEngine.ts#L386-L413)

Canvas sample clips route directly to `masterGainNode` with a hardcoded `0.8` gain, bypassing the channel `GainNode`, `StereoPannerNode`, and mixer insert routing. Compared to `triggerSample` (which properly routes through channel nodes), this makes arranger-mode clips ignore volume faders, pan knobs, and mixer assignments.

**Fix**: Look up the channel by `referenceId`, retrieve its `channelNodes` via the delegate, and route through the insert like `triggerSample` does.

---

### 5. `ObsidianEngine.ts` / `SamplerEngine.ts` voice leak: `activeSamplerVoices` uses `setTimeout` for cleanup

**File**: [`SamplerEngine.ts L160-L168`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/SamplerEngine.ts#L160-L168)

Voice cleanup uses `setTimeout(() => disconnect, releaseSecs * 1000 + 150)`. If many notes are triggered rapidly (step sequencer at fast BPM), many `setTimeout`s accumulate on the JS main thread. With very long release tails, they build up silently.

**Fix**: Use `AudioBufferSourceNode`'s `onended` event instead of `setTimeout`. The browser fires this precisely when the buffer finishes — zero overhead and no main-thread timers required.

---

### 6. `ChannelRack.playSamplePreview` / `playPitchPreview` access private engine internals via `(engine as any).audioContext`

**Files**: [`ChannelRack.tsx L246-L257`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/ChannelRack.tsx#L246-L257), [`ChannelRack.tsx L287-L308`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/ChannelRack.tsx#L287-L308)

Two preview functions in `ChannelRack` create raw oscillators and connect them to `(engine as any).masterGainNode` directly. This:
- Bypasses the public API
- Bypasses mixer routing
- Makes `AudioEngine` internal structure a hidden coupling point
- Will silently break if internals are reorganized

**Fix**: Add a `engine.triggerTonePreview(channelId, frequency, duration)` public method, or repurpose the existing `previewChannel` for pitch channels (which `playPitchPreview` partially does for obsidian but falls back to raw for others).

---

## 🟠 Priority 2 — UI Rendering Performance

### 7. Canvas timeline renders 128 beat-divider `<div>` elements × 50 lanes = 6,400 DOM nodes

**File**: [`Canvas.tsx L1263-L1276`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/Canvas.tsx#L1263-L1276)

Each of the 50 lanes renders `Array.from({ length: 128 })` individual `<div>` grid line markers. With 50 lanes, this is **6,400 DOM nodes** just for visual grid lines, re-created every render. They're `pointer-events-none` so they don't affect interaction, but they heavily tax layout.

**Fix**: Draw the grid on a `<canvas>` element using 2D context `drawLine` calls (single static draw per zoom change), or use a CSS `background` gradient/grid trick to achieve the same visual with zero DOM nodes.

---

### 8. Timeline ruler also renders 128 separate `<div>` children per render

**File**: [`Canvas.tsx L1193-L1210`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/Canvas.tsx#L1193-L1210)

Same issue as above but in the ruler row — `128` individual positioned divs for beat labels. This re-renders whenever `beatWidth` (zoom) changes.

**Fix**: Same `<canvas>` approach, or memoize the ruler with `useMemo(() => ..., [totalBeats, beatWidth])` so it only recalculates on zoom changes, not on any other state change.

---

### 9. `SampleWaveform` is computed with `useMemo` but instantiated per clip per render

**File**: [`Canvas.tsx L38-L86`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/Canvas.tsx#L38-L86)

`SampleWaveform` uses `useMemo` for its waveform peaks, but it's a separate component rendered inside the clips overlay. If many clips reference the same `sampleId`, each renders its own `SampleWaveform` instance with its own `useMemo`. The waveform peaks could be computed once per `sampleId` and cached globally.

**Fix**: Move peak computation into a cache keyed by `sampleId` (e.g., a `Map` in a custom hook `useWaveformPeaks(sampleId)`), shared across all clips using the same sample.

---

### 10. `handleGridPointerMove` (Canvas lasso) calls `setLassoBox` and `setSelectedIds` on every pointermove

**File**: [`Canvas.tsx L583-L627`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/Canvas.tsx#L583-L627)

During lasso drag, every `pointermove` triggers two `setState` calls (`setLassoBox` + `setSelectedIds`), causing full component re-renders at pointer rate (~120fps on high-refresh displays). The same pattern exists in `PianoRoll`.

**Fix**: Update `lassoBox` via a `useRef` for intermediate drag position (DOM-mutated directly for the visual lasso overlay), only calling `setSelectedIds` when the selection changes. Or throttle with `requestAnimationFrame`.

---

### 11. `Desktop.tsx`'s engine sync `useEffect` runs on every change to any of 4 state maps

**File**: [`Desktop.tsx L81-L98`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/Desktop.tsx#L81-L98)

```tsx
useEffect(() => {
  channels.forEach(chan => {
    engine.updateChannelVolume(chan.id, vol);
    // ... 4 more engine calls per channel
  });
}, [channels, channelVols, channelPans, channelMixers, engine]);
```

This iterates **all channels** whenever **any** channel property changes. On a 20-channel project, changing one volume knob triggers 20 × 5 = 100 engine update calls.

**Fix**: Update the engine directly in the setter callbacks (where the specific channel/value is known), not in a catch-all effect. Or diff only changed channels before calling engine updates.

---

## 🟡 Priority 3 — Code Organization & Maintainability

### 12. `Canvas.tsx` is 1,440 lines — needs decomposition

**File**: [`Canvas.tsx`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/Canvas.tsx)

At 1,440 lines, `Canvas.tsx` handles clip rendering, drag/drop, split/crop, lasso, ruler, file import, source picker sidebar, and layout. This makes targeted edits risky — touching drag state can silently affect the ruler, and vice versa.

**Suggested decomposition**:
| New File | Responsibility |
|---|---|
| `useClipDrag.ts` | Drag, lasso, pointer capture state |
| `useClipResize.ts` | Left/right crop resize state |
| `ArrangerRuler.tsx` | Timeline ruler with zoom/loop overlay |
| `ArrangerClip.tsx` | Individual clip block with resize handles |
| `ArrangerSourcePicker.tsx` | Left column pattern/sample picker |
| `Canvas.tsx` | Orchestration only (~200 lines) |

---

### 13. `PianoRoll.tsx` is 1,329 lines — same decomposition opportunity

**File**: [`PianoRoll.tsx`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/PianoRoll.tsx)

Same pattern as Canvas. Contains piano key sidebar rendering, note block rendering, lasso/drag/resize state, pattern selector dropdown, playhead loop, and zoom control — all in one file.

**Suggested decomposition**:
| New File | Responsibility |
|---|---|
| `usePianoRollDrag.ts` | Note drag/placement/resize state |
| `PianoKeyboard.tsx` | Left piano key sidebar |
| `PianoRollNote.tsx` | Individual MIDI note block |
| `PianoRoll.tsx` | Grid + orchestration only |

---

### 14. `AVAILABLE_SAMPLES` constant is defined locally in `Canvas.tsx` but is also partially duplicated in `getClipMetadata`

**File**: [`Canvas.tsx L19-L23`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/Canvas.tsx#L19-L23), [`Canvas.tsx L335-L368`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/Canvas.tsx#L335-L368)

The `AVAILABLE_SAMPLES` array defines IDs and colors. `getClipMetadata` has a separate `if/else` block manually mapping the same IDs to colors. These should be unified — look up from `AVAILABLE_SAMPLES` in `getClipMetadata` instead of repeating the data.

---

### 15. `ChannelRack.tsx` re-declares a local `ChannelRow` interface that already exists in `types.ts`

**File**: [`ChannelRack.tsx L19-L27`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/ChannelRack.tsx#L19-L27)

```ts
// In ChannelRack.tsx — local duplicate:
interface ChannelRow {
  id: string;
  name: string;
  type: "sample" | "pitch";
  ...
}
```

`types.ts` already exports an identical `ChannelRow`. The local re-declaration will silently diverge from the canonical type if one is updated but not the other.

**Fix**: Remove the local declaration, import `ChannelRow` from `../types`.

---

### 16. `AudioEngine.ts` has a dead private field `metronomeEnabled` and `nextMetronomeBeatToSchedule`

**File**: [`AudioEngine.ts L70-L71`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngine.ts#L70-L71)

```ts
private metronomeEnabled: boolean = false;
private nextMetronomeBeatToSchedule: number = 0;
```

These fields were moved to `TransportScheduler` during the Phase 3 refactoring, but the dead declarations remain in `AudioEngine`. They're never read or written after construction.

**Fix**: Delete both lines. They add confusion when reading the class and suggest the metronome might be controlled from two places.

---

### 17. `AudioEngine.ts` has a duplicate JSDoc comment block at lines 607-612

**File**: [`AudioEngine.ts L607-L612`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngine.ts#L607-L612)

```ts
/**
 * DAW Event Sequencer manipulation tools.
 */
/**
 * DAW Event Sequencer manipulation tools.
 */
```

The same JSDoc section header appears **twice** back to back. Minor, but adds noise when navigating the file.

---

### 18. `handleCloneActivePattern` in `ChannelRack.tsx` mutates engine internal state directly

**File**: [`ChannelRack.tsx L491-L515`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/ChannelRack.tsx#L491-L515)

```ts
engine.getPatterns()[newPatId] = clonedEvents; // direct mutation
```

This mutates the private patterns store via the `getPatterns()` getter which returns the live reference. This bypasses all React state sync, undo history, and future caching. It also means the provider's `patterns` state won't update until the next `setActivePatternId` forces a refresh.

**Fix**: Add a `engine.setPatternEvents(patternId, events)` public method, or use the existing `setPatternsList` API, and call `createPattern` + event injection through the provider's `setEvents` pathway.

---

### 19. `SamplerSettings` type uses `any` in several engine methods

**Files**: [`AudioEngine.ts L391-L408`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngine.ts#L391-L408), [`SamplerEngine.ts L27`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/SamplerEngine.ts#L27)

`updateChannelSamplerSettings`, `updateChannelObsidianSettings`, `getObsidianSettings`, and the `samplerSettings` record are all typed as `any`. `SamplerSettings` is properly defined in `types.ts` and could be used here. This makes autocompletion and refactoring across those interfaces blind.

**Fix**: Replace `any` with `SamplerSettings` from `types.ts` in sampler-related methods, and define an `ObsidianSettings` interface in `types.ts` for obsidian-related methods.

---

## 🟢 Priority 4 — Minor / Polish

### 20. Magic numbers for lane height (`48`, `44`, `38`) scattered across Canvas

**File**: [`Canvas.tsx L290`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/Canvas.tsx#L290), [`Canvas.tsx L614`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/Canvas.tsx#L614), [`Canvas.tsx L1290-L1291`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/Canvas.tsx#L1290-L1291)

Lane height `48`, clip height `38`, header height `44`, and offset `5` appear as inline magic numbers in both layout calculations and lasso hit-test math. If you ever change lane height, you'd need to grep for all occurrences.

**Fix**: Define at the top of the file:
```ts
const LANE_HEIGHT_PX = 48;
const CLIP_HEIGHT_PX = 38;
const CLIP_TOP_OFFSET_PX = 5;
```

---

### 21. `PianoRoll` pattern length hardcoded to 32 beats

**File**: [`PianoRoll.tsx L164`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/PianoRoll.tsx#L164), [`PianoRoll.tsx L290`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/PianoRoll.tsx#L290)

`snappedBeat >= 32` and `playheadBeat % 32` hardcode the pattern length to 32 beats. This prevents variable-length patterns in the future.

**Fix**: Extract as `const PATTERN_LENGTH_BEATS = 32` or read it from a pattern metadata field.

---

### 22. `TransportScheduler` has a hardcoded 4-beat loop for pattern mode

**File**: [`TransportScheduler.ts L337-L339`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/TransportScheduler.ts#L337-L339)

```ts
const loopEndSeconds = this.playbackMode === "pattern" 
  ? this.beatsToSeconds(4) // HARDCODED
  : this.beatsToSeconds(this.loopEnd);
```

Pattern mode always loops at 4 beats regardless of how many notes are in the pattern. A pattern that spans 16 beats will be cut off.

**Fix**: The `scheduleTimelineSegment` callback or the pattern length should be passed in dynamically, or the scheduler should query the active pattern's note range.

---

### 23. `Knob` component's reset logic is duplicated in both `onDoubleClick` and `onPointerDown` (Alt+click)

**File**: [`ChannelRack.tsx L51-L55`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/ChannelRack.tsx#L51-L55), [`ChannelRack.tsx L90-L94`](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/ChannelRack.tsx#L90-L94)

The default-value reset logic is copy-pasted between two handlers:
```ts
const def = defaultValue !== undefined ? defaultValue : (min <= 0 && max >= 0 ? 0 : (min === 0 && max === 100 ? 80 : min));
```

**Fix**: Extract as `const getDefaultValue = () => ...` inside the component.

---

## Summary Table

| # | File | Category | Impact |
|---|---|---|---|
| 1 | `Canvas.tsx` | Engine perf | High — causes lag during clip drag |
| 2 | `AudioEngineProvider.tsx` | Engine perf | Medium — stutter on note/clip ops |
| 3 | `Canvas.tsx`, `PianoRoll.tsx` | Engine perf | Medium — redundant RAF loops |
| 4 | `SamplerEngine.ts` | Audio bug | High — clips bypass volume/pan/mixer |
| 5 | `SamplerEngine.ts` | Engine perf | Medium — main thread timer buildup |
| 6 | `ChannelRack.tsx` | Architecture | Medium — breaks encapsulation |
| 7 | `Canvas.tsx` | UI perf | High — 6,400 DOM nodes |
| 8 | `Canvas.tsx` | UI perf | Medium — 128 DOM ruler divs |
| 9 | `Canvas.tsx` | UI perf | Low-Medium — waveform cache miss |
| 10 | `Canvas.tsx`, `PianoRoll.tsx` | UI perf | Medium — max-fps re-renders |
| 11 | `Desktop.tsx` | UI perf | Medium — N×5 calls per knob change |
| 12 | `Canvas.tsx` | Maintainability | High — 1,440 line file |
| 13 | `PianoRoll.tsx` | Maintainability | High — 1,329 line file |
| 14 | `Canvas.tsx` | Maintainability | Low — duplicated color data |
| 15 | `ChannelRack.tsx` | Type safety | Medium — silent type divergence risk |
| 16 | `AudioEngine.ts` | Cleanliness | Low — dead fields |
| 17 | `AudioEngine.ts` | Cleanliness | Low — duplicate comment |
| 18 | `ChannelRack.tsx` | Architecture | High — direct engine mutation |
| 19 | `AudioEngine.ts` | Type safety | Medium — `any` in public API |
| 20 | `Canvas.tsx` | Maintainability | Low — magic numbers |
| 21 | `PianoRoll.tsx` | Future-proofing | Low — hardcoded 32 beats |
| 22 | `TransportScheduler.ts` | Future-proofing | Medium — hardcoded 4-beat loop |
| 23 | `ChannelRack.tsx` | Cleanliness | Low — duplicated reset logic |
