import { audioEngine } from './AudioEngine';
import { fxEngine } from './FXEngine';

export type TextureMode = 'noise' | 'granular' | 'drone';

export class TextureEngine {
  private outputGain: GainNode;
  private reverbSend: GainNode;
  private delaySend: GainNode;
  private filter: BiquadFilterNode;
  private lfo: OscillatorNode;
  private lfoGain: GainNode;
  private isPlaying = false;
  private fxConnected = false;
  private muted = false;

  // Feedback routing
  private feedbackDelay: DelayNode;
  private feedbackGain: GainNode;

  // Mode-specific nodes
  private mode: TextureMode = 'noise';
  private noiseSource: AudioBufferSourceNode | null = null;
  private grainBuffer: AudioBuffer | null = null;
  private customGrainBuffer: AudioBuffer | null = null;
  private grainScheduler: number | null = null;
  private droneOscillators: OscillatorNode[] = [];
  private droneLFOs: OscillatorNode[] = [];
  private droneGains: GainNode[] = [];
  private droneLFOGains: GainNode[] = [];

  private params = {
    density: 0.5,
    pitch: 0.5,
    spread: 0.5,
    size: 0.5,
    feedback: 0.2,
    mix: 0.5,
  };

  constructor() {
    const ctx = audioEngine.getContext();

    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 0;
    // Connect to track bus instead of master gain for per-track glitch routing
    this.outputGain.connect(audioEngine.getTrackBus('texture'));

    // FX send nodes
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.4;

    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 0.15;

    // Feedback delay for resonance
    this.feedbackDelay = ctx.createDelay(1);
    this.feedbackDelay.delayTime.value = 0.05;
    this.feedbackGain = ctx.createGain();
    this.feedbackGain.gain.value = 0;

    // Filter for texture shaping
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'bandpass';
    this.filter.frequency.value = 1000;
    this.filter.Q.value = 2;

    // Feedback loop: filter -> feedbackDelay -> feedbackGain -> filter
    this.filter.connect(this.feedbackDelay);
    this.feedbackDelay.connect(this.feedbackGain);
    this.feedbackGain.connect(this.filter);

    // Main outputs
    this.filter.connect(this.outputGain);
    this.filter.connect(this.reverbSend);
    this.filter.connect(this.delaySend);

    // LFO for movement
    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = 0.5;

    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 500;

    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.filter.frequency);
    this.lfo.start();

