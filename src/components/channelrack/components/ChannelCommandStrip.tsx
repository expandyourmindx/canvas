/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useTheme } from "../../../theme/ThemeContext";
import { ChannelRow } from "../../../types";
import { Knob } from "./Knob";
import { getLibraryManager } from "../../SampleBrowser";

interface ChannelCommandStripProps {
  channel: ChannelRow;
  channels: ChannelRow[];
  setChannels: React.Dispatch<React.SetStateAction<ChannelRow[]>>;
  isSelected: boolean;
  isMuted: boolean;
  isSoloed: boolean;
  isFocused: boolean;
  isEffectivelyMuted: boolean;
  setFocusedChannelId: (id: string) => void;
  draggingOverChannelId: string | null;
  setDraggingOverChannelId: (id: string | null) => void;
  draggedChannelId: string | null;
  setDraggedChannelId: (id: string | null) => void;
  engine: any;
  channelMixers: Record<string, number>;
  setChannelMixers: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  channelPans: Record<string, number>;
  setChannelPans: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  channelVols: Record<string, number>;
  setChannelVols: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  mutedChannels: Record<string, boolean>;
  setMutedChannels: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  soloedChannels: Record<string, boolean>;
  setSoloedChannels: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setActiveInstrumentId: (id: string) => void;
  handleFileDrop: (file: File, channel: ChannelRow) => Promise<void>;
  notifySampleLoaded?: () => void;
  pushToHistory?: (channels?: ChannelRow[]) => void;
  handleRightClick: (e: React.MouseEvent, channelId: string) => void;
  onOpenWAM?: (channelId: string) => void;
  onOpenSampler?: (channelId: string) => void;
}

