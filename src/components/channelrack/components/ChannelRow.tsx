/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { GripVertical } from "lucide-react";
import { useTheme } from "../../../theme/ThemeContext";
import { ChannelRow as ChannelRowType, DAWEvent } from "../../../types";
import { ChannelCommandStrip } from "./ChannelCommandStrip";
import { PianoRollPreview } from "./PianoRollPreview";
import { StepSequencerGrid } from "./StepSequencerGrid";

interface ChannelRowProps {
  channel: ChannelRowType;
  channels: ChannelRowType[];
  setChannels: React.Dispatch<React.SetStateAction<ChannelRowType[]>>;
  activeInstrumentId: string;
  setActiveInstrumentId: (id: string) => void;
  focusedChannelId: string;
  setFocusedChannelId: (id: string) => void;
  mutedChannels: Record<string, boolean>;
  setMutedChannels: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  soloedChannels: Record<string, boolean>;
  setSoloedChannels: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  channelMixers: Record<string, number>;
  setChannelMixers: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  channelPans: Record<string, number>;
  setChannelPans: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  channelVols: Record<string, number>;
  setChannelVols: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  draggedChannelId: string | null;
  setDraggedChannelId: (id: string | null) => void;
  draggingOverChannelId: string | null;
  setDraggingOverChannelId: (id: string | null) => void;
  events: DAWEvent[];
  isStepActive: (channel: ChannelRowType, index: number) => boolean;
  handleStepToggle: (channel: ChannelRowType, index: number) => void;
  handleRightClick: (e: React.MouseEvent, channelId: string) => void;
  handleFileDrop: (file: File, channel: ChannelRowType) => Promise<void>;
  engine: any;
  notifySampleLoaded?: () => void;
  pushToHistory?: (channels?: ChannelRowType[]) => void;
  onOpenWAM?: (channelId: string) => void;
  onOpenSampler?: (channelId: string) => void;
  onOpenPianoRoll?: (channelId: string) => void;
}

