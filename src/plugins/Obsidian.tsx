/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Sparkles, Activity, ShieldAlert, Sliders, Settings2, Zap } from "lucide-react";
import { useAudioEngine } from "../audio/useAudioEngine";
import { Knob } from "../components/ChannelRack";
import { ObsidianSettings, OscillatorSettings } from "../types";

interface ObsidianProps {
  channelId?: string;
  onClose?: () => void;
}

const generateEnvelopePath = (attack: number, decay: number, sustain: number, release: number) => {
  const width = 100;
  const height = 35;
  const bottomY = 33;
  const topY = 2;
  
  const A = 4 + (attack / 100) * 20;
  const D = 4 + (decay / 100) * 20;
  const R = 4 + (release / 100) * 24;
  
  const sustainY = bottomY - (sustain / 100) * (bottomY - topY);
  
  const attackEnd = A;
  const decayEnd = A + D;
  const sustainEnd = width - R;
  
  return `M 0 ${bottomY} ` + 
         `Q ${attackEnd * 0.2} ${topY} ${attackEnd} ${topY} ` +
         `Q ${attackEnd + D * 0.4} ${sustainY} ${decayEnd} ${sustainY} ` +
         `L ${sustainEnd} ${sustainY} ` +
         `Q ${sustainEnd + R * 0.3} ${bottomY} 100 ${bottomY}`;
};

