import { WaveformType, LfoSyncDivision } from '@/audio/SynthVoice';
import { TextureMode } from '@/audio/TextureEngine';

// Scene configuration
export const initialScenes = [
  { id: 'a', name: 'Init' },
  { id: 'b', name: 'Build' },
  { id: 'c', name: 'Drop' },
  { id: 'd', name: 'Break' },
  { id: 'e', name: 'Ambient' },
  { id: 'f', name: 'Chaos' },
  { id: 'g', name: 'Outro' },
  { id: 'h', name: 'Empty' },
];

// Macro knob configuration
export const initialMacros = [
  { id: 'm1', name: 'Filter', value: 50, targets: ['synth.cutoff', 'texture.density'] },
  { id: 'm2', name: 'Decay', value: 40, targets: ['drums.decay'] },
  { id: 'm3', name: 'Space', value: 30, targets: ['reverb.mix', 'delay.feedback'] },
  { id: 'm4', name: 'Chaos', value: 0, targets: [] },
  { id: 'm5', name: 'Drive', value: 25, targets: ['master.drive'] },
  { id: 'm6', name: 'LFO', value: 50, targets: ['synth.lfo'] },
  { id: 'm7', name: 'Morph', value: 0, targets: [] },
  { id: 'm8', name: 'Master', value: 75, targets: ['master.gain'] },
];

// Step pattern factory
export const createInitialSteps = (pattern: number[]) => 
  Array(16).fill(null).map((_, i) => ({
    active: pattern.includes(i),
    velocity: 80 + Math.random() * 40,
    probability: 100,
  }));

// Animation duration for scene transitions
export const TRANSITION_DURATION = 500; // ms

// Default parameter values
export const defaultDrumParams = { pitch: 50, decay: 60, drive: 30, driveType: 'soft' as const, mix: 75 };

export const defaultSynthParams = {
  waveform: 'saw' as WaveformType,
  cutoff: 65,
  resonance: 40,
  attack: 10,
  release: 45,
  detune: 25,
  lfoRate: 30,
  lfoSyncDivision: 'free' as LfoSyncDivision,
  fmAmount: 0,   // FM off by default (retrocompatible)
  fmRatio: 50,   // ~2x ratio (octave harmonic)
  drive: 0,      // Waveshaper off by default
  driveType: 'soft' as const,
};

export const defaultTextureParams = {
  density: 45,
  spread: 60,
  pitch: 50,
  size: 35,
  feedback: 20,
  mix: 50,
};

export const defaultTextureMode: TextureMode = 'granular';

export const defaultReverbParams = {
  size: 0.5,
  decay: 0.5,
  damping: 0.5,
  preDelay: 0.1,
  lofi: 0.0,
  mix: 0.3,
};

export const defaultDelayParams = {
  time: 0.375,
  feedback: 0.4,
  filter: 0.7,
  spread: 0.3,
  mix: 0.25,
  syncDivision: '3/16' as const,
};

export const defaultMasterFilterParams = {
  lowpass: 1.0,
  highpass: 0.0,
  resonance: 0.1,
  width: 0.5,
};

// Default step patterns
export const defaultKickPattern = [0, 4, 8, 12];
export const defaultSnarePattern = [4, 12];
export const defaultHatPattern = [0, 2, 4, 6, 8, 10, 12, 14];
export const defaultSynthPattern = [0, 3, 6, 8, 10, 12, 14];
