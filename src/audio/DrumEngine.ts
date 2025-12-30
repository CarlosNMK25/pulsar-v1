import { audioEngine } from './AudioEngine';

interface DrumSound {
  play: (velocity: number) => void;
}

export class DrumEngine {
  private outputGain: GainNode;
  private sounds: Map<string, DrumSound> = new Map();

  constructor() {
    const ctx = audioEngine.getContext();
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 0.6;
    this.outputGain.connect(audioEngine.getMasterGain());

    // Initialize drum sounds
    this.sounds.set('kick', this.createKick());
    this.sounds.set('snare', this.createSnare());
    this.sounds.set('hat', this.createHiHat());
  }

  private createKick(): DrumSound {
    return {
      play: (velocity: number) => {
        const ctx = audioEngine.getContext();
        const now = ctx.currentTime;
        const vel = velocity / 127;

        // Oscillator for body
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150 * vel + 50, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);

        // Gain envelope
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vel * 0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        // Click transient
        const click = ctx.createOscillator();
        click.type = 'square';
        click.frequency.value = 200;
        
        const clickGain = ctx.createGain();
        clickGain.gain.setValueAtTime(vel * 0.3, now);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

        // Connect
        osc.connect(gain);
        click.connect(clickGain);
        gain.connect(this.outputGain);
        clickGain.connect(this.outputGain);

        // Play
        osc.start(now);
        osc.stop(now + 0.5);
        click.start(now);
        click.stop(now + 0.03);
      },
    };
  }

  private createSnare(): DrumSound {
    return {
      play: (velocity: number) => {
        const ctx = audioEngine.getContext();
        const now = ctx.currentTime;
        const vel = velocity / 127;

        // Noise for snare body
        const bufferSize = ctx.sampleRate * 0.2;
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
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        // Tone oscillator
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);

        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(vel * 0.4, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        // Connect
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.outputGain);
        osc.connect(oscGain);
        oscGain.connect(this.outputGain);

        // Play
        noise.start(now);
        osc.start(now);
        osc.stop(now + 0.2);
      },
    };
  }

  private createHiHat(): DrumSound {
    return {
      play: (velocity: number) => {
        const ctx = audioEngine.getContext();
        const now = ctx.currentTime;
        const vel = velocity / 127;

        // Noise
        const bufferSize = ctx.sampleRate * 0.1;
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
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        // Connect
        noise.connect(bandpass);
        bandpass.connect(highpass);
        highpass.connect(gain);
        gain.connect(this.outputGain);

        // Play
        noise.start(now);
      },
    };
  }

  trigger(sound: 'kick' | 'snare' | 'hat', velocity: number = 100): void {
    const drum = this.sounds.get(sound);
    if (drum) {
      drum.play(velocity);
    }
  }

  disconnect(): void {
    this.outputGain.disconnect();
  }
}
