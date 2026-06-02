/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PatternNote {
  pitch?: number;
  time: number; // relative beat position inside the pattern block-level grid
  duration: number; // note duration in beats
  velocity: number;
  sampleId?: string;
  channelId?: string;
}

export interface PatternData {
  id: string;
  name: string;
  notes: PatternNote[];
  color?: string;
}

export interface CanvasClip {
  id: string;
  type: "pattern" | "sample";
  startBeat: number; // absolute X-axis timeline position in beats
  duration: number; // visual frame size in beats
  laneIndex: number; // visual Y-axis lane index (completely unbound)
  referenceId: string; // references a registered sample ID or registered pattern ID
  
  // Visual metadata
  name?: string;
  color?: string;
  cropStart?: number; // visual left cropping offset (positive crops start of sample; negative represents pre-gap padding/delay)
}

export interface ChannelRow {
  id: string;
  name: string;
  type: "sample" | "pitch";
  sampleId?: string;
  pitch?: number;
  mixerTarget: number;
  instrumentType?: "sampler" | "obsidian";
}

export interface SamplerSettings {
  pitch: number;          // -12 to +12 semitones
  sampleStart: number;    // 0% to 100%
  envelopeOn: boolean;
  attack: number;         // 0% to 100%
  decay: number;          // 0% to 100%
  sustain: number;        // 0% to 100%
  release: number;        // 0% to 100%

  // Time Stretching Settings
  stretchMode?: "resample" | "stretch";
  stretchPitch?: number;  // cents, -1200 to +1200
  stretchMul?: number;    // factor, 0.5 to 2.0
  stretchTime?: number;   // length in beats, 0 represents Auto
}

export interface OscillatorSettings {
  waveform: "sine" | "square" | "sawtooth" | "triangle";
  volume: number;
  pan: number;
  coarse: number;
  fine: number;
  enabled?: boolean;
}

export interface ObsidianSettings {
  monoPoly: "mono" | "poly";
  glide: number;
  oscillators: {
    osc1: OscillatorSettings;
    osc2: OscillatorSettings;
    osc3: OscillatorSettings;
    [key: string]: OscillatorSettings;
  };
  filterType: "lowpass" | "highpass" | "bandpass";
  cutoff: number;
  resonance: number;
  filterEnvAmount?: number;
  unisonVoices?: number;
  unisonDetune?: number;
  subOscWave?: "off" | "sine" | "square" | "sawtooth" | "triangle";
  subOscVol?: number;
  lfoRate?: number;
  lfoToPitch?: number;
  lfoToFilter?: number;
  lfoToVolume?: number;
  lfoBypass?: boolean;
  ampEnv: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
  filterEnv: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
  masterGain: number;
}

export interface DAWEvent {
  id: string;
  time: number;       // Position on the timeline (in beats, floating-point)
  duration: number;   // Length of the note/sample active window (in beats, floating-point)
  pitch?: number;     // MIDI note number (e.g., 60 = Middle C)
  velocity: number;   // Event volume/velocity [0.0 - 1.0]
  sampleId?: string;  // ID of the audio sample in our registry (Optional)
  channelId?: string; // ID of the channel row that scheduled this event (Optional)
}

export interface EQBandSettings {
  frequency: number;
  gain: number;
  q: number;
  type: "lowcut" | "lowshelf" | "peaking" | "highshelf" | "highcut" | "notch" | "bandpass";
  bypass: boolean;
}

export interface ParametricEQSettings {
  bands: EQBandSettings[];
}

export interface ReverbSettings {
  roomSize: number;
  decay: number;
  wetDry: number;
}

export interface MixerInsert {
  index: number;
  name: string;
  volume: number; // 0..100
  pan: number; // -50..50
  isMuted: boolean;
  isSoloed: boolean;
  gainNode?: GainNode;
  inputNode?: GainNode;
  pannerNode?: StereoPannerNode | null;
  analyserNode?: AnalyserNode;
  fxSlots: string[]; // 8 empty FX slots
  fxBypass?: boolean[]; // 8 FX bypass flags
  eqSettings?: Record<number, ParametricEQSettings>; // EQ settings indexed by slot index (0-7)
  reverbSettings?: Record<number, ReverbSettings>; // Reverb settings indexed by slot index (0-7)
}

export interface CanvasProject {
  version: string;
  savedAt: string;
  projectName?: string;
  bpm: number;
  playbackMode: "pattern" | "song";
  channels: ChannelRow[];
  channelVols: Record<string, number>;
  channelPans: Record<string, number>;
  channelMixers: Record<string, number>;
  stripColors?: Record<number, string>;
  events: DAWEvent[];
  canvasClips: CanvasClip[];
  patterns: PatternData[];
  samplerSettings: Record<string, SamplerSettings>;
  obsidianSettings: Record<string, ObsidianSettings>;
  mixerInserts: MixerInsert[];
  loopSettings: { loopStart: number; loopEnd: number; loopEnabled: boolean };
  sampleIds: string[];
}


