import { audioEngine } from './AudioEngine';
import { fxEngine } from './FXEngine';
import { WaveshaperEngine, DistortionCurve } from './WaveshaperEngine';

export type WaveformType = 'sine' | 'saw' | 'square' | 'tri';

// LFO sync divisions for BPM-synced modulation
export type LfoSyncDivision = 
  | 'free'      // Hz libre (actual)
  | '1/1'       // 1 bar = 4 beats
  | '1/2'       // half note = 2 beats
  | '1/4'       // quarter = 1 beat
  | '1/8'       // eighth = 0.5 beat
  | '1/16'      // sixteenth = 0.25 beat
  | '3/16'      // IDM triplet feel
  | '5/16';     // IDM polymetric

interface VoiceParams {
  frequency: number;
  velocity: number;
  waveform: WaveformType;
  detune: number;
  attack: number;
  release: number;
  cutoff: number;
  resonance: number;
  fmAmount: number;  // 0-100: FM modulation depth
  fmRatio: number;   // 0-100: modulator/carrier ratio (maps to 0.5x-8x)
  drive: number;     // 0-100: waveshaper drive
  driveType: DistortionCurve; // Distortion curve type
}

// Acid 303 options for noteOn
export interface AcidNoteOptions {
  slide?: boolean;
  accent?: boolean;
  tie?: boolean;
}

interface Voice {
  oscillator1: OscillatorNode;
  oscillator2: OscillatorNode;
  modulator?: OscillatorNode;  // FM modulator oscillator
  fmGain?: GainNode;           // FM depth control
  gainNode: GainNode;
  filter: BiquadFilterNode;
  startTime: number;
  note: number;
  isSliding?: boolean;
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
  private waveshaper: WaveshaperEngine;
  private preWaveshaperGain: GainNode;
  private params: Omit<VoiceParams, 'frequency' | 'velocity'> & { lfoRate?: number; lfoSyncDivision?: LfoSyncDivision };
  private fxConnected = false;
  private muted = false;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private lastNote: number | null = null;
  private slideVoice: Voice | null = null;
  private currentBpm: number = 120;

