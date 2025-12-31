import { useState, useCallback } from 'react';
import { defaultReverbParams, defaultDelayParams, defaultMasterFilterParams } from '@/constants/initialState';

export type SyncDivision = '1/4' | '1/8' | '1/16' | '3/16';

export interface ReverbParams {
  size: number;
  decay: number;
  damping: number;
  preDelay: number;
  lofi: number;
  mix: number;
}

export interface DelayParams {
  time: number;
  feedback: number;
  filter: number;
  spread: number;
  mix: number;
  syncDivision: SyncDivision;
}

export interface MasterFilterParams {
  lowpass: number;
  highpass: number;
}

export type TrackName = 'drums' | 'synth' | 'texture' | 'sample';

export interface TrackSend {
  reverb: number;
  delay: number;
}

export interface TrackSendLevels {
  drums: TrackSend;
  synth: TrackSend;
  texture: TrackSend;
  sample: TrackSend;
}

// NEW: Track routing for FX and Glitch bypass
export interface TrackRouting {
  fxBypass: boolean;      // true = no FX (reverb/delay)
  glitchBypass: boolean;  // true = no glitch processing
}

export interface TrackRoutingState {
  drums: TrackRouting;
  synth: TrackRouting;
  texture: TrackRouting;
  sample: TrackRouting;
}

export const defaultRoutingState: TrackRoutingState = {
  drums: { fxBypass: false, glitchBypass: false },
  synth: { fxBypass: false, glitchBypass: false },
  texture: { fxBypass: false, glitchBypass: false },
  sample: { fxBypass: false, glitchBypass: false },
};

export const defaultSendLevels: TrackSendLevels = {
  drums: { reverb: 0.2, delay: 0.15 },
  synth: { reverb: 0.25, delay: 0.2 },
  texture: { reverb: 0.3, delay: 0.1 },
  sample: { reverb: 0.2, delay: 0.25 },
};

export interface FXState {
  reverbParams: ReverbParams;
  delayParams: DelayParams;
  masterFilterParams: MasterFilterParams;
  sendLevels: TrackSendLevels;
  trackRouting: TrackRoutingState;
}

export const useFXState = () => {
  const [reverbParams, setReverbParams] = useState<ReverbParams>(defaultReverbParams);
  const [delayParams, setDelayParams] = useState<DelayParams>(defaultDelayParams);
  const [masterFilterParams, setMasterFilterParams] = useState<MasterFilterParams>(defaultMasterFilterParams);
  const [sendLevels, setSendLevels] = useState<TrackSendLevels>(defaultSendLevels);
  const [trackRouting, setTrackRouting] = useState<TrackRoutingState>(defaultRoutingState);

  const updateReverbParams = useCallback((params: Partial<ReverbParams>) => {
    setReverbParams(prev => ({ ...prev, ...params }));
  }, []);

  const updateDelayParams = useCallback((params: Partial<DelayParams>) => {
    setDelayParams(prev => ({ ...prev, ...params }));
  }, []);

  const updateMasterFilterParams = useCallback((params: Partial<MasterFilterParams>) => {
    setMasterFilterParams(prev => ({ ...prev, ...params }));
  }, []);

  const updateSendLevel = useCallback((track: TrackName, effect: 'reverb' | 'delay', value: number) => {
    setSendLevels(prev => ({
      ...prev,
      [track]: { ...prev[track], [effect]: value },
    }));
  }, []);

  // NEW: Update track routing (FX/Glitch bypass)
  const updateTrackRouting = useCallback((track: TrackName, routing: Partial<TrackRouting>) => {
    setTrackRouting(prev => ({
      ...prev,
      [track]: { ...prev[track], ...routing },
    }));
  }, []);

  // Batch setter for scene loading
  const setAllFXState = useCallback((state: Partial<FXState>) => {
    if (state.reverbParams !== undefined) setReverbParams(state.reverbParams);
    if (state.delayParams !== undefined) setDelayParams(state.delayParams);
    if (state.masterFilterParams !== undefined) setMasterFilterParams(state.masterFilterParams);
    if (state.sendLevels !== undefined) setSendLevels(state.sendLevels);
    if (state.trackRouting !== undefined) setTrackRouting(state.trackRouting);
  }, []);

  return {
    reverbParams,
    setReverbParams,
    delayParams,
    setDelayParams,
    masterFilterParams,
    setMasterFilterParams,
    sendLevels,
    setSendLevels,
    trackRouting,
    setTrackRouting,
    updateReverbParams,
    updateDelayParams,
    updateMasterFilterParams,
    updateSendLevel,
    updateTrackRouting,
    setAllFXState,
  };
};

export type UseFXStateReturn = ReturnType<typeof useFXState>;
