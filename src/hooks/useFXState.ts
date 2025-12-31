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
}

export const useFXState = () => {
  const [reverbParams, setReverbParams] = useState<ReverbParams>(defaultReverbParams);
  const [delayParams, setDelayParams] = useState<DelayParams>(defaultDelayParams);
  const [masterFilterParams, setMasterFilterParams] = useState<MasterFilterParams>(defaultMasterFilterParams);
  const [sendLevels, setSendLevels] = useState<TrackSendLevels>(defaultSendLevels);

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

  // Batch setter for scene loading
  const setAllFXState = useCallback((state: Partial<FXState>) => {
    if (state.reverbParams !== undefined) setReverbParams(state.reverbParams);
    if (state.delayParams !== undefined) setDelayParams(state.delayParams);
    if (state.masterFilterParams !== undefined) setMasterFilterParams(state.masterFilterParams);
    if (state.sendLevels !== undefined) setSendLevels(state.sendLevels);
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
    updateReverbParams,
    updateDelayParams,
    updateMasterFilterParams,
    updateSendLevel,
    setAllFXState,
  };
};

export type UseFXStateReturn = ReturnType<typeof useFXState>;
