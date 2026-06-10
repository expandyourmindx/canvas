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
    for (let ch = 0; ch < input.length; ch++) {
      if (output[ch]) output[ch].set(input[ch]);
    }
    if (this._recording && input.length > 0) {
      const channelData = [];
      for (let ch = 0; ch < input.length; ch++) {
        channelData.push(input[ch].slice());
      }
      this.port.postMessage({ type: 'chunk', channelData });
    }
    return true;
  }
}

registerProcessor('recorder-processor', RecorderProcessor);
