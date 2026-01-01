// GranularEngine - Granular synthesis for advanced sample manipulation

import { audioEngine } from './AudioEngine';
import { fxEngine } from './FXEngine';

export interface GranularParams {
  grainSize: number;       // 10-500ms
  grainDensity: number;    // 1-50 grains per second
  pitchScatter: number;    // 0-1 random pitch variation
  positionScatter: number; // 0-1 random position offset
  timeStretch: number;     // 0.25-4.0 playback speed
  pitchShift: number;      // -12 to +12 semitones
  windowType: 'hann' | 'triangle' | 'trapezoid';
}

const defaultGranularParams: GranularParams = {
  grainSize: 100,
  grainDensity: 10,
  pitchScatter: 0,
  positionScatter: 0,
  timeStretch: 1.0,
  pitchShift: 0,
  windowType: 'hann',
};

export class GranularEngine {
  private outputGain: GainNode;
  private reverbSend: GainNode;
  private delaySend: GainNode;
  private buffer: AudioBuffer | null = null;
  private isPlaying = false;
  private schedulerInterval: number | null = null;
  private params: GranularParams = { ...defaultGranularParams };
  private position = 0; // Current playback position (0-1)
  private grainEnvelope: Float32Array;
  
  constructor() {
    const ctx = audioEngine.getContext();
    
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 0.8;
    this.outputGain.connect(audioEngine.getTrackBus('sample'));
    
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.2;
    this.reverbSend.connect(fxEngine.getReverbSend());
    
    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 0.1;
    this.delaySend.connect(fxEngine.getDelaySend());
    
    // Pre-compute grain envelope
    this.grainEnvelope = this.createEnvelope(1024, 'hann');
  }
  
  private createEnvelope(length: number, type: 'hann' | 'triangle' | 'trapezoid'): Float32Array {
    const envelope = new Float32Array(length);
    
    switch (type) {
      case 'hann':
        for (let i = 0; i < length; i++) {
          envelope[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (length - 1)));
        }
        break;
        
      case 'triangle':
        for (let i = 0; i < length; i++) {
          const t = i / (length - 1);
          envelope[i] = t < 0.5 ? 2 * t : 2 * (1 - t);
        }
        break;
        
      case 'trapezoid':
        const rampLen = Math.floor(length * 0.1);
        for (let i = 0; i < length; i++) {
          if (i < rampLen) {
            envelope[i] = i / rampLen;
          } else if (i > length - rampLen) {
            envelope[i] = (length - i) / rampLen;
          } else {
            envelope[i] = 1;
          }
        }
        break;
    }
    
    return envelope;
  }
  
  loadBuffer(buffer: AudioBuffer): void {
    this.buffer = buffer;
  }
  
  setParams(params: Partial<GranularParams>): void {
    const oldWindowType = this.params.windowType;
    this.params = { ...this.params, ...params };
    
    if (params.windowType && params.windowType !== oldWindowType) {
      this.grainEnvelope = this.createEnvelope(1024, params.windowType);
    }
  }
  
  getParams(): GranularParams {
    return { ...this.params };
  }
  
  private scheduleGrain(): void {
    if (!this.buffer || !this.isPlaying) return;
    
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    
    // Calculate grain parameters
    const grainSizeSec = this.params.grainSize / 1000;
    const pitchMultiplier = Math.pow(2, this.params.pitchShift / 12);
    
    // Add random scatter
    const positionOffset = (Math.random() - 0.5) * this.params.positionScatter;
    const pitchOffset = (Math.random() - 0.5) * this.params.pitchScatter;
    
    // Calculate buffer position
    let grainPosition = this.position + positionOffset;
    grainPosition = Math.max(0, Math.min(1, grainPosition));
    
    const startTime = grainPosition * this.buffer.duration;
    
    // Create grain source
    const source = ctx.createBufferSource();
    source.buffer = this.buffer;
    source.playbackRate.value = pitchMultiplier * (1 + pitchOffset);
    
    // Create grain envelope using gain automation
    const grainGain = ctx.createGain();
    grainGain.gain.setValueAtTime(0, now);
    grainGain.gain.linearRampToValueAtTime(1, now + grainSizeSec * 0.1);
    grainGain.gain.setValueAtTime(1, now + grainSizeSec * 0.9);
    grainGain.gain.linearRampToValueAtTime(0, now + grainSizeSec);
    
    // Connect grain
    source.connect(grainGain);
    grainGain.connect(this.outputGain);
    grainGain.connect(this.reverbSend);
    grainGain.connect(this.delaySend);
    
    // Play grain
    source.start(now, startTime, grainSizeSec);
    
    // Cleanup
    source.onended = () => {
      source.disconnect();
      grainGain.disconnect();
    };
    
    // Advance position based on time stretch
    const advanceAmount = grainSizeSec / this.buffer.duration / this.params.timeStretch;
    this.position += advanceAmount;
    
    // Loop back if we've reached the end
    if (this.position >= 1) {
      this.position = 0;
    }
  }
  
  start(startPosition: number = 0): void {
    if (this.isPlaying || !this.buffer) return;
    
    this.isPlaying = true;
    this.position = startPosition;
    
    // Calculate interval from grain density
    const intervalMs = 1000 / this.params.grainDensity;
    
    this.schedulerInterval = window.setInterval(() => {
      this.scheduleGrain();
    }, intervalMs);
  }
  
  stop(): void {
    if (!this.isPlaying) return;
    
    this.isPlaying = false;
    
    if (this.schedulerInterval !== null) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }
  
  setPosition(position: number): void {
    this.position = Math.max(0, Math.min(1, position));
  }
  
  getPosition(): number {
    return this.position;
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
  }
}
