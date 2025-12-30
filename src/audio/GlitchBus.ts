// Lightweight glitch processor for individual tracks
// Shares effect logic with main GlitchEngine but has own audio nodes

import { audioEngine, GlitchTarget } from './AudioEngine';
import { scheduler } from './Scheduler';
import { StutterParams, BitcrushParams } from './GlitchEngine';

export class GlitchBus {
  private track: 'drums' | 'synth' | 'texture';
  private inputNode: GainNode | null = null;
  private outputNode: GainNode | null = null;
  private dryNode: GainNode | null = null;
  private wetNode: GainNode | null = null;
  
  // Effect nodes
  private stutterGain: GainNode | null = null;
  private bitcrusher: ScriptProcessorNode | null = null;
  private bitcrushGain: GainNode | null = null;
  
  // Bitcrush state
  private bitcrushPhase = 0;
  private bitcrushLastSample = 0;
  
  // Reverse effect state
  private reverseProcessor: ScriptProcessorNode | null = null;
  private reverseGain: GainNode | null = null;
  private reverseRecording = false;
  private reversePlayback = false;
  private reverseSamples: Float32Array[] = [];
  private reversePlaybackIndex = 0;
  
  private bypass = true;
  private isConnected = false;

  private params = {
    stutter: { division: '1/16' as StutterParams['division'], decay: 0.5, mix: 0.5 },
    bitcrush: { bits: 8, sampleRate: 0.5, mix: 0.5 },
    reverse: { duration: 0.5, mix: 0.7 },
  };

  constructor(track: 'drums' | 'synth' | 'texture') {
    this.track = track;
  }

  init(): void {
    if (this.isConnected) return;
    
    const ctx = audioEngine.getContext();
    
    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.dryNode = ctx.createGain();
    this.wetNode = ctx.createGain();
    
    this.dryNode.gain.value = 1;
    this.wetNode.gain.value = 0;
    
    // Stutter
    this.stutterGain = ctx.createGain();
    this.stutterGain.gain.value = 1;
    
    // Bitcrush
    this.bitcrushGain = ctx.createGain();
    this.bitcrushGain.gain.value = 0;
    this.bitcrusher = ctx.createScriptProcessor(4096, 2, 2);
    this.bitcrusher.onaudioprocess = this.processBitcrush.bind(this);
    
    // Reverse
    this.reverseGain = ctx.createGain();
    this.reverseGain.gain.value = 0;
    this.reverseProcessor = ctx.createScriptProcessor(2048, 2, 2);
    this.reverseProcessor.onaudioprocess = this.processReverse.bind(this);
    
    // Connect routing
    this.inputNode.connect(this.dryNode);
    this.dryNode.connect(this.outputNode);
    
    this.inputNode.connect(this.stutterGain);
    this.stutterGain.connect(this.wetNode);
    
    this.inputNode.connect(this.bitcrusher);
    this.bitcrusher.connect(this.bitcrushGain);
    this.bitcrushGain.connect(this.wetNode);
    
    this.inputNode.connect(this.reverseProcessor);
    this.reverseProcessor.connect(this.reverseGain);
    this.reverseGain.connect(this.wetNode);
    
    this.wetNode.connect(this.outputNode);
    
    // Insert into audio chain
    audioEngine.insertTrackGlitch(this.track, this.inputNode, this.outputNode);
    
    this.isConnected = true;
    console.log(`[GlitchBus:${this.track}] Initialized`);
  }

  setBypass(bypass: boolean): void {
    this.bypass = bypass;
    if (!this.dryNode || !this.wetNode) return;
    
    const ctx = audioEngine.getContext();
    if (bypass) {
      this.dryNode.gain.setTargetAtTime(1, ctx.currentTime, 0.01);
      this.wetNode.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
    }
  }

  isBypassed(): boolean {
    return this.bypass;
  }

  setStutterParams(params: Partial<{ division: StutterParams['division']; decay: number; mix: number }>): void {
    if (params.division) this.params.stutter.division = params.division;
    if (params.decay !== undefined) this.params.stutter.decay = params.decay;
    if (params.mix !== undefined) this.params.stutter.mix = params.mix;
  }

  setBitcrushParams(params: Partial<{ bits: number; sampleRate: number; mix: number }>): void {
    if (params.bits !== undefined) this.params.bitcrush.bits = params.bits;
    if (params.sampleRate !== undefined) this.params.bitcrush.sampleRate = params.sampleRate;
    if (params.mix !== undefined) this.params.bitcrush.mix = params.mix;
  }

