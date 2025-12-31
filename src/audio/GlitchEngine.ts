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
  repeatCount: number;  // 1-16: how many times to repeat
  probability: number;  // 0-1: chance of triggering
}

export interface BitcrushParams extends GlitchEffectParams {
  bits: number;
  sampleRate: number;
}

export type TapeStopCurve = 'linear' | 'exp' | 'log' | 'scurve';

export interface TapeStopParams extends GlitchEffectParams {
  speed: number;
  duration: number;
  curve: TapeStopCurve;
  wobble: number;      // 0-1: wow & flutter intensity
  probability: number; // 0-1: chance of triggering
}

export interface GranularFreezeParams extends GlitchEffectParams {
  grainSize: number;    // 0-1: grain duration (20-200ms)
  pitch: number;        // 0-1: playbackRate (0.25x - 4x)
  spread: number;       // 0-1: random amplitude variation
  position: number;     // 0-1: capture point in buffer
  overlap: number;      // 0-1: grain superposition (1x-8x)
  density: number;      // 0-1: grains per second (5-60)
  jitter: number;       // 0-1: temporal variation in timing
  attack: number;       // 0-1: grain envelope attack time
  detune: number;       // 0-1: pitch variation in cents (-1200 to +1200)
  scatter: number;      // 0-1: random read position variation
  reverse: boolean;     // play grains in reverse
  probability: number;  // 0-1: chance of triggering
}

export interface ChaosParams {
  enabled: boolean;
  density: number; // 0-1: how often effects trigger
  intensity: number; // 0-1: effect intensity
}

export interface ReverseParams extends GlitchEffectParams {
  duration: number;     // 0-1: fragment duration to reverse (0.1 - 0.5s)
  position: number;     // 0-1: start position in captured buffer
  crossfade: number;    // 0-1: smooth envelope at boundaries
  speed: number;        // 0-1: playback speed (0.5 = half, 1 = normal, 2 = double)
  feedback: number;     // 0-1: re-inject reversed output
  loop: number;         // 0-1: number of repetitions (0=1x, 1=4x)
  probability: number;  // 0-1: chance of triggering
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

  // Granular Freeze - Circular buffer for real grain synthesis
  private freezeCaptureNode: ScriptProcessorNode | null = null;
  private freezeCircularBuffer: Float32Array[] = []; // [left, right]
  private freezeBufferSize = 0;  // ~2 seconds of audio
  private freezeWriteIndex = 0;
  private freezeActiveGrains: AudioBufferSourceNode[] = [];
  private freezeGainNodes: GainNode[] = [];

