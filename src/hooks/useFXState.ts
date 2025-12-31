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

export interface FXState {
  reverbParams: ReverbParams;
  delayParams: DelayParams;
  masterFilterParams: MasterFilterParams;
}

export const useFXState = () => {
  const [reverbParams, setReverbParams] = useState<ReverbParams>(defaultReverbParams);
  const [delayParams, setDelayParams] = useState<DelayParams>(defaultDelayParams);
  const [masterFilterParams, setMasterFilterParams] = useState<MasterFilterParams>(defaultMasterFilterParams);

  const updateReverbParams = useCallback((params: Partial<ReverbParams>) => {
    setReverbParams(prev => ({ ...prev, ...params }));
  }, []);

  const updateDelayParams = useCallback((params: Partial<DelayParams>) => {
    setDelayParams(prev => ({ ...prev, ...params }));
  }, []);

  const updateMasterFilterParams = useCallback((params: Partial<MasterFilterParams>) => {
    setMasterFilterParams(prev => ({ ...prev, ...params }));
  }, []);

  // Batch setter for scene loading
  const setAllFXState = useCallback((state: Partial<FXState>) => {
    if (state.reverbParams !== undefined) setReverbParams(state.reverbParams);
    if (state.delayParams !== undefined) setDelayParams(state.delayParams);
    if (state.masterFilterParams !== undefined) setMasterFilterParams(state.masterFilterParams);
  }, []);

  return {
    reverbParams,
    setReverbParams,
    delayParams,
    setDelayParams,
    masterFilterParams,
    setMasterFilterParams,
    updateReverbParams,
    updateDelayParams,
    updateMasterFilterParams,
    setAllFXState,
  };
};

export type UseFXStateReturn = ReturnType<typeof useFXState>;
