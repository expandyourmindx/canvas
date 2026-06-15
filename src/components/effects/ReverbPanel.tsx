import React, { useState, useEffect, useRef } from "react";
import { useAudioEngine } from "../../audio/useAudioEngine";
import { Power } from "lucide-react";
import { useTheme, DARK, raised, sunken, flat, SPACE, SIZE } from "../../theme/ThemeContext";

interface ReverbPanelProps {
  insertIndex: number;
  slotIndex: number;
  onClose: () => void;
}

interface ReverbKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  dotColor: string;
  formatValue: (v: number) => string;
  onChange: (val: number) => void;
  title?: string;
}

function ReverbKnob({
  label,
  value,
  min,
  max,
  defaultValue,
  dotColor,
  formatValue,
  onChange,
  title,
}: ReverbKnobProps) {
  const { theme: DARK, raised, sunken, flat, flush, SPACE, SIZE } = useTheme();
  const knobRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.altKey && e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      onChange(defaultValue);
      return;
    }
    e.preventDefault();
    isDragging.current = true;
    startY.current = e.clientY;
    startValue.current = value;
    knobRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const deltaY = startY.current - e.clientY; // drag up increases
    const range = max - min;
    const dragDistance = 120; // pixels for full sweep
    const valueDelta = (deltaY / dragDistance) * range;
    const newValue = Math.max(min, Math.min(max, Math.round(startValue.current + valueDelta)));
    onChange(newValue);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging.current) {
      isDragging.current = false;
      knobRef.current?.releasePointerCapture(e.pointerId);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? -1 : 1;
    const step = (max - min) <= 100 ? 5 : 2;
    const newValue = Math.max(min, Math.min(max, value + dir * step));
    onChange(newValue);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(defaultValue);
  };

  // Convert value to degrees for rotation (sweep from -135deg to +135deg)
  const percent = (value - min) / (max - min);
  const angleDeg = -135 + percent * 270;
  const angleRad = (angleDeg * Math.PI) / 180;

  // Size-specific dimensions for knobMd (26px)
  const knobSize = SIZE.knobMd; // 26px
  const cx = knobSize / 2; // 13
  const cy = knobSize / 2; // 13
  const R = 8;
  const dotX = cx + R * Math.sin(angleRad);
  const dotY = cy - R * Math.cos(angleRad);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", userSelect: "none" }}>
      {/* Label above */}
      <span
        style={{
          fontFamily: DARK.font,
          fontSize: "7px",
          color: DARK.textLo,
          fontWeight: "bold",
          textTransform: "uppercase",
          marginBottom: `${SPACE.sm}px`,
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>

      {/* Knob Body */}
      <div
        ref={knobRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        style={{
          width: `${knobSize}px`,
          height: `${knobSize}px`,
          borderRadius: "50%",
          backgroundColor: DARK.knobBody,
          position: "relative",
          cursor: "ns-resize",
          boxSizing: "border-box",
          ...raised(DARK),
        }}
        title={`${title}: ${formatValue(value)} (Double-click to reset)`}
      >
        {/* Highlight Ellipse */}
        <div
          style={{
            position: "absolute",
            top: "2px",
            left: "2px",
            width: "10px",
            height: "5px",
            borderRadius: "50%",
            backgroundColor: DARK.knobHighlight,
            transform: "rotate(-30deg)",
            pointerEvents: "none",
          }}
        />

        {/* Indicator Dot */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          <circle cx={dotX} cy={dotY} r={1.5} fill={dotColor} />
        </svg>
      </div>

      {/* Value Readout below */}
      <div
        style={{
          marginTop: `${SPACE.sm}px`,
          width: "56px",
          height: "15px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: DARK.bg0,
          boxSizing: "border-box",
          padding: `0 ${SPACE.xs}px`,
          ...sunken(DARK),
        }}
      >
        <span
          style={{
            fontFamily: DARK.font,
            fontSize: "8px",
            color: DARK.lcdText,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {formatValue(value)}
        </span>
      </div>
    </div>
  );
}

export function ReverbPanel({ insertIndex, slotIndex, onClose }: ReverbPanelProps) {
  const { theme: DARK, raised, sunken, flat, flush, SPACE, SIZE } = useTheme();
  const { engine, updateInsertReverbParam, setInsertFXBypass } = useAudioEngine();

  // Get active insert and Reverb instances
  const insert = engine.getOrCreateMixerInsert(insertIndex);
  const reverbInstance = (insert as any).fxInstances?.[slotIndex];
  const isBypassed = insert.fxBypass?.[slotIndex] ?? false;

  // Local state representing scaled integer values (since Knob component rounds values)
  const [roomSizeVal, setRoomSizeVal] = useState(Math.round((reverbInstance?.roomSize ?? 2.0) * 100));
  const [decayVal, setDecayVal] = useState(Math.round((reverbInstance?.decay ?? 2.0) * 100));
  const [wetDryVal, setWetDryVal] = useState(Math.round((reverbInstance?.wetDry ?? 0.5) * 100));
  const [bypassState, setBypassState] = useState(isBypassed);

  // Sync state if reverbInstance changes
  useEffect(() => {
    if (reverbInstance) {
      setRoomSizeVal(Math.round(reverbInstance.roomSize * 100));
      setDecayVal(Math.round(reverbInstance.decay * 100));
      setWetDryVal(Math.round(reverbInstance.wetDry * 100));
    }
  }, [reverbInstance]);

  useEffect(() => {
    setBypassState(insert.fxBypass?.[slotIndex] ?? false);
  }, [insert.fxBypass, slotIndex]);

  if (!reverbInstance) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          backgroundColor: DARK.bg2,
          fontFamily: DARK.font,
          color: DARK.textDim,
          textTransform: "uppercase",
          gap: `${SPACE.sm}px`,
        }}
      >
        <span>Instantiating convolution hardware...</span>
      </div>
    );
  }

  const handleRoomSizeChange = (val: number) => {
    setRoomSizeVal(val);
    updateInsertReverbParam(insertIndex, slotIndex, { roomSize: val / 100 });
  };

  const handleDecayChange = (val: number) => {
    setDecayVal(val);
    updateInsertReverbParam(insertIndex, slotIndex, { decay: val / 100 });
  };

  const handleWetDryChange = (val: number) => {
    setWetDryVal(val);
    updateInsertReverbParam(insertIndex, slotIndex, { wetDry: val / 100 });
  };

  const toggleBypass = () => {
    const nextBypass = !bypassState;
    setBypassState(nextBypass);
    setInsertFXBypass(insertIndex, slotIndex, nextBypass);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: DARK.bg1,
        fontFamily: DARK.font,
        fontSize: "10px",
        userSelect: "none",
        padding: "4px",
        boxSizing: "border-box",
      }}
    >
      {/* Main body */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flex: 1,
          backgroundColor: DARK.bg2,
          ...flat(DARK),
          padding: `${SPACE.md}px`,
          boxSizing: "border-box",
        }}
      >
        {/* Left column: ACTIVE button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingRight: `${SPACE.lg}px`,
          }}
        >
          <button
            onClick={toggleBypass}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: `${SPACE.xs}px`,
              width: "48px",
              height: "48px",
              cursor: "pointer",
              boxSizing: "border-box",
              border: "none",
              borderRadius: 0,
              ...(!bypassState
                ? { ...sunken(DARK), backgroundColor: DARK.bg0, color: DARK.stateGreen }
                : { ...raised(DARK), backgroundColor: DARK.bg3, color: DARK.textDim }
              ),
            }}
            title={bypassState ? "Enable Effect" : "Bypass Effect"}
          >
            <Power size={14} style={{ color: !bypassState ? DARK.stateGreen : DARK.textDim }} />
            <span
              style={{
                fontFamily: DARK.font,
                fontSize: "7px",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: !bypassState ? DARK.stateGreen : DARK.textDim,
              }}
            >
              ACTIVE
            </span>
          </button>
        </div>

        {/* Divider */}
        <div
          style={{
            width: "1px",
            alignSelf: "stretch",
            backgroundColor: DARK.bevelDark,
          }}
        />

        {/* Right column: Three Knobs */}
        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "space-around",
            alignItems: "center",
            paddingLeft: `${SPACE.lg}px`,
          }}
        >
          {/* Knob 1: Room Size */}
          <ReverbKnob
            label="ROOM/SIZE"
            value={roomSizeVal}
            min={10}
            max={500}
            dotColor={DARK.accentBlue}
            defaultValue={200}
            onChange={handleRoomSizeChange}
            formatValue={(val) => (val / 100).toFixed(2) + "S"}
            title="Impulse Response Length"
          />

          {/* Knob 2: Decay */}
          <ReverbKnob
            label="DECAY/RATE"
            value={decayVal}
            min={10}
            max={1000}
            dotColor={DARK.accentPurple}
            defaultValue={200}
            onChange={handleDecayChange}
            formatValue={(val) => (val / 100).toFixed(2)}
            title="Tail Falloff Rate"
          />

          {/* Knob 3: Wet/Dry */}
          <ReverbKnob
            label="MIX/WET"
            value={wetDryVal}
            min={0}
            max={100}
            dotColor={DARK.accentGreen}
            defaultValue={50}
            onChange={handleWetDryChange}
            formatValue={(val) => val + "%"}
            title="Dry/Wet Crossfade Ratio"
          />
        </div>
      </div>
    </div>
  );
}