  constructor() {
    const ctx = audioEngine.getContext();
    
    // Pre-waveshaper gain for routing
    this.preWaveshaperGain = ctx.createGain();
    this.preWaveshaperGain.gain.value = 1;
    
    // Waveshaper for drive/distortion
    this.waveshaper = new WaveshaperEngine();
    
    // Output gain
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 0.3;
    
    // Connect chain: preWaveshaperGain -> waveshaper -> outputGain -> trackBus
    this.preWaveshaperGain.connect(this.waveshaper.getInput());
    this.waveshaper.getOutput().connect(this.outputGain);
    this.outputGain.connect(audioEngine.getTrackBus('synth'));
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
      lfoSyncDivision: 'free',
      fmAmount: 0,
      fmRatio: 50,
      drive: 0,
      driveType: 'soft',
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

  // Set LFO to sync with BPM using division
  setLfoSync(bpm: number, division?: LfoSyncDivision): void {
    this.currentBpm = bpm;
    const syncDiv = division ?? this.params.lfoSyncDivision ?? 'free';
    this.params.lfoSyncDivision = syncDiv;
    
    if (syncDiv === 'free' || !this.lfo) return;
    
    // Calculate Hz from BPM and division
    // BPM / 60 = beats per second
    // division tells us how many beats per LFO cycle
    const beatsPerSecond = bpm / 60;
    let divisionValue: number;
    
    switch (syncDiv) {
      case '1/1':  divisionValue = 4;    break; // 4 beats = 1 bar
      case '1/2':  divisionValue = 2;    break; // 2 beats
      case '1/4':  divisionValue = 1;    break; // 1 beat
      case '1/8':  divisionValue = 0.5;  break; // half beat
      case '1/16': divisionValue = 0.25; break; // quarter beat
      case '3/16': divisionValue = 0.75; break; // IDM triplet
      case '5/16': divisionValue = 1.25; break; // IDM poly
      default:     return;
    }
    
    const lfoHz = beatsPerSecond / divisionValue;
    const ctx = audioEngine.getContext();
    this.lfo.frequency.setTargetAtTime(lfoHz, ctx.currentTime, 0.05);
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

  getParams(): Omit<VoiceParams, 'frequency' | 'velocity'> & { lfoRate?: number; lfoSyncDivision?: LfoSyncDivision; fmAmount?: number; fmRatio?: number; drive?: number; driveType?: DistortionCurve } {
    return { ...this.params };
  }

  getLfoSyncDivision(): LfoSyncDivision {
    return this.params.lfoSyncDivision ?? 'free';
  }

  setParams(params: Partial<Omit<VoiceParams, 'frequency' | 'velocity'> & { lfoRate?: number; lfoSyncDivision?: LfoSyncDivision; fmAmount?: number; fmRatio?: number; drive?: number; driveType?: DistortionCurve }>): void {
    this.params = { ...this.params, ...params };
    
    const ctx = audioEngine.getContext();
    
    // Handle LFO sync division change
    if (params.lfoSyncDivision !== undefined) {
      this.setLfoSync(this.currentBpm, params.lfoSyncDivision);
    }
    
    // Update LFO rate (only when in 'free' mode)
    if (params.lfoRate !== undefined && this.lfo && this.params.lfoSyncDivision === 'free') {
      // Map 0-100 to 0.1-20 Hz
      const rate = 0.1 + (params.lfoRate / 100) * 19.9;
      this.lfo.frequency.setTargetAtTime(rate, ctx.currentTime, 0.05);
      // LFO depth proportional to rate
      if (this.lfoGain) {
        this.lfoGain.gain.setTargetAtTime(200 + rate * 50, ctx.currentTime, 0.05);
      }
    }
    
    // Update waveshaper drive
    if (params.drive !== undefined) {
      this.waveshaper.setDrive(params.drive);
    }
    if (params.driveType !== undefined) {
      this.waveshaper.setCurve(params.driveType);
    }
    
    // Update active voices (including FM parameters)
    this.voices.forEach((voice) => {
      voice.filter.frequency.setTargetAtTime(this.params.cutoff, ctx.currentTime, 0.01);
      voice.filter.Q.setTargetAtTime(this.params.resonance, ctx.currentTime, 0.01);
      voice.oscillator1.type = waveformMap[this.params.waveform];
      voice.oscillator2.type = waveformMap[this.params.waveform];
      voice.oscillator2.detune.setTargetAtTime(this.params.detune, ctx.currentTime, 0.01);
      
      // Update FM parameters for active voices
      if (voice.fmGain && voice.modulator) {
        const frequency = voice.oscillator1.frequency.value;
        const fmAmount = this.params.fmAmount ?? 0;
        const fmRatioNorm = this.params.fmRatio ?? 50;
        const fmRatio = 0.5 + (fmRatioNorm / 100) * 7.5;
        
        voice.fmGain.gain.setTargetAtTime((fmAmount / 100) * frequency * 2, ctx.currentTime, 0.01);
        voice.modulator.frequency.setTargetAtTime(frequency * fmRatio, ctx.currentTime, 0.01);
      }
    });
  }

  noteOn(note: number, velocity: number = 100, options?: AcidNoteOptions): void {
    if (this.muted) return;
    
    const ctx = audioEngine.getContext();
    const frequency = this.midiToFrequency(note);
    const now = ctx.currentTime;
    
    const slide = options?.slide ?? false;
    const accent = options?.accent ?? false;
    const tie = options?.tie ?? false;

    // Acid 303: Slide - glide from previous note instead of retriggering
    if (slide && this.slideVoice && this.lastNote !== null) {
      const slideTime = 0.06; // 60ms glide time (classic 303)
      this.slideVoice.oscillator1.frequency.linearRampToValueAtTime(frequency, now + slideTime);
      this.slideVoice.oscillator2.frequency.linearRampToValueAtTime(frequency, now + slideTime);
      this.slideVoice.isSliding = true;
      this.lastNote = note;
      return;
    }

    // Acid 303: Tie - don't retrigger envelope, just change pitch
    if (tie && this.slideVoice && this.lastNote !== null) {
      this.slideVoice.oscillator1.frequency.setValueAtTime(frequency, now);
      this.slideVoice.oscillator2.frequency.setValueAtTime(frequency, now);
      this.lastNote = note;
      return;
    }

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

    // FM Synthesis: Create modulator oscillator
    let modulator: OscillatorNode | undefined;
    let fmGain: GainNode | undefined;
    
    const fmAmount = this.params.fmAmount ?? 0;
    const fmRatioNorm = this.params.fmRatio ?? 50;
    
    if (fmAmount > 0) {
      modulator = ctx.createOscillator();
      fmGain = ctx.createGain();
      
      // Ratio: map 0-100 to 0.5x - 8x of carrier frequency
      const fmRatio = 0.5 + (fmRatioNorm / 100) * 7.5;
      modulator.frequency.value = frequency * fmRatio;
      modulator.type = 'sine'; // Sine modulator for classic FM
      
      // FM depth scales with frequency for consistent tonality
      fmGain.gain.value = (fmAmount / 100) * frequency * 2;
      
      // Connect: modulator -> fmGain -> carrier frequencies
      modulator.connect(fmGain);
      fmGain.connect(osc1.frequency);
      fmGain.connect(osc2.frequency);
      modulator.start(now);
    }

    // Create filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    
    // TB-303 Style Filter: Aggressive resonance and envelope for accented notes
    if (accent) {
      // Much higher resonance for accent - creates the classic "squelch"
      const accentResonance = Math.min(this.params.resonance * 2.5, 25);
      filter.Q.value = accentResonance;
      
      // Start with boosted cutoff, then sweep down for "squelch" effect
      const peakCutoff = Math.min(this.params.cutoff * 3, 8000);
      filter.frequency.setValueAtTime(peakCutoff, now);
      filter.frequency.exponentialRampToValueAtTime(
        this.params.cutoff * 0.5,
        now + 0.12 // Fast decay for punchy 303 sound
      );
    } else {
      filter.frequency.value = this.params.cutoff;
      filter.Q.value = this.params.resonance;
    }

    // Create voice gain envelope
    const voiceGain = ctx.createGain();
    // Acid 303: Accent - boost velocity significantly
    const accentVelocity = accent ? Math.min(velocity * 1.5, 127) : velocity;
    const normalizedVelocity = (accentVelocity / 127) * 0.5;
    voiceGain.gain.setValueAtTime(0, now);
    voiceGain.gain.linearRampToValueAtTime(normalizedVelocity, now + this.params.attack);

    // Connect LFO to filter
    if (this.lfoGain) {
      this.lfoGain.connect(filter.frequency);
    }

    // Connect: oscs -> filter -> voiceGain -> preWaveshaperGain -> waveshaper -> output + FX sends
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(voiceGain);
    voiceGain.connect(this.preWaveshaperGain);
    voiceGain.connect(this.reverbSend);
    voiceGain.connect(this.delaySend);

    // Start oscillators
    osc1.start(now);
    osc2.start(now);

    const voice: Voice = {
      oscillator1: osc1,
      oscillator2: osc2,
      modulator,
      fmGain,
      gainNode: voiceGain,
      filter,
      startTime: now,
      note,
      isSliding: false,
    };

    this.voices.set(note, voice);
    this.slideVoice = voice;
    this.lastNote = note;
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
    if (voice.modulator) {
      voice.modulator.stop(stopTime);
    }

    setTimeout(() => {
      voice.oscillator1.disconnect();
      voice.oscillator2.disconnect();
      if (voice.modulator) voice.modulator.disconnect();
      if (voice.fmGain) voice.fmGain.disconnect();
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

  setVolume(value: number): void {
    const ctx = audioEngine.getContext();
    this.outputGain.gain.setTargetAtTime(value * 0.3, ctx.currentTime, 0.05);
  }

  disconnect(): void {
    this.allNotesOff();
    this.preWaveshaperGain.disconnect();
    this.waveshaper.disconnect();
    this.outputGain.disconnect();
    this.reverbSend.disconnect();
    this.delaySend.disconnect();
  }
}
