import { useState, useCallback, useRef, useEffect } from 'react';
import { SampleParams, PlaybackMode, SampleSyncMode } from '@/audio/SampleEngine';
import { GranularParams } from '@/audio/GranularEngine';

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

// ADSR Envelope for slices
export interface SliceEnvelope {
  attack: number;   // 0-500ms
  decay: number;    // 0-500ms
  sustain: number;  // 0-1
  release: number;  // 0-1000ms
}

export interface SampleState {
  sampleBuffer: AudioBuffer | null;
  sampleName: string;
  sampleMuted: boolean;
  sampleParams: SampleParams;
  sampleSteps: SampleStep[];
  sliceProgress: number; // 0-1 progress within active slice
  // Granular synthesis state
  granularEnabled: boolean;
  granularParams: GranularParams;
  // Custom slice markers (from transient detection)
  customSliceMarkers: number[] | null;
  // Slice envelope
  sliceEnvelope: SliceEnvelope;
  // Crossfade between slices
  crossfadeMs: number;
  crossfadeEnabled: boolean;
}

export const defaultGranularParams: GranularParams = {
  grainSize: 100,
  grainDensity: 10,
  pitchScatter: 0,
  positionScatter: 0,
  timeStretch: 1.0,
  pitchShift: 0,
  windowType: 'hann',
};

export const defaultSliceEnvelope: SliceEnvelope = {
  attack: 5,
  decay: 50,
  sustain: 0.8,
  release: 100,
};

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
  const [sliceProgress, setSliceProgress] = useState<number>(0);
  
  // Granular synthesis state
  const [granularEnabled, setGranularEnabled] = useState(false);
  const [granularParams, setGranularParams] = useState<GranularParams>(defaultGranularParams);
  
  // Custom slice markers (from transient detection)
  const [customSliceMarkers, setCustomSliceMarkers] = useState<number[] | null>(null);
  
  // Slice envelope
  const [sliceEnvelope, setSliceEnvelope] = useState<SliceEnvelope>(defaultSliceEnvelope);
  
  // Crossfade between slices
  const [crossfadeMs, setCrossfadeMs] = useState<number>(10);
  const [crossfadeEnabled, setCrossfadeEnabled] = useState<boolean>(true);
  
  // Animation refs for slice progress
  const sliceAnimationRef = useRef<number | null>(null);
  const sliceStartTimeRef = useRef<number>(0);
  const sliceDurationRef = useRef<number>(0);
  
  // Start slice progress animation
  const startSliceProgress = useCallback((durationMs: number) => {
    // Cancel any existing animation
    if (sliceAnimationRef.current) {
      cancelAnimationFrame(sliceAnimationRef.current);
    }
    
    sliceStartTimeRef.current = performance.now();
    sliceDurationRef.current = durationMs;
    setSliceProgress(0);
    
    const animate = () => {
      const elapsed = performance.now() - sliceStartTimeRef.current;
      const progress = Math.min(elapsed / sliceDurationRef.current, 1);
      setSliceProgress(progress);
      
      if (progress < 1) {
        sliceAnimationRef.current = requestAnimationFrame(animate);
      } else {
        sliceAnimationRef.current = null;
      }
    };
    
    sliceAnimationRef.current = requestAnimationFrame(animate);
  }, []);
  
  // Stop slice progress animation
  const stopSliceProgress = useCallback(() => {
    if (sliceAnimationRef.current) {
      cancelAnimationFrame(sliceAnimationRef.current);
      sliceAnimationRef.current = null;
    }
    setSliceProgress(0);
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sliceAnimationRef.current) {
        cancelAnimationFrame(sliceAnimationRef.current);
      }
    };
  }, []);

  const toggleSampleMute = useCallback(() => {
    setSampleMuted(prev => !prev);
  }, []);

  const clearSample = useCallback(() => {
    setSampleBuffer(null);
    setSampleName('');
    setCustomSliceMarkers(null);
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
    if (state.granularEnabled !== undefined) setGranularEnabled(state.granularEnabled);
    if (state.granularParams !== undefined) setGranularParams(state.granularParams);
    if (state.customSliceMarkers !== undefined) setCustomSliceMarkers(state.customSliceMarkers);
    if (state.sliceEnvelope !== undefined) setSliceEnvelope(state.sliceEnvelope);
    if (state.crossfadeMs !== undefined) setCrossfadeMs(state.crossfadeMs);
    if (state.crossfadeEnabled !== undefined) setCrossfadeEnabled(state.crossfadeEnabled);
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
    sliceProgress,
    startSliceProgress,
    stopSliceProgress,
    toggleSampleMute,
    clearSample,
    toggleSampleStep,
    setSampleStepVelocity,
    setSamplePatternLength,
    setSampleStepSlice,
    setSampleStepPLocks,
    setAllSampleState,
    // Granular state
    granularEnabled,
    setGranularEnabled,
    granularParams,
    setGranularParams,
    // Custom slices
    customSliceMarkers,
    setCustomSliceMarkers,
    // Slice envelope
    sliceEnvelope,
    setSliceEnvelope,
    // Crossfade
    crossfadeMs,
    setCrossfadeMs,
    crossfadeEnabled,
    setCrossfadeEnabled,
  };
};

export type UseSampleStateReturn = ReturnType<typeof useSampleState>;
