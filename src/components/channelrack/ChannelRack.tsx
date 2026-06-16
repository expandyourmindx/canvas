/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useTheme } from "../../theme/ThemeContext";
import { ChannelRow } from "../../types";
import { useChannelRackState, LOCAL_INSTRUMENTS } from "./hooks/useChannelRackState";
import { PatternHeader } from "./components/PatternHeader";
import { PlayheadLEDs } from "./components/PlayheadLEDs";
import { ChannelRow as ChannelRowComponent } from "./components/ChannelRow";

export interface ChannelRackProps {
  channels?: ChannelRow[];
  setChannels?: React.Dispatch<React.SetStateAction<ChannelRow[]>>;
  channelMixers?: Record<string, number>;
  setChannelMixers?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  channelPans?: Record<string, number>;
  setChannelPans?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  channelVols?: Record<string, number>;
  setChannelVols?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  mutedChannels?: Record<string, boolean>;
  setMutedChannels?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  soloedChannels?: Record<string, boolean>;
  setSoloedChannels?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  activeInstrumentId?: string;
  setActiveInstrumentId?: (id: string) => void;
  onOpenSampler?: (channelId: string) => void;
  onOpenPianoRoll?: (channelId: string) => void;
  onOpenWAM?: (channelId: string) => void;
}

const DEFAULT_CHANNELS: ChannelRow[] = [
  { id: "sampler_default", name: "Sampler", type: "sample", sampleId: "sampler_default_sample", mixerTarget: 0, instrumentType: "sampler" }
];

