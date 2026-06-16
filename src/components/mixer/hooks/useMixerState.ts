import React, { useRef, useState, useEffect, useCallback } from "react";
import { useAudioEngine } from "../../../audio/useAudioEngine";
import { ChannelRow } from "../../../types";
import { MixerInsert } from "../../../audio/MixerManager";
import { LOCAL_EFFECTS } from "../menus/MenuOptions";

interface UseMixerStateProps {
  channels: ChannelRow[];
  channelMixers: Record<string, number>;
  setChannelMixers: (mixers: Record<string, number>) => void;
  onPositionChangeRef?: React.MutableRefObject<((pos: { x: number; y: number }) => void) | null>;
  stripColors: Record<number, string>;
  setStripColors: React.Dispatch<React.SetStateAction<Record<number, string>>>;
}

export function useMixerState({
  channels,
  channelMixers,
  setChannelMixers,
  onPositionChangeRef,
  stripColors,
  setStripColors,
}: UseMixerStateProps) {
  const { 
    engine, 
    setInsertFXSlot, 
    setInsertFXBypass, 
    loadWAMEffect, 
    focusedChannelId, 
    armInsert, 
    disarmInsert 
  } = useAudioEngine();

  const [selectedInsertIndex, setSelectedInsertIndex] = useState(0);
  const isDraggingKnobRef = useRef(false);
  const [recordingOffsetMs, setRecordingOffsetMs] = useState<number>(-50);
  
  const [insertsState, setInsertsState] = useState<MixerInsert[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Record<number, string>>({});
  const [micErrors, setMicErrors] = useState<Record<number, string>>({});

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
  const [remoteEffects, setRemoteEffects] = useState<typeof LOCAL_EFFECTS>([]);
  const [effectMoreOpen, setEffectMoreOpen] = useState(false);
  const [effectMoreLoading, setEffectMoreLoading] = useState(false);
  const [wamUrlInput, setWamUrlInput] = useState("");
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

  const deriveWamLabelFromUrl = (url: string): string => {
    try {
      const path = new URL(url).pathname;
      const segments = path.split("/").filter(Boolean);
      const last = segments
        .reverse()
        .find(s => !/^index\.(js|mjs)$/i.test(s));
      if (!last) return "Custom WAM";
      const cleaned = last.replace(/\.(js|mjs)$/i, "").replace(/[-_]+/g, " ").trim();
      if (!cleaned) return "Custom WAM";
      return cleaned
        .split(" ")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    } catch {
      return "Custom WAM";
    }
  };

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

  // Enumerate audio input devices; refresh on devicechange events
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    const enumerate = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devices.filter(d => d.kind === "audioinput"));
      } catch (_) {}
    };
    enumerate();
    navigator.mediaDevices.addEventListener("devicechange", enumerate);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", enumerate);
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

  const fetchRemoteEffects = async () => {
    if (remoteEffects.length > 0) return;
    setEffectMoreLoading(true);
    try {
      const res = await fetch("https://plugins.canvasdaw.com/plugins.json");
      if (res.ok) {
        const data: any[] = await res.json();
        setRemoteEffects(
          data
            .filter((p: any) => p.type === "effect")
            .map((p: any) => ({
              id: p.id,
              name: p.name,
              url: p.url,
              description: p.description,
            }))
        );
      }
    } catch {
      // fail silently
    } finally {
      setEffectMoreLoading(false);
    }
  };

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
    const selectedInsert = insertsState[selectedInsertIndex] || insertsState[0];
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

  return {
    engine,
    setInsertFXSlot,
    setInsertFXBypass,
    loadWAMEffect,
    focusedChannelId,
    armInsert,
    disarmInsert,

    selectedInsertIndex,
    setSelectedInsertIndex,
    insertsState,
    setInsertsState,
    recordingOffsetMs,
    setRecordingOffsetMs,
    audioInputs,
    setAudioInputs,
    selectedDeviceIds,
    setSelectedDeviceIds,
    micErrors,
    setMicErrors,
    draggedSlotIdx,
    setDraggedSlotIdx,
    draggingOverSlotIdx,
    setDraggingOverSlotIdx,
    activePickerSlotIdx,
    setActivePickerSlotIdx,
    remoteEffects,
    setRemoteEffects,
    effectMoreOpen,
    setEffectMoreOpen,
    effectMoreLoading,
    setEffectMoreLoading,
    wamUrlInput,
    setWamUrlInput,
    slotContextMenu,
    setSlotContextMenu,
    colorMenu,
    setColorMenu,
    inKnobContextMenu,
    setInKnobContextMenu,
    renamingIndex,
    setRenamingIndex,
    renameValue,
    setRenameValue,

    isDraggingKnobRef,
    windowPosRef,
    prevWindowPosRef,
    anchorRefs,
    scrollContainerRef,
    pickerRef,
    contextMenuRef,
    colorMenuRef,
    inKnobContextMenuRef,

    selectedInsert,
    isMasterSelected,
    isMasterMuted,
    anySoloed,

    deriveWamLabelFromUrl,
    startRename,
    submitRename,
    pullInserts,
    fetchRemoteEffects,
    handleInKnobContextMenu,
    handleRemoveSend,
    handleDisconnectFromMaster,
    handleReconnectToMaster,
    handleVolumeChange,
    handlePanChange,
    handleInputGainChange,
    handleReorderFX,
    handleToggleMute,
    handleToggleSolo,
  };
}
