import { useState, useCallback } from 'react';

export interface MasterState {
  highpass: number;    // 20-2000 Hz
  lowpass: number;     // 200-20000 Hz
  resonance: number;   // 0-1
}

const defaultMasterState: MasterState = {
  highpass: 20,
  lowpass: 20000,
  resonance: 0,
};

export const useMasterState = () => {
  const [highpass, setHighpass] = useState(defaultMasterState.highpass);
  const [lowpass, setLowpass] = useState(defaultMasterState.lowpass);
  const [resonance, setResonance] = useState(defaultMasterState.resonance);

  const setAllMasterState = useCallback((state: MasterState) => {
    setHighpass(state.highpass);
    setLowpass(state.lowpass);
    setResonance(state.resonance);
  }, []);

  return {
    highpass,
    lowpass,
    resonance,
    setHighpass,
    setLowpass,
    setResonance,
    setAllMasterState,
  };
};

export type UseMasterStateReturn = ReturnType<typeof useMasterState>;
