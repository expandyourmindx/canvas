import React from "react";
import { ChannelRow } from "../types";
import { useTheme } from "../theme/ThemeContext";
import { useMixerState } from "./mixer/hooks/useMixerState";
import { getAccentOptions } from "./mixer/menus/MenuOptions";
import { MasterStrip } from "./mixer/components/MasterStrip";
import { ChannelStrip } from "./mixer/components/ChannelStrip";
import { FXRoutingPanel } from "./mixer/components/FXRoutingPanel";
import { CableRenderer } from "./mixer/components/CableRenderer";

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
  const { theme: DARK, flat, raised, SPACE } = useTheme();

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
    effectMoreOpen,
    setEffectMoreOpen,
    effectMoreLoading,
    wamUrlInput,
    setWamUrlInput,
    slotContextMenu,
    setSlotContextMenu,
    colorMenu,
    setColorMenu,
    inKnobContextMenu,
    setInKnobContextMenu,
    renamingIndex,
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
          <MasterStrip
            insertsState={insertsState}
            isMasterMuted={!!isMasterMuted}
            isMasterSelected={isMasterSelected}
            stripColors={stripColors}
            selectedInsertIndex={selectedInsertIndex}
            setSelectedInsertIndex={setSelectedInsertIndex}
            selectedInsert={selectedInsert}
            isDraggingKnobRef={isDraggingKnobRef}
            setColorMenu={setColorMenu}
            handlePanChange={handlePanChange}
            handleVolumeChange={handleVolumeChange}
            handleToggleMute={handleToggleMute}
            handleToggleSolo={handleToggleSolo}
            handleInputGainChange={handleInputGainChange}
            handleInKnobContextMenu={handleInKnobContextMenu}
            engine={engine}
            pullInserts={pullInserts}
            anchorRefs={anchorRefs}
          />
        )}

        {/* B. SCROLLING INSERTS BANK */}
        <ChannelStrip
          insertsState={insertsState}
          selectedInsertIndex={selectedInsertIndex}
          setSelectedInsertIndex={setSelectedInsertIndex}
          channels={channels}
          channelMixers={channelMixers}
          anySoloed={anySoloed}
          stripColors={stripColors}
          isDraggingKnobRef={isDraggingKnobRef}
          setColorMenu={setColorMenu}
          startRename={startRename}
          submitRename={submitRename}
          renamingIndex={renamingIndex}
          renameValue={renameValue}
          setRenameValue={setRenameValue}
          handlePanChange={handlePanChange}
          handleVolumeChange={handleVolumeChange}
          engine={engine}
          pullInserts={pullInserts}
          handleInKnobContextMenu={handleInKnobContextMenu}
          anchorRefs={anchorRefs}
          selectedDeviceIds={selectedDeviceIds}
          setSelectedDeviceIds={setSelectedDeviceIds}
          audioInputs={audioInputs}
          setAudioInputs={setAudioInputs}
          micErrors={micErrors}
          setMicErrors={setMicErrors}
          armInsert={armInsert}
          disarmInsert={disarmInsert}
          handleToggleMute={handleToggleMute}
          handleToggleSolo={handleToggleSolo}
          selectedInsert={selectedInsert}
          scrollContainerRef={scrollContainerRef}
        />
      </div>

      {/* 2. DEDICATED FX PANEL MOUNTED RIGHT */}
      {selectedInsert && (
        <FXRoutingPanel
          selectedInsert={selectedInsert}
          channels={channels}
          channelMixers={channelMixers}
          draggedSlotIdx={draggedSlotIdx}
          setDraggedSlotIdx={setDraggedSlotIdx}
          draggingOverSlotIdx={draggingOverSlotIdx}
          setDraggingOverSlotIdx={setDraggingOverSlotIdx}
          activePickerSlotIdx={activePickerSlotIdx}
          setActivePickerSlotIdx={setActivePickerSlotIdx}
          remoteEffects={remoteEffects}
          effectMoreOpen={effectMoreOpen}
          setEffectMoreOpen={setEffectMoreOpen}
          effectMoreLoading={effectMoreLoading}
          wamUrlInput={wamUrlInput}
          setWamUrlInput={setWamUrlInput}
          pickerRef={pickerRef}
          setSlotContextMenu={setSlotContextMenu}
          recordingOffsetMs={recordingOffsetMs}
          setRecordingOffsetMs={setRecordingOffsetMs}
          engine={engine}
          onOpenEQPanel={onOpenEQPanel}
          onOpenReverbPanel={onOpenReverbPanel}
          onOpenWAMEffect={onOpenWAMEffect}
          setInsertFXSlot={setInsertFXSlot}
          setInsertFXBypass={setInsertFXBypass}
          loadWAMEffect={loadWAMEffect}
          handleReorderFX={handleReorderFX}
          fetchRemoteEffects={fetchRemoteEffects}
          deriveWamLabelFromUrl={deriveWamLabelFromUrl}
        />
      )}

      {/* Context Menus */}
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
              color: DARK.textHi,
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

                <div style={{ height: "1px", backgroundColor: DARK.bevelDark }} />
              </>
            )}

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
