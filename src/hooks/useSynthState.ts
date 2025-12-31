import { useState, useCallback } from 'react';
import { WaveformType } from '@/audio/SynthVoice';
import { createInitialSteps, defaultSynthParams, defaultSynthPattern } from '@/constants/initialState';
import type { PLocks, AcidModifiers, ConditionType } from '@/hooks/useAudioEngine';

export interface Step {
  active: boolean;
  velocity: number;
  probability: number;
  pLocks?: PLocks;
  acid?: AcidModifiers;
  condition?: ConditionType;
}

export interface SynthParams {
  waveform: WaveformType;
  cutoff: number;
  resonance: number;
  attack: number;
  release: number;
  detune: number;
  lfoRate: number;
}

export interface SynthState {
  synthSteps: Step[];
  synthLength: number;
  synthParams: SynthParams;
  synthMuted: boolean;
}

export const useSynthState = () => {
  const [synthSteps, setSynthSteps] = useState<Step[]>(() => createInitialSteps(defaultSynthPattern));
  const [synthLength, setSynthLength] = useState(16);
  const [synthParams, setSynthParams] = useState<SynthParams>(defaultSynthParams);
  const [synthMuted, setSynthMuted] = useState(false);

  const toggleSynthMute = useCallback(() => {
    setSynthMuted(prev => !prev);
  }, []);

  // Batch setter for scene loading
  const setAllSynthState = useCallback((state: Partial<SynthState>) => {
    if (state.synthSteps !== undefined) setSynthSteps(state.synthSteps);
    if (state.synthLength !== undefined) setSynthLength(state.synthLength);
    if (state.synthParams !== undefined) setSynthParams(state.synthParams);
    if (state.synthMuted !== undefined) setSynthMuted(state.synthMuted);
  }, []);

  return {
    synthSteps,
    setSynthSteps,
    synthLength,
    setSynthLength,
    synthParams,
    setSynthParams,
    synthMuted,
    setSynthMuted,
    toggleSynthMute,
    setAllSynthState,
  };
};

export type UseSynthStateReturn = ReturnType<typeof useSynthState>;
