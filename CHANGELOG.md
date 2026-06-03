# Canvas Changelog

All notable changes to the Canvas DAW project are documented in this file.

The Canvas DAW is a free, open-source Digital Audio Workstation (DAW) built with React and TypeScript. It is in active development and is not yet ready for production use. Expect many bugs and missing features. Changes will be frequent. Do not use this for any real work. 

The Canvas DAW is developed and maintained by an independent developer for the community of people that want this specific workflow in a web based daw. This project is not sponsored or endorsed by any company or organization. Any similarities to any other DAWs are purely coincidental. 

## [0.20.0] - June 3, 2026

### Audio Engine
- **Export Engine**: Export engine now renders time-stretched samples correctly — `RESAMPLE` mode sets proper `playbackRate`, `STRETCH` mode waits for worker completion before rendering.
- **BPM Cache Invalidation**: Stretch buffer cache invalidates on BPM change and re-queues at new tempo, with playhead position preserved mid-change.
- **Sample Browser Preview**: Sample browser preview moved into `AudioEngine` facade — routes through master gain, stops unconditionally on transport stop including repeated stop presses.
- **Channel Controls**: Channel rack volume and pan knobs wired to live Web Audio nodes.

### Mixer
- **16-Channel Mixer**: Full 16-channel mixer signal chain implemented.
- **Accent Colors**: Custom channel strip accent colors with context menu picker.
- **Mute & Solo**: Mute and solo visual states.
- **Fader & Pan Knobs**: Fader and pan knob refinements.

### Effects
- **7-band Parametric EQ**: 7-band Parametric EQ with spectrum analyzer — sharp canvas rendering at any DPI via `ResizeObserver`.
- **Convolution Reverb**: Convolution Reverb with corrected decay time constant.

### Arrangement
- **Clip Frame & Waveform**: Clip frame driven by `clip.duration` as single source of truth — waveform scale independent of frame width.
- **Resize Handles**: Clip resize handles scale with zoom level.
- **Resample Clips**: `RESAMPLE` clips visually resize using `effectiveBeats` correctly.

### Code Quality
- **Typed Voices**: `SamplerVoice` interface replaces `any[]` voice map throughout `SamplerEngine`.
- **O(1) Sample Cache**: `SampleRegistry` LRU cache migrated to Map-based O(1) operations.
- **Lifecycle Cleanup**: RAF lifecycle cleanup fixed — `rafIdRef` nulled and `rafPendingRef` reset on unmount.

### UI — Vintage Console Dark Theme Pass
- **Theme Pass**: Full theme applied across: `TopToolbar`, `ChannelRack`, `Mixer`, `Canvas`, `ArrangerClip`, `ArrangerRuler`, `ArrangerSourcePicker`, `DraggableWindow`, `SampleBrowser`, `PianoRoll`, `ExportWindow`, `Sampler`, `ParametricEQPanel`, `ReverbPanel`.

### Project
- **New Project**: New Project — clears session with unsaved changes prompt.
- **Saves & Guards**: Save, Load, Auto-save, dirty flag, `beforeunload` guard.

---

## [0.19.0] - May 27, 2026

### Project & State Management
- **Native Save/Load**: Added native system file save picker (`showSaveFilePicker`) for `.cnv` project files with traditional download fallback.
- **Auto-Save & Recovery**: Automatic background saving to `localStorage` with a recovery banner in the toolbar.
- **Auto Sample Resolution**: Automatically scans and restores missing project samples from authorized library folders on load.
- **Dirty State Guard**: Track project dirty status and alert users before unloading the page.

### Audio Engine & Transport
- **Spectrogram & Oscilloscope**: Integrated a real-time logarithmic spectrogram and waveform oscilloscope into the TopToolbar (click-to-toggle).
- **Transport Safeguards**: Solved loop-end click stutters by scheduling cutoff at precise hardware times and implemented a 30ms fade-out on loop wrap.
- **Channel Rack State History**: Integrated the channel rack controls into the undo/redo history state serialization.
- **Eviction Cache**: Added LRU cache eviction to the `SampleRegistry` to release memory and prevent leaks during long sessions.

### Arrangement & Piano Roll
- **Infinite Timelines**: Implemented infinite dynamic viewport bounds and virtualized ruler lines for both timeline and piano roll.
- **Alternating Shading**: Added alternating background shading for every group of 4 bars on grids.
- **Lasso & Selection Polish**: Standardized additive selection (`Ctrl+Shift+Click`), lasso groups, terracotta highlighting, and group resizing.
- **Pencil Brush Memory**: Pencil tool now remembers the duration of the last clicked or resized note/clip to replicate on subsequent draws.
- **Drag-and-Drop Placement**: Supports drag-to-place timeline clips with ghost placement preview and auto-selection.

