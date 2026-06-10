class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._recording = false;
    this._chunkBuffer = [];
    this._chunkBufferSize = 0;
    this._flushThreshold = 4096;
    this.port.onmessage = (e) => {
      if (e.data.type === 'start') this._recording = true;
      if (e.data.type === 'stop') {
        this._recording = false;
        // Flush any remaining buffered chunks on stop
        if (this._chunkBuffer.length > 0) {
          const numChannels = this._chunkBuffer[0].length;
          const merged = [];
          for (let ch = 0; ch < numChannels; ch++) {
            const total = this._chunkBufferSize;
            const out = new Float32Array(total);
            let offset = 0;
            for (let i = 0; i < this._chunkBuffer.length; i++) {
              out.set(this._chunkBuffer[i][ch], offset);
              offset += this._chunkBuffer[i][ch].length;
            }
            merged.push(out);
          }
          this.port.postMessage({ type: 'chunk', channelData: merged });
          this._chunkBuffer = [];
          this._chunkBufferSize = 0;
        }
      }
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
        channelData.push(input[ch].slice());
      }
      this._chunkBuffer.push(channelData);
      this._chunkBufferSize += input[0].length;

      if (this._chunkBufferSize >= this._flushThreshold) {
        // Concatenate buffered chunks per channel into one message
        const numChannels = this._chunkBuffer[0].length;
        const merged = [];
        for (let ch = 0; ch < numChannels; ch++) {
          const total = this._chunkBufferSize;
          const out = new Float32Array(total);
          let offset = 0;
          for (let i = 0; i < this._chunkBuffer.length; i++) {
            out.set(this._chunkBuffer[i][ch], offset);
            offset += this._chunkBuffer[i][ch].length;
          }
          merged.push(out);
        }
        this.port.postMessage({ type: 'chunk', channelData: merged });
        this._chunkBuffer = [];
        this._chunkBufferSize = 0;
      }
    }
    return true; // Keep processor alive
  }
}

registerProcessor('recorder-processor', RecorderProcessor);
