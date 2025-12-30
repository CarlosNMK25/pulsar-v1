import { audioEngine } from './AudioEngine';
import { fxEngine } from './FXEngine';

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
  private reverbSend: GainNode;
  private delaySend: GainNode;
  private params: Omit<VoiceParams, 'frequency' | 'velocity'> & { lfoRate?: number };
  private fxConnected = false;
  private muted = false;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;

  constructor() {
    const ctx = audioEngine.getContext();
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 0.3;
    this.outputGain.connect(audioEngine.getMasterGain());

    // FX send nodes
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.25;
    
    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 0.2;

    this.params = {
      waveform: 'saw',
      detune: 10,
      attack: 0.01,
      release: 0.3,
      cutoff: 2000,
      resonance: 5,
      lfoRate: 2,
    };

    // Setup LFO for filter modulation
    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = 2;
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 500; // LFO depth in Hz
    this.lfo.connect(this.lfoGain);
    this.lfo.start();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
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

  setParams(params: Partial<Omit<VoiceParams, 'frequency' | 'velocity'> & { lfoRate?: number }>): void {
    this.params = { ...this.params, ...params };
    
    const ctx = audioEngine.getContext();
    
    // Update LFO rate
    if (params.lfoRate !== undefined && this.lfo) {
      // Map 0-100 to 0.1-20 Hz
      const rate = 0.1 + (params.lfoRate / 100) * 19.9;
      this.lfo.frequency.setTargetAtTime(rate, ctx.currentTime, 0.05);
      // LFO depth proportional to rate
      if (this.lfoGain) {
        this.lfoGain.gain.setTargetAtTime(200 + rate * 50, ctx.currentTime, 0.05);
      }
    }
    
    // Update active voices
    this.voices.forEach((voice) => {
      voice.filter.frequency.setTargetAtTime(this.params.cutoff, ctx.currentTime, 0.01);
      voice.filter.Q.setTargetAtTime(this.params.resonance, ctx.currentTime, 0.01);
      voice.oscillator1.type = waveformMap[this.params.waveform];
      voice.oscillator2.type = waveformMap[this.params.waveform];
      voice.oscillator2.detune.setTargetAtTime(this.params.detune, ctx.currentTime, 0.01);
    });
  }

  noteOn(note: number, velocity: number = 100): void {
    if (this.muted) return;
    
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

    // Connect LFO to filter
    if (this.lfoGain) {
      this.lfoGain.connect(filter.frequency);
    }

    // Connect: oscs -> filter -> voiceGain -> output + FX sends
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(voiceGain);
    voiceGain.connect(this.outputGain);
    voiceGain.connect(this.reverbSend);
    voiceGain.connect(this.delaySend);

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
    this.reverbSend.disconnect();
    this.delaySend.disconnect();
  }
}