export function ChannelCommandStrip({
  channel,
  channels,
  setChannels,
  isSelected,
  isMuted,
  isSoloed,
  isFocused,
  isEffectivelyMuted,
  setFocusedChannelId,
  draggingOverChannelId,
  setDraggingOverChannelId,
  draggedChannelId,
  setDraggedChannelId,
  engine,
  channelMixers,
  setChannelMixers,
  channelPans,
  setChannelPans,
  channelVols,
  setChannelVols,
  mutedChannels,
  setMutedChannels,
  soloedChannels,
  setSoloedChannels,
  setActiveInstrumentId,
  handleFileDrop,
  notifySampleLoaded,
  pushToHistory,
  handleRightClick,
  onOpenWAM,
  onOpenSampler,
}: ChannelCommandStripProps) {
  const { theme: DARK, raised, sunken, SPACE, SIZE } = useTheme();

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDraggingOverChannelId(channel.id);
      }}
      onDragLeave={() => {
        setDraggingOverChannelId(null);
      }}
      onDrop={async (e) => {
        e.preventDefault();
        setDraggingOverChannelId(null);
        
        const sampleDataStr = e.dataTransfer.getData("application/json");
        if (sampleDataStr) {
          try {
            const { id, path, name } = JSON.parse(sampleDataStr);
            
            // Ensure the buffer is fully loaded and decoded in the engine before mapping
            if (engine) {
              const cached = engine.getSampleBuffer(id);
              if (!cached) {
                try {
                  if (path) {
                    // Built-in sample: fetch and load
                    const res = await fetch(path);
                    if (res.ok) {
                      const ab = await res.arrayBuffer();
                      await engine.loadSample(id, ab);
                      if (notifySampleLoaded) {
                        notifySampleLoaded();
                      }
                    }
                  } else {
                    // User sample: load from library
                    const libraryManager = getLibraryManager();
                    const node = libraryManager.findNodeByPath(id);
                    if (node) {
                      const arrayBuffer = await libraryManager.loadBuffer(node);
                      await engine.loadSample(id, arrayBuffer);
                      if (notifySampleLoaded) {
                        notifySampleLoaded();
                      }
                    }
                  }
                } catch (loadErr) {
                  console.error("Failed to load sample buffer on drop:", loadErr);
                }
              }
            }

            const updated = channels.map((c) =>
              c.id === channel.id
                ? { ...c, name: name, sampleId: id, type: "sample" as const }
                : c
            );
            setChannels(updated);
            if (engine) {
              engine.updateChannelSampleId(channel.id, id);
            }
            if (pushToHistory) {
              pushToHistory(updated);
            }
            console.log(`Mapped browser sample to channel rack slot: ${name}`);
          } catch (err) {
            console.error("Failed to map sample browser drop to channel", err);
          }
        } else {
          const file = e.dataTransfer.files[0];
          if (file) {
            await handleFileDrop(file, channel);
          }
        }
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: `${SPACE.sm}px`,
        width: "240px",
        flexShrink: 0,
        padding: "2px",
        boxSizing: "border-box",
        backgroundColor: draggingOverChannelId === channel.id ? DARK.bg0 : "transparent",
        ...(draggingOverChannelId === channel.id ? sunken(DARK) : {}),
      }}
    >
      {/* 0. MIDI Focus Target Indicator LED */}
      <button
        id={`midi-focus-indicator-${channel.id}`}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setFocusedChannelId(channel.id);
        }}
        style={{
          width: "16px",
          height: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: DARK.bg0,
          cursor: "pointer",
          border: "none",
          boxSizing: "border-box",
          ...sunken(DARK),
        }}
        title={isFocused ? "MIDI Data actively routed here" : "Click to route PC MIDI to this channel"}
      >
        <div
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: isFocused ? DARK.accentMaster : DARK.bg2,
            border: isFocused ? `1px solid ${DARK.bevelLight}` : `1px solid ${DARK.bevelDark}`,
            boxSizing: "border-box",
          }}
        />
      </button>

      {/* A. MIXER TARGET ROUTER */}
      <div
        onWheel={(e) => {
          e.preventDefault();
          const dir = e.deltaY > 0 ? -1 : 1;
          setChannelMixers(prev => ({
            ...prev,
            [channel.id]: Math.max(0, Math.min(99, (prev[channel.id] ?? channel.mixerTarget) + dir))
          }));
        }}
        onClick={(e) => {
          e.stopPropagation();
          setChannelMixers(prev => ({
            ...prev,
            [channel.id]: Math.max(0, Math.min(99, (prev[channel.id] ?? channel.mixerTarget) + 1))
          }));
        }}
        style={{
          width: "20px",
          height: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: DARK.lcdBg,
          color: DARK.lcdText,
          fontFamily: DARK.font,
          fontSize: "9px",
          fontWeight: "bold",
          cursor: "ns-resize",
          boxSizing: "border-box",
          ...sunken(DARK),
        }}
        title="Mixer channel router (Click to increase, hover and scroll to change)"
      >
        {channelMixers[channel.id] ?? channel.mixerTarget}
      </div>

      {/* B. MUTE / SOLO TOGGLE LEDS */}
      <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.xs}px` }}>
        {/* Mute Button (M) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMutedChannels(prev => ({ ...prev, [channel.id]: !prev[channel.id] }));
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = isMuted ? '#ff5252' : DARK.bg4;
            if (!isMuted) e.currentTarget.style.color = DARK.textHi;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isMuted ? DARK.stateRed : DARK.bg3;
            if (!isMuted) e.currentTarget.style.color = DARK.textMid;
          }}
          style={{
            width: "18px",
            height: "20px",
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
            ...(isMuted
              ? { ...sunken(DARK), backgroundColor: DARK.stateRed, color: "#ffffff" }
              : { ...raised(DARK), backgroundColor: DARK.bg3, color: DARK.textMid }
            ),
          }}
          title="Mute Channel (M)"
        >
          M
        </button>

        {/* Solo Button (S) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSoloedChannels(prev => ({ ...prev, [channel.id]: !prev[channel.id] }));
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = isSoloed ? '#57e082' : DARK.bg4;
            if (!isSoloed) e.currentTarget.style.color = DARK.textHi;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isSoloed ? DARK.stateGreen : DARK.bg3;
            if (!isSoloed) e.currentTarget.style.color = DARK.textMid;
          }}
          style={{
            width: "18px",
            height: "20px",
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
            ...(isSoloed
              ? { ...sunken(DARK), backgroundColor: DARK.stateGreen, color: "#ffffff" }
              : { ...raised(DARK), backgroundColor: DARK.bg3, color: DARK.textMid }
            ),
          }}
          title="Solo Channel (S)"
        >
          S
        </button>
      </div>

      {/* C. PAN / VOL LEVELERS */}
      <div 
        style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: `${SPACE.sm}px`, 
          width: "56px", 
          flexShrink: 0,
          boxSizing: "border-box",
        }}
      >
        <Knob
          label="PAN"
          value={channelPans[channel.id] ?? 0}
          min={-50}
          max={50}
          color="cyan"
          onChange={(val) => {
            setChannelPans(prev => ({ ...prev, [channel.id]: val }));
            if (engine) engine.updateChannelPan(channel.id, val);
          }}
          title="Pan"
          defaultValue={0}
        />
        <Knob
          label="VOL"
          value={channelVols[channel.id] ?? 80}
          min={0}
          max={100}
          color="amber"
          onChange={(val) => {
            setChannelVols(prev => ({ ...prev, [channel.id]: val }));
            if (engine) engine.updateChannelVolume(channel.id, val);
          }}
          title="Volume"
          defaultValue={80}
        />
      </div>

      {/* D. INSTRUMENT BUTTON WITH RIGHT-CLICK POPUPS */}
      <button
        type="button"
        onContextMenu={(e) => handleRightClick(e, channel.id)}
        onClick={() => {
          setActiveInstrumentId(channel.id);
          if (channel.instrumentType === "wam") {
            if (onOpenWAM) onOpenWAM(channel.id);
          } else {
            if (onOpenSampler) onOpenSampler(channel.id);
          }
        }}
        style={{
          width: `${SIZE.channelNameWidth}px`,
          flexShrink: 0,
          textAlign: "left",
          paddingLeft: `${SPACE.sm}px`,
          paddingRight: `${SPACE.sm}px`,
          height: "22px",
          userSelect: "none",
          fontFamily: DARK.font,
          fontSize: "9px",
          fontWeight: "bold",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          cursor: "pointer",
          border: "none",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          minWidth: 0,
          ...(isSelected
            ? { ...sunken(DARK), backgroundColor: DARK.bg5, color: DARK.textHi }
            : { ...raised(DARK), backgroundColor: DARK.bg3, color: DARK.textMid }
          ),
        }}
        title={`${channel.name} Settings (Right-click for options)`}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {channel.name}
        </span>
      </button>
    </div>
  );
}
