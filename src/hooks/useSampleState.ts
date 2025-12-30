import { useState, useCallback } from 'react';
import { SampleParams } from '@/audio/SampleEngine';

export interface SampleState {
  sampleBuffer: AudioBuffer | null;
  sampleName: string;
  sampleMuted: boolean;
  sampleParams: SampleParams;
}

export const defaultSampleParams: SampleParams = {
  pitch: 1.0,
  startPoint: 0,
  loopLength: 1,
  reverse: false,
  volume: 0.75,
  loop: true,
};

export const useSampleState = () => {
  const [sampleBuffer, setSampleBuffer] = useState<AudioBuffer | null>(null);
  const [sampleName, setSampleName] = useState<string>('');
  const [sampleMuted, setSampleMuted] = useState(false);
  const [sampleParams, setSampleParams] = useState<SampleParams>(defaultSampleParams);

  const toggleSampleMute = useCallback(() => {
    setSampleMuted(prev => !prev);
  }, []);

  const clearSample = useCallback(() => {
    setSampleBuffer(null);
    setSampleName('');
  }, []);

  // Batch setter for scene loading
  const setAllSampleState = useCallback((state: Partial<SampleState>) => {
    if (state.sampleBuffer !== undefined) setSampleBuffer(state.sampleBuffer);
    if (state.sampleName !== undefined) setSampleName(state.sampleName);
    if (state.sampleMuted !== undefined) setSampleMuted(state.sampleMuted);
    if (state.sampleParams !== undefined) setSampleParams(state.sampleParams);
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
    toggleSampleMute,
    clearSample,
    setAllSampleState,
  };
};

export type UseSampleStateReturn = ReturnType<typeof useSampleState>;
