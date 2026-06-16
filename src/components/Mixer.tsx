import React, { useRef, useState, useEffect, useCallback } from "react";
import { useAudioEngine } from "../audio/useAudioEngine";
import { ChannelRow } from "../types";
import { MixerInsert } from "../audio/MixerManager";
import { useTheme, DARK } from "../theme/ThemeContext";
import { Activity, Shield } from "lucide-react";
import { LevelMeter } from "./mixer/UI/LevelMeter";
import { PanKnob } from "./mixer/UI/PanKnob";
import { InputGainKnob } from "./mixer/UI/InputGainKnob";
import { VerticalFader } from "./mixer/UI/VerticalFader";
import { useMixerState } from "./mixer/hooks/useMixerState";
import { LOCAL_EFFECTS, getAccentOptions } from "./mixer/menus/MenuOptions";

interface MixerProps {
  channels?: ChannelRow[];
  channelMixers?: Record<string, number>;
  setChannelMixers?: (mixers: Record<string, number>) => void;
  onOpenEQPanel?: (insertIndex: number, slotIndex: number) => void;
  onOpenReverbPanel?: (insertIndex: number, slotIndex: number) => void;
  onOpenWAMEffect?: (insertIndex: number, slotIndex: number) => void;
  stripColors?: Record<number, string>;
  setStripColors?: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  isVisible?: boolean;
  onPositionChangeRef?: React.MutableRefObject<((pos: { x: number; y: number }) => void) | null>;
}