  private params: GlitchParams = {
    stutter: {
      active: false,
      mix: 0.5,
      division: '1/16',
      decay: 0.5,
      repeatCount: 8,
      probability: 1.0,
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
      curve: 'exp' as TapeStopCurve,
      wobble: 0,
      probability: 1.0,
    },
    granularFreeze: {
      active: false,
      mix: 0.5,
      grainSize: 0.5,
      pitch: 0.5,
      spread: 0.3,
      position: 0.5,
      overlap: 0.5,
      density: 0.5,
      jitter: 0.2,
      attack: 0.1,
      detune: 0.5,      // Center = no detune
      scatter: 0.2,
      reverse: false,
      probability: 1.0,
    },
    reverse: {
      active: false,
      mix: 0.7,
      duration: 0.5,
      position: 0,
      crossfade: 0.3,
      speed: 0.5,
      feedback: 0,
      loop: 0,
      probability: 1.0,
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
    
    // Granular Freeze - Circular buffer capture (~2 seconds)
    this.freezeBufferSize = Math.floor(ctx.sampleRate * 2);
    this.freezeCircularBuffer = [
      new Float32Array(this.freezeBufferSize),
      new Float32Array(this.freezeBufferSize)
    ];
    this.freezeWriteIndex = 0;
    this.freezeCaptureNode = ctx.createScriptProcessor(2048, 2, 2);
    this.freezeCaptureNode.onaudioprocess = this.captureFreeze.bind(this);
    this.inputNode.connect(this.freezeCaptureNode);
    // Connect to output silently (required to keep processor alive)
    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;
    this.freezeCaptureNode.connect(silentGain);
    silentGain.connect(ctx.destination);
    
    this.wetNode.connect(this.outputNode);
    
    this.isConnected = true;
    console.log('[GlitchEngine] Initialized with Bitcrusher, Reverse and Granular Freeze');
    
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
    // Solo actualizar valores definidos para evitar NaN
    if (params.division !== undefined) this.params.stutter.division = params.division;
    if (params.decay !== undefined) this.params.stutter.decay = params.decay;
    if (params.mix !== undefined) this.params.stutter.mix = params.mix;
    if (params.repeatCount !== undefined) this.params.stutter.repeatCount = params.repeatCount;
    if (params.probability !== undefined) this.params.stutter.probability = params.probability;
    this.updateStutter();
  }

  setBitcrushParams(params: Partial<BitcrushParams>): void {
    this.params.bitcrush = { ...this.params.bitcrush, ...params };
    this.updateBitcrush();
  }

  setTapeStopParams(params: Partial<TapeStopParams>): void {
    // Solo actualizar valores definidos para evitar NaN
    if (params.speed !== undefined) this.params.tapeStop.speed = params.speed;
    if (params.duration !== undefined) this.params.tapeStop.duration = params.duration;
    if (params.mix !== undefined) this.params.tapeStop.mix = params.mix;
    if (params.curve !== undefined) this.params.tapeStop.curve = params.curve;
    if (params.wobble !== undefined) this.params.tapeStop.wobble = params.wobble;
    if (params.probability !== undefined) this.params.tapeStop.probability = params.probability;
  }

  setGranularFreezeParams(params: Partial<GranularFreezeParams>): void {
    // Solo actualizar valores definidos para evitar NaN
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

  setReverseParams(params: Partial<ReverseParams>): void {
    // Solo actualizar valores definidos para evitar NaN
    if (params.duration !== undefined) this.params.reverse.duration = params.duration;
    if (params.mix !== undefined) this.params.reverse.mix = params.mix;
    if (params.position !== undefined) this.params.reverse.position = params.position;
    if (params.crossfade !== undefined) this.params.reverse.crossfade = params.crossfade;
    if (params.speed !== undefined) this.params.reverse.speed = params.speed;
    if (params.feedback !== undefined) this.params.reverse.feedback = params.feedback;
    if (params.loop !== undefined) this.params.reverse.loop = params.loop;
    if (params.probability !== undefined) this.params.reverse.probability = params.probability;
  }

  // Trigger effects (for momentary activation)
  triggerStutter(duration?: number): void {
    if (this.bypass || !this.stutterGain || !this.wetNode || !this.dryNode) return;
    
    // Probability check - skip effect if random > probability
    if (Math.random() > this.params.stutter.probability) {
      console.log('[GlitchEngine] Stutter skipped (probability:', this.params.stutter.probability.toFixed(2), ')');
      return;
    }
    
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
    
    // Use repeatCount to determine number of stutters (1-16)
    const numStutters = Math.max(1, Math.min(16, this.params.stutter.repeatCount));
    const stutterDuration = duration || stutterTime * numStutters;
    
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
    
    console.log('[GlitchEngine] Stutter triggered:', numStutters, 'reps, prob:', this.params.stutter.probability.toFixed(2));
  }

  triggerTapeStop(): void {
    if (this.bypass || !this.outputNode || !this.inputNode || !this.wetNode || !this.dryNode) return;
    
    // Probability check
    if (Math.random() > this.params.tapeStop.probability) {
      console.log('[GlitchEngine] TapeStop skipped (probability:', this.params.tapeStop.probability.toFixed(2), ')');
      return;
    }
    
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    
    // Calculate duration based on speed and duration params
    const speedFactor = 0.3 + this.params.tapeStop.speed * 1.7; // 0.3 - 2.0
    const baseDuration = 0.3 + (this.params.tapeStop.duration * 1.2);
    const duration = baseDuration / speedFactor;
    
    // Activate wet signal for the effect
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
          // Exponential: fast start, slow end
          value = Math.pow(1 - progress, 2);
          break;
        case 'log':
          // Logarithmic: slow start, fast end
          value = 1 - Math.pow(progress, 0.5);
          break;
        case 'scurve':
          // S-curve: smooth in/out
          value = 1 - (3 * progress * progress - 2 * progress * progress * progress);
          break;
        default:
          value = Math.pow(1 - progress, 2);
      }
      
      curveValues[i] = Math.max(0.001, value); // Avoid 0 for exponential ramps
    }
    
    // Apply the curve
    this.outputNode.gain.setValueCurveAtTime(curveValues, now, duration);
    
    // Add wobble (wow & flutter) if enabled
    if (this.params.tapeStop.wobble > 0) {
      const wobbleLfo = ctx.createOscillator();
      const wobbleGain = ctx.createGain();
      
      // Random frequency between 4-8 Hz for vintage feel
      wobbleLfo.frequency.value = 4 + Math.random() * 4;
      wobbleLfo.type = 'sine';
      
      // Wobble intensity scales with parameter (max 20% variation)
      wobbleGain.gain.value = this.params.tapeStop.wobble * 0.2;
      
      wobbleLfo.connect(wobbleGain);
      wobbleGain.connect(this.outputNode.gain);
      
      wobbleLfo.start(now);
      wobbleLfo.stop(now + duration);
    }
    
    // Restore after effect
    this.outputNode.gain.setValueAtTime(0.001, now + duration);
    this.outputNode.gain.linearRampToValueAtTime(1, now + duration + 0.15);
    
    // Restore wet/dry
    const endTime = now + duration + 0.1;
    this.wetNode.gain.setTargetAtTime(0, endTime, 0.05);
    this.dryNode.gain.setTargetAtTime(1, endTime, 0.05);
    
    console.log('[GlitchEngine] TapeStop triggered, curve:', this.params.tapeStop.curve, 'wobble:', this.params.tapeStop.wobble.toFixed(2), 'prob:', this.params.tapeStop.probability.toFixed(2));
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
    
    // Pass through silently (handled by silent gain node)
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
    amplitude: number,
    reverse: boolean
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
    
    // Calculate actual playback duration accounting for playback rate
    const actualDuration = grainDuration / playbackRate;
    
    // Clamp read position to valid range
    const maxPosition = Math.max(0, buffer.duration - actualDuration);
    const clampedPosition = Math.min(Math.max(0, readPosition), maxPosition);
    
    source.start(grainStart, clampedPosition, actualDuration);
    
    // Track for cleanup
    this.freezeActiveGrains.push(source);
    this.freezeGainNodes.push(envelope);
    
    // Cleanup after grain ends
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
      console.log('[GlitchEngine] Freeze skipped (probability:', this.params.granularFreeze.probability.toFixed(2), ')');
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
      
      // Reverse buffer if needed
      if (this.params.granularFreeze.reverse) {
        channelData.reverse();
      }
    }
    
