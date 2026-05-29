import { ReverbSettings } from "../../types";

export class Reverb {
  public audioContext: AudioContext;
  public input: GainNode;
  public output: GainNode;

  private convolver: ConvolverNode;
  private dryGainNode: GainNode;
  private wetGainNode: GainNode;

  public roomSize: number = 2.0; // default 2 seconds
  public decay: number = 2.0; // default exponential rate
  public wetDry: number = 0.5; // default 50% wet/dry mix

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.input = this.audioContext.createGain();
    this.output = this.audioContext.createGain();

    this.convolver = this.audioContext.createConvolver();
    this.dryGainNode = this.audioContext.createGain();
    this.wetGainNode = this.audioContext.createGain();

    // Connect dry path: Input -> dryGainNode -> Output
    this.input.connect(this.dryGainNode);
    this.dryGainNode.connect(this.output);

    // Connect wet path: Input -> convolver -> wetGainNode -> Output
    this.input.connect(this.convolver);
    this.convolver.connect(this.wetGainNode);
    this.wetGainNode.connect(this.output);

    // Initial buffer generation & parameters application
    this.regenerateImpulseResponse();
    this.applyParams();
  }

  public applyParams() {
    const now = this.audioContext.currentTime;

    // Equal-power crossfade to maintain subjective loudness
    const dryVol = Math.cos(this.wetDry * Math.PI / 2);
    const wetVol = Math.sin(this.wetDry * Math.PI / 2);

    this.dryGainNode.gain.setTargetAtTime(dryVol, now, 0.01);
    this.wetGainNode.gain.setTargetAtTime(wetVol, now, 0.01);
  }

  private regenerateImpulseResponse() {
    const sampleRate = this.audioContext.sampleRate;
    const lengthInSamples = Math.floor(sampleRate * this.roomSize);

    if (lengthInSamples <= 0) return;

    // Create a 2-channel (stereo) buffer for spatial depth
    const impulseBuffer = this.audioContext.createBuffer(2, lengthInSamples, sampleRate);
    const left = impulseBuffer.getChannelData(0);
    const right = impulseBuffer.getChannelData(1);

    const fadeOutTime = 0.05; // 50ms fade-out at the very end to prevent clicks

    for (let i = 0; i < lengthInSamples; i++) {
      const t = i / sampleRate;

      // Independent white noise per channel
      const noiseL = Math.random() * 2 - 1;
      const noiseR = Math.random() * 2 - 1;

      // Exponential decay envelope
      const decayEnv = Math.exp(-this.decay * t);

      let valL = noiseL * decayEnv;
      let valR = noiseR * decayEnv;

      // Smooth fade-out at the buffer end boundary
      if (t > this.roomSize - fadeOutTime) {
        const fade = (this.roomSize - t) / fadeOutTime;
        valL *= Math.max(0, fade);
        valR *= Math.max(0, fade);
      }

      left[i] = valL;
      right[i] = valR;
    }

    this.convolver.buffer = impulseBuffer;
  }

  public updateParams(settings: Partial<ReverbSettings>) {
    let needsRegen = false;

    if (settings.roomSize !== undefined && settings.roomSize !== this.roomSize) {
      this.roomSize = Math.max(0.1, Math.min(5.0, settings.roomSize));
      needsRegen = true;
    }

    if (settings.decay !== undefined && settings.decay !== this.decay) {
      this.decay = Math.max(0.1, Math.min(10.0, settings.decay));
      needsRegen = true;
    }

    if (settings.wetDry !== undefined && settings.wetDry !== this.wetDry) {
      this.wetDry = Math.max(0.0, Math.min(1.0, settings.wetDry));
    }

    if (needsRegen) {
      this.regenerateImpulseResponse();
    }

    this.applyParams();
  }

  public serialize(): ReverbSettings {
    return {
      roomSize: this.roomSize,
      decay: this.decay,
      wetDry: this.wetDry,
    };
  }

  public deserialize(settings: ReverbSettings) {
    if (!settings) return;

    if (settings.roomSize !== undefined) {
      this.roomSize = Math.max(0.1, Math.min(5.0, settings.roomSize));
    }
    if (settings.decay !== undefined) {
      this.decay = Math.max(0.1, Math.min(10.0, settings.decay));
    }
    if (settings.wetDry !== undefined) {
      this.wetDry = Math.max(0.0, Math.min(1.0, settings.wetDry));
    }

    this.regenerateImpulseResponse();
    this.applyParams();
  }

  public updateConnections() {
    try {
      this.input.disconnect();
    } catch (e) {}
    try {
      this.convolver.disconnect();
    } catch (e) {}
    try {
      this.dryGainNode.disconnect();
    } catch (e) {}
    try {
      this.wetGainNode.disconnect();
    } catch (e) {}

    // Reconnect dry path: Input -> dryGainNode -> Output
    this.input.connect(this.dryGainNode);
    this.dryGainNode.connect(this.output);

    // Reconnect wet path: Input -> convolver -> wetGainNode -> Output
    this.input.connect(this.convolver);
    this.convolver.connect(this.wetGainNode);
    this.wetGainNode.connect(this.output);
  }

  public disconnect() {
    try {
      this.output.disconnect();
    } catch (e) {}
  }
}
