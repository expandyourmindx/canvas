import React from "react";
import { useTheme } from "../../../theme/ThemeContext";
import { MixerInsert } from "../../../audio/MixerManager";
import { ChannelRow } from "../../../types";
import { PanKnob } from "../UI/PanKnob";
import { LevelMeter } from "../UI/LevelMeter";
import { VerticalFader } from "../UI/VerticalFader";
import { InputGainKnob } from "../UI/InputGainKnob";

interface ChannelStripProps {
  insertsState: MixerInsert[];
  selectedInsertIndex: number;
  setSelectedInsertIndex: (index: number) => void;
  channels: ChannelRow[];
  channelMixers: Record<string, number>;
  anySoloed: boolean;
  stripColors: Record<number, string>;
  isDraggingKnobRef: React.RefObject<boolean>;
  setColorMenu: (menu: { visible: boolean; x: number; y: number; insertIndex: number } | null) => void;
  startRename: (index: number, currentName: string) => void;
  submitRename: (index: number) => void;
  renamingIndex: number | null;
  renameValue: string;
  setRenameValue: (val: string) => void;
  handlePanChange: (index: number, nextPan: number) => void;
  handleVolumeChange: (index: number, nextVol: number) => void;
  engine: any;
  pullInserts: () => void;
  handleInKnobContextMenu: (e: React.MouseEvent, targetIndex: number) => void;
  anchorRefs: React.RefObject<(HTMLDivElement | null)[]>;
  selectedDeviceIds: Record<number, string>;
  setSelectedDeviceIds: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  audioInputs: MediaDeviceInfo[];
  setAudioInputs: React.Dispatch<React.SetStateAction<MediaDeviceInfo[]>>;
  micErrors: Record<number, string>;
  setMicErrors: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  armInsert: (index: number, deviceId?: string) => Promise<any>;
  disarmInsert: (index: number) => void;
  handleToggleMute: (index: number, currentMuted: boolean) => void;
  handleToggleSolo: (index: number, currentSoloed: boolean) => void;
  selectedInsert: MixerInsert;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
}

export function ChannelStrip({
  insertsState,
  selectedInsertIndex,
  setSelectedInsertIndex,
  channels,
  channelMixers,
  anySoloed,
  stripColors,
  isDraggingKnobRef,
  setColorMenu,
  startRename,
  submitRename,
  renamingIndex,
  renameValue,
  setRenameValue,
  handlePanChange,
  handleVolumeChange,
  engine,
  pullInserts,
  handleInKnobContextMenu,
  anchorRefs,
  selectedDeviceIds,
  setSelectedDeviceIds,
  audioInputs,
  setAudioInputs,
  micErrors,
  setMicErrors,
  armInsert,
  disarmInsert,
  handleToggleMute,
  handleToggleSolo,
  selectedInsert,
  scrollContainerRef,
}: ChannelStripProps) {
  const { theme: DARK, raised, sunken, SPACE, SIZE } = useTheme();

  return (
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
                    if (e.key === "Escape") startRename(-1, ""); // closes renaming input
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
                        onDragStart={() => { if (isDraggingKnobRef.current !== null) (isDraggingKnobRef as any).current = true; }}
                        onDragEnd={() => { setTimeout(() => { if (isDraggingKnobRef.current !== null) (isDraggingKnobRef as any).current = false; }, 50); }}
                      />
                    </div>
                  );
                } else if (isSendSource) {
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
              ref={el => { if (anchorRefs.current) anchorRefs.current[ins.index] = el; }}
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
                  onClick={(e) => { e.stopPropagation(); handleToggleMute(ins.index, !!ins.isMuted); }}
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
  );
}
