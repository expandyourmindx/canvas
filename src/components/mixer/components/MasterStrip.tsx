import React from "react";
import { useTheme } from "../../../theme/ThemeContext";
import { MixerInsert } from "../../../audio/MixerManager";
import { PanKnob } from "../UI/PanKnob";
import { LevelMeter } from "../UI/LevelMeter";
import { VerticalFader } from "../UI/VerticalFader";
import { InputGainKnob } from "../UI/InputGainKnob";

interface MasterStripProps {
  insertsState: MixerInsert[];
  isMasterMuted: boolean;
  isMasterSelected: boolean;
  stripColors: Record<number, string>;
  selectedInsertIndex: number;
  setSelectedInsertIndex: (index: number) => void;
  selectedInsert: MixerInsert;
  isDraggingKnobRef: React.RefObject<boolean>;
  setColorMenu: (menu: { visible: boolean; x: number; y: number; insertIndex: number } | null) => void;
  handlePanChange: (index: number, nextPan: number) => void;
  handleVolumeChange: (index: number, nextVol: number) => void;
  handleToggleMute: (index: number, currentMuted: boolean) => void;
  handleToggleSolo: (index: number, currentSoloed: boolean) => void;
  handleInputGainChange: (index: number, nextGain: number) => void;
  handleInKnobContextMenu: (e: React.MouseEvent, targetIndex: number) => void;
  engine: any;
  pullInserts: () => void;
  anchorRefs: React.RefObject<(HTMLDivElement | null)[]>;
}

export function MasterStrip({
  insertsState,
  isMasterMuted,
  isMasterSelected,
  stripColors,
  selectedInsertIndex,
  setSelectedInsertIndex,
  selectedInsert,
  isDraggingKnobRef,
  setColorMenu,
  handlePanChange,
  handleVolumeChange,
  handleToggleMute,
  handleToggleSolo,
  handleInputGainChange,
  handleInKnobContextMenu,
  engine,
  pullInserts,
  anchorRefs,
}: MasterStripProps) {
  const { theme: DARK, raised, sunken, SPACE, SIZE } = useTheme();

  return (
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

          const isConnected = selectedInsert?.routesToMaster !== false;

          if (isConnected) {
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
                  onDragStart={() => { if (isDraggingKnobRef.current !== null) (isDraggingKnobRef as any).current = true; }}
                  onDragEnd={() => { setTimeout(() => { if (isDraggingKnobRef.current !== null) (isDraggingKnobRef as any).current = false; }, 50); }}
                />
              </div>
            );
          } else {
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
        ref={el => { if (anchorRefs.current) anchorRefs.current[0] = el; }}
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
            onClick={(e) => { e.stopPropagation(); handleToggleMute(0, !!insertsState[0]?.isMuted); }}
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
            onClick={(e) => { e.stopPropagation(); handleToggleSolo(0, !!insertsState[0]?.isSoloed); }}
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
  );
}
