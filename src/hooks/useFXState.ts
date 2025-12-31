import { useState, useCallback } from 'react';
import { defaultReverbParams, defaultDelayParams, defaultMasterFilterParams } from '@/constants/initialState';

export type SyncDivision = '1/4' | '1/8' | '1/16' | '3/16';

// FX routing targets
export type FXRoutingMode = 'master' | 'individual';
export type FXTarget = 'drums' | 'synth' | 'texture' | 'sample' | 'glitch';

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
  resonance: number;
  width: number;
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
  drums: { reverb: 0.4, delay: 0.3 },
  synth: { reverb: 0.4, delay: 0.35 },
  texture: { reverb: 0.5, delay: 0.3 },
  sample: { reverb: 0.35, delay: 0.3 },
};

// NEW: FX Offsets per track (-0.5 to +0.5, where 0 = no offset)
export interface ReverbOffsets {
  size: number;
  decay: number;
  damping: number;
  preDelay: number;
  lofi: number;
}

export interface DelayOffsets {
  time: number;
  feedback: number;
  filter: number;
  spread: number;
}

export interface TrackFXOffsets {
  reverb: ReverbOffsets;
  delay: DelayOffsets;
}

export interface FXOffsetsPerTrack {
  drums: TrackFXOffsets;
  synth: TrackFXOffsets;
  texture: TrackFXOffsets;
  sample: TrackFXOffsets;
}

const defaultReverbOffsets: ReverbOffsets = { size: 0, decay: 0, damping: 0, preDelay: 0, lofi: 0 };
const defaultDelayOffsets: DelayOffsets = { time: 0, feedback: 0, filter: 0, spread: 0 };
const defaultTrackOffsets: TrackFXOffsets = { reverb: { ...defaultReverbOffsets }, delay: { ...defaultDelayOffsets } };

export const defaultFXOffsets: FXOffsetsPerTrack = {
  drums: { reverb: { ...defaultReverbOffsets }, delay: { ...defaultDelayOffsets } },
  synth: { reverb: { ...defaultReverbOffsets }, delay: { ...defaultDelayOffsets } },
  texture: { reverb: { ...defaultReverbOffsets }, delay: { ...defaultDelayOffsets } },
  sample: { reverb: { ...defaultReverbOffsets }, delay: { ...defaultDelayOffsets } },
};

export interface FXState {
  reverbParams: ReverbParams;
  delayParams: DelayParams;
  masterFilterParams: MasterFilterParams;
  sendLevels: TrackSendLevels;
  trackRouting: TrackRoutingState;
  fxRoutingMode: FXRoutingMode;
  fxTargets: FXTarget[];
  fxOffsetsPerTrack: FXOffsetsPerTrack;
}

export const useFXState = () => {
  const [reverbParams, setReverbParams] = useState<ReverbParams>(defaultReverbParams);
  const [delayParams, setDelayParams] = useState<DelayParams>(defaultDelayParams);
  const [masterFilterParams, setMasterFilterParams] = useState<MasterFilterParams>(defaultMasterFilterParams);
  const [sendLevels, setSendLevels] = useState<TrackSendLevels>(defaultSendLevels);
  const [trackRouting, setTrackRouting] = useState<TrackRoutingState>(defaultRoutingState);
  const [fxRoutingMode, setFxRoutingMode] = useState<FXRoutingMode>('master');
  const [fxTargets, setFxTargets] = useState<FXTarget[]>([]);
  const [fxOffsetsPerTrack, setFxOffsetsPerTrack] = useState<FXOffsetsPerTrack>(defaultFXOffsets);

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

  // Toggle individual FX target
  const toggleFxTarget = useCallback((target: FXTarget) => {
    setFxTargets(prev => {
      if (prev.includes(target)) {
        return prev.filter(t => t !== target);
      } else {
        return [...prev, target];
      }
    });
  }, []);

  // NEW: Update FX offset for a specific track/effect/param
  const updateFXOffset = useCallback((
    track: TrackName,
    effect: 'reverb' | 'delay',
    param: string,
    value: number
  ) => {
    setFxOffsetsPerTrack(prev => ({
      ...prev,
      [track]: {
        ...prev[track],
        [effect]: {
          ...prev[track][effect],
          [param]: value,
        },
      },
    }));
  }, []);

  // NEW: Reset offsets for a track
  const resetTrackOffsets = useCallback((track: TrackName) => {
    setFxOffsetsPerTrack(prev => ({
      ...prev,
      [track]: {
        reverb: { size: 0, decay: 0, damping: 0, preDelay: 0, lofi: 0 },
        delay: { time: 0, feedback: 0, filter: 0, spread: 0 },
      },
    }));
  }, []);

  // Batch setter for scene loading
  const setAllFXState = useCallback((state: Partial<FXState>) => {
    if (state.reverbParams !== undefined) setReverbParams(state.reverbParams);
    if (state.delayParams !== undefined) setDelayParams(state.delayParams);
    if (state.masterFilterParams !== undefined) setMasterFilterParams(state.masterFilterParams);
    if (state.sendLevels !== undefined) setSendLevels(state.sendLevels);
    if (state.trackRouting !== undefined) setTrackRouting(state.trackRouting);
    if (state.fxRoutingMode !== undefined) setFxRoutingMode(state.fxRoutingMode);
    if (state.fxTargets !== undefined) setFxTargets(state.fxTargets);
    if (state.fxOffsetsPerTrack !== undefined) setFxOffsetsPerTrack(state.fxOffsetsPerTrack);
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
    fxRoutingMode,
    setFxRoutingMode,
    fxTargets,
    setFxTargets,
    toggleFxTarget,
    fxOffsetsPerTrack,
    setFxOffsetsPerTrack,
    updateReverbParams,
    updateDelayParams,
    updateMasterFilterParams,
    updateSendLevel,
    updateTrackRouting,
    updateFXOffset,
    resetTrackOffsets,
    setAllFXState,
  };
};

export type UseFXStateReturn = ReturnType<typeof useFXState>;
