export class Reverb {
  public audioContext: AudioContext;
  public input: GainNode;
  public output: GainNode;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.input = this.audioContext.createGain();
    this.output = this.audioContext.createGain();
    this.input.connect(this.output);
  }

  public disconnect() {
    this.input.disconnect();
    this.output.disconnect();
  }
}
