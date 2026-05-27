# Implementation Plan — Project Save & Load (v0.18.1)

Implement a robust, complete project save and load solution for the Canvas DAW. The system features:
1. **Auto-save (localStorage)**: Debounced every 2 seconds, saving state automatically with a premium visual session recovery banner on application startup.
2. **Manual Save / Load**: Intercepts `Ctrl+S` and `Ctrl+O` with custom browser file-picker actions, allowing users to download and load `.canvas` project JSON files.
3. **Session Loss Prevention**: Intercepts accidental exits or refreshes (`Ctrl+R` / close tab) with standard browser confirmation prompts.
4. **Resilient Loading Engine**: Validates, restores, and re-sequences the entire DAW state (tracks, notes, mixer, synthesizers, sampler envelopes, loops), with automatic built-in sample re-seeding and a clean non-blocking warnings banner for missing user samples.

---

## User Review Required

> [!IMPORTANT]
> **Exit Confirmation Warning**: The browser's native `beforeunload` pop-up will appear on page reload or close to prevent accidental project wipe. The actual message content cannot be custom-styled due to modern browser security policies, but it guarantees session preservation.
> 
> **User Sample Access**: Browsers require explicit user permission to read files from disk. If a loaded project contains user samples (linked via the File System Access API), they cannot be read automatically until the user grants access. The engine will display a premium non-blocking alert banner letting the user know which samples are offline, and built-in trap drum samples will re-seed immediately without any user action.

---

## Open Questions

*No critical open questions exist. The requirements are fully specified.*

---

## Proposed Changes

### Types & Data System

#### [MODIFY] [types.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/types.ts)
- Define `DAWEvent` and a serializable definition of `MixerInsert` inside `types.ts` to avoid circular dependencies.
- Define the `CanvasProject` interface exactly as specified.
- Export all three definitions so that the React components and audio engines can consume them cleanly.

---

### Audio & Mixer Engines

#### [MODIFY] [MixerManager.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/MixerManager.ts)
- Import the updated `MixerInsert` type from `../types`.
- Add `restoreMixerInserts(inserts: MixerInsert[]): void` to restore insert volume, panning, mute/solo state, and custom insert names to the active Web Audio nodes.
- Re-run the global `updateInsertSolo()` hierarchy once restoration completes.

#### [MODIFY] [AudioEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngine.ts)
- Import `DAWEvent` and `MixerInsert` from `../types` and remove redundant exports/types to avoid circular references.
- Implement the requested state facade methods:
  - `getAllSamplerSettings(): Record<string, SamplerSettings>`
  - `restoreAllSamplerSettings(settings: Record<string, SamplerSettings>): void`
  - `getMixerInserts(): MixerInsert[]` (delegates to `MixerManager`)
  - `restoreMixerInserts(inserts: MixerInsert[]): void` (delegates to `MixerManager`)
  - `getLoopSettings(): { loopStart: number; loopEnd: number; loopEnabled: boolean }` (converts internal `isLooping` structure to `loopEnabled`)
  - `setLoopSettings(settings: { loopStart: number; loopEnd: number; loopEnabled: boolean }): void` (delegates to `setLoop`)

---

### React Engine & State Controller

#### [MODIFY] [AudioEngineProvider.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngineProvider.tsx)
- Implement `collectProjectState(): CanvasProject` to bundle all current track states, events, loops, sampler/obsidian configurations, mixer properties, and registry cache metadata.
- Implement `restoreProjectState(project: CanvasProject): void` which runs the precise loading lifecycle order:
  1. Push current state to undo history
  2. Set engine state: events, pattern listings, and visual canvas clips
  3. React layer rack sync (via registered setters)
  4. Channel parameters: loop and synchronize volume/panning/routing
  5. Apply instrument details (all Sampler settings & Obsidian synth parameters)
  6. Re-configure the mixer console inserts
  7. Sync loop markers and tempo BPM
  8. Flush and update React context hook variables
  9. Run sample checks to flag missing offline user assets
- Expose a `registerDesktopSync` callback to retrieve/restore lifted states from `Desktop.tsx` (volume, pan, mixer console routing, track rows).
- Expose manual `saveProject()` and `loadProject()` triggers.
- Implement background debounced auto-save checking: runs a `setInterval` every 2 seconds, diffing stringified project states to prevent thrashing.
- Implement `beforeunload` window listener.
- Expose `autosaveProject` (recovery banner trigger) and `missingSamples` (warning banner trigger) states.

---

### User Interface Overlays & Triggers

#### [MODIFY] [Desktop.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/Desktop.tsx)
- Wire up the lifted channel, volume, panning, and routing hooks using `registerDesktopSync` inside an effect.
- Render a premium glassmorphic **Session Recovery Banner** at the top of the desktop area if `autosaveProject` is found on startup, featuring:
  - High-end dark ambient styling, soft blue glow, dynamic scaling hover effects.
  - Options: "Restore Session" and "Dismiss".
- Render a premium glassmorphic **Offline Samples Warning Banner** listing missing user files with an instructions guide to click and locate them.

#### [MODIFY] [TopToolbar.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/TopToolbar.tsx)
- Import `Save` and `Upload` (or `FolderOpen`) icons from `lucide-react`.
- Render beautiful, compact **Save** and **Load** buttons in the left section next to the "CANVAS" title.
- Connect buttons to `saveProject` and `loadProject` from the audio engine context.
- Intercept global `Ctrl+S` (Save) and `Ctrl+O` (Load) shortcuts inside a clean `useEffect` listener that overrides browser defaults.

---

## Verification Plan

### Automated Verification
- Run `npx tsc --noEmit` to ensure type checker passes with absolutely zero errors.
- Validate that standard Vite hot reloading remains stable without memory leaks.

### Manual Verification
1. **Auto-save & Recovery**:
   - Add a couple of notes in the Piano Roll or drag a sample onto the timeline.
   - Wait 2 seconds. Verify console displays `[Auto-save] Saved project to localStorage`.
   - Refresh the page. Verify the premium **Session Recovery Banner** appears with the correct timestamp.
   - Click "Restore Session". Confirm all notes, tracks, and clips restore seamlessly.
2. **Manual Save / Load File Picker**:
   - Press `Ctrl+S` or click "Save". Verify a `.canvas` JSON file downloads.
   - Close the page, reopen, and click the "Load" button or press `Ctrl+O`.
   - Pick the `.canvas` file. Confirm everything restores with a clean undo/redo stack.
3. **Accidental Refresh Protection**:
   - Try to reload (`Ctrl+R`) or close the tab. Confirm that browser prompts you with a warning.
4. **Missing Samples Alert**:
   - Add a custom user sample, save the project, reload, and verify that the offline sample warning banner triggers if the sample registry hasn't re-loaded that local file.