### Sample Browser
- **Miniature Waveforms**: Displays miniature canvas waveforms next to sample library file nodes.
- **Interruption Auditions**: Moving to a new preview or starting host transport instantly halts current browser sample play.

### Effects
- **7-Band Parametric EQ**: Added a fully featured 7-band parametric EQ with interactive SVG control curve, real-time analyzer background, and mixer integration.

---

## [0.18.0] - May 25, 2026

### Added
- **Instant Keyboard Audition (QWERTY-to-MIDI)**: Your computer keyboard is now armed as a MIDI controller by default on startup. Play synth notes instantly upon loading the DAW without opening options. Additionally, keyboard shortcuts holding `Ctrl` (such as Undo/Redo) automatically bypass the MIDI engine, so you will never trigger accidental overlapping notes when reverting an action.
- **Global Project Undo & Redo**: A robust, universal project undo history manager is now live. Press `Ctrl+Z` to undo and `Ctrl+Y` (or `Ctrl+Shift+Z`) to redo complex actions like note or clip placement, deleting, resizing, and splitting. Move gestures are smart and only push a single history checkpoint after you release the mouse, keeping your undo history clean and responsive.
- **High-Fidelity WAV Mixdowns**: Bouncing your tracks now captures the exact settings of the active Obsidian synth preset (such as unison detune voice stacking, filter envelope sweeps, and ADSR curves) exactly as they sound during live playback, with complete protection against rendering voice cut-offs.
- **50 Tracks by Default**: The Arrangement timeline grid now starts with 50 tracks by default, giving you plenty of lanes to build large arrangements right away.
- **Full-Screen Viewport Stretching**: The Arrangement window now stretches dynamically to occupy all available space. When maximized, it fills the entire window height rather than staying boxed in at the top.
- **Independent Viewport Scrolling**: Restricted the scrolling bounds so that scrolling up and down through track lanes only scrolls the timeline grid, preventing the host browser web page from sliding up or down.
- **Sticky Timeline & Piano Roll Headers**: The beats/bars count numbers at the top of the Arranger timeline and the Piano Roll grid, as well as the piano keyboard's top-left corner spacer, now stay locked at the top of the viewport when you scroll vertically, keeping your grid coordinates fully visible.
- **Custom Pencil Tool Pointer**: Replaced the default crosshair cursor with a sleek, compact white pencil pointer when drawing clips or notes. The pencil is angled up-left (just like a standard mouse pointer) and targets the tip for accurate placements.
- **Omnidirectional Middle-Click Panning**: Clicking and dragging with your mouse scroll wheel (middle-click) now allows you to pan the view both horizontally (left/right) and vertically (up/down) in a fluid, seamless motion.
- **Viewport Auto-Scroll While Dragging**: If you drag a clip or note near the edges of the screen, the view automatically slides in that direction so you can drop it off-screen without releasing your mouse.
- **Group Duplication & Dragging**: You can now duplicate groups of selected notes or clips while holding `Shift` and dragging, even when the Pencil tool is active. The duplicated elements stay focused and highlighted as a group so you can drag them further.
- **Draggable Window Compact Headers**: Reduced floating window title bar heights from `36px` to `30px` and minimized close/maximize icons, freeing up valuable screen real estate to maximize your workspace.
- **Alt + Left-Click Reset Knobs & Faders**: Holding `Alt` and left-clicking any knob (ADSR envelopes, panning, filters) or vertical volume fader instantly snaps it back to its logical default value.
- **Ctrl + Click Drag Lasso Override**: Hold `Ctrl` and drag on empty grid space to instantly trigger the lasso selection tool, even when in Pencil mode. You can now highlight groups of notes and clips dynamically without having to switch active tools.
- **Ctrl + Scroll Wheel Horizontal Zooming**: Hold `Ctrl` and scroll your mouse wheel to zoom the Arrangement timeline horizontally in a smooth, fluid manner, matching the responsiveness of hardware DAWs.
- **Toolbar Button Toggles**: Clicking active buttons on the top dock toolbar now correctly toggles floating windows closed if they are open, making navigation much faster.

### Fixed
- **100% Scroll-Proof Slicing / Splitting**: Slicing notes or clips now aligns sample-accurately at snap grid divisions under any scroll displacements or zoom levels, eliminating click coordinate drift.
- **Drift-Free Timeline Grid & Preview Layouts**:
  - Re-engineered vertical grid lines, timeline ruler markers, and loops to align absolutely. This completely eliminates visual shifting or grid alignment drifts when zooming or stretching tracks.
  - Pattern clip mini-note previews now scale pixel-perfectly without centering or drifting when clips are stretched.
  - Selected clips now use a clean flat white border and inner glow instead of scaling down, keeping them perfectly locked to their timeline grid lines when resizing.
