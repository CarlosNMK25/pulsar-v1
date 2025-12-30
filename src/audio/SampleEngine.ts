// Sample Engine - Loop player with pitch, start/loop points, reverse

import { audioEngine } from './AudioEngine';
import { fxEngine } from './FXEngine';

export interface SampleParams {
  pitch: number;      // 0.5 - 2.0 playback rate
  startPoint: number; // 0-1 normalized
  loopLength: number; // 0-1 normalized
  reverse: boolean;
  volume: number;     // 0-1
  loop: boolean;
}

export class SampleEngine {
  private outputGain: GainNode;
  private reverbSend: GainNode;
  private delaySend: GainNode;
  private player: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  private reversedBuffer: AudioBuffer | null = null;
  private isPlaying = false;
  private fxConnected = false;
  private muted = false;

  private params: SampleParams = {
    pitch: 1.0,
    startPoint: 0,
    loopLength: 1,
    reverse: false,
    volume: 0.75,
    loop: true,
  };

  constructor() {
    const ctx = audioEngine.getContext();

    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = this.params.volume;
    this.outputGain.connect(audioEngine.getTrackBus('sample'));

    // FX send nodes
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.2;

    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 0.15;
  }

  connectFX(): void {
    if (this.fxConnected) return;
    this.reverbSend.connect(fxEngine.getReverbSend());
    this.delaySend.connect(fxEngine.getDelaySend());
    this.fxConnected = true;
  }

  setFXSend(reverb: number, delay: number): void {
    const ctx = audioEngine.getContext();
    this.reverbSend.gain.setTargetAtTime(reverb, ctx.currentTime, 0.05);
    this.delaySend.gain.setTargetAtTime(delay, ctx.currentTime, 0.05);
  }

  loadSample(buffer: AudioBuffer): void {
    this.buffer = buffer;
    this.reversedBuffer = this.createReversedBuffer(buffer);
  }

  clearSample(): void {
    this.stop();
    this.buffer = null;
    this.reversedBuffer = null;
  }

  hasSample(): boolean {
    return this.buffer !== null;
  }

  getBuffer(): AudioBuffer | null {
    return this.buffer;
  }

  private createReversedBuffer(buffer: AudioBuffer): AudioBuffer {
    const ctx = audioEngine.getContext();
    const reversed = ctx.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const source = buffer.getChannelData(ch);
      const dest = reversed.getChannelData(ch);
      for (let i = 0; i < buffer.length; i++) {
        dest[i] = source[buffer.length - 1 - i];
      }
    }

    return reversed;
  }

  setParams(params: Partial<SampleParams>): void {
    const wasReverse = this.params.reverse;
    this.params = { ...this.params, ...params };

    // Update volume
    const ctx = audioEngine.getContext();
    const targetVolume = this.muted ? 0 : this.params.volume;
    this.outputGain.gain.setTargetAtTime(targetVolume, ctx.currentTime, 0.05);

    // Update playback rate if playing
    if (this.player) {
      this.player.playbackRate.setTargetAtTime(this.params.pitch, ctx.currentTime, 0.05);
    }

    // Restart if reverse changed while playing
    if (wasReverse !== this.params.reverse && this.isPlaying) {
      this.stop();
      this.start();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    const ctx = audioEngine.getContext();
    const targetVolume = muted ? 0 : this.params.volume;
    this.outputGain.gain.setTargetAtTime(targetVolume, ctx.currentTime, 0.05);
  }

  start(): void {
    if (this.isPlaying || !this.buffer) return;

    const ctx = audioEngine.getContext();
    const buffer = this.params.reverse ? this.reversedBuffer : this.buffer;
    if (!buffer) return;

    this.player = ctx.createBufferSource();
    this.player.buffer = buffer;
    this.player.playbackRate.value = this.params.pitch;
    this.player.loop = this.params.loop;

    // Calculate loop points
    const duration = buffer.duration;
    const startTime = this.params.startPoint * duration;
    const loopEnd = startTime + (this.params.loopLength * duration);

    if (this.params.loop) {
      this.player.loopStart = startTime;
      this.player.loopEnd = Math.min(loopEnd, duration);
    }

    // Connect to outputs
    this.player.connect(this.outputGain);
    this.player.connect(this.reverbSend);
    this.player.connect(this.delaySend);

    this.player.start(0, startTime);
    this.isPlaying = true;

    this.player.onended = () => {
      if (!this.params.loop) {
        this.isPlaying = false;
        this.player = null;
      }
    };
  }

  stop(): void {
    if (!this.isPlaying || !this.player) return;

    try {
      this.player.stop();
    } catch {
      // Already stopped
    }
    this.player.disconnect();
    this.player = null;
    this.isPlaying = false;
  }

  trigger(): void {
    // One-shot playback
    if (!this.buffer) return;

    const ctx = audioEngine.getContext();
    const buffer = this.params.reverse ? this.reversedBuffer : this.buffer;
    if (!buffer) return;

    const player = ctx.createBufferSource();
    player.buffer = buffer;
    player.playbackRate.value = this.params.pitch;

    const startTime = this.params.startPoint * buffer.duration;
    const duration = this.params.loopLength * buffer.duration;

    player.connect(this.outputGain);
    player.connect(this.reverbSend);
    player.connect(this.delaySend);

    player.start(0, startTime, duration);

    player.onended = () => {
      player.disconnect();
    };
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  disconnect(): void {
    this.stop();
    this.outputGain.disconnect();
    this.reverbSend.disconnect();
    this.delaySend.disconnect();
  }
}
