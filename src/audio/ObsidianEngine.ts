/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DAWEvent } from "./AudioEngine";
import { ObsidianSettings } from "../types";

export class ObsidianEngine {
  private audioContext: AudioContext;
  private activeObsidianVoices: Map<string, any[]> = new Map();
  public obsidianSettings: Record<string, ObsidianSettings> = {};

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  public getDefaultSettings(): ObsidianSettings {
    return {
      monoPoly: "poly" as const,
      glide: 20,
      oscillators: {
        osc1: {
          waveform: "sawtooth",
          volume: 65,
          pan: -10,
          coarse: 0,
          fine: -5,
          enabled: true
        },
        osc2: {
          waveform: "sawtooth",
          volume: 60,
          pan: 10,
          coarse: 0,
          fine: 5,
          enabled: true
        },
        osc3: {
          waveform: "triangle",
          volume: 40,
          pan: 0,
          coarse: -12, // Pitch detuned 1 octave below for sub weight
          fine: 0,
          enabled: true
        }
      },
      filterType: "lowpass",
      cutoff: 40, // Warmly closed cutoff
      resonance: 18, // Soft analog peak
      filterEnvAmount: 45, // Pleasing opening filter sweep
      unisonVoices: 1, // Default to single voice (unison off)
      unisonDetune: 15,
      subOscWave: "sine", // Thick sine sub-bass reinforcement
      subOscVol: 25,
      lfoRate: 3.5, // Slow LFO speed
      lfoToPitch: 2, // Ultra subtle drift for vintage analog warmth
      lfoToFilter: 5, // Organic filter breathing
      lfoToVolume: 0,
      lfoBypass: false,
      ampEnv: {
        attack: 8, // Soft start to eliminate harsh transient clicks
        decay: 35,
        sustain: 75,
        release: 30
      },
      filterEnv: {
        attack: 20, // Sweet, slow-opening filter envelope attack
        decay: 40,
        sustain: 30,
        release: 40
      },
      masterGain: 75
    };
  }

  private cutoffToHz(cutoff: number): number {
    return Math.max(20, Math.min(20000,
      20 * Math.exp((cutoff / 100) * Math.log(20000 / 20))
    ));
  }

  public getSettings(channelId: string): ObsidianSettings {
    return this.obsidianSettings[channelId] || this.getDefaultSettings();
  }

  public updateSettings(channelId: string, settings: ObsidianSettings) {
    this.obsidianSettings[channelId] = settings;

    // Real-time active voice parameter updates
    const voices = this.activeObsidianVoices.get(channelId);
    if (voices && voices.length > 0) {
      const now = this.audioContext.currentTime;
      const baseCutoffHz = this.cutoffToHz(settings.cutoff);
      const resonanceQ = 0.0001 + (settings.resonance / 100) * 12.0;
      const masterVolume = settings.masterGain / 100;

      voices.forEach((voice) => {
        try {
          // Smoothly sweep target fader values using a safe 25ms constant
          // without calling cancelScheduledValues, which destroys the active ADSR envelope sweeps and causes popping.
          if (voice.filterNode) {
            voice.filterNode.frequency.cancelScheduledValues(now);
            voice.filterNode.frequency.setValueAtTime(voice.filterNode.frequency.value, now);
            voice.filterNode.frequency.setTargetAtTime(baseCutoffHz, now, 0.025);

            voice.filterNode.Q.cancelScheduledValues(now);
            voice.filterNode.Q.setValueAtTime(voice.filterNode.Q.value, now);
            voice.filterNode.Q.setTargetAtTime(resonanceQ, now, 0.025);
          }

          if (voice.masterVca) {
            const velFactor = voice.velocity !== undefined ? voice.velocity : 1.0;
            voice.masterVca.gain.setTargetAtTime(masterVolume * velFactor, now, 0.025);
          }

          if (voice.lfoNode) {
            voice.lfoNode.frequency.setTargetAtTime(settings.lfoRate ?? 5.0, now, 0.025);
          }

          if (voice.tremoloVca && voice.tremoloModGain) {
            const lfoVolDepth = settings.lfoBypass ? 0 : (settings.lfoToVolume / 100);
            const tremoloBase = 1.0 - lfoVolDepth * 0.4;
            voice.tremoloVca.gain.setTargetAtTime(tremoloBase, now, 0.025);
            voice.tremoloModGain.gain.setTargetAtTime(lfoVolDepth * 0.4, now, 0.025);
          }

          if (voice.pitchModGain) {
            const depth = settings.lfoBypass ? 0 : (settings.lfoToPitch / 100);
            voice.pitchModGain.gain.setTargetAtTime(depth * 15, now, 0.025);
          }

          if (voice.filterModGain) {
            const depth = settings.lfoBypass ? 0 : (settings.lfoToFilter / 100);
            voice.filterModGain.gain.setTargetAtTime(depth * 3000, now, 0.025);
          }
        } catch (err) {
          console.error("Error sweeping voice parameters in real-time", err);
        }
      });
    }
  }