  triggerStutter(duration?: number): void {
    if (this.bypass || !this.stutterGain || !this.wetNode || !this.dryNode) return;
    
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    
    const bpm = scheduler.getBpm();
    const divisionMap = {
      '1/4': 60 / bpm,
      '1/8': 60 / bpm / 2,
      '1/16': 60 / bpm / 4,
      '1/32': 60 / bpm / 8,
      '1/64': 60 / bpm / 16,
    };
    const stutterTime = divisionMap[this.params.stutter.division];
    
    const stutterDuration = duration || stutterTime * 8;
    const numStutters = Math.floor(stutterDuration / stutterTime);
    
    this.wetNode.gain.cancelScheduledValues(now);
    this.dryNode.gain.cancelScheduledValues(now);
    this.wetNode.gain.setValueAtTime(this.params.stutter.mix, now);
    this.dryNode.gain.setValueAtTime(1 - this.params.stutter.mix * 0.5, now);
    
    this.stutterGain.gain.cancelScheduledValues(now);
    for (let i = 0; i < numStutters; i++) {
      const time = now + (i * stutterTime);
      const decayFactor = 1 - (this.params.stutter.decay * i / numStutters);
      
      this.stutterGain.gain.setValueAtTime(decayFactor, time);
      this.stutterGain.gain.setValueAtTime(0, time + stutterTime * 0.15);
      this.stutterGain.gain.linearRampToValueAtTime(decayFactor * 0.8, time + stutterTime * 0.85);
    }
    
    const endTime = now + stutterDuration + 0.05;
    this.wetNode.gain.setTargetAtTime(0, endTime, 0.05);
    this.dryNode.gain.setTargetAtTime(1, endTime, 0.05);
    this.stutterGain.gain.setValueAtTime(1, endTime);
  }

  triggerTapeStop(): void {
    if (this.bypass || !this.outputNode) return;
    
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    const duration = 0.5;
    
    this.outputNode.gain.cancelScheduledValues(now);
    this.outputNode.gain.setValueAtTime(1, now);
    
    const steps = 20;
    for (let i = 0; i < steps; i++) {
      const t = now + (i / steps) * duration;
      const progress = i / steps;
      const gainValue = Math.pow(1 - progress, 2);
      this.outputNode.gain.setValueAtTime(gainValue, t);
    }
    
    this.outputNode.gain.setValueAtTime(0, now + duration);
    this.outputNode.gain.linearRampToValueAtTime(1, now + duration + 0.15);
  }

  triggerBitcrush(duration?: number): void {
    if (this.bypass || !this.bitcrushGain || !this.wetNode || !this.dryNode) return;
    
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    const crushDuration = duration || 0.5;
    
    this.wetNode.gain.cancelScheduledValues(now);
    this.dryNode.gain.cancelScheduledValues(now);
    this.bitcrushGain.gain.cancelScheduledValues(now);
    
    this.wetNode.gain.setValueAtTime(this.params.bitcrush.mix, now);
    this.dryNode.gain.setValueAtTime(1 - this.params.bitcrush.mix * 0.5, now);
    this.bitcrushGain.gain.setValueAtTime(1, now);
    
    const endTime = now + crushDuration;
    this.bitcrushGain.gain.setValueAtTime(0, endTime);
    this.wetNode.gain.setTargetAtTime(0, endTime, 0.05);
    this.dryNode.gain.setTargetAtTime(1, endTime, 0.05);
  }

