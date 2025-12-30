// Core audio engine singleton
class AudioEngine {
  private static instance: AudioEngine;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private isInitialized = false;

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
    
    // Create master chain: sources -> masterGain -> limiter -> analyser -> destination
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.8;

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
    console.log('[AudioEngine] Initialized at', this.audioContext.sampleRate, 'Hz');
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
}

export const audioEngine = AudioEngine.getInstance();
