// Glitch effects engine for IDM-style audio manipulation
import { audioEngine } from './AudioEngine';
import { scheduler } from './Scheduler';
import { fxEngine } from './FXEngine';

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

export interface ChaosParams {
  enabled: boolean;
  density: number; // 0-1: how often effects trigger
  intensity: number; // 0-1: effect intensity
}

export interface ReverseParams extends GlitchEffectParams {
  duration: number; // 0-1: fragment duration to reverse (0.1 - 0.5s)
}

export interface GlitchParams {
  stutter: StutterParams;
  bitcrush: BitcrushParams;
  tapeStop: TapeStopParams;
  granularFreeze: GranularFreezeParams;
  reverse: ReverseParams;
  chaos: ChaosParams;
}

export class GlitchEngine {
  private static instance: GlitchEngine;
  
  private inputNode: GainNode | null = null;
  private outputNode: GainNode | null = null;
  private dryNode: GainNode | null = null;
  private wetNode: GainNode | null = null;
  
  // Effect nodes
  private stutterGain: GainNode | null = null;
  private bitcrusher: ScriptProcessorNode | null = null;
  private bitcrushGain: GainNode | null = null;
  private tapeStopNode: AudioBufferSourceNode | null = null;
  
  // Bitcrush state
  private bitcrushPhase = 0;
  private bitcrushLastSample = 0;
  
  // Chaos mode
  private chaosInterval: number | null = null;
  
  private bypass = true;
  
  // FX sends for glitch output
  private reverbSend: GainNode | null = null;
  private delaySend: GainNode | null = null;
  private fxBypassed = true;
  private isConnected = false;
  
  // Reverse effect state
  private reverseBuffer: AudioBuffer | null = null;
  private reverseProcessor: ScriptProcessorNode | null = null;
  private reverseGain: GainNode | null = null;
  private reverseRecording = false;
  private reversePlayback = false;
  private reverseSamples: Float32Array[] = [];
  private reversePlaybackIndex = 0;

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
    reverse: {
      active: false,
      mix: 0.7,
      duration: 0.5,
    },
    chaos: {
      enabled: false,
      density: 0.3,
      intensity: 0.5,
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
    
    // Create bitcrusher using ScriptProcessor
    this.bitcrushGain = ctx.createGain();
    this.bitcrushGain.gain.value = 0; // Start silent
    this.bitcrusher = ctx.createScriptProcessor(4096, 2, 2);
    this.bitcrusher.onaudioprocess = this.processBitcrush.bind(this);
    
    // Connect: input -> dry -> output
    //          input -> effects -> wet -> output
    this.inputNode.connect(this.dryNode);
    this.dryNode.connect(this.outputNode);
    
    // Stutter path
    this.inputNode.connect(this.stutterGain);
    this.stutterGain.connect(this.wetNode);
    
    // Bitcrush path
    this.inputNode.connect(this.bitcrusher);
    this.bitcrusher.connect(this.bitcrushGain);
    this.bitcrushGain.connect(this.wetNode);
    
    // Reverse effect path
    this.reverseGain = ctx.createGain();
    this.reverseGain.gain.value = 0;
    this.reverseProcessor = ctx.createScriptProcessor(2048, 2, 2);
    this.reverseProcessor.onaudioprocess = this.processReverse.bind(this);
    this.inputNode.connect(this.reverseProcessor);
    this.reverseProcessor.connect(this.reverseGain);
    this.reverseGain.connect(this.wetNode);
    
    this.wetNode.connect(this.outputNode);
    
    this.isConnected = true;
    console.log('[GlitchEngine] Initialized with Bitcrusher and Reverse');
    
    // Connect FX sends
    this.connectFX();
  }
  
  // Connect glitch output to FX sends
  connectFX(): void {
    if (this.reverbSend || !this.wetNode) return;
    
    const ctx = audioEngine.getContext();
    
    this.reverbSend = ctx.createGain();
    this.delaySend = ctx.createGain();
    
    // Default send levels (can be controlled separately)
    this.reverbSend.gain.value = this.fxBypassed ? 0 : 0.3;
    this.delaySend.gain.value = this.fxBypassed ? 0 : 0.2;
    
    // Connect wet output to FX sends
    this.wetNode.connect(this.reverbSend);
    this.wetNode.connect(this.delaySend);
    
    // Connect to FX engine inputs
    this.reverbSend.connect(fxEngine.getReverbSend());
    this.delaySend.connect(fxEngine.getDelaySend());
    
    console.log('[GlitchEngine] Connected to FX sends');
  }
  