  private processBitcrush(event: AudioProcessingEvent): void {
    const bits = this.params.bitcrush.bits;
    const sampleRateReduction = Math.floor(1 + (1 - this.params.bitcrush.sampleRate) * 32);
    const levels = Math.pow(2, bits);
    
    for (let channel = 0; channel < event.outputBuffer.numberOfChannels; channel++) {
      const inputData = event.inputBuffer.getChannelData(channel);
      const outputData = event.outputBuffer.getChannelData(channel);
      
      for (let i = 0; i < inputData.length; i++) {
        if (this.bitcrushPhase % sampleRateReduction === 0) {
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
    const freezeDuration = 0.8;
    const grainTime = 0.04;
    const numGrains = Math.floor(freezeDuration / grainTime);
    
    this.wetNode.gain.cancelScheduledValues(now);
    this.dryNode.gain.cancelScheduledValues(now);
    this.wetNode.gain.setValueAtTime(0.6, now);
    this.dryNode.gain.setValueAtTime(0.3, now);
    
    this.stutterGain.gain.cancelScheduledValues(now);
    for (let i = 0; i < numGrains; i++) {
      const time = now + (i * grainTime);
      const spreadRandom = 1 - (Math.random() * 0.3);
      
      this.stutterGain.gain.setValueAtTime(spreadRandom, time);
      this.stutterGain.gain.setValueAtTime(0, time + grainTime * 0.3);
      this.stutterGain.gain.linearRampToValueAtTime(spreadRandom * 0.7, time + grainTime * 0.9);
    }
    
    const endTime = now + freezeDuration + 0.05;
    this.wetNode.gain.setTargetAtTime(0, endTime, 0.05);
    this.dryNode.gain.setTargetAtTime(1, endTime, 0.05);
    this.stutterGain.gain.setValueAtTime(1, endTime);
  }

  triggerReverse(duration?: number): void {
    if (this.bypass || !this.reverseGain || !this.wetNode || !this.dryNode) return;
    
    const ctx = audioEngine.getContext();
    const sampleRate = ctx.sampleRate;
    
    const reverseDuration = duration || (0.1 + this.params.reverse.duration * 0.4);
    const bufferSize = Math.floor(reverseDuration * sampleRate);
    
    this.reverseSamples = [new Float32Array(bufferSize), new Float32Array(bufferSize)];
    this.reverseRecording = true;
    this.reversePlayback = false;
    this.reversePlaybackIndex = 0;
    
    setTimeout(() => {
      this.reverseRecording = false;
      
      for (let ch = 0; ch < this.reverseSamples.length; ch++) {
        this.reverseSamples[ch].reverse();
      }
      
      this.reversePlayback = true;
      this.reversePlaybackIndex = 0;
      
      if (this.wetNode && this.dryNode && this.reverseGain) {
        this.wetNode.gain.setValueAtTime(this.params.reverse.mix, ctx.currentTime);
        this.dryNode.gain.setValueAtTime(1 - this.params.reverse.mix * 0.7, ctx.currentTime);
        this.reverseGain.gain.setValueAtTime(1, ctx.currentTime);
      }
      
      setTimeout(() => {
        this.reversePlayback = false;
        if (this.wetNode && this.dryNode && this.reverseGain) {
          this.wetNode.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
          this.dryNode.gain.setTargetAtTime(1, ctx.currentTime, 0.05);
          this.reverseGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        }
      }, reverseDuration * 1000);
      
    }, reverseDuration * 1000);
  }

  private processReverse(event: AudioProcessingEvent): void {
    const inputL = event.inputBuffer.getChannelData(0);
    const inputR = event.inputBuffer.getChannelData(1);
    const outputL = event.outputBuffer.getChannelData(0);
    const outputR = event.outputBuffer.getChannelData(1);
    
    if (this.reverseRecording && this.reverseSamples.length >= 2) {
      const remaining = this.reverseSamples[0].length - this.reversePlaybackIndex;
      const toCopy = Math.min(remaining, inputL.length);
      
      for (let i = 0; i < toCopy; i++) {
        this.reverseSamples[0][this.reversePlaybackIndex + i] = inputL[i];
        this.reverseSamples[1][this.reversePlaybackIndex + i] = inputR[i];
      }
      this.reversePlaybackIndex += toCopy;
      
      outputL.fill(0);
      outputR.fill(0);
    } else if (this.reversePlayback && this.reverseSamples.length >= 2) {
      const remaining = this.reverseSamples[0].length - this.reversePlaybackIndex;
      const toPlay = Math.min(remaining, outputL.length);
      
      for (let i = 0; i < toPlay; i++) {
        outputL[i] = this.reverseSamples[0][this.reversePlaybackIndex + i];
        outputR[i] = this.reverseSamples[1][this.reversePlaybackIndex + i];
      }
      
      for (let i = toPlay; i < outputL.length; i++) {
        outputL[i] = 0;
        outputR[i] = 0;
      }
      
      this.reversePlaybackIndex += toPlay;
    } else {
      outputL.fill(0);
      outputR.fill(0);
    }
  }

  disconnect(): void {
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