- **Arrangement Timeline Lasso Selection**: Fixed a layout bug where the lasso group-selection tool in the Arrangement timeline was blocked by outer window bounds. Lassoing now works flawlessly in both pointer and pencil modes using standard modifiers.
- **Right-Click Drag Eraser Context Menu Block**: Right-click drag-to-delete now correctly suppresses the browser's default right-click context menu, allowing you to fluidly paint-erase notes or clips without menus popping up when you release the mouse.

---

## [0.17.0] - May 24, 2026

### Added
- **Obsidian Synth Polyphony & Detune**: Upgraded the synth to support playing up to 12 notes at once. It now features Voice Stealing (cleanly cuts off the oldest notes with a quick 5ms fade to save resources), Unison detune voice stacking (layer up to 5 detuned voices for thick analog lead and pad sounds), and an extra sub-oscillator pitched 1 octave down.
- **LFO Modulation Routing**: Added dynamic LFO controls to modulate your sound's Pitch (Vibrato), Filter Cutoff (Wobble), and Volume (Tremolo) instantly.
- **Filter Envelope Depth**: Added a dedicated `ENV AMT` (Envelope Amount) knob to adjust filter envelope cutoff sweeps from 0% to 100%.
- **Interactive Envelope Graphs**: Replaced static text fields with beautiful, interactive SVG curves for both the Amplitude and Filter ADSR Envelopes that animate in real-time as you tweak the knobs.

### Fixed
- **TypeScript & Layout Fixes**: Restructured typescript declarations to fix syntactical issues in the synth engine. Realigned bento grid spacing in sidebar cards to prevent visual overlap.

---

## [0.16.0] - May 24, 2026

### Added
- **High-Quality WAV Exporter**: Added a fast offline renderer that exports your entire song timeline, volume automation, panning, and mixer tracks into a high-fidelity 16-bit WAV audio file for immediate download.
- **Piano Roll Playhead Guide Lines**: Added a visual red playhead line and top ruler cap that glides across your grid in real-time to follow playback smoothly.
- **Multi-Note Resizing**: You can now select a group of MIDI notes and drag the edge of any note to resize the entire selected group proportionally.
- **Double-Click Mixer Renaming**: Double-click any mixer channel name input field to type in your own custom track names.
- **Clean Monochromatic Design**: Refactored the top toolbar to feature a sleek, professional monochrome theme with micro-scaling window toggle buttons.

### Fixed
- **First-Beat Audio Jitter**: Added a brief 50ms buffer to the transport play command to eliminate browser thread lag, ensuring the very first beat of your project triggers notes at exact sample-accurate tempo.
- **Playhead Jumping Safeguards**: Prevented the playhead from jumping to negative coordinate offsets.
- **MIDI Layer Isolation**: Scoped MIDI notes strictly to their active instrument channels to prevent overlapping notes from bleeding into other tracks.
- **Channel Dragging Grips**: Locked channel rack dragging behavior to drag handle icons to prevent sliders or panning knobs from accidentally initiating drag-and-drop actions.

---

## [0.15.0] - May 24, 2026

### Added
- **Decoupled Sampler Engine**: Decoupled the drum sampler code from the sequencer's core scheduler into its own separate high-performance module. This drastically simplifies the sequencing manager and streamlines memory cleanup, voice tracking, ADSR calculations, and note trigger latency.
- **Clean Modular Injection**: Standardized internal engine APIs to share context objects, sample registries, and mixing tracks cleanly.

### Fixed
- **Vite Blank Screen Patch**: Fixed compile errors and configured automatic build date tags to restore the developer server on launch.

---

## [0.14.2] - May 2026

### Added & Fixed
- **MIDI Keyboard Routing Patch**: Refactored keyboard and piano roll triggers to direct note mappings cleanly to the selected channel track.
- **Focused Channel Fallback**: Programmed global MIDI triggers to target the active channel rack slot automatically if no channel ID is specified.
- **Standardized Note Auditions**: Simplified note preview routing to pass consistent velocity and pitch values into standard synthesizer note-on/note-off actions.

---

## [0.14.0] - May 2026

### Added
- **Offline Export Pipeline**: Designed the high-performance offline rendering engine to bounce tracks, filters, and sampler slots into audio contexts without dropouts.
- **Skeuomorphic Export Dialog**: Built a professional export overlay window containing progress bars, sample rate selectors, and diagnostic log readouts.

---

## [0.13.0] - May 2026

### Added
- **Mixing Console**: Built a standard mixing console featuring individual strips for each active channel track, complete with volume faders, spatial panning knobs, and solo/mute switches.
- **Real-time Volume DB Peak Meters**: Added active volume level meters on top of mixer tracks that render dynamic audio level fluctuations in real-time.

---

## [0.12.0] - May 2026

