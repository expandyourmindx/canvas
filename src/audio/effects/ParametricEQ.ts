import { EQBandSettings, ParametricEQSettings } from "../../types";

export class ParametricEQ {
  public audioContext: AudioContext;
  public input: GainNode;
  public output: GainNode;
  public filters: BiquadFilterNode[] = [];
  public bands: EQBandSettings[] = [];

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.input = this.audioContext.createGain();
    this.output = this.audioContext.createGain();

    // Default layout
    const defaultBands: { frequency: number; type: EQBandSettings["type"]; q: number }[] = [
      { frequency: 80, type: "lowcut", q: 0.707 },
      { frequency: 200, type: "lowshelf", q: 0.707 },
      { frequency: 500, type: "peaking", q: 1.0 },
      { frequency: 1000, type: "peaking", q: 1.0 },
      { frequency: 4000, type: "peaking", q: 1.0 },
      { frequency: 8000, type: "highshelf", q: 0.707 },
      { frequency: 16000, type: "highcut", q: 0.707 },
    ];

    for (let i = 0; i < 7; i++) {
      const def = defaultBands[i];
      this.bands.push({
        frequency: def.frequency,
        gain: 0,
        q: def.q,
        type: def.type,
        bypass: false,
      });

      const filter = this.audioContext.createBiquadFilter();
      this.filters.push(filter);
    }

    this.applyBandParams();
    this.updateConnections();
  }

  // Update physical BiquadFilterNode values based on the JS state array
  public applyBandParams() {
    const now = this.audioContext.currentTime;
    for (let i = 0; i < 7; i++) {
      const band = this.bands[i];
      const filter = this.filters[i];

      filter.type = this.mapType(band.type);
      
      // Use setTargetAtTime for smooth, glitch-free audio parameter transitions
      filter.frequency.setTargetAtTime(band.frequency, now, 0.01);
      filter.gain.setTargetAtTime(band.gain, now, 0.01);
      filter.Q.setTargetAtTime(band.q, now, 0.01);
    }
  }

  private mapType(type: string): BiquadFilterType {
    switch (type) {
      case "lowcut": return "highpass";
      case "lowshelf": return "lowshelf";
      case "peaking": return "peaking";
      case "highshelf": return "highshelf";
      case "highcut": return "lowpass";
      case "notch": return "notch";
      case "bandpass": return "bandpass";
      default: return "peaking";
    }
  }

  public updateBand(index: number, settings: Partial<EQBandSettings>) {
    if (index < 0 || index >= 7) return;
    this.bands[index] = { ...this.bands[index], ...settings };
    
    // Apply parameters immediately
    const now = this.audioContext.currentTime;
    const band = this.bands[index];
    const filter = this.filters[index];
    
    if (settings.type !== undefined) {
      filter.type = this.mapType(band.type);
    }
    if (settings.frequency !== undefined) {
      filter.frequency.setTargetAtTime(band.frequency, now, 0.01);
    }
    if (settings.gain !== undefined) {
      filter.gain.setTargetAtTime(band.gain, now, 0.01);
    }
    if (settings.q !== undefined) {
      filter.Q.setTargetAtTime(band.q, now, 0.01);
    }

    if (settings.bypass !== undefined) {
      this.updateConnections();
    }
  }

  public updateConnections() {
    // 1. Disconnect all nodes
    this.input.disconnect();
    for (let i = 0; i < 7; i++) {
      this.filters[i].disconnect();
    }

    // 2. Chain active filters in series
    let lastNode: AudioNode = this.input;
    for (let i = 0; i < 7; i++) {
      const band = this.bands[i];
      const filter = this.filters[i];
      if (!band.bypass) {
        lastNode.connect(filter);
        lastNode = filter;
      }
    }
    lastNode.connect(this.output);
  }

  public getFrequencyResponseData(frequencies: Float32Array, magResponse: Float32Array) {
    const tempMag = new Float32Array(frequencies.length);
    const tempPhase = new Float32Array(frequencies.length);

    // Initialize magnitude response to 1 (0 dB)
    magResponse.fill(1.0);

    for (let i = 0; i < 7; i++) {
      const band = this.bands[i];
      const filter = this.filters[i];
      if (!band.bypass) {
        filter.getFrequencyResponse(frequencies, tempMag, tempPhase);
        for (let j = 0; j < frequencies.length; j++) {
          magResponse[j] *= tempMag[j];
        }
      }
    }
  }

  public serialize(): ParametricEQSettings {
    return {
      bands: this.bands.map(b => ({ ...b })),
    };
  }

  public deserialize(settings: ParametricEQSettings) {
    if (!settings || !settings.bands) return;
    for (let i = 0; i < 7; i++) {
      if (settings.bands[i]) {
        this.bands[i] = { ...settings.bands[i] };
      }
    }
    this.applyBandParams();
    this.updateConnections();
  }

  public disconnect() {
    this.input.disconnect();
    for (let i = 0; i < 7; i++) {
      this.filters[i].disconnect();
    }
    this.output.disconnect();
  }
}
