import { audioEngine } from './AudioEngine';
import { fxEngine } from './FXEngine';

interface DrumSound {
  play: (velocity: number, decay: number) => void;
}

interface DrumParams {
  decay: number;  // 0-1, multiplies envelope duration
  pitch: number;  // 0-100, affects base pitch
  drive: number;  // 0-100, saturation
  mix: number;    // 0-100, output mix
}

export class DrumEngine {
  private outputGain: GainNode;
  private reverbSend: GainNode;
  private delaySend: GainNode;
  private sounds: Map<string, DrumSound> = new Map();
  private params: DrumParams = { decay: 50, pitch: 50, drive: 30, mix: 75 };
  private fxConnected = false;
  private muted = false;

  constructor() {
    const ctx = audioEngine.getContext();
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 0.6;
    this.outputGain.connect(audioEngine.getMasterGain());

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
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  setFXSend(reverb: number, delay: number): void {
    const ctx = audioEngine.getContext();
    this.reverbSend.gain.setTargetAtTime(reverb, ctx.currentTime, 0.05);
    this.delaySend.gain.setTargetAtTime(delay, ctx.currentTime, 0.05);
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

        // Connect to dry output
        osc.connect(gain);
        click.connect(clickGain);
        gain.connect(this.outputGain);
        clickGain.connect(this.outputGain);
        
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

        // Connect to dry output
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.outputGain);
        osc.connect(oscGain);
        oscGain.connect(this.outputGain);
        
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

        // Connect to dry output
        noise.connect(bandpass);
        bandpass.connect(highpass);
        highpass.connect(gain);
        gain.connect(this.outputGain);
        
        // Connect to FX sends (hat gets subtle delay)
        gain.connect(this.delaySend);

        // Play
        noise.start(now);
      },
    };
  }

  trigger(sound: 'kick' | 'snare' | 'hat', velocity: number = 100): void {
    if (this.muted) return;
    const drum = this.sounds.get(sound);
    if (drum) {
      // Apply pitch and drive modifiers
      const pitchMod = 0.5 + (this.params.pitch / 100); // 0.5-1.5 multiplier
      const driveMod = 1 + (this.params.drive / 100) * 0.5; // 1-1.5 velocity boost
      const modVelocity = Math.min(127, velocity * driveMod);
      drum.play(modVelocity, this.params.decay / 100);
    }
  }

  disconnect(): void {
    this.outputGain.disconnect();
    this.reverbSend.disconnect();
    this.delaySend.disconnect();
  }
}
