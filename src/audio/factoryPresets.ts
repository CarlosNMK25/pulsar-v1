// Factory Presets for Scene System
import { SceneData } from './SceneEngine';
import { WaveformType } from './SynthVoice';
import { TextureMode } from './TextureEngine';

type PresetData = Omit<SceneData, 'id' | 'saved'>;

const createSteps = (pattern: number[], velocity = 100, probability = 100) =>
  Array(16).fill(null).map((_, i) => ({
    active: pattern.includes(i),
    velocity: pattern.includes(i) ? velocity : 80,
    probability,
  }));

export const factoryPresets: Record<string, PresetData> = {
  techno: {
    name: 'Techno',
    drumSteps: {
      kick: createSteps([0, 4, 8, 12]),
      snare: createSteps([4, 12]),
      hat: createSteps([2, 6, 10, 14], 70),
    },
    drumParams: { pitch: 45, decay: 55, drive: 50, driveType: 'hard' as const, mix: 85 },
    drumMuted: false,
    synthSteps: createSteps([0, 6, 8, 14]),
    synthParams: {
      waveform: 'saw' as WaveformType,
      cutoff: 40,
      resonance: 60,
      attack: 5,
      release: 30,
      detune: 15,
      lfoRate: 45,
      lfoSyncDivision: 'free' as const,
      fmAmount: 0,
      fmRatio: 50,
      drive: 20,
      driveType: 'soft' as const,
    },
    synthMuted: false,
    textureMode: 'noise' as TextureMode,
    textureParams: { density: 30, spread: 40, pitch: 50, size: 25, feedback: 15, mix: 25 },
    textureMuted: false,
    reverbParams: { size: 0.3, decay: 0.4, damping: 0.6, preDelay: 0.05, lofi: 0, mix: 0.2 },
    delayParams: { time: 0.375, feedback: 0.35, filter: 0.5, spread: 0.2, mix: 0.3, syncDivision: '3/16' as const },
    masterFilterParams: { lowpass: 1, highpass: 0 },
    bpm: 130,
    swing: 0,
  },

  ambient: {
    name: 'Ambient',
    drumSteps: {
      kick: createSteps([]),
      snare: createSteps([]),
      hat: createSteps([]),
    },
    drumParams: { pitch: 50, decay: 70, drive: 10, driveType: 'soft' as const, mix: 0 },
    drumMuted: true,
    synthSteps: createSteps([0, 8], 60),
    synthParams: {
      waveform: 'sine' as WaveformType,
      cutoff: 80,
      resonance: 20,
      attack: 80,
      release: 90,
      detune: 40,
      lfoRate: 10,
      lfoSyncDivision: '1/4' as const,
      fmAmount: 15,
      fmRatio: 30,
      drive: 0,
      driveType: 'soft' as const,
    },
    synthMuted: false,
    textureMode: 'granular' as TextureMode,
    textureParams: { density: 70, spread: 80, pitch: 45, size: 70, feedback: 50, mix: 70 },
    textureMuted: false,
    reverbParams: { size: 0.9, decay: 0.85, damping: 0.3, preDelay: 0.2, lofi: 0.3, mix: 0.6 },
    delayParams: { time: 0.5, feedback: 0.6, filter: 0.8, spread: 0.5, mix: 0.4, syncDivision: '1/4' as const },
    masterFilterParams: { lowpass: 0.8, highpass: 0.1 },
    bpm: 70,
    swing: 15,
  },

  breaks: {
    name: 'Breaks',
    drumSteps: {
      kick: createSteps([0, 3, 6, 10, 13]),
      snare: createSteps([4, 12, 15], 110),
      hat: createSteps([0, 2, 4, 5, 7, 8, 10, 12, 14, 15], 85),
    },
    drumParams: { pitch: 55, decay: 45, drive: 60, driveType: 'tube' as const, mix: 90 },
    drumMuted: false,
    synthSteps: createSteps([0, 3, 7, 11, 14]),
    synthParams: {
      waveform: 'square' as WaveformType,
      cutoff: 55,
      resonance: 50,
      attack: 5,
      release: 25,
      detune: 20,
      lfoRate: 60,
      lfoSyncDivision: '1/8' as const,
      fmAmount: 0,
      fmRatio: 50,
      drive: 30,
      driveType: 'hard' as const,
    },
    synthMuted: false,
    textureMode: 'sample' as TextureMode,
    textureParams: { density: 50, spread: 55, pitch: 60, size: 30, feedback: 35, mix: 40 },
    textureMuted: false,
    reverbParams: { size: 0.4, decay: 0.35, damping: 0.5, preDelay: 0.03, lofi: 0.1, mix: 0.25 },
    delayParams: { time: 0.25, feedback: 0.5, filter: 0.6, spread: 0.4, mix: 0.35, syncDivision: '1/8' as const },
    masterFilterParams: { lowpass: 1, highpass: 0 },
    bpm: 140,
    swing: 30,
  },

  experimental: {
    name: 'Experimental',
    drumSteps: {
      kick: createSteps([0, 5, 9, 11, 15], 90, 70),
      snare: createSteps([2, 7, 13], 100, 60),
      hat: createSteps([1, 3, 6, 8, 10, 12, 14], 75, 80),
    },
    drumParams: { pitch: 30, decay: 80, drive: 70, driveType: 'foldback' as const, mix: 75 },
    drumMuted: false,
    synthSteps: createSteps([1, 4, 5, 9, 12, 15], 85, 75),
    synthParams: {
      waveform: 'tri' as WaveformType,
      cutoff: 70,
      resonance: 75,
      attack: 20,
      release: 60,
      detune: 60,
      lfoRate: 80,
      lfoSyncDivision: '3/16' as const,
      fmAmount: 50,
      fmRatio: 70,
      drive: 40,
      driveType: 'foldback' as const,
    },
    synthMuted: false,
    textureMode: 'drone' as TextureMode,
    textureParams: { density: 85, spread: 90, pitch: 35, size: 60, feedback: 70, mix: 55 },
    textureMuted: false,
    reverbParams: { size: 0.7, decay: 0.8, damping: 0.2, preDelay: 0.15, lofi: 0.5, mix: 0.5 },
    delayParams: { time: 0.333, feedback: 0.7, filter: 0.4, spread: 0.6, mix: 0.45, syncDivision: '3/16' as const },
    masterFilterParams: { lowpass: 0.7, highpass: 0.2 },
    bpm: 100,
    swing: 45,
  },

  glitchDemo: {
    name: 'Glitch Demo',
    drumSteps: {
      kick: createSteps([0, 4, 8, 12]),
      snare: createSteps([4, 12]),
      hat: createSteps([0, 2, 4, 6, 8, 10, 12, 14], 80),
    },
    drumParams: { pitch: 50, decay: 60, drive: 40, driveType: 'bitcrush' as const, mix: 100 },
    drumMuted: false,
    synthSteps: createSteps([0, 4, 8, 12]),
    synthParams: {
      waveform: 'saw' as WaveformType,
      cutoff: 60,
      resonance: 30,
      attack: 10,
      release: 70,
      detune: 10,
      lfoRate: 20,
      lfoSyncDivision: 'free' as const,
      fmAmount: 25,
      fmRatio: 50,
      drive: 15,
      driveType: 'bitcrush' as const,
    },
    synthMuted: false,
    textureMode: 'drone' as TextureMode,
    textureParams: { density: 60, spread: 50, pitch: 50, size: 50, feedback: 30, mix: 50 },
    textureMuted: false,
    reverbParams: { size: 0.2, decay: 0.2, damping: 0.7, preDelay: 0, lofi: 0, mix: 0.1 },
    delayParams: { time: 0.25, feedback: 0.2, filter: 0.5, spread: 0.3, mix: 0.1, syncDivision: '1/8' as const },
    masterFilterParams: { lowpass: 1, highpass: 0 },
    bpm: 110,
    swing: 0,
  },
};

export type FactoryPresetName = keyof typeof factoryPresets;

export const getFactoryPresetNames = (): FactoryPresetName[] => 
  Object.keys(factoryPresets) as FactoryPresetName[];

export const getFactoryPreset = (name: FactoryPresetName): PresetData => 
  factoryPresets[name];
