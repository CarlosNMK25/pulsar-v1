import { audioEngine } from './AudioEngine';

export class TextureEngine {
  private outputGain: GainNode;
  private noiseSource: AudioBufferSourceNode | null = null;
  private filter: BiquadFilterNode;
  private lfo: OscillatorNode;
  private lfoGain: GainNode;
  private isPlaying = false;

  private params = {
    density: 0.5,
    pitch: 0.5,
    spread: 0.5,
    size: 0.5,
    feedback: 0.2,
    mix: 0.5,
  };

  constructor() {
    const ctx = audioEngine.getContext();

    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 0;
    this.outputGain.connect(audioEngine.getMasterGain());

    // Filter for texture shaping
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'bandpass';
    this.filter.frequency.value = 1000;
    this.filter.Q.value = 2;
    this.filter.connect(this.outputGain);

    // LFO for movement
    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = 0.5;

    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 500;

    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.filter.frequency);
    this.lfo.start();
  }

  setParams(params: Partial<typeof this.params>): void {
    this.params = { ...this.params, ...params };
    this.updateParams();
  }

  private updateParams(): void {
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    // Map density to filter Q and LFO rate
    this.filter.Q.setTargetAtTime(1 + this.params.density * 10, now, 0.1);
    this.lfo.frequency.setTargetAtTime(0.1 + this.params.spread * 2, now, 0.1);

    // Map pitch to filter frequency
    const baseFreq = 200 + this.params.pitch * 3000;
    this.filter.frequency.setTargetAtTime(baseFreq, now, 0.1);

    // Map size to LFO depth
    this.lfoGain.gain.setTargetAtTime(200 + this.params.size * 800, now, 0.1);

    // Map mix to output
    if (this.isPlaying) {
      this.outputGain.gain.setTargetAtTime(this.params.mix * 0.15, now, 0.1);
    }
  }

  start(): void {
    if (this.isPlaying) return;

    const ctx = audioEngine.getContext();

    // Create noise buffer
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < bufferSize; i++) {
        // Pink-ish noise
        data[i] = (Math.random() * 2 - 1) * 0.5;
      }
    }

    this.noiseSource = ctx.createBufferSource();
    this.noiseSource.buffer = buffer;
    this.noiseSource.loop = true;
    this.noiseSource.connect(this.filter);
    this.noiseSource.start();

    // Fade in
    this.outputGain.gain.setTargetAtTime(this.params.mix * 0.15, ctx.currentTime, 0.5);
    this.isPlaying = true;
  }

  stop(): void {
    if (!this.isPlaying) return;

    const ctx = audioEngine.getContext();

    // Fade out
    this.outputGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);

    // Stop after fade
    setTimeout(() => {
      if (this.noiseSource) {
        this.noiseSource.stop();
        this.noiseSource.disconnect();
        this.noiseSource = null;
      }
      this.isPlaying = false;
    }, 500);
  }

  disconnect(): void {
    this.stop();
    this.lfo.stop();
    this.lfo.disconnect();
    this.lfoGain.disconnect();
    this.filter.disconnect();
    this.outputGain.disconnect();
  }
}
