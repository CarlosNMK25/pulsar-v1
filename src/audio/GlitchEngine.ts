// Glitch effects engine for IDM-style audio manipulation
import { audioEngine } from './AudioEngine';

export interface GlitchEffectParams {
  active: boolean;
  mix: number;
}

export interface StutterParams extends GlitchEffectParams {
  division: '1/4' | '1/8' | '1/16' | '1/32' | '1/64';
  decay: number;
}

export interface BitcrushParams extends GlitchEffectParams {
  bits: number;
  sampleRate: number;
}

export interface TapeStopParams extends GlitchEffectParams {
  speed: number;
  duration: number;
}

export interface GranularFreezeParams extends GlitchEffectParams {
  grainSize: number;
  pitch: number;
  spread: number;
}

export interface GlitchParams {
  stutter: StutterParams;
  bitcrush: BitcrushParams;
  tapeStop: TapeStopParams;
  granularFreeze: GranularFreezeParams;
}

export class GlitchEngine {
  private static instance: GlitchEngine;
  
  private inputNode: GainNode | null = null;
  private outputNode: GainNode | null = null;
  private dryNode: GainNode | null = null;
  private wetNode: GainNode | null = null;
  
  // Effect nodes
  private stutterGain: GainNode | null = null;
  private bitcrusher: ScriptProcessorNode | AudioWorkletNode | null = null;
  private tapeStopNode: AudioBufferSourceNode | null = null;
  
  private bypass = true;
  private isConnected = false;
  
  private params: GlitchParams = {
    stutter: {
      active: false,
      mix: 0.5,
      division: '1/16',
      decay: 0.5,
    },
    bitcrush: {
      active: false,
      mix: 0.5,
      bits: 8,
      sampleRate: 0.5,
    },
    tapeStop: {
      active: false,
      mix: 0.5,
      speed: 0.5,
      duration: 0.5,
    },
    granularFreeze: {
      active: false,
      mix: 0.5,
      grainSize: 0.5,
      pitch: 0.5,
      spread: 0.5,
    },
  };

  // Stutter timing
  private stutterInterval: number | null = null;
  private lastStutterTime = 0;

  private constructor() {}

  static getInstance(): GlitchEngine {
    if (!GlitchEngine.instance) {
      GlitchEngine.instance = new GlitchEngine();
    }
    return GlitchEngine.instance;
  }

  init(): void {
    if (this.isConnected) return;
    
    const ctx = audioEngine.getContext();
    
    // Create I/O nodes
    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.dryNode = ctx.createGain();
    this.wetNode = ctx.createGain();
    
    this.dryNode.gain.value = 1;
    this.wetNode.gain.value = 0;
    
    // Create effect nodes
    this.stutterGain = ctx.createGain();
    this.stutterGain.gain.value = 1;
    
    // Simple bitcrusher using ScriptProcessor (fallback - AudioWorklet would be better)
    // For now we'll use a simple gain reduction approach
    
    // Connect: input -> dry -> output
    //          input -> effects -> wet -> output
    this.inputNode.connect(this.dryNode);
    this.dryNode.connect(this.outputNode);
    
    this.inputNode.connect(this.stutterGain);
    this.stutterGain.connect(this.wetNode);
    this.wetNode.connect(this.outputNode);
    
    this.isConnected = true;
    console.log('[GlitchEngine] Initialized');
  }

  getInputNode(): GainNode {
    if (!this.inputNode) {
      this.init();
    }
    return this.inputNode!;
  }

  getOutputNode(): GainNode {
    if (!this.outputNode) {
      this.init();
    }
    return this.outputNode!;
  }

  setBypass(bypass: boolean): void {
    this.bypass = bypass;
    if (!this.dryNode || !this.wetNode) return;
    
    const ctx = audioEngine.getContext();
    if (bypass) {
      this.dryNode.gain.setTargetAtTime(1, ctx.currentTime, 0.01);
      this.wetNode.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
      this.stopAllEffects();
    } else {
      this.updateMix();
    }
  }

