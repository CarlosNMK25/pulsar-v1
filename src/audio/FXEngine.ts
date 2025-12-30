// FX Bus with Reverb and Delay
import { audioEngine } from './AudioEngine';

interface ReverbParams {
  size: number;    // 0-1: room size (affects decay)
  decay: number;   // 0-1: decay time
  damping: number; // 0-1: high frequency damping
  mix: number;     // 0-1: wet/dry mix
}

interface DelayParams {
  time: number;     // 0-1: delay time (mapped to 0-1s)
  feedback: number; // 0-1: feedback amount
  filter: number;   // 0-1: filter frequency
  mix: number;      // 0-1: wet/dry mix
}

export class FXEngine {
  private static instance: FXEngine;
  
  // Reverb nodes
  private reverbConvolver: ConvolverNode | null = null;
  private reverbGain: GainNode;
  private reverbInput: GainNode;
  
  // Delay nodes
  private delayNode: DelayNode;
  private delayFeedback: GainNode;
  private delayFilter: BiquadFilterNode;
  private delayGain: GainNode;
  private delayInput: GainNode;
  
  // Parameters
  private reverbParams: ReverbParams = {
    size: 0.5,
    decay: 0.5,
    damping: 0.5,
    mix: 0.3,
  };
  
  private delayParams: DelayParams = {
    time: 0.375,    // ~3/16 at 120bpm
    feedback: 0.4,
    filter: 0.7,
    mix: 0.25,
  };

  private constructor() {
    const ctx = audioEngine.getContext();
    
    // === REVERB SETUP ===
    this.reverbInput = ctx.createGain();
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = this.reverbParams.mix;
    
    // Create impulse response
    this.createReverbImpulse();
    
    // === DELAY SETUP ===
    this.delayInput = ctx.createGain();
    
    this.delayNode = ctx.createDelay(2); // Max 2 seconds
    this.delayNode.delayTime.value = this.delayParams.time;
    
    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = this.delayParams.feedback;
    
    this.delayFilter = ctx.createBiquadFilter();
    this.delayFilter.type = 'lowpass';
    this.delayFilter.frequency.value = 2000 + this.delayParams.filter * 6000;
    
    this.delayGain = ctx.createGain();
    this.delayGain.gain.value = this.delayParams.mix;
    
    // Delay routing: input -> delay -> filter -> feedback loop & output
    this.delayInput.connect(this.delayNode);
    this.delayNode.connect(this.delayFilter);
    this.delayFilter.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode); // Feedback loop
    this.delayFilter.connect(this.delayGain);
    this.delayGain.connect(audioEngine.getMasterGain());
    
