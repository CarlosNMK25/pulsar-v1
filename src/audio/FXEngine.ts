// FX Bus with Reverb and Delay
import { audioEngine } from './AudioEngine';

export type SyncDivision = '1/4' | '1/8' | '1/16' | '3/16';

interface ReverbParams {
  size: number;    // 0-1: room size (affects decay)
  decay: number;   // 0-1: decay time
  damping: number; // 0-1: high frequency damping
  preDelay: number; // 0-1: pre-delay (0-100ms)
  lofi: number;    // 0-1: lofi amount
  mix: number;     // 0-1: wet/dry mix
}

interface DelayParams {
  time: number;     // 0-1: delay time (mapped to 0-1s)
  feedback: number; // 0-1: feedback amount
  filter: number;   // 0-1: filter frequency
  spread: number;   // 0-1: stereo spread
  mix: number;      // 0-1: wet/dry mix
  syncDivision: SyncDivision;
}

interface MasterFilterParams {
  lowpass: number;  // 0-1: lowpass frequency (500Hz-20kHz)
  highpass: number; // 0-1: highpass frequency (20Hz-2kHz)
}

export class FXEngine {
  private static instance: FXEngine | null = null;
  private initialized = false;
  
  // Reverb nodes
  private reverbConvolver: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private reverbInput: GainNode | null = null;
  private reverbPreDelay: DelayNode | null = null;
  private reverbLoFiFilter: BiquadFilterNode | null = null;
  private reverbLoFiWaveshaper: WaveShaperNode | null = null;
  
  // Delay nodes
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private delayFilter: BiquadFilterNode | null = null;
  private delayGain: GainNode | null = null;
  private delayInput: GainNode | null = null;
  private delaySpreadL: DelayNode | null = null;
  private delaySpreadR: DelayNode | null = null;
  private delaySplitter: ChannelSplitterNode | null = null;
  private delayMerger: ChannelMergerNode | null = null;
  
  // Master filter nodes
  private masterFilterInput: GainNode | null = null;
  private masterLowpass: BiquadFilterNode | null = null;
  private masterHighpass: BiquadFilterNode | null = null;
  
  // Parameters
  private reverbParams: ReverbParams = {
    size: 0.5,
    decay: 0.5,
    damping: 0.5,
    preDelay: 0.1,
    lofi: 0,
    mix: 0.3,
  };
  
  private delayParams: DelayParams = {
    time: 0.375,    // ~3/16 at 120bpm
    feedback: 0.4,
    filter: 0.7,
    spread: 0.3,
    mix: 0.25,
    syncDivision: '3/16',
  };

  private masterFilterParams: MasterFilterParams = {
    lowpass: 1.0,
    highpass: 0.0,
  };

  private constructor() {
    // Don't initialize audio here - wait for init() call
  }

  static getInstance(): FXEngine {
    if (!FXEngine.instance) {
      FXEngine.instance = new FXEngine();
    }
    return FXEngine.instance;
  }