  isBypassed(): boolean {
    return this.bypass;
  }

  setParams(params: Partial<GlitchParams>): void {
    this.params = { ...this.params, ...params };
    this.updateEffects();
  }

  getParams(): GlitchParams {
    return { ...this.params };
  }

  // Individual effect controls
  setStutterParams(params: Partial<StutterParams>): void {
    this.params.stutter = { ...this.params.stutter, ...params };
    this.updateStutter();
  }

  setBitcrushParams(params: Partial<BitcrushParams>): void {
    this.params.bitcrush = { ...this.params.bitcrush, ...params };
    this.updateBitcrush();
  }

  setTapeStopParams(params: Partial<TapeStopParams>): void {
    this.params.tapeStop = { ...this.params.tapeStop, ...params };
  }

  setGranularFreezeParams(params: Partial<GranularFreezeParams>): void {
    this.params.granularFreeze = { ...this.params.granularFreeze, ...params };
  }

  // Trigger effects (for momentary activation)
  triggerStutter(duration?: number): void {
    if (this.bypass || !this.stutterGain || !this.wetNode || !this.dryNode) return;
    
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    
    // Get division in seconds based on current BPM
    const bpm = 120; // TODO: Get from scheduler
    const divisionMap = {
      '1/4': 60 / bpm,
      '1/8': 60 / bpm / 2,
      '1/16': 60 / bpm / 4,
      '1/32': 60 / bpm / 8,
      '1/64': 60 / bpm / 16,
    };
    const stutterTime = divisionMap[this.params.stutter.division];
    
    // Create stutter effect
    const stutterDuration = duration || stutterTime * 8;
    const numStutters = Math.floor(stutterDuration / stutterTime);
    
    // Activate wet signal for the effect
    this.wetNode.gain.cancelScheduledValues(now);
    this.dryNode.gain.cancelScheduledValues(now);
    this.wetNode.gain.setValueAtTime(this.params.stutter.mix, now);
    this.dryNode.gain.setValueAtTime(1 - this.params.stutter.mix * 0.5, now);
    
    // Schedule stutter gates
    this.stutterGain.gain.cancelScheduledValues(now);
    for (let i = 0; i < numStutters; i++) {
      const time = now + (i * stutterTime);
      const decayFactor = 1 - (this.params.stutter.decay * i / numStutters);
      
      // Gate on
      this.stutterGain.gain.setValueAtTime(decayFactor, time);
      // Gate off (short silence)
      this.stutterGain.gain.setValueAtTime(0, time + stutterTime * 0.15);
      // Fade back in
      this.stutterGain.gain.linearRampToValueAtTime(decayFactor * 0.8, time + stutterTime * 0.85);
    }
    
    // Return to dry after effect
    const endTime = now + stutterDuration + 0.05;
    this.wetNode.gain.setTargetAtTime(0, endTime, 0.05);
    this.dryNode.gain.setTargetAtTime(1, endTime, 0.05);
    this.stutterGain.gain.setValueAtTime(1, endTime);
    
    console.log('[GlitchEngine] Stutter triggered:', numStutters, 'stutters over', stutterDuration.toFixed(2), 's');
  }

  triggerTapeStop(): void {
    if (this.bypass || !this.outputNode) return;
    
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    const duration = 0.3 + (this.params.tapeStop.duration * 1.2);
    
    // Simulate tape stop with exponential fade out
    this.outputNode.gain.cancelScheduledValues(now);
    this.outputNode.gain.setValueAtTime(1, now);
    this.outputNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    // Restore after effect
    this.outputNode.gain.setValueAtTime(0, now + duration);
    this.outputNode.gain.linearRampToValueAtTime(1, now + duration + 0.15);
    
    console.log('[GlitchEngine] Tape stop triggered, duration:', duration.toFixed(2), 's');
  }

