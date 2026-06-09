import React, { useRef, useState, useEffect, useCallback } from "react";
import { useAudioEngine } from "../audio/useAudioEngine";
import { ChannelRow } from "../types";
import { MixerInsert } from "../audio/MixerManager";
import { 
  DARK, 
  raised, 
  sunken, 
  flat, 
  flush, 
  SPACE, 
  SIZE 
} from "../../public/Themes/Vintage Console/tokens";
import { Activity, Shield } from "lucide-react";

interface MixerProps {
  channels?: ChannelRow[];
  channelMixers?: Record<string, number>;
  setChannelMixers?: (mixers: Record<string, number>) => void;
  onOpenEQPanel?: (insertIndex: number, slotIndex: number) => void;
  onOpenReverbPanel?: (insertIndex: number, slotIndex: number) => void;
  stripColors?: Record<number, string>;
  setStripColors?: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  isVisible?: boolean;
  onPositionChangeRef?: React.MutableRefObject<((pos: { x: number; y: number }) => void) | null>;
}

// The LevelMeter component uses requestAnimationFrame and direct DOM updates for high performance
function LevelMeter({ insertIndex, isMuted }: { insertIndex: number; isMuted: boolean }) {
  const { engine } = useAudioEngine();
  const rawMeterRef = useRef<HTMLDivElement>(null);
  const peakLineRef = useRef<HTMLDivElement>(null);
  const clipLedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationFrameId: number;
    let peakHoldValue = 0;
    let lastClipTime = 0;

    const updateMeter = () => {
      if (!engine) return;

      const levels = engine.getInsertLevels(insertIndex);
      const rms = isMuted ? 0 : levels.rms;
      const peak = isMuted ? 0 : levels.peak;

      // Map RMS to percentage
      const rmsHeight = Math.min(100, Math.pow(rms, 0.6) * 100);
      
      // Decay peak hold line
      if (peak > peakHoldValue) {
        peakHoldValue = peak;
      } else {
        peakHoldValue = Math.max(0, peakHoldValue - 0.015); // slow decay
      }
      const peakHeight = Math.min(100, Math.pow(peakHoldValue, 0.6) * 100);

      // Render RMS stacked segments
      const activeSegments = Math.round((rmsHeight / 100) * 12);
      if (rawMeterRef.current) {
        const segments = rawMeterRef.current.children;
        for (let i = 0; i < 12; i++) {
          const segment = segments[11 - i] as HTMLDivElement; // index 11 is top, index 0 is bottom
          if (segment) {
            const isLit = i < activeSegments;
            segment.style.backgroundColor = isLit ? DARK.vu[i] : DARK.vuOff;
            segment.style.borderTop = isLit ? `1px solid rgba(255,255,255,0.12)` : `1px solid ${DARK.bevelDark}`;
          }
        }
      }

      // Render Peak Hold thin line
      if (peakLineRef.current) {
        peakLineRef.current.style.bottom = `${peakHeight}%`;
        peakLineRef.current.style.display = peakHeight > 1 ? "block" : "none";
      }

      // Clipping LED check (0dBFS threshold is 1.0 amplitude)
      const now = Date.now();
      if (peak >= 0.99) {
        lastClipTime = now;
      }

      // Light up clipping LED if clipping occurred in the last 1000ms
      if (clipLedRef.current) {
        const isClipping = (now - lastClipTime) < 1000;
        if (isClipping) {
          clipLedRef.current.style.backgroundColor = DARK.stateHot;
        } else {
          clipLedRef.current.style.backgroundColor = DARK.bg0;
        }
      }

      animationFrameId = requestAnimationFrame(updateMeter);
    };

    updateMeter();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [engine, insertIndex, isMuted]);

  return (
    <div 
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        width: "14px",
        backgroundColor: DARK.bg0,
        ...sunken(DARK),
        height: "176px",
        paddingTop: "6px",
        paddingBottom: "6px",
        position: "relative",
        userSelect: "none",
        boxSizing: "border-box",
      }}
    >
      {/* 1S Hold clipping LED */}
      <div 
        ref={clipLedRef} 
        style={{
          width: "6px",
          height: "4px",
          backgroundColor: DARK.bg0,
          marginBottom: "6px",
        }}
        title="0dBFS CLIP INDICATOR (HOLDS FOR 1S)"
      />

      {/* Meter Cage */}
      <div 
        style={{
          flex: 1,
          width: "6px",
          position: "relative",
          backgroundColor: DARK.bg0,
          overflow: "hidden",
        }}
      >
        {/* Stacked segments container */}
        <div 
          ref={rawMeterRef}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1px",
            height: "100%",
            width: "6px",
          }}
        >
          {Array.from({ length: 12 }).map((_, i) => {
            const idx = 11 - i;
            return (
              <div 
                key={idx}
                style={{
                  flex: 1,
                  backgroundColor: DARK.vuOff,
                  borderTop: `1px solid ${DARK.bevelDark}`,
                }}
              />
            );
          })}
        </div>

        {/* Peak Hold Line */}
        <div 
          ref={peakLineRef}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: "2px",
            backgroundColor: DARK.accentBlue,
            pointerEvents: "none",
            zIndex: 10,
            display: "none",
          }}
        />
      </div>
    </div>
  );
}

// Local custom PanKnob component following the spec perfectly
interface PanKnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  defaultValue?: number;
  title?: string;
  dotColor?: string;
}

function PanKnob({ value, min, max, onChange, defaultValue = 0, title, dotColor = DARK.accentBlue }: PanKnobProps) {
  const knobRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startValue = value;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const deltaValue = Math.round(deltaY * ((max - min) / 100));
      const nextValue = Math.min(max, Math.max(min, startValue + deltaValue));
      onChange(nextValue);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onChange(defaultValue);
  };

  const angleDeg = (value / 50) * 135;
  const angleRad = (angleDeg * Math.PI) / 180;
  
  const cx = 11;
  const cy = 11;
  const R = 6.5;
  const dotX = cx + R * Math.sin(angleRad);
  const dotY = cy - R * Math.cos(angleRad);

  return (
    <div 
      ref={knobRef}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      title={title}
      style={{
        width: "22px",
        height: "22px",
        borderRadius: "50%",
        backgroundColor: DARK.knobBody,
        position: "relative",
        cursor: "ns-resize",
        userSelect: "none",
        boxSizing: "border-box",
        ...raised(DARK),
      }}
    >
      {/* Highlight Ellipse */}
      <div 
        style={{
          position: "absolute",
          top: "2px",
          left: "2px",
          width: "8px",
          height: "4px",
          borderRadius: "50%",
          backgroundColor: DARK.knobHighlight,
          transform: "rotate(-30deg)",
          pointerEvents: "none",
        }}
      />

      {/* Indicator Dot */}
      <svg 
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <circle cx={dotX} cy={dotY} r={1.5} fill={dotColor} />
      </svg>
    </div>
  );
}

interface InputGainKnobProps {
  value: number; // 0.0 to 2.0
  onChange: (value: number) => void;
  title?: string;
  dotColor?: string;
  hasRing?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

function InputGainKnob({ value, onChange, title, dotColor = DARK.accentBlue, hasRing, onContextMenu, onDragStart, onDragEnd }: InputGainKnobProps) {
  const knobRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    e.preventDefault();
    const startY = e.clientY;
    const startValue = value;

    onDragStart?.();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const deltaValue = deltaY * (2.0 / 100);
      const nextValue = Math.min(2.0, Math.max(0.0, startValue + deltaValue));
      onChange(Math.round(nextValue * 100) / 100);
    };

    const handleMouseUp = () => {
      onDragEnd?.();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onChange(1.0);
  };

  const angleDeg = (value - 1.0) * 135;
  const angleRad = (angleDeg * Math.PI) / 180;
  
  const cx = 11;
  const cy = 11;
  const R = 6.5;
  const dotX = cx + R * Math.sin(angleRad);
  const dotY = cy - R * Math.cos(angleRad);