  private makeLoFiCurve(amount: number): Float32Array | null {
    const samples = 256;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      // Soft clipping with more distortion based on amount
      curve[i] = Math.tanh(x * (1 + amount * 2));
    }
    return curve;
  }

  private ensureInitialized(): void {
    if (this.initialized) return;
    
    const ctx = audioEngine.getContext();
    
    // === MASTER FILTER SETUP (output stage) ===
    this.masterFilterInput = ctx.createGain();
    
    this.masterLowpass = ctx.createBiquadFilter();
    this.masterLowpass.type = 'lowpass';
    this.masterLowpass.frequency.value = 20000;
    this.masterLowpass.Q.value = 0.7;
    
    this.masterHighpass = ctx.createBiquadFilter();
    this.masterHighpass.type = 'highpass';
    this.masterHighpass.frequency.value = 20;
    this.masterHighpass.Q.value = 0.7;
    
    // Master filter chain
    this.masterFilterInput.connect(this.masterLowpass);
    this.masterLowpass.connect(this.masterHighpass);
    this.masterHighpass.connect(audioEngine.getFxBus());
    
    // === REVERB SETUP ===
    this.reverbInput = ctx.createGain();
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = this.reverbParams.mix;
    
    // Pre-delay node (0-100ms)
    this.reverbPreDelay = ctx.createDelay(0.1);
    this.reverbPreDelay.delayTime.value = this.reverbParams.preDelay * 0.1;
    
    // LoFi filter (after convolver)
    this.reverbLoFiFilter = ctx.createBiquadFilter();
    this.reverbLoFiFilter.type = 'lowpass';
    this.reverbLoFiFilter.frequency.value = 20000;
    this.reverbLoFiFilter.Q.value = 1;
    
    // LoFi waveshaper (soft saturation)
    this.reverbLoFiWaveshaper = ctx.createWaveShaper();
    (this.reverbLoFiWaveshaper as any).curve = this.makeLoFiCurve(this.reverbParams.lofi);
    this.reverbLoFiWaveshaper.oversample = '2x';
    
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
    
    // Stereo spread setup
    this.delaySplitter = ctx.createChannelSplitter(2);
    this.delayMerger = ctx.createChannelMerger(2);
    this.delaySpreadL = ctx.createDelay(0.05);
    this.delaySpreadR = ctx.createDelay(0.05);
    this.delaySpreadL.delayTime.value = 0;
    this.delaySpreadR.delayTime.value = this.delayParams.spread * 0.02;
    
    // Delay routing with spread: input -> delay -> filter -> splitter -> [L/R spread] -> merger -> feedback & output
    this.delayInput.connect(this.delayNode);
    this.delayNode.connect(this.delayFilter);
    this.delayFilter.connect(this.delaySplitter);
    
    this.delaySplitter.connect(this.delaySpreadL, 0);
    this.delaySplitter.connect(this.delaySpreadR, 1);
    
    this.delaySpreadL.connect(this.delayMerger, 0, 0);
    this.delaySpreadR.connect(this.delayMerger, 0, 1);
    
    this.delayMerger.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode); // Feedback loop
    this.delayMerger.connect(this.delayGain);
    this.delayGain.connect(this.masterFilterInput); // Route to master filter
    
    this.initialized = true;
    console.log('[FXEngine] Initialized with PreDelay, LoFi, Spread, and Master Filter');
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
    
    // Reverb chain: input -> preDelay -> convolver -> loFiFilter -> loFiWaveshaper -> gain -> masterFilter
    this.reverbInput!.connect(this.reverbPreDelay!);
    this.reverbPreDelay!.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.reverbLoFiFilter!);
    this.reverbLoFiFilter!.connect(this.reverbLoFiWaveshaper!);
    this.reverbLoFiWaveshaper!.connect(this.reverbGain!);
    this.reverbGain!.connect(this.masterFilterInput!);
  }

  // Get send nodes for instruments to connect to
  getReverbSend(): GainNode {
    this.ensureInitialized();
    return this.reverbInput!;
  }

  getDelaySend(): GainNode {
    this.ensureInitialized();
    return this.delayInput!;
  }

  setReverbParams(params: Partial<ReverbParams>): void {
    if (!this.initialized) return;
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    const needsNewImpulse = 
      params.size !== undefined && params.size !== this.reverbParams.size ||
      params.decay !== undefined && params.decay !== this.reverbParams.decay ||
      params.damping !== undefined && params.damping !== this.reverbParams.damping;
    
    this.reverbParams = { ...this.reverbParams, ...params };
    
    // Update mix immediately
    if (params.mix !== undefined && this.reverbGain) {
      this.reverbGain.gain.setTargetAtTime(params.mix * 0.5, now, 0.05);
    }
    
    // Update pre-delay
    if (params.preDelay !== undefined && this.reverbPreDelay) {
      const time = params.preDelay * 0.1; // Map 0-1 to 0-100ms
      this.reverbPreDelay.delayTime.setTargetAtTime(time, now, 0.05);
    }
    
    // Update lofi
    if (params.lofi !== undefined) {
      if (this.reverbLoFiFilter) {
        // Filter: 20kHz -> 1kHz based on lofi amount
        const freq = 20000 - (params.lofi * 19000);
        this.reverbLoFiFilter.frequency.setTargetAtTime(freq, now, 0.05);
      }
      if (this.reverbLoFiWaveshaper) {
        (this.reverbLoFiWaveshaper as any).curve = this.makeLoFiCurve(params.lofi);
      }
    }
    
    // Regenerate impulse if needed (expensive, so we defer)
    if (needsNewImpulse) {
      // Debounce impulse regeneration
      setTimeout(() => this.createReverbImpulse(), 100);
    }
  }

  setDelayParams(params: Partial<DelayParams>): void {
    if (!this.initialized) return;
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    
    this.delayParams = { ...this.delayParams, ...params };
    
    if (params.time !== undefined && this.delayNode) {
      // Map 0-1 to 0.05-1.0 seconds
      const delayTime = 0.05 + params.time * 0.95;
      this.delayNode.delayTime.setTargetAtTime(delayTime, now, 0.05);
    }
    
    if (params.feedback !== undefined && this.delayFeedback) {
      // Clamp feedback to prevent runaway
      const safeFeedback = Math.min(params.feedback, 0.9);
      this.delayFeedback.gain.setTargetAtTime(safeFeedback, now, 0.05);
    }
    
    if (params.filter !== undefined && this.delayFilter) {
      const freq = 500 + params.filter * 7500;
      this.delayFilter.frequency.setTargetAtTime(freq, now, 0.05);
    }
    
    if (params.spread !== undefined && this.delaySpreadR) {
      // Map 0-1 to 0-20ms offset
      const offset = params.spread * 0.02;
      this.delaySpreadR.delayTime.setTargetAtTime(offset, now, 0.05);
    }
    
    if (params.mix !== undefined && this.delayGain) {
      this.delayGain.gain.setTargetAtTime(params.mix * 0.5, now, 0.05);
    }
  }

  setMasterFilterParams(params: Partial<MasterFilterParams>): void {
    if (!this.initialized) return;
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    
    this.masterFilterParams = { ...this.masterFilterParams, ...params };
    
    if (params.lowpass !== undefined && this.masterLowpass) {
      // Lowpass: 500Hz - 20kHz
      const freq = 500 + params.lowpass * 19500;
      this.masterLowpass.frequency.setTargetAtTime(freq, now, 0.05);
    }
    
    if (params.highpass !== undefined && this.masterHighpass) {
      // Highpass: 20Hz - 2kHz
      const freq = 20 + params.highpass * 1980;
      this.masterHighpass.frequency.setTargetAtTime(freq, now, 0.05);
    }
  }

  getReverbParams(): ReverbParams {
    return { ...this.reverbParams };
  }

  getDelayParams(): DelayParams {
    return { ...this.delayParams };
  }

  getMasterFilterParams(): MasterFilterParams {
    return { ...this.masterFilterParams };
  }

  // Sync delay time to BPM
  syncDelayToBpm(bpm: number, division: SyncDivision = '3/16'): void {
    if (!this.initialized || !this.delayNode) return;
    
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
    this.delayParams.syncDivision = division;
  }

  setBypass(effect: 'reverb' | 'delay' | 'all', bypass: boolean): void {
    if (!this.initialized) return;
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    
    if ((effect === 'reverb' || effect === 'all') && this.reverbGain) {
      this.reverbGain.gain.setTargetAtTime(bypass ? 0 : this.reverbParams.mix * 0.5, now, 0.05);
    }
    if ((effect === 'delay' || effect === 'all') && this.delayGain) {
      this.delayGain.gain.setTargetAtTime(bypass ? 0 : this.delayParams.mix * 0.5, now, 0.05);
    }
  }

  disconnect(): void {
    if (!this.initialized) return;
    this.reverbInput?.disconnect();
    this.reverbGain?.disconnect();
    this.reverbConvolver?.disconnect();
    this.reverbPreDelay?.disconnect();
    this.reverbLoFiFilter?.disconnect();
    this.reverbLoFiWaveshaper?.disconnect();
    this.delayInput?.disconnect();
    this.delayNode?.disconnect();
    this.delayFeedback?.disconnect();
    this.delayFilter?.disconnect();
    this.delayGain?.disconnect();
    this.delaySpreadL?.disconnect();
    this.delaySpreadR?.disconnect();
    this.delaySplitter?.disconnect();
    this.delayMerger?.disconnect();
    this.masterFilterInput?.disconnect();
    this.masterLowpass?.disconnect();
    this.masterHighpass?.disconnect();
  }
}

export const fxEngine = FXEngine.getInstance();