export function Mixer({
  channels = [],
  channelMixers = {},
  setChannelMixers = () => {},
  onOpenEQPanel,
  onOpenReverbPanel,
  onOpenWAMEffect,
  stripColors = {},
  setStripColors = () => {},
  isVisible = false,
  onPositionChangeRef,
}: MixerProps) {
  const { theme: DARK, raised, sunken, flat, flush, SPACE, SIZE } = useTheme();
  const {
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
  } = useMixerState({
    channels,
    channelMixers,
    setChannelMixers,
    onPositionChangeRef,
    stripColors,
    setStripColors,
  });

  const ACCENT_OPTIONS = getAccentOptions(DARK);

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
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = insertsState[0]?.isMuted ? '#ff5252' : DARK.bg4;
                    if (!insertsState[0]?.isMuted) e.currentTarget.style.color = DARK.textHi;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = insertsState[0]?.isMuted ? DARK.stateRed : DARK.bg3;
                    if (!insertsState[0]?.isMuted) e.currentTarget.style.color = DARK.textMid;
                  }}
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
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = insertsState[0]?.isSoloed ? '#57e082' : DARK.bg4;
                    if (!insertsState[0]?.isSoloed) e.currentTarget.style.color = DARK.textHi;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = insertsState[0]?.isSoloed ? DARK.stateGreen : DARK.bg3;
                    if (!insertsState[0]?.isSoloed) e.currentTarget.style.color = DARK.textMid;
                  }}
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

                {/* Input Device Selector + ARM button (track inserts only) */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    paddingLeft: `${SPACE.sm}px`,
                    paddingRight: `${SPACE.sm}px`,
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: `${SPACE.xs}px`,
                    marginTop: `${SPACE.xs}px`,
                  }}
                >
                  {/* Device selector */}
                  {typeof navigator !== "undefined" && navigator.mediaDevices && (
                    <select
                      value={selectedDeviceIds[ins.index] ?? ""}
                      onChange={(e) => {
                        e.stopPropagation();
                        setSelectedDeviceIds(prev => ({ ...prev, [ins.index]: e.target.value }));
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: "100%",
                        height: "14px",
                        backgroundColor: DARK.lcdBg,
                        color: DARK.accentBlue,
                        fontFamily: DARK.font,
                        fontSize: "7px",
                        border: `1px solid ${DARK.bevelMid}`,
                        borderRadius: 0,
                        outline: "none",
                        cursor: "pointer",
                        boxSizing: "border-box",
                        paddingLeft: "2px",
                      }}
                      title="Select audio input device"
                    >
                      <option value="">Default Input</option>
                      {audioInputs.map(device => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || device.deviceId.slice(0, 12)}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* ARM button */}
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (ins.armed) {
                        disarmInsert(ins.index);
                        setMicErrors(prev => { const n = { ...prev }; delete n[ins.index]; return n; });
                        pullInserts();
                      } else {
                        try {
                          await armInsert(ins.index, selectedDeviceIds[ins.index] || undefined);
                          const devices = await navigator.mediaDevices.enumerateDevices();
                          setAudioInputs(devices.filter(d => d.kind === 'audioinput'));
                          setMicErrors(prev => { const n = { ...prev }; delete n[ins.index]; return n; });
                          pullInserts();
                        } catch (_) {
                          setMicErrors(prev => ({ ...prev, [ins.index]: "Mic denied" }));
                        }
                      }
                    }}
                    title={ins.armed ? `Disarm Insert ${ins.index}` : `Arm Insert ${ins.index} for recording`}
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      backgroundColor: ins.armed ? DARK.stateRed : DARK.bg0,
                      border: `1px solid ${ins.armed ? DARK.stateRed : DARK.bevelMid}`,
                      cursor: "pointer",
                      padding: 0,
                      flexShrink: 0,
                      boxSizing: "border-box",
                      ...(ins.armed ? sunken(DARK) : raised(DARK)),
                    }}
                  />
                </div>

                {/* Mic denied error label */}
                {micErrors[ins.index] && (
                  <span style={{ fontFamily: DARK.font, fontSize: "7px", color: DARK.stateRed, textAlign: "center" }}>
                    {micErrors[ins.index]}
                  </span>
                )}

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
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = ins.isMuted ? '#ff5252' : DARK.bg4;
                        if (!ins.isMuted) e.currentTarget.style.color = DARK.textHi;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = ins.isMuted ? DARK.stateRed : DARK.bg3;
                        if (!ins.isMuted) e.currentTarget.style.color = DARK.textMid;
                      }}
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
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = ins.isSoloed ? '#57e082' : DARK.bg4;
                        if (!ins.isSoloed) e.currentTarget.style.color = DARK.textHi;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = ins.isSoloed ? DARK.stateGreen : DARK.bg3;
                        if (!ins.isSoloed) e.currentTarget.style.color = DARK.textMid;
                      }}
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
                    } else if (slotName.startsWith("WAM:")) {
                      onOpenWAMEffect?.(selectedInsert.index, slotIdx);
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

                      {/* WAM Effects section */}
                      <div
                        style={{
                          padding: `${SPACE.xs}px ${SPACE.md}px`,
                          fontSize: "7.5px",
                          color: DARK.textLo,
                          borderTop: `1px solid ${DARK.bg0}`,
                          borderBottom: `1px solid ${DARK.bg0}`,
                          fontWeight: "bold",
                          letterSpacing: "0.08em",
                          fontFamily: DARK.font,
                          textTransform: "uppercase",
                          marginTop: `${SPACE.xs}px`,
                        }}
                      >
                        WAM EFFECTS
                      </div>

                      {LOCAL_EFFECTS.map((effect) => (
                        <button
                          key={effect.id}
                          onClick={async () => {
                            setActivePickerSlotIdx(null);
                            try {
                              await loadWAMEffect(selectedInsert.index, slotIdx, effect.url, effect.name);
                            } catch (err) {
                              console.error("Failed to load WAM effect:", err);
                            }
                          }}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: `${SPACE.sm}px ${SPACE.md}px`,
                            color: DARK.accentOrange,
                            border: "none",
                            backgroundColor: "transparent",
                            cursor: "pointer",
                            fontFamily: DARK.font,
                            fontSize: "9px",
                            fontWeight: "bold",
                            textTransform: "uppercase",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = DARK.bg3;
                            e.currentTarget.style.color = DARK.textHi;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                            e.currentTarget.style.color = DARK.accentOrange;
                          }}
                        >
                          {effect.name}
                        </button>
                      ))}

                      <div
                        onMouseEnter={() => { setEffectMoreOpen(true); fetchRemoteEffects(); }}
                        onMouseLeave={() => setEffectMoreOpen(false)}
                        style={{
                          position: "relative",
                          width: "100%",
                          textAlign: "left",
                          padding: `${SPACE.sm}px ${SPACE.md}px`,
                          backgroundColor: "transparent",
                          color: DARK.textLo,
                          cursor: "pointer",
                          fontFamily: DARK.font,
                          fontSize: "9px",
                          fontWeight: "bold",
                          textTransform: "uppercase",
                          boxSizing: "border-box",
                        }}
                      >
                        More ▶
                        {effectMoreOpen && (
                          <div
                            style={{
                              position: "absolute",
                              left: "100%",
                              top: 0,
                              width: "180px",
                              backgroundColor: DARK.bg2,
                              ...flat(DARK),
                              padding: "2px",
                              zIndex: 110,
                              display: "flex",
                              flexDirection: "column",
                              boxSizing: "border-box",
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {effectMoreLoading || remoteEffects.length === 0 ? (
                              <div style={{
                                padding: `${SPACE.sm}px ${SPACE.md}px`,
                                color: DARK.textLo,
                                fontFamily: DARK.font,
                                fontSize: "9px",
                                fontWeight: "bold",
                                textTransform: "uppercase",
                              }}>
                                {effectMoreLoading ? "Loading..." : "No effects found"}
                              </div>
                            ) : (
                              remoteEffects.map((effect) => (
                                <button
                                  key={effect.id}
                                  onClick={async () => {
                                    setActivePickerSlotIdx(null);
                                    setEffectMoreOpen(false);
                                    try {
                                      await loadWAMEffect(selectedInsert.index, slotIdx, effect.url, effect.name);
                                    } catch (err) {
                                      console.error("Failed to load remote WAM effect:", err);
                                    }
                                  }}
                                  style={{
                                    width: "100%",
                                    textAlign: "left",
                                    padding: `${SPACE.sm}px ${SPACE.md}px`,
                                    backgroundColor: "transparent",
                                    color: DARK.accentOrange,
                                    border: "none",
                                    cursor: "pointer",
                                    fontFamily: DARK.font,
                                    fontSize: "9px",
                                    fontWeight: "bold",
                                    textTransform: "uppercase",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = DARK.bg3;
                                    e.currentTarget.style.color = DARK.textHi;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = "transparent";
                                    e.currentTarget.style.color = DARK.accentOrange;
                                  }}
                                >
                                  {effect.name}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      <div style={{ borderTop: `1px solid ${DARK.bg0}`, marginTop: `${SPACE.xs}px` }} />

                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const trimmed = wamUrlInput.trim();
                          if (!trimmed) return;
                          const label = deriveWamLabelFromUrl(trimmed);
                          setWamUrlInput("");
                          setActivePickerSlotIdx(null);
                          try {
                            await loadWAMEffect(selectedInsert.index, slotIdx, trimmed, label);
                          } catch (err) {
                            console.error("Failed to load custom WAM effect:", err);
                          }
                        }}
                        style={{
                          display: "flex",
                          gap: "2px",
                          padding: `${SPACE.sm}px ${SPACE.md}px`,
                          boxSizing: "border-box",
                        }}
                      >
                        <input
                          type="text"
                          placeholder="Paste WAM URL..."
                          value={wamUrlInput}
                          onChange={(e) => setWamUrlInput(e.target.value)}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            backgroundColor: DARK.bg2,
                            color: DARK.textHi,
                            border: "none",
                            outline: "none",
                            fontFamily: DARK.font,
                            fontSize: "9px",
                            fontWeight: "bold",
                            padding: `${SPACE.sm}px ${SPACE.md}px`,
                            boxSizing: "border-box",
                            borderRadius: 0,
                            boxShadow: "none",
                          }}
                        />
                        <button
                          type="submit"
                          style={{
                            backgroundColor: DARK.bg2,
                            color: DARK.accentOrange,
                            border: "none",
                            cursor: "pointer",
                            fontFamily: DARK.font,
                            fontSize: "9px",
                            fontWeight: "bold",
                            textTransform: "uppercase",
                            padding: `${SPACE.sm}px ${SPACE.md}px`,
                            boxSizing: "border-box",
                            borderRadius: 0,
                            boxShadow: "none",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = DARK.bg3;
                            e.currentTarget.style.color = DARK.textHi;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = DARK.bg2;
                            e.currentTarget.style.color = DARK.accentOrange;
                          }}
                        >
                          Load
                        </button>
                      </form>

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
            {selectedInsert.index > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: `${SPACE.xs}px` }}>
                <span>REC OFFSET:</span>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <input
                    type="number"
                    value={recordingOffsetMs}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        setRecordingOffsetMs(val);
                        if (engine && (engine as any).setRecordingOffsetMs) {
                          (engine as any).setRecordingOffsetMs(val);
                        }
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: "48px",
                      height: "14px",
                      backgroundColor: DARK.lcdBg,
                      color: DARK.accentBlue,
                      fontFamily: DARK.font,
                      fontSize: "8px",
                      border: `1px solid ${DARK.bevelMid}`,
                      borderRadius: 0,
                      outline: "none",
                      textAlign: "right",
                      paddingRight: "2px",
                      boxSizing: "border-box",
                    }}
                    title="Recording latency compensation offset in milliseconds (negative = shift clip earlier)"
                  />
                  <span style={{ color: DARK.textDim, fontSize: "7px" }}>MS</span>
                </div>
              </div>
            )}
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
      const springStrength = 0.06;
      const damping = 0.88;

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
          phys.vx -= dx * 0.16;
          phys.vy -= dy * 0.16;

          phys.vx *= damping;
          phys.vy *= damping;

          phys.x += phys.vx;
          phys.y += phys.vy;

          // Clamp position to max drift of 60px from resting position (targetX, targetY)
          const diffX = phys.x - targetX;
          const diffY = phys.y - targetY;
          const dist = Math.sqrt(diffX * diffX + diffY * diffY);
          if (dist > 60) {
            phys.x = targetX + (diffX / dist) * 60;
            phys.y = targetY + (diffY / dist) * 60;
          }

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

