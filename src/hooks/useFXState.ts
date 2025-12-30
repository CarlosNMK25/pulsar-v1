import { useState, useCallback } from 'react';
import { defaultReverbParams, defaultDelayParams } from '@/constants/initialState';

export interface ReverbParams {
  size: number;
  decay: number;
  damping: number;
  mix: number;
}

export interface DelayParams {
  time: number;
  feedback: number;
  filter: number;
  mix: number;
}

export interface FXState {
  reverbParams: ReverbParams;
  delayParams: DelayParams;
}

export const useFXState = () => {
  const [reverbParams, setReverbParams] = useState<ReverbParams>(defaultReverbParams);
  const [delayParams, setDelayParams] = useState<DelayParams>(defaultDelayParams);

  const updateReverbParams = useCallback((params: Partial<ReverbParams>) => {
    setReverbParams(prev => ({ ...prev, ...params }));
  }, []);

  const updateDelayParams = useCallback((params: Partial<DelayParams>) => {
    setDelayParams(prev => ({ ...prev, ...params }));
  }, []);

  // Batch setter for scene loading
  const setAllFXState = useCallback((state: Partial<FXState>) => {
    if (state.reverbParams !== undefined) setReverbParams(state.reverbParams);
    if (state.delayParams !== undefined) setDelayParams(state.delayParams);
  }, []);

  return {
    reverbParams,
    setReverbParams,
    delayParams,
    setDelayParams,
    updateReverbParams,
    updateDelayParams,
    setAllFXState,
  };
};

export type UseFXStateReturn = ReturnType<typeof useFXState>;