  // Control FX bypass for glitch output
  setFXBypass(bypass: boolean): void {
    this.fxBypassed = bypass;
    
    if (!this.reverbSend || !this.delaySend) return;
    
    const ctx = audioEngine.getContext();
    const targetValue = bypass ? 0 : 0.3;
    const delayTarget = bypass ? 0 : 0.2;
    
    this.reverbSend.gain.setTargetAtTime(targetValue, ctx.currentTime, 0.02);
    this.delaySend.gain.setTargetAtTime(delayTarget, ctx.currentTime, 0.02);
    
    console.log('[GlitchEngine] FX bypass:', bypass);
  }
  
  // Set FX send levels
  setFXSend(reverb: number, delay: number): void {
    if (!this.reverbSend || !this.delaySend) return;
    if (this.fxBypassed) return;
    
    const ctx = audioEngine.getContext();
    this.reverbSend.gain.setTargetAtTime(reverb, ctx.currentTime, 0.02);
    this.delaySend.gain.setTargetAtTime(delay, ctx.currentTime, 0.02);
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

  // Master mix control (global dry/wet for all glitch effects)
  setMasterMix(mix: number): void {
    if (!this.wetNode || !this.dryNode) return;
    const ctx = audioEngine.getContext();
    const normalizedMix = mix / 100;
    // Keep dry signal mostly intact, blend wet based on mix
    this.dryNode.gain.setTargetAtTime(1 - normalizedMix * 0.5, ctx.currentTime, 0.02);
    this.wetNode.gain.setTargetAtTime(normalizedMix, ctx.currentTime, 0.02);
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

  setReverseParams(params: Partial<ReverseParams>): void {
    this.params.reverse = { ...this.params.reverse, ...params };
  }

  // Trigger effects (for momentary activation)
  triggerStutter(duration?: number): void {
    if (this.bypass || !this.stutterGain || !this.wetNode || !this.dryNode) return;
    
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    
    // Get division in seconds based on current BPM from scheduler
    const bpm = scheduler.getBpm();
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
    if (this.bypass || !this.outputNode || !this.inputNode) return;
    
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    const duration = 0.3 + (this.params.tapeStop.duration * 1.2);
    
    // Create a more realistic tape stop using playbackRate simulation
    // We'll use gain automation combined with pitch-shifting feel
    this.outputNode.gain.cancelScheduledValues(now);
    this.outputNode.gain.setValueAtTime(1, now);
    
    // Create a series of gain steps to simulate decreasing playback rate
    // This creates a "slowing down" effect by gradually muting
    const steps = 20;
    for (let i = 0; i < steps; i++) {
      const t = now + (i / steps) * duration;
      const progress = i / steps;
      // Exponential decay for more natural sound
      const gainValue = Math.pow(1 - progress, 2);
      this.outputNode.gain.setValueAtTime(gainValue, t);
    }
    
    // Final silence
    this.outputNode.gain.setValueAtTime(0, now + duration);
    
    // Restore after effect
    this.outputNode.gain.linearRampToValueAtTime(1, now + duration + 0.15);
    
    console.log('[GlitchEngine] Tape stop triggered with pitch simulation, duration:', duration.toFixed(2), 's');
  }
  
  triggerBitcrush(duration?: number): void {
    if (this.bypass || !this.bitcrushGain || !this.wetNode || !this.dryNode) return;
    
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    const crushDuration = duration || 0.5;
    
    // Activate bitcrush
    this.wetNode.gain.cancelScheduledValues(now);
    this.dryNode.gain.cancelScheduledValues(now);
    this.bitcrushGain.gain.cancelScheduledValues(now);
    
    this.wetNode.gain.setValueAtTime(this.params.bitcrush.mix, now);
    this.dryNode.gain.setValueAtTime(1 - this.params.bitcrush.mix * 0.5, now);
    this.bitcrushGain.gain.setValueAtTime(1, now);
    
    // Return to normal
    const endTime = now + crushDuration;
    this.bitcrushGain.gain.setValueAtTime(0, endTime);
    this.wetNode.gain.setTargetAtTime(0, endTime, 0.05);
    this.dryNode.gain.setTargetAtTime(1, endTime, 0.05);
    
    console.log('[GlitchEngine] Bitcrush triggered for', crushDuration.toFixed(2), 's');
  }
  
  // Bitcrush audio processing
  private processBitcrush(event: AudioProcessingEvent): void {
    const bits = this.params.bitcrush.bits;
    const sampleRateReduction = Math.floor(1 + (1 - this.params.bitcrush.sampleRate) * 32);
    const levels = Math.pow(2, bits);
    
    for (let channel = 0; channel < event.outputBuffer.numberOfChannels; channel++) {
      const inputData = event.inputBuffer.getChannelData(channel);
      const outputData = event.outputBuffer.getChannelData(channel);
      
      for (let i = 0; i < inputData.length; i++) {
        // Sample rate reduction
        if (this.bitcrushPhase % sampleRateReduction === 0) {
          // Bit reduction: quantize to N bits
          this.bitcrushLastSample = Math.round(inputData[i] * levels) / levels;
        }
        outputData[i] = this.bitcrushLastSample;
        this.bitcrushPhase++;
      }
    }
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

  triggerReverse(duration?: number): void {
    if (this.bypass || !this.reverseGain || !this.wetNode || !this.dryNode) return;
    
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    const sampleRate = ctx.sampleRate;
    
    // Duration of fragment to capture and reverse (0.1 - 0.5 seconds)
    const reverseDuration = duration || (0.1 + this.params.reverse.duration * 0.4);
    const bufferSize = Math.floor(reverseDuration * sampleRate);
    
    // Start recording phase
    this.reverseSamples = [new Float32Array(bufferSize), new Float32Array(bufferSize)];
    this.reverseRecording = true;
    this.reversePlayback = false;
    this.reversePlaybackIndex = 0;
    
    // After capturing, switch to playback
    setTimeout(() => {
      this.reverseRecording = false;
      
      // Reverse the captured samples
      for (let ch = 0; ch < this.reverseSamples.length; ch++) {
        this.reverseSamples[ch].reverse();
      }
      
      // Start reversed playback
      this.reversePlayback = true;
      this.reversePlaybackIndex = 0;
      
      // Activate wet signal
      if (this.wetNode && this.dryNode && this.reverseGain) {
        this.wetNode.gain.setValueAtTime(this.params.reverse.mix, ctx.currentTime);
        this.dryNode.gain.setValueAtTime(1 - this.params.reverse.mix * 0.7, ctx.currentTime);
        this.reverseGain.gain.setValueAtTime(1, ctx.currentTime);
      }
      
      // Return to normal after playback
      setTimeout(() => {
        this.reversePlayback = false;
        if (this.wetNode && this.dryNode && this.reverseGain) {
          this.wetNode.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
          this.dryNode.gain.setTargetAtTime(1, ctx.currentTime, 0.05);
          this.reverseGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        }
      }, reverseDuration * 1000);
      
    }, reverseDuration * 1000);
    
    console.log('[GlitchEngine] Reverse triggered, duration:', reverseDuration.toFixed(2), 's');
  }

  // Reverse audio processing
  private processReverse(event: AudioProcessingEvent): void {
    const inputL = event.inputBuffer.getChannelData(0);
    const inputR = event.inputBuffer.getChannelData(1);
    const outputL = event.outputBuffer.getChannelData(0);
    const outputR = event.outputBuffer.getChannelData(1);
    
    if (this.reverseRecording && this.reverseSamples.length >= 2) {
      // Record incoming audio
      const remaining = this.reverseSamples[0].length - this.reversePlaybackIndex;
      const toCopy = Math.min(remaining, inputL.length);
      
      for (let i = 0; i < toCopy; i++) {
        this.reverseSamples[0][this.reversePlaybackIndex + i] = inputL[i];
        this.reverseSamples[1][this.reversePlaybackIndex + i] = inputR[i];
      }
      this.reversePlaybackIndex += toCopy;
      
      // Output silence during recording
      outputL.fill(0);
      outputR.fill(0);
    } else if (this.reversePlayback && this.reverseSamples.length >= 2) {
      // Playback reversed audio
      const remaining = this.reverseSamples[0].length - this.reversePlaybackIndex;
      const toPlay = Math.min(remaining, outputL.length);
      
      for (let i = 0; i < toPlay; i++) {
        outputL[i] = this.reverseSamples[0][this.reversePlaybackIndex + i];
        outputR[i] = this.reverseSamples[1][this.reversePlaybackIndex + i];
      }
      
      // Fill remaining with zeros if buffer ended
      for (let i = toPlay; i < outputL.length; i++) {
        outputL[i] = 0;
        outputR[i] = 0;
      }
      
      this.reversePlaybackIndex += toPlay;
    } else {
      // Pass through silence when not active
      outputL.fill(0);
      outputR.fill(0);
    }
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
    // Bitcrush parameters are read directly in processBitcrush
    // No additional setup needed as ScriptProcessor reads from this.params
  }
  
  // Chaos mode - random effect triggering
  startChaos(): void {
    if (this.chaosInterval) return;
    
    this.params.chaos.enabled = true;
    const baseInterval = 200; // Base check interval in ms
    
    this.chaosInterval = window.setInterval(() => {
      if (!this.params.chaos.enabled || this.bypass) return;
      
      // Check if we should trigger based on density
      if (Math.random() > this.params.chaos.density) return;
      
      // Choose random effect (now includes reverse)
      const effects = ['stutter', 'bitcrush', 'tapestop', 'freeze', 'reverse'] as const;
      const effect = effects[Math.floor(Math.random() * effects.length)];
      const intensity = this.params.chaos.intensity;
      
      switch (effect) {
        case 'stutter':
          const divisions: StutterParams['division'][] = ['1/8', '1/16', '1/32', '1/64'];
          this.params.stutter.division = divisions[Math.floor(Math.random() * divisions.length)];
          this.params.stutter.mix = 0.3 + intensity * 0.7;
          this.triggerStutter(0.2 + Math.random() * 0.3 * intensity);
          break;
        case 'bitcrush':
          this.params.bitcrush.bits = Math.floor(2 + (1 - intensity) * 10);
          this.params.bitcrush.mix = 0.3 + intensity * 0.5;
          this.triggerBitcrush(0.1 + Math.random() * 0.3 * intensity);
          break;
        case 'tapestop':
          this.params.tapeStop.duration = 0.3 + Math.random() * 0.5 * intensity;
          this.triggerTapeStop();
          break;
        case 'freeze':
          this.params.granularFreeze.mix = 0.3 + intensity * 0.7;
          this.triggerGranularFreeze();
          break;
        case 'reverse':
          this.params.reverse.mix = 0.4 + intensity * 0.5;
          this.params.reverse.duration = 0.3 + Math.random() * 0.5 * intensity;
          this.triggerReverse();
          break;
      }
    }, baseInterval);
    
    console.log('[GlitchEngine] Chaos mode started');
  }
  
  stopChaos(): void {
    if (this.chaosInterval) {
      clearInterval(this.chaosInterval);
      this.chaosInterval = null;
    }
    this.params.chaos.enabled = false;
    console.log('[GlitchEngine] Chaos mode stopped');
  }
  
  setChaosParams(params: Partial<ChaosParams>): void {
    this.params.chaos = { ...this.params.chaos, ...params };
    
    if (params.enabled !== undefined) {
      if (params.enabled) {
        this.startChaos();
      } else {
        this.stopChaos();
      }
    }
  }
  
  isChaosEnabled(): boolean {
    return this.params.chaos.enabled;
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
    this.stopChaos();
    this.inputNode?.disconnect();
    this.outputNode?.disconnect();
    this.dryNode?.disconnect();
    this.wetNode?.disconnect();
    this.stutterGain?.disconnect();
    this.bitcrusher?.disconnect();
    this.bitcrushGain?.disconnect();
    this.reverseProcessor?.disconnect();
    this.reverseGain?.disconnect();
    this.isConnected = false;
  }
}

export const glitchEngine = GlitchEngine.getInstance();
