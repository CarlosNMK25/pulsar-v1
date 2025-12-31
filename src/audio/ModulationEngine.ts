// Modulation Engine - Chorus, Flanger, Phaser, Tremolo, Ring Mod, Auto-Pan
import { audioEngine } from './AudioEngine';

export interface ChorusParams {
  rate: number;     // 0-1: LFO speed (0.1-10 Hz)
  depth: number;    // 0-1: modulation amount
  mix: number;      // 0-1: wet/dry
  voices: 1 | 2 | 3 | 4;
}

export interface FlangerParams {
  rate: number;     // 0-1: LFO speed
  depth: number;    // 0-1: modulation amount
  feedback: number; // 0-1: regeneration
  mix: number;      // 0-1: wet/dry
}

export interface PhaserParams {
  rate: number;     // 0-1: LFO speed
  depth: number;    // 0-1: modulation amount
  stages: 2 | 4 | 6 | 8;
  mix: number;      // 0-1: wet/dry
}

export interface TremoloParams {
  rate: number;     // 0-1: LFO speed (0.5-20 Hz)
  depth: number;    // 0-1: modulation amount
  shape: 'sine' | 'square' | 'triangle';
}

export interface RingModParams {
  frequency: number; // 0-1: carrier freq (20-2000 Hz)
  mix: number;       // 0-1: wet/dry
}

export interface AutoPanParams {
  rate: number;      // 0-1: LFO speed
  depth: number;     // 0-1: pan amount
  shape: 'sine' | 'triangle';
}

export interface ModulationParams {
  chorus: ChorusParams;
  flanger: FlangerParams;
  phaser: PhaserParams;
  tremolo: TremoloParams;
  ringMod: RingModParams;
  autoPan: AutoPanParams;
}

export const defaultModulationParams: ModulationParams = {
  chorus: { rate: 0.3, depth: 0.5, mix: 0.3, voices: 2 },
  flanger: { rate: 0.2, depth: 0.5, feedback: 0.4, mix: 0.3 },
  phaser: { rate: 0.3, depth: 0.6, stages: 4, mix: 0.4 },
  tremolo: { rate: 0.4, depth: 0.5, shape: 'sine' },
  ringMod: { frequency: 0.3, mix: 0.3 },
  autoPan: { rate: 0.3, depth: 0.5, shape: 'sine' },
};

export type ModEffect = 'chorus' | 'flanger' | 'phaser' | 'tremolo' | 'ringMod' | 'autoPan';

export class ModulationEngine {
  private static instance: ModulationEngine | null = null;
  private initialized = false;
  
  // Chorus nodes
  private chorusInput: GainNode | null = null;
  private chorusOutput: GainNode | null = null;
  private chorusDelays: DelayNode[] = [];
  private chorusLFOs: OscillatorNode[] = [];
  private chorusLFOGains: GainNode[] = [];
  private chorusDry: GainNode | null = null;
  private chorusWet: GainNode | null = null;
  
  // Flanger nodes
  private flangerInput: GainNode | null = null;
  private flangerOutput: GainNode | null = null;
  private flangerDelay: DelayNode | null = null;
  private flangerLFO: OscillatorNode | null = null;
  private flangerLFOGain: GainNode | null = null;
  private flangerFeedback: GainNode | null = null;
  private flangerDry: GainNode | null = null;
  private flangerWet: GainNode | null = null;
  
  // Phaser nodes
  private phaserInput: GainNode | null = null;
  private phaserOutput: GainNode | null = null;
  private phaserFilters: BiquadFilterNode[] = [];
  private phaserLFO: OscillatorNode | null = null;
  private phaserLFOGains: GainNode[] = [];
  private phaserDry: GainNode | null = null;
  private phaserWet: GainNode | null = null;
  
  // Tremolo nodes
  private tremoloInput: GainNode | null = null;
  private tremoloOutput: GainNode | null = null;
  private tremoloLFO: OscillatorNode | null = null;
  private tremoloLFOGain: GainNode | null = null;
  private tremoloModGain: GainNode | null = null;
  
  // Ring Mod nodes
  private ringModInput: GainNode | null = null;
  private ringModOutput: GainNode | null = null;
  private ringModCarrier: OscillatorNode | null = null;
  private ringModCarrierGain: GainNode | null = null;
  private ringModDry: GainNode | null = null;
  private ringModWet: GainNode | null = null;
  
