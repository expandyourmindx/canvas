import React from "react";
import { useTheme } from "../../../theme/ThemeContext";
import { MixerInsert } from "../../../audio/MixerManager";
import { ChannelRow } from "../../../types";
import { Activity, Shield } from "lucide-react";
import { LOCAL_EFFECTS } from "../menus/MenuOptions";

interface FXRoutingPanelProps {
  selectedInsert: MixerInsert;
  channels: ChannelRow[];
  channelMixers: Record<string, number>;
  draggedSlotIdx: number | null;
  setDraggedSlotIdx: (idx: number | null) => void;
  draggingOverSlotIdx: number | null;
  setDraggingOverSlotIdx: (idx: number | null) => void;
  activePickerSlotIdx: number | null;
  setActivePickerSlotIdx: (idx: number | null) => void;
  remoteEffects: typeof LOCAL_EFFECTS;
  effectMoreOpen: boolean;
  setEffectMoreOpen: (open: boolean) => void;
  effectMoreLoading: boolean;
  wamUrlInput: string;
  setWamUrlInput: (val: string) => void;
  pickerRef: React.RefObject<HTMLDivElement>;
  setSlotContextMenu: (menu: { visible: boolean; x: number; y: number; slotIdx: number } | null) => void;
  recordingOffsetMs: number;
  setRecordingOffsetMs: (val: number) => void;
  engine: any;
  onOpenEQPanel?: (insertIndex: number, slotIndex: number) => void;
  onOpenReverbPanel?: (insertIndex: number, slotIndex: number) => void;
  onOpenWAMEffect?: (insertIndex: number, slotIndex: number) => void;
  setInsertFXSlot: (insertIndex: number, slotIndex: number, effectName: string) => void;
  setInsertFXBypass: (insertIndex: number, slotIndex: number, bypass: boolean) => void;
  loadWAMEffect: (insertIndex: number, slotIndex: number, url: string, name: string) => Promise<any>;
  handleReorderFX: (fromSlot: number, toSlot: number) => void;
  fetchRemoteEffects: () => void;
  deriveWamLabelFromUrl: (url: string) => string;
}

export function FXRoutingPanel({
  selectedInsert,
  channels,
  channelMixers,
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
  pickerRef,
  setSlotContextMenu,
  recordingOffsetMs,
  setRecordingOffsetMs,
  engine,
  onOpenEQPanel,
  onOpenReverbPanel,
  onOpenWAMEffect,
  setInsertFXSlot,
  setInsertFXBypass,
  loadWAMEffect,
  handleReorderFX,
  fetchRemoteEffects,
  deriveWamLabelFromUrl,
}: FXRoutingPanelProps) {
  const { theme: DARK, raised, sunken, flush, flat, SPACE, SIZE } = useTheme();

  return (
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
  );
}