    // Pre-create grain buffer
    this.createGrainBuffer();
  }

  private createGrainBuffer(): void {
    const ctx = audioEngine.getContext();
    const duration = 4;
    const buffer = ctx.createBuffer(2, ctx.sampleRate * duration, ctx.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0;

      for (let i = 0; i < data.length; i++) {
        const t = i / ctx.sampleRate;
        const white = Math.random() * 2 - 1;

        // Pink noise algorithm
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const pink = (b0 + b1 + b2 + b3 + b4 + b5 + white * 0.5362) * 0.11;

        // Mix pink noise with gentle tones
        data[i] = pink * 0.4;
        data[i] += Math.sin(t * 2 * Math.PI * 55) * 0.15;
        data[i] += Math.sin(t * 2 * Math.PI * 82.5) * 0.1;
        data[i] += Math.sin(t * 2 * Math.PI * 110) * 0.05;

        // Occasional transients
        if (Math.random() < 0.0005) {
          data[i] += (Math.random() * 2 - 1) * 0.4;
        }
      }
    }

    this.grainBuffer = buffer;
  }

  connectFX(): void {
    if (this.fxConnected) return;
    this.reverbSend.connect(fxEngine.getReverbSend());
    this.delaySend.connect(fxEngine.getDelaySend());
    this.fxConnected = true;
  }

  setFXSend(reverb: number, delay: number): void {
    const ctx = audioEngine.getContext();
    this.reverbSend.gain.setTargetAtTime(reverb, ctx.currentTime, 0.05);
    this.delaySend.gain.setTargetAtTime(delay, ctx.currentTime, 0.05);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted && this.isPlaying) {
      this.stopCurrentMode();
    } else if (!muted && this.isPlaying) {
      this.startCurrentMode();
    }
  }

  setMode(mode: TextureMode): void {
    if (mode === this.mode) return;

    const wasPlaying = this.isPlaying && !this.muted;

    if (wasPlaying) {
      this.stopCurrentMode();
    }

    this.mode = mode;

    if (wasPlaying) {
      this.startCurrentMode();
    }
  }

  getMode(): TextureMode {
    return this.mode;
  }

  setParams(params: Partial<typeof this.params>): void {
    this.params = { ...this.params, ...params };
    this.updateParams();
  }

  private updateParams(): void {
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    // Dynamic filter type based on density
    if (this.params.density < 0.33) {
      this.filter.type = 'lowpass';
    } else if (this.params.density > 0.66) {
      this.filter.type = 'highpass';
    } else {
      this.filter.type = 'bandpass';
    }

    // Filter frequency: wider range (80Hz - 8000Hz)
    const baseFreq = 80 + this.params.pitch * 7920;
    this.filter.frequency.setTargetAtTime(baseFreq, now, 0.05);

    // Filter Q based on feedback (more resonance)
    this.filter.Q.setTargetAtTime(0.5 + this.params.feedback * 20, now, 0.05);

    // Feedback gain for real resonance
    this.feedbackGain.gain.setTargetAtTime(this.params.feedback * 0.6, now, 0.05);
    this.feedbackDelay.delayTime.setTargetAtTime(0.01 + this.params.size * 0.1, now, 0.05);

    // LFO speed based on spread
    this.lfo.frequency.setTargetAtTime(0.05 + this.params.spread * 4, now, 0.05);
    
    // LFO depth based on size
    this.lfoGain.gain.setTargetAtTime(100 + this.params.size * 2000, now, 0.05);

    // Output volume: much louder (0.4 instead of 0.15)
    if (this.isPlaying && !this.muted) {
      this.outputGain.gain.setTargetAtTime(this.params.mix * 0.4, now, 0.05);
    }

    // Mode-specific updates
    this.updateModeParams();
  }

  private updateModeParams(): void {
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    switch (this.mode) {
      case 'drone':
        this.updateDroneParams(now);
        break;
      case 'granular':
        // Restart grain scheduler if density changed significantly
        if (this.grainScheduler !== null) {
          clearTimeout(this.grainScheduler);
          this.grainScheduler = null;
          this.startGranular();
        }
        break;
      case 'noise':
        // Noise responds through the dynamic filter
        break;
    }
  }

  private updateDroneParams(now: number): void {
    if (this.droneOscillators.length === 0) return;

    const baseFreq = 55 + this.params.pitch * 165; // A1 to A3
    const activeCount = Math.floor(2 + this.params.density * 4); // 2-6 oscillators

    this.droneOscillators.forEach((osc, i) => {
      // Frequency based on pitch
      const detune = (i - 2.5) * this.params.spread * 50; // More spread
      osc.frequency.setTargetAtTime(baseFreq, now, 0.2);
      osc.detune.setTargetAtTime(detune, now, 0.1);

      // Activate/deactivate oscillators based on density
      const gain = this.droneGains[i];
      if (gain) {
        const targetGain = i < activeCount ? 0.12 : 0; // Louder
        gain.gain.setTargetAtTime(targetGain, now, 0.2);
      }
    });

    // Update drone LFO depths based on size
    this.droneLFOGains.forEach((lfoGain) => {
      const depth = 5 + this.params.size * 40; // More modulation
      lfoGain.gain.setTargetAtTime(depth, now, 0.1);
    });
  }

  start(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;

    if (!this.muted) {
      this.startCurrentMode();
    }
  }

  stop(): void {
    if (!this.isPlaying) return;

    const ctx = audioEngine.getContext();
    this.outputGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);

    setTimeout(() => {
      this.stopCurrentMode();
      this.isPlaying = false;
    }, 500);
  }

  private startCurrentMode(): void {
    const ctx = audioEngine.getContext();

    switch (this.mode) {
      case 'noise':
        this.startNoise();
        break;
      case 'granular':
        this.startGranular();
        break;
      case 'drone':
        this.startDrone();
        break;
    }

    // Fade in with louder volume
    this.outputGain.gain.setTargetAtTime(this.params.mix * 0.4, ctx.currentTime, 0.3);
  }

  private stopCurrentMode(): void {
    // Stop noise
    if (this.noiseSource) {
      try {
        this.noiseSource.stop();
      } catch {}
      this.noiseSource.disconnect();
      this.noiseSource = null;
    }

    // Stop granular
    if (this.grainScheduler !== null) {
      clearTimeout(this.grainScheduler);
      this.grainScheduler = null;
    }

    // Stop drone
    this.droneOscillators.forEach((osc) => {
      try {
        osc.stop();
      } catch {}
      osc.disconnect();
    });
    this.droneLFOs.forEach((lfo) => {
      try {
        lfo.stop();
      } catch {}
      lfo.disconnect();
    });
    this.droneGains.forEach((gain) => gain.disconnect());
    this.droneLFOGains.forEach((gain) => gain.disconnect());
    this.droneOscillators = [];
    this.droneLFOs = [];
    this.droneGains = [];
    this.droneLFOGains = [];
  }

  // ========== NOISE MODE ==========
  private startNoise(): void {
    const ctx = audioEngine.getContext();
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0;
      let lastOut = 0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;

        // Pink noise
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const pink = (b0 + b1 + b2 + b3 + b4 + b5 + white * 0.5362) * 0.11;

        // Brownian noise
        lastOut = (lastOut + (0.02 * white)) / 1.02;
        const brown = lastOut * 3.5;

        // Mix: both noise types for richer texture
        data[i] = brown * 0.5 + pink * 0.5;
      }
    }

    this.noiseSource = ctx.createBufferSource();
    this.noiseSource.buffer = buffer;
    this.noiseSource.loop = true;
    this.noiseSource.connect(this.filter);
    this.noiseSource.start();
  }

  // ========== GRANULAR MODE ==========
  private startGranular(): void {
    const buffer = this.customGrainBuffer || this.grainBuffer;
    if (!buffer) return;

    // Schedule grains based on density
    const scheduleGrain = () => {
      if (!this.isPlaying || this.muted || this.mode !== 'granular') return;

      this.createGrain();

      // Next grain timing: 10ms - 150ms based on density (faster response)
      const interval = 10 + (1 - this.params.density) * 140;
      this.grainScheduler = window.setTimeout(scheduleGrain, interval);
    };

    scheduleGrain();
  }

  private createGrain(): void {
    const buffer = this.customGrainBuffer || this.grainBuffer;
    if (!buffer) return;

    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    const grain = ctx.createBufferSource();
    grain.buffer = buffer;

    // Playback rate based on pitch (0.25x - 3x for more dramatic effect)
    grain.playbackRate.value = 0.25 + this.params.pitch * 2.75;

    // Start position based on spread
    const bufferDuration = buffer.duration;
    const randomOffset = Math.random() * this.params.spread;
    const startOffset = randomOffset * (bufferDuration - 0.5);

    // Grain duration based on size (10ms - 500ms)
    const grainDuration = 0.01 + this.params.size * 0.49;

    // Envelope to avoid clicks
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(1, now + grainDuration * 0.1);
    envelope.gain.setValueAtTime(1, now + grainDuration * 0.6);
    envelope.gain.linearRampToValueAtTime(0, now + grainDuration);

    // Wider stereo spread
    const panner = ctx.createStereoPanner();
    panner.pan.value = (Math.random() - 0.5) * this.params.spread * 2;

    grain.connect(envelope);
    envelope.connect(panner);
    panner.connect(this.filter);

    grain.start(now, startOffset, grainDuration);

    // Cleanup
    grain.onended = () => {
      grain.disconnect();
      envelope.disconnect();
      panner.disconnect();
    };
  }

  // Custom grain source methods
  loadGrainSource(buffer: AudioBuffer): void {
    this.customGrainBuffer = buffer;
  }

  clearGrainSource(): void {
    this.customGrainBuffer = null;
  }

  hasCustomSource(): boolean {
    return this.customGrainBuffer !== null;
  }

  // ========== DRONE MODE ==========
  private startDrone(): void {
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    const baseFreq = 55 + this.params.pitch * 165;
    const waveforms: OscillatorType[] = ['sine', 'triangle', 'sine', 'sawtooth', 'triangle', 'sine'];

    for (let i = 0; i < 6; i++) {
      // Main oscillator
      const osc = ctx.createOscillator();
      osc.type = waveforms[i];
      osc.frequency.value = baseFreq;

      // Detune for spread
      const detuneAmount = (i - 2.5) * this.params.spread * 50;
      osc.detune.value = detuneAmount;

      // Individual gain for density control
      const gain = ctx.createGain();
      const activeCount = Math.floor(2 + this.params.density * 4);
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(i < activeCount ? 0.12 : 0, now, 0.3);

      // Slow LFO for organic movement
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.02 + Math.random() * 0.1;

      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 5 + this.params.size * 40;

      lfo.connect(lfoGain);
      lfoGain.connect(osc.detune);

      osc.connect(gain);
      gain.connect(this.filter);

      osc.start(now);
      lfo.start(now);

      this.droneOscillators.push(osc);
      this.droneLFOs.push(lfo);
      this.droneGains.push(gain);
      this.droneLFOGains.push(lfoGain);
    }
  }

  disconnect(): void {
    this.stop();
    try {
      this.lfo.stop();
    } catch {}
    this.lfo.disconnect();
    this.lfoGain.disconnect();
    this.filter.disconnect();
    this.feedbackDelay.disconnect();
    this.feedbackGain.disconnect();
    this.outputGain.disconnect();
    this.reverbSend.disconnect();
    this.delaySend.disconnect();
  }
}
