import { useState, useCallback } from 'react';
import { createInitialSteps, defaultDrumParams, defaultKickPattern, defaultSnarePattern, defaultHatPattern } from '@/constants/initialState';
import type { ConditionType } from '@/hooks/useAudioEngine';

export interface Step {
  active: boolean;
  velocity: number;
  probability: number;
  condition?: ConditionType;
}

import type { DistortionCurve } from '@/audio/WaveshaperEngine';

export interface DrumParams {
  pitch: number;
  decay: number;
  drive: number;
  driveType: DistortionCurve;
  mix: number;
}

export interface DrumState {
  kickSteps: Step[];
  snareSteps: Step[];
  hatSteps: Step[];
  kickLength: number;
  snareLength: number;
  hatLength: number;
  drumParams: DrumParams;
  drumMuted: boolean;
}

export const useDrumState = () => {
  // Drum steps
  const [kickSteps, setKickSteps] = useState<Step[]>(() => createInitialSteps(defaultKickPattern));
  const [snareSteps, setSnareSteps] = useState<Step[]>(() => createInitialSteps(defaultSnarePattern));
  const [hatSteps, setHatSteps] = useState<Step[]>(() => createInitialSteps(defaultHatPattern));
  
  // Track lengths
  const [kickLength, setKickLength] = useState(16);
  const [snareLength, setSnareLength] = useState(16);
  const [hatLength, setHatLength] = useState(16);
  
  // Params and mute
  const [drumParams, setDrumParams] = useState<DrumParams>(defaultDrumParams);
  const [drumMuted, setDrumMuted] = useState(false);

  const toggleDrumMute = useCallback(() => {
    setDrumMuted(prev => !prev);
  }, []);

  // Batch setter for scene loading
  const setAllDrumState = useCallback((state: Partial<DrumState>) => {
    if (state.kickSteps !== undefined) setKickSteps(state.kickSteps);
    if (state.snareSteps !== undefined) setSnareSteps(state.snareSteps);
    if (state.hatSteps !== undefined) setHatSteps(state.hatSteps);
    if (state.kickLength !== undefined) setKickLength(state.kickLength);
    if (state.snareLength !== undefined) setSnareLength(state.snareLength);
    if (state.hatLength !== undefined) setHatLength(state.hatLength);
    if (state.drumParams !== undefined) setDrumParams(state.drumParams);
    if (state.drumMuted !== undefined) setDrumMuted(state.drumMuted);
  }, []);

  return {
    // Steps
    kickSteps,
    setKickSteps,
    snareSteps,
    setSnareSteps,
    hatSteps,
    setHatSteps,
    // Lengths
    kickLength,
    setKickLength,
    snareLength,
    setSnareLength,
    hatLength,
    setHatLength,
    // Params
    drumParams,
    setDrumParams,
    drumMuted,
    setDrumMuted,
    toggleDrumMute,
    // Batch setter
    setAllDrumState,
  };
};

export type UseDrumStateReturn = ReturnType<typeof useDrumState>;
