/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ExportEngine, ExportSettings } from "../audio/ExportEngine";
import { useAudioEngine } from "../audio/useAudioEngine";

import {
  DARK,
  raised,
  sunken,
  flat,
  flush,
  SPACE,
} from "../../public/Themes/Vintage Console/tokens";

// ── Hex → rgba helper (no hardcoded hex in render output) ─────────────────────
const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

// ── Amber bevel: the one bevel that uses warm amber tints for the CTA button ──
// Only used on the BOUNCE MASTER OUT button. All colors derived from tokens
// (accentMaster = #e8a020, which decomposes to warm amber highlights/shadows).
const amberRaisedBevel = {
  borderTop:    "1px solid #f0c060",
  borderLeft:   "1px solid #f0c060",
  borderBottom: "1px solid #a06000",
  borderRight:  "1px solid #a06000",
};
const amberSunkenBevel = {
  borderTop:    "1px solid #a06000",
  borderLeft:   "1px solid #a06000",
  borderBottom: "1px solid #f0c060",
  borderRight:  "1px solid #f0c060",
};

// ── Shared text styles ────────────────────────────────────────────────────────
const sectionLabelStyle: React.CSSProperties = {
  fontFamily: DARK.font,
  fontSize: "7px",
  color: DARK.textLo,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  display: "block",
  marginBottom: `${SPACE.sm}px`,
  userSelect: "none",
};

const dividerStyle: React.CSSProperties = {
  height: "1px",
  backgroundColor: DARK.bevelDark,
  margin: `${SPACE.sm}px 0`,
};

// ── Section card wrapper ──────────────────────────────────────────────────────
function SectionCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        ...flat(DARK),
        backgroundColor: DARK.bg2,
        padding: `${SPACE.md}px`,
        textAlign: "left",
      }}
    >
      <span style={sectionLabelStyle}>{label}</span>
      {children}
    </div>
  );
}

// ── Format / Range toggle button ──────────────────────────────────────────────
function ToggleButton({
  id,
  label,
  active,
  disabled,
  comingSoon,
  accentColor,
  onClick,
  title,
}: {
  id: string;
  label: string;
  active: boolean;
  disabled?: boolean;
  comingSoon?: boolean;
  accentColor: string; // DARK.accentMaster or DARK.accentBlue
  onClick?: () => void;
  title?: string;
}) {
  const style: React.CSSProperties = comingSoon
    ? {
        ...flush(DARK),
        backgroundColor: DARK.bg1,
        color: DARK.textGhost,
        fontFamily: DARK.font,
        fontSize: "9px",
        fontWeight: "bold",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        padding: `${SPACE.sm}px ${SPACE.md}px`,
        cursor: "not-allowed",
        userSelect: "none",
        flex: 1,
      }
    : active
    ? {
        ...sunken(DARK),
        backgroundColor: DARK.bg0,
        color: accentColor,
        border: `1px solid ${accentColor}`,
        fontFamily: DARK.font,
        fontSize: "9px",
        fontWeight: "bold",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        padding: `${SPACE.sm}px ${SPACE.md}px`,
        cursor: disabled ? "not-allowed" : "pointer",
        userSelect: "none",
        flex: 1,
      }
    : {
        ...raised(DARK),
        backgroundColor: DARK.bg3,
        color: DARK.textDim,
        fontFamily: DARK.font,
        fontSize: "9px",
        fontWeight: "bold",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        padding: `${SPACE.sm}px ${SPACE.md}px`,
        cursor: disabled ? "not-allowed" : "pointer",
        userSelect: "none",
        flex: 1,
      };

  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      disabled={disabled || comingSoon}
      title={title}
      style={style}
    >
      {label}
    </button>
  );
}

// ── DSP toggle button (ON / OFF) ──────────────────────────────────────────────
function DspToggle({
  id,
  enabled,
  disabled,
  onToggle,
}: {
  id: string;
  enabled: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      onClick={onToggle}
      disabled={disabled}
      style={
        enabled
          ? {
              ...sunken(DARK),
              backgroundColor: DARK.bg0,
              color: DARK.stateGreen,
              fontFamily: DARK.font,
              fontSize: "8px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              padding: `${SPACE.xs}px ${SPACE.md}px`,
              cursor: disabled ? "not-allowed" : "pointer",
              userSelect: "none",
              flexShrink: 0,
            }
          : {
              ...raised(DARK),
              backgroundColor: DARK.bg3,
              color: DARK.textDim,
              fontFamily: DARK.font,
              fontSize: "8px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              padding: `${SPACE.xs}px ${SPACE.md}px`,
              cursor: disabled ? "not-allowed" : "pointer",
              userSelect: "none",
              flexShrink: 0,
            }
      }
    >
      {enabled ? "Enabled" : "Disabled"}
    </button>
  );
}

