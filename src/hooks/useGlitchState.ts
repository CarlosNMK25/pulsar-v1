import { useState, useCallback } from 'react';
import { StutterParams } from '@/audio/GlitchEngine';

export type GlitchTrackId = 'master' | 'drums' | 'synth' | 'texture' | 'sample' | 'fx';

// Crush effect types
export type CrushCurve = 'soft' | 'hard' | 'fold' | 'tube';
export type NoiseType = 'white' | 'pink' | 'brown';
export type JitterMode = 'random' | 'sine' | 'tape';

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
    sampleRate: number; // 0-100 (decimation)
    mix: number;        // 0-100
    // New Lo-Fi Degradation params
    drive: number;      // 0-100: pre-distortion amount
    curve: CrushCurve;  // distortion curve type
    noise: number;      // 0-100: noise injection amount
    noiseType: NoiseType; // white/pink/brown noise
    filter: number;     // 0-100: post lowpass filter (100 = no filter)
    jitter: number;     // 0-100: temporal variation
    jitterMode: JitterMode; // random/sine/tape
    probability: number; // 0-100: chance of triggering
  };
  tapeStop: {
    speed: number;      // 0-100
    duration: number;   // 0-100
    mix: number;        // 0-100
    curve: 'linear' | 'exp' | 'log' | 'scurve';
    wobble: number;     // 0-100
    probability: number; // 0-100
  };
  freeze: {
    grainSize: number;  // 0-100
    pitch: number;      // 0-100: real pitch via playbackRate
    spread: number;     // 0-100: random amplitude variation
    mix: number;        // 0-100
    position: number;   // 0-100: capture point in buffer
    overlap: number;    // 0-100: grain superposition
    density: number;    // 0-100: grains per second
    jitter: number;     // 0-100: temporal variation
    attack: number;     // 0-100: grain envelope attack
    detune: number;     // 0-100: pitch variation in cents
    scatter: number;    // 0-100: random read position variation
    reverse: boolean;   // play grains reversed
    probability: number; // 0-100: chance of triggering
  };
  reverse: {
    duration: number;    // 0-100
    mix: number;         // 0-100
    position: number;    // 0-100: start point in buffer
    crossfade: number;   // 0-100: smooth envelope
    speed: number;       // 0-100: playback speed
    feedback: number;    // 0-100: re-inject output
    loop: number;        // 0-100: repetitions
    probability: number; // 0-100: chance of activation
  };
  chaos: {
    density: number;   // 0-100
    intensity: number; // 0-100
  };
  fxSends: {
    reverb: number;     // 0-100
    delay: number;      // 0-100
  };
}

export type GlitchParamsPerTrack = Record<GlitchTrackId, TrackGlitchParams>;

const createDefaultTrackParams = (): TrackGlitchParams => ({
  stutter: { division: '1/16', decay: 50, mix: 50, repeatCount: 4, probability: 100 },
  bitcrush: { 
    bits: 8, 
    sampleRate: 50, 
    mix: 50,
    drive: 0,
    curve: 'soft',
    noise: 0,
    noiseType: 'white',
    filter: 100,
    jitter: 0,
    jitterMode: 'random',
    probability: 100
  },
  tapeStop: { speed: 50, duration: 50, mix: 70, curve: 'exp', wobble: 0, probability: 100 },
  freeze: { grainSize: 50, pitch: 50, spread: 30, mix: 50, position: 50, overlap: 50, density: 50, jitter: 20, attack: 10, detune: 50, scatter: 20, reverse: false, probability: 100 },
  reverse: { duration: 50, mix: 70, position: 0, crossfade: 30, speed: 50, feedback: 0, loop: 0, probability: 100 },
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