  private disconnectVoiceNodes(voice: any) {
    try {
      if (voice.oscillators) voice.oscillators.forEach((osc: any) => osc.disconnect());
      if (voice.panners) voice.panners.forEach((pan: any) => pan?.disconnect());
      if (voice.gainNodes) voice.gainNodes.forEach((gain: any) => gain.disconnect());
      if (voice.lfoNode) voice.lfoNode.disconnect();
      if (voice.pitchModGain) voice.pitchModGain.disconnect();
      if (voice.filterModGain) voice.filterModGain.disconnect();
      if (voice.tremoloModGain) voice.tremoloModGain.disconnect();
      if (voice.tremoloVca) voice.tremoloVca.disconnect();
      if (voice.filterNode) voice.filterNode.disconnect();
      if (voice.ampVca) voice.ampVca.disconnect();
      if (voice.masterVca) voice.masterVca.disconnect();
    } catch (err) {
      // ignore
    }
  }

  /**
   * Encapsulated, high-performance voice generation engine core.
   * Builds the stacked oscillators unison detuner, sub-oscillator, LFO modulation mappings,
   * de-clicked logarithmic envelopes, and applies energy-preserving sum gains.
   */
  private createVoice(
    channelId: string,
    midiNote: number,
    velocity: number = 80,
    startTime: number,
    durationSeconds?: number,
    destinationNode?: AudioNode
  ): any {
    const settings = this.getSettings(channelId);
    const now = startTime;

    // 1. Legato / Legato Glide mono voicing handling
    const existingVoices = this.activeObsidianVoices.get(channelId) || [];
    const activeVoices = existingVoices.filter((v) => {
      if (v.stopTime && now >= v.stopTime) {
        this.disconnectVoiceNodes(v);
        return false;
      }
      return true;
    });

    if (settings.monoPoly === "mono" && activeVoices.length > 0) {
      const activeVoice = activeVoices[activeVoices.length - 1];
      if (activeVoice) {
        // 1. Reset release state and stop time
        activeVoice.isReleasing = false;
        activeVoice.stopTime = null;

        // 2. Cancel any previously scheduled osc.stop() on all oscillators
        activeVoice.oscillators.forEach((osc: any) => {
          try {
            osc.stop(now + 9999);
          } catch (e) { }
        });
        if (activeVoice.lfoNode) {
          try {
            activeVoice.lfoNode.stop(now + 9999);
          } catch (e) { }
        }

        // 3. Retrigger Amplitude Envelope from current gain value
        const ampAttackSecs = Math.max(0.002, (settings.ampEnv.attack / 100) * 4.0);
        const ampDecaySecs = Math.max(0.002, (settings.ampEnv.decay / 100) * 4.0);
        const ampSustainLevel = (settings.ampEnv.sustain / 100);

        activeVoice.ampVca.gain.cancelScheduledValues(now);
        activeVoice.ampVca.gain.setValueAtTime(activeVoice.ampVca.gain.value, now);

        if (durationSeconds !== undefined) {
          const attackEnd = now + ampAttackSecs;
          const decayEnd = attackEnd + ampDecaySecs;
          const releaseStart = now + durationSeconds;

          activeVoice.ampVca.gain.setTargetAtTime(1.0, now, ampAttackSecs / 3);

          if (decayEnd < releaseStart) {
            activeVoice.ampVca.gain.setTargetAtTime(ampSustainLevel, attackEnd, ampDecaySecs / 3);
            activeVoice.ampVca.gain.setValueAtTime(ampSustainLevel, releaseStart);
          } else {
            activeVoice.ampVca.gain.setTargetAtTime(ampSustainLevel, releaseStart, ampDecaySecs / 3);
          }
        } else {
          // Continuous keyboard note
          activeVoice.ampVca.gain.setTargetAtTime(1.0, now, ampAttackSecs / 3);
          activeVoice.ampVca.gain.setTargetAtTime(ampSustainLevel, now + ampAttackSecs, ampDecaySecs / 3);
        }

        // 4. Glide oscillator frequencies to new pitch as normal
        const glideValue = settings.glide ?? 20;
        const glideSecs = (glideValue / 100) * 1.5;
        const targetPitch = midiNote;

        activeVoice.pitch = targetPitch;
        activeVoice.midiNote = midiNote;

        activeVoice.oscillators.forEach((osc: any) => {
          const coarse = osc.coarseOffset || 0;
          const fine = osc.fineOffset || 0;
          const unisonDetuneCents = osc.unisonOffset || 0;

          const oPitch = targetPitch + coarse + (fine / 100) + (unisonDetuneCents / 100);
          const oFreq = 440 * Math.pow(2, (oPitch - 69) / 12);

          osc.frequency.cancelScheduledValues(now);
          osc.frequency.setValueAtTime(osc.frequency.value, now);
          osc.frequency.linearRampToValueAtTime(oFreq, now + glideSecs);
        });

        // 5. Retrigger Filter Envelope from its current value
        const baseCutoffHz = this.cutoffToHz(settings.cutoff);
        const resonanceQ = 0.0001 + (settings.resonance / 100) * 12.0;
        activeVoice.filterNode.Q.setValueAtTime(resonanceQ, now);

        const filterEnvAmt = (settings.filterEnvAmount !== undefined ? settings.filterEnvAmount : 50) / 100;
        const filterAttackSecs = Math.max(0.005, (settings.filterEnv.attack / 100) * 4.0);
        const filterDecaySecs = Math.max(0.005, (settings.filterEnv.decay / 100) * 4.0);
        const filterSustain = settings.filterEnv.sustain;

        const peakCutoffHz = Math.min(20000, baseCutoffHz + (16000 * filterEnvAmt));
        const sustainFreq = baseCutoffHz + (peakCutoffHz - baseCutoffHz) * (filterSustain / 100);

        activeVoice.filterNode.frequency.cancelScheduledValues(now);
        activeVoice.filterNode.frequency.setValueAtTime(activeVoice.filterNode.frequency.value, now);

        if (durationSeconds !== undefined) {
          const attackEnd = now + filterAttackSecs;
          const decayEnd = attackEnd + filterDecaySecs;
          const releaseStart = now + durationSeconds;

          activeVoice.filterNode.frequency.setTargetAtTime(peakCutoffHz, now, filterAttackSecs / 2);

          if (decayEnd < releaseStart) {
            activeVoice.filterNode.frequency.setTargetAtTime(sustainFreq, attackEnd, filterDecaySecs / 2);
            activeVoice.filterNode.frequency.setValueAtTime(sustainFreq, releaseStart);
          } else {
            activeVoice.filterNode.frequency.setTargetAtTime(sustainFreq, releaseStart, filterDecaySecs / 2);
          }
        } else {
          // Continuous keyboard note
          activeVoice.filterNode.frequency.setTargetAtTime(peakCutoffHz, now, filterAttackSecs / 2);
          activeVoice.filterNode.frequency.setTargetAtTime(sustainFreq, now + filterAttackSecs, filterDecaySecs / 2);
        }

        // 6. Reschedule the release if durationSeconds is provided
        if (durationSeconds !== undefined) {
          const ampReleaseSecs = Math.max(0.002, (settings.ampEnv.release / 100) * 5.0);
          const filterReleaseSecs = Math.max(0.002, (settings.filterEnv.release / 100) * 5.0);
          const nextReleaseStart = now + durationSeconds;
          const nextReleaseEnd = nextReleaseStart + ampReleaseSecs;

          activeVoice.ampVca.gain.setTargetAtTime(0.0001, nextReleaseStart, ampReleaseSecs / 3);
          activeVoice.filterNode.frequency.setTargetAtTime(baseCutoffHz, nextReleaseStart, filterReleaseSecs / 3);

          activeVoice.stopTime = nextReleaseEnd + 0.1;

          activeVoice.oscillators.forEach((osc: any) => {
            try {
              osc.stop(activeVoice.stopTime);
            } catch (e) { }
          });
          if (activeVoice.lfoNode) {
            try {
              activeVoice.lfoNode.stop(activeVoice.stopTime);
            } catch (e) { }
          }
        }

        this.activeObsidianVoices.set(channelId, activeVoices);
        return activeVoice;
      }
    }

    // 2. Polyphony Limit & Voice Stealing
    const maxVoices = 12;
    if (activeVoices.length >= maxVoices) {
      const stolenVoice = activeVoices.shift();
      if (stolenVoice) {
        stolenVoice.masterVca.gain.cancelScheduledValues(now);
        stolenVoice.masterVca.gain.setValueAtTime(stolenVoice.masterVca.gain.value, now);
        stolenVoice.masterVca.gain.linearRampToValueAtTime(0.0001, now + 0.005);
        stolenVoice.stopTime = now + 0.006;

        stolenVoice.oscillators.forEach((osc: any) => {
          try {
            osc.stop(now + 0.006);
          } catch (e) { }
        });
      }
    }

    // 3. Audio Node Stack Construction
    const oscNodes: OscillatorNode[] = [];
    const pannerNodes: StereoPannerNode[] = [];
    const oscGainNodes: GainNode[] = [];

    const unisonVoicesCount = settings.unisonVoices || 1;
    const unisonDetuneCents = settings.unisonDetune !== undefined ? settings.unisonDetune : 15;

    // Summing Gain calculation to prevent digital clipping
    let activeOscillatorCount = 0;
    for (let idx = 1; idx <= 3; idx++) {
      if (settings.oscillators[`osc${idx}`]?.enabled !== false) {
        activeOscillatorCount++;
      }
    }
    const hasSubOsc = settings.subOscWave && settings.subOscWave !== "off";
    const totalGenerators = (activeOscillatorCount * unisonVoicesCount);
    const summingFactor = Math.max(1, totalGenerators);
    // Square root energy normalization
    const energyScale = 1.0 / Math.sqrt(summingFactor);

    // Build main primary oscillators (including detuned unison voice layers)
    for (let idx = 1; idx <= 3; idx++) {
      const oscKey = `osc${idx}`;
      const oscSettings = settings.oscillators[oscKey];
      if (!oscSettings) continue;

      const oscVolume = oscSettings.enabled === false ? 0 : ((oscSettings.volume ?? 50) / 100);
      const coarse = oscSettings.coarse ?? 0;
      const fine = oscSettings.fine ?? 0;
      const panVal = oscSettings.pan ?? 0;

      // Unison voice stack allocations
      const voicesToCreate = oscSettings.enabled === false ? 0 : unisonVoicesCount;

      for (let vIdx = 0; vIdx < voicesToCreate; vIdx++) {
        // Distribute pitches and pans across unison stack
        let detuneOffset = 0;
        let panOffset = 0;

        if (voicesToCreate === 3) {
          if (vIdx === 1) { detuneOffset = -unisonDetuneCents; panOffset = -25; }
          if (vIdx === 2) { detuneOffset = unisonDetuneCents; panOffset = 25; }
        } else if (voicesToCreate === 5) {
          if (vIdx === 1) { detuneOffset = -unisonDetuneCents; panOffset = -15; }
          if (vIdx === 2) { detuneOffset = unisonDetuneCents; panOffset = 15; }
          if (vIdx === 3) { detuneOffset = -unisonDetuneCents * 2; panOffset = -35; }
          if (vIdx === 4) { detuneOffset = unisonDetuneCents * 2; panOffset = 35; }
        }

        const effectiveOscPitch = midiNote + coarse + (fine / 100) + (detuneOffset / 100);
        const oscFreq = 440 * Math.pow(2, (effectiveOscPitch - 69) / 12);

        const oscNode = this.audioContext.createOscillator();
        oscNode.type = oscSettings.waveform || "sine";
        oscNode.frequency.setValueAtTime(oscFreq, now);

        // Cache tuning boundaries for legato glides
        (oscNode as any).coarseOffset = coarse;
        (oscNode as any).fineOffset = fine;
        (oscNode as any).unisonOffset = detuneOffset;

        const pannerNode = this.audioContext.createStereoPanner ? this.audioContext.createStereoPanner() : null;
        if (pannerNode) {
          const mappedPan = Math.max(-1.0, Math.min(1.0, (panVal + panOffset) / 50));
          pannerNode.pan.setValueAtTime(mappedPan, now);
        }

        const gainNode = this.audioContext.createGain();
        // Scale gain using energy normalization to prevent digital clipping!
        const scaleVolume = oscVolume * energyScale;
        gainNode.gain.setValueAtTime(scaleVolume, now);

        oscNode.connect(pannerNode || gainNode);
        if (pannerNode) {
          pannerNode.connect(gainNode);
          pannerNodes.push(pannerNode);
        }

        oscNodes.push(oscNode);
        oscGainNodes.push(gainNode);
      }
    }

    // Build the Sub-Oscillator (sub bass generation pitched 1 octave below fundamental)
    if (hasSubOsc) {
      const subOscNode = this.audioContext.createOscillator();
      subOscNode.type = settings.subOscWave as OscillatorType;
      const subFreq = 440 * Math.pow(2, ((midiNote - 12) - 69) / 12);
      subOscNode.frequency.setValueAtTime(subFreq, now);

      (subOscNode as any).coarseOffset = -12;
      (subOscNode as any).fineOffset = 0;
      (subOscNode as any).unisonOffset = 0;

      const subVolVal = (settings.subOscVol !== undefined ? settings.subOscVol : 30) / 100;
      const gainNode = this.audioContext.createGain();
      gainNode.gain.setValueAtTime(subVolVal, now);

      subOscNode.connect(gainNode);

      oscNodes.push(subOscNode);
      oscGainNodes.push(gainNode);
    }

    // 4. Summing Stage & Filter Matrix
    const filterNode = this.audioContext.createBiquadFilter();
    filterNode.type = settings.filterType || "lowpass";
    oscGainNodes.forEach((gn) => gn.connect(filterNode));

    // LFO Modulation Matrix Routing
    const lfoNode = this.audioContext.createOscillator();
    lfoNode.type = "sine";
    lfoNode.frequency.setValueAtTime(settings.lfoRate ?? 5.0, now);

    // LFO to Pitch Vibrato connection
    const pitchModGain = this.audioContext.createGain();
    const initialPitchDepth = settings.lfoBypass ? 0 : (settings.lfoToPitch / 100);
    pitchModGain.gain.setValueAtTime(initialPitchDepth * 15, now);
    lfoNode.connect(pitchModGain);
    oscNodes.forEach(osc => pitchModGain.connect(osc.frequency));

    // LFO to Filter Wobble connection
    const filterModGain = this.audioContext.createGain();
    const initialFilterDepth = settings.lfoBypass ? 0 : (settings.lfoToFilter / 100);
    filterModGain.gain.setValueAtTime(initialFilterDepth * 3000, now);
    lfoNode.connect(filterModGain);
    filterModGain.connect(filterNode.frequency);

    // LFO to Volume Tremolo connection
    const tremoloVca = this.audioContext.createGain();
    const lfoVolDepth = settings.lfoBypass ? 0 : (settings.lfoToVolume / 100);
    const tremoloBase = 1.0 - lfoVolDepth * 0.4;
    tremoloVca.gain.setValueAtTime(tremoloBase, now);

    const tremoloModGain = this.audioContext.createGain();
    tremoloModGain.gain.setValueAtTime(lfoVolDepth * 0.4, now);
    lfoNode.connect(tremoloModGain);
    tremoloModGain.connect(tremoloVca.gain);

    filterNode.connect(tremoloVca);

    // 5. Envelope Sculpting (Smooth Logarithmic / Exponential Transitions)
    const baseCutoffHz = this.cutoffToHz(settings.cutoff);
    const resonanceQ = 0.0001 + (settings.resonance / 100) * 12.0;
    filterNode.Q.setValueAtTime(resonanceQ, now);

    const filterEnvAmt = (settings.filterEnvAmount !== undefined ? settings.filterEnvAmount : 50) / 100;
    const filterAttackSecs = Math.max(0.005, (settings.filterEnv.attack / 100) * 4.0);
    const filterDecaySecs = Math.max(0.005, (settings.filterEnv.decay / 100) * 4.0);
    const filterSustain = settings.filterEnv.sustain;

    const peakCutoffHz = Math.min(20000, baseCutoffHz + (16000 * filterEnvAmt));
    const sustainFreq = baseCutoffHz + (peakCutoffHz - baseCutoffHz) * (filterSustain / 100);

    // Filter Envelope Sweep
    filterNode.frequency.setValueAtTime(baseCutoffHz, now);
    if (durationSeconds !== undefined) {
      const attackEnd = now + filterAttackSecs;
      const decayEnd = attackEnd + filterDecaySecs;
      const releaseStart = now + durationSeconds;

      filterNode.frequency.setTargetAtTime(peakCutoffHz, now, filterAttackSecs / 2);

      if (decayEnd < releaseStart) {
        filterNode.frequency.setTargetAtTime(sustainFreq, attackEnd, filterDecaySecs / 2);
        filterNode.frequency.setValueAtTime(sustainFreq, releaseStart);
      } else {
        filterNode.frequency.setTargetAtTime(sustainFreq, releaseStart, filterDecaySecs / 2);
      }
    } else {
      // Real-time keyboard ADSR sweep
      filterNode.frequency.setTargetAtTime(peakCutoffHz, now, filterAttackSecs / 2);
      filterNode.frequency.setTargetAtTime(sustainFreq, now + filterAttackSecs, filterDecaySecs / 2);
    }

    // Amplitude ADSR VCA Stage
    const ampVca = this.audioContext.createGain();
    const ampAttackSecs = Math.max(0.002, (settings.ampEnv.attack / 100) * 4.0);
    const ampDecaySecs = Math.max(0.002, (settings.ampEnv.decay / 100) * 4.0);
    const ampSustainLevel = (settings.ampEnv.sustain / 100);

    tremoloVca.connect(ampVca);

    ampVca.gain.setValueAtTime(0.0001, now);
    if (durationSeconds !== undefined) {
      const attackEnd = now + ampAttackSecs;
      const decayEnd = attackEnd + ampDecaySecs;
      const releaseStart = now + durationSeconds;

      ampVca.gain.setTargetAtTime(1.0, now, ampAttackSecs / 3);

      if (decayEnd < releaseStart) {
        ampVca.gain.setTargetAtTime(ampSustainLevel, attackEnd, ampDecaySecs / 3);
        ampVca.gain.setValueAtTime(ampSustainLevel, releaseStart);
      } else {
        ampVca.gain.setTargetAtTime(ampSustainLevel, releaseStart, ampDecaySecs / 3);
      }
    } else {
      // Real-time keyboard note ADSR
      ampVca.gain.setTargetAtTime(1.0, now, ampAttackSecs / 3);
      ampVca.gain.setTargetAtTime(ampSustainLevel, now + ampAttackSecs, ampDecaySecs / 3);
    }

    // 6. Master Volume Out Stage
    const masterVca = this.audioContext.createGain();
    const masterVolume = (settings.masterGain / 100) * (velocity / 127);
    masterVca.gain.setValueAtTime(masterVolume, now);

    ampVca.connect(masterVca);
    if (destinationNode) {
      masterVca.connect(destinationNode);
    }

    // Start hardware threads
    oscNodes.forEach(osc => osc.start(now));
    lfoNode.start(now);

    let stopTime = null;
    if (durationSeconds !== undefined) {
      const ampReleaseSecs = Math.max(0.002, (settings.ampEnv.release / 100) * 5.0);
      const filterReleaseSecs = Math.max(0.002, (settings.filterEnv.release / 100) * 5.0);
      const releaseStart = now + durationSeconds;
      const releaseEnd = releaseStart + ampReleaseSecs;

      ampVca.gain.setTargetAtTime(0.0001, releaseStart, ampReleaseSecs / 3);
      filterNode.frequency.setTargetAtTime(baseCutoffHz, releaseStart, filterReleaseSecs / 3);

      stopTime = releaseEnd + 0.1;
      oscNodes.forEach(osc => osc.stop(stopTime));
      lfoNode.stop(stopTime);
    }

    const voice = {
      channelId,
      midiNote,
      noteId: `voice-${channelId}-${midiNote}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      pitch: midiNote,
      startTime: now,
      stopTime,
      oscillators: oscNodes,
      panners: pannerNodes,
      gainNodes: oscGainNodes,
      lfoNode,
      pitchModGain,
      filterModGain,
      tremoloModGain,
      tremoloVca,
      filterNode,
      ampVca,
      masterVca,
      isReleasing: false,
      velocity: velocity / 127
    };

    if (!(this.audioContext instanceof OfflineAudioContext) && oscNodes.length > 0) {
      oscNodes[0].onended = () => {
        this.disconnectVoiceNodes(voice);
        const currentList = this.activeObsidianVoices.get(channelId) || [];
        this.activeObsidianVoices.set(channelId, currentList.filter(v => v.noteId !== voice.noteId));
      };
    }

    activeVoices.push(voice);
    this.activeObsidianVoices.set(channelId, activeVoices);

    return voice;
  }

  public noteOn(
    channelId: string,
    midiNote: number,
    velocity: number = 80,
    time?: number,
    destinationNode?: AudioNode
  ) {
    const now = time !== undefined ? time : this.audioContext.currentTime;
    this.createVoice(channelId, midiNote, velocity, now, undefined, destinationNode);
  }

  public noteOff(channelId: string, midiNote: number, time?: number) {
    const now = time !== undefined ? time : this.audioContext.currentTime;
    const settings = this.getSettings(channelId);

    const ampReleaseSecs = Math.max(0.002, (settings.ampEnv.release / 100) * 5.0);
    const filterReleaseSecs = Math.max(0.002, (settings.filterEnv.release / 100) * 5.0);
    const baseCutoffHz = this.cutoffToHz(settings.cutoff);

    const existingVoices = this.activeObsidianVoices.get(channelId) || [];

    existingVoices.forEach((voice) => {
      if (voice.midiNote === midiNote && !voice.isReleasing) {
        voice.isReleasing = true;

        voice.ampVca.gain.cancelScheduledValues(now);
        voice.ampVca.gain.setValueAtTime(voice.ampVca.gain.value, now);
        voice.ampVca.gain.setTargetAtTime(0.0001, now, ampReleaseSecs / 3);

        voice.filterNode.frequency.cancelScheduledValues(now);
        voice.filterNode.frequency.setValueAtTime(voice.filterNode.frequency.value, now);
        voice.filterNode.frequency.setTargetAtTime(baseCutoffHz, now, filterReleaseSecs / 3);

        const stopTime = now + Math.max(ampReleaseSecs, filterReleaseSecs) + 0.1;
        voice.stopTime = stopTime;

        voice.oscillators.forEach((osc: any) => {
          try {
            osc.stop(stopTime);
          } catch (e) { }
        });
        if (voice.lfoNode) {
          try {
            voice.lfoNode.stop(stopTime);
          } catch (e) { }
        }
      }
    });
  }

  public triggerVoice(
    event: DAWEvent,
    absoluteContextTime: number,
    durationSeconds: number,
    destinationNode?: AudioNode
  ) {
    const channelId = event.channelId;
    if (!channelId) return;

    const midiNote = event.pitch ?? 60;
    const velocity = Math.round((event.velocity ?? 0.8) * 127);
    this.createVoice(channelId, midiNote, velocity, absoluteContextTime, durationSeconds, destinationNode);
  }

  public stopAll(fadeOutSeconds: number = 0.05, stopTime?: number): void {
    const now = stopTime !== undefined ? stopTime : this.audioContext.currentTime;
    this.activeObsidianVoices.forEach((voices) => {
      voices.forEach((voice) => {
        try {
          // Fade out the master VCA to silence
          voice.masterVca.gain.cancelScheduledValues(now);
          voice.masterVca.gain.setValueAtTime(voice.masterVca.gain.value, now);
          voice.masterVca.gain.linearRampToValueAtTime(0.0001, now + fadeOutSeconds);
          // Stop oscillators after fade
          voice.oscillators.forEach((osc: any) => {
            try { osc.stop(now + fadeOutSeconds + 0.01); } catch (e) {}
          });
          if (voice.lfoNode) {
            try { voice.lfoNode.stop(now + fadeOutSeconds + 0.01); } catch (e) {}
          }
        } catch (err) {}
      });
    });
    // Clear the map immediately so new voices can be created
    this.activeObsidianVoices.clear();
  }
}
