import { audioEngine } from './AudioEngine';
import { fxEngine } from './FXEngine';
import { WaveshaperEngine, DistortionCurve } from './WaveshaperEngine';

interface DrumSound {
  play: (velocity: number, decay: number) => void;
}

interface DrumParams {
  decay: number;    // 0-1, multiplies envelope duration
  pitch: number;    // 0-100, affects base pitch
  drive: number;    // 0-100, saturation
  driveType: DistortionCurve; // Distortion curve type
  mix: number;      // 0-100, output mix
}

export class DrumEngine {
  private outputGain: GainNode;
  private reverbSend: GainNode;
  private delaySend: GainNode;
  private waveshaper: WaveshaperEngine;
  private preWaveshaperGain: GainNode;
  private sounds: Map<string, DrumSound> = new Map();
  private loadedSamples: Map<string, AudioBuffer> = new Map();
  private params: DrumParams = { decay: 50, pitch: 50, drive: 30, driveType: 'soft', mix: 75 };
  private fxConnected = false;
  private muted = false;
  private fxBypassed = false;
  private savedFxLevels = { reverb: 0.2, delay: 0.15 };

  constructor() {
    const ctx = audioEngine.getContext();
    
    // Pre-waveshaper gain for routing
    this.preWaveshaperGain = ctx.createGain();
    this.preWaveshaperGain.gain.value = 1;
    
    // Waveshaper for drive/distortion
    this.waveshaper = new WaveshaperEngine();
    this.waveshaper.setDrive(this.params.drive);
    this.waveshaper.setCurve(this.params.driveType);
    
    // Output gain
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 0.6;
    
    // Connect chain: preWaveshaperGain -> waveshaper -> outputGain -> trackBus
    this.preWaveshaperGain.connect(this.waveshaper.getInput());
    this.waveshaper.getOutput().connect(this.outputGain);
    this.outputGain.connect(audioEngine.getTrackBus('drums'));

    // FX send nodes
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.2;
    
    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 0.15;

    // Initialize drum sounds
    this.sounds.set('kick', this.createKick());
    this.sounds.set('snare', this.createSnare());
    this.sounds.set('hat', this.createHiHat());
  }

  connectFX(): void {
    if (this.fxConnected) return;
    this.reverbSend.connect(fxEngine.getReverbSend());
    this.delaySend.connect(fxEngine.getDelaySend());
    this.fxConnected = true;
  }

  setParams(params: Partial<DrumParams>): void {
    this.params = { ...this.params, ...params };
    // Update output gain based on mix parameter
    const ctx = audioEngine.getContext();
    this.outputGain.gain.setTargetAtTime((this.params.mix / 100) * 0.6, ctx.currentTime, 0.05);
    
    // Update waveshaper
    this.waveshaper.setDrive(this.params.drive);
    if (params.driveType !== undefined) {
      this.waveshaper.setCurve(this.params.driveType);
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  setFXSend(reverb: number, delay: number): void {
    this.savedFxLevels = { reverb, delay };
    if (this.fxBypassed) return;
    const ctx = audioEngine.getContext();
    this.reverbSend.gain.setTargetAtTime(reverb, ctx.currentTime, 0.05);
    this.delaySend.gain.setTargetAtTime(delay, ctx.currentTime, 0.05);
  }

  setFXBypass(bypass: boolean): void {
    this.fxBypassed = bypass;
    const ctx = audioEngine.getContext();
    if (bypass) {
      this.reverbSend.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      this.delaySend.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    } else {
      this.reverbSend.gain.setTargetAtTime(this.savedFxLevels.reverb, ctx.currentTime, 0.05);
      this.delaySend.gain.setTargetAtTime(this.savedFxLevels.delay, ctx.currentTime, 0.05);
    }
  }

  private createKick(): DrumSound {
    return {
      play: (velocity: number, decay: number) => {
        const ctx = audioEngine.getContext();
        const now = ctx.currentTime;
        const vel = velocity / 127;
        const decayMult = 0.3 + decay * 0.7; // Range 0.3-1.0

        // Oscillator for body
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150 * vel + 50, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.1 * decayMult);

        // Gain envelope
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vel * 0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4 * decayMult);

        // Click transient
        const click = ctx.createOscillator();
        click.type = 'square';
        click.frequency.value = 200;
        
        const clickGain = ctx.createGain();
        clickGain.gain.setValueAtTime(vel * 0.3, now);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

        // Connect to pre-waveshaper gain (for distortion processing)
        osc.connect(gain);
        click.connect(clickGain);
        gain.connect(this.preWaveshaperGain);
        clickGain.connect(this.preWaveshaperGain);
        
        // Connect to FX sends (kick gets less reverb/delay)
        gain.connect(this.reverbSend);
        gain.connect(this.delaySend);

        // Play
        osc.start(now);
        osc.stop(now + 0.5 * decayMult);
        click.start(now);
        click.stop(now + 0.03);
      },
    };
  }

