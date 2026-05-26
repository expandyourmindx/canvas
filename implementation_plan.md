# File System Access API — Sample Browser Overhaul

Replace the static `public/samples/` + `sample-index.json` architecture with a native folder picker that reads samples directly from any location on disk, like a real DAW (Ableton, FL Studio).

## User Review Required

> [!IMPORTANT]
> **Built-in samples**: The 3 synthesized drum presets (kick, snare, hi-hat) generated in [AudioEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngine.ts#L828-L845) via `seedDefaultSamples()` are unaffected by this change — they're generated in memory, not loaded from `/public/samples/`. The browser will still show these as "Built-in" samples.

> [!WARNING]
> **Browser support**: The File System Access API (`showDirectoryPicker`) works in **Chrome, Edge, and Opera** but is **not supported in Firefox or Safari**. If Firefox support matters, we should add a file `<input>` fallback. I'll include a graceful degradation that detects support and shows a file-input fallback if the API is unavailable.

## Open Questions

1. **Should we keep `sample-index.json` and the `/public/samples/` folder at all?** My plan removes them entirely and replaces the "Kicks/Snares/Hats" folders with a single "Built-in Presets" section that shows the 3 synthesized drums. If you want to keep shipping bundled wav files for a default experience, let me know.

2. **Persist across sessions?** The File System Access API lets us store directory handles in IndexedDB so the user doesn't have to re-pick the folder every session. I'll implement this. The user will need to click a "Re-authorize" button once per browser session (browser security requirement — handles persist, but permission must be re-granted per session via a user gesture).

## Proposed Changes

### New Utility: Sample Library Manager

#### [NEW] [SampleLibraryManager.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/SampleLibraryManager.ts)

A standalone class that manages user sample folders via the File System Access API:

- **`addFolder()`** — Opens `showDirectoryPicker()`, recursively walks the directory tree, and builds a virtual folder/file tree of `.wav`, `.mp3`, `.ogg`, `.flac` files
- **`getTree()`** — Returns the current folder tree structure for rendering in the browser panel
- **`getFileHandle(path)`** — Returns a `FileSystemFileHandle` for on-demand audio buffer loading
- **`loadSampleBuffer(handle, audioContext)`** — Reads a file handle → `ArrayBuffer` → `decodeAudioData` → `AudioBuffer`
- **`persistHandles()`** / **`restoreHandles()`** — Stores/retrieves `FileSystemDirectoryHandle` references in IndexedDB for session persistence
- **`removeFolder(handle)`** — Removes a folder from the library

The tree structure will be:
```ts
interface SampleFolder {
  name: string;
  handle: FileSystemDirectoryHandle;
  children: SampleNode[];
}

interface SampleNode {
  type: 'folder' | 'file';
  name: string;
  path: string; // virtual relative path for display
  handle: FileSystemFileHandle | FileSystemDirectoryHandle;
  children?: SampleNode[]; // only for folders
}
```

---

### Sample Browser UI Rewrite

#### [MODIFY] [SampleBrowser.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/SampleBrowser.tsx)

Full rewrite of the sample browser component:

- **Remove**: `fetch("/samples/sample-index.json")` and the static category/sample model
- **Add "Add Folder" button**: Calls `SampleLibraryManager.addFolder()` → `showDirectoryPicker()`
- **Render virtual folder tree**: Recursively renders the tree from `SampleLibraryManager.getTree()` with expandable folders and audio file leaves
- **Lazy loading preserved**: Audio buffers are still only decoded on hover (preview) or drag (load into arranger), using `FileSystemFileHandle.getFile()` → `arrayBuffer()` → `engine.loadSample()`
- **Built-in presets section**: Shows the 3 synthesized drums at the top under a "Built-in" folder that doesn't require the FSAA
- **Remove folder**: Right-click context menu or X button on folder roots to remove them from the library
- **Re-authorize prompt**: On session start, if persisted handles exist but permissions have expired, show a subtle "Click to re-authorize" banner
- **Fallback**: If `showDirectoryPicker` is not available (Firefox), the "Add Folder" button becomes a standard `<input type="file" webkitdirectory>` fallback that reads files via the traditional File API

---

### Integration Touchpoints

#### [MODIFY] [Canvas.tsx](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/components/Canvas.tsx)

- Pass `SampleLibraryManager` instance to `SampleBrowser` (or instantiate it inside SampleBrowser as a local ref — it doesn't need to be in the audio engine context since it's purely a UI/file concern)
- The existing drag-and-drop `onDrop` handler and `handleAudioFileImport` already work with raw `ArrayBuffer` data, so no changes needed to the arranger integration

#### [NO CHANGE] [AudioEngine.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/AudioEngine.ts)

The `engine.loadSample(id, arrayBuffer)` API is already the correct abstraction. SampleBrowser will call it with the ArrayBuffer from the File System Access API handle instead of from `fetch()`. No engine changes needed.

#### [NO CHANGE] [SampleRegistry.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/src/audio/SampleRegistry.ts)

Already decoupled and works with raw ArrayBuffers. No changes needed.

#### [DELETE] [sample-index.json](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/public/samples/sample-index.json)

No longer needed — the folder tree is built dynamically from the filesystem.

---

### Cleanup

#### [MODIFY] [vite.config.ts](file:///c:/Users/elija/Desktop/Coding/Canvas%200.18.0/vite.config.ts)

The `server.watch.ignored` fix from earlier can be kept as defense-in-depth, but the core problem is eliminated since user samples no longer live in `public/`.

## Verification Plan

### Manual Verification
1. Click "Add Folder" → picker opens → select a folder with wav/mp3 files
2. Folder tree renders with correct hierarchy
3. Hover over a sample → preview plays (lazy decode)
4. Drag sample to arranger → clip appears, plays on transport
5. Close browser tab → reopen → persisted folders appear with "Re-authorize" prompt
6. Click re-authorize → folder tree restores
7. Test with 1000+ file folder — should handle smoothly since no Vite involvement
8. Test in Firefox — fallback `<input>` should work