  return (
    <div 
      ref={knobRef}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onContextMenu={onContextMenu}
      title={title}
      style={{
        width: "22px",
        height: "22px",
        borderRadius: "50%",
        backgroundColor: DARK.knobBody,
        position: "relative",
        cursor: "ns-resize",
        userSelect: "none",
        boxSizing: "border-box",
        ...raised(DARK),
      }}
    >
      {/* Highlight Ellipse */}
      <div 
        style={{
          position: "absolute",
          top: "2px",
          left: "2px",
          width: "8px",
          height: "4px",
          borderRadius: "50%",
          backgroundColor: DARK.knobHighlight,
          transform: "rotate(-30deg)",
          pointerEvents: "none",
        }}
      />

      {/* Indicator Dot */}
      <svg 
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <circle cx={dotX} cy={dotY} r={1.5} fill={dotColor} />
      </svg>

      {/* Send Relationship Ring */}
      {hasRing && (
        <svg
          style={{
            position: "absolute",
            top: "-3px",
            left: "-3px",
            width: "28px",
            height: "28px",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <circle
            cx={14}
            cy={14}
            r={12}
            stroke="#108a38"
            strokeWidth={2}
            fill="none"
          />
        </svg>
      )}
    </div>
  );
}

// Local custom VerticalFader component following the spec perfectly
interface VerticalFaderProps {
  value: number;
  onChange: (value: number) => void;
  title?: string;
}

function VerticalFader({ value, onChange, title }: VerticalFaderProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.altKey && e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      onChange(100);
      return;
    }

    e.preventDefault();
    updateFromEvent(e.clientY);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateFromEvent(moveEvent.clientY);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const updateFromEvent = (clientY: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    const percentage = 125 - Math.min(125, Math.max(0, (relativeY / rect.height) * 125));
    onChange(Math.round(percentage));
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(100);
  };

  const trackHeight = 160;
  const thumbHeight = SIZE.faderThumbH;
  const topPx = ((125 - value) / 125) * (trackHeight - thumbHeight);

  return (
    <div 
      ref={trackRef}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      title={title}
      style={{
        width: "12px",
        height: `${trackHeight}px`,
        backgroundColor: DARK.bg0,
        position: "relative",
        cursor: "ns-resize",
        userSelect: "none",
        boxSizing: "border-box",
        ...sunken(DARK),
      }}
    >
      {/* Center Rail */}
      <div 
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          width: "2px",
          height: "100%",
          backgroundColor: DARK.bg5,
          pointerEvents: "none",
        }}
      />

      {/* Unity Notch */}
      <div 
        style={{
          position: "absolute",
          top: "44%",
          left: 0,
          right: 0,
          height: "1px",
          backgroundColor: DARK.accentBlue,
          opacity: 0.2,
          pointerEvents: "none",
        }}
      />

