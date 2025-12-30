import { audioEngine } from './AudioEngine';

export type WaveformType = 'sine' | 'saw' | 'square' | 'tri';

interface VoiceParams {
  frequency: number;
  velocity: number;
  waveform: WaveformType;
  detune: number;
  attack: number;
  release: number;
  cutoff: number;
  resonance: number;
}

interface Voice {
  oscillator1: OscillatorNode;
  oscillator2: OscillatorNode;
  gainNode: GainNode;
  filter: BiquadFilterNode;
  startTime: number;
  note: number;
}

const waveformMap: Record<WaveformType, OscillatorType> = {
  sine: 'sine',
  saw: 'sawtooth',
  square: 'square',
  tri: 'triangle',
};

export class SynthVoice {
  private voices: Map<number, Voice> = new Map();
  private outputGain: GainNode;
  private params: Omit<VoiceParams, 'frequency' | 'velocity'>;

  constructor() {
    const ctx = audioEngine.getContext();
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 0.3;
    this.outputGain.connect(audioEngine.getMasterGain());

    this.params = {
      waveform: 'saw',
      detune: 10,
      attack: 0.01,
      release: 0.3,
      cutoff: 2000,
      resonance: 5,
    };
  }

  setParams(params: Partial<Omit<VoiceParams, 'frequency' | 'velocity'>>): void {
    this.params = { ...this.params, ...params };
    
    // Update active voices
    this.voices.forEach((voice) => {
      const ctx = audioEngine.getContext();
      voice.filter.frequency.setTargetAtTime(this.params.cutoff, ctx.currentTime, 0.01);
      voice.filter.Q.setTargetAtTime(this.params.resonance, ctx.currentTime, 0.01);
      voice.oscillator1.type = waveformMap[this.params.waveform];
      voice.oscillator2.type = waveformMap[this.params.waveform];
      voice.oscillator2.detune.setTargetAtTime(this.params.detune, ctx.currentTime, 0.01);
    });
  }

  noteOn(note: number, velocity: number = 100): void {
    const ctx = audioEngine.getContext();
    const frequency = this.midiToFrequency(note);
    const now = ctx.currentTime;

    // Stop existing voice on same note
    if (this.voices.has(note)) {
      this.noteOff(note);
    }

    // Create oscillators (2 for detuned fatness)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = waveformMap[this.params.waveform];
    osc2.type = waveformMap[this.params.waveform];
    osc1.frequency.value = frequency;
    osc2.frequency.value = frequency;
    osc2.detune.value = this.params.detune;

    // Create filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.params.cutoff;
    filter.Q.value = this.params.resonance;

    // Create voice gain envelope
    const voiceGain = ctx.createGain();
    const normalizedVelocity = (velocity / 127) * 0.5;
    voiceGain.gain.setValueAtTime(0, now);
    voiceGain.gain.linearRampToValueAtTime(normalizedVelocity, now + this.params.attack);

    // Connect: oscs -> filter -> voiceGain -> output
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(voiceGain);
    voiceGain.connect(this.outputGain);

    // Start oscillators
    osc1.start(now);
    osc2.start(now);

    this.voices.set(note, {
      oscillator1: osc1,
      oscillator2: osc2,
      gainNode: voiceGain,
      filter,
      startTime: now,
      note,
    });
  }

  noteOff(note: number): void {
    const voice = this.voices.get(note);
    if (!voice) return;

    const ctx = audioEngine.getContext();
    const now = ctx.currentTime;

    // Release envelope
    voice.gainNode.gain.cancelScheduledValues(now);
    voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, now);
    voice.gainNode.gain.linearRampToValueAtTime(0, now + this.params.release);

    // Schedule cleanup
    const stopTime = now + this.params.release + 0.1;
    voice.oscillator1.stop(stopTime);
    voice.oscillator2.stop(stopTime);

    setTimeout(() => {
      voice.oscillator1.disconnect();
      voice.oscillator2.disconnect();
      voice.filter.disconnect();
      voice.gainNode.disconnect();
      this.voices.delete(note);
    }, (this.params.release + 0.2) * 1000);
  }

  allNotesOff(): void {
    this.voices.forEach((_, note) => this.noteOff(note));
  }

  private midiToFrequency(note: number): number {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  disconnect(): void {
    this.allNotesOff();
    this.outputGain.disconnect();
  }
}
