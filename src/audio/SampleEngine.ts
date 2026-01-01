// Sample Engine - Loop player with pitch, start/loop points, reverse, playback modes

import { audioEngine } from './AudioEngine';
import { fxEngine } from './FXEngine';
import { modulationEngine } from './ModulationEngine';

export type PlaybackMode = 'full' | 'region' | 'slice';
export type SampleSyncMode = 'independent' | 'gate-kick' | 'gate-snare' | 'gate-hat';

export interface SampleParams {
  pitch: number;      // 0.5 - 2.0 playback rate
  startPoint: number; // 0-1 normalized
  loopLength: number; // 0-1 normalized
  reverse: boolean;
  volume: number;     // 0-1
  loop: boolean;
  playbackMode: PlaybackMode;
  sliceCount: number; // 4, 8, 16, 32
  syncMode: SampleSyncMode;
}

export class SampleEngine {
  private outputGain: GainNode;
  private reverbSend: GainNode;
  private delaySend: GainNode;
  private modulationSend: GainNode;
  private player: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  private reversedBuffer: AudioBuffer | null = null;
  private isPlaying = false;
  private fxConnected = false;
  private modConnected = false;
  private muted = false;
  private fxBypassed = false;
  private savedFxLevels = { reverb: 0.35, delay: 0.3 };
  private savedModLevel = 0;

  private params: SampleParams = {
    pitch: 1.0,
    startPoint: 0,
    loopLength: 1,
    reverse: false,
    volume: 0.75,
    loop: true,
    playbackMode: 'region',
    sliceCount: 8,
    syncMode: 'independent',
  };

  constructor() {
    const ctx = audioEngine.getContext();

    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = this.params.volume;
    this.outputGain.connect(audioEngine.getTrackBus('sample'));

    // FX send nodes
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.35;

    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 0.3;

    // Modulation send node
    this.modulationSend = ctx.createGain();
    this.modulationSend.gain.value = 0;
  }

  connectFX(): void {
    if (this.fxConnected) return;
    this.reverbSend.connect(fxEngine.getReverbSend());
    this.delaySend.connect(fxEngine.getDelaySend());
    this.fxConnected = true;
  }

  connectModulation(): void {
    if (this.modConnected) return;
    this.modulationSend.connect(modulationEngine.getInput());
    this.modConnected = true;
  }

  setModulationSend(level: number): void {
    this.savedModLevel = level;
    const ctx = audioEngine.getContext();
    this.modulationSend.gain.setTargetAtTime(level, ctx.currentTime, 0.05);
  }

  setFXSend(reverb: number, delay: number): void {
    this.savedFxLevels = { reverb, delay };
    if (this.fxBypassed) return;
    const ctx = audioEngine.getContext();
    this.reverbSend.gain.setTargetAtTime(reverb, ctx.currentTime, 0.05);
    this.delaySend.gain.setTargetAtTime(delay, ctx.currentTime, 0.05);
  }

  setFXBypass(bypass: boolean): void {
    this.fxBypassed = bypass;
    const ctx = audioEngine.getContext();
    if (bypass) {
      this.reverbSend.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      this.delaySend.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    } else {
      this.reverbSend.gain.setTargetAtTime(this.savedFxLevels.reverb, ctx.currentTime, 0.05);
      this.delaySend.gain.setTargetAtTime(this.savedFxLevels.delay, ctx.currentTime, 0.05);
    }
  }

  loadSample(buffer: AudioBuffer): void {
    // Stop any current playback first to reset state
    if (this.isPlaying) {
      this.stop();
    }
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

    // Calculate points based on playback mode
    let startTime: number;
    let loopStart: number;
    let loopEnd: number;

    switch (this.params.playbackMode) {
      case 'full':
        startTime = 0;
        loopStart = 0;
        loopEnd = buffer.duration;
        break;
      case 'slice':
        // In continuous play, loop the first slice
        const sliceDuration = buffer.duration / this.params.sliceCount;
        startTime = 0;
        loopStart = 0;
        loopEnd = sliceDuration;
        break;
      case 'region':
      default:
        startTime = this.params.startPoint * buffer.duration;
        loopStart = startTime;
        loopEnd = startTime + (this.params.loopLength * buffer.duration);
        break;
    }

    if (this.params.loop) {
      this.player.loopStart = loopStart;
      this.player.loopEnd = Math.min(loopEnd, buffer.duration);
    }

    // Connect to outputs
    this.player.connect(this.outputGain);
    this.player.connect(this.reverbSend);
    this.player.connect(this.delaySend);
    this.player.connect(this.modulationSend);

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
    // One-shot playback based on playbackMode
    if (!this.buffer) return;

    const ctx = audioEngine.getContext();
    const buffer = this.params.reverse ? this.reversedBuffer : this.buffer;
    if (!buffer) return;

    const player = ctx.createBufferSource();
    player.buffer = buffer;
    player.playbackRate.value = this.params.pitch;

    let startTime: number;
    let duration: number | undefined;

    switch (this.params.playbackMode) {
      case 'full':
        // Play entire sample
        startTime = 0;
        duration = undefined; // Play to end
        break;
      case 'slice':
        // In slice mode, trigger() plays slice 0 by default
        // Use triggerSlice() for specific slices
        startTime = 0;
        duration = buffer.duration / this.params.sliceCount;
        break;
      case 'region':
      default:
        // Play defined region (original behavior)
        startTime = this.params.startPoint * buffer.duration;
        duration = this.params.loopLength * buffer.duration;
        break;
    }

    player.connect(this.outputGain);
    player.connect(this.reverbSend);
    player.connect(this.delaySend);
    player.connect(this.modulationSend);

    if (duration !== undefined) {
      player.start(0, startTime, duration);
    } else {
      player.start(0, startTime);
    }

    player.onended = () => {
      player.disconnect();
    };
  }

  triggerSlice(sliceIndex: number): void {
    // Play a specific slice
    if (!this.buffer) return;

    const ctx = audioEngine.getContext();
    const buffer = this.params.reverse ? this.reversedBuffer : this.buffer;
    if (!buffer) return;

    const sliceCount = this.params.sliceCount;
    const sliceDuration = buffer.duration / sliceCount;
    const clampedIndex = Math.max(0, Math.min(sliceIndex, sliceCount - 1));
    const startTime = clampedIndex * sliceDuration;

    const player = ctx.createBufferSource();
    player.buffer = buffer;
    player.playbackRate.value = this.params.pitch;

    player.connect(this.outputGain);
    player.connect(this.reverbSend);
    player.connect(this.delaySend);
    player.connect(this.modulationSend);

    player.start(0, startTime, sliceDuration);

    player.onended = () => {
      player.disconnect();
    };
  }

  getParams(): SampleParams {
    return { ...this.params };
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  setVolume(value: number): void {
    const ctx = audioEngine.getContext();
    this.outputGain.gain.setTargetAtTime(value, ctx.currentTime, 0.05);
  }

  disconnect(): void {
    this.stop();
    this.outputGain.disconnect();
    this.reverbSend.disconnect();
    this.delaySend.disconnect();
    this.modulationSend.disconnect();
  }
}