    console.log('[FXEngine] Initialized');
  }

  static getInstance(): FXEngine {
    if (!FXEngine.instance) {
      FXEngine.instance = new FXEngine();
    }
    return FXEngine.instance;
  }

  private createReverbImpulse(): void {
    const ctx = audioEngine.getContext();
    const sampleRate = ctx.sampleRate;
    
    // Calculate impulse length based on size and decay
    const length = sampleRate * (1 + this.reverbParams.size * 3 + this.reverbParams.decay * 2);
    const buffer = ctx.createBuffer(2, length, sampleRate);
    
    const dampingFactor = 1 - this.reverbParams.damping * 0.8;
    
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const decay = Math.exp(-t / (0.5 + this.reverbParams.decay * 2));
        
        // Add some early reflections
        let reflection = 0;
        if (i < sampleRate * 0.1) {
          const earlyDecay = 1 - (i / (sampleRate * 0.1));
          reflection = (Math.random() * 2 - 1) * earlyDecay * 0.3;
        }
        
        // High frequency damping (simple approximation)
        const damping = Math.random() > dampingFactor ? 0.5 : 1;
        
        data[i] = ((Math.random() * 2 - 1) * decay * damping) + reflection;
      }
    }
    
    // Create or replace convolver
    if (this.reverbConvolver) {
      this.reverbConvolver.disconnect();
    }
    
    this.reverbConvolver = ctx.createConvolver();
    this.reverbConvolver.buffer = buffer;
    
    // Connect reverb chain
    this.reverbInput.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.reverbGain);
    this.reverbGain.connect(audioEngine.getMasterGain());
  }

  // Get send nodes for instruments to connect to
  getReverbSend(): GainNode {
    return this.reverbInput;
  }

  getDelaySend(): GainNode {
    return this.delayInput;
  }

  setReverbParams(params: Partial<ReverbParams>): void {
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    const needsNewImpulse = 
      params.size !== undefined && params.size !== this.reverbParams.size ||
      params.decay !== undefined && params.decay !== this.reverbParams.decay ||
      params.damping !== undefined && params.damping !== this.reverbParams.damping;
    
    this.reverbParams = { ...this.reverbParams, ...params };
    
    // Update mix immediately
    if (params.mix !== undefined) {
      this.reverbGain.gain.setTargetAtTime(params.mix * 0.5, now, 0.05);
    }
    
    // Regenerate impulse if needed (expensive, so we defer)
    if (needsNewImpulse) {
      // Debounce impulse regeneration
      setTimeout(() => this.createReverbImpulse(), 100);
    }
  }

  setDelayParams(params: Partial<DelayParams>): void {
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    
    this.delayParams = { ...this.delayParams, ...params };
    
    if (params.time !== undefined) {
      // Map 0-1 to 0.05-1.0 seconds
      const delayTime = 0.05 + params.time * 0.95;
      this.delayNode.delayTime.setTargetAtTime(delayTime, now, 0.05);
    }
    
    if (params.feedback !== undefined) {
      // Clamp feedback to prevent runaway
      const safeFeedback = Math.min(params.feedback, 0.9);
      this.delayFeedback.gain.setTargetAtTime(safeFeedback, now, 0.05);
    }
    
    if (params.filter !== undefined) {
      const freq = 500 + params.filter * 7500;
      this.delayFilter.frequency.setTargetAtTime(freq, now, 0.05);
    }
    
    if (params.mix !== undefined) {
      this.delayGain.gain.setTargetAtTime(params.mix * 0.5, now, 0.05);
    }
  }

  getReverbParams(): ReverbParams {
    return { ...this.reverbParams };
  }

  getDelayParams(): DelayParams {
    return { ...this.delayParams };
  }

  // Sync delay time to BPM
  syncDelayToBpm(bpm: number, division: '1/4' | '1/8' | '1/16' | '3/16' = '3/16'): void {
    const beatDuration = 60 / bpm;
    let delayTime: number;
    
    switch (division) {
      case '1/4': delayTime = beatDuration; break;
      case '1/8': delayTime = beatDuration / 2; break;
      case '1/16': delayTime = beatDuration / 4; break;
      case '3/16': delayTime = beatDuration * 0.75; break;
      default: delayTime = beatDuration / 2;
    }
    
    // Clamp to reasonable range
    delayTime = Math.max(0.05, Math.min(delayTime, 1));
    
    const ctx = audioEngine.getContext();
    this.delayNode.delayTime.setTargetAtTime(delayTime, ctx.currentTime, 0.05);
    this.delayParams.time = (delayTime - 0.05) / 0.95;
  }

  setBypass(effect: 'reverb' | 'delay' | 'all', bypass: boolean): void {
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    const value = bypass ? 0 : (effect === 'reverb' ? this.reverbParams.mix * 0.5 : this.delayParams.mix * 0.5);
    
    if (effect === 'reverb' || effect === 'all') {
      this.reverbGain.gain.setTargetAtTime(bypass ? 0 : this.reverbParams.mix * 0.5, now, 0.05);
    }
    if (effect === 'delay' || effect === 'all') {
      this.delayGain.gain.setTargetAtTime(bypass ? 0 : this.delayParams.mix * 0.5, now, 0.05);
    }
  }

  disconnect(): void {
    this.reverbInput.disconnect();
    this.reverbGain.disconnect();
    this.reverbConvolver?.disconnect();
    this.delayInput.disconnect();
    this.delayNode.disconnect();
    this.delayFeedback.disconnect();
    this.delayFilter.disconnect();
    this.delayGain.disconnect();
  }
}

export const fxEngine = FXEngine.getInstance();