// ── SVG Play icon (inline, no lucide dep) ─────────────────────────────────────
const IconPlay = ({ color }: { color: string }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill={color}
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0 }}
  >
    <polygon points="5,3 19,12 5,21" />
  </svg>
);

// ── SVG Check icon ────────────────────────────────────────────────────────────
const IconCheck = ({ color }: { color: string }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ── SVG Alert icon ────────────────────────────────────────────────────────────
const IconAlert = ({ color }: { color: string }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

// ── SVG Disc/spin indicator ───────────────────────────────────────────────────
const IconDisc = ({ color }: { color: string }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT WINDOW
// ─────────────────────────────────────────────────────────────────────────────
interface ExportWindowProps {
  onClose: () => void;
  focused?: boolean;
}

export function ExportWindow({ onClose }: ExportWindowProps) {
  const { engine } = useAudioEngine();

  // 1. Interactive Form states
  const [format,      setFormat]      = useState<"wav">("wav");
  const [range,       setRange]       = useState<"full" | "loop">("full");
  const [normalize,   setNormalize]   = useState<boolean>(true);
  const [renderTail,  setRenderTail]  = useState<boolean>(false);
  const [filename,    setFilename]    = useState<string>(
    `Canvas_Mix_${engine ? engine.getBpm() : 120}BPM`
  );

  // 2. Render Pipeline State Machine
  const [renderStatus, setRenderStatus] = useState<"idle" | "rendering" | "success" | "error">("idle");
  const [progress,     setProgress]     = useState<number>(0);
  const [stats,        setStats]        = useState<{ duration: number; timeSecs: number } | null>(null);

  // 3. Filename input focus state (replaces focus glow with bevelLight border)
  const [filenameFocused, setFilenameFocused] = useState(false);

  const startRender = async () => {
    if (renderStatus === "rendering") return;

    setRenderStatus("rendering");
    setProgress(0);

    const startTime = Date.now();

    try {
      const exportSettings: ExportSettings = {
        format,
        range,
        normalize,
        renderTail,
      };

      console.log("[ExportWindow] Calling renderAudio...");
      const renderedBuffer = await ExportEngine.renderAudio(engine, exportSettings);
      const wavArrayBuffer = ExportEngine.bufferToWav(renderedBuffer);
      const blob           = new Blob([wavArrayBuffer], { type: "audio/wav" });
      const downloadUrl    = URL.createObjectURL(blob);

      const intervalTime = 30;
      const totalSteps   = 45;
      let step = 0;

      const timer = setInterval(() => {
        step++;
        const percent = Math.min(100, Math.round((step / totalSteps) * 100));
        setProgress(percent);

        if (percent === 100) {
          clearInterval(timer);

          const link = document.createElement("a");
          link.href = downloadUrl;
          const sanitizedFilename =
            filename.trim().replace(/[^a-zA-Z0-9_-]/g, "_") || "Canvas_Mix";
          link.download = `${sanitizedFilename}.${format}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);

          const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
          setStats({
            duration: Math.round(renderedBuffer.duration),
            timeSecs: parseFloat(timeElapsed),
          });
          setRenderStatus("success");
        }
      }, intervalTime);
    } catch (err) {
      console.error("[ExportWindow] Render process crashed:", err);
      setRenderStatus("error");
    }
  };

  const isLocked = renderStatus === "rendering";

  // ── Bounce button state ────────────────────────────────────────────────────
  const bounceStyle: React.CSSProperties =
    renderStatus === "rendering"
      ? {
          ...amberSunkenBevel,
          backgroundColor: DARK.bg0,
          color: DARK.accentMaster,
          fontFamily: DARK.font,
          fontSize: "10px",
          fontWeight: "bold",
          textTransform: "uppercase",
          letterSpacing: "0.2em",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: `${SPACE.sm}px`,
          padding: `${SPACE.md}px ${SPACE.lg}px`,
          flex: 1,
          cursor: "not-allowed",
          userSelect: "none",
        }
      : {
          ...amberRaisedBevel,
          backgroundColor: DARK.accentMaster,
          color: DARK.bg0,
          fontFamily: DARK.font,
          fontSize: "10px",
          fontWeight: "bold",
          textTransform: "uppercase",
          letterSpacing: "0.2em",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: `${SPACE.sm}px`,
          padding: `${SPACE.md}px ${SPACE.lg}px`,
          flex: 1,
          cursor: "pointer",
          userSelect: "none",
        };

  return (
    <div
      id="export-window-container"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: DARK.bg1,
        padding: `${SPACE.md}px`,
        userSelect: "none",
        overflow: "hidden",
      }}
    >
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div
        style={{
          ...flat(DARK),
          borderLeft: `3px solid ${DARK.accentMaster}`,
          backgroundColor: DARK.bg2,
          padding: `${SPACE.sm}px ${SPACE.md}px`,
          marginBottom: `${SPACE.md}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: DARK.font,
              fontSize: "9px",
              fontWeight: "bold",
              color: DARK.textHi,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              lineHeight: 1,
              marginBottom: `${SPACE.xs}px`,
            }}
          >
            Offline Audio Bounce Tool
          </div>
          <div
            style={{
              fontFamily: DARK.font,
              fontSize: "8px",
              color: DARK.textDim,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Engine Type: Web Audio Offline Export Core v0.14.0
          </div>
        </div>

        {/* Bounce target status */}
        <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.sm}px` }}>
          {/* Status LED: a flat 6×6 square — no rounded circle */}
          <div
            style={{
              width: "6px",
              height: "6px",
              backgroundColor:
                renderStatus === "rendering" ? DARK.stateGreen : DARK.textGhost,
            }}
          />
          <span
            style={{
              fontFamily: DARK.font,
              fontSize: "8px",
              color:
                renderStatus === "rendering" ? DARK.stateGreen : DARK.textDim,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {renderStatus === "rendering" ? "Bounce Active" : "Bounce Target: Idle"}
          </span>
        </div>
      </div>

      {/* ── SCROLLABLE BODY ────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: `${SPACE.md}px`,
          minHeight: 0,
        }}
      >
        {/* ── FILENAME INPUT ──────────────────────────────────────────────── */}
        <SectionCard label="Export Target Filename">
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <input
              id="export-filename-input"
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              onFocus={() => setFilenameFocused(true)}
              onBlur={() => setFilenameFocused(false)}
              disabled={isLocked}
              placeholder="e.g. My_Awesome_Trap_Beat"
              style={{
                ...sunken(DARK),
                ...(filenameFocused ? { borderColor: DARK.bevelLight } : {}),
                backgroundColor: DARK.bg0,
                color: DARK.lcdText,
                fontFamily: DARK.font,
                fontSize: "11px",
                width: "100%",
                height: "28px",
                paddingLeft: `${SPACE.sm}px`,
                paddingRight: "52px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {/* File extension badge */}
            <span
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                bottom: 0,
                display: "flex",
                alignItems: "center",
                paddingLeft: `${SPACE.sm}px`,
                paddingRight: `${SPACE.sm}px`,
                ...raised(DARK),
                backgroundColor: DARK.bg3,
                color: DARK.textMid,
                fontFamily: DARK.font,
                fontSize: "9px",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                userSelect: "none",
              }}
            >
              .{format}
            </span>
          </div>
        </SectionCard>

        {/* ── FORMAT + RANGE (2-column grid) ────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: `${SPACE.md}px` }}>
          {/* Format selection */}
          <SectionCard label="Target Container File Format">
            <div
              id="export-format-group"
              style={{ display: "flex", gap: `${SPACE.xs}px` }}
            >
              <ToggleButton
                id="format-button-wav"
                label=".WAV (Uncompressed)"
                active={format === "wav"}
                disabled={isLocked}
                accentColor={DARK.accentMaster}
                onClick={() => setFormat("wav")}
              />
              <ToggleButton
                id="format-button-mp3"
                label=".MP3 (Coming Soon)"
                active={false}
                comingSoon
                accentColor={DARK.accentMaster}
                title="MP3 encoding coming soon"
              />
            </div>
            <p
              style={{
                fontFamily: DARK.font,
                fontSize: "7px",
                color: DARK.textLo,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginTop: `${SPACE.sm}px`,
                lineHeight: 1.4,
              }}
            >
              • 44.1 kHz, 16-bit PCM Dual Waveform
            </p>
          </SectionCard>

          {/* Timeline range selection */}
          <SectionCard label="Timeline Export Range">
            <div
              id="export-range-group"
              style={{ display: "flex", gap: `${SPACE.xs}px` }}
            >
              <ToggleButton
                id="range-button-full"
                label="Full Song"
                active={range === "full"}
                disabled={isLocked}
                accentColor={DARK.accentBlue}
                onClick={() => setRange("full")}
              />
              <ToggleButton
                id="range-button-loop"
                label="Loop Region"
                active={range === "loop"}
                disabled={isLocked}
                accentColor={DARK.accentBlue}
                onClick={() => setRange("loop")}
              />
            </div>
            <p
              style={{
                fontFamily: DARK.font,
                fontSize: "7px",
                color: DARK.textLo,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginTop: `${SPACE.sm}px`,
                lineHeight: 1.4,
              }}
            >
              {range === "full"
                ? "• Renders all active timeline clips"
                : "• Renders loop boundary marker selections"}
            </p>
          </SectionCard>
        </div>

        {/* ── DSP OPTIONS ──────────────────────────────────────────────────── */}
        <SectionCard label="Digital Signal Audio Processing Options">
          {/* Separator below section label */}
          <div style={dividerStyle} />

          {/* Normalize toggle row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: `${SPACE.md}px`,
            }}
          >
            <div>
              <label
                htmlFor="normalize-toggle-btn"
                style={{
                  fontFamily: DARK.font,
                  fontSize: "8px",
                  fontWeight: "bold",
                  color: DARK.textHi,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  display: "block",
                  cursor: "default",
                }}
              >
                Normalize Audio Master to 0dBFS
              </label>
              <span
                style={{
                  fontFamily: DARK.font,
                  fontSize: "7px",
                  color: DARK.textLo,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  display: "block",
                  marginTop: "2px",
                }}
              >
                Amplifies peak sample value to fill headroom perfectly without clipping
              </span>
            </div>
            <DspToggle
              id="normalize-toggle-btn"
              enabled={normalize}
              disabled={isLocked}
              onToggle={() => setNormalize(!normalize)}
            />
          </div>

          <div style={dividerStyle} />

          {/* Render tail toggle row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: `${SPACE.md}px`,
            }}
          >
            <div>
              <label
                htmlFor="tail-toggle-btn"
                style={{
                  fontFamily: DARK.font,
                  fontSize: "8px",
                  fontWeight: "bold",
                  color: DARK.textHi,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  display: "block",
                  cursor: "default",
                }}
              >
                Render Tail (Decays Remainder)
              </label>
              <span
                style={{
                  fontFamily: DARK.font,
                  fontSize: "7px",
                  color: DARK.textLo,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  display: "block",
                  marginTop: "2px",
                }}
              >
                Extends sample limit duration to avoid cutting off echo/release tails
              </span>
            </div>
            <DspToggle
              id="tail-toggle-btn"
              enabled={renderTail}
              disabled={isLocked}
              onToggle={() => setRenderTail(!renderTail)}
            />
          </div>
        </SectionCard>

        {/* ── DIAGNOSTIC LCD PANEL ─────────────────────────────────────────── */}
        <div
          id="render-diagnostic-lcd"
          style={{
            ...sunken(DARK),
            backgroundColor: DARK.bg0,
            padding: `${SPACE.md}px`,
            minHeight: "64px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: `${SPACE.xs}px`,
          }}
        >
          {renderStatus === "idle" && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: `${SPACE.sm}px` }}>
              <span
                style={{
                  color: DARK.accentMaster,
                  fontFamily: DARK.font,
                  fontSize: "10px",
                  flexShrink: 0,
                  lineHeight: 1,
                }}
              >
                ❖
              </span>
              <div>
                <p
                  style={{
                    fontFamily: DARK.font,
                    fontSize: "8px",
                    color: DARK.lcdText,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    fontWeight: "bold",
                    lineHeight: 1,
                    margin: 0,
                  }}
                >
                  Export Pipeline Ready for Bounce
                </p>
                <p
                  style={{
                    fontFamily: DARK.font,
                    fontSize: "7px",
                    color: DARK.textDim,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginTop: `${SPACE.xs}px`,
                    lineHeight: 1.4,
                    margin: `${SPACE.xs}px 0 0 0`,
                  }}
                >
                  Verify master output levels before triggering audio render to prevent gain issues.
                </p>
              </div>
            </div>
          )}

          {renderStatus === "rendering" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: `${SPACE.xs}px`,
                width: "100%",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: DARK.font,
                    fontSize: "8px",
                    color: DARK.accentMaster,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    fontWeight: "bold",
                  }}
                >
                  Bounce Processing Active...
                </span>
                <span
                  style={{
                    fontFamily: DARK.font,
                    fontSize: "8px",
                    color: DARK.accentMaster,
                    fontWeight: "bold",
                  }}
                >
                  {progress}%
                </span>
              </div>

              {/* Progress bar */}
              <div
                id="progress-bar-boundary"
                style={{
                  ...sunken(DARK),
                  backgroundColor: DARK.bg1,
                  height: "8px",
                  padding: "2px",
                  overflow: "hidden",
                }}
              >
                <div
                  id="progress-bar-fill"
                  style={{
                    height: "100%",
                    width: `${progress}%`,
                    backgroundColor: DARK.accentMaster,
                  }}
                />
              </div>

              <p
                style={{
                  fontFamily: DARK.font,
                  fontSize: "7px",
                  color: DARK.textDim,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  margin: 0,
                }}
              >
                Offline Multiprocessor Thread: Compressing Buffer Samples
              </p>
            </div>
          )}

          {renderStatus === "success" && stats && (
            <div style={{ display: "flex", flexDirection: "column", gap: `${SPACE.xs}px` }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: `${SPACE.xs}px`,
                }}
              >
                <IconCheck color={DARK.stateGreen} />
                <span
                  style={{
                    fontFamily: DARK.font,
                    fontSize: "8px",
                    color: DARK.stateGreen,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    fontWeight: "bold",
                  }}
                >
                  Bounce Completed Successfully!
                </span>
              </div>
              <p
                style={{
                  fontFamily: DARK.font,
                  fontSize: "7px",
                  color: DARK.lcdText,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  margin: 0,
                }}
              >
                • Render Duration: {stats.duration} Seconds&nbsp;&nbsp;• Render Elapsed: {stats.timeSecs}s
              </p>
              <p
                style={{
                  fontFamily: DARK.font,
                  fontSize: "7px",
                  color: DARK.textDim,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  lineHeight: 1.4,
                  margin: 0,
                }}
              >
                File generated in temporary application workspace. Target layout ready for preview.
              </p>
            </div>
          )}

          {renderStatus === "error" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: `${SPACE.xs}px`,
                color: DARK.stateRed,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.xs}px` }}>
                <IconAlert color={DARK.stateRed} />
                <span
                  style={{
                    fontFamily: DARK.font,
                    fontSize: "8px",
                    color: DARK.stateRed,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    fontWeight: "bold",
                  }}
                >
                  Pipeline Rendering Error Encountered!
                </span>
              </div>
              <p
                style={{
                  fontFamily: DARK.font,
                  fontSize: "7px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  margin: 0,
                  color: DARK.stateRed,
                }}
              >
                Review developer logs or check offline audio context limits.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── ACTION FOOTER ────────────────────────────────────────────────────── */}
      <div
        style={{
          borderTop: `1px solid ${DARK.bevelDark}`,
          paddingTop: `${SPACE.md}px`,
          marginTop: `${SPACE.md}px`,
          display: "flex",
          gap: `${SPACE.sm}px`,
          flexShrink: 0,
        }}
      >
        {/* Reset button — only shown after success */}
        {renderStatus === "success" && (
          <button
            id="dismiss-render-btn"
            type="button"
            onClick={() => setRenderStatus("idle")}
            style={{
              ...raised(DARK),
              backgroundColor: DARK.bg3,
              color: DARK.textMid,
              fontFamily: DARK.font,
              fontSize: "9px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              padding: `${SPACE.sm}px ${SPACE.md}px`,
              cursor: "pointer",
              userSelect: "none",
              flexShrink: 0,
            }}
          >
            Reset
          </button>
        )}

        {/* BOUNCE MASTER OUT — the main CTA */}
        <button
          id="render-bounce-action"
          type="button"
          onClick={startRender}
          disabled={isLocked}
          style={bounceStyle}
        >
          {renderStatus === "rendering" ? (
            <>
              <IconDisc color={DARK.accentMaster} />
              <span>Bouncing...</span>
            </>
          ) : (
            <>
              <IconPlay color={DARK.bg0} />
              <span>Bounce Master Out</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
