// Core audio engine singleton
export type GlitchTarget = 'master' | 'drums' | 'synth' | 'texture';

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
    
    // Create master chain: trackBuses -> masterGain -> limiter -> analyser -> destination
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.8;

    // Connect track buses to master gain
    this.drumsGlitchBus.connect(this.masterGain);
    this.synthGlitchBus.connect(this.masterGain);
    this.textureGlitchBus.connect(this.masterGain);

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

    // Connect master chain
    this.masterGain.connect(this.masterLimiter);
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

  // Get track bus for routing (drums, synth, texture connect here instead of masterGain)
  getTrackBus(track: 'drums' | 'synth' | 'texture'): GainNode {
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
    }
  }

  // Insert track-specific glitch engine
  insertTrackGlitch(track: 'drums' | 'synth' | 'texture', glitchInput: GainNode, glitchOutput: GainNode): void {
    if (!this.masterGain) return;
    
    const trackBus = this.getTrackBus(track);
    
    // Disconnect track bus from master
    trackBus.disconnect(this.masterGain);
    
    // Insert: trackBus -> glitchInput ... glitchOutput -> masterGain
    trackBus.connect(glitchInput);
    glitchOutput.connect(this.masterGain);
    
    console.log(`[AudioEngine] Track glitch inserted for ${track}`);
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