  triggerGranularFreeze(): void {
    if (this.bypass || !this.wetNode || !this.dryNode || !this.stutterGain) return;
    
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    const freezeDuration = 0.5 + (this.params.granularFreeze.grainSize * 1.5);
    
    // Simulate freeze with rapid micro-stutters (granular-like)
    const grainTime = 0.02 + (this.params.granularFreeze.grainSize * 0.08);
    const numGrains = Math.floor(freezeDuration / grainTime);
    
    // Activate wet
    this.wetNode.gain.cancelScheduledValues(now);
    this.dryNode.gain.cancelScheduledValues(now);
    this.wetNode.gain.setValueAtTime(this.params.granularFreeze.mix, now);
    this.dryNode.gain.setValueAtTime(0.3, now);
    
    // Rapid grain-like gates
    this.stutterGain.gain.cancelScheduledValues(now);
    for (let i = 0; i < numGrains; i++) {
      const time = now + (i * grainTime);
      const spreadRandom = 1 - (Math.random() * this.params.granularFreeze.spread * 0.5);
      
      this.stutterGain.gain.setValueAtTime(spreadRandom, time);
      this.stutterGain.gain.setValueAtTime(0, time + grainTime * 0.3);
      this.stutterGain.gain.linearRampToValueAtTime(spreadRandom * 0.7, time + grainTime * 0.9);
    }
    
    // Return to normal
    const endTime = now + freezeDuration + 0.05;
    this.wetNode.gain.setTargetAtTime(0, endTime, 0.05);
    this.dryNode.gain.setTargetAtTime(1, endTime, 0.05);
    this.stutterGain.gain.setValueAtTime(1, endTime);
    
    console.log('[GlitchEngine] Freeze triggered:', numGrains, 'grains over', freezeDuration.toFixed(2), 's');
  }

  private updateMix(): void {
    if (!this.dryNode || !this.wetNode) return;
    
    const ctx = audioEngine.getContext();
    const anyActive = Object.values(this.params).some(p => p.active);
    
    if (anyActive && !this.bypass) {
      // Calculate combined mix
      const activeMixes = Object.values(this.params)
        .filter(p => p.active)
        .map(p => p.mix);
      const avgMix = activeMixes.length > 0 
        ? activeMixes.reduce((a, b) => a + b, 0) / activeMixes.length 
        : 0;
      
      this.dryNode.gain.setTargetAtTime(1 - avgMix * 0.5, ctx.currentTime, 0.01);
      this.wetNode.gain.setTargetAtTime(avgMix, ctx.currentTime, 0.01);
    } else {
      this.dryNode.gain.setTargetAtTime(1, ctx.currentTime, 0.01);
      this.wetNode.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
    }
  }

  private updateEffects(): void {
    this.updateStutter();
    this.updateBitcrush();
    this.updateMix();
  }

  private updateStutter(): void {
    if (this.params.stutter.active && !this.bypass) {
      // Stutter is triggered manually, but we can set up continuous mode
    }
  }

  private updateBitcrush(): void {
    // Bitcrush would update the ScriptProcessor parameters
  }

  private stopAllEffects(): void {
    if (this.stutterInterval) {
      clearInterval(this.stutterInterval);
      this.stutterInterval = null;
    }
    if (this.stutterGain) {
      const ctx = audioEngine.getContext();
      this.stutterGain.gain.cancelScheduledValues(ctx.currentTime);
      this.stutterGain.gain.setValueAtTime(1, ctx.currentTime);
    }
  }

  disconnect(): void {
    this.stopAllEffects();
    this.inputNode?.disconnect();
    this.outputNode?.disconnect();
    this.dryNode?.disconnect();
    this.wetNode?.disconnect();
    this.stutterGain?.disconnect();
    this.isConnected = false;
  }
}

export const glitchEngine = GlitchEngine.getInstance();