export function ChannelRow({
  channel,
  channels,
  setChannels,
  activeInstrumentId,
  setActiveInstrumentId,
  focusedChannelId,
  setFocusedChannelId,
  mutedChannels,
  setMutedChannels,
  soloedChannels,
  setSoloedChannels,
  channelMixers,
  setChannelMixers,
  channelPans,
  setChannelPans,
  channelVols,
  setChannelVols,
  draggedChannelId,
  setDraggedChannelId,
  draggingOverChannelId,
  setDraggingOverChannelId,
  events,
  isStepActive,
  handleStepToggle,
  handleRightClick,
  handleFileDrop,
  engine,
  notifySampleLoaded,
  pushToHistory,
  onOpenWAM,
  onOpenSampler,
  onOpenPianoRoll,
}: ChannelRowProps) {
  const { theme: DARK, raised, flat } = useTheme();

  const isSelected = activeInstrumentId === channel.id;
  const isMuted = !!mutedChannels[channel.id];
  const isSomeSoloed = Object.values(soloedChannels).some(Boolean);
  const isSoloed = !!soloedChannels[channel.id];
  const isFocused = focusedChannelId === channel.id;

  const isEffectivelyMuted = isMuted || (isSomeSoloed && !isSoloed);

  const channelEvents = events.filter(e => e.channelId === channel.id);
  const hasPianoRollEvents = channel.instrumentType === "wam" || channelEvents.some(e => {
    if (e.pitch !== undefined && e.pitch !== channel.pitch) return true;
    if (e.time % 0.25 !== 0) return true;
    if (channel.type === "sample" && e.duration !== 0.4) return true;
    if (channel.type === "pitch" && e.duration !== 0.25) return true;
    return false;
  });

  return (
    <div
      data-channel-row=""
      onClick={() => setFocusedChannelId(channel.id)}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const draggedId = draggedChannelId || e.dataTransfer.getData("text/plain");
        if (draggedId && draggedId !== channel.id) {
          const draggedIndex = channels.findIndex(c => c.id === draggedId);
          const dropIndex = channels.findIndex(c => c.id === channel.id);
          if (draggedIndex !== -1 && dropIndex !== -1) {
            const updated = [...channels];
            const [removed] = updated.splice(draggedIndex, 1);
            updated.splice(dropIndex, 0, removed);
            setChannels(updated);
          }
        }
        setDraggedChannelId(null);
      }}
      style={{
        display: "flex",
        alignItems: "center",
        height: "32px",
        userSelect: "none",
        cursor: "pointer",
        padding: "2px",
        opacity: isEffectivelyMuted ? 0.45 : 1,
        boxSizing: "border-box",
        backgroundColor: isFocused ? DARK.bg4 : DARK.bg3,
        ...(isFocused ? raised(DARK) : flat(DARK)),
      }}
    >
      {/* Grab Handle */}
      <div
        draggable
        onDragStart={(e) => {
          setDraggedChannelId(channel.id);
          e.dataTransfer.setData("text/plain", channel.id);
          e.dataTransfer.effectAllowed = "move";

          const row = e.currentTarget.closest("[data-channel-row]") as HTMLElement;
          if (row) {
            e.dataTransfer.setDragImage(row, 20, row.offsetHeight / 2);
          }
        }}
        onDragEnd={() => {
          setDraggedChannelId(null);
        }}
        style={{
          width: "14px",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "grab",
          color: DARK.textLo,
          flexShrink: 0,
          boxSizing: "border-box",
        }}
        title="Drag to rearrange channel"
      >
        <GripVertical size={12} />
      </div>

      {/* LEFT SIDE COMMAND STRIP */}
      <ChannelCommandStrip
        channel={channel}
        channels={channels}
        setChannels={setChannels}
        isSelected={isSelected}
        isMuted={isMuted}
        isSoloed={isSoloed}
        isFocused={isFocused}
        isEffectivelyMuted={isEffectivelyMuted}
        setFocusedChannelId={setFocusedChannelId}
        draggingOverChannelId={draggingOverChannelId}
        setDraggingOverChannelId={setDraggingOverChannelId}
        draggedChannelId={draggedChannelId}
        setDraggedChannelId={setDraggedChannelId}
        engine={engine}
        channelMixers={channelMixers}
        setChannelMixers={setChannelMixers}
        channelPans={channelPans}
        setChannelPans={setChannelPans}
        channelVols={channelVols}
        setChannelVols={setChannelVols}
        mutedChannels={mutedChannels}
        setMutedChannels={setMutedChannels}
        soloedChannels={soloedChannels}
        setSoloedChannels={setSoloedChannels}
        setActiveInstrumentId={setActiveInstrumentId}
        handleFileDrop={handleFileDrop}
        notifySampleLoaded={notifySampleLoaded}
        pushToHistory={pushToHistory}
        handleRightClick={handleRightClick}
        onOpenWAM={onOpenWAM}
        onOpenSampler={onOpenSampler}
      />

      {/* RIGHT SIDE 16-STEP GRID OR MINI PIANO ROLL PREVIEW */}
      <div 
        style={{ 
          flex: 1, 
          paddingLeft: "6px", 
          paddingRight: "6px", 
          height: "100%", 
          display: "flex", 
          alignItems: "center", 
          minWidth: 0, 
          boxSizing: "border-box" 
        }}
      >
        {hasPianoRollEvents ? (
          <PianoRollPreview
            channel={channel}
            channelEvents={channelEvents}
            onOpenPianoRoll={onOpenPianoRoll}
            setActiveInstrumentId={setActiveInstrumentId}
            setFocusedChannelId={setFocusedChannelId}
          />
        ) : (
          <StepSequencerGrid
            channel={channel}
            isStepActive={isStepActive}
            handleStepToggle={handleStepToggle}
          />
        )}
      </div>
    </div>
  );
}