  private createSnare(): DrumSound {
    return {
      play: (velocity: number, decay: number) => {
        const ctx = audioEngine.getContext();
        const now = ctx.currentTime;
        const vel = velocity / 127;
        const decayMult = 0.4 + decay * 0.6; // Range 0.4-1.0

        // Noise for snare body
        const bufferSize = ctx.sampleRate * 0.3;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.5;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        // Noise filter
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 2000;

        // Noise envelope
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(vel * 0.5, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15 * decayMult);

        // Tone oscillator
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);

        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(vel * 0.4, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08 * decayMult);

        // Connect to pre-waveshaper gain
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.preWaveshaperGain);
        osc.connect(oscGain);
        oscGain.connect(this.preWaveshaperGain);
        
        // Connect to FX sends (snare gets more reverb)
        noiseGain.connect(this.reverbSend);
        noiseGain.connect(this.delaySend);

        // Play
        noise.start(now);
        osc.start(now);
        osc.stop(now + 0.3 * decayMult);
      },
    };
  }

  private createHiHat(): DrumSound {
    return {
      play: (velocity: number, decay: number) => {
        const ctx = audioEngine.getContext();
        const now = ctx.currentTime;
        const vel = velocity / 127;
        const decayMult = 0.3 + decay * 0.7; // Range 0.3-1.0

        // Noise
        const bufferSize = ctx.sampleRate * 0.15;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        // Bandpass filter for metallic character
        const bandpass = ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 8000;
        bandpass.Q.value = 1;

        // Highpass for clarity
        const highpass = ctx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 5000;

        // Envelope
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vel * 0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08 * decayMult);

        // Connect to pre-waveshaper gain
        noise.connect(bandpass);
        bandpass.connect(highpass);
        highpass.connect(gain);
        gain.connect(this.preWaveshaperGain);
        
        // Connect to FX sends (hat gets subtle delay)
        gain.connect(this.delaySend);

        // Play
        noise.start(now);
      },
    };
  }

  trigger(sound: 'kick' | 'snare' | 'hat', velocity: number = 100): void {
    if (this.muted) return;
    
    // Check for loaded sample first
    const sampleBuffer = this.loadedSamples.get(sound);
    if (sampleBuffer) {
      this.playSample(sampleBuffer, velocity);
      return;
    }
    
    // Fall back to synthesis
    const drum = this.sounds.get(sound);
    if (drum) {
      // Apply pitch modifier (drive is now handled by waveshaper)
      const pitchMod = 0.5 + (this.params.pitch / 100);
      drum.play(velocity, this.params.decay / 100);
    }
  }

  private playSample(buffer: AudioBuffer, velocity: number): void {
    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;
    const vel = velocity / 127;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    // Apply pitch modifier
    source.playbackRate.value = 0.5 + (this.params.pitch / 100);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vel * 0.8, now);
    
    // Apply decay envelope
    const decayTime = 0.1 + (this.params.decay / 100) * 0.9;
    gain.gain.setTargetAtTime(0.001, now + decayTime * 0.5, decayTime * 0.3);

    source.connect(gain);
    gain.connect(this.preWaveshaperGain);
    gain.connect(this.reverbSend);
    gain.connect(this.delaySend);

    source.start(now);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
  }

  loadSample(drumType: 'kick' | 'snare' | 'hat', buffer: AudioBuffer): void {
    this.loadedSamples.set(drumType, buffer);
  }

  clearSample(drumType: 'kick' | 'snare' | 'hat'): void {
    this.loadedSamples.delete(drumType);
  }

  hasSample(drumType: 'kick' | 'snare' | 'hat'): boolean {
    return this.loadedSamples.has(drumType);
  }

  setVolume(value: number): void {
    const ctx = audioEngine.getContext();
    this.outputGain.gain.setTargetAtTime(value * 0.6, ctx.currentTime, 0.05);
  }

  disconnect(): void {
    this.preWaveshaperGain.disconnect();
    this.waveshaper.disconnect();
    this.outputGain.disconnect();
    this.reverbSend.disconnect();
    this.delaySend.disconnect();
  }
}
