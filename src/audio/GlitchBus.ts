// Lightweight glitch processor for individual tracks
// Shares effect logic with main GlitchEngine but has own audio nodes

import { audioEngine, GlitchTarget } from './AudioEngine';
import { scheduler } from './Scheduler';
import { StutterParams, BitcrushParams, TapeStopCurve } from './GlitchEngine';

export class GlitchBus {
  private track: 'drums' | 'synth' | 'texture' | 'sample' | 'fx';
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

  // Chaos mode state
  private chaosInterval: number | null = null;
  private chaosParams = { density: 0.3, intensity: 0.5 };

  private params = {
    stutter: { division: '1/16' as StutterParams['division'], decay: 0.5, mix: 0.5, repeatCount: 8, probability: 1.0 },
    bitcrush: { bits: 8, sampleRate: 0.5, mix: 0.5 },
    tapeStop: { speed: 0.5, duration: 0.5, mix: 0.5, curve: 'exp' as TapeStopCurve, wobble: 0, probability: 1.0 },
    granularFreeze: { grainSize: 0.5, pitch: 0.5, spread: 0.5, mix: 0.5, position: 0.5, overlap: 0.5, density: 0.5, jitter: 0.2, attack: 0.1, probability: 1.0 },
    reverse: { duration: 0.5, mix: 0.7, position: 0, crossfade: 0.3, speed: 0.5, feedback: 0, loop: 0, probability: 1.0 },
  };

