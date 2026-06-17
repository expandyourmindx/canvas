import React from "react";
import { CanvasClip } from "../../../types";
import { TrackLaneHeader } from "./TrackLaneHeader";
import { LiveGhostClips } from "./LiveGhostClips";
import { ArrangerClip } from "../../ArrangerClip";
import { LANE_HEIGHT_PX, CLIP_HEIGHT_PX, CLIP_TOP_OFFSET_PX } from "../../../config";

interface GhostClip {
  insertIndex: number;
  laneIndex: number;
  startBeat: number;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

interface TimelineGridProps {
  totalBeats: number;
  beatWidth: number;
  timelineWidth: number;
  activeSnapResolution: number | null;
  gridStyle: React.CSSProperties;
  listLanes: number[];
  laneStates: Record<number, { isMuted: boolean; isSoloed: boolean }>;
  setLaneMute: (laneIdx: number, isMuted: boolean) => void;
  setLaneSolo: (laneIdx: number, isSoloed: boolean) => void;
  setLaneCount: React.Dispatch<React.SetStateAction<number>>;

  activeTool: 'pencil' | 'pointer' | 'split';
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;

  canvasClips: CanvasClip[];
  placingClip: CanvasClip | null;
  ghostClips: GhostClip[];
  isRecording: boolean;
  engine: any;
  getRecordingStatus: () => any;

  lassoDivRef: React.RefObject<HTMLDivElement>;
  tracksContainerRef: React.RefObject<HTMLDivElement>;
  handleGridPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleGridPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleGridPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;

  selectedClipType: "pattern" | "sample" | null;
  selectedReferenceId: string;
  clipDurationBeats: number;
  clipCropStart: number;
  setSelectedClipType: (type: "pattern" | "sample" | null) => void;
  setSelectedReferenceId: (id: string) => void;
  setClipDurationBeats: (duration: number) => void;
  setClipCropStart: (crop: number) => void;
  updatePlacingClip: (clip: CanvasClip | null) => void;
  placingClipRef: React.MutableRefObject<CanvasClip | null>;
  placingPointerId: React.MutableRefObject<number | null>;

  patterns: any[];
  getSampleBufferWrapper: (id: string) => any;
  removeCanvasClip: (id: string) => void;
  handleClipSplit: (e: React.PointerEvent<HTMLDivElement>, clip: CanvasClip) => void;
  handleClipPointerDownWrapper: (e: React.PointerEvent<HTMLDivElement>, clip: CanvasClip) => void;
  handleClipPointerMove: any;
  handleClipPointerUp: any;
  handleClipDoubleClick: (clip: CanvasClip) => void;
  handleResizeDownWrapper: (e: React.PointerEvent<HTMLDivElement>, clip: CanvasClip, edge: "left" | "right") => void;
  handleResizeMove: any;
  handleResizeUpWrapper: any;
  handleResizeCancel: any;

  handleDropOnLane: (e: React.DragEvent<HTMLDivElement>, laneIdx: number) => Promise<void>;
  getClipMetadata: (type: "pattern" | "sample", refId: string) => { name: string; color: string };
  addCanvasClip: (clip: CanvasClip) => void;
  pushToHistory: (channels?: any[]) => void;