      {/* Fader Thumb */}
      <div 
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          top: `${topPx}px`,
          width: `${SIZE.faderThumbW}px`,
          height: `${thumbHeight}px`,
          backgroundColor: DARK.bg5,
          pointerEvents: "none",
          boxSizing: "border-box",
          ...raised(DARK),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Grip Lines */}
        <div 
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            height: "6px",
            width: "10px",
          }}
        >
          {[1, 2, 3].map((i) => (
            <div 
              key={i} 
              style={{ 
                height: "1px", 
                background: i === 2 ? `${DARK.accentBlue}66` : DARK.bevelLight,
                boxSizing: "border-box",
              }} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function Mixer({
  channels = [],
  channelMixers = {},
  setChannelMixers = () => {},
  onOpenEQPanel,
  onOpenReverbPanel,
  stripColors = {},
  setStripColors = () => {},
  isVisible = false,
  onPositionChangeRef,
}: MixerProps) {
  const { engine, setInsertFXSlot, setInsertFXBypass, focusedChannelId } = useAudioEngine();
  const [selectedInsertIndex, setSelectedInsertIndex] = useState(0);
  const isDraggingKnobRef = useRef(false);
  
  const [insertsState, setInsertsState] = useState<MixerInsert[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const windowPosRef = useRef({ x: 50, y: 250 });
  const prevWindowPosRef = useRef({ x: 50, y: 250 });
  const anchorRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (onPositionChangeRef) {
      onPositionChangeRef.current = (pos) => {
        windowPosRef.current = pos;
      };
    }
    return () => {
      if (onPositionChangeRef) {
        onPositionChangeRef.current = null;
      }
    };
  }, [onPositionChangeRef]);

  const [draggedSlotIdx, setDraggedSlotIdx] = useState<number | null>(null);
  const [draggingOverSlotIdx, setDraggingOverSlotIdx] = useState<number | null>(null);

  const [activePickerSlotIdx, setActivePickerSlotIdx] = useState<number | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const [slotContextMenu, setSlotContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    slotIdx: number;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const [colorMenu, setColorMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    insertIndex: number;
  } | null>(null);
  const colorMenuRef = useRef<HTMLDivElement>(null);

  const [inKnobContextMenu, setInKnobContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    targetInsertIndex: number;
  } | null>(null);
  const inKnobContextMenuRef = useRef<HTMLDivElement>(null);

  // Close IN knob context menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (inKnobContextMenuRef.current && !inKnobContextMenuRef.current.contains(e.target as Node)) {
        setInKnobContextMenu(null);
      }
    };
    if (inKnobContextMenu !== null) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [inKnobContextMenu]);

  const ACCENT_OPTIONS = [
    { label: "BLUE",   value: DARK.accentBlue },
    { label: "GREEN",  value: DARK.accentGreen },
    { label: "PURPLE", value: DARK.accentPurple },
    { label: "ORANGE", value: DARK.accentOrange },
    { label: "MASTER", value: DARK.accentMaster },
  ];

  // Close color menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (colorMenuRef.current && !colorMenuRef.current.contains(e.target as Node)) {
        setColorMenu(null);
      }
    };
    if (colorMenu !== null) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [colorMenu]);

  // Close picker when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setActivePickerSlotIdx(null);
      }
    };
    if (activePickerSlotIdx !== null) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [activePickerSlotIdx]);

  // Close slot context menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setSlotContextMenu(null);
      }
    };
    if (slotContextMenu !== null) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [slotContextMenu]);

  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const startRename = (index: number, currentName: string) => {
    setRenamingIndex(index);
    setRenameValue(currentName);
  };

  const submitRename = (index: number) => {
    if (renameValue.trim()) {
      if (engine && (engine as any).renameInsert) {
        (engine as any).renameInsert(index, renameValue.trim());
      }
      setInsertsState((prev) =>
        prev.map((ins) => (ins.index === index ? { ...ins, name: renameValue.trim() } : ins))
      );
    }
    setRenamingIndex(null);
  };

  // Wheel horizontal scrolling effect
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const pullInserts = useCallback(() => {
    if (!engine) return;
    const inserts = engine.getInserts();
    setInsertsState(
      inserts.map((ins) => {
        const fxSlots = Array(8).fill("");
        for (let i = 0; i < 8; i++) {
          if (ins.fxSlots && ins.fxSlots[i] !== undefined && ins.fxSlots[i] !== null) {
            fxSlots[i] = ins.fxSlots[i];
          }
        }
        const fxBypass = Array(8).fill(false);
        for (let i = 0; i < 8; i++) {
          if (ins.fxBypass && ins.fxBypass[i] !== undefined && ins.fxBypass[i] !== null) {
            fxBypass[i] = ins.fxBypass[i];
          }
        }
        return {
          ...ins,
          fxSlots,
          fxBypass
        };
      })
    );
  }, [engine]);

  // Periodic visual refresh of inserts (in case they expand dynamically due to rack additions)
  useEffect(() => {
    pullInserts();
    const interval = setInterval(pullInserts, 1500);
    return () => clearInterval(interval);
  }, [pullInserts]);

  const handleInKnobContextMenu = (e: React.MouseEvent, targetIndex: number) => {
    if (selectedInsertIndex === null || selectedInsertIndex === undefined || selectedInsertIndex === 0) return;
    if (targetIndex === selectedInsertIndex) return; // Only non-selected inserts

    e.preventDefault();
    e.stopPropagation();

    const parent = document.getElementById("mixer-parent-container");
    const parentRect = parent ? parent.getBoundingClientRect() : { left: 0, top: 0 };
    setInKnobContextMenu({
      visible: true,
      x: e.clientX - parentRect.left,
      y: e.clientY - parentRect.top,
      targetInsertIndex: targetIndex,
    });
  };

  const handleRemoveSend = () => {
    if (!engine || !inKnobContextMenu) return;
    const fromIndex = selectedInsertIndex;
    const toIndex = inKnobContextMenu.targetInsertIndex;
    if (engine.removeSend) {
      engine.removeSend(fromIndex, toIndex);
    } else if (engine.mixerManager && engine.mixerManager.removeSend) {
      engine.mixerManager.removeSend(fromIndex, toIndex);
    }
    pullInserts();
    setInKnobContextMenu(null);
  };

  const handleDisconnectFromMaster = () => {
    if (!engine || !inKnobContextMenu) return;
    const fromIndex = selectedInsertIndex;
    if (engine.setRoutesToMaster) {
      engine.setRoutesToMaster(fromIndex, false);
    } else if (engine.mixerManager && engine.mixerManager.setRoutesToMaster) {
      engine.mixerManager.setRoutesToMaster(fromIndex, false);
    }
    pullInserts();
    setInKnobContextMenu(null);
  };

  const handleReconnectToMaster = () => {
    if (!engine || !inKnobContextMenu) return;
    const fromIndex = selectedInsertIndex;
    if (engine.setRoutesToMaster) {
      engine.setRoutesToMaster(fromIndex, true);
    } else if (engine.mixerManager && engine.mixerManager.setRoutesToMaster) {
      engine.mixerManager.setRoutesToMaster(fromIndex, true);
    }
    pullInserts();
    setInKnobContextMenu(null);
  };

  // Apply volume updates
  const handleVolumeChange = (index: number, nextVol: number) => {
    if (!engine) return;
    engine.updateInsertVolume(index, nextVol);
    setInsertsState((prev) =>
      prev.map((ins) => (ins.index === index ? { ...ins, volume: nextVol } : ins))
    );
  };

  // Apply panning updates
  const handlePanChange = (index: number, nextPan: number) => {
    if (!engine) return;
    engine.updateInsertPan(index, nextPan);
    setInsertsState((prev) =>
      prev.map((ins) => (ins.index === index ? { ...ins, pan: nextPan } : ins))
    );
  };

  // Apply input gain updates
  const handleInputGainChange = (index: number, nextGain: number) => {
    if (!engine) return;
    if (engine.mixerManager && engine.mixerManager.updateInsertInputGain) {
      engine.mixerManager.updateInsertInputGain(index, nextGain);
    }
    setInsertsState((prev) =>
      prev.map((ins) => (ins.index === index ? { ...ins, inputGain: nextGain } : ins))
    );
  };

  const handleReorderFX = (fromSlot: number, toSlot: number) => {
    if (!engine || !selectedInsert) return;
    if (engine.mixerManager && engine.mixerManager.reorderInsertFX) {
      engine.mixerManager.reorderInsertFX(selectedInsert.index, fromSlot, toSlot);
    }
    setInsertsState((prev) =>
      prev.map((ins) => {
        if (ins.index !== selectedInsert.index) return ins;

        // Swap slots (ensure fully populated with strings, length 8)
        const newSlots = Array(8).fill("");
        for (let i = 0; i < 8; i++) {
          if (ins.fxSlots && ins.fxSlots[i] !== undefined && ins.fxSlots[i] !== null) {
            newSlots[i] = ins.fxSlots[i];
          }
        }
        const tempSlot = newSlots[fromSlot];
        newSlots[fromSlot] = newSlots[toSlot];
        newSlots[toSlot] = tempSlot;

        // Swap bypass (ensure fully populated with booleans, length 8)
        const newBypass = Array(8).fill(false);
        for (let i = 0; i < 8; i++) {
          if (ins.fxBypass && ins.fxBypass[i] !== undefined && ins.fxBypass[i] !== null) {
            newBypass[i] = ins.fxBypass[i];
          }
        }
        const tempBypass = newBypass[fromSlot];
        newBypass[fromSlot] = newBypass[toSlot];
        newBypass[toSlot] = tempBypass;

        // Swap eqSettings and reverbSettings
        const newEq = ins.eqSettings ? { ...ins.eqSettings } : {};
        const tempEq = newEq[fromSlot];
        if (newEq[toSlot] !== undefined) {
          newEq[fromSlot] = newEq[toSlot];
        } else {
          delete newEq[fromSlot];
        }
        if (tempEq !== undefined) {
          newEq[toSlot] = tempEq;
        } else {
          delete newEq[toSlot];
        }

        const newReverb = ins.reverbSettings ? { ...ins.reverbSettings } : {};
        const tempReverb = newReverb[fromSlot];
        if (newReverb[toSlot] !== undefined) {
          newReverb[fromSlot] = newReverb[toSlot];
        } else {
          delete newReverb[fromSlot];
        }
        if (tempReverb !== undefined) {
          newReverb[toSlot] = tempReverb;
        } else {
          delete newReverb[toSlot];
        }

        return {
          ...ins,
          fxSlots: newSlots,
          fxBypass: newBypass,
          eqSettings: newEq,
          reverbSettings: newReverb
        };
      })
    );
  };

  // Toggle Mute
  const handleToggleMute = (index: number, currentMuted: boolean) => {
    if (!engine) return;
    engine.updateInsertMute(index, !currentMuted);
    setInsertsState((prev) =>
      prev.map((ins) => (ins.index === index ? { ...ins, isMuted: !currentMuted } : ins))
    );
  };

  // Toggle Solo
  const handleToggleSolo = (index: number, currentSoloed: boolean) => {
    if (!engine) return;
    engine.updateInsertSolo(index, !currentSoloed);
    const inserts = engine.getInserts();
    setInsertsState(
      inserts.map((ins) => {
        const fxSlots = Array(8).fill("");
        for (let i = 0; i < 8; i++) {
          if (ins.fxSlots && ins.fxSlots[i] !== undefined && ins.fxSlots[i] !== null) {
            fxSlots[i] = ins.fxSlots[i];
          }
        }
        const fxBypass = Array(8).fill(false);
        for (let i = 0; i < 8; i++) {
          if (ins.fxBypass && ins.fxBypass[i] !== undefined && ins.fxBypass[i] !== null) {
            fxBypass[i] = ins.fxBypass[i];
          }
        }
        return {
          ...ins,
          fxSlots,
          fxBypass
        };
      })
    );
  };

  const selectedInsert = insertsState[selectedInsertIndex] || insertsState[0];
  const isMasterSelected = selectedInsertIndex === 0;
  const isMasterMuted = insertsState[0]?.isMuted;
  const anySoloed = insertsState.some(ins => ins.isSoloed);

  return (
    <div 
      id="mixer-parent-container" 
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: DARK.bg1,
        display: "flex",
        color: DARK.textMid,
        fontFamily: DARK.font,
        fontSize: "11px",
        userSelect: "none",
        position: "relative",
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        overflow: "hidden",
        boxSizing: "border-box",
        ...flat(DARK),
      }}
    >
      {/* 1. SCROLLABLE INSERTS BANK */}
      <div 
        style={{
          flex: 1,
          height: "100%",
          display: "flex",
          backgroundColor: DARK.bg1,
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        
        {/* A. MASTER BUS PINNED LEFT */}
        {insertsState.length > 0 && (
          <div 
            onClick={() => {
              if (isDraggingKnobRef.current) return;
              setSelectedInsertIndex(0);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const parent = document.getElementById("mixer-parent-container");
              const parentRect = parent ? parent.getBoundingClientRect() : { left: 0, top: 0 };
              setColorMenu({
                visible: true,
                x: e.clientX - parentRect.left,
                y: e.clientY - parentRect.top,
                insertIndex: 0,
              });
            }}
            style={{
              width: `${SIZE.channelStripMaster}px`,
              flexShrink: 0,
              height: "100%",
              backgroundColor: isMasterMuted ? DARK.bg1 : isMasterSelected ? DARK.bg4 : DARK.bg3,
              borderRight: `1px solid ${DARK.bg0}`,
              borderLeft: `1px solid ${DARK.bg2}`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              paddingTop: `${SPACE.sm}px`,
              paddingBottom: `${SPACE.sm}px`,
              boxSizing: "border-box",
              textAlign: "center",
              userSelect: "none",
            }}
          >
            {/* Top Pinned Label */}
            <div style={{ paddingLeft: `${SPACE.xs}px`, paddingRight: `${SPACE.xs}px` }}>
              <span 
                style={{
                  fontFamily: DARK.font,
                  fontSize: "8px",
                  fontWeight: "bold",
                  color: DARK.textHi,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  display: "block",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                MASTER
              </span>
              <div style={{ height: "3px", backgroundColor: isMasterMuted ? DARK.textDim : (stripColors[0] ?? DARK.accentMaster), marginTop: `${SPACE.xs}px`, marginBottom: `${SPACE.xs}px` }} />
              <div 
                style={{
                  fontFamily: DARK.font,
                  fontSize: "7.5px",
                  color: DARK.textMid,
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                OUT 0
              </div>
            </div>

            {/* Panning knob */}
            <div 
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                margin: `${SPACE.xs}px 0`,
              }}
            >
              <div 
                style={{
                  fontFamily: DARK.font,
                  fontSize: "7px",
                  color: DARK.textLo,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: `${SPACE.xs}px`,
                }}
              >
                PAN
              </div>
              <PanKnob
                value={insertsState[0]?.pan ?? 0}
                min={-50}
                max={50}
                onChange={(v) => handlePanChange(0, v)}
                title="MASTER PANNING BALANCE"
                defaultValue={0}
                dotColor={isMasterMuted ? DARK.textDim : DARK.accentMaster}
              />
            </div>

            {/* Fader section */}
            <div 
              style={{
                flex: 1,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: `${SPACE.sm}px`,
                maxHeight: "220px",
                paddingLeft: `${SPACE.xs}px`,
                paddingRight: `${SPACE.xs}px`,
              }}
            >
              {/* RMS Peak Hold LED meter */}
              <LevelMeter insertIndex={0} isMuted={insertsState[0]?.isMuted} />

              {/* Vertical volume fader */}
              <div 
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  height: "176px",
                }}
              >
                <VerticalFader
                  value={insertsState[0]?.volume ?? 100}
                  onChange={(v) => handleVolumeChange(0, v)}
                  title="MASTER VOLUME FADER (DBL-CLICK/ALT-CLICK TO RESET TO 100%)"
                />
              </div>
            </div>

            {/* Spacer to match Track strip dots layout */}
            <div
              style={{
                height: "4px",
                marginTop: `${SPACE.sm}px`,
                marginBottom: `${SPACE.sm}px`,
              }}
            />

            {/* Context-sensitive Routing UI / Knob slot */}
            <div
              style={{
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box",
              }}
            >
              {(() => {
                const hasSelection = selectedInsertIndex !== null && selectedInsertIndex !== undefined && selectedInsertIndex > 0;
                
                if (!hasSelection) {
                  // STATE 3 — NO INSERT SELECTED
                  // - Show UP ARROW (▲) — passive, not clickable
                  // - No ring, no context menu
                  return (
                    <div
                      title="No insert selected"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "22px",
                        height: "22px",
                        color: DARK.textMid,
                        fontSize: "10px",
                        fontFamily: DARK.font,
                        userSelect: "none",
                      }}
                    >
                      ▲
                    </div>
                  );
                }

                // Selected insert exists (index > 0)
                const isConnected = selectedInsert?.routesToMaster !== false;

                if (isConnected) {
                  // STATE 1 — SELECTED INSERT IS CONNECTED TO MASTER
                  // - Show the IN knob with green ring (#108a38)
                  // - Turning the knob controls master insert input gain
                  // - Right click shows "Disconnect [selected insert] from master"
                  //   → calls setRoutesToMaster(selectedIndex, false)
                  const inKnobValue = insertsState[0]?.inputGain ?? 1.0;
                  const handleInKnobChange = (v: number) => {
                    handleInputGainChange(0, v);
                  };
                  const inKnobTitle = `MASTER INPUT GAIN (${inKnobValue.toFixed(2)}x)`;

                  return (
                    <div 
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => e.stopPropagation()}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                      }}
                    >
                      <div 
                        style={{
                          fontFamily: DARK.font,
                          fontSize: "7px",
                          color: DARK.textLo,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          marginBottom: "2px",
                        }}
                      >
                        IN
                      </div>
                      <InputGainKnob
                        value={inKnobValue}
                        onChange={handleInKnobChange}
                        title={inKnobTitle}
                        dotColor={isMasterMuted ? DARK.textDim : (stripColors[0] ?? DARK.accentMaster)}
                        hasRing={true}
                        onContextMenu={(e) => handleInKnobContextMenu(e, 0)}
                        onDragStart={() => { isDraggingKnobRef.current = true; }}
                        onDragEnd={() => { setTimeout(() => { isDraggingKnobRef.current = false; }, 50); }}
                      />
                    </div>
                  );
                } else {
                  // STATE 2 — SELECTED INSERT IS DISCONNECTED FROM MASTER
                  // - Show UP ARROW (▲) instead of the IN knob
                  // - Clicking the arrow calls setRoutesToMaster(selectedIndex, true)
                  //   reconnecting the selected insert to master
                  const handleReconnectClick = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (engine && engine.setRoutesToMaster) {
                      engine.setRoutesToMaster(selectedInsertIndex, true);
                    } else if (engine.mixerManager && engine.mixerManager.setRoutesToMaster) {
                      engine.mixerManager.setRoutesToMaster(selectedInsertIndex, true);
                    }
                    pullInserts();
                  };

                  return (
                    <div
                      onClick={handleReconnectClick}
                      title={`Reconnect ${selectedInsert?.name || `Insert ${selectedInsertIndex}`} to master`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "22px",
                        height: "22px",
                        cursor: "pointer",
                        color: DARK.textMid,
                        fontSize: "10px",
                        fontFamily: DARK.font,
                        userSelect: "none",
                      }}
                    >
                      ▲
                    </div>
                  );
                }
              })()}
            </div>

            {/* Cable Anchor Point */}
            <div 
              ref={el => { anchorRefs.current[0] = el; }}
              style={{ height: 0, position: "relative" }}
            />

            {/* dB readout & M/S triggers */}
            <div 
              style={{
                paddingLeft: `${SPACE.sm}px`,
                paddingRight: `${SPACE.sm}px`,
                display: "flex",
                flexDirection: "column",
                gap: `${SPACE.sm}px`,
                marginTop: `${SPACE.sm}px`,
              }}
            >
              {/* dB readout */}
              <div
                style={{
                  ...sunken(DARK),
                  backgroundColor: DARK.lcdBg,
                  color: isMasterMuted ? DARK.textDim : DARK.accentBlue,
                  fontFamily: DARK.font,
                  fontSize: "9px",
                  textAlign: "right",
                  paddingRight: "4px",
                  paddingLeft: "4px",
                  height: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  boxSizing: "border-box",
                  letterSpacing: "0.04em",
                }}
              >
                {(insertsState[0]?.volume ?? 100)}%
              </div>

              {/* M/S triggers */}
              <div style={{ display: "flex", gap: `${SPACE.xs}px` }}>
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleMute(0, insertsState[0]?.isMuted); }}
                  style={{
                    flex: 1,
                    height: "18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: DARK.font,
                    fontSize: "8px",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    userSelect: "none",
                    boxSizing: "border-box",
                    ...(insertsState[0]?.isMuted 
                      ? { ...sunken(DARK), backgroundColor: DARK.stateRed, color: "#ffffff" }
                      : { ...raised(DARK), backgroundColor: DARK.bg3, color: DARK.textMid }
                    )
                  }}
                  title="MUTE MASTER OUTPUT"
                >
                  M
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleSolo(0, insertsState[0]?.isSoloed); }}
                  style={{
                    flex: 1,
                    height: "18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: DARK.font,
                    fontSize: "8px",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    userSelect: "none",
                    boxSizing: "border-box",
                    ...(insertsState[0]?.isSoloed 
                      ? { ...sunken(DARK), backgroundColor: DARK.stateGreen, color: "#ffffff" }
                      : { ...raised(DARK), backgroundColor: DARK.bg3, color: DARK.textMid }
                    )
                  }}
                  title="SOLO MASTER BUS"
                >
                  S
                </button>
              </div>
            </div>
          </div>
        )}

        {/* B. SCROLLING INSERTS BANK */}
        <div 
          ref={scrollContainerRef}
          style={{
            flex: 1,
            overflowX: "auto",
            height: "100%",
            display: "flex",
            flexDirection: "row",
            backgroundColor: DARK.bg1,
            userSelect: "none",
          }}
        >
          {insertsState.slice(1).map((ins) => {
            const isSelected = selectedInsertIndex === ins.index;
            const linkedChannels = channels.filter(c => (channelMixers?.[c.id] ?? c.mixerTarget) === ins.index);
            const inheritedName = linkedChannels.length > 0 ? linkedChannels[0].name : `Insert ${ins.index}`;
            const displayName = ins.name && ins.name !== `Insert ${ins.index}` ? ins.name : inheritedName;

            const isMuted = ins.isMuted;
            const isDimmed = anySoloed && !ins.isSoloed && !ins.isMuted;
            const knobAccent = (isMuted || isDimmed) ? DARK.textDim : (stripColors[ins.index] ?? DARK.accentMaster);

            const hasOutgoingSends = ins.sends && ins.sends.length > 0;
            const hasIncomingSends = insertsState.some(otherIns => otherIns.index !== ins.index && otherIns.sends?.some(s => s.targetInsertIndex === ins.index));



            return (
              <div 
                key={ins.index}
                onClick={() => {
                  if (isDraggingKnobRef.current) return;
                  setSelectedInsertIndex(ins.index);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const parent = document.getElementById("mixer-parent-container");
                  const parentRect = parent ? parent.getBoundingClientRect() : { left: 0, top: 0 };
                  setColorMenu({
                    visible: true,
                    x: e.clientX - parentRect.left,
                    y: e.clientY - parentRect.top,
                    insertIndex: ins.index,
                  });
                }}
                style={{
                  width: `${SIZE.channelStrip}px`,
                  flexShrink: 0,
                  height: "100%",
                  backgroundColor: (isMuted || isDimmed) ? DARK.bg1 : isSelected ? DARK.bg4 : DARK.bg3,
                  borderRight: `1px solid ${DARK.bg0}`,
                  borderLeft: `1px solid ${DARK.bg2}`,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  paddingTop: `${SPACE.sm}px`,
                  paddingBottom: `${SPACE.sm}px`,
                  boxSizing: "border-box",
                  textAlign: "center",
                  userSelect: "none",
                  cursor: "pointer",
                }}
              >
                {/* Channel Label */}
                <div 
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startRename(ins.index, displayName);
                  }}
                  style={{
                    paddingLeft: `${SPACE.xs}px`,
                    paddingRight: `${SPACE.xs}px`,
                    height: "36px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}
                >
                  {renamingIndex === ins.index ? (
                    <input
                      type="text"
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => submitRename(ins.index)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitRename(ins.index);
                        if (e.key === "Escape") setRenamingIndex(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        backgroundColor: DARK.lcdBg,
                        color: DARK.accentBlue,
                        fontFamily: DARK.font,
                        fontSize: "8.5px",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        border: `1px solid ${DARK.accentBlue}`,
                        borderRadius: 0,
                        width: "100%",
                        textAlign: "center",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  ) : (
                    <span 
                      style={{
                        fontFamily: DARK.font,
                        fontSize: "8px",
                        fontWeight: isSelected ? "bold" : "normal",
                        color: DARK.textHi,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        display: "block",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {displayName}
                    </span>
                  )}
                  <div style={{ height: "3px", backgroundColor: (isMuted || isDimmed) ? DARK.textDim : (stripColors[ins.index] ?? DARK.accentMaster), marginTop: `${SPACE.xs}px`, marginBottom: `${SPACE.xs}px` }} />
                  <div 
                    style={{
                      fontFamily: DARK.font,
                      fontSize: "7.5px",
                      color: DARK.textMid,
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    CH {ins.index}
                  </div>
                </div>

                {/* Panning knob */}
                <div 
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    margin: `${SPACE.xs}px 0`,
                  }}
                >
                  <div 
                    style={{
                      fontFamily: DARK.font,
                      fontSize: "7px",
                      color: DARK.textLo,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: `${SPACE.xs}px`,
                    }}
                  >
                    PAN
                  </div>
                  <PanKnob
                    value={ins.pan}
                    min={-50}
                    max={50}
                    onChange={(v) => handlePanChange(ins.index, v)}
                    title={`PANNER FOR INSERT ${ins.index}`}
                    defaultValue={0}
                    dotColor={knobAccent}
                  />
                </div>

                {/* Fader section */}
                <div 
                  style={{
                    flex: 1,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: `${SPACE.xs}px`,
                    maxHeight: "220px",
                    paddingLeft: `${SPACE.xs}px`,
                    paddingRight: `${SPACE.xs}px`,
                  }}
                >
                  <LevelMeter insertIndex={ins.index} isMuted={ins.isMuted} />

                  <div 
                    style={{
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      height: "176px",
                    }}
                  >
                    <VerticalFader
                      value={ins.volume}
                      onChange={(v) => handleVolumeChange(ins.index, v)}
                      title={`FADER FOR INSERT ${ins.index} (DBL-CLICK/ALT-CLICK TO RESET)`}
                    />
                  </div>
                </div>

                {/* Status Dots */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "4px",
                    height: "4px",
                    marginTop: `${SPACE.sm}px`,
                    marginBottom: `${SPACE.sm}px`,
                  }}
                >
                  {hasOutgoingSends && (
                    <div
                      style={{
                        width: "4px",
                        height: "4px",
                        borderRadius: "50%",
                        backgroundColor: "#4fc3f7",
                      }}
                    />
                  )}
                  {hasIncomingSends && (
                    <div
                      style={{
                        width: "4px",
                        height: "4px",
                        borderRadius: "50%",
                        backgroundColor: "#108a38",
                      }}
                    />
                  )}
                </div>

                {/* Context-sensitive Routing UI / Knob slot */}
                <div
                  style={{
                    height: "40px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxSizing: "border-box",
                  }}
                >
                  {(() => {
                    const hasSelection = selectedInsertIndex !== null && selectedInsertIndex !== undefined && selectedInsertIndex > 0;
                    
                    if (!hasSelection) {
                      return null;
                    }

                    if (isSelected) {
                      // Selected insert itself
                      const hasOutgoingSends = ins.sends && ins.sends.length > 0;
                      if (hasOutgoingSends) {
                        return (
                          <div
                            title="Sends active from this insert"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "22px",
                              height: "22px",
                              color: DARK.textMid,
                              fontSize: "10px",
                              fontFamily: DARK.font,
                              userSelect: "none",
                            }}
                          >
                            ▼
                          </div>
                        );
                      }
                      return null;
                    }

                    // Non-selected inserts
                    const activeSend = selectedInsert?.sends?.find(s => s.targetInsertIndex === ins.index);
                    const isSendTarget = !!activeSend;
                    const isSendSource = ins.sends?.some(s => s.targetInsertIndex === selectedInsertIndex);

                    if (isSendTarget) {
                      // STATE 3: Selected insert sends to this insert (show active IN knob with green ring)
                      const inKnobValue = activeSend?.sendGain ?? 1.0;
                      const handleInKnobChange = (v: number) => {
                        if (engine && engine.updateSendLevel) {
                          engine.updateSendLevel(selectedInsertIndex, ins.index, v);
                        } else if (engine.mixerManager && engine.mixerManager.updateSendLevel) {
                          engine.mixerManager.updateSendLevel(selectedInsertIndex, ins.index, v);
                        }
                        pullInserts();
                      };
                      const inKnobTitle = `SEND LEVEL FROM ${selectedInsert?.name || `Insert ${selectedInsertIndex}`} TO ${displayName} (${inKnobValue.toFixed(2)}x)`;

                      return (
                        <div 
                          onMouseDown={e => e.stopPropagation()}
                          onClick={e => e.stopPropagation()}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                          }}
                        >
                          <div 
                            style={{
                              fontFamily: DARK.font,
                              fontSize: "7px",
                              color: DARK.textLo,
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                              marginBottom: "2px",
                            }}
                          >
                            IN
                          </div>
                          <InputGainKnob
                            value={inKnobValue}
                            onChange={handleInKnobChange}
                            title={inKnobTitle}
                            dotColor={knobAccent}
                            hasRing={true}
                            onContextMenu={(e) => handleInKnobContextMenu(e, ins.index)}
                            onDragStart={() => { isDraggingKnobRef.current = true; }}
                            onDragEnd={() => { setTimeout(() => { isDraggingKnobRef.current = false; }, 50); }}
                          />
                        </div>
                      );
                    } else if (isSendSource) {
                      // STATE 2: This insert sends into the selected insert (show read-only DOWN arrow)
                      return (
                        <div
                          title={`Routed into ${selectedInsert?.name || `Insert ${selectedInsertIndex}`}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "22px",
                            height: "22px",
                            color: DARK.textMid,
                            fontSize: "10px",
                            fontFamily: DARK.font,
                            userSelect: "none",
                          }}
                        >
                          ▼
                        </div>
                      );
                    } else {
                      // STATE 1: No relationship (show interactive UP arrow to add send)
                      const handleAddSendClick = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        if (engine && engine.addSend) {
                          engine.addSend(selectedInsertIndex, ins.index);
                        } else if (engine.mixerManager && engine.mixerManager.addSend) {
                          engine.mixerManager.addSend(selectedInsertIndex, ins.index);
                        }
                        pullInserts();
                      };

                      return (
                        <div
                          onClick={handleAddSendClick}
                          title={`Add send from ${selectedInsert?.name || `Insert ${selectedInsertIndex}`}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "22px",
                            height: "22px",
                            cursor: "pointer",
                            color: DARK.textMid,
                            fontSize: "10px",
                            fontFamily: DARK.font,
                            userSelect: "none",
                          }}
                        >
                          ▲
                        </div>
                      );
                    }
                  })()}
                </div>

                {/* Cable Anchor Point */}
                <div 
                  ref={el => { anchorRefs.current[ins.index] = el; }}
                  style={{ height: 0, position: "relative" }}
                />

                {/* dB readout & M/S triggers */}
                <div 
                  style={{
                    paddingLeft: `${SPACE.sm}px`,
                    paddingRight: `${SPACE.sm}px`,
                    display: "flex",
                    flexDirection: "column",
                    gap: `${SPACE.sm}px`,
                    marginTop: `${SPACE.sm}px`,
                  }}
                >
                  {/* dB readout */}
                  <div
                    style={{
                      ...sunken(DARK),
                      backgroundColor: DARK.lcdBg,
                      color: (isMuted || isDimmed) ? DARK.textDim : DARK.accentBlue,
                      fontFamily: DARK.font,
                      fontSize: "9px",
                      textAlign: "right",
                      paddingRight: "4px",
                      paddingLeft: "4px",
                      height: "14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      boxSizing: "border-box",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {ins.volume}%
                  </div>

                  {/* Solo/Mute switches */}
                  <div style={{ display: "flex", gap: `${SPACE.xs}px` }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleMute(ins.index, ins.isMuted); }}
                      style={{
                        flex: 1,
                        height: "18px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: DARK.font,
                        fontSize: "8px",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        cursor: "pointer",
                        userSelect: "none",
                        boxSizing: "border-box",
                        ...(ins.isMuted 
                          ? { ...sunken(DARK), backgroundColor: DARK.stateRed, color: "#ffffff" }
                          : { ...raised(DARK), backgroundColor: DARK.bg3, color: DARK.textMid }
                        )
                      }}
                      title={`MUTE INSERT ${ins.index}`}
                    >
                      M
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleSolo(ins.index, ins.isSoloed); }}
                      style={{
                        flex: 1,
                        height: "18px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: DARK.font,
                        fontSize: "8px",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        cursor: "pointer",
                        userSelect: "none",
                        boxSizing: "border-box",
                        ...(ins.isSoloed 
                          ? { ...sunken(DARK), backgroundColor: DARK.stateGreen, color: "#ffffff" }
                          : { ...raised(DARK), backgroundColor: DARK.bg3, color: DARK.textMid }
                        )
                      }}
                      title={`SOLO INSERT ${ins.index}`}
                    >
                      S
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* 2. DEDICATED FX PANEL MOUNTED RIGHT */}
      {selectedInsert && (
        <div 
          id="mixer-fx-panel" 
          style={{
            width: "224px",
            flexShrink: 0,
            height: "100%",
            borderLeft: `1px solid ${DARK.bevelMid}`,
            backgroundColor: DARK.bg2,
            display: "flex",
            flexDirection: "column",
            padding: `${SPACE.md}px`,
            color: DARK.textMid,
            userSelect: "none",
            boxSizing: "border-box",
          }}
        >
          {/* Header */}
          <div 
            style={{
              ...raised(DARK),
              background: DARK.titleBarGradient,
              height: `${SIZE.titleBarHeight}px`,
              display: "flex",
              alignItems: "center",
              paddingLeft: `${SPACE.sm}px`,
              marginBottom: `${SPACE.md}px`,
              boxSizing: "border-box",
            }}
          >
            <h4 
              style={{
                fontFamily: DARK.font,
                fontSize: "9px",
                color: DARK.textHi,
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: `${SPACE.xs}px`,
              }}
            >
              <Activity style={{ width: "12px", height: "12px" }} />
              FX ROUTING PANEL
            </h4>
          </div>

          <div 
            style={{
              fontFamily: DARK.font,
              fontSize: "8px",
              color: DARK.textLo,
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: `${SPACE.lg}px`,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>
              TARGET:{" "}
              {selectedInsert.name && selectedInsert.name !== `Insert ${selectedInsert.index}`
                ? selectedInsert.name
                : (channels.filter(
                    (c) => (channelMixers?.[c.id] ?? c.mixerTarget) === selectedInsert.index
                  ).length > 0
                    ? channels.filter(
                        (c) => (channelMixers?.[c.id] ?? c.mixerTarget) === selectedInsert.index
                      )[0].name
                    : `Insert ${selectedInsert.index}`)}
            </span>
            <span>INDEX: {selectedInsert.index}</span>
          </div>

          {/* 8 Empty Visual FX Slots with high-contrast hardware look */}
          <div 
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: `${SPACE.sm}px`,
              overflowY: "auto",
              boxSizing: "border-box",
            }}
          >
            {(selectedInsert?.fxSlots || []).map((slotName: string, slotIdx: number) => {
              const isBypassed = selectedInsert.fxBypass?.[slotIdx] ?? false;
              const isFilled = !!slotName;

              return (
                <div 
                  key={slotIdx}
                  draggable={isFilled}
                  onDragStart={(e) => {
                    if (!isFilled) {
                      e.preventDefault();
                      return;
                    }
                    setDraggedSlotIdx(slotIdx);
                    e.dataTransfer.setData("text/plain", String(slotIdx));
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setDraggedSlotIdx(null);
                    setDraggingOverSlotIdx(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDraggingOverSlotIdx(slotIdx);
                  }}
                  onDragLeave={() => {
                    if (draggingOverSlotIdx === slotIdx) {
                      setDraggingOverSlotIdx(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDraggingOverSlotIdx(null);
                    const fromIdx = draggedSlotIdx !== null ? draggedSlotIdx : Number(e.dataTransfer.getData("text/plain"));
                    if (fromIdx !== null && !isNaN(fromIdx) && fromIdx !== slotIdx) {
                      handleReorderFX(fromIdx, slotIdx);
                    }
                    setDraggedSlotIdx(null);
                  }}
                  onClick={() => {
                    if (!slotName) {
                      setActivePickerSlotIdx(slotIdx);
                    } else if (slotName === "EQ") {
                      onOpenEQPanel?.(selectedInsert.index, slotIdx);
                    } else if (slotName === "Reverb") {
                      onOpenReverbPanel?.(selectedInsert.index, slotIdx);
                    }
                  }}
                  onContextMenu={(e) => {
                    if (slotName) {
                      e.preventDefault();
                      e.stopPropagation();
                      const parent = document.getElementById("mixer-parent-container");
                      const parentRect = parent ? parent.getBoundingClientRect() : { left: 0, top: 0 };
                      setSlotContextMenu({
                        visible: true,
                        x: e.clientX - parentRect.left,
                        y: e.clientY - parentRect.top,
                        slotIdx
                      });
                    }
                  }}
                  style={{
                    height: `${SIZE.fxRowHeight}px`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingLeft: `${SPACE.md}px`,
                    paddingRight: `${SPACE.md}px`,
                    position: "relative",
                    cursor: isFilled ? "grab" : "pointer",
                    boxSizing: "border-box",
                    ...(isFilled 
                      ? { ...raised(DARK), backgroundColor: draggingOverSlotIdx === slotIdx ? DARK.bg0 : DARK.bg5, color: DARK.textMid }
                      : { ...flush(DARK), backgroundColor: draggingOverSlotIdx === slotIdx ? DARK.bg0 : DARK.bg1, color: DARK.textDim }
                    ),
                    ...(draggingOverSlotIdx === slotIdx ? sunken(DARK) : {})
                  }}
                >
                  {/* Left slot indicator badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.sm}px` }}>
                    <span 
                      style={{ 
                        fontFamily: DARK.font,
                        fontSize: "8px", 
                        color: DARK.textLo,
                        fontWeight: "bold" 
                      }}
                    >
                      {slotIdx + 1}
                    </span>
                    <span 
                      style={{
                        fontFamily: DARK.font,
                        fontSize: "8.5px",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        textDecoration: (slotName && isBypassed) ? "line-through" : "none",
                        color: slotName 
                          ? (isBypassed ? DARK.textLo : DARK.textHi) 
                          : DARK.textDim
                      }}
                    >
                      {slotName ? slotName : "EMPTY SLOT"}
                    </span>
                  </div>

                  {/* Slot Activation Status / Bypass Toggle */}
                  {slotName && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setInsertFXBypass(selectedInsert.index, slotIdx, !isBypassed);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: `${SPACE.sm}px`,
                        cursor: "pointer",
                        border: "none",
                        background: "none",
                        padding: 0,
                      }}
                      title={isBypassed ? "ACTIVATE EFFECT" : "BYPASS EFFECT"}
                    >
                      <span 
                        style={{ 
                          fontFamily: DARK.font,
                          fontSize: "7px", 
                          color: DARK.textLo, 
                          textTransform: "uppercase",
                          letterSpacing: "0.04em"
                        }}
                      >
                        BYPASS
                      </span>
                      <div 
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          backgroundColor: DARK.bg0,
                          ...sunken(DARK),
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxSizing: "border-box",
                        }}
                      >
                        <div 
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            backgroundColor: isBypassed ? DARK.bg2 : DARK.stateGreen,
                          }} 
                        />
                      </div>
                    </button>
                  )}

                  {/* Popover Effect Picker Dropdown */}
                  {activePickerSlotIdx === slotIdx && (
                    <div 
                      ref={pickerRef}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: "100%",
                        marginTop: "2px",
                        backgroundColor: DARK.bg3,
                        ...flat(DARK),
                        zIndex: 100,
                        fontFamily: DARK.font,
                        fontSize: "9px",
                        textTransform: "uppercase",
                        boxSizing: "border-box",
                      }}
                    >
                      <div 
                        style={{
                          padding: `${SPACE.sm}px ${SPACE.md}px`,
                          fontSize: "7.5px",
                          color: DARK.textLo,
                          borderBottom: `1px solid ${DARK.bg0}`,
                          fontWeight: "bold",
                          letterSpacing: "0.08em",
                        }}
                      >
                        SELECT EFFECT
                      </div>
                      <button
                        onClick={() => {
                          setInsertFXSlot(selectedInsert.index, slotIdx, "EQ");
                          setActivePickerSlotIdx(null);
                        }}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: `${SPACE.sm}px ${SPACE.md}px`,
                          color: DARK.textHi,
                          border: "none",
                          backgroundColor: "transparent",
                          cursor: "pointer",
                          fontFamily: DARK.font,
                          fontSize: "9px",
                          fontWeight: "bold",
                        }}
                      >
                        EQ (PARAMETRIC)
                      </button>
                      <button
                        onClick={() => {
                          setInsertFXSlot(selectedInsert.index, slotIdx, "Reverb");
                          setActivePickerSlotIdx(null);
                        }}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: `${SPACE.sm}px ${SPACE.md}px`,
                          color: DARK.textHi,
                          border: "none",
                          backgroundColor: "transparent",
                          cursor: "pointer",
                          fontFamily: DARK.font,
                          fontSize: "9px",
                          fontWeight: "bold",
                        }}
                      >
                        REVERB (STUB)
                      </button>
                      <div style={{ borderTop: `1px solid ${DARK.bg0}`, marginTop: `${SPACE.xs}px`, paddingTop: `${SPACE.xs}px` }}>
                        <button
                          onClick={() => {
                            setInsertFXSlot(selectedInsert.index, slotIdx, "");
                            setActivePickerSlotIdx(null);
                          }}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: `${SPACE.sm}px ${SPACE.md}px`,
                            color: DARK.stateHot,
                            border: "none",
                            backgroundColor: "transparent",
                            cursor: "pointer",
                            fontFamily: DARK.font,
                            fontSize: "9px",
                            fontWeight: "bold",
                          }}
                        >
                          CLEAR SLOT
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Diagnostics / Signal Flow Card */}
          <div 
            style={{
              marginTop: `${SPACE.lg}px`,
              backgroundColor: DARK.bg0,
              ...flat(DARK),
              padding: `${SPACE.sm}px ${SPACE.md}px`,
              display: "flex",
              flexDirection: "column",
              gap: `${SPACE.xs}px`,
              fontSize: "8px",
              color: DARK.textLo,
              fontWeight: "bold",
              lineHeight: "1.5",
              textTransform: "uppercase",
              boxSizing: "border-box",
            }}
          >
            <div 
              style={{
                borderBottom: `1px solid ${DARK.bevelDark}`,
                paddingBottom: `${SPACE.xs}px`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "7.5px",
              }}
            >
              <span>OUT MODULES</span>
              <Shield style={{ width: "12px", height: "12px", color: DARK.textLo }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: `${SPACE.xs}px` }}>
              <span>SIGNAL PATH:</span>
              <span style={{ color: DARK.accentGreen }}>ANALOG CHAIN</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>LATENCY:</span>
              <span style={{ color: DARK.accentBlue }}>0.00 MS (NATIVE)</span>
            </div>
          </div>
        </div>
      )}

      {slotContextMenu && (
        <div
          ref={contextMenuRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            left: `${slotContextMenu.x}px`,
            top: `${slotContextMenu.y}px`,
            backgroundColor: DARK.bg3,
            ...flat(DARK),
            zIndex: 200,
            fontFamily: DARK.font,
            fontSize: "9px",
            textTransform: "uppercase",
            minWidth: "80px",
            boxSizing: "border-box",
          }}
        >
          <button
            onClick={() => {
              const slotName = selectedInsert.fxSlots[slotContextMenu.slotIdx];
              if (slotName === "EQ") {
                onOpenEQPanel?.(selectedInsert.index, slotContextMenu.slotIdx);
              } else if (slotName === "Reverb") {
                onOpenReverbPanel?.(selectedInsert.index, slotContextMenu.slotIdx);
              }
              setSlotContextMenu(null);
            }}
            style={{
              width: "100%",
              textAlign: "left",
              padding: `${SPACE.sm}px ${SPACE.md}px`,
              color: DARK.textHi,
              border: "none",
              backgroundColor: "transparent",
              cursor: "pointer",
              fontFamily: DARK.font,
              fontSize: "9px",
              fontWeight: "bold",
            }}
          >
            OPEN
          </button>
          <button
            onClick={() => {
              setInsertFXSlot(selectedInsert.index, slotContextMenu.slotIdx, "");
              setSlotContextMenu(null);
            }}
            style={{
              width: "100%",
              textAlign: "left",
              padding: `${SPACE.sm}px ${SPACE.md}px`,
              color: DARK.stateHot,
              borderTop: `1px solid ${DARK.bg0}`,
              backgroundColor: "transparent",
              cursor: "pointer",
              fontFamily: DARK.font,
              fontSize: "9px",
              fontWeight: "bold",
            }}
          >
            REMOVE
          </button>
        </div>
      )}

      {colorMenu && (
        <div
          ref={colorMenuRef}
          style={{
            position: "absolute",
            left: `${colorMenu.x}px`,
            top: `${colorMenu.y}px`,
            backgroundColor: DARK.bg3,
            ...flat(DARK),
            zIndex: 200,
            fontFamily: DARK.font,
            minWidth: "100px",
            boxSizing: "border-box",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div 
            style={{
              padding: `${SPACE.xs}px ${SPACE.md}px`,
              background: DARK.titleBarGradient,
              ...raised(DARK),
              fontSize: "8px",
              color: DARK.textHi, // textHi has better contrast for a title bar header!
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontFamily: DARK.font,
              boxSizing: "border-box",
            }}
          >
            STRIP COLOR
          </div>

          {/* Route focused channel */}
          {focusedChannelId && (
            <>
              <div style={{
                height: 1,
                background: DARK.bevelDark,
                margin: `${SPACE.xs}px 0`,
              }} />
              <div
                onClick={() => {
                  const newMixers = { ...channelMixers, [focusedChannelId]: colorMenu.insertIndex };
                  setChannelMixers(newMixers);
                  setColorMenu(null);
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = DARK.bg4)}
                onMouseLeave={(e) => (e.currentTarget.style.background = DARK.bg3)}
                style={{
                  padding: `${SPACE.sm}px ${SPACE.md}px`,
                  cursor: "pointer",
                  background: DARK.bg3,
                  fontSize: 8,
                  fontFamily: DARK.font,
                  color: DARK.accentGreen,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Route focused channel
              </div>
            </>
          )}

          {/* Color options */}
          {ACCENT_OPTIONS.map((opt) => (
            <div
              key={opt.label}
              onClick={() => {
                setStripColors(prev => ({ ...prev, [colorMenu.insertIndex]: opt.value }));
                setColorMenu(null);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: `${SPACE.sm}px`,
                padding: `${SPACE.sm}px ${SPACE.md}px`,
                cursor: "pointer",
                backgroundColor: DARK.bg3,
                fontSize: "8px",
                color: DARK.textMid,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontFamily: DARK.font,
                boxSizing: "border-box",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DARK.bg4; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DARK.bg3; }}
            >
              <div 
                style={{
                  width: "20px",
                  height: "4px",
                  backgroundColor: opt.value,
                  boxSizing: "border-box",
                }} 
              />
              {opt.label}
            </div>
          ))}
        </div>
      )}

      {inKnobContextMenu && (
        <div
          ref={inKnobContextMenuRef}
          style={{
            position: "absolute",
            left: `${inKnobContextMenu.x}px`,
            top: `${inKnobContextMenu.y}px`,
            backgroundColor: DARK.bg3,
            ...flat(DARK),
            zIndex: 200,
            fontFamily: DARK.font,
            minWidth: "180px",
            boxSizing: "border-box",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div 
            style={{
              padding: `${SPACE.xs}px ${SPACE.md}px`,
              background: DARK.titleBarGradient,
              ...raised(DARK),
              fontSize: "8px",
              color: DARK.textHi,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontFamily: DARK.font,
              boxSizing: "border-box",
            }}
          >
            IN KNOB ROUTING
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* 1. Remove send option */}
            {inKnobContextMenu.targetInsertIndex !== 0 && (
              <>
                <button
                  onClick={handleRemoveSend}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DARK.bg4; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DARK.bg3; }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: `${SPACE.sm}px ${SPACE.md}px`,
                    color: DARK.stateHot,
                    border: "none",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    fontFamily: DARK.font,
                    fontSize: "9px",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                  }}
                >
                  Remove send
                </button>

                {/* divider line */}
                <div style={{ height: "1px", backgroundColor: DARK.bevelDark }} />
              </>
            )}

            {/* 2. Disconnect/Reconnect from master option */}
            {selectedInsert?.routesToMaster !== false ? (
              <button
                onClick={handleDisconnectFromMaster}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DARK.bg4; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DARK.bg3; }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: `${SPACE.sm}px ${SPACE.md}px`,
                  color: DARK.textHi,
                  border: "none",
                  backgroundColor: "transparent",
                  cursor: "pointer",
                  fontFamily: DARK.font,
                  fontSize: "9px",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                }}
              >
                Disconnect {selectedInsert?.name || `Insert ${selectedInsertIndex}`} from master
              </button>
            ) : (
              <button
                onClick={handleReconnectToMaster}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DARK.bg4; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DARK.bg3; }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: `${SPACE.sm}px ${SPACE.md}px`,
                  color: DARK.textHi,
                  border: "none",
                  backgroundColor: "transparent",
                  cursor: "pointer",
                  fontFamily: DARK.font,
                  fontSize: "9px",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                }}
              >
                Reconnect {selectedInsert?.name || `Insert ${selectedInsertIndex}`} to master
              </button>
            )}
          </div>
        </div>
      )}
      {/* Cables Overlay */}
      <CableRenderer
        inserts={insertsState}
        isVisible={isVisible}
        anchorRefs={anchorRefs}
        windowPosRef={windowPosRef}
        prevWindowPosRef={prevWindowPosRef}
      />
    </div>
  );
}

