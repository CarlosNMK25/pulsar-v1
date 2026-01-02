// Core audio engine singleton
import { modulationEngine } from './ModulationEngine';

export type GlitchTarget = 'master' | 'drums' | 'synth' | 'texture' | 'sample' | 'fx';

class AudioEngine {
  private static instance: AudioEngine;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStreamDestination: MediaStreamAudioDestinationNode | null = null;
  private isInitialized = false;
  private glitchInserted = false;

  // Track buses for per-track glitch routing
  private drumsGlitchBus: GainNode | null = null;
  private synthGlitchBus: GainNode | null = null;
  private textureGlitchBus: GainNode | null = null;
  private sampleGlitchBus: GainNode | null = null;
  private fxGlitchBus: GainNode | null = null;

  // Master filters
  private masterHighpass: BiquadFilterNode | null = null;
  private masterLowpass: BiquadFilterNode | null = null;

  // Peak metering
  private peakAnalyserData: Float32Array<ArrayBuffer> | null = null;

  private constructor() {}

  static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    this.audioContext = new AudioContext();
    
    // Create track glitch buses (audio passes through these before master)
    this.drumsGlitchBus = this.audioContext.createGain();
    this.drumsGlitchBus.gain.value = 1;
    
    this.synthGlitchBus = this.audioContext.createGain();
    this.synthGlitchBus.gain.value = 1;
    
    this.textureGlitchBus = this.audioContext.createGain();
    this.textureGlitchBus.gain.value = 1;
    
    this.sampleGlitchBus = this.audioContext.createGain();
    this.sampleGlitchBus.gain.value = 1;
    
    this.fxGlitchBus = this.audioContext.createGain();
    this.fxGlitchBus.gain.value = 1;
    
    // Create master chain: trackBuses -> masterGain -> limiter -> analyser -> destination
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.8;

    // Initialize modulation engine and get its nodes
    modulationEngine.ensureInitialized(this.audioContext);
    const modInput = modulationEngine.getInput();
    const modOutput = modulationEngine.getOutput();

    // Connect track buses DIRECTLY to master (dry path - bypasses modulation)
    // Modulation is handled via separate modulationSend in each engine (parallel wet path)
    this.drumsGlitchBus.connect(this.masterGain);
    this.synthGlitchBus.connect(this.masterGain);
    this.textureGlitchBus.connect(this.masterGain);
    this.sampleGlitchBus.connect(this.masterGain);

    // FX bus also goes direct to master
    this.fxGlitchBus.connect(this.masterGain);

    // Connect modulation output to master gain (wet path from modulationSends)
    modOutput.connect(this.masterGain);

    // Master filters (HPF -> LPF)
    this.masterHighpass = this.audioContext.createBiquadFilter();
    this.masterHighpass.type = 'highpass';
    this.masterHighpass.frequency.value = 20;
    this.masterHighpass.Q.value = 0.707;

    this.masterLowpass = this.audioContext.createBiquadFilter();
    this.masterLowpass.type = 'lowpass';
    this.masterLowpass.frequency.value = 20000;
    this.masterLowpass.Q.value = 0.707;

    // Limiter to prevent clipping
    this.masterLimiter = this.audioContext.createDynamicsCompressor();
    this.masterLimiter.threshold.value = -3;
    this.masterLimiter.knee.value = 6;
    this.masterLimiter.ratio.value = 12;
    this.masterLimiter.attack.value = 0.003;
    this.masterLimiter.release.value = 0.25;

    // Analyser for visualization
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    this.peakAnalyserData = new Float32Array(this.analyser.fftSize);

