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
    if (this.bypass || !this.stutterGain) return;
    
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    
    // Get division in ms based on current BPM (assuming 120 BPM for now)
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
    const stutterDuration = duration || stutterTime * 4;
    const numStutters = Math.floor(stutterDuration / stutterTime);
    
    for (let i = 0; i < numStutters; i++) {
      const time = now + (i * stutterTime);
      this.stutterGain.gain.setValueAtTime(1, time);
      this.stutterGain.gain.setValueAtTime(0, time + stutterTime * 0.1);
      this.stutterGain.gain.linearRampToValueAtTime(
        1 - (this.params.stutter.decay * i / numStutters),
        time + stutterTime * 0.9
      );
    }
  }

  triggerTapeStop(): void {
    if (this.bypass) return;
    // Tape stop would need a more complex implementation with pitch shifting
    console.log('[GlitchEngine] Tape stop triggered');
  }

  triggerGranularFreeze(): void {
    if (this.bypass) return;
    // Granular freeze would need audio buffer recording
    console.log('[GlitchEngine] Granular freeze triggered');
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