export function Obsidian({ channelId, onClose }: ObsidianProps) {
  const { engine } = useAudioEngine();

  // Load baseline parameters reactively
  const getInitialSettings = (): ObsidianSettings => {
    if (channelId) {
      return engine.getObsidianSettings(channelId);
    }
    return {
      monoPoly: "poly",
      glide: 20,
      oscillators: {
        osc1: { waveform: "sawtooth", volume: 65, pan: -10, coarse: 0, fine: -5, enabled: true },
        osc2: { waveform: "sawtooth", volume: 60, pan: 10, coarse: 0, fine: 5, enabled: true },
        osc3: { waveform: "triangle", volume: 40, pan: 0, coarse: -12, fine: 0, enabled: true }
      },
      filterType: "lowpass",
      cutoff: 40,
      resonance: 18,
      filterEnvAmount: 45,
      unisonVoices: 1,
      unisonDetune: 15,
      subOscWave: "sine",
      subOscVol: 25,
      lfoRate: 3.5,
      lfoToPitch: 2,
      lfoToFilter: 5,
      lfoToVolume: 0,
      lfoBypass: false,
      ampEnv: { attack: 8, decay: 35, sustain: 75, release: 30 },
      filterEnv: { attack: 20, decay: 40, sustain: 30, release: 40 },
      masterGain: 75
    };
  };

  const [settings, setSettings] = useState<ObsidianSettings>(getInitialSettings);

  // Sync settings when active channelId switches
  useEffect(() => {
    if (channelId) {
      setSettings(engine.getObsidianSettings(channelId));
    }
  }, [channelId, engine]);

  const pendingSettingsRef = React.useRef<ObsidianSettings | null>(null);
  const rafPendingRef = React.useRef<boolean>(false);

  // Reactive state-dispatch helper with requestAnimationFrame throttling
  const updateSetting = (updater: (prev: ObsidianSettings) => ObsidianSettings) => {
    setSettings((prev) => {
      const next = updater(prev);
      if (channelId) {
        pendingSettingsRef.current = next;
        if (!rafPendingRef.current) {
          rafPendingRef.current = true;
          requestAnimationFrame(() => {
            if (pendingSettingsRef.current) {
              engine.updateChannelObsidianSettings(channelId, pendingSettingsRef.current);
            }
            rafPendingRef.current = false;
          });
        }
      }
      return next;
    });
  };

  const handleWaveformChange = (oscKey: string, wave: "sine" | "square" | "sawtooth" | "triangle") => {
    updateSetting((prev) => ({
      ...prev,
      oscillators: {
        ...prev.oscillators,
        [oscKey]: {
          ...prev.oscillators[oscKey],
          waveform: wave
        }
      }
    }));
  };

  const handleOscKnobChange = (oscKey: string, knobKey: keyof OscillatorSettings, value: number) => {
    updateSetting((prev) => ({
      ...prev,
      oscillators: {
        ...prev.oscillators,
        [oscKey]: {
          ...prev.oscillators[oscKey],
          [knobKey]: value
        }
      }
    }));
  };

  const ampPath = generateEnvelopePath(
    settings.ampEnv.attack,
    settings.ampEnv.decay,
    settings.ampEnv.sustain,
    settings.ampEnv.release
  );

  const filterPath = generateEnvelopePath(
    settings.filterEnv.attack,
    settings.filterEnv.decay,
    settings.filterEnv.sustain,
    settings.filterEnv.release
  );

  return (
    <div 
      id="obsidian-synthesizer-container" 
      className="w-full h-full bg-[#0c0d10] text-[#eceff4] flex flex-col justify-between p-3 font-mono select-none relative border border-zinc-900 shadow-2xl rounded-none overflow-hidden"
    >
      {/* Background Micro Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:12px_12px]" />

      {/* Header Panel */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2 z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.85)] animate-pulse" />
          <h2 className="text-[11px] font-black tracking-[0.2em] text-rose-500 uppercase flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            OBSIDIAN SYNTHESIZER
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[8px] text-zinc-500 font-extrabold tracking-widest uppercase">
            ANALOG PHYSICAL VIRTUAL GRAPH
          </span>
          {onClose && (
            <button 
              id="obsidian-close-btn"
              onClick={onClose}
              className="px-1.5 py-0.5 text-[8px] text-zinc-400 border border-zinc-850 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-900 transition-all rounded-none"
            >
              ESC [X]
            </button>
          )}
        </div>
      </div>

      {/* Main Panel - 2 Column Hardware Grid split */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 my-2 min-h-0 overflow-y-auto">
        
        {/* LEFT COLUMN: SOURCES & WAVE GENERATION */}
        <div className="flex flex-col gap-2.5 p-2 pt-7 bg-[#0e0f14]/80 border border-zinc-900/40 rounded-sm relative">
          <div className="absolute top-1.5 right-2 flex items-center gap-1 text-[7px] text-zinc-600 font-bold uppercase tracking-wider">
            <Sliders className="h-2.5 w-2.5" />
            GENERATOR PANEL
          </div>

          {/* GLOBAL SECTION */}
          <div className="border border-zinc-850/60 bg-black/30 p-2 rounded-none">
            <div className="text-[8px] font-black text-zinc-550 uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-sky-500/80 rounded-none inline-block" />
              GLOBAL INSTRUMENT TRACT
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1">
                <span className="text-[7.5px] text-zinc-550 font-bold uppercase mr-1">VOICE ALLOCATION:</span>
                <div className="grid grid-cols-2 border border-neutral-800 p-0.5 bg-black rounded-none">
                  <button
                    id="mono-alloc-btn"
                    onClick={() => updateSetting(prev => ({ ...prev, monoPoly: "mono" }))}
                    className={`px-2 py-1 text-[8px] font-black tracking-wider uppercase transition-colors rounded-none ${
                      settings.monoPoly === "mono"
                        ? "bg-rose-500 text-black shadow-[0_0_8px_rgba(244,63,94,0.4)]"
                        : "text-zinc-550 hover:text-zinc-300"
                    }`}
                  >
                    MONO
                  </button>
                  <button
                    id="poly-alloc-btn"
                    onClick={() => updateSetting(prev => ({ ...prev, monoPoly: "poly" }))}
                    className={`px-2 py-1 text-[8px] font-black tracking-wider uppercase transition-colors rounded-none ${
                      settings.monoPoly === "poly"
                        ? "bg-rose-500 text-black shadow-[0_0_8px_rgba(244,63,94,0.4)]"
                        : "text-zinc-550 hover:text-zinc-300"
                    }`}
                  >
                    POLY
                  </button>
                </div>
              </div>

              {settings.monoPoly === "mono" && (
                <div className="flex items-center gap-1 shrink-0 scale-90">
                  <Knob
                    label="GLIDE"
                    value={settings.glide}
                    min={0}
                    max={100}
                    color="cyan"
                    onChange={(val) => updateSetting(prev => ({ ...prev, glide: val }))}
                    title="Glide/Portamento port speed in Mono Mode"
                  />
                  <div className="text-[7px] text-zinc-550 font-semibold leading-none ml-1 uppercase">
                    SLIDE RATE
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* UNISON DETUNER & SUB OSCILLATOR CORE */}
          <div className="border border-zinc-850/60 bg-black/30 p-2 rounded-none space-y-2">
            <div className="text-[8px] font-black text-zinc-550 uppercase tracking-widest border-b border-zinc-900/50 pb-0.5 mb-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-rose-500/80 rounded-none inline-block animate-pulse" />
              UNISON DETUNER & SUB OSC
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* Unison Voice Count Dropdown */}
              <div className="flex flex-col gap-1">
                <span className="text-[6.5px] text-zinc-550 font-bold uppercase tracking-wider">UNISON STACK:</span>
                <select
                  value={settings.unisonVoices || 1}
                  onChange={(e) => updateSetting(prev => ({ ...prev, unisonVoices: parseInt(e.target.value) }))}
                  className="bg-[#0a0a0c] border border-zinc-800 text-[8.5px] font-bold text-cyan-400 h-6 px-1 focus:outline-none"
                >
                  <option value="1">1 Voice (Off)</option>
                  <option value="3">3 Voices (Wide)</option>
                  <option value="5">5 Voices (Fat)</option>
                </select>
              </div>

              {/* Unison Detuning cents Knob */}
              {(settings.unisonVoices || 1) > 1 && (
                <Knob
                  label="DETUNE"
                  value={settings.unisonDetune !== undefined ? settings.unisonDetune : 15}
                  min={0}
                  max={50}
                  color="cyan"
                  onChange={(v) => updateSetting(prev => ({ ...prev, unisonDetune: v }))}
                  title="Unison voice pitch detuning in Cents"
                  defaultValue={15}
                />
              )}

              {/* Sub-Oscillator Wave Selector */}
              <div className="flex flex-col gap-1">
                <span className="text-[6.5px] text-zinc-550 font-bold uppercase tracking-wider">SUB WAVE:</span>
                <select
                  value={settings.subOscWave || "off"}
                  onChange={(e) => updateSetting(prev => ({ ...prev, subOscWave: e.target.value as any }))}
                  className="bg-[#0a0a0c] border border-zinc-800 text-[8.5px] font-bold text-cyan-400 h-6 px-1 focus:outline-none"
                >
                  <option value="off">Off</option>
                  <option value="sine">Sine</option>
                  <option value="square">Square</option>
                  <option value="triangle">Triangle</option>
                </select>
              </div>

              {/* Sub-Oscillator Volume Knob */}
              {settings.subOscWave && settings.subOscWave !== "off" && (
                <Knob
                  label="SUB VOL"
                  value={settings.subOscVol !== undefined ? settings.subOscVol : 30}
                  min={0}
                  max={100}
                  color="amber"
                  onChange={(v) => updateSetting(prev => ({ ...prev, subOscVol: v }))}
                  title="Sub oscillator volume gain"
                  defaultValue={30}
                />
              )}
            </div>
          </div>

          {/* OSCILLATORS */}
          <div className="flex-1 flex flex-col gap-2">
            {(["osc1", "osc2", "osc3"] as const).map((oscId, i) => {
              const oscData = settings.oscillators[oscId];
              return (
                <div key={oscId} className="border border-zinc-850/60 bg-black/30 p-2 rounded-none flex flex-col gap-2">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-1">
                    <div className="flex items-center gap-2">
                      <button
                        id={`osc${i+1}-toggle-active`}
                        onClick={() => {
                          updateSetting((prev) => ({
                            ...prev,
                            oscillators: {
                              ...prev.oscillators,
                              [oscId]: {
                                ...prev.oscillators[oscId],
                                enabled: prev.oscillators[oscId]?.enabled !== false ? false : true
                              }
                            }
                          }));
                        }}
                        className={`w-3.5 h-3.5 rounded-full border transition-all flex items-center justify-center cursor-pointer ${
                          oscData?.enabled !== false
                            ? "bg-rose-500 border-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.6)]"
                            : "bg-neutral-900 border-neutral-700"
                        }`}
                        title={oscData?.enabled !== false ? "Click to mute Oscillator" : "Click to enable Oscillator"}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${oscData?.enabled !== false ? "bg-white" : "bg-neutral-600"}`} />
                      </button>
                      <span className={`text-[8px] font-black uppercase tracking-widest flex items-center gap-1 ${oscData?.enabled !== false ? "text-rose-500/80" : "text-zinc-550"}`}>
                        <Zap className="h-2.5 w-2.5" />
                        OSCILLATOR {i + 1}
                      </span>
                    </div>
                    <span className="text-[7px] text-zinc-650 font-bold uppercase tracking-widest">
                      {oscData?.enabled !== false ? "ACTIVE" : "BYPASSED"}
                    </span>
                  </div>

                  {/* Waveform select icon buttons & Knobs layout */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Visual Waveform selectors */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <span className="text-[6.5px] text-zinc-550 font-bold uppercase tracking-wider">WAVEFORM SELECT:</span>
                      <div className="grid grid-cols-4 border border-zinc-850 p-0.5 bg-black rounded-none">
                        {(["sine", "sawtooth", "square", "triangle"] as const).map((wt) => (
                          <button
                            key={wt}
                            id={`osc${i+1}-wave-${wt}`}
                            onClick={() => handleWaveformChange(oscId, wt)}
                            className={`px-1.5 py-1 text-[7px] font-black tracking-tighter uppercase transition-colors rounded-none ${
                              oscData?.waveform === wt
                                ? "bg-amber-500 text-black shadow-[0_0_6px_rgba(245,158,11,0.3)]"
                                : "text-zinc-550 hover:text-zinc-300"
                            }`}
                            title={`Select ${wt} waveform`}
                          >
                            {wt.slice(0, 3)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Faders Row */}
                    <div className="flex-1 flex items-center justify-around gap-1 scale-95 origin-right">
                      <Knob
                        label="VOL"
                        value={oscData?.volume ?? 50}
                        min={0}
                        max={100}
                        color="amber"
                        onChange={(v) => handleOscKnobChange(oscId, "volume", v)}
                        title="Oscillator gain level"
                      />
                      <Knob
                        label="PAN"
                        value={oscData?.pan ?? 0}
                        min={-50}
                        max={50}
                        color="cyan"
                        onChange={(v) => handleOscKnobChange(oscId, "pan", v)}
                        title="Oscillator stereo position"
                      />
                      <Knob
                        label="COARSE"
                        value={oscData?.coarse ?? 0}
                        min={-24}
                        max={24}
                        color="cyan"
                        onChange={(v) => handleOscKnobChange(oscId, "coarse", v)}
                        title="Coarse Pitch in Semitones"
                      />
                      <Knob
                        label="FINE"
                        value={oscData?.fine ?? 0}
                        min={-99}
                        max={99}
                        color="cyan"
                        onChange={(v) => handleOscKnobChange(oscId, "fine", v)}
                        title="Fine Pitch in cents / micro-octaves"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: FILTERS, ENVELOPES & OUT */}
        <div className="flex flex-col gap-2.5 p-2 pt-7 bg-[#0e0f14]/80 border border-zinc-900/40 rounded-sm relative">
          <div className="absolute top-1.5 right-2 flex items-center gap-1 text-[7px] text-zinc-600 font-bold uppercase tracking-wider">
            <Settings2 className="h-2.5 w-2.5" />
            MODULATION SHAPER
          </div>

          {/* FILTER NETWORK */}
          <div className="border border-zinc-850/60 bg-black/30 p-2 rounded-none flex flex-col gap-2">
            <div className="text-[8px] font-black text-zinc-550 uppercase tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-rose-500/80 rounded-none inline-block animate-pulse" />
              DYNAMIC FILTER NETWORK
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1 shrink-0">
                <span className="text-[6.5px] text-zinc-550 font-bold uppercase tracking-wider">SHAPING TYPE:</span>
                <div className="grid grid-cols-3 border border-neutral-800 p-0.5 bg-black rounded-none">
                  {(["lowpass", "highpass", "bandpass"] as const).map((f) => (
                    <button
                      key={f}
                      id={`filter-type-${f}`}
                      onClick={() => updateSetting(prev => ({ ...prev, filterType: f }))}
                      className={`px-1.5 py-1 text-[7px] font-black tracking-wider uppercase transition-colors rounded-none ${
                        settings.filterType === f
                          ? "bg-rose-500 text-black shadow-[0_0_6px_rgba(244,63,94,0.3)]"
                          : "text-zinc-550 hover:text-zinc-300"
                      }`}
                      title={`Configure filter as ${f}`}
                    >
                      {f === "lowpass" ? "LPF" : f === "highpass" ? "HPF" : "BPF"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cutoff, resonance & env intensity knobs */}
              <div className="flex-1 flex justify-end gap-3.5 items-center pr-1.5 scale-95">
                <Knob
                  label="CUTOFF"
                  value={settings.cutoff}
                  min={0}
                  max={100}
                  color="amber"
                  onChange={(val) => updateSetting(prev => ({ ...prev, cutoff: val }))}
                  title="Filter base Cutoff frequency (exponentialHz mapping)"
                />
                <Knob
                  label="RESON"
                  value={settings.resonance}
                  min={0}
                  max={100}
                  color="amber"
                  onChange={(val) => updateSetting(prev => ({ ...prev, resonance: val }))}
                  title="Filter resonance multiplier Q"
                />
                <Knob
                  label="ENV AMT"
                  value={settings.filterEnvAmount !== undefined ? settings.filterEnvAmount : 50}
                  min={0}
                  max={100}
                  color="amber"
                  onChange={(val) => updateSetting(prev => ({ ...prev, filterEnvAmount: val }))}
                  title="Filter Envelope Cutoff Sweep Intensity"
                  defaultValue={50}
                />
              </div>
            </div>
          </div>

          {/* LFO MODULATION MATRIX */}
          <div className="border border-zinc-850/60 bg-black/30 p-2 rounded-none space-y-1.5">
            <div className="text-[8px] font-black text-cyan-400 uppercase tracking-widest border-b border-zinc-900/50 pb-0.5 mb-1 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-none inline-block ${settings.lfoBypass ? "bg-zinc-600" : "bg-cyan-400 animate-pulse"}`} />
                <span>LFO MODULATION MATRIX</span>
              </div>
              <button
                id="lfo-bypass-btn"
                onClick={() => updateSetting(prev => ({ ...prev, lfoBypass: !prev.lfoBypass }))}
                className={`px-1.5 py-0.5 text-[7px] font-black border transition-all cursor-pointer rounded-none ${
                  settings.lfoBypass
                    ? "bg-rose-950/60 text-rose-400 border-rose-900 shadow-[0_0_6px_rgba(244,63,94,0.2)]"
                    : "bg-cyan-950/20 text-cyan-400 border-cyan-900/50 hover:bg-rose-950/30 hover:text-rose-450 hover:border-rose-900"
                }`}
                title="Toggle LFO bypass state"
              >
                {settings.lfoBypass ? "BYPASSED [ON]" : "BYPASS [OFF]"}
              </button>
            </div>
            <div className={`flex items-center justify-around gap-2 flex-wrap select-none py-0.5 transition-all duration-150 ${settings.lfoBypass ? "opacity-30 pointer-events-none" : "opacity-100"}`}>
              <Knob
                label="LFO RATE"
                value={settings.lfoRate !== undefined ? settings.lfoRate : 5}
                min={1}
                max={20}
                color="cyan"
                onChange={(val) => updateSetting(prev => ({ ...prev, lfoRate: val }))}
                title="LFO Rate frequency speed in Hz"
                defaultValue={5}
              />
              <Knob
                label="PITCH MOD"
                value={settings.lfoToPitch !== undefined ? settings.lfoToPitch : 0}
                min={0}
                max={100}
                color="cyan"
                onChange={(val) => updateSetting(prev => ({ ...prev, lfoToPitch: val }))}
                title="LFO Pitch Modulation Vibrato Depth"
                defaultValue={0}
              />
              <Knob
                label="FILTER MOD"
                value={settings.lfoToFilter !== undefined ? settings.lfoToFilter : 0}
                min={0}
                max={100}
                color="cyan"
                onChange={(val) => updateSetting(prev => ({ ...prev, lfoToFilter: val }))}
                title="LFO Filter Cutoff Wobble Depth"
                defaultValue={0}
              />
              <Knob
                label="TREMOLO"
                value={settings.lfoToVolume !== undefined ? settings.lfoToVolume : 0}
                min={0}
                max={100}
                color="cyan"
                onChange={(val) => updateSetting(prev => ({ ...prev, lfoToVolume: val }))}
                title="LFO Volume Tremolo Modulation Depth"
                defaultValue={0}
              />
            </div>
          </div>

          {/* ADSR ENVELOPES */}
          <div className="flex-1 flex flex-col gap-2">
            
            {/* AMP Envelope */}
            <div className="border border-zinc-850/60 bg-black/30 p-2 rounded-none flex flex-col gap-1.5">
              <div className="flex items-center justify-between border-b border-zinc-900/50 pb-0.5 mb-1">
                <span className="text-[7.5px] font-black text-amber-400 uppercase tracking-widest">
                  AMPLITUDE ENV [AMP ADSR]
                </span>
                <span className="text-[6.5px] text-zinc-550 font-bold uppercase tracking-wider">
                  LOGARITHMIC STAGES
                </span>
              </div>

              {/* Envelope Vector Visualizer */}
              <div className="h-10 bg-black/50 border border-zinc-900/80 rounded-none overflow-hidden relative flex items-center justify-center mb-1">
                <svg className="w-full h-full text-amber-500/80" viewBox="0 0 100 35" preserveAspectRatio="none">
                  {/* Visual grid reference lines */}
                  <line x1="0" y1="33" x2="100" y2="33" stroke="#1c1917" strokeWidth="1" strokeDasharray="2,2" />
                  <line x1="0" y1="18" x2="100" y2="18" stroke="#1c1917" strokeWidth="0.5" strokeDasharray="2,4" />
                  <line x1="0" y1="2" x2="100" y2="2" stroke="#1c1917" strokeWidth="0.5" strokeDasharray="2,4" />
                  
                  {/* Ambient Gradient Fill */}
                  <path
                    d={`${ampPath} L 100 35 L 0 35 Z`}
                    fill="url(#amp-gradient)"
                    className="transition-all duration-75"
                  />
                  
                  {/* Glowing Vector Outline */}
                  <path
                    d={ampPath}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="transition-all duration-75"
                  />
                  
                  <defs>
                    <linearGradient id="amp-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              <div className="flex items-center justify-around gap-1 py-0.5">
                <Knob
                  label="ATT"
                  value={settings.ampEnv.attack}
                  min={0}
                  max={100}
                  color="amber"
                  onChange={(val) => updateSetting(p => ({ ...p, ampEnv: { ...p.ampEnv, attack: val } }))}
                  title="Amplifier Attack phase duration"
                />
                <Knob
                  label="DEC"
                  value={settings.ampEnv.decay}
                  min={0}
                  max={100}
                  color="amber"
                  onChange={(val) => updateSetting(p => ({ ...p, ampEnv: { ...p.ampEnv, decay: val } }))}
                  title="Amplifier Decay phase duration"
                />
                <Knob
                  label="SUST"
                  value={settings.ampEnv.sustain}
                  min={0}
                  max={100}
                  color="amber"
                  onChange={(val) => updateSetting(p => ({ ...p, ampEnv: { ...p.ampEnv, sustain: val } }))}
                  title="Amplifier Sustain gain hold percentage"
                />
                <Knob
                  label="REL"
                  value={settings.ampEnv.release}
                  min={0}
                  max={100}
                  color="amber"
                  onChange={(val) => updateSetting(p => ({ ...p, ampEnv: { ...p.ampEnv, release: val } }))}
                  title="Amplifier Release decay phase duration"
                />
              </div>
            </div>

            {/* FILTER Envelope */}
            <div className="border border-zinc-850/60 bg-black/30 p-2 rounded-none flex flex-col gap-1.5">
              <div className="flex items-center justify-between border-b border-zinc-900/50 pb-0.5 mb-1">
                <span className="text-[7.5px] font-black text-cyan-400 uppercase tracking-widest">
                  COFF SWEEP ENV [FILTER ADSR]
                </span>
                <span className="text-[6.5px] text-zinc-550 font-bold uppercase tracking-wider">
                  LOGARITHMIC SWEEPS
                </span>
              </div>

              {/* Envelope Vector Visualizer */}
              <div className="h-10 bg-black/50 border border-zinc-900/80 rounded-none overflow-hidden relative flex items-center justify-center mb-1">
                <svg className="w-full h-full text-cyan-400" viewBox="0 0 100 35" preserveAspectRatio="none">
                  {/* Visual grid reference lines */}
                  <line x1="0" y1="33" x2="100" y2="33" stroke="#164e63" strokeWidth="1" strokeDasharray="2,2" opacity="0.4" />
                  <line x1="0" y1="18" x2="100" y2="18" stroke="#164e63" strokeWidth="0.5" strokeDasharray="2,4" opacity="0.4" />
                  <line x1="0" y1="2" x2="100" y2="2" stroke="#164e63" strokeWidth="0.5" strokeDasharray="2,4" opacity="0.4" />
                  
                  {/* Ambient Gradient Fill */}
                  <path
                    d={`${filterPath} L 100 35 L 0 35 Z`}
                    fill="url(#filter-gradient)"
                    className="transition-all duration-75"
                  />
                  
                  {/* Glowing Vector Outline */}
                  <path
                    d={filterPath}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="transition-all duration-75"
                  />
                  
                  <defs>
                    <linearGradient id="filter-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              <div className="flex items-center justify-around gap-1 py-0.5">
                <Knob
                  label="ATT"
                  value={settings.filterEnv.attack}
                  min={0}
                  max={100}
                  color="cyan"
                  onChange={(val) => updateSetting(p => ({ ...p, filterEnv: { ...p.filterEnv, attack: val } }))}
                  title="Filter Cutoff Attack sweep phase duration"
                />
                <Knob
                  label="DEC"
                  value={settings.filterEnv.decay}
                  min={0}
                  max={100}
                  color="cyan"
                  onChange={(val) => updateSetting(p => ({ ...p, filterEnv: { ...p.filterEnv, decay: val } }))}
                  title="Filter Cutoff Decay sweep phase duration"
                />
                <Knob
                  label="SUST"
                  value={settings.filterEnv.sustain}
                  min={0}
                  max={100}
                  color="cyan"
                  onChange={(val) => updateSetting(p => ({ ...p, filterEnv: { ...p.filterEnv, sustain: val } }))}
                  title="Filter Cutoff Sustain depth hold percentage"
                />
                <Knob
                  label="REL"
                  value={settings.filterEnv.release}
                  min={0}
                  max={100}
                  color="cyan"
                  onChange={(val) => updateSetting(p => ({ ...p, filterEnv: { ...p.filterEnv, release: val } }))}
                  title="Filter Cutoff Release recovery phase duration"
                />
              </div>
            </div>

            {/* MASTER LEVEL CONTROL */}
            <div className="border border-zinc-850/60 bg-black/30 px-3 py-1.5 rounded-none flex items-center justify-between mt-auto">
              <span className="text-[7.5px] font-bold text-zinc-550 uppercase tracking-widest">
                INSTRUMENT OVERALL TRIM
              </span>
              <div className="flex items-center gap-4 scale-95">
                <div className="text-[7px] text-zinc-500 font-extrabold uppercase mr-1">MASTER GAIN</div>
                <Knob
                  label="VOL"
                  value={settings.masterGain}
                  min={0}
                  max={100}
                  color="amber"
                  onChange={(val) => updateSetting(prev => ({ ...prev, masterGain: val }))}
                  title="Master synthesizer output level adjust"
                />
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Footer Diagnostic Panel */}
      <div className="flex items-center justify-between border-t border-neutral-900 pt-2 shrink-0 z-10 text-[8px] text-zinc-500 font-bold uppercase tracking-widest">
        <div className="flex items-center gap-1.5">
          <span className="text-[#3b82f6]">HARDWARE ROW ROUTE:</span>
          <span className="text-emerald-400 font-extrabold">{channelId || "DEFAULT BUS"}</span>
        </div>
        <div className="flex items-center gap-1.5 text-rose-500/80 font-black">
          <ShieldAlert className="h-3 w-3 shrink-0" />
          POLY DECAY STAGES ACTIVE
        </div>
      </div>
    </div>
  );
}
