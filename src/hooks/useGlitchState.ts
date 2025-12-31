import { useState, useCallback } from 'react';
import { StutterParams } from '@/audio/GlitchEngine';

export type GlitchTrackId = 'master' | 'drums' | 'synth' | 'texture' | 'sample' | 'fx';

export interface TrackGlitchParams {
  stutter: {
    division: StutterParams['division'];
    decay: number;  // 0-100
    mix: number;    // 0-100
  };
  bitcrush: {
    bits: number;       // 1-16
    sampleRate: number; // 0-100
  };
  chaos: {
    density: number;   // 0-100
    intensity: number; // 0-100
  };
}

export type GlitchParamsPerTrack = Record<GlitchTrackId, TrackGlitchParams>;

const createDefaultTrackParams = (): TrackGlitchParams => ({
  stutter: { division: '1/16', decay: 50, mix: 50 },
  bitcrush: { bits: 8, sampleRate: 50 },
  chaos: { density: 30, intensity: 50 },
});

const createInitialState = (): GlitchParamsPerTrack => ({
  master: createDefaultTrackParams(),
  drums: createDefaultTrackParams(),
  synth: createDefaultTrackParams(),
  texture: createDefaultTrackParams(),
  sample: createDefaultTrackParams(),
  fx: createDefaultTrackParams(),
});

export const useGlitchState = () => {
  const [paramsPerTrack, setParamsPerTrack] = useState<GlitchParamsPerTrack>(createInitialState);

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

  const getParamsForTrack = useCallback((track: GlitchTrackId): TrackGlitchParams => {
    return paramsPerTrack[track];
  }, [paramsPerTrack]);

  const setAllParams = useCallback((newParams: GlitchParamsPerTrack) => {
    setParamsPerTrack(newParams);
  }, []);

  return {
    paramsPerTrack,
    updateStutterParams,
    updateBitcrushParams,
    updateChaosParams,
    getParamsForTrack,
    setAllParams,
  };
};