### Added
- **Timeline Snap Controls**: Added standard snap division configurations to align note and clip placements perfectly to beat coordinates.
- **Adaptive Viewport Zooming**: Programmed linear track scaling formulas to support fluid horizontal zooms and adaptive row scaling.

---

## [0.11.0] - May 2026

### Added
- **Decoupled Obsidian Synth Engine**: Isolated voice-generation logic from sequencing systems into a dedicated, clean synth engine module.
- **Live Parameter Controls**: Wired up live synthesizers envelopes, filter cuts, detunes, and resonances through dynamic engine-level APIs.

---

## [0.10.4] - May 2026

### Added
- **Pencil vs. Pointer Selection Tools**: Introduced dedicated Pencil/Draw and Pointer/Relocate tools in the Piano Roll and Arranger Canvas, keeping their states fully independent.
- **Flat Header Toggle Bars**: Designed hardware-style toolbar buttons featuring Lucide icon targets and active state highlights.
- **Lasso Multi-Select Box**: Designed a real-time lasso selection rectangle that highlights notes and clips instantly when dragging.
- **Group Relocation Relocator**: Coded group movement calculations that translate multiple selected notes/clips together across time grids and pitches.

---

## [0.10.3] - May 2026

### Added
- **Obsidian Synthesizer**: Built a virtual-analog subtractive synth featuring standard waveforms, lowpass/highpass filter sweeps, and custom filter envelopes.
- **Oscillator Selection**: Added support for selecting Sine, Square, Triangle, and Sawtooth shapes in the audio routing nodes.
- **Responsive ADSR Sliders**: Configured responsive envelopes to mold attack, decay, sustain, and release phases.

---

## [0.10.2] - May 2026

### Added
- **Offline Audio Exporter**: Created a high-speed offline exporter supporting configurable sample rates and standard target lengths.
- **Interactive Export Widget**: Designed progress indicators to show estimated remaining encode times during exports.

---

## [0.10.1] - May 2026

### Added
- **QWERTY Keyboard MIDI recording**: Wired standard PC keyboard rows to play piano roll notes instantly.
- **Web MIDI Hardware Support**: Integrated external MIDI hardware input listeners inside the primary audio manager to capture incoming velocity, note-on, and note-off events from physical keyboard instruments.

---

## [0.10.0] - May 2026

### Added
- **Multi-Track Mixer Desk**: Built a mixing deck Mockup containing volume control faders, panning, and solo/mute targets for all tracks.
- **Volume Peak DB Meters**: Integrated fast volume meters showing instant signal level peak amplitudes.
- **Stereo Field Panning**: Wired up Web Audio stereo panners to panning controls.

---

## [0.9.0] - May 2026

### Added
- **Draggable Desktop Windows**: Implemented a floating window manager supporting window dragging, bounds restraints, and layer ordering.

---

## [0.8.0] - May 2026

### Added
- **Lookahead Scheduler**: Programmed a high-precision lookahead scheduler running inside web worker threads to prevent notes from lagging.
- **Accented Metronome**: Extended the metronome to support customizable tempo, accent beats, and click volumes.

---

## [0.7.0] - May 2026

### Added
- **Dynamic Sound Presets**: Built file loading configurations supporting dynamic asset library mapping.
- **Integrated Drum Sampler Plugin**: Built a standalone sampler plugin for quick drag-and-drop sample loads and dynamic gain controls.

---

## [0.6.0] - May 2026

### Added
- **Hardware-Styled Transport Deck**: Built a skeuomorphic transport dashboard showing playback indicators, metronome switches, and BPM settings.
- **Universal Audio State Sync**: Unified state management across playback controls.

---

## [0.5.0] - May 2026

### Added
- **Arrangement Grid Canvas**: Built the Arranger timeline supporting click-to-stamp clip placement.
- **Horizontal Viewport Scrolling**: Set up arranger track views with visual lane indicators that scale dynamically with zooms.

---

## [0.4.0] - May 2026

### Added
- **Drum Step Sequencer**: Built step sequencing grids in the Channel Rack for quick beats.
- **Flexible Pattern loop models**: Designed data objects aligning custom sequencer loops.

---

## [0.3.0] - May 2026

### Added
- **Melodic Piano Roll**: Created a fully interactive note editor featuring standard piano keys and visual grids.
- **Quantization Snaps**: Built snap configuration utilities to align user clicks to exact beat divisions.

---

## [0.2.0] - May 2026

### Added
- **Base Web Audio Scheduler**: Designed high-priority scheduler models utilizing exact context times to prevent dropouts under heavy loads.
- **Background Worker Timers**: Configured background thread intervals to run metronomes even when browser tab focus is lost.

---

## [0.1.0] - May 2026

### Added
- **Project Initialization**: Configured core TypeScript files, React window layouts, and standard Tailwind style templates.