    // Connect master chain: masterGain -> HPF -> LPF -> limiter -> analyser -> destination
    this.masterGain.connect(this.masterHighpass);
    this.masterHighpass.connect(this.masterLowpass);
    this.masterLowpass.connect(this.masterLimiter);
    this.masterLimiter.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);

    this.isInitialized = true;
    console.log('[AudioEngine] Initialized with track buses at', this.audioContext.sampleRate, 'Hz');
  }

  // Insert glitch engine between masterGain and masterLimiter (for master glitch)
  insertGlitchEngine(glitchInput: GainNode, glitchOutput: GainNode): void {
    if (!this.masterGain || !this.masterLimiter || this.glitchInserted) return;
    
    // Disconnect masterGain from limiter
    this.masterGain.disconnect(this.masterLimiter);
    
    // Insert glitch: masterGain -> glitchInput ... glitchOutput -> limiter
    this.masterGain.connect(glitchInput);
    glitchOutput.connect(this.masterLimiter);
    
    this.glitchInserted = true;
    console.log('[AudioEngine] Glitch engine inserted into master chain');
  }

  // Get track bus for routing (drums, synth, texture, sample connect here instead of masterGain)
  getTrackBus(track: 'drums' | 'synth' | 'texture' | 'sample'): GainNode {
    if (!this.isInitialized) {
      throw new Error('AudioEngine not initialized. Call init() first.');
    }
    switch (track) {
      case 'drums':
        return this.drumsGlitchBus!;
      case 'synth':
        return this.synthGlitchBus!;
      case 'texture':
        return this.textureGlitchBus!;
      case 'sample':
        return this.sampleGlitchBus!;
    }
  }

  // Insert track-specific glitch engine
  insertTrackGlitch(track: 'drums' | 'synth' | 'texture' | 'sample', glitchInput: GainNode, glitchOutput: GainNode): void {
    if (!this.masterGain) return;
    
    const trackBus = this.getTrackBus(track);
    
    // Disconnect track bus from master (dry path)
    trackBus.disconnect(this.masterGain);
    
    // Insert: trackBus -> glitchInput ... glitchOutput -> masterGain
    trackBus.connect(glitchInput);
    glitchOutput.connect(this.masterGain);
    
    console.log(`[AudioEngine] Track glitch inserted for ${track}`);
  }

  // Get FX bus for routing (Reverb/Delay connect here instead of masterGain)
  getFxBus(): GainNode {
    if (!this.fxGlitchBus) {
      throw new Error('AudioEngine not initialized. Call init() first.');
    }
    return this.fxGlitchBus;
  }

  // Insert FX-specific glitch engine
  insertFxGlitch(glitchInput: GainNode, glitchOutput: GainNode): void {
    if (!this.masterGain || !this.fxGlitchBus) return;
    
    // Disconnect fxBus from master
    this.fxGlitchBus.disconnect(this.masterGain);
    
    // Insert: fxBus -> glitchInput ... glitchOutput -> masterGain
    this.fxGlitchBus.connect(glitchInput);
    glitchOutput.connect(this.masterGain);
    
    console.log('[AudioEngine] FX glitch inserted');
  }

  getContext(): AudioContext {
    if (!this.audioContext) {
      throw new Error('AudioEngine not initialized. Call init() first.');
    }
    return this.audioContext;
  }

  getMasterGain(): GainNode {
    if (!this.masterGain) {
      throw new Error('AudioEngine not initialized. Call init() first.');
    }
    return this.masterGain;
  }

  getAnalyser(): AnalyserNode {
    if (!this.analyser) {
      throw new Error('AudioEngine not initialized. Call init() first.');
    }
    return this.analyser;
  }

  setMasterVolume(value: number): void {
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        Math.max(0, Math.min(1, value)),
        this.audioContext!.currentTime,
        0.01
      );
    }
  }

  setMasterHighpass(freq: number, q: number = 0.707): void {
    if (this.masterHighpass && this.audioContext) {
      const clampedFreq = Math.max(20, Math.min(2000, freq));
      this.masterHighpass.frequency.setTargetAtTime(clampedFreq, this.audioContext.currentTime, 0.01);
      this.masterHighpass.Q.setTargetAtTime(Math.max(0.1, Math.min(10, q)), this.audioContext.currentTime, 0.01);
    }
  }

  setMasterLowpass(freq: number): void {
    if (this.masterLowpass && this.audioContext) {
      const clampedFreq = Math.max(200, Math.min(20000, freq));
      this.masterLowpass.frequency.setTargetAtTime(clampedFreq, this.audioContext.currentTime, 0.01);
    }
  }

  getLimiterReduction(): number {
    return this.masterLimiter?.reduction ?? 0;
  }

  getPeakLevel(): number {
    if (!this.analyser || !this.peakAnalyserData) return -Infinity;
    
    this.analyser.getFloatTimeDomainData(this.peakAnalyserData);
    let peak = 0;
    for (let i = 0; i < this.peakAnalyserData.length; i++) {
      const abs = Math.abs(this.peakAnalyserData[i]);
      if (abs > peak) peak = abs;
    }
    
    // Convert to dB
    return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
  }

  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
      console.log('[AudioEngine] Resumed');
    }
  }

  suspend(): void {
    if (this.audioContext?.state === 'running') {
      this.audioContext.suspend();
      console.log('[AudioEngine] Suspended');
    }
  }

  get currentTime(): number {
    return this.audioContext?.currentTime ?? 0;
  }

  get sampleRate(): number {
    return this.audioContext?.sampleRate ?? 44100;
  }

  get state(): AudioContextState | 'uninitialized' {
    return this.audioContext?.state ?? 'uninitialized';
  }

  // Get MediaStreamDestination for recording
  getMediaStreamDestination(): MediaStreamAudioDestinationNode {
    if (!this.audioContext || !this.masterLimiter) {
      throw new Error('AudioEngine not initialized. Call init() first.');
    }
    
    if (!this.mediaStreamDestination) {
      this.mediaStreamDestination = this.audioContext.createMediaStreamDestination();
      // Connect after limiter to capture final output
      this.masterLimiter.connect(this.mediaStreamDestination);
      console.log('[AudioEngine] MediaStreamDestination created for recording');
    }
    
    return this.mediaStreamDestination;
  }

  getSampleRate(): number {
    return this.audioContext?.sampleRate ?? 44100;
  }
}

export const audioEngine = AudioEngine.getInstance();
