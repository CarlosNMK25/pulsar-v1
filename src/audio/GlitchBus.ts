// Lightweight glitch processor for individual tracks
// Shares effect logic with main GlitchEngine but has own audio nodes

import { audioEngine, GlitchTarget } from './AudioEngine';
import { scheduler } from './Scheduler';
import { StutterParams, BitcrushParams, TapeStopCurve } from './GlitchEngine';

export type CrushCurve = 'soft' | 'hard' | 'fold' | 'tube';
export type NoiseType = 'white' | 'pink' | 'brown';
export type JitterMode = 'random' | 'sine' | 'tape';

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
  
  // Lo-Fi Degradation Engine nodes
  private crushWaveshaper: WaveShaperNode | null = null;
  private crushInputGain: GainNode | null = null;
  private crushOutputGain: GainNode | null = null;
  private crushFilter: BiquadFilterNode | null = null;
  
  // Noise generator
  private noiseBuffers: Map<string, AudioBuffer> = new Map();
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private currentNoiseType: NoiseType = 'white';
  
  // Jitter buffer for temporal effects
  private jitterBuffer: Float32Array | null = null;
  private jitterBufferR: Float32Array | null = null;
  private jitterWritePos = 0;
  private jitterSmoothNoise = 0;
  private jitterPhase = 0;
  
  // Sustained crush mode
  private crushSustainActive = false;
  
  // Reverse effect state
  private reverseProcessor: ScriptProcessorNode | null = null;
  private reverseGain: GainNode | null = null;
  private reverseRecording = false;
  private reversePlayback = false;
  private reverseSamples: Float32Array[] = [];
  private reversePlaybackIndex = 0;
  
  // Granular Freeze - Circular buffer for real grain synthesis
  private freezeCaptureNode: ScriptProcessorNode | null = null;
  private freezeCircularBuffer: Float32Array[] = [];
  private freezeBufferSize = 0;
  private freezeWriteIndex = 0;
  private freezeActiveGrains: AudioBufferSourceNode[] = [];
  private freezeGainNodes: GainNode[] = [];
  
  // Sustained Freeze mode
  private freezeSustainActive = false;
  private freezeSustainInterval: number | null = null;
  private freezeCapturedBuffer: AudioBuffer | null = null;
  
  private bypass = true;
  private isConnected = false;

  // Chaos mode state
  private chaosInterval: number | null = null;
  private chaosParams = { density: 0.3, intensity: 0.5 };

  private params = {
    stutter: { division: '1/16' as StutterParams['division'], decay: 0.5, mix: 0.5, repeatCount: 8, probability: 1.0 },
    bitcrush: { 
      bits: 8, 
      sampleRate: 0.5, 
      mix: 0.5, 
      drive: 0, 
      curve: 'soft' as CrushCurve, 
      noise: 0, 
      noiseType: 'white' as NoiseType, 
      filter: 1.0, 
      jitter: 0, 
      jitterMode: 'random' as JitterMode, 
      probability: 1.0 
    },
    tapeStop: { speed: 0.5, duration: 0.5, mix: 0.5, curve: 'exp' as TapeStopCurve, wobble: 0, probability: 1.0 },
    granularFreeze: { grainSize: 0.5, pitch: 0.5, spread: 0.3, mix: 0.5, position: 0.5, overlap: 0.5, density: 0.5, jitter: 0.2, attack: 0.1, detune: 0.5, scatter: 0.2, reverse: false, probability: 1.0 },
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
    
    // Lo-Fi Degradation Engine - Pre-distortion waveshaper
    this.crushWaveshaper = ctx.createWaveShaper();
    this.crushWaveshaper.oversample = '2x';
    this.crushInputGain = ctx.createGain();
    this.crushInputGain.gain.value = 1;
    this.crushOutputGain = ctx.createGain();
    this.crushOutputGain.gain.value = 1;
    this.setCrushCurve('soft');
    
    // Post-filter lowpass
    this.crushFilter = ctx.createBiquadFilter();
    this.crushFilter.type = 'lowpass';
    this.crushFilter.frequency.value = 20000;
    this.crushFilter.Q.value = 0.7;
    
    // Jitter buffer (~100ms max)
    const maxJitterSamples = Math.floor(ctx.sampleRate * 0.1);
    this.jitterBuffer = new Float32Array(maxJitterSamples + 4096);
    this.jitterBufferR = new Float32Array(maxJitterSamples + 4096);
    this.jitterWritePos = 0;
    
    // Initialize noise generator
    this.initNoiseGenerator(ctx);
    
    // Bitcrush chain: crushInputGain → crushWaveshaper → bitcrusher → crushFilter → crushOutputGain → bitcrushGain
    this.bitcrushGain = ctx.createGain();
    this.bitcrushGain.gain.value = 0;
    this.bitcrusher = ctx.createScriptProcessor(4096, 2, 2);
    this.bitcrusher.onaudioprocess = this.processBitcrush.bind(this);
    
    // Connect crush chain
    this.crushInputGain.connect(this.crushWaveshaper);
    this.crushWaveshaper.connect(this.bitcrusher);
    this.bitcrusher.connect(this.crushFilter);
    this.crushFilter.connect(this.crushOutputGain);
    this.crushOutputGain.connect(this.bitcrushGain);
    
    // Connect noise to bitcrush output
    if (this.noiseGain && this.noiseFilter) {
      this.noiseFilter.connect(this.bitcrushGain);
    }
    
    // Reverse
    this.reverseGain = ctx.createGain();
    this.reverseGain.gain.value = 0;
    this.reverseProcessor = ctx.createScriptProcessor(2048, 2, 2);
    this.reverseProcessor.onaudioprocess = this.processReverse.bind(this);
    
    // Granular Freeze - Circular buffer (~2 seconds)
    this.freezeBufferSize = Math.floor(ctx.sampleRate * 2);
    this.freezeCircularBuffer = [
      new Float32Array(this.freezeBufferSize),
      new Float32Array(this.freezeBufferSize)
    ];
    this.freezeWriteIndex = 0;
    this.freezeCaptureNode = ctx.createScriptProcessor(2048, 2, 2);
    this.freezeCaptureNode.onaudioprocess = this.captureFreeze.bind(this);
    
    // Connect routing
    this.inputNode.connect(this.dryNode);
    this.dryNode.connect(this.outputNode);
    
    this.inputNode.connect(this.stutterGain);
    this.stutterGain.connect(this.wetNode);
    
    // Bitcrush routing through Lo-Fi chain
    this.inputNode.connect(this.crushInputGain);
    this.bitcrushGain.connect(this.wetNode);
    
    this.inputNode.connect(this.reverseProcessor);
    this.reverseProcessor.connect(this.reverseGain);
    this.reverseGain.connect(this.wetNode);
    
    // Freeze capture (silent output to keep processor alive)
    this.inputNode.connect(this.freezeCaptureNode);
    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;
    this.freezeCaptureNode.connect(silentGain);
    silentGain.connect(ctx.destination);
    
    this.wetNode.connect(this.outputNode);
    
    // Insert into audio chain (FX uses special method)
    if (this.track === 'fx') {
      audioEngine.insertFxGlitch(this.inputNode, this.outputNode);
    } else {
      audioEngine.insertTrackGlitch(this.track, this.inputNode, this.outputNode);
    }
    
    this.isConnected = true;
    console.log(`[GlitchBus:${this.track}] Initialized with Lo-Fi Engine`);
  }
  
  // ============ NOISE GENERATOR ============
  
  private createNoiseBuffer(ctx: AudioContext, type: NoiseType, duration: number): AudioBuffer {
    const samples = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, samples, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    if (type === 'white') {
      for (let i = 0; i < samples; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    } else if (type === 'pink') {
      // Voss-McCartney algorithm for pink noise
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < samples; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    } else if (type === 'brown') {
      // Brownian/red noise
      let lastOut = 0;
      for (let i = 0; i < samples; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + (0.02 * white)) / 1.02;
        data[i] = lastOut * 3.5;
      }
    }
    
    return buffer;
  }
  
  private initNoiseGenerator(ctx: AudioContext): void {
    // Pre-generate noise buffers
    (['white', 'pink', 'brown'] as NoiseType[]).forEach(type => {
      this.noiseBuffers.set(type, this.createNoiseBuffer(ctx, type, 2));
    });
    
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0;
    
    this.noiseFilter = ctx.createBiquadFilter();
    this.noiseFilter.type = 'highpass';
    this.noiseFilter.frequency.value = 80;
    
    this.noiseGain.connect(this.noiseFilter);
  }
  
  private startNoiseSource(type: NoiseType): void {
    const ctx = audioEngine.getContext();
    
    // Stop previous source
    if (this.noiseSource) {
      try {
        this.noiseSource.stop();
        this.noiseSource.disconnect();
      } catch {}
      this.noiseSource = null;
    }
    
    const buffer = this.noiseBuffers.get(type);
    if (!buffer || !this.noiseGain) return;
    
    this.noiseSource = ctx.createBufferSource();
    this.noiseSource.buffer = buffer;
    this.noiseSource.loop = true;
    this.noiseSource.connect(this.noiseGain);
    this.noiseSource.start();
    this.currentNoiseType = type;
  }
  
  private setNoiseAmount(amount: number): void {
    if (!this.noiseGain) return;
    const ctx = audioEngine.getContext();
    // Logarithmic scaling for more natural control
    const gain = amount > 0 ? Math.pow(amount, 2) * 0.5 : 0;
    this.noiseGain.gain.setTargetAtTime(gain, ctx.currentTime, 0.02);
  }
  
  // ============ WAVESHAPER / DRIVE ============
  
  private setCrushDrive(drive: number): void {
    if (!this.crushInputGain || !this.crushOutputGain) return;
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    const inputGain = 1 + drive * 4;
    const outputGain = 1 / Math.sqrt(inputGain);
    this.crushInputGain.gain.setTargetAtTime(inputGain, now, 0.02);
    this.crushOutputGain.gain.setTargetAtTime(outputGain, now, 0.02);
    
    // Regenerate curve with new drive
    this.setCrushCurve(this.params.bitcrush.curve, drive);
  }
  
  private setCrushCurve(curve: CrushCurve, drive?: number): void {
    if (!this.crushWaveshaper) return;
    const driveAmount = drive ?? this.params.bitcrush.drive;
    const samples = 256;
    const curveData = new Float32Array(samples);
    const intensity = 1 + driveAmount * 3;
    
    for (let i = 0; i < samples; i++) {
      const x = (i / (samples - 1)) * 2 - 1;
      const scaled = x * intensity;
      
      switch (curve) {
        case 'soft':
          curveData[i] = Math.tanh(scaled);
          break;
        case 'hard':
          curveData[i] = Math.max(-1, Math.min(1, scaled));
          break;
        case 'fold':
          let folded = scaled;
          while (Math.abs(folded) > 1) {
            folded = folded > 1 ? 2 - folded : folded < -1 ? -2 - folded : folded;
          }
          curveData[i] = folded;
          break;
        case 'tube':
          curveData[i] = (3 + 10) * scaled / (1 + 10 * Math.abs(scaled)) * 0.5;
          break;
      }
    }
    this.crushWaveshaper.curve = curveData;
  }
  
  // ============ POST-FILTER ============
  
  private setCrushFilterFreq(amount: number): void {
    if (!this.crushFilter) return;
    const ctx = audioEngine.getContext();
    // Map 0-1 to 500Hz-20kHz logarithmically
    const minFreq = 500;
    const maxFreq = 20000;
    const freq = minFreq * Math.pow(maxFreq / minFreq, amount);
    this.crushFilter.frequency.setTargetAtTime(freq, ctx.currentTime, 0.02);
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

  setBitcrushParams(params: Partial<{ 
    bits: number; 
    sampleRate: number; 
    mix: number;
    drive: number;
    curve: CrushCurve;
    noise: number;
    noiseType: NoiseType;
    filter: number;
    jitter: number;
    jitterMode: JitterMode;
    probability: number;
  }>): void {
    // Core bitcrush params
    if (params.bits !== undefined) this.params.bitcrush.bits = params.bits;
    if (params.sampleRate !== undefined) this.params.bitcrush.sampleRate = params.sampleRate;
    if (params.mix !== undefined) this.params.bitcrush.mix = params.mix;
    if (params.probability !== undefined) this.params.bitcrush.probability = params.probability;
    
    // Lo-Fi Degradation params
    if (params.drive !== undefined) {
      this.params.bitcrush.drive = params.drive;
      this.setCrushDrive(params.drive);
    }
    if (params.curve !== undefined) {
      this.params.bitcrush.curve = params.curve;
      this.setCrushCurve(params.curve);
    }
    if (params.noise !== undefined) {
      this.params.bitcrush.noise = params.noise;
      this.setNoiseAmount(params.noise);
      // Start noise if amount > 0 and crush is active
      if (params.noise > 0 && this.crushSustainActive) {
        this.startNoiseSource(this.params.bitcrush.noiseType);
      }
    }
    if (params.noiseType !== undefined) {
      this.params.bitcrush.noiseType = params.noiseType;
      if (this.params.bitcrush.noise > 0 && this.crushSustainActive) {
        this.startNoiseSource(params.noiseType);
      }
    }
    if (params.filter !== undefined) {
      this.params.bitcrush.filter = params.filter;
      this.setCrushFilterFreq(params.filter);
    }
    if (params.jitter !== undefined) this.params.bitcrush.jitter = params.jitter;
    if (params.jitterMode !== undefined) this.params.bitcrush.jitterMode = params.jitterMode;
  }

  setTapeStopParams(params: Partial<{ speed: number; duration: number; mix: number; curve: TapeStopCurve; wobble: number; probability: number }>): void {
    if (params.speed !== undefined) this.params.tapeStop.speed = params.speed;
    if (params.duration !== undefined) this.params.tapeStop.duration = params.duration;
    if (params.mix !== undefined) this.params.tapeStop.mix = params.mix;
    if (params.curve !== undefined) this.params.tapeStop.curve = params.curve;
    if (params.wobble !== undefined) this.params.tapeStop.wobble = params.wobble;
    if (params.probability !== undefined) this.params.tapeStop.probability = params.probability;
  }

  setGranularFreezeParams(params: Partial<{ grainSize: number; pitch: number; spread: number; mix: number; position: number; overlap: number; density: number; jitter: number; attack: number; detune: number; scatter: number; reverse: boolean; probability: number }>): void {
    if (params.grainSize !== undefined) this.params.granularFreeze.grainSize = params.grainSize;
    if (params.pitch !== undefined) this.params.granularFreeze.pitch = params.pitch;
    if (params.spread !== undefined) this.params.granularFreeze.spread = params.spread;
    if (params.mix !== undefined) this.params.granularFreeze.mix = params.mix;
    if (params.position !== undefined) this.params.granularFreeze.position = params.position;
    if (params.overlap !== undefined) this.params.granularFreeze.overlap = params.overlap;
    if (params.density !== undefined) this.params.granularFreeze.density = params.density;
    if (params.jitter !== undefined) this.params.granularFreeze.jitter = params.jitter;
    if (params.attack !== undefined) this.params.granularFreeze.attack = params.attack;
    if (params.detune !== undefined) this.params.granularFreeze.detune = params.detune;
    if (params.scatter !== undefined) this.params.granularFreeze.scatter = params.scatter;
    if (params.reverse !== undefined) this.params.granularFreeze.reverse = params.reverse;
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
    
    // Probability check
    if (Math.random() > this.params.bitcrush.probability) return;
    
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    const crushDuration = duration || 0.5;
    
    // Apply Lo-Fi configuration
    this.setCrushDrive(this.params.bitcrush.drive);
    this.setCrushCurve(this.params.bitcrush.curve);
    this.setCrushFilterFreq(this.params.bitcrush.filter);
    
    // Start noise if configured
    if (this.params.bitcrush.noise > 0) {
      this.setNoiseAmount(this.params.bitcrush.noise);
      this.startNoiseSource(this.params.bitcrush.noiseType);
    }
    
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
    
    // Stop noise after duration
    setTimeout(() => {
      if (this.noiseSource && !this.crushSustainActive) {
        try {
          this.noiseSource.stop();
          this.noiseSource.disconnect();
        } catch {}
        this.noiseSource = null;
        this.noiseGain?.gain.setValueAtTime(0, ctx.currentTime);
      }
    }, crushDuration * 1000);
  }
  
  // ============ SUSTAINED BITCRUSH ============
  
  startSustainedBitcrush(): void {
    if (this.crushSustainActive || this.bypass || !this.wetNode || !this.dryNode || !this.bitcrushGain) return;
    
    this.crushSustainActive = true;
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    
    // Apply Lo-Fi configuration
    this.setCrushDrive(this.params.bitcrush.drive);
    this.setCrushCurve(this.params.bitcrush.curve);
    this.setCrushFilterFreq(this.params.bitcrush.filter);
    
    // Activate wet signal
    this.wetNode.gain.setTargetAtTime(this.params.bitcrush.mix, now, 0.01);
    this.dryNode.gain.setTargetAtTime(1 - this.params.bitcrush.mix * 0.5, now, 0.01);
    this.bitcrushGain.gain.setValueAtTime(1, now);
    
    // Start noise if configured
    if (this.params.bitcrush.noise > 0) {
      this.setNoiseAmount(this.params.bitcrush.noise);
      this.startNoiseSource(this.params.bitcrush.noiseType);
    }
    
    console.log(`[GlitchBus:${this.track}] Sustained bitcrush started`);
  }
  
  stopSustainedBitcrush(): void {
    if (!this.crushSustainActive) return;
    
    this.crushSustainActive = false;
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    
    this.wetNode?.gain.setTargetAtTime(0, now, 0.1);
    this.dryNode?.gain.setTargetAtTime(1, now, 0.1);
    this.bitcrushGain?.gain.setTargetAtTime(0, now, 0.1);
    
    // Stop noise
    if (this.noiseSource) {
      try {
        this.noiseSource.stop();
        this.noiseSource.disconnect();
      } catch {}
      this.noiseSource = null;
    }
    this.noiseGain?.gain.setValueAtTime(0, now);
    
    console.log(`[GlitchBus:${this.track}] Sustained bitcrush stopped`);
  }
  
  isCrushSustainActive(): boolean {
    return this.crushSustainActive;
  }

  private processBitcrush(event: AudioProcessingEvent): void {
    const { bits, sampleRate, jitter, jitterMode } = this.params.bitcrush;
    const sampleRateReduction = Math.floor(1 + (1 - sampleRate) * 32);
    const levels = Math.pow(2, bits);
    
    for (let channel = 0; channel < event.outputBuffer.numberOfChannels; channel++) {
      const inputData = event.inputBuffer.getChannelData(channel);
      const outputData = event.outputBuffer.getChannelData(channel);
      const jitterBuf = channel === 0 ? this.jitterBuffer : this.jitterBufferR;
      
      for (let i = 0; i < inputData.length; i++) {
        let sample = inputData[i];
        
        // Apply jitter if enabled and buffer exists
        if (jitter > 0 && jitterBuf) {
          // Write to circular buffer
          jitterBuf[this.jitterWritePos % jitterBuf.length] = sample;
          
          // Calculate jitter offset
          const maxOffset = Math.floor(jitter * 0.05 * 44100);
          let jitterOffset = 0;
          
          switch (jitterMode) {
            case 'random':
              this.jitterSmoothNoise += (Math.random() - 0.5) * 0.1;
              this.jitterSmoothNoise *= 0.95;
              jitterOffset = Math.floor(this.jitterSmoothNoise * maxOffset);
              break;
            case 'sine':
              this.jitterPhase += 0.0003;
              jitterOffset = Math.floor(Math.sin(this.jitterPhase) * maxOffset);
              break;
            case 'tape':
              // Wow + flutter simulation
              const wow = Math.sin(this.jitterPhase * 0.3) * 0.7;
              const flutter = Math.sin(this.jitterPhase * 4.7) * 0.3;
              this.jitterPhase += 0.001;
              jitterOffset = Math.floor((wow + flutter) * maxOffset);
              break;
          }
          
          // Read with offset
          const baseDelay = 1024;
          const readPos = (this.jitterWritePos - baseDelay - jitterOffset + jitterBuf.length) % jitterBuf.length;
          sample = jitterBuf[Math.floor(readPos)];
          
          if (channel === 0) {
            this.jitterWritePos++;
          }
        }
        
        // Sample rate reduction + bit quantization
        if (this.bitcrushPhase % sampleRateReduction === 0) {
          this.bitcrushLastSample = Math.round(sample * levels) / levels;
        }
        outputData[i] = this.bitcrushLastSample;
        
        if (channel === 0) {
          this.bitcrushPhase++;
        }
      }
    }
  }

  // Capture audio continuously for granular freeze
  private captureFreeze(event: AudioProcessingEvent): void {
    const inputL = event.inputBuffer.getChannelData(0);
    const inputR = event.inputBuffer.numberOfChannels > 1 
      ? event.inputBuffer.getChannelData(1) 
      : inputL;
    
    for (let i = 0; i < inputL.length; i++) {
      this.freezeCircularBuffer[0][this.freezeWriteIndex] = inputL[i];
      this.freezeCircularBuffer[1][this.freezeWriteIndex] = inputR[i];
      this.freezeWriteIndex = (this.freezeWriteIndex + 1) % this.freezeBufferSize;
    }
    
    // Pass through silently
    const outputL = event.outputBuffer.getChannelData(0);
    const outputR = event.outputBuffer.getChannelData(1);
    for (let i = 0; i < outputL.length; i++) {
      outputL[i] = 0;
      outputR[i] = 0;
    }
  }

  // Spawn a single grain with real AudioBufferSourceNode
  private spawnGrain(
    buffer: AudioBuffer,
    grainStart: number,
    readPosition: number,
    grainDuration: number,
    playbackRate: number,
    detuneValue: number,
    attack: number,
    release: number,
    amplitude: number
  ): void {
    const ctx = audioEngine.getContext();
    
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    source.detune.value = detuneValue;
    
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, grainStart);
    envelope.gain.linearRampToValueAtTime(amplitude, grainStart + attack);
    envelope.gain.setValueAtTime(amplitude, grainStart + grainDuration - release);
    envelope.gain.linearRampToValueAtTime(0, grainStart + grainDuration);
    
    source.connect(envelope);
    envelope.connect(this.wetNode!);
    
    const actualDuration = grainDuration / playbackRate;
    const maxPosition = Math.max(0, buffer.duration - actualDuration);
    const clampedPosition = Math.min(Math.max(0, readPosition), maxPosition);
    
    source.start(grainStart, clampedPosition, actualDuration);
    
    this.freezeActiveGrains.push(source);
    this.freezeGainNodes.push(envelope);
    
    source.onended = () => {
      const idx = this.freezeActiveGrains.indexOf(source);
      if (idx > -1) {
        this.freezeActiveGrains.splice(idx, 1);
        this.freezeGainNodes.splice(idx, 1);
      }
      try {
        source.disconnect();
        envelope.disconnect();
      } catch {}
    };
  }

  triggerGranularFreeze(): void {
    if (this.bypass || !this.wetNode || !this.dryNode) return;
    
    // Probability check
    if (Math.random() > this.params.granularFreeze.probability) {
      return;
    }
    
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    const sampleRate = ctx.sampleRate;
    
    // Create buffer from circular capture
    const capturedSamples = Math.min(this.freezeWriteIndex + sampleRate, this.freezeBufferSize);
    const grainBuffer = ctx.createBuffer(2, capturedSamples, sampleRate);
    
    for (let ch = 0; ch < 2; ch++) {
      const channelData = grainBuffer.getChannelData(ch);
      for (let i = 0; i < capturedSamples; i++) {
        const readIdx = (this.freezeWriteIndex - capturedSamples + i + this.freezeBufferSize) % this.freezeBufferSize;
        channelData[i] = this.freezeCircularBuffer[ch][readIdx];
      }
      
      if (this.params.granularFreeze.reverse) {
        channelData.reverse();
      }
    }
    
    // Calculate grain parameters
    const grainSize = 0.02 + this.params.granularFreeze.grainSize * 0.18;
    const density = 5 + this.params.granularFreeze.density * 55;
    const overlap = 1 + this.params.granularFreeze.overlap * 7;
    const grainInterval = 1 / (density * overlap);
    
    const playbackRate = Math.pow(2, (this.params.granularFreeze.pitch - 0.5) * 4);
    const detuneBase = (this.params.granularFreeze.detune - 0.5) * 2400;
    const scatterAmount = this.params.granularFreeze.scatter;
    
    const attackTime = 0.002 + this.params.granularFreeze.attack * 0.048;
    const releaseTime = grainSize * 0.4;
    
    const freezeDuration = 0.5 + grainSize * 5;
    const numGrains = Math.floor(freezeDuration / grainInterval);
    
    const basePosition = this.params.granularFreeze.position * (grainBuffer.duration - grainSize);
    const jitterAmount = this.params.granularFreeze.jitter;
    
    this.wetNode.gain.cancelScheduledValues(now);
    this.dryNode.gain.cancelScheduledValues(now);
    this.wetNode.gain.setValueAtTime(this.params.granularFreeze.mix, now);
    this.dryNode.gain.setValueAtTime(1 - this.params.granularFreeze.mix * 0.5, now);
    
    for (let i = 0; i < numGrains; i++) {
      const jitteredOffset = (Math.random() - 0.5) * jitterAmount * grainInterval;
      const grainTime = now + (i * grainInterval) + jitteredOffset;
      
      if (grainTime < now) continue;
      
      const scatterOffset = (Math.random() - 0.5) * scatterAmount * grainBuffer.duration;
      const readPosition = Math.max(0, Math.min(basePosition + scatterOffset, grainBuffer.duration - grainSize));
      
      const amplitude = 1 - (Math.random() * this.params.granularFreeze.spread * 0.6);
      const detuneVariation = (Math.random() - 0.5) * 200 * this.params.granularFreeze.spread;
      
      this.spawnGrain(
        grainBuffer,
        grainTime,
        readPosition,
        grainSize,
        playbackRate,
        detuneBase + detuneVariation,
        attackTime,
        releaseTime,
        amplitude
      );
    }
    
    const endTime = now + freezeDuration + 0.1;
    this.wetNode.gain.setTargetAtTime(0, endTime, 0.05);
    this.dryNode.gain.setTargetAtTime(1, endTime, 0.05);
  }

  // Sustained Freeze - Start continuous grain generation
  startSustainedFreeze(): void {
    if (this.freezeSustainActive || this.bypass || !this.wetNode || !this.dryNode) return;
    
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    const sampleRate = ctx.sampleRate;
    
    // Capture buffer once at start
    const capturedSamples = Math.min(this.freezeWriteIndex + sampleRate, this.freezeBufferSize);
    this.freezeCapturedBuffer = ctx.createBuffer(2, capturedSamples, sampleRate);
    
    for (let ch = 0; ch < 2; ch++) {
      const channelData = this.freezeCapturedBuffer.getChannelData(ch);
      for (let i = 0; i < capturedSamples; i++) {
        const readIdx = (this.freezeWriteIndex - capturedSamples + i + this.freezeBufferSize) % this.freezeBufferSize;
        channelData[i] = this.freezeCircularBuffer[ch][readIdx];
      }
      if (this.params.granularFreeze.reverse) {
        channelData.reverse();
      }
    }
    
    this.freezeSustainActive = true;
    
    // Activate wet signal
    this.wetNode.gain.cancelScheduledValues(now);
    this.dryNode.gain.cancelScheduledValues(now);
    this.wetNode.gain.setValueAtTime(this.params.granularFreeze.mix, now);
    this.dryNode.gain.setValueAtTime(1 - this.params.granularFreeze.mix * 0.5, now);
    
    // Spawn initial batch
    this.spawnSustainedGrainBatch();
    
    // Loop grain generation
    const batchInterval = 100 + Math.random() * 50;
    this.freezeSustainInterval = window.setInterval(() => {
      if (this.freezeSustainActive) {
        this.spawnSustainedGrainBatch();
      }
    }, batchInterval);
  }
  
  // Stop sustained freeze
  stopSustainedFreeze(): void {
    if (!this.freezeSustainActive) return;
    
    this.freezeSustainActive = false;
    
    if (this.freezeSustainInterval) {
      clearInterval(this.freezeSustainInterval);
      this.freezeSustainInterval = null;
    }
    
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    this.wetNode?.gain.setTargetAtTime(0, now, 0.1);
    this.dryNode?.gain.setTargetAtTime(1, now, 0.1);
    
    this.freezeCapturedBuffer = null;
  }
  
  // Spawn grain batch for sustained mode
  private spawnSustainedGrainBatch(): void {
    if (!this.freezeCapturedBuffer || !this.freezeSustainActive || !this.wetNode) return;
    
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    
    const grainSize = 0.02 + this.params.granularFreeze.grainSize * 0.18;
    const density = 5 + this.params.granularFreeze.density * 55;
    const overlap = 1 + this.params.granularFreeze.overlap * 7;
    const grainInterval = 1 / (density * overlap);
    
    const playbackRate = Math.pow(2, (this.params.granularFreeze.pitch - 0.5) * 4);
    const detuneBase = (this.params.granularFreeze.detune - 0.5) * 2400;
    const scatterAmount = this.params.granularFreeze.scatter;
    
    const attackTime = 0.002 + this.params.granularFreeze.attack * 0.048;
    const releaseTime = grainSize * 0.4;
    
    const basePosition = this.params.granularFreeze.position * (this.freezeCapturedBuffer.duration - grainSize);
    const jitterAmount = this.params.granularFreeze.jitter;
    
    const numGrains = Math.floor(5 + density / 10);
    
    for (let i = 0; i < numGrains; i++) {
      const jitteredOffset = (Math.random() - 0.5) * jitterAmount * grainInterval;
      const grainTime = now + (i * grainInterval * 0.5) + jitteredOffset;
      
      if (grainTime < now) continue;
      
      const scatterOffset = (Math.random() - 0.5) * scatterAmount * this.freezeCapturedBuffer.duration;
      const readPosition = Math.max(0, Math.min(basePosition + scatterOffset, this.freezeCapturedBuffer.duration - grainSize));
      
      const amplitude = 1 - (Math.random() * this.params.granularFreeze.spread * 0.6);
      const detuneVariation = (Math.random() - 0.5) * 200 * this.params.granularFreeze.spread;
      
      this.spawnGrain(
        this.freezeCapturedBuffer,
        grainTime,
        readPosition,
        grainSize,
        playbackRate,
        detuneBase + detuneVariation,
        attackTime,
        releaseTime,
        amplitude
      );
    }
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
    this.stopSustainedBitcrush();
    this.stopSustainedFreeze();
    
    // Stop noise source
    if (this.noiseSource) {
      try {
        this.noiseSource.stop();
        this.noiseSource.disconnect();
      } catch {}
      this.noiseSource = null;
    }
    
    // Disconnect Lo-Fi nodes
    this.crushWaveshaper?.disconnect();
    this.crushInputGain?.disconnect();
    this.crushOutputGain?.disconnect();
    this.crushFilter?.disconnect();
    this.noiseGain?.disconnect();
    this.noiseFilter?.disconnect();
    
    // Disconnect core nodes
    this.inputNode?.disconnect();
    this.outputNode?.disconnect();
    this.dryNode?.disconnect();
    this.wetNode?.disconnect();
    this.stutterGain?.disconnect();
    this.bitcrusher?.disconnect();
    this.bitcrushGain?.disconnect();
    this.reverseProcessor?.disconnect();
    this.reverseGain?.disconnect();
    this.freezeCaptureNode?.disconnect();
    
    this.isConnected = false;
    console.log(`[GlitchBus:${this.track}] Disconnected`);
  }
}