  // Auto-Pan nodes
  private autoPanInput: GainNode | null = null;
  private autoPanOutput: GainNode | null = null;
  private autoPanLFO: OscillatorNode | null = null;
  private autoPanLFOGain: GainNode | null = null;
  private autoPanPanner: StereoPannerNode | null = null;
  
  // Master input/output for routing
  private masterInput: GainNode | null = null;
  private masterOutput: GainNode | null = null;
  
  // Bypass states
  private bypassed: Record<ModEffect, boolean> = {
    chorus: true,
    flanger: true,
    phaser: true,
    tremolo: true,
    ringMod: true,
    autoPan: true,
  };
  
  // Params
  private params: ModulationParams = { ...defaultModulationParams };
  
  private constructor() {}
  
  static getInstance(): ModulationEngine {
    if (!ModulationEngine.instance) {
      ModulationEngine.instance = new ModulationEngine();
    }
    return ModulationEngine.instance;
  }
  
  private ensureInitialized(): void {
    if (this.initialized) return;
    
    const ctx = audioEngine.getContext();
    
    // Master routing
    this.masterInput = ctx.createGain();
    this.masterOutput = ctx.createGain();
    
    this.initChorus(ctx);
    this.initFlanger(ctx);
    this.initPhaser(ctx);
    this.initTremolo(ctx);
    this.initRingMod(ctx);
    this.initAutoPan(ctx);
    
    // Connect all effects in parallel from masterInput, then merge to masterOutput
    // Each effect has its own input that we'll connect to masterInput
    this.masterInput.connect(this.chorusInput!);
    this.masterInput.connect(this.flangerInput!);
    this.masterInput.connect(this.phaserInput!);
    this.masterInput.connect(this.tremoloInput!);
    this.masterInput.connect(this.ringModInput!);
    this.masterInput.connect(this.autoPanInput!);
    
    // Also pass dry signal through
    const dryThrough = ctx.createGain();
    dryThrough.gain.value = 1;
    this.masterInput.connect(dryThrough);
    dryThrough.connect(this.masterOutput);
    
    // Each effect output goes to masterOutput (we start with all bypassed)
    this.chorusOutput!.connect(this.masterOutput);
    this.flangerOutput!.connect(this.masterOutput);
    this.phaserOutput!.connect(this.masterOutput);
    this.tremoloOutput!.connect(this.masterOutput);
    this.ringModOutput!.connect(this.masterOutput);
    this.autoPanOutput!.connect(this.masterOutput);
    
    // Start with all effects muted (bypassed)
    this.chorusOutput!.gain.value = 0;
    this.flangerOutput!.gain.value = 0;
    this.phaserOutput!.gain.value = 0;
    this.tremoloOutput!.gain.value = 0;
    this.ringModOutput!.gain.value = 0;
    this.autoPanOutput!.gain.value = 0;
    
    this.initialized = true;
    console.log('[ModulationEngine] Initialized with 6 effects');
  }
  
  private initChorus(ctx: AudioContext): void {
    this.chorusInput = ctx.createGain();
    this.chorusOutput = ctx.createGain();
    this.chorusDry = ctx.createGain();
    this.chorusWet = ctx.createGain();
    
    this.chorusDry.gain.value = 1 - this.params.chorus.mix;
    this.chorusWet.gain.value = this.params.chorus.mix;
    
    const merger = ctx.createGain();
    
    // Create multiple delay lines for chorus voices
    for (let i = 0; i < 4; i++) {
      const delay = ctx.createDelay(0.05);
      delay.delayTime.value = 0.02 + (i * 0.005);
      
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.5 + (i * 0.3);
      
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.002;
      
      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      lfo.start();
      
      this.chorusInput.connect(delay);
      delay.connect(merger);
      
      this.chorusDelays.push(delay);
      this.chorusLFOs.push(lfo);
      this.chorusLFOGains.push(lfoGain);
    }
    
    this.chorusInput.connect(this.chorusDry);
    merger.connect(this.chorusWet);
    this.chorusDry.connect(this.chorusOutput);
    this.chorusWet.connect(this.chorusOutput);
  }
  