  constructor(track: 'drums' | 'synth' | 'texture' | 'sample' | 'fx') {
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
    
    // Insert into audio chain (FX uses special method)
    if (this.track === 'fx') {
      audioEngine.insertFxGlitch(this.inputNode, this.outputNode);
    } else {
      audioEngine.insertTrackGlitch(this.track, this.inputNode, this.outputNode);
    }
    
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

  setStutterParams(params: Partial<{ division: StutterParams['division']; decay: number; mix: number; repeatCount: number; probability: number }>): void {
    if (params.division) this.params.stutter.division = params.division;
    if (params.decay !== undefined) this.params.stutter.decay = params.decay;
    if (params.mix !== undefined) this.params.stutter.mix = params.mix;
    if (params.repeatCount !== undefined) this.params.stutter.repeatCount = params.repeatCount;
    if (params.probability !== undefined) this.params.stutter.probability = params.probability;
  }

  setBitcrushParams(params: Partial<{ bits: number; sampleRate: number; mix: number }>): void {
    if (params.bits !== undefined) this.params.bitcrush.bits = params.bits;
    if (params.sampleRate !== undefined) this.params.bitcrush.sampleRate = params.sampleRate;
    if (params.mix !== undefined) this.params.bitcrush.mix = params.mix;
  }

  setTapeStopParams(params: Partial<{ speed: number; duration: number; mix: number; curve: TapeStopCurve; wobble: number; probability: number }>): void {
    if (params.speed !== undefined) this.params.tapeStop.speed = params.speed;
    if (params.duration !== undefined) this.params.tapeStop.duration = params.duration;
    if (params.mix !== undefined) this.params.tapeStop.mix = params.mix;
    if (params.curve !== undefined) this.params.tapeStop.curve = params.curve;
    if (params.wobble !== undefined) this.params.tapeStop.wobble = params.wobble;
    if (params.probability !== undefined) this.params.tapeStop.probability = params.probability;
  }

  setGranularFreezeParams(params: Partial<{ grainSize: number; pitch: number; spread: number; mix: number; position: number; overlap: number; density: number; jitter: number; attack: number; probability: number }>): void {
    if (params.grainSize !== undefined) this.params.granularFreeze.grainSize = params.grainSize;
    if (params.pitch !== undefined) this.params.granularFreeze.pitch = params.pitch;
    if (params.spread !== undefined) this.params.granularFreeze.spread = params.spread;
    if (params.mix !== undefined) this.params.granularFreeze.mix = params.mix;
    if (params.position !== undefined) this.params.granularFreeze.position = params.position;
    if (params.overlap !== undefined) this.params.granularFreeze.overlap = params.overlap;
    if (params.density !== undefined) this.params.granularFreeze.density = params.density;
    if (params.jitter !== undefined) this.params.granularFreeze.jitter = params.jitter;
    if (params.attack !== undefined) this.params.granularFreeze.attack = params.attack;
    if (params.probability !== undefined) this.params.granularFreeze.probability = params.probability;
  }

  setReverseParams(params: Partial<{ duration: number; mix: number; position: number; crossfade: number; speed: number; feedback: number; loop: number; probability: number }>): void {
    if (params.duration !== undefined) this.params.reverse.duration = params.duration;
    if (params.mix !== undefined) this.params.reverse.mix = params.mix;
    if (params.position !== undefined) this.params.reverse.position = params.position;
    if (params.crossfade !== undefined) this.params.reverse.crossfade = params.crossfade;
    if (params.speed !== undefined) this.params.reverse.speed = params.speed;
    if (params.feedback !== undefined) this.params.reverse.feedback = params.feedback;
    if (params.loop !== undefined) this.params.reverse.loop = params.loop;
    if (params.probability !== undefined) this.params.reverse.probability = params.probability;
  }

  triggerStutter(duration?: number): void {
    if (this.bypass || !this.stutterGain || !this.wetNode || !this.dryNode) return;
    
    // Probability check
    if (Math.random() > this.params.stutter.probability) {
      return;
    }
    
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
    
    // Use repeatCount for number of stutters
    const numStutters = Math.max(1, Math.min(16, this.params.stutter.repeatCount));
    const stutterDuration = duration || stutterTime * numStutters;
    
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
    if (this.bypass || !this.outputNode || !this.wetNode || !this.dryNode) return;
    
    // Probability check
    if (Math.random() > this.params.tapeStop.probability) {
      return;
    }
    
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    
    // Calculate duration
    const speedFactor = 0.3 + this.params.tapeStop.speed * 1.7;
    const baseDuration = 0.3 + (this.params.tapeStop.duration * 1.2);
    const duration = baseDuration / speedFactor;
    
    // Wet/dry
    this.wetNode.gain.cancelScheduledValues(now);
    this.dryNode.gain.cancelScheduledValues(now);
    this.wetNode.gain.setValueAtTime(this.params.tapeStop.mix, now);
    this.dryNode.gain.setValueAtTime(1 - this.params.tapeStop.mix * 0.5, now);
    
    this.outputNode.gain.cancelScheduledValues(now);
    this.outputNode.gain.setValueAtTime(1, now);
    
    // Generate curve based on type
    const steps = 64;
    const curveValues = new Float32Array(steps);
    
    for (let i = 0; i < steps; i++) {
      const progress = i / (steps - 1);
      let value: number;
      
      switch (this.params.tapeStop.curve) {
        case 'linear':
          value = 1 - progress;
          break;
        case 'exp':
          value = Math.pow(1 - progress, 2);
          break;
        case 'log':
          value = 1 - Math.pow(progress, 0.5);
          break;
        case 'scurve':
          value = 1 - (3 * progress * progress - 2 * progress * progress * progress);
          break;
        default:
          value = Math.pow(1 - progress, 2);
      }
      
      curveValues[i] = Math.max(0.001, value);
    }
    
    // Apply the curve
    this.outputNode.gain.setValueCurveAtTime(curveValues, now, duration);
    
    // Add wobble if enabled
    if (this.params.tapeStop.wobble > 0) {
      const wobbleLfo = ctx.createOscillator();
      const wobbleGain = ctx.createGain();
      
      wobbleLfo.frequency.value = 4 + Math.random() * 4;
      wobbleLfo.type = 'sine';
      wobbleGain.gain.value = this.params.tapeStop.wobble * 0.2;
      
      wobbleLfo.connect(wobbleGain);
      wobbleGain.connect(this.outputNode.gain);
      
      wobbleLfo.start(now);
      wobbleLfo.stop(now + duration);
    }
    
    // Restore
    this.outputNode.gain.setValueAtTime(0.001, now + duration);
    this.outputNode.gain.linearRampToValueAtTime(1, now + duration + 0.15);
    
    const endTime = now + duration + 0.1;
    this.wetNode.gain.setTargetAtTime(0, endTime, 0.05);
    this.dryNode.gain.setTargetAtTime(1, endTime, 0.05);
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
    
    // Probability check
    if (Math.random() > this.params.granularFreeze.probability) {
      return;
    }
    
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    const freezeDuration = 0.5 + (this.params.granularFreeze.grainSize * 1.5);
    
    // Density affects grains per second (10-50 grains/sec)
    const baseDensity = 10 + this.params.granularFreeze.density * 40;
    const baseGrainInterval = 1 / baseDensity;
    
    // Overlap affects how much grains stack (1x to 3x overlap)
    const overlapFactor = 1 + this.params.granularFreeze.overlap * 2;
    const grainTime = baseGrainInterval / overlapFactor;
    
    // Pitch modulates timing
    const pitchFactor = 0.5 + this.params.granularFreeze.pitch;
    const adjustedGrainTime = grainTime / pitchFactor;
    
    const numGrains = Math.floor(freezeDuration / adjustedGrainTime);
    
    // Activate wet with mix
    this.wetNode.gain.cancelScheduledValues(now);
    this.dryNode.gain.cancelScheduledValues(now);
    this.wetNode.gain.setValueAtTime(this.params.granularFreeze.mix, now);
    this.dryNode.gain.setValueAtTime(1 - this.params.granularFreeze.mix * 0.7, now);
    
    // Attack controls grain envelope rise time (1-51ms)
    const attackTime = 0.001 + this.params.granularFreeze.attack * 0.05;
    const releaseRatio = 0.6 + this.params.granularFreeze.pitch * 0.3;
    
    // Position affects starting offset
    const positionOffset = this.params.granularFreeze.position * adjustedGrainTime;
    
    // Jitter adds temporal randomness
    const jitterAmount = this.params.granularFreeze.jitter;
    
    this.stutterGain.gain.cancelScheduledValues(now);
    for (let i = 0; i < numGrains; i++) {
      const jitteredOffset = (Math.random() - 0.5) * jitterAmount * adjustedGrainTime;
      const time = now + positionOffset + (i * adjustedGrainTime) + jitteredOffset;
      
      if (time < now) continue;
      
      const spreadRandom = 1 - (Math.random() * this.params.granularFreeze.spread * 0.5);
      
      this.stutterGain.gain.setValueAtTime(0, time);
      this.stutterGain.gain.linearRampToValueAtTime(spreadRandom, time + attackTime);
      this.stutterGain.gain.linearRampToValueAtTime(spreadRandom * 0.7, time + adjustedGrainTime * releaseRatio);
      this.stutterGain.gain.linearRampToValueAtTime(0, time + adjustedGrainTime * 0.95);
    }
    
    const endTime = now + freezeDuration + 0.05;
    this.wetNode.gain.setTargetAtTime(0, endTime, 0.05);
    this.dryNode.gain.setTargetAtTime(1, endTime, 0.05);
    this.stutterGain.gain.setValueAtTime(1, endTime);
  }

  triggerReverse(duration?: number): void {
    if (this.bypass || !this.reverseGain || !this.wetNode || !this.dryNode) return;
    
    // Probability check
    if (Math.random() > this.params.reverse.probability) {
      return;
    }
    
    const ctx = audioEngine.getContext();
    const sampleRate = ctx.sampleRate;
    
    const reverseDuration = duration || (0.1 + this.params.reverse.duration * 0.4);
    const playbackSpeed = 0.5 + this.params.reverse.speed * 1.5;
    const loopCount = Math.floor(1 + this.params.reverse.loop * 3);
    const crossfadeTime = 0.005 + this.params.reverse.crossfade * 0.095;
    const bufferSize = Math.floor(reverseDuration * sampleRate);
    
    this.reverseSamples = [new Float32Array(bufferSize), new Float32Array(bufferSize)];
    this.reverseRecording = true;
    this.reversePlayback = false;
    this.reversePlaybackIndex = 0;
    
    setTimeout(() => {
      this.reverseRecording = false;
      
      const positionOffset = Math.floor(this.params.reverse.position * bufferSize * 0.5);
      
      for (let ch = 0; ch < this.reverseSamples.length; ch++) {
        if (positionOffset > 0) {
          const shifted = new Float32Array(bufferSize);
          for (let i = 0; i < bufferSize; i++) {
            shifted[i] = this.reverseSamples[ch][(i + positionOffset) % bufferSize];
          }
          this.reverseSamples[ch] = shifted;
        }
        this.reverseSamples[ch].reverse();
        
        const fadeLength = Math.floor(crossfadeTime * sampleRate);
        for (let i = 0; i < fadeLength && i < bufferSize; i++) {
          const fade = i / fadeLength;
          this.reverseSamples[ch][i] *= fade;
          this.reverseSamples[ch][bufferSize - 1 - i] *= fade;
        }
      }
      
      let currentLoop = 0;
      const playLoop = () => {
        if (currentLoop >= loopCount) {
          this.reversePlayback = false;
          if (this.wetNode && this.dryNode && this.reverseGain) {
            this.wetNode.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
            this.dryNode.gain.setTargetAtTime(1, ctx.currentTime, 0.05);
            this.reverseGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
          }
          return;
        }
        
        this.reversePlayback = true;
        this.reversePlaybackIndex = 0;
        
        if (this.wetNode && this.dryNode && this.reverseGain) {
          const feedbackDecay = Math.pow(1 - this.params.reverse.feedback * 0.3, currentLoop);
          this.wetNode.gain.setValueAtTime(this.params.reverse.mix * feedbackDecay, ctx.currentTime);
          this.dryNode.gain.setValueAtTime(1 - this.params.reverse.mix * 0.7 * feedbackDecay, ctx.currentTime);
          this.reverseGain.gain.setValueAtTime(1, ctx.currentTime);
        }
        
        currentLoop++;
        const loopDurationMs = (reverseDuration / playbackSpeed) * 1000;
        setTimeout(playLoop, loopDurationMs);
      };
      
      playLoop();
      
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

  // Chaos mode methods
  startChaos(): void {
    if (this.chaosInterval !== null || this.bypass) return;
    
    const scheduleNext = () => {
      const baseInterval = 200 + (1 - this.chaosParams.density) * 800;
      const randomness = baseInterval * 0.5;
      const interval = baseInterval + (Math.random() - 0.5) * randomness;
      
      this.chaosInterval = window.setTimeout(() => {
        if (this.bypass) {
          this.stopChaos();
          return;
        }
        
        const effects = ['stutter', 'bitcrush', 'freeze'] as const;
        const weights = [0.4, 0.3, 0.3];
        
        let rand = Math.random();
        let effectIndex = 0;
        for (let i = 0; i < weights.length; i++) {
          rand -= weights[i];
          if (rand <= 0) {
            effectIndex = i;
            break;
          }
        }
        
        const effect = effects[effectIndex];
        const duration = 0.1 + this.chaosParams.intensity * 0.4;
        
        switch (effect) {
          case 'stutter': this.triggerStutter(duration); break;
          case 'bitcrush': this.triggerBitcrush(duration); break;
          case 'freeze': this.triggerGranularFreeze(); break;
        }
        
        scheduleNext();
      }, interval);
    };
    
    scheduleNext();
    console.log(`[GlitchBus:${this.track}] Chaos started`);
  }

  stopChaos(): void {
    if (this.chaosInterval !== null) {
      window.clearTimeout(this.chaosInterval);
      this.chaosInterval = null;
      console.log(`[GlitchBus:${this.track}] Chaos stopped`);
    }
  }

  setChaosParams(params: Partial<{ density: number; intensity: number }>): void {
    if (params.density !== undefined) this.chaosParams.density = params.density;
    if (params.intensity !== undefined) this.chaosParams.intensity = params.intensity;
  }

  isChaosEnabled(): boolean {
    return this.chaosInterval !== null;
  }

  disconnect(): void {
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