    // Calculate grain parameters
    const grainSize = 0.02 + this.params.granularFreeze.grainSize * 0.18; // 20-200ms
    const density = 5 + this.params.granularFreeze.density * 55; // 5-60 grains/sec
    const overlap = 1 + this.params.granularFreeze.overlap * 7; // 1x-8x overlap
    const grainInterval = 1 / (density * overlap);
    
    // Playback rate: 0.25x to 4x (0 = 0.25x, 0.5 = 1x, 1 = 4x)
    const playbackRate = Math.pow(2, (this.params.granularFreeze.pitch - 0.5) * 4);
    
    // Detune: -1200 to +1200 cents (center at 0.5)
    const detuneBase = (this.params.granularFreeze.detune - 0.5) * 2400;
    
    // Scatter: random read position variation (0-100% of buffer)
    const scatterAmount = this.params.granularFreeze.scatter;
    
    // Envelope times
    const attackTime = 0.002 + this.params.granularFreeze.attack * 0.048; // 2-50ms
    const releaseTime = grainSize * 0.4; // 40% of grain size
    
    // Duration based on grain size
    const freezeDuration = 0.5 + grainSize * 5; // 0.5 - 1.4 seconds
    const numGrains = Math.floor(freezeDuration / grainInterval);
    
    // Position in buffer (0-1)
    const basePosition = this.params.granularFreeze.position * (grainBuffer.duration - grainSize);
    
    // Jitter amount
    const jitterAmount = this.params.granularFreeze.jitter;
    
