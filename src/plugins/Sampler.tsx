/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from "react";
import { ChannelRow, SamplerSettings } from "../types";
import { Knob } from "../components/ChannelRack";
import { useAudioEngine } from "../audio/useAudioEngine";

import {
  DARK,
  raised,
  sunken,
  flat,
  flush,
  SPACE,
} from "../../public/Themes/Vintage Console/tokens";

// ── Hex → rgba helper ─────────────────────────────────────────────────────────
const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

// ── Upload SVG icon (inline — removes lucide dep) ─────────────────────────────
const IconUpload = ({ color, size = 10 }: { color: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <polyline points="16 16 12 12 8 16" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
  </svg>
);

// ── Waves icon ─────────────────────────────────────────────────────────────────
const IconWaves = ({ color, size = 12 }: { color: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
  </svg>
);

// ── Power icon ────────────────────────────────────────────────────────────────
const IconPower = ({ color, size = 8 }: { color: string; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
    <line x1="12" y1="2" x2="12" y2="12" />
  </svg>
);

// ── Section card ──────────────────────────────────────────────────────────────
function SectionCard({
  label,
  accentDot,
  dotColor,
  headerRight,
  children,
  footer,
}: {
  label: string;
  accentDot?: boolean;
  dotColor?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      style={{
        ...flat(DARK),
        backgroundColor: DARK.bg2,
        padding: `${SPACE.sm}px ${SPACE.md}px ${SPACE.sm}px ${SPACE.md}px`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${DARK.bevelDark}`,
          paddingBottom: `${SPACE.xs}px`,
          marginBottom: `${SPACE.sm}px`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.xs}px` }}>
          {accentDot && (
            <div
              style={{
                width: "5px",
                height: "5px",
                backgroundColor: dotColor ?? DARK.accentMaster,
                flexShrink: 0,
              }}
            />
          )}
          <span
            style={{
              fontFamily: DARK.font,
              fontSize: "7px",
              color: DARK.textMid,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              fontWeight: "bold",
              userSelect: "none",
            }}
          >
            {label}
          </span>
        </div>
        {headerRight}
      </div>

      {children}

      {footer && (
        <div
          style={{
            marginTop: `${SPACE.md}px`,
            ...sunken(DARK),
            backgroundColor: DARK.bg0,
            padding: `${SPACE.xs}px ${SPACE.sm}px`,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

// ── LCD readout text ──────────────────────────────────────────────────────────
const lcdTextStyle: React.CSSProperties = {
  fontFamily: DARK.font,
  fontSize: "7px",
  color: DARK.lcdText,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontWeight: "bold",
  lineHeight: 1,
};

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────
interface SamplerProps {
  channelId: string;
  channels: ChannelRow[];
  setChannels: React.Dispatch<React.SetStateAction<ChannelRow[]>>;
  channelVols: Record<string, number>;
  channelPans: Record<string, number>;
  setChannelVols: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setChannelPans: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  samplerSettings: Record<string, SamplerSettings>;
  setSamplerSettings: React.Dispatch<React.SetStateAction<Record<string, SamplerSettings>>>;
}

const DEFAULT_SETTINGS: SamplerSettings = {
  pitch: 0,
  sampleStart: 0,
  envelopeOn: false,
  attack: 15,
  decay: 30,
  sustain: 70,
  release: 40,
  stretchMode: "resample",
  stretchPitch: 0,
  stretchMul: 1.0,
  stretchTime: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// SAMPLER
// ─────────────────────────────────────────────────────────────────────────────
export function Sampler({
  channelId,
  channels,
  setChannels,
  channelVols,
  channelPans,
  setChannelVols,
  setChannelPans,
  samplerSettings,
  setSamplerSettings,
}: SamplerProps) {
  const { engine, getSampleBuffer, previewChannel } = useAudioEngine();
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loadedBuffer,    setLoadedBuffer]    = useState<AudioBuffer | null>(null);
  const [isDraggingOver,  setIsDraggingOver]  = useState(false);
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [timeMenuOpen,    setTimeMenuOpen]    = useState(false);

  const handleTimeKnobContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTimeMenuOpen(true);
  };

  const toggleTimeMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTimeMenuOpen((prev) => !prev);
  };

  const channel     = channels.find((c) => c.id === channelId);
  const channelName = channel ? channel.name : "Unknown Sampler";
  const settings    = samplerSettings[channelId] || DEFAULT_SETTINGS;
  const vol         = channelVols[channelId] !== undefined ? channelVols[channelId] : 80;
  const pan         = channelPans[channelId] !== undefined ? channelPans[channelId] : 0;

  useEffect(() => {
    if (channel?.sampleId) {
      const buffer = getSampleBuffer(channel.sampleId);
      setLoadedBuffer(buffer || null);
      engine.updateChannelSampleId(channelId, channel.sampleId);
      engine.updateChannelVolume(channelId, vol);
      engine.updateChannelPan(channelId, pan);
      engine.updateChannelSamplerSettings(channelId, settings);
    } else {
      setLoadedBuffer(null);
    }
  }, [channelId, channel?.sampleId, getSampleBuffer, vol, pan, settings, engine]);

  const handleWaveformClick = () => {
    if (!channel?.sampleId) return;
    engine.updateChannelSampleId(channelId, channel.sampleId);
    engine.updateChannelVolume(channelId, vol);
    engine.updateChannelPan(channelId, pan);
    engine.updateChannelSamplerSettings(channelId, settings);
    previewChannel(channelId);
    setIsPreviewActive(true);
    setTimeout(() => setIsPreviewActive(false), 120);
  };

  useEffect(() => {
    drawWaveform();
  }, [loadedBuffer, settings.sampleStart]);

  // ── Waveform draw — all colors from tokens, no hardcoded hex ──────────────
  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width  = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (!loadedBuffer) {
      // Empty flatline — DARK.accentBlue at low opacity
      ctx.strokeStyle = hexToRgba(DARK.accentBlue, 0.35);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    const channelData = loadedBuffer.getChannelData(0);
    const step     = Math.ceil(channelData.length / width);
    const ampScale = 0.95;

    for (let i = 0; i < width; i++) {
      let min = 0;
      let max = 0;
      let hasData = false;
      const startIdx = i * step;
      const endIdx   = Math.min(startIdx + step, channelData.length);

      for (let j = startIdx; j < endIdx; j++) {
        const val = channelData[j];
        if (!hasData) { min = val; max = val; hasData = true; }
        else { if (val < min) min = val; if (val > max) max = val; }
      }

      const midY = height / 2;
      const yMin = midY + min * midY * ampScale;
      const yMax = midY + max * midY * ampScale;

      const sampleOffsetPct = settings.sampleStart;
      const isPastOffset    = (i / width) * 100 >= sampleOffsetPct;

      // Past offset: DARK.accentBlue at high opacity; pre-offset: textGhost
      ctx.strokeStyle = isPastOffset
        ? hexToRgba(DARK.accentBlue, 0.85)
        : hexToRgba(DARK.textGhost, 0.55);

      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(i, yMin);
      ctx.lineTo(i, yMax);
      ctx.stroke();
    }

    // Start marker line — DARK.accentGreen, dashed
    if (settings.sampleStart > 0) {
      const xMarker = (settings.sampleStart / 100) * width;
      ctx.strokeStyle = DARK.accentGreen;
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(xMarker, 0);
      ctx.lineTo(xMarker, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Triangle caret at top — DARK.accentGreen fill
      ctx.fillStyle = DARK.accentGreen;
      ctx.beginPath();
      ctx.moveTo(xMarker - 4, 0);
      ctx.lineTo(xMarker + 4, 0);
      ctx.lineTo(xMarker, 5);
      ctx.closePath();
      ctx.fill();
    }
  };

  const updateSetting = <K extends keyof SamplerSettings>(key: K, val: SamplerSettings[K]) => {
    const nextSettings = {
      ...(samplerSettings[channelId] || DEFAULT_SETTINGS),
      [key]: val,
    };
    setSamplerSettings((prev) => ({ ...prev, [channelId]: nextSettings }));
    engine.updateChannelSamplerSettings(channelId, nextSettings);
  };

  const handleVolChange = (newVol: number) => {
    setChannelVols((prev) => ({ ...prev, [channelId]: newVol }));
    engine.updateChannelVolume(channelId, newVol);
  };

  const handlePanChange = (newPan: number) => {
    setChannelPans((prev) => ({ ...prev, [channelId]: newPan }));
    engine.updateChannelPan(channelId, newPan);
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("audio/") && !file.name.endsWith(".wav") && !file.name.endsWith(".mp3")) {
      console.warn("Unsupported sample file extension format.");
      return;
    }
    try {
      const arrayBuffer = await file.arrayBuffer();
      const sampleId    = `${channelId}_sample_${Date.now()}`;
      await engine.loadSample(sampleId, arrayBuffer);
      setChannels((prev) =>
        prev.map((c) =>
          c.id === channelId
            ? { ...c, name: file.name.replace(/\.[^/.]+$/, ""), sampleId, type: "sample" as const }
            : c
        )
      );
      console.log(`Sampler successfully loaded: ${file.name}`);
    } catch (err) {
      console.error("Audio decoding execution exception failure:", err);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFile(file);
  };

  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingOver(true); };
  const handleDragLeave = () => setIsDraggingOver(false);
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files[0];
    if (file) await handleFile(file);
  };

  // ── BYP button ─────────────────────────────────────────────────────────────
  const bypStyle: React.CSSProperties = settings.envelopeOn
    ? {
        ...sunken(DARK),
        backgroundColor: DARK.bg0,
        color: DARK.stateAmber,
        fontFamily: DARK.font,
        fontSize: "7px",
        fontWeight: "bold",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        display: "flex",
        alignItems: "center",
        gap: `${SPACE.xs}px`,
        padding: `1px ${SPACE.xs}px`,
        cursor: "pointer",
        userSelect: "none",
      }
    : {
        ...raised(DARK),
        backgroundColor: DARK.bg3,
        color: DARK.textMid,
        fontFamily: DARK.font,
        fontSize: "7px",
        fontWeight: "bold",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        display: "flex",
        alignItems: "center",
        gap: `${SPACE.xs}px`,
        padding: `1px ${SPACE.xs}px`,
        cursor: "pointer",
        userSelect: "none",
      };

  // ── RESAMPLE dropdown ──────────────────────────────────────────────────────
  const stretchSelectStyle: React.CSSProperties = {
    ...sunken(DARK),
    backgroundColor: DARK.bg0,
    color: DARK.lcdText,
    fontFamily: DARK.font,
    fontSize: "8px",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    padding: `1px ${SPACE.xs}px`,
    outline: "none",
    cursor: "pointer",
    appearance: "none" as const,
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      id={`sampler-plugin-${channelId}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: DARK.bg1,
        padding: `${SPACE.sm}px`,
        userSelect: "none",
        position: "relative",
        ...(isDraggingOver ? { border: `1px solid ${DARK.accentBlue}` } : flat(DARK)),
      }}
    >
      {/* ── DRAG-OVER OVERLAY ─────────────────────────────────────────────── */}
      {isDraggingOver && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: hexToRgba(DARK.bg0, 0.88),
            zIndex: 30,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: `2px dashed ${DARK.accentBlue}`,
            pointerEvents: "none",
          }}
        >
          <IconUpload color={DARK.accentBlue} size={28} />
          <span
            style={{
              fontFamily: DARK.font,
              fontSize: "10px",
              fontWeight: "bold",
              color: DARK.accentBlue,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              marginTop: `${SPACE.sm}px`,
            }}
          >
            Drop Audio Sample Here
          </span>
          <span
            style={{
              fontFamily: DARK.font,
              fontSize: "7px",
              color: DARK.textDim,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginTop: `${SPACE.xs}px`,
            }}
          >
            Supported: WAV, MP3, AIFF
          </span>
        </div>
      )}

      {/* ── 1. WAVEFORM DISPLAY ────────────────────────────────────────────── */}
      <div
        style={{
          ...sunken(DARK),
          backgroundColor: DARK.bg0,
          padding: `${SPACE.sm}px`,
          marginBottom: `${SPACE.md}px`,
          height: "80px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {/* Header row: icon + name | START readout + LOAD button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 1,
            position: "relative",
          }}
        >
          {/* Left: icon + channel name */}
          <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.xs}px` }}>
            <IconWaves color={DARK.accentBlue} size={12} />
            <span
              style={{
                fontFamily: DARK.font,
                fontSize: "8px",
                fontWeight: "bold",
                color: DARK.textHi,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                maxWidth: "120px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {channelName}
            </span>
          </div>

          {/* Right: START readout + LOAD */}
          <div style={{ display: "flex", alignItems: "center", gap: `${SPACE.sm}px` }}>
            {/* START readout — LCD style */}
            <div
              style={{
                ...sunken(DARK),
                backgroundColor: DARK.bg0,
                padding: `1px ${SPACE.xs}px`,
                display: "flex",
                alignItems: "center",
                gap: `${SPACE.xs}px`,
              }}
            >
              <span style={{ ...lcdTextStyle, color: DARK.textLo }}>Start:</span>
              <span style={lcdTextStyle}>{settings.sampleStart}%</span>
            </div>

            {/* LOAD button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Click to browse audio sample file"
              style={{
                ...raised(DARK),
                backgroundColor: DARK.bg3,
                color: DARK.accentMaster,
                fontFamily: DARK.font,
                fontSize: "8px",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                display: "flex",
                alignItems: "center",
                gap: `${SPACE.xs}px`,
                padding: `1px ${SPACE.sm}px`,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <IconUpload color={DARK.accentMaster} size={8} />
              Load
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Waveform canvas — clickable for audition */}
        <div
          onClick={handleWaveformClick}
          title="Click to audition sample"
          style={{
            flex: 1,
            width: "100%",
            marginTop: `${SPACE.xs}px`,
            cursor: "pointer",
            position: "relative",
            overflow: "hidden",
            // Preview flash: no box-shadow — use a brief background tint
            backgroundColor: isPreviewActive
              ? hexToRgba(DARK.accentBlue, 0.06)
              : "transparent",
          }}
        >
          <canvas
            ref={canvasRef}
            width={450}
            height={48}
            style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
          />
        </div>

        {/* Bottom info bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: `${SPACE.xs}px`,
            zIndex: 1,
            position: "relative",
          }}
        >
          <span style={{ fontFamily: DARK.font, fontSize: "7px", color: DARK.textLo, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Sampler Integrated Analyser
          </span>
          <span style={{ fontFamily: DARK.font, fontSize: "7px", color: DARK.textLo, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Buffer: {loadedBuffer ? "Ready" : "Offline"}
          </span>
        </div>
      </div>

      {/* ── 2. CONTROL PANELS GRID ─────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: `${SPACE.sm}px`,
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* ── A. CORE ANALOGS ─────────────────────────────────────────────── */}
        <SectionCard
          label="Core Analogs"
          accentDot
          dotColor={DARK.accentMaster}
          footer={
            <>
              <span style={lcdTextStyle}>
                Ptch: {settings.pitch > 0 ? `+${settings.pitch}` : settings.pitch}
              </span>
              <span style={lcdTextStyle}>Strt: {settings.sampleStart}%</span>
            </>
          }
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", gap: `${SPACE.xs}px`, paddingTop: `${SPACE.xs}px` }}>
            <Knob label="PITCH"  value={settings.pitch}       min={-12}  max={12}  color="cyan"  onChange={(v) => updateSetting("pitch", v)}       title="Symmetric pitch transpose (semitones)" />
            <Knob label="VOL"    value={vol}                  min={0}    max={100} color="amber" onChange={handleVolChange}                         title="Dual linked master volume" />
            <Knob label="PAN"    value={pan}                  min={-50}  max={50}  color="cyan"  onChange={handlePanChange}                         title="Standard stereo pan balance" />
            <Knob label="OFFSET" value={settings.sampleStart} min={0}    max={100} color="amber" onChange={(v) => updateSetting("sampleStart", v)} title="WAV file play start offset" />
          </div>
        </SectionCard>

        {/* ── B. ENVELOPE ADSR ────────────────────────────────────────────── */}
        <SectionCard
          label="Envelope ADSR"
          accentDot
          dotColor={settings.envelopeOn ? DARK.stateAmber : DARK.textGhost}
          headerRight={
            <button
              onClick={() => updateSetting("envelopeOn", !settings.envelopeOn)}
              title="Toggle filter envelope on/off bypass"
              style={bypStyle}
            >
              <IconPower color={settings.envelopeOn ? DARK.stateAmber : DARK.textMid} size={8} />
              {settings.envelopeOn ? "On" : "Byp"}
            </button>
          }
          footer={
            <span style={{
              ...lcdTextStyle,
              color: settings.envelopeOn ? DARK.stateAmber : DARK.textDim,
            }}>
              {settings.envelopeOn
                ? `A:${settings.attack} D:${settings.decay} S:${settings.sustain} R:${settings.release}`
                : "Env Bypassed"}
            </span>
          }
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-around",
              gap: `${SPACE.xs}px`,
              paddingTop: `${SPACE.xs}px`,
              opacity: settings.envelopeOn ? 1 : 0.35,
              pointerEvents: settings.envelopeOn ? "auto" : "none",
            }}
          >
            <Knob label="ATTACK" value={settings.attack}  min={0} max={100} color="cyan"  onChange={(v) => updateSetting("attack", v)}  title="Attack time envelope (ms)" />
            <Knob label="DECAY"  value={settings.decay}   min={0} max={100} color="amber" onChange={(v) => updateSetting("decay", v)}   title="Decay slope time (ms)" />
            <Knob label="SUST"   value={settings.sustain} min={0} max={100} color="cyan"  onChange={(v) => updateSetting("sustain", v)} title="Sustain volume percentage" />
            <Knob label="REL"    value={settings.release} min={0} max={100} color="amber" onChange={(v) => updateSetting("release", v)} title="Release tail duration (ms)" />
          </div>
        </SectionCard>

        {/* ── C. TIME STRETCH ─────────────────────────────────────────────── */}
        <div style={{ position: "relative" }}>
          {/* Backdrop dismiss for presets popover */}
          {timeMenuOpen && (
            <div
              style={{ position: "fixed", inset: 0, zIndex: 45, cursor: "default" }}
              onClick={(e) => { e.stopPropagation(); setTimeMenuOpen(false); }}
            />
          )}

          <SectionCard
            label="Time Stretch"
            accentDot
            dotColor={settings.stretchMode === "stretch" ? DARK.accentBlue : DARK.textGhost}
            headerRight={
              /* RESAMPLE / STRETCH dropdown — sunken LCD style */
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <select
                  value={settings.stretchMode || "resample"}
                  onChange={(e) => updateSetting("stretchMode", e.target.value as "resample" | "stretch")}
                  title="Time stretching algorithm mode"
                  style={stretchSelectStyle}
                >
                  <option value="resample" style={{ backgroundColor: DARK.bg0, color: DARK.lcdText, fontFamily: DARK.font }}>
                    Resample
                  </option>
                  <option value="stretch" style={{ backgroundColor: DARK.bg0, color: DARK.lcdText, fontFamily: DARK.font }}>
                    Stretch
                  </option>
                </select>
                {/* Chevron indicator */}
                <span
                  style={{
                    position: "absolute",
                    right: `${SPACE.xs}px`,
                    color: DARK.textMid,
                    fontSize: "7px",
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                >
                  ▾
                </span>
              </div>
            }
            footer={
              <>
                <span style={lcdTextStyle}>
                  Ptch: {settings.stretchPitch !== undefined ? (settings.stretchPitch > 0 ? `+${settings.stretchPitch}` : settings.stretchPitch) : 0}c
                </span>
                <span style={lcdTextStyle}>
                  Mul: {settings.stretchMul !== undefined ? settings.stretchMul.toFixed(2) : "1.00"}x
                </span>
                <span style={lcdTextStyle}>
                  Time: {settings.stretchTime ? `${settings.stretchTime} Bt` : "Auto"}
                </span>
              </>
            }
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", gap: `${SPACE.xs}px`, paddingTop: `${SPACE.xs}px` }}>
              {/* PITCH knob — accentBlue indicator */}
              <Knob
                label="PITCH"
                value={settings.stretchPitch !== undefined ? settings.stretchPitch : 0}
                min={-1200}
                max={1200}
                color="cyan"
                defaultValue={0}
                onChange={(v) => updateSetting("stretchPitch", v)}
                title="Fine pitch transpose in cents (-1200 to +1200)"
              />
              {/* MUL knob — accentMaster indicator */}
              <Knob
                label="MUL"
                value={settings.stretchMul !== undefined ? Math.round(settings.stretchMul * 100) : 100}
                min={50}
                max={200}
                color="amber"
                defaultValue={100}
                onChange={(v) => updateSetting("stretchMul", v / 100)}
                title="Time stretch duration multiplier (0.5x to 2.0x)"
              />
              {/* TIME knob — accentGreen indicator */}
              <div
                style={{ position: "relative", zIndex: 50 }}
                onContextMenu={handleTimeKnobContextMenu}
              >
                <Knob
                  label="TIME"
                  value={settings.stretchTime !== undefined ? settings.stretchTime : 0}
                  min={0}
                  max={64}
                  color="cyan"
                  defaultValue={0}
                  onChange={(v) => updateSetting("stretchTime", v)}
                  title="Target length in project beats (0 = Auto; Right-click or use arrow for presets)"
                />
                {/* Preset chevron */}
                <button
                  type="button"
                  onClick={toggleTimeMenu}
                  title="Quick presets menu"
                  style={{
                    position: "absolute",
                    bottom: "-6px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontSize: "6px",
                    color: DARK.textLo,
                    cursor: "pointer",
                    padding: `1px ${SPACE.xs}px`,
                    fontFamily: DARK.font,
                    background: "none",
                    border: "none",
                    userSelect: "none",
                  }}
                >
                  ▼
                </button>

                {/* Presets popover */}
                {timeMenuOpen && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "28px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      zIndex: 50,
                      width: "100px",
                      ...flat(DARK),
                      backgroundColor: DARK.bg1,
                      padding: `${SPACE.xs}px`,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    {[
                      { label: "Auto (0)",     value: 0  },
                      { label: "1 Beat",       value: 1  },
                      { label: "2 Beats",      value: 2  },
                      { label: "1 Bar (4 Bt)", value: 4  },
                      { label: "2 Bars (8 Bt)",value: 8  },
                      { label: "4 Bars (16 Bt)",value: 16 },
                    ].map((preset) => {
                      const isActive =
                        settings.stretchTime === preset.value ||
                        (preset.value === 0 && !settings.stretchTime);
                      return (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateSetting("stretchTime", preset.value);
                            setTimeMenuOpen(false);
                          }}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: `${SPACE.xs}px ${SPACE.sm}px`,
                            fontFamily: DARK.font,
                            fontSize: "8px",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            cursor: "pointer",
                            userSelect: "none",
                            color: isActive ? DARK.accentBlue : DARK.textMid,
                            fontWeight: isActive ? "bold" : "normal",
                            backgroundColor: isActive ? hexToRgba(DARK.accentBlue, 0.08) : "transparent",
                            border: "none",
                          }}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
