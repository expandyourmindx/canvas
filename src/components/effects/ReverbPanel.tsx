import React, { useState, useEffect } from "react";
import { useAudioEngine } from "../../audio/useAudioEngine";
import { Knob } from "../ChannelRack";
import { Power, RefreshCw, Sparkles } from "lucide-react";

interface ReverbPanelProps {
  insertIndex: number;
  slotIndex: number;
  onClose: () => void;
}

export function ReverbPanel({ insertIndex, slotIndex, onClose }: ReverbPanelProps) {
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
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 font-mono py-10 gap-3">
        <RefreshCw className="h-5 w-5 animate-spin text-indigo-500" />
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
    <div className="flex flex-col h-full bg-[#0d0e12] select-none p-4 font-mono text-[10px] text-zinc-300 rounded-none border border-neutral-850">
      
      {/* 1. Hardware Header Deck */}
      <div className="flex items-center justify-between border-b border-neutral-850/50 pb-2 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
          <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase">
            CONVOLUTION REVERB
          </span>
        </div>
        <div className="text-[7.5px] text-zinc-650 font-bold uppercase tracking-wider">
          Analog Synthesized IR Model
        </div>
      </div>

      {/* 2. Control Rack Dashboard */}
      <div className="flex items-center justify-between gap-6 flex-1 px-2">
        
        {/* Bypass Switch Panel */}
        <div className="flex flex-col items-center gap-2 pr-4 border-r border-neutral-850/40 font-mono">
          <button
            onClick={toggleBypass}
            className={`w-8 h-8 rounded-none border flex items-center justify-center cursor-pointer transition-all duration-150 ${
              bypassState
                ? "bg-red-500/10 border-red-500/30 text-red-500 animate-pulse"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/15"
            }`}
            title={bypassState ? "Enable Effect" : "Bypass Effect"}
          >
            <Power className="h-4 w-4" />
          </button>
          <span className={`text-[6.5px] font-bold tracking-widest uppercase ${
            bypassState ? "text-red-550" : "text-emerald-400"
          }`}>
            {bypassState ? "BYPASS" : "ACTIVE"}
          </span>
        </div>

        {/* Knobs Deck */}
        <div className="flex-1 flex justify-around items-center">
          
          {/* Knob 1: Room Size */}
          <div className="flex flex-col items-center gap-1.5">
            <Knob
              label="ROOM"
              value={roomSizeVal}
              min={10}
              max={500}
              color="cyan"
              onChange={handleRoomSizeChange}
              title="Impulse Response Length"
              defaultValue={200}
            />
            <div className="flex flex-col items-center font-mono text-[7.5px] leading-none mt-1">
              <span className="text-zinc-400 font-extrabold uppercase">SIZE</span>
              <span className="text-zinc-550 mt-1">{(roomSizeVal / 100).toFixed(2)}s</span>
            </div>
          </div>

          {/* Knob 2: Decay */}
          <div className="flex flex-col items-center gap-1.5">
            <Knob
              label="DECAY"
              value={decayVal}
              min={10}
              max={1000}
              color="cyan"
              onChange={handleDecayChange}
              title="Tail Falloff Rate"
              defaultValue={200}
            />
            <div className="flex flex-col items-center font-mono text-[7.5px] leading-none mt-1">
              <span className="text-zinc-400 font-extrabold uppercase">RATE</span>
              <span className="text-zinc-550 mt-1">{(decayVal / 100).toFixed(2)}</span>
            </div>
          </div>

          {/* Knob 3: Wet/Dry */}
          <div className="flex flex-col items-center gap-1.5">
            <Knob
              label="MIX"
              value={wetDryVal}
              min={0}
              max={100}
              color="cyan"
              onChange={handleWetDryChange}
              title="Dry/Wet Crossfade Ratio"
              defaultValue={50}
            />
            <div className="flex flex-col items-center font-mono text-[7.5px] leading-none mt-1">
              <span className="text-zinc-400 font-extrabold uppercase">WET</span>
              <span className="text-zinc-550 mt-1">{wetDryVal}%</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
