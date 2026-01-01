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

  // Trigger with optional per-step volume
  trigger(options?: { volume?: number }): void {
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

    // Create a temporary gain node for per-trigger volume control
    const triggerGain = ctx.createGain();
    triggerGain.gain.value = options?.volume ?? 1.0;

    // Connect: player -> triggerGain -> outputs
    player.connect(triggerGain);
    triggerGain.connect(this.outputGain);
    triggerGain.connect(this.reverbSend);
    triggerGain.connect(this.delaySend);
    triggerGain.connect(this.modulationSend);

    if (duration !== undefined) {
      player.start(0, startTime, duration);
    } else {
      player.start(0, startTime);
    }

    player.onended = () => {
      player.disconnect();
      triggerGain.disconnect();
    };
  }

  triggerSlice(sliceIndex: number): void {
    // Play a specific slice using default params
    this.triggerSliceWithOptions(sliceIndex, {});
  }

  // Custom slice markers for transient-based slicing
  private customSliceMarkers: number[] | null = null;

  setCustomSliceMarkers(markers: number[] | null): void {
    this.customSliceMarkers = markers;
  }

  getCustomSliceMarkers(): number[] | null {
    return this.customSliceMarkers;
  }

  // Preview audio at a specific position (0-1)
  previewAtPosition(position: number, durationMs: number = 500): void {
    if (!this.buffer) return;

    const ctx = audioEngine.getContext();
    const buffer = this.params.reverse ? this.reversedBuffer : this.buffer;
    if (!buffer) return;

    const startTime = Math.max(0, Math.min(1, position)) * buffer.duration;
    const duration = durationMs / 1000;

    const player = ctx.createBufferSource();
    player.buffer = buffer;
    player.playbackRate.value = this.params.pitch;

    // Create preview gain with fade envelope
    const previewGain = ctx.createGain();
    const now = ctx.currentTime;
    previewGain.gain.setValueAtTime(0, now);
    previewGain.gain.linearRampToValueAtTime(this.params.volume, now + 0.01);
    previewGain.gain.setValueAtTime(this.params.volume, now + duration - 0.05);
    previewGain.gain.linearRampToValueAtTime(0, now + duration);

    player.connect(previewGain);
    previewGain.connect(this.outputGain);

    player.start(0, startTime, duration);

    player.onended = () => {
      player.disconnect();
      previewGain.disconnect();
    };
  }

  // Advanced trigger with per-step options (reverse, pitch, volume override) and ADSR envelope
  triggerSliceWithOptions(
    sliceIndex: number, 
    options: { 
      reverse?: boolean; 
      pitch?: number; 
      volume?: number;
      envelope?: { attack: number; decay: number; sustain: number; release: number };
    }
  ): void {
    if (!this.buffer || !this.reversedBuffer) return;

    const ctx = audioEngine.getContext();
    
    // Use per-step reverse if provided, otherwise use global reverse
    const useReverse = options.reverse ?? this.params.reverse;
    const buffer = useReverse ? this.reversedBuffer : this.buffer;

    const sliceCount = this.params.sliceCount;
    
    // Use custom slice markers if available
    let sliceStart: number;
    let sliceDuration: number;
    
    if (this.customSliceMarkers && this.customSliceMarkers.length > 0) {
      const clampedIndex = Math.max(0, Math.min(sliceIndex, this.customSliceMarkers.length - 1));
      sliceStart = this.customSliceMarkers[clampedIndex] * buffer.duration;
      const nextMarker = this.customSliceMarkers[clampedIndex + 1] ?? 1;
      sliceDuration = (nextMarker - this.customSliceMarkers[clampedIndex]) * buffer.duration;
      
      // For reversed buffer, adjust start position
      if (useReverse) {
        sliceStart = buffer.duration - sliceStart - sliceDuration;
      }
    } else {
      // Uniform slicing
      sliceDuration = buffer.duration / sliceCount;
      const clampedIndex = Math.max(0, Math.min(sliceIndex, sliceCount - 1));
      
      // For reversed buffer, invert the slice index to maintain musical order
      const effectiveIndex = useReverse ? (sliceCount - 1 - clampedIndex) : clampedIndex;
      sliceStart = effectiveIndex * sliceDuration;
    }

    const player = ctx.createBufferSource();
    player.buffer = buffer;
    
    // Use per-step pitch if provided, otherwise use global pitch
    player.playbackRate.value = options.pitch ?? this.params.pitch;

    // Create a gain node for envelope and volume control
    const triggerGain = ctx.createGain();
    const now = ctx.currentTime;
    const baseVolume = options.volume ?? 1.0;

    // Apply ADSR envelope if provided
    if (options.envelope) {
      const { attack, decay, sustain, release } = options.envelope;
      const attackSec = attack / 1000;
      const decaySec = decay / 1000;
      const releaseSec = release / 1000;
      const sustainLevel = sustain * baseVolume;
      
      triggerGain.gain.setValueAtTime(0, now);
      triggerGain.gain.linearRampToValueAtTime(baseVolume, now + attackSec);
      triggerGain.gain.linearRampToValueAtTime(sustainLevel, now + attackSec + decaySec);
      
      // Schedule release before slice ends
      const releaseStart = Math.max(0, sliceDuration - releaseSec);
      triggerGain.gain.setValueAtTime(sustainLevel, now + releaseStart);
      triggerGain.gain.linearRampToValueAtTime(0, now + sliceDuration);
    } else {
      triggerGain.gain.value = baseVolume;
    }

    // Connect: player -> triggerGain -> outputs
    player.connect(triggerGain);
    triggerGain.connect(this.outputGain);
    triggerGain.connect(this.reverbSend);
    triggerGain.connect(this.delaySend);
    triggerGain.connect(this.modulationSend);

    player.start(0, sliceStart, sliceDuration);

    player.onended = () => {
      player.disconnect();
      triggerGain.disconnect();
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
