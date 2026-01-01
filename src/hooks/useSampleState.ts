import { useState, useCallback } from 'react';
import { SampleParams, PlaybackMode, SampleSyncMode } from '@/audio/SampleEngine';

// P-Locks for sample steps (micro-timing, pitch, volume, reverse, ratchet)
export interface SamplePLocks {
  microTiming?: number; // -50 to +50 ms offset
  pitch?: number;       // Pitch override per step
  volume?: number;      // Volume override per step
  reverse?: boolean;    // Reverse playback per step
  ratchet?: number;     // 1=normal, 2=double, 3=triple, 4=quad retrig
}

// Step type for sample sequencer
export interface SampleStep {
  active: boolean;
  velocity: number;
  probability: number;
  sliceIndex: number; // Which slice this step triggers (-1 = sequential)
  pLocks?: SamplePLocks;
}

export interface SampleState {
  sampleBuffer: AudioBuffer | null;
  sampleName: string;
  sampleMuted: boolean;
  sampleParams: SampleParams;
  sampleSteps: SampleStep[];
}

export const defaultSampleParams: SampleParams = {
  pitch: 1.0,
  startPoint: 0,
  loopLength: 1,
  reverse: false,
  volume: 0.75,
  loop: true,
  playbackMode: 'region',
  sliceCount: 8,
  syncMode: 'independent',
};

const createDefaultSteps = (length: number): SampleStep[] =>
  Array(length).fill(null).map((_, i) => ({ 
    active: false, 
    velocity: 100, 
    probability: 100,
    sliceIndex: -1, // -1 means sequential (step 0 -> slice 0, step 1 -> slice 1, etc.)
    pLocks: undefined,
  }));

export const useSampleState = () => {
  const [sampleBuffer, setSampleBuffer] = useState<AudioBuffer | null>(null);
  const [sampleName, setSampleName] = useState<string>('');
  const [sampleMuted, setSampleMuted] = useState(false);
  const [sampleParams, setSampleParams] = useState<SampleParams>(defaultSampleParams);
  const [sampleSteps, setSampleSteps] = useState<SampleStep[]>(createDefaultSteps(16));

  const toggleSampleMute = useCallback(() => {
    setSampleMuted(prev => !prev);
  }, []);

  const clearSample = useCallback(() => {
    setSampleBuffer(null);
    setSampleName('');
  }, []);

  // Step manipulation functions
  const toggleSampleStep = useCallback((index: number) => {
    setSampleSteps(prev => prev.map((step, i) =>
      i === index ? { ...step, active: !step.active } : step
    ));
  }, []);

  const setSampleStepVelocity = useCallback((index: number, velocity: number) => {
    setSampleSteps(prev => prev.map((step, i) =>
      i === index ? { ...step, velocity } : step
    ));
  }, []);

  const setSamplePatternLength = useCallback((length: number) => {
    setSampleSteps(prev => {
      if (length > prev.length) {
        return [...prev, ...createDefaultSteps(length - prev.length)];
      }
      return prev.slice(0, length);
    });
  }, []);

  // Set slice index for a specific step
  const setSampleStepSlice = useCallback((index: number, sliceIndex: number) => {
    setSampleSteps(prev => prev.map((step, i) =>
      i === index ? { ...step, sliceIndex } : step
    ));
  }, []);

  // Set P-Locks for a specific step
  const setSampleStepPLocks = useCallback((index: number, pLocks: SamplePLocks | undefined) => {
    setSampleSteps(prev => prev.map((step, i) =>
      i === index ? { ...step, pLocks } : step
    ));
  }, []);

  // Batch setter for scene loading
  const setAllSampleState = useCallback((state: Partial<SampleState>) => {
    if (state.sampleBuffer !== undefined) setSampleBuffer(state.sampleBuffer);
    if (state.sampleName !== undefined) setSampleName(state.sampleName);
    if (state.sampleMuted !== undefined) setSampleMuted(state.sampleMuted);
    if (state.sampleParams !== undefined) setSampleParams(state.sampleParams);
    if (state.sampleSteps !== undefined) setSampleSteps(state.sampleSteps);
  }, []);

  return {
    sampleBuffer,
    setSampleBuffer,
    sampleName,
    setSampleName,
    sampleMuted,
    setSampleMuted,
    sampleParams,
    setSampleParams,
    sampleSteps,
    setSampleSteps,
    toggleSampleMute,
    clearSample,
    toggleSampleStep,
    setSampleStepVelocity,
    setSamplePatternLength,
    setSampleStepSlice,
    setSampleStepPLocks,
    setAllSampleState,
  };
};

export type UseSampleStateReturn = ReturnType<typeof useSampleState>;
