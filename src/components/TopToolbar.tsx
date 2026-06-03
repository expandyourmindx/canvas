/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from "react";
import { useAudioEngine } from "../audio/useAudioEngine";
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  ChevronDown,
  FolderOpen,
  Save,
  Upload,
  FolderTree,
  LayoutTemplate,
  AlignJustify,
  Piano,
  SlidersHorizontal,
  FileAudio,
  FilePlus
} from "lucide-react";
import { CANVAS_VERSION } from "../config";
import { 
  DARK, 
  raised, 
  sunken, 
  flat, 
  flush, 
  SPACE, 
  SIZE 
} from "../../public/Themes/Vintage Console/tokens";

interface TopToolbarProps {
  activeWindows: {
    canvas: boolean;
    sequencer: boolean;
    pianoroll: boolean;
    mixer: boolean;
    export?: boolean;
    sampler?: boolean;
    obsidian?: boolean;
  };
  winOrder: any[];
  toggleWindow: (winId: any) => void;
  onSetFocus: (winId: any) => void;
  browserOpen?: boolean;
  onToggleBrowser?: () => void;
}

export function TopToolbar({ activeWindows, winOrder, toggleWindow, onSetFocus, browserOpen, onToggleBrowser }: TopToolbarProps) {
  const {
    engine,
    playbackState,
    playbackMode,
    position,
    bpm,
    metronomeEnabled,
    play,
    pause,
    stop,
    setBpm,
    setPlaybackMode,
    toggleMetronome,
    pcKeyboardMidiActive,
    setPcKeyboardMidiActive,
    baseOctave,
    setBaseOctave,
    newProject,
    saveProject,
    loadProject,
    autosaveProject,
    restoreAutosave,
    isDirty,
  } = useAudioEngine();

  const [visMode, setVisMode] = useState<"spectrum" | "waveform">("spectrum");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visModeRef = useRef<"spectrum" | "waveform">("spectrum");

  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);

  // Hover states for dropdown menus and buttons
  const [hoveredFileItem, setHoveredFileItem] = useState<string | null>(null);
  const [hoveredOctaveItem, setHoveredOctaveItem] = useState<number | null>(null);
  const [hoveredDockBtn, setHoveredDockBtn] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(event.target as Node)) {
        setIsFileMenuOpen(false);
      }
    };
    if (isFileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isFileMenuOpen]);

  useEffect(() => {
    visModeRef.current = visMode;
  }, [visMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !engine) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const analyser = engine.getOrCreateMixerInsert(0).analyserNode;
    analyser.fftSize = 1024;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const sampleRate = analyser.context.sampleRate || 44100;
    const numBars = 36; // High resolution bands
    const barWidth = canvas.width / numBars;

    // Scientific logarithmic bin mapping: accurately distributes bands across human hearing range (20Hz - 20kHz)
    const minHz = 35;
    const maxHz = 18000;
    const binIndices = new Int32Array(numBars);
    for (let i = 0; i < numBars; i++) {
      const targetHz = minHz * Math.pow(maxHz / minHz, i / (numBars - 1));
      const binIndex = Math.min(
        bufferLength - 1,
        Math.max(0, Math.round((targetHz * 1024) / sampleRate))
      );
      binIndices[i] = binIndex;
    }

    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);

      if (visModeRef.current === "waveform") {
        analyser.getByteTimeDomainData(dataArray);

        // Solid dark background clear matching DARK.bg0clear
        ctx.fillStyle = "rgba(6, 10, 15, 0.25)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Zero-crossing trigger search to stabilize the oscilloscope line
        let triggerIndex = 0;
        for (let i = 0; i < bufferLength / 2; i++) {
          if (dataArray[i] < 128 && dataArray[i + 1] >= 128) {
            triggerIndex = i;
            break;
          }
        }

        ctx.lineWidth = 1.5;
        ctx.strokeStyle = DARK.accentBlue;
        ctx.shadowBlur = 0; // No glow
        ctx.beginPath();

        const displayLength = Math.min(bufferLength - triggerIndex, 256); // show a clean window of 256 samples
        const sliceWidth = canvas.width / displayLength;
        
        for (let i = 0; i < displayLength; i++) {
          const v = dataArray[triggerIndex + i] / 128.0;
          const y = (v * canvas.height) / 2;
          const x = i * sliceWidth;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();
      } else {
        analyser.getByteFrequencyData(dataArray);

        // Trailing motion blur fade
        ctx.fillStyle = "rgba(6, 10, 15, 0.25)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < numBars; i++) {
          const binIndex = binIndices[i];
          const val = dataArray[binIndex] || 0;
          
          // Scale frequency amplitude using decibel-like weighting
          const amplitude = val / 255;
          // Subtle gain compensation for high-end bands to balance visual energy
          const boost = 1 + (i / numBars) * 0.45;
          const barHeight = Math.min(canvas.height, amplitude * canvas.height * 0.95 * boost);

          // Vintage Console Blue-to-Green gradient
          const grad = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
          grad.addColorStop(0, DARK.accentBlue); // cyan-blue bottom
          grad.addColorStop(1, DARK.accentGreen); // green top

          ctx.fillStyle = grad;
          const yPos = canvas.height - barHeight;
          
          // Draw high-precision thin bar
          ctx.fillRect(i * barWidth, yPos, barWidth - 1, barHeight);
        }
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [engine]);

  // Local state for Tempo BPM to handle smooth inline keyboard entry
  const [bpmInput, setBpmInput] = useState<string>(bpm.toString());
  const [showOctaveMenu, setShowOctaveMenu] = useState<boolean>(false);
  const [displayMode, setDisplayMode] = useState<"time" | "beats">("time");

  const [isTapped, setIsTapped] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const tapTimesRef = useRef<number[]>([]);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lockTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    };
  }, []);

  const handleTap = () => {
    const now = Date.now();

    // Clear active inactivity reset timeout since a new tap occurred
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }

    const lastTap = tapTimesRef.current[tapTimesRef.current.length - 1];

    // Reset tap history if more than 2 seconds pass between taps
    if (lastTap && now - lastTap > 2000) {
      tapTimesRef.current = [];
      setIsLocked(false);
    }

    tapTimesRef.current.push(now);

    // Keep history buffer size at up to 8 taps
    if (tapTimesRef.current.length > 8) {
      tapTimesRef.current.shift();
    }

    const N = tapTimesRef.current.length;
    let stableDetected = false;
    let targetBpm = bpm;

    // Check stability over the last 3 intervals (requires at least 4 taps)
    if (N >= 4) {
      const t_a = tapTimesRef.current[N - 4];
      const t_b = tapTimesRef.current[N - 3];
      const t_c = tapTimesRef.current[N - 2];
      const t_d = tapTimesRef.current[N - 1];

      const I1 = t_b - t_a;
      const I2 = t_c - t_b;
      const I3 = t_d - t_c;

      const B1 = 60000 / I1;
      const B2 = 60000 / I2;
      const B3 = 60000 / I3;

      const maxBpm = Math.max(B1, B2, B3);
      const minBpm = Math.min(B1, B2, B3);

      // Lock in if the last 3 consecutive intervals produce a value within 5 BPM of each other
      if (maxBpm - minBpm <= 5) {
        stableDetected = true;
        const avgInterval = (I1 + I2 + I3) / 3;
        targetBpm = Math.round(60000 / avgInterval);
      }
    }

    if (stableDetected) {
      // Commit stable BPM rounded to the nearest whole number
      if (targetBpm >= 20 && targetBpm <= 300) {
        setBpm(targetBpm);
        setBpmInput(targetBpm.toString());
      }

      // Stability Lock visual feedback (emerald)
      if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      setIsTapped(false);
      setIsLocked(true);
      lockTimeoutRef.current = setTimeout(() => {
        setIsLocked(false);
      }, 800);
    } else {
      // Not stable yet - show live calculated decimal preview in the input field
      if (N >= 2) {
        let totalInterval = 0;
        const count = N - 1;
        for (let i = 0; i < count; i++) {
          totalInterval += tapTimesRef.current[i + 1] - tapTimesRef.current[i];
        }
        const avgIntervalMs = totalInterval / count;
        const calculatedBpm = 60000 / avgIntervalMs;

        if (calculatedBpm >= 20 && calculatedBpm <= 300) {
          setBpmInput(calculatedBpm.toFixed(1));
        }
      }

      // Regular tap flash visual feedback (indigo)
      if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      setIsLocked(false);
      setIsTapped(true);
      tapTimeoutRef.current = setTimeout(() => {
        setIsTapped(false);
      }, 120);
    }

    // Reset everything if more than 2 seconds pass between taps
    resetTimeoutRef.current = setTimeout(() => {
      tapTimesRef.current = [];
      setIsLocked(false);
      setIsTapped(false);
      setBpmInput(bpm.toString());
    }, 2000);
  };

  const handleWindowClick = (winId: any) => {
    const isOpen = activeWindows[winId as keyof typeof activeWindows];
    if (isOpen) {
      // Find the open window with the highest index in winOrder
      let highestOpenWin: any = null;
      let highestIndex = -1;
      for (const id of winOrder) {
        if (activeWindows[id as keyof typeof activeWindows]) {
          const index = winOrder.indexOf(id);
          if (index > highestIndex) {
            highestIndex = index;
            highestOpenWin = id;
          }
        }
      }
      const isFocused = highestOpenWin === winId;
      if (isFocused) {
        // If already open and focused, toggle it closed/minimized
        toggleWindow(winId);
      } else {
        // If open but not focused (behind other windows), focus it (bring to front)
        onSetFocus(winId);
      }
    } else {
      // If closed, open it and focus it
      toggleWindow(winId);
      onSetFocus(winId);
    }
  };

  useEffect(() => {
    setBpmInput(bpm.toString());
  }, [bpm]);

  const handleBpmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(bpmInput);
    if (!isNaN(parsed) && parsed >= 20 && parsed <= 300) {
      setBpm(parsed);
    } else {
      setBpmInput(bpm.toString());
    }
  };

  const handleBpmBlur = () => {
    const parsed = parseFloat(bpmInput);
    if (!isNaN(parsed) && parsed >= 20 && parsed <= 300) {
      setBpm(parsed);
    } else {
      setBpmInput(bpm.toString());
    }
  };

  // Convert raw beats into Bar : Beat : 16th : Tick
  const beatsValue = position.beats;
  const bars = Math.floor(beatsValue / 4) + 1;
  const targetBeats = Math.floor(beatsValue % 4) + 1;
  const sixteenths = Math.floor((beatsValue % 1) * 4) + 1;
  const ticks = Math.floor(((beatsValue % 0.25) / 0.25) * 240);

  // Convert seconds into Min : Sec . Ms
  const totalSeconds = position.seconds;
  const displayMin = Math.floor(totalSeconds / 60);
  const displaySec = Math.floor(totalSeconds % 60);
  const displayMs = Math.floor((totalSeconds % 1) * 1000);

  const zeroPad = (num: number, targetLength: number) => {
    return String(num).padStart(targetLength, "0");
  };

  // Configure Window Dock Buttons (excluding obsidian Zap button)
  const dockButtons = [
    ...(onToggleBrowser ? [{ id: "browser", title: "Sample Browser", active: !!browserOpen, onClick: onToggleBrowser, icon: FolderTree }] : []),
    { id: "canvas", title: "Arranger Window", active: !!activeWindows.canvas, onClick: () => handleWindowClick("canvas"), icon: LayoutTemplate },
    { id: "sequencer", title: "Channel Rack Window", active: !!activeWindows.sequencer, onClick: () => handleWindowClick("sequencer"), icon: AlignJustify },
    { id: "pianoroll", title: "Piano Roll Window", active: !!activeWindows.pianoroll, onClick: () => handleWindowClick("pianoroll"), icon: Piano },
    { id: "mixer", title: "Mixer Window", active: !!activeWindows.mixer, onClick: () => handleWindowClick("mixer"), icon: SlidersHorizontal },
    { id: "export", title: "Export Window", active: !!activeWindows.export, onClick: () => handleWindowClick("export"), icon: FileAudio },
  ];

  return (
    <header
      id="daw-top-toolbar"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 44,
        backgroundColor: DARK.bg1,
        borderBottom: `1px solid ${DARK.bevelDark}`,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `0 ${SPACE.lg}px`,
        gap: `${SPACE.md}px`,
        boxSizing: "border-box",
        userSelect: "none",
      }}
    >
      {/* LEFT BRAND SECTION & SAVE/LOAD BUTTONS */}
      <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.xl}px`, paddingLeft: "4px" }}>
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <h1 
            style={{
              fontFamily: DARK.font,
              fontSize: "11px",
              fontWeight: "bold",
              color: DARK.textHi,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              margin: 0,
              lineHeight: 1,
            }}
          >
            CANVAS
          </h1>
          <span style={{ color: DARK.textDim, fontSize: "8px", fontFamily: DARK.font, marginLeft: `${SPACE.xs}px` }}>
            v{CANVAS_VERSION}
          </span>
        </div>

        {/* File Menu Dropdown */}
        <div style={{ position: "relative", marginLeft: `${SPACE.sm}px` }} ref={fileMenuRef}>
          <button
            onClick={() => setIsFileMenuOpen((prev) => !prev)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: `${SPACE.xs}px`,
              padding: `0 ${SPACE.md}px`,
              height: "22px",
              backgroundColor: isFileMenuOpen ? DARK.bg5 : DARK.bg3,
              color: DARK.textMid,
              fontFamily: DARK.font,
              fontSize: "8px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              cursor: "pointer",
              border: "none",
              boxSizing: "border-box",
              ...(isFileMenuOpen ? sunken(DARK) : raised(DARK)),
            }}
            title="File operations and autosave recovery"
          >
            <FolderOpen size={10} style={{ color: DARK.textMid }} />
            <span>File</span>
            {isDirty && (
              <span 
                style={{
                  width: "4px",
                  height: "4px",
                  backgroundColor: DARK.stateAmber,
                  marginLeft: `${SPACE.xs}px`,
                }} 
                title="Unsaved changes" 
              />
            )}
            <ChevronDown size={8} style={{ color: DARK.textMid, marginLeft: `${SPACE.xs}px` }} />
          </button>

          {isFileMenuOpen && (
            <div 
              style={{
                position: "absolute",
                left: 0,
                top: "100%",
                marginTop: "4px",
                width: "160px",
                backgroundColor: DARK.bg3,
                ...flat(DARK),
                zIndex: 200,
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                boxSizing: "border-box",
                padding: "2px",
              }}
            >
              <button
                onMouseEnter={() => setHoveredFileItem("new")}
                onMouseLeave={() => setHoveredFileItem(null)}
                onClick={() => {
                  setIsFileMenuOpen(false);
                  if (isDirty) {
                    const confirmed = window.confirm(
                      "You have unsaved changes. Start a new project anyway?"
                    );
                    if (!confirmed) return;
                  }
                  newProject();
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: `${SPACE.md}px`,
                  fontFamily: DARK.font,
                  fontSize: "8px",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: hoveredFileItem === "new" ? DARK.bg4 : DARK.bg3,
                  color: hoveredFileItem === "new" ? DARK.textHi : DARK.textMid,
                  boxSizing: "border-box",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.sm}px` }}>
                  <FilePlus size={10} style={{ color: hoveredFileItem === "new" ? DARK.textHi : DARK.textMid }} />
                  <span>New Project</span>
                </div>
              </button>
              <div style={{ height: "1px", backgroundColor: DARK.bevelDark, margin: "2px 0" }} />

              <button
                onMouseEnter={() => setHoveredFileItem("save")}
                onMouseLeave={() => setHoveredFileItem(null)}
                onClick={() => {
                  setIsFileMenuOpen(false);
                  saveProject();
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: `${SPACE.md}px`,
                  fontFamily: DARK.font,
                  fontSize: "8px",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: hoveredFileItem === "save" ? DARK.bg4 : DARK.bg3,
                  color: hoveredFileItem === "save" ? DARK.textHi : DARK.textMid,
                  boxSizing: "border-box",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.sm}px` }}>
                  <Save size={10} style={{ color: hoveredFileItem === "save" ? DARK.textHi : DARK.textMid }} />
                  <span>Save Project</span>
                </div>
                <span style={{ fontSize: "7px", color: DARK.textDim }}>Ctrl+S</span>
              </button>

              <button
                onMouseEnter={() => setHoveredFileItem("load")}
                onMouseLeave={() => setHoveredFileItem(null)}
                onClick={() => {
                  setIsFileMenuOpen(false);
                  loadProject();
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: `${SPACE.md}px`,
                  fontFamily: DARK.font,
                  fontSize: "8px",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: hoveredFileItem === "load" ? DARK.bg4 : DARK.bg3,
                  color: hoveredFileItem === "load" ? DARK.textHi : DARK.textMid,
                  boxSizing: "border-box",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.sm}px` }}>
                  <Upload size={10} style={{ color: hoveredFileItem === "load" ? DARK.textHi : DARK.textMid }} />
                  <span>Load Project</span>
                </div>
                <span style={{ fontSize: "7px", color: DARK.textDim }}>Ctrl+O</span>
              </button>

              {autosaveProject && (
                <>
                  <div style={{ height: "1px", backgroundColor: DARK.bevelDark, margin: "2px 0" }} />
                  <button
                    onMouseEnter={() => setHoveredFileItem("recover")}
                    onMouseLeave={() => setHoveredFileItem(null)}
                    onClick={() => {
                      setIsFileMenuOpen(false);
                      restoreAutosave();
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      flexDirection: "column",
                      padding: `${SPACE.md}px`,
                      fontFamily: DARK.font,
                      fontSize: "8px",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      backgroundColor: hoveredFileItem === "recover" ? DARK.bg4 : DARK.bg3,
                      color: hoveredFileItem === "recover" ? DARK.textHi : DARK.textMid,
                      boxSizing: "border-box",
                    }}
                  >
                    <span style={{ color: DARK.stateGreen }}>Recover Autosave</span>
                    <div style={{ marginTop: `${SPACE.xs}px`, display: "flex", flexDirection: "column", gap: "1px", fontSize: "7px", color: DARK.textDim }}>
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        Project: {autosaveProject.projectName || "Untitled"}
                      </span>
                      <span>
                        Saved: {new Date(autosaveProject.savedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CENTER COMPACT TRANSPORT CONSOLE */}
      <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.md}px` }}>
        {/* Playback Buttons */}
        <div 
          style={{
            display: "flex",
            gap: "1px",
            backgroundColor: DARK.bg2,
            ...raised(DARK),
            padding: "1px",
            boxSizing: "border-box",
          }}
        >
          {/* Play/Pause Toggle */}
          <button
            onClick={playbackState === "playing" ? pause : play}
            style={{
              width: "24px",
              height: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: playbackState === "playing" ? DARK.bg5 : DARK.bg3,
              cursor: "pointer",
              border: "none",
              boxSizing: "border-box",
              ...(playbackState === "playing" ? sunken(DARK) : raised(DARK)),
            }}
            title={playbackState === "playing" ? "Pause Playback" : "Start Playback"}
          >
            {playbackState === "playing" ? (
               <Pause size={10} style={{ color: DARK.stateGreen, fill: "currentColor" }} />
            ) : (
               <Play size={10} style={{ color: DARK.textMid, fill: "currentColor" }} />
            )}
          </button>

          {/* Stop */}
          <button
            onClick={stop}
            style={{
              width: "24px",
              height: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: playbackState === "stopped" ? DARK.bg5 : DARK.bg3,
              cursor: "pointer",
              border: "none",
              boxSizing: "border-box",
              ...(playbackState === "stopped" ? sunken(DARK) : raised(DARK)),
            }}
            title="Stop & Return to Zero"
          >
            <Square size={8} style={{ color: DARK.textMid, fill: "currentColor" }} />
          </button>
        </div>

        {/* Dense Hardware-Style Playback Mode Toggle */}
        <div 
          style={{
            display: "flex",
            gap: "1px",
            backgroundColor: DARK.bg2,
            ...raised(DARK),
            padding: "1px",
            boxSizing: "border-box",
          }}
        >
          <button
            type="button"
            onClick={() => setPlaybackMode("pattern")}
            style={{
              padding: `0 ${SPACE.md}px`,
              height: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: DARK.font,
              fontSize: "8px",
              fontWeight: "bold",
              textTransform: "uppercase",
              cursor: "pointer",
              border: "none",
              backgroundColor: playbackMode === "pattern" ? DARK.bg5 : DARK.bg3,
              color: playbackMode === "pattern" ? DARK.accentMaster : DARK.textDim,
              ...(playbackMode === "pattern" ? sunken(DARK) : raised(DARK)),
              boxSizing: "border-box",
            }}
            title="Pattern Mode (Sequencer sequence looper)"
          >
            PAT
          </button>
          <button
            type="button"
            onClick={() => setPlaybackMode("song")}
            style={{
              padding: `0 ${SPACE.md}px`,
              height: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: DARK.font,
              fontSize: "8px",
              fontWeight: "bold",
              textTransform: "uppercase",
              cursor: "pointer",
              border: "none",
              backgroundColor: playbackMode === "song" ? DARK.bg5 : DARK.bg3,
              color: playbackMode === "song" ? DARK.accentMaster : DARK.textDim,
              ...(playbackMode === "song" ? sunken(DARK) : raised(DARK)),
              boxSizing: "border-box",
            }}
            title="Song Mode (Arrangement Timeline player)"
          >
            SONG
          </button>
        </div>

        {/* Real-time Combined Hardware LCD Display */}
        <button
          onClick={() => setDisplayMode(displayMode === "time" ? "beats" : "time")}
          style={{
            background: DARK.lcdBg,
            ...sunken(DARK),
            fontFamily: DARK.font,
            fontSize: "11px",
            color: DARK.lcdText,
            padding: `${SPACE.xs}px ${SPACE.md}px`,
            letterSpacing: "0.1em",
            minWidth: "80px",
            textAlign: "center",
            cursor: "pointer",
            border: "none",
            boxSizing: "border-box",
            height: "26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Click to toggle display readout (Time / Beats)"
        >
          {displayMode === "time" ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: "2px", color: DARK.lcdText }}>
              <span>{zeroPad(displayMin, 2)}:{zeroPad(displaySec, 2)}.{zeroPad(displayMs, 3)}</span>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "baseline", gap: "2px", color: DARK.lcdText }}>
              <span>{zeroPad(bars, 2)}:{targetBeats}:{sixteenths}:{zeroPad(ticks, 3)}</span>
            </div>
          )}
        </button>

        {/* Real-time Spectrogram/Waveform Visualizer */}
        <div 
          onClick={() => setVisMode(prev => prev === "spectrum" ? "waveform" : "spectrum")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: DARK.bg0,
            ...sunken(DARK),
            height: "26px",
            width: "144px",
            position: "relative",
            overflow: "hidden",
            cursor: "pointer",
            boxSizing: "border-box",
          }}
          title={`Click to toggle visualization mode (Current: ${visMode === "spectrum" ? "Spectrum" : "Waveform"})`}
        >
          <canvas ref={canvasRef} width="144" height="24" style={{ width: "100%", height: "100%", pointerEvents: "none" }} />
        </div>

        {/* BPM Input Setting */}
        <form onSubmit={handleBpmSubmit} style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <input
            type="number"
            min="20"
            max="300"
            step="0.1"
            value={bpmInput}
            onChange={(e) => setBpmInput(e.target.value)}
            onBlur={handleBpmBlur}
            style={{
              background: DARK.lcdBg,
              ...sunken(DARK),
              fontFamily: DARK.font,
              fontSize: "11px",
              color: DARK.lcdText,
              width: "64px",
              height: "26px",
              textAlign: "center",
              outline: "none",
              border: "none",
              boxSizing: "border-box",
              paddingRight: "16px",
            }}
          />
          <span style={{ position: "absolute", right: "4px", fontSize: "7px", fontFamily: DARK.font, color: DARK.textDim, pointerEvents: "none", userSelect: "none", textTransform: "uppercase" }}>
            BPM
          </span>
        </form>

        {/* Tap Tempo Button */}
        <button
          type="button"
          onClick={handleTap}
          style={{
            height: "26px",
            padding: `0 ${SPACE.md}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: DARK.font,
            fontSize: "8px",
            fontWeight: "bold",
            textTransform: "uppercase",
            cursor: "pointer",
            border: "none",
            backgroundColor: (isTapped || isLocked) ? DARK.bg5 : DARK.bg3,
            color: isLocked ? DARK.stateGreen : isTapped ? DARK.accentMaster : DARK.textMid,
            ...((isTapped || isLocked) ? sunken(DARK) : raised(DARK)),
            boxSizing: "border-box",
          }}
          title="Tap Tempo (Stable tempo locks in automatically)"
        >
          Tap
        </button>

        {/* Metronome sounds trigger */}
        <button
          onClick={() => toggleMetronome()}
          style={{
            height: "26px",
            padding: `0 ${SPACE.md}px`,
            display: "flex",
            alignItems: "center",
            gap: `${SPACE.xs}px`,
            fontFamily: DARK.font,
            fontSize: "8px",
            fontWeight: "bold",
            textTransform: "uppercase",
            cursor: "pointer",
            border: "none",
            backgroundColor: metronomeEnabled ? DARK.bg5 : DARK.bg3,
            color: metronomeEnabled ? DARK.accentMaster : DARK.textMid,
            ...(metronomeEnabled ? sunken(DARK) : raised(DARK)),
            boxSizing: "border-box",
          }}
          title="Toggle Metronome Sound Click"
        >
          {metronomeEnabled ? (
            <Volume2 size={12} />
          ) : (
            <VolumeX size={12} />
          )}
          <span>Click</span>
        </button>

        {/* PC Keyboard MIDI Toggle with Dropdown */}
        <div 
          id="pc-midi-button-group" 
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            backgroundColor: DARK.bg3,
            ...raised(DARK),
            height: "26px",
            boxSizing: "border-box",
            padding: "1px",
          }}
        >
          <button
            id="pc-keyboard-midi-toggle"
            type="button"
            onClick={() => setPcKeyboardMidiActive(!pcKeyboardMidiActive)}
            onContextMenu={(e) => {
              e.preventDefault();
               setShowOctaveMenu(!showOctaveMenu);
            }}
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              gap: `${SPACE.sm}px`,
              padding: `0 ${SPACE.md}px`,
              cursor: "pointer",
              border: "none",
              backgroundColor: pcKeyboardMidiActive ? DARK.bg5 : DARK.bg3,
              color: pcKeyboardMidiActive ? DARK.accentMaster : DARK.textMid,
              fontFamily: DARK.font,
              fontSize: "8px",
              fontWeight: "bold",
              textTransform: "uppercase",
              ...(pcKeyboardMidiActive ? sunken(DARK) : {}),
              boxSizing: "border-box",
            }}
            title="Toggle PC Keyboard MIDI Input (Right-click or click arrow to set Base Octave)"
          >
            {/* LED style indicator */}
            <span 
              id="pc-midi-led" 
              style={{
                width: "5px",
                height: "5px",
                backgroundColor: pcKeyboardMidiActive ? DARK.accentMaster : DARK.bg0,
              }} 
            />
            <span>KBD MIDI</span>
            <span style={{ fontSize: "7px", padding: `0 ${SPACE.xs}px`, backgroundColor: "rgba(0,0,0,0.4)", color: DARK.textDim, fontWeight: "bold" }}>
              OCT {baseOctave}
            </span>
          </button>

          <button
            id="pc-keyboard-midi-dropdown-arrow"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowOctaveMenu(!showOctaveMenu);
            }}
            style={{
              height: "100%",
              padding: `0 ${SPACE.xs}px`,
              cursor: "pointer",
              border: "none",
              borderLeft: `1px solid ${DARK.bevelDark}`,
              backgroundColor: showOctaveMenu ? DARK.bg5 : DARK.bg3,
              color: DARK.textMid,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxSizing: "border-box",
            }}
            title="Choose Base Octave"
          >
            <ChevronDown size={10} />
          </button>

          {/* Retro Hardware Dropdown Context Menu for Base Octaves */}
          {showOctaveMenu && (
            <>
              {/* Backing dismiss overlay */}
              <div id="octave-menu-backdrop" style={{ position: "fixed", inset: 0, zIndex: 45, backgroundColor: "transparent" }} onClick={() => setShowOctaveMenu(false)} />
              <div
                id="octave-dropdown-menu"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  marginTop: "4px",
                  backgroundColor: DARK.bg3,
                  ...flat(DARK),
                  zIndex: 200,
                  minWidth: "120px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                  boxSizing: "border-box",
                  padding: "2px",
                }}
              >
                <div 
                  style={{
                    padding: `${SPACE.xs}px ${SPACE.sm}px`,
                    fontSize: "7px",
                    color: DARK.textDim,
                    borderBottom: `1px solid ${DARK.bevelDark}`,
                    marginBottom: "2px",
                    fontWeight: "bold",
                    letterSpacing: "0.1em",
                    textAlign: "center",
                    fontFamily: DARK.font,
                  }}
                >
                  BASE OCTAVE SELECTOR
                </div>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((oct) => (
                  <button
                    key={oct}
                    id={`octave-select-${oct}`}
                    onMouseEnter={() => setHoveredOctaveItem(oct)}
                    onMouseLeave={() => setHoveredOctaveItem(null)}
                    onClick={() => {
                      setBaseOctave(oct);
                      setShowOctaveMenu(false);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: `${SPACE.sm}px`,
                      fontFamily: DARK.font,
                      fontSize: "8px",
                      fontWeight: baseOctave === oct ? "bold" : "normal",
                      textTransform: "uppercase",
                      border: "none",
                      backgroundColor: baseOctave === oct ? DARK.bg4 : hoveredOctaveItem === oct ? DARK.bg4 : DARK.bg3,
                      color: baseOctave === oct ? DARK.accentMaster : hoveredOctaveItem === oct ? DARK.textHi : DARK.textMid,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      boxSizing: "border-box",
                    }}
                  >
                    <span>Octave {oct}</span>
                    {oct === 4 && <span style={{ fontSize: "7px", color: DARK.textDim, fontWeight: "normal" }}>(Default)</span>}
                    {baseOctave === oct && (
                      <span style={{ width: "5px", height: "5px", backgroundColor: DARK.accentMaster }} />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* RIGHT SIDE COMPONENT WINDOWS DOCK */}
      <div 
        style={{
          display: "flex",
          gap: "1px",
          backgroundColor: DARK.bg2,
          ...raised(DARK),
          padding: "1px",
          boxSizing: "border-box",
          height: "30px",
        }}
      >
        {dockButtons.map((btn) => {
          const IconComponent = btn.icon;
          const isHovered = hoveredDockBtn === btn.id;
          return (
            <button
              key={btn.id}
              onMouseEnter={() => setHoveredDockBtn(btn.id)}
              onMouseLeave={() => setHoveredDockBtn(null)}
              onClick={btn.onClick}
              style={{
                width: "28px",
                height: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                border: "none",
                backgroundColor: btn.active ? DARK.bg0 : isHovered ? DARK.bg3 : DARK.bg2,
                color: btn.active ? DARK.textHi : isHovered ? DARK.textMid : DARK.textLo,
                ...(btn.active ? sunken(DARK) : {}),
                boxSizing: "border-box",
              }}
              title={btn.title}
            >
              <IconComponent size={14} style={{ color: "inherit" }} />
            </button>
          );
        })}
      </div>
    </header>
  );
}