  private initFlanger(ctx: AudioContext): void {
    this.flangerInput = ctx.createGain();
    this.flangerOutput = ctx.createGain();
    this.flangerDry = ctx.createGain();
    this.flangerWet = ctx.createGain();
    
    this.flangerDelay = ctx.createDelay(0.02);
    this.flangerDelay.delayTime.value = 0.005;
    
    this.flangerLFO = ctx.createOscillator();
    this.flangerLFO.type = 'sine';
    this.flangerLFO.frequency.value = 0.5;
    
    this.flangerLFOGain = ctx.createGain();
    this.flangerLFOGain.gain.value = 0.003;
    
    this.flangerFeedback = ctx.createGain();
    this.flangerFeedback.gain.value = 0.5;
    
    this.flangerLFO.connect(this.flangerLFOGain);
    this.flangerLFOGain.connect(this.flangerDelay.delayTime);
    this.flangerLFO.start();
    
    this.flangerInput.connect(this.flangerDelay);
    this.flangerDelay.connect(this.flangerFeedback);
    this.flangerFeedback.connect(this.flangerDelay);
    this.flangerDelay.connect(this.flangerWet);
    
    this.flangerInput.connect(this.flangerDry);
    this.flangerDry.gain.value = 1 - this.params.flanger.mix;
    this.flangerWet.gain.value = this.params.flanger.mix;
    
    this.flangerDry.connect(this.flangerOutput);
    this.flangerWet.connect(this.flangerOutput);
  }
  
  private initPhaser(ctx: AudioContext): void {
    this.phaserInput = ctx.createGain();
    this.phaserOutput = ctx.createGain();
    this.phaserDry = ctx.createGain();
    this.phaserWet = ctx.createGain();
    
    this.phaserLFO = ctx.createOscillator();
    this.phaserLFO.type = 'sine';
    this.phaserLFO.frequency.value = 0.5;
    this.phaserLFO.start();
    
    // Create allpass filter chain (8 stages max)
    let lastNode: AudioNode = this.phaserInput;
    for (let i = 0; i < 8; i++) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'allpass';
      filter.frequency.value = 1000;
      filter.Q.value = 0.5;
      
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 500;
      
      this.phaserLFO.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      
      lastNode.connect(filter);
      lastNode = filter;
      
      this.phaserFilters.push(filter);
      this.phaserLFOGains.push(lfoGain);
    }
    
    lastNode.connect(this.phaserWet);
    this.phaserInput.connect(this.phaserDry);
    
    this.phaserDry.gain.value = 1 - this.params.phaser.mix;
    this.phaserWet.gain.value = this.params.phaser.mix;
    