interface CableRendererProps {
  inserts: MixerInsert[];
  isVisible: boolean;
  anchorRefs: React.RefObject<(HTMLDivElement | null)[]>;
  windowPosRef: React.RefObject<{ x: number; y: number }>;
  prevWindowPosRef: React.RefObject<{ x: number; y: number }>;
}

function CableRenderer({
  inserts,
  isVisible,
  anchorRefs,
  windowPosRef,
  prevWindowPosRef,
}: CableRendererProps) {
  const [cables, setCables] = useState<{ key: string; dOuter: string; dInner: string }[]>([]);
  const cablesPhysicsRef = useRef<Map<string, { x: number; y: number; vx: number; vy: number }>>(new Map());
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    const hasSends = inserts.some(ins => ins.sends && ins.sends.length > 0);
    const active = isVisible && hasSends;

    if (!active) {
      setCables([]);
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      return;
    }

    const animate = () => {
      const dx = windowPosRef.current.x - prevWindowPosRef.current.x;
      const dy = windowPosRef.current.y - prevWindowPosRef.current.y;
      prevWindowPosRef.current = { ...windowPosRef.current };

      const newCables: { key: string; dOuter: string; dInner: string }[] = [];
      const currentKeys = new Set<string>();

      const sagAmount = 180;
      const springStrength = 0.04;
      const damping = 0.85;

      inserts.forEach((sourceInsert) => {
        if (!sourceInsert.sends) return;

        sourceInsert.sends.forEach((send) => {
          const fromIdx = sourceInsert.index;
          const toIdx = send.targetInsertIndex;
          const key = `${fromIdx}-${toIdx}`;
          currentKeys.add(key);

          const fromEl = anchorRefs.current[fromIdx];
          const toEl = anchorRefs.current[toIdx];

          if (!fromEl || !toEl) return;

          const fromRect = fromEl.getBoundingClientRect();
          const toRect = toEl.getBoundingClientRect();

          const x1 = fromRect.left + fromRect.width / 2;
          const y1 = fromRect.top + fromRect.height / 2;
          const x2 = toRect.left + toRect.width / 2;
          const y2 = toRect.top + toRect.height / 2;

          const midpointX = (x1 + x2) / 2;
          const targetX = midpointX;
          const targetY = ((y1 + y2) / 2) + sagAmount;

          if (!cablesPhysicsRef.current.has(key)) {
            cablesPhysicsRef.current.set(key, {
              x: targetX,
              y: targetY,
              vx: 0,
              vy: 0,
            });
          }

          const phys = cablesPhysicsRef.current.get(key)!;

          // Apply spring physics
          const ax = (targetX - phys.x) * springStrength;
          const ay = (targetY - phys.y) * springStrength;

          phys.vx += ax;
          phys.vy += ay;

          // Window movement force ( lag )
          phys.vx -= dx * 0.2;
          phys.vy -= dy * 0.2;

          phys.vx *= damping;
          phys.vy *= damping;

          phys.x += phys.vx;
          phys.y += phys.vy;

          // Bezier control points
          const cx1 = x1 + (phys.x - targetX);
          const cy1 = phys.y;
          const cx2 = x2 + (phys.x - targetX);
          const cy2 = phys.y;

          const dOuter = `M ${x1},${y1} C ${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`;
          const dInner = `M ${x1},${y1 - 1} C ${cx1},${cy1 - 1} ${cx2},${cy2 - 1} ${x2},${y2 - 1}`;

          newCables.push({ key, dOuter, dInner });
        });
      });

      // Cleanup
      for (const key of cablesPhysicsRef.current.keys()) {
        if (!currentKeys.has(key)) {
          cablesPhysicsRef.current.delete(key);
        }
      }

      setCables(newCables);
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [inserts, isVisible, anchorRefs, windowPosRef, prevWindowPosRef]);

  if (cables.length === 0) return null;

  return (
    <svg
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      {cables.map(({ key, dOuter, dInner }) => (
        <React.Fragment key={key}>
          <path
            d={dOuter}
            fill="none"
            stroke="#0a0f16"
            strokeWidth={4}
            opacity={0.9}
          />
          <path
            d={dInner}
            fill="none"
            stroke="#2a3848"
            strokeWidth={2}
            opacity={0.8}
          />
        </React.Fragment>
      ))}
    </svg>
  );
}