    // Activate wet signal
    this.wetNode.gain.cancelScheduledValues(now);
    this.dryNode.gain.cancelScheduledValues(now);
    this.wetNode.gain.setValueAtTime(this.params.granularFreeze.mix, now);
    this.dryNode.gain.setValueAtTime(1 - this.params.granularFreeze.mix * 0.5, now);
    
    // Spawn grains
    for (let i = 0; i < numGrains; i++) {
      // Timing with jitter
      const jitteredOffset = (Math.random() - 0.5) * jitterAmount * grainInterval;
      const grainTime = now + (i * grainInterval) + jitteredOffset;
      
      if (grainTime < now) continue;
      
      // Position with scatter
      const scatterOffset = (Math.random() - 0.5) * scatterAmount * grainBuffer.duration;
      const readPosition = Math.max(0, Math.min(basePosition + scatterOffset, grainBuffer.duration - grainSize));
      
      // Random amplitude variation (spread)
      const amplitude = 1 - (Math.random() * this.params.granularFreeze.spread * 0.6);
      
      // Random detune variation
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
        amplitude,
        this.params.granularFreeze.reverse
      );
    }
    
    // Return to normal after effect
    const endTime = now + freezeDuration + 0.1;
    this.wetNode.gain.setTargetAtTime(0, endTime, 0.05);
    this.dryNode.gain.setTargetAtTime(1, endTime, 0.05);
    
    console.log('[GlitchEngine] Granular Freeze triggered:', numGrains, 'grains, pitch:', playbackRate.toFixed(2), 'x, detune:', detuneBase.toFixed(0), 'cents');
  }

  triggerReverse(duration?: number): void {
    if (this.bypass || !this.reverseGain || !this.wetNode || !this.dryNode) return;
    
    // Probability check
    if (Math.random() > this.params.reverse.probability) {
      console.log('[GlitchEngine] Reverse skipped (probability:', this.params.reverse.probability.toFixed(2), ')');
      return;
    }
    
    const ctx = audioEngine.getContext();
    const sampleRate = ctx.sampleRate;
    
    // Duration of fragment to capture and reverse (0.1 - 0.5 seconds)
    const reverseDuration = duration || (0.1 + this.params.reverse.duration * 0.4);
    
    // Speed affects playback rate (0.5x to 2x)
    const playbackSpeed = 0.5 + this.params.reverse.speed * 1.5;
    
    // Loop count (1 to 4 loops)
    const loopCount = Math.floor(1 + this.params.reverse.loop * 3);
    
    // Crossfade time (5-100ms)
    const crossfadeTime = 0.005 + this.params.reverse.crossfade * 0.095;
    
    const bufferSize = Math.floor(reverseDuration * sampleRate);
    
    // Start recording phase
    this.reverseSamples = [new Float32Array(bufferSize), new Float32Array(bufferSize)];
    this.reverseRecording = true;
    this.reversePlayback = false;
    this.reversePlaybackIndex = 0;
    
    // After capturing, switch to playback
    setTimeout(() => {
      this.reverseRecording = false;
      
      // Position affects where in the buffer we start (0-50% offset)
      const positionOffset = Math.floor(this.params.reverse.position * bufferSize * 0.5);
      
      // Reverse the captured samples
      for (let ch = 0; ch < this.reverseSamples.length; ch++) {
        // Apply position offset - shift start point
        if (positionOffset > 0) {
          const shifted = new Float32Array(bufferSize);
          for (let i = 0; i < bufferSize; i++) {
            shifted[i] = this.reverseSamples[ch][(i + positionOffset) % bufferSize];
          }
          this.reverseSamples[ch] = shifted;
        }
        this.reverseSamples[ch].reverse();
        
        // Apply crossfade envelope at boundaries
        const fadeLength = Math.floor(crossfadeTime * sampleRate);
        for (let i = 0; i < fadeLength && i < bufferSize; i++) {
          const fade = i / fadeLength;
          this.reverseSamples[ch][i] *= fade;
          this.reverseSamples[ch][bufferSize - 1 - i] *= fade;
        }
      }
      
      // Execute playback loops
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
        
        // Activate wet signal with feedback consideration
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
    
    console.log('[GlitchEngine] Reverse triggered, duration:', reverseDuration.toFixed(2), 's, speed:', playbackSpeed.toFixed(2), 'x, loops:', loopCount, ', prob:', this.params.reverse.probability.toFixed(2));
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
