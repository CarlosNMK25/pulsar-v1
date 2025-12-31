import { useState, useCallback } from 'react';
import { StutterParams } from '@/audio/GlitchEngine';

export type GlitchTrackId = 'master' | 'drums' | 'synth' | 'texture' | 'sample' | 'fx';

export interface TrackGlitchParams {
  stutter: {
    division: StutterParams['division'];
    decay: number;      // 0-100
    mix: number;        // 0-100
    repeatCount: number; // 1-16
    probability: number; // 0-100
  };
  bitcrush: {
    bits: number;       // 1-16
    sampleRate: number; // 0-100
    mix: number;        // 0-100 (NEW)
  };
  tapeStop: {           // NEW
    speed: number;      // 0-100
    duration: number;   // 0-100
    mix: number;        // 0-100
  };
  freeze: {             // NEW
    grainSize: number;  // 0-100
    pitch: number;      // 0-100
    spread: number;     // 0-100
    mix: number;        // 0-100
  };
  reverse: {            // NEW
    duration: number;   // 0-100
    mix: number;        // 0-100
  };
  chaos: {
    density: number;   // 0-100
    intensity: number; // 0-100
  };
  fxSends: {            // NEW
    reverb: number;     // 0-100
    delay: number;      // 0-100
  };
}

export type GlitchParamsPerTrack = Record<GlitchTrackId, TrackGlitchParams>;

const createDefaultTrackParams = (): TrackGlitchParams => ({
  stutter: { division: '1/16', decay: 50, mix: 50, repeatCount: 4, probability: 100 },
  bitcrush: { bits: 8, sampleRate: 50, mix: 50 },
  tapeStop: { speed: 50, duration: 50, mix: 70 },
  freeze: { grainSize: 50, pitch: 50, spread: 50, mix: 50 },
  reverse: { duration: 50, mix: 70 },
  chaos: { density: 30, intensity: 50 },
  fxSends: { reverb: 30, delay: 20 },
});

const createInitialState = (): GlitchParamsPerTrack => ({
  master: createDefaultTrackParams(),
  drums: createDefaultTrackParams(),
  synth: createDefaultTrackParams(),
  texture: createDefaultTrackParams(),
  sample: createDefaultTrackParams(),
  fx: createDefaultTrackParams(),
});

export interface GlitchGlobalState {
  masterMix: number; // 0-100
}

export const useGlitchState = () => {
  const [paramsPerTrack, setParamsPerTrack] = useState<GlitchParamsPerTrack>(createInitialState);
  const [masterMix, setMasterMix] = useState(50);

  const updateStutterParams = useCallback((
    track: GlitchTrackId,
    params: Partial<TrackGlitchParams['stutter']>
  ) => {
    setParamsPerTrack(prev => ({
      ...prev,
      [track]: {
        ...prev[track],
        stutter: { ...prev[track].stutter, ...params },
      },
    }));
  }, []);

  const updateBitcrushParams = useCallback((
    track: GlitchTrackId,
    params: Partial<TrackGlitchParams['bitcrush']>
  ) => {
    setParamsPerTrack(prev => ({
      ...prev,
      [track]: {
        ...prev[track],
        bitcrush: { ...prev[track].bitcrush, ...params },
      },
    }));
  }, []);

  const updateTapeStopParams = useCallback((
    track: GlitchTrackId,
    params: Partial<TrackGlitchParams['tapeStop']>
  ) => {
    setParamsPerTrack(prev => ({
      ...prev,
      [track]: {
        ...prev[track],
        tapeStop: { ...prev[track].tapeStop, ...params },
      },
    }));
  }, []);

  const updateFreezeParams = useCallback((
    track: GlitchTrackId,
    params: Partial<TrackGlitchParams['freeze']>
  ) => {
    setParamsPerTrack(prev => ({
      ...prev,
      [track]: {
        ...prev[track],
        freeze: { ...prev[track].freeze, ...params },
      },
    }));
  }, []);

  const updateReverseParams = useCallback((
    track: GlitchTrackId,
    params: Partial<TrackGlitchParams['reverse']>
  ) => {
    setParamsPerTrack(prev => ({
      ...prev,
      [track]: {
        ...prev[track],
        reverse: { ...prev[track].reverse, ...params },
      },
    }));
  }, []);

  const updateChaosParams = useCallback((
    track: GlitchTrackId,
    params: Partial<TrackGlitchParams['chaos']>
  ) => {
    setParamsPerTrack(prev => ({
      ...prev,
      [track]: {
        ...prev[track],
        chaos: { ...prev[track].chaos, ...params },
      },
    }));
  }, []);

  const updateFXSendsParams = useCallback((
    track: GlitchTrackId,
    params: Partial<TrackGlitchParams['fxSends']>
  ) => {
    setParamsPerTrack(prev => ({
      ...prev,
      [track]: {
        ...prev[track],
        fxSends: { ...prev[track].fxSends, ...params },
      },
    }));
  }, []);

  const getParamsForTrack = useCallback((track: GlitchTrackId): TrackGlitchParams => {
    return paramsPerTrack[track];
  }, [paramsPerTrack]);

  const setAllParams = useCallback((newParams: GlitchParamsPerTrack) => {
    setParamsPerTrack(newParams);
  }, []);

  return {
    paramsPerTrack,
    masterMix,
    setMasterMix,
    updateStutterParams,
    updateBitcrushParams,
    updateTapeStopParams,
    updateFreezeParams,
    updateReverseParams,
    updateChaosParams,
    updateFXSendsParams,
    getParamsForTrack,
    setAllParams,
  };
};