  DARK: any;
  SPACE: any;
}

export const TimelineGrid = React.memo(function TimelineGrid({
  totalBeats,
  beatWidth,
  timelineWidth,
  activeSnapResolution,
  gridStyle,
  listLanes,
  laneStates,
  setLaneMute,
  setLaneSolo,
  setLaneCount,
  activeTool,
  selectedIds,
  setSelectedIds,
  canvasClips,
  placingClip,
  ghostClips,
  isRecording,
  engine,
  getRecordingStatus,
  lassoDivRef,
  tracksContainerRef,
  handleGridPointerDown,
  handleGridPointerMove,
  handleGridPointerUp,
  selectedClipType,
  selectedReferenceId,
  clipDurationBeats,
  clipCropStart,
  setSelectedClipType,
  setSelectedReferenceId,
  setClipDurationBeats,
  setClipCropStart,
  updatePlacingClip,
  placingClipRef,
  placingPointerId,
  patterns,
  getSampleBufferWrapper,
  removeCanvasClip,
  handleClipSplit,
  handleClipPointerDownWrapper,
  handleClipPointerMove,
  handleClipPointerUp,
  handleClipDoubleClick,
  handleResizeDownWrapper,
  handleResizeMove,
  handleResizeUpWrapper,
  handleResizeCancel,
  handleDropOnLane,
  getClipMetadata,
  addCanvasClip,
  pushToHistory,
  DARK,
  SPACE
}: TimelineGridProps) {
  return (
    <div
      ref={tracksContainerRef}
      onPointerDown={handleGridPointerDown}
      onPointerMove={handleGridPointerMove}
      onPointerUp={handleGridPointerUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{ position: "relative", userSelect: "none" }}
    >
      {listLanes.map((laneIdx) => (
        <div
          key={laneIdx}
          style={{
            display: "flex",
            height: `${LANE_HEIGHT_PX}px`,
            position: "relative",
            alignItems: "center",
            borderBottom: `1px solid ${DARK.bevelDark}`,
            boxSizing: "border-box",
          }}
        >
          {/* Visual Lane Header Label */}
          <TrackLaneHeader
            laneIdx={laneIdx}
            laneStates={laneStates}
            setLaneMute={setLaneMute}
            setLaneSolo={setLaneSolo}
            DARK={DARK}
            SPACE={SPACE}
          />

          {/* Interactive grid track area */}
          <div
            className={activeTool === 'pencil' ? 'cursor-pencil' : ''}
            style={{
              ...gridStyle,
              flex: 1,
              position: "relative",
              height: "100%",
              backgroundColor: DARK.bg0,
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(e) => handleDropOnLane(e, laneIdx)}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              if (activeTool === 'pointer' || activeTool === 'split' || e.ctrlKey) return;
              if (!selectedClipType) return;

              e.stopPropagation();

              const rect = e.currentTarget.getBoundingClientRect();
              const offsetX = e.clientX - rect.left;
              const width = rect.width;
              const rawBeat = (offsetX / width) * totalBeats;
              const snap = activeSnapResolution;
              const snappedBeat = snap !== null
                ? Math.round(rawBeat / snap) * snap
                : rawBeat;

              const finalDuration = clipDurationBeats;

              if (snappedBeat >= 0 && snappedBeat + finalDuration <= totalBeats) {
                const meta = getClipMetadata(selectedClipType, selectedReferenceId);
                const tempClip: CanvasClip = {
                  id: `placing-clip-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
                  type: selectedClipType,
                  startBeat: snappedBeat,
                  duration: finalDuration,
                  laneIndex: laneIdx,
                  referenceId: selectedReferenceId,
                  name: meta.name,
                  color: meta.color,
                  cropStart: clipCropStart
                };
                updatePlacingClip(tempClip);
                placingPointerId.current = e.pointerId;
                e.currentTarget.setPointerCapture(e.pointerId);
              }
            }}
            onPointerMove={(e) => {
              if (placingPointerId.current === e.pointerId && placingClipRef.current) {
                e.stopPropagation();
                const container = tracksContainerRef.current;
                if (!container) return;

                const rect = container.getBoundingClientRect();
                const trackX = e.clientX - rect.left - 130;
                const rawBeat = trackX / beatWidth;
                const snap = activeSnapResolution;
                const snappedBeat = snap !== null
                  ? Math.round(rawBeat / snap) * snap
                  : rawBeat;

                const trackY = e.clientY - rect.top;
                const calculatedLane = Math.floor(trackY / LANE_HEIGHT_PX);

                const finalLane = Math.max(0, Math.min(listLanes.length - 1, calculatedLane));
                const finalBeat = Math.max(0, Math.min(totalBeats - placingClipRef.current.duration, snappedBeat));

                if (placingClipRef.current.laneIndex !== finalLane || placingClipRef.current.startBeat !== finalBeat) {
                  const updated = {
                    ...placingClipRef.current,
                    startBeat: finalBeat,
                    laneIndex: finalLane
                  };
                  updatePlacingClip(updated);
                }
              }
            }}
            onPointerUp={(e) => {
              if (placingPointerId.current === e.pointerId) {
                e.stopPropagation();
                const clipToPlace = placingClipRef.current;
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch (err) {
                  console.error("Failed to release pointer capture:", err);
                }

                if (clipToPlace) {
                  addCanvasClip(clipToPlace);
                  pushToHistory();

                  // Select the newly placed clip exclusively
                  setSelectedIds([clipToPlace.id]);

                  // Load properties into pencil tool for the next placement
                  setSelectedClipType(clipToPlace.type);
                  setSelectedReferenceId(clipToPlace.referenceId);
                  setClipDurationBeats(clipToPlace.duration);
                  setClipCropStart(clipToPlace.cropStart || 0);
                }

                updatePlacingClip(null);
                placingPointerId.current = null;
              }
            }}
            onLostPointerCapture={(e) => {
              if (placingPointerId.current === e.pointerId) {
                updatePlacingClip(null);
                placingPointerId.current = null;
              }
            }}
          />
        </div>
      ))}

      {/* Flat absolute overlay for clips */}
      <div
        style={{
          position: "absolute",
          left: "130px",
          right: 0,
          top: 0,
          bottom: 0,
          pointerEvents: "none",
          zIndex: 10,
          width: `${timelineWidth}px`,
        }}
      >
        {canvasClips.map((clip) => {
          const isSelected = selectedIds.includes(clip.id);

          return (
            <ArrangerClip
              key={clip.id}
              clip={clip}
              beatWidth={beatWidth}
              isSelected={isSelected}
              activeTool={activeTool}
              patterns={patterns}
              getSampleBuffer={getSampleBufferWrapper}
              removeCanvasClip={removeCanvasClip}
              handleClipSplit={handleClipSplit}
              handleClipPointerDown={handleClipPointerDownWrapper}
              handleClipPointerMove={handleClipPointerMove}
              handleClipPointerUp={handleClipPointerUp}
              handleClipDoubleClick={handleClipDoubleClick}
              handleResizeDown={handleResizeDownWrapper}
              handleResizeMove={handleResizeMove}
              handleResizeUp={handleResizeUpWrapper}
              handleResizeCancel={handleResizeCancel}
            />
          );
        })}

        {/* Render the ghost clip in a slightly transparent state */}
        {placingClip && (
          <div style={{ opacity: 0.8, pointerEvents: "none", userSelect: "none" }}>
            <ArrangerClip
              clip={placingClip}
              beatWidth={beatWidth}
              isSelected={false}
              activeTool="pencil"
              patterns={patterns}
              getSampleBuffer={getSampleBufferWrapper}
              removeCanvasClip={() => {}}
              handleClipSplit={() => {}}
              handleClipPointerDown={() => {}}
              handleClipPointerMove={() => {}}
              handleClipPointerUp={() => {}}
              handleClipDoubleClick={() => {}}
              handleResizeDown={() => {}}
              handleResizeMove={() => {}}
              handleResizeUp={() => {}}
              handleResizeCancel={() => {}}
            />
          </div>
        )}

        {/* ── PART 4: Recording ghost clips (live waveform) ── */}
        <LiveGhostClips
          ghostClips={ghostClips}
          beatWidth={beatWidth}
          engine={engine}
          getRecordingStatus={getRecordingStatus}
          isRecording={isRecording}
        />
      </div>

      {/* Sticky Add Lane row */}
      <div style={{ display: "flex", height: `${LANE_HEIGHT_PX}px`, position: "relative", alignItems: "center" }}>
        <div
          style={{
            width: "130px",
            flexShrink: 0,
            textAlign: "left",
            paddingLeft: `${SPACE.sm}px`,
            display: "flex",
            alignItems: "center",
            height: "100%",
            zIndex: 30,
            backgroundColor: DARK.bg2,
            position: "sticky",
            left: 0,
            borderRight: `1px solid ${DARK.bevelDark}`,
            boxSizing: "border-box",
          }}
        >
          <button
            onClick={() => setLaneCount((prev) => prev + 1)}
            style={{
              width: "100%",
              marginRight: `${SPACE.sm}px`,
              padding: `${SPACE.xs}px ${SPACE.sm}px`,
              backgroundColor: DARK.bg3,
              color: DARK.textMid,
              fontFamily: DARK.font,
              fontSize: "8px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              cursor: "pointer",
              border: `1px dashed ${DARK.bevelMid}`,
              boxSizing: "border-box",
            }}
            title="Add Lane"
          >
            + Add Lane
          </button>
        </div>
        <div style={{ flex: 1, height: "100%", backgroundColor: "transparent", pointerEvents: "none" }} />
      </div>

      <div
        ref={lassoDivRef}
        style={{
          position: "absolute",
          border: `1px dashed ${DARK.accentBlue}`,
          backgroundColor: "rgba(79, 195, 247, 0.1)",
          pointerEvents: "none",
          zIndex: 50,
          display: "none",
        }}
      />
    </div>
  );
});