export function ChannelRack({
  channels = DEFAULT_CHANNELS,
  setChannels = () => { },
  channelMixers = {},
  setChannelMixers = () => { },
  channelPans = {},
  setChannelPans = () => { },
  channelVols = {},
  setChannelVols = () => { },
  mutedChannels = {},
  setMutedChannels = () => { },
  soloedChannels = {},
  setSoloedChannels = () => { },
  activeInstrumentId = "sampler_default",
  setActiveInstrumentId = () => { },
  onOpenSampler,
  onOpenPianoRoll,
  onOpenWAM,
}: ChannelRackProps) {
  const { theme: DARK, flat, raised, SPACE } = useTheme();

  const state = useChannelRackState({
    channels,
    setChannels,
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
    activeInstrumentId,
    setActiveInstrumentId,
    onOpenSampler,
    onOpenPianoRoll,
    onOpenWAM,
  });

  return (
    <div 
      ref={state.containerRef} 
      className="step-container"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: DARK.bg1,
        color: DARK.textMid,
        fontFamily: DARK.font,
        fontSize: "11px",
        userSelect: "none",
        position: "relative",
        boxSizing: "border-box",
        ...flat(DARK),
      }}
    >
      {/* 2. PATTERN SELECTOR HEADER */}
      <PatternHeader
        activePatternId={state.activePatternId}
        setActivePatternId={state.setActivePatternId}
        patterns={state.patterns}
        handleAddNewPattern={state.handleAddNewPattern}
        handleCloneActivePattern={state.handleCloneActivePattern}
        deletePattern={state.deletePattern}
        clearEvents={state.clearEvents}
      />

      {/* THE MAIN CHANNELS CONTAINER GRID */}
      <main 
        style={{
          flex: 1,
          overflowY: "auto",
          padding: `${SPACE.md}px`,
          backgroundColor: DARK.bg1,
          display: "flex",
          flexDirection: "column",
          gap: `${SPACE.xs}px`,
          boxSizing: "border-box",
        }}
      >
        {/* Playhead LED Bulbs Track Row */}
        <PlayheadLEDs containerRef={state.containerRef} />

        {/* 3. Render Channels Rows */}
        {channels.map((channel) => (
          <ChannelRowComponent
            key={channel.id}
            channel={channel}
            channels={channels}
            setChannels={setChannels}
            activeInstrumentId={activeInstrumentId}
            setActiveInstrumentId={setActiveInstrumentId}
            focusedChannelId={state.focusedChannelId}
            setFocusedChannelId={state.setFocusedChannelId}
            mutedChannels={mutedChannels}
            setMutedChannels={setMutedChannels}
            soloedChannels={soloedChannels}
            setSoloedChannels={setSoloedChannels}
            channelMixers={channelMixers}
            setChannelMixers={setChannelMixers}
            channelPans={channelPans}
            setChannelPans={setChannelPans}
            channelVols={channelVols}
            setChannelVols={setChannelVols}
            draggedChannelId={state.draggedChannelId}
            setDraggedChannelId={state.setDraggedChannelId}
            draggingOverChannelId={state.draggingOverChannelId}
            setDraggingOverChannelId={state.setDraggingOverChannelId}
            events={state.events}
            isStepActive={state.isStepActive}
            handleStepToggle={state.handleStepToggle}
            handleRightClick={state.handleRightClick}
            handleFileDrop={state.handleFileDrop}
            engine={state.engine}
            notifySampleLoaded={state.notifySampleLoaded}
            pushToHistory={state.pushToHistory}
            onOpenWAM={onOpenWAM}
            onOpenSampler={onOpenSampler}
            onOpenPianoRoll={onOpenPianoRoll}
          />
        ))}

        {/* Dynamic ADD CHANNEL button row with Overlay Dropdown */}
        <div style={{ paddingTop: `${SPACE.lg}px`, paddingLeft: `${SPACE.sm}px`, userSelect: "none", display: "flex", position: "relative" }}>
          <button
            ref={state.addChannelBtnRef}
            onClick={(e) => {
              e.stopPropagation();
              state.setAddDropdownOpen(!state.addDropdownOpen);
            }}
            style={{
              padding: `${SPACE.sm}px ${SPACE.lg}px`,
              backgroundColor: DARK.bg3,
              color: DARK.accentBlue,
              fontFamily: DARK.font,
              fontSize: "9px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              cursor: "pointer",
              border: "none",
              boxSizing: "border-box",
              ...raised(DARK),
            }}
            id="add-channel-btn"
          >
            + Add Channel
          </button>

          {state.addDropdownOpen && (
            <div
              ref={state.dropdownRef}
              style={{
                position: "fixed",
                visibility: "hidden",
                backgroundColor: DARK.bg2,
                ...flat(DARK),
                padding: "2px",
                width: "150px",
                zIndex: 50,
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                display: "flex",
                flexDirection: "column",
                boxSizing: "border-box",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div 
                style={{
                  padding: `${SPACE.xs}px ${SPACE.sm}px`,
                  fontSize: "8px",
                  color: DARK.textLo,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  borderBottom: `1px solid ${DARK.bevelDark}`,
                  marginBottom: "2px",
                  fontFamily: DARK.font,
                  fontWeight: "bold",
                }}
              >
                Select Instrument
              </div>
              {LOCAL_INSTRUMENTS.map((instrument) => {
                const color = instrument.type === "sampler" ? DARK.textMid : DARK.accentOrange;
                return (
                  <button
                    key={instrument.id}
                    type="button"
                    onClick={() => {
                      state.addChannelWithInstrument(instrument);
                      state.setAddDropdownOpen(false);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: `${SPACE.sm}px ${SPACE.md}px`,
                      backgroundColor: "transparent",
                      color: color,
                      border: "none",
                      cursor: "pointer",
                      fontFamily: DARK.font,
                      fontSize: "9px",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      boxSizing: "border-box",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = DARK.bg3;
                      e.currentTarget.style.color = DARK.textHi;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = color;
                    }}
                  >
                    {instrument.name}
                  </button>
                );
              })}
              <div style={{ height: "1px", backgroundColor: DARK.bevelDark, margin: "2px 0" }} />
              <div
                onMouseEnter={(e) => {
                  state.setMoreOpen(true);
                  state.fetchRemoteInstruments();
                  e.currentTarget.style.backgroundColor = DARK.bg3;
                  e.currentTarget.style.color = DARK.textHi;
                }}
                onMouseLeave={(e) => {
                  state.setMoreOpen(false);
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = DARK.textLo;
                }}
                style={{
                  position: "relative",
                  width: "100%",
                  textAlign: "left",
                  padding: `${SPACE.sm}px ${SPACE.md}px`,
                  backgroundColor: "transparent",
                  color: DARK.textLo,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: DARK.font,
                  fontSize: "9px",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  boxSizing: "border-box",
                }}
              >
                More ▶
                {state.moreOpen && (
                  <div
                    style={{
                      position: "absolute",
                      left: "100%",
                      top: 0,
                      width: "160px",
                      backgroundColor: DARK.bg2,
                      ...flat(DARK),
                      padding: "2px",
                      zIndex: 60,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                      display: "flex",
                      flexDirection: "column",
                      boxSizing: "border-box",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {state.remoteInstruments.length === 0 ? (
                      <div
                        style={{
                          padding: `${SPACE.sm}px ${SPACE.md}px`,
                          color: DARK.textLo,
                          fontFamily: DARK.font,
                          fontSize: "9px",
                          fontWeight: "bold",
                          textTransform: "uppercase",
                          boxSizing: "border-box",
                        }}
                      >
                        Loading...
                      </div>
                    ) : (
                      state.remoteInstruments.map((instrument) => {
                        const color = DARK.accentOrange;
                        return (
                          <button
                            key={instrument.id}
                            type="button"
                            onClick={() => {
                              state.addChannelWithInstrument(instrument);
                              state.setAddDropdownOpen(false);
                              state.setMoreOpen(false);
                            }}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              padding: `${SPACE.sm}px ${SPACE.md}px`,
                              backgroundColor: "transparent",
                              color: color,
                              border: "none",
                              cursor: "pointer",
                              fontFamily: DARK.font,
                              fontSize: "9px",
                              fontWeight: "bold",
                              textTransform: "uppercase",
                              boxSizing: "border-box",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = DARK.bg3;
                              e.currentTarget.style.color = DARK.textHi;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "transparent";
                              e.currentTarget.style.color = color;
                            }}
                          >
                            {instrument.name}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              <div style={{ height: "1px", backgroundColor: DARK.bevelDark, margin: "2px 0" }} />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmed = state.wamUrlInput.trim();
                  if (trimmed) {
                    state.addChannelWithInstrument({
                      id: `custom_${Date.now()}`,
                      name: "Custom WAM",
                      type: "wam",
                      url: trimmed,
                      description: "Custom WAM URL",
                    });
                    state.setWamUrlInput("");
                    state.setAddDropdownOpen(false);
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
                  value={state.wamUrlInput}
                  onChange={(e) => state.setWamUrlInput(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    backgroundColor: DARK.bg3,
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
                    backgroundColor: DARK.bg3,
                    color: DARK.accentBlue,
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
                    e.currentTarget.style.backgroundColor = DARK.bg4;
                    e.currentTarget.style.color = DARK.textHi;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = DARK.bg3;
                    e.currentTarget.style.color = DARK.accentBlue;
                  }}
                >
                  Load
                </button>
              </form>
            </div>
          )}
        </div>

      </main>

      {/* ABSOLUTE FLOATING CUSTOM RIGHT-CLICK CONTEXT MENU POPUP */}
      {state.contextMenu && state.contextMenu.visible && (
        <div
          style={{
            position: "absolute",
            backgroundColor: DARK.bg2,
            ...flat(DARK),
            padding: "2px",
            width: "150px",
            zIndex: 100,
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
            top: Math.max(0, Math.min(state.contextMenu.y, (state.containerRef.current?.clientHeight ?? 400) - 115)),
            left: Math.max(0, Math.min(state.contextMenu.x, (state.containerRef.current?.clientWidth ?? 800) - 180)),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              if (onOpenPianoRoll) {
                onOpenPianoRoll(state.contextMenu!.channelId);
              }
              setActiveInstrumentId(state.contextMenu!.channelId);
              state.setFocusedChannelId(state.contextMenu!.channelId);
              state.setContextMenu(null);
            }}
            style={{
              width: "100%",
              textAlign: "left",
              padding: `${SPACE.sm}px ${SPACE.md}px`,
              backgroundColor: "transparent",
              color: DARK.textMid,
              border: "none",
              cursor: "pointer",
              fontFamily: DARK.font,
              fontSize: "9px",
              fontWeight: "bold",
              textTransform: "uppercase",
              boxSizing: "border-box",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = DARK.bg3;
              e.currentTarget.style.color = DARK.textHi;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = DARK.textMid;
            }}
          >
            Send to Piano Roll
          </button>

          <button
            type="button"
            onClick={() => {
              const target = channels.find(c => c.id === state.contextMenu!.channelId);
              if (target) {
                state.clearChannelNotes(target);
              }
              state.setContextMenu(null);
            }}
            style={{
              width: "100%",
              textAlign: "left",
              padding: `${SPACE.sm}px ${SPACE.md}px`,
              backgroundColor: "transparent",
              color: DARK.textMid,
              border: "none",
              cursor: "pointer",
              fontFamily: DARK.font,
              fontSize: "9px",
              fontWeight: "bold",
              textTransform: "uppercase",
              boxSizing: "border-box",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = DARK.bg3;
              e.currentTarget.style.color = DARK.textHi;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = DARK.textMid;
            }}
          >
            Clear Steps
          </button>

          <div style={{ height: "1px", backgroundColor: DARK.bevelDark, margin: "2px 0" }} />

          <button
            type="button"
            onClick={() => {
              state.deleteChannelRow(state.contextMenu!.channelId);
              state.setContextMenu(null);
            }}
            style={{
              width: "100%",
              textAlign: "left",
              padding: `${SPACE.sm}px ${SPACE.md}px`,
              backgroundColor: "transparent",
              color: DARK.stateRed,
              border: "none",
              cursor: "pointer",
              fontFamily: DARK.font,
              fontSize: "9px",
              fontWeight: "bold",
              textTransform: "uppercase",
              boxSizing: "border-box",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = DARK.bg3;
              e.currentTarget.style.color = "#ffffff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = DARK.stateRed;
            }}
          >
            Delete Channel
          </button>
        </div>
      )}
    </div>
  );
}
