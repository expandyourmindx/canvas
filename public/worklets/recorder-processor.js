class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._recording = false;
    this.port.onmessage = (e) => {
      if (e.data.type === 'start') this._recording = true;
      if (e.data.type === 'stop') this._recording = false;
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    // Always pass input to output (tap, not gate)
    for (let ch = 0; ch < input.length; ch++) {
      if (output[ch]) output[ch].set(input[ch]);
    }
    // Capture chunks when recording
    if (this._recording && input.length > 0) {
      const channelData = [];
      for (let ch = 0; ch < input.length; ch++) {
        channelData.push(input[ch].slice()); // .slice() = copy, never reference
      }
      if (input[0].length !== 128) {
        this.port.postMessage({ type: 'shortchunk', length: input[0].length });
      }
      this.port.postMessage({ type: 'chunk', channelData });
    }
    return true; // Keep processor alive
  }
}

registerProcessor('recorder-processor', RecorderProcessor);