    this.phaserDry.connect(this.phaserOutput);
    this.phaserWet.connect(this.phaserOutput);
  }
  
  private initTremolo(ctx: AudioContext): void {
    this.tremoloInput = ctx.createGain();
    this.tremoloOutput = ctx.createGain();
    
    this.tremoloModGain = ctx.createGain();
    this.tremoloModGain.gain.value = 1;
    
    this.tremoloLFO = ctx.createOscillator();
    this.tremoloLFO.type = 'sine';
    this.tremoloLFO.frequency.value = 5;
    
    this.tremoloLFOGain = ctx.createGain();
    this.tremoloLFOGain.gain.value = 0.5;
    
    // LFO modulates the gain
    this.tremoloLFO.connect(this.tremoloLFOGain);
    this.tremoloLFOGain.connect(this.tremoloModGain.gain);
    this.tremoloLFO.start();
    
    this.tremoloInput.connect(this.tremoloModGain);
    this.tremoloModGain.connect(this.tremoloOutput);
  }
  
  private initRingMod(ctx: AudioContext): void {
    this.ringModInput = ctx.createGain();
    this.ringModOutput = ctx.createGain();
    this.ringModDry = ctx.createGain();
    this.ringModWet = ctx.createGain();
    
    this.ringModCarrier = ctx.createOscillator();
    this.ringModCarrier.type = 'sine';
    this.ringModCarrier.frequency.value = 440;
    
    this.ringModCarrierGain = ctx.createGain();
    this.ringModCarrierGain.gain.value = 1;
    
    // Ring modulation: multiply input by carrier
    this.ringModCarrier.connect(this.ringModCarrierGain);
    this.ringModCarrier.start();
    
    // We need a gain node to do the multiplication
    const modulator = ctx.createGain();
    modulator.gain.value = 0;
    this.ringModCarrierGain.connect(modulator.gain);
    
    this.ringModInput.connect(modulator);
    modulator.connect(this.ringModWet);
    
    this.ringModInput.connect(this.ringModDry);
    this.ringModDry.gain.value = 1 - this.params.ringMod.mix;
    this.ringModWet.gain.value = this.params.ringMod.mix;
    
    this.ringModDry.connect(this.ringModOutput);
    this.ringModWet.connect(this.ringModOutput);
  }
  
  private initAutoPan(ctx: AudioContext): void {
    this.autoPanInput = ctx.createGain();
    this.autoPanOutput = ctx.createGain();
    
    this.autoPanPanner = ctx.createStereoPanner();
    this.autoPanPanner.pan.value = 0;
    
    this.autoPanLFO = ctx.createOscillator();
    this.autoPanLFO.type = 'sine';
    this.autoPanLFO.frequency.value = 2;
    
    this.autoPanLFOGain = ctx.createGain();
    this.autoPanLFOGain.gain.value = 0.5;
    
    this.autoPanLFO.connect(this.autoPanLFOGain);
    this.autoPanLFOGain.connect(this.autoPanPanner.pan);
    this.autoPanLFO.start();
    
    this.autoPanInput.connect(this.autoPanPanner);
    this.autoPanPanner.connect(this.autoPanOutput);
  }
  
  // Get input node for routing
  getInput(): GainNode {
    this.ensureInitialized();
    return this.masterInput!;
  }
  
  // Get output node for routing
  getOutput(): GainNode {
    this.ensureInitialized();
    return this.masterOutput!;
  }
  
  // Set chorus parameters
  setChorusParams(params: Partial<ChorusParams>): void {
    if (!this.initialized) return;
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    
    this.params.chorus = { ...this.params.chorus, ...params };
    const p = this.params.chorus;
    
    // Update LFO rates
    const baseRate = 0.1 + p.rate * 9.9; // 0.1-10 Hz
    this.chorusLFOs.forEach((lfo, i) => {
      lfo.frequency.setTargetAtTime(baseRate + (i * 0.3), now, 0.05);
    });
    
    // Update depth
    const depthValue = 0.001 + p.depth * 0.005;
    this.chorusLFOGains.forEach(g => {
      g.gain.setTargetAtTime(depthValue, now, 0.05);
    });
    
    // Update mix
    if (this.chorusDry && this.chorusWet) {
      this.chorusDry.gain.setTargetAtTime(1 - p.mix, now, 0.05);
      this.chorusWet.gain.setTargetAtTime(p.mix, now, 0.05);
    }
  }
  
  // Set flanger parameters
  setFlangerParams(params: Partial<FlangerParams>): void {
    if (!this.initialized) return;
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    
    this.params.flanger = { ...this.params.flanger, ...params };
    const p = this.params.flanger;
    
    // Update LFO rate
    const rate = 0.05 + p.rate * 4.95; // 0.05-5 Hz
    this.flangerLFO?.frequency.setTargetAtTime(rate, now, 0.05);
    
    // Update depth
    const depth = 0.001 + p.depth * 0.008;
    this.flangerLFOGain?.gain.setTargetAtTime(depth, now, 0.05);
    
    // Update feedback
    const feedback = Math.min(p.feedback, 0.95);
    this.flangerFeedback?.gain.setTargetAtTime(feedback, now, 0.05);
    
    // Update mix
    this.flangerDry?.gain.setTargetAtTime(1 - p.mix, now, 0.05);
    this.flangerWet?.gain.setTargetAtTime(p.mix, now, 0.05);
  }
  
  // Set phaser parameters
  setPhaserParams(params: Partial<PhaserParams>): void {
    if (!this.initialized) return;
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    
    this.params.phaser = { ...this.params.phaser, ...params };
    const p = this.params.phaser;
    
    // Update LFO rate
    const rate = 0.1 + p.rate * 9.9; // 0.1-10 Hz
    this.phaserLFO?.frequency.setTargetAtTime(rate, now, 0.05);
    
    // Update depth (LFO modulation amount)
    const depthValue = 200 + p.depth * 800;
    this.phaserLFOGains.forEach(g => {
      g.gain.setTargetAtTime(depthValue, now, 0.05);
    });
    
    // Update mix
    this.phaserDry?.gain.setTargetAtTime(1 - p.mix, now, 0.05);
    this.phaserWet?.gain.setTargetAtTime(p.mix, now, 0.05);
  }
  
  // Set tremolo parameters
  setTremoloParams(params: Partial<TremoloParams>): void {
    if (!this.initialized) return;
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    
    this.params.tremolo = { ...this.params.tremolo, ...params };
    const p = this.params.tremolo;
    
    // Update LFO rate (0.5-20 Hz)
    const rate = 0.5 + p.rate * 19.5;
    this.tremoloLFO?.frequency.setTargetAtTime(rate, now, 0.05);
    
    // Update shape
    if (params.shape && this.tremoloLFO) {
      this.tremoloLFO.type = p.shape === 'square' ? 'square' : p.shape === 'triangle' ? 'triangle' : 'sine';
    }
    
    // Update depth
    this.tremoloLFOGain?.gain.setTargetAtTime(p.depth * 0.5, now, 0.05);
  }
  
  // Set ring mod parameters
  setRingModParams(params: Partial<RingModParams>): void {
    if (!this.initialized) return;
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    
    this.params.ringMod = { ...this.params.ringMod, ...params };
    const p = this.params.ringMod;
    
    // Update carrier frequency (20-2000 Hz)
    const freq = 20 + p.frequency * 1980;
    this.ringModCarrier?.frequency.setTargetAtTime(freq, now, 0.05);
    
    // Update mix
    this.ringModDry?.gain.setTargetAtTime(1 - p.mix, now, 0.05);
    this.ringModWet?.gain.setTargetAtTime(p.mix, now, 0.05);
  }
  
  // Set auto-pan parameters
  setAutoPanParams(params: Partial<AutoPanParams>): void {
    if (!this.initialized) return;
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    
    this.params.autoPan = { ...this.params.autoPan, ...params };
    const p = this.params.autoPan;
    
    // Update LFO rate (0.1-10 Hz)
    const rate = 0.1 + p.rate * 9.9;
    this.autoPanLFO?.frequency.setTargetAtTime(rate, now, 0.05);
    
    // Update shape
    if (params.shape && this.autoPanLFO) {
      this.autoPanLFO.type = p.shape === 'triangle' ? 'triangle' : 'sine';
    }
    
    // Update depth
    this.autoPanLFOGain?.gain.setTargetAtTime(p.depth, now, 0.05);
  }
  
  // Set bypass for effect
  setBypass(effect: ModEffect, bypass: boolean): void {
    if (!this.initialized) return;
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    
    this.bypassed[effect] = bypass;
    
    // Get the output gain for this effect
    let outputGain: GainNode | null = null;
    let mixValue = 0;
    
    switch (effect) {
      case 'chorus':
        outputGain = this.chorusOutput;
        mixValue = bypass ? 0 : 1;
        break;
      case 'flanger':
        outputGain = this.flangerOutput;
        mixValue = bypass ? 0 : 1;
        break;
      case 'phaser':
        outputGain = this.phaserOutput;
        mixValue = bypass ? 0 : 1;
        break;
      case 'tremolo':
        outputGain = this.tremoloOutput;
        mixValue = bypass ? 0 : 1;
        break;
      case 'ringMod':
        outputGain = this.ringModOutput;
        mixValue = bypass ? 0 : 1;
        break;
      case 'autoPan':
        outputGain = this.autoPanOutput;
        mixValue = bypass ? 0 : 1;
        break;
    }
    
    outputGain?.gain.setTargetAtTime(mixValue, now, 0.05);
  }
  
  // Check if effect is bypassed
  isBypassed(effect: ModEffect): boolean {
    return this.bypassed[effect];
  }
  
  // Get current params
  getParams(): ModulationParams {
    return { ...this.params };
  }
  
  getChorusParams(): ChorusParams { return { ...this.params.chorus }; }
  getFlangerParams(): FlangerParams { return { ...this.params.flanger }; }
  getPhaserParams(): PhaserParams { return { ...this.params.phaser }; }
  getTremoloParams(): TremoloParams { return { ...this.params.tremolo }; }
  getRingModParams(): RingModParams { return { ...this.params.ringMod }; }
  getAutoPanParams(): AutoPanParams { return { ...this.params.autoPan }; }
}

export const modulationEngine = ModulationEngine.getInstance();
