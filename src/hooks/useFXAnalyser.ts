import { useState, useEffect, useRef } from 'react';
import { fxEngine } from '@/audio/FXEngine';

interface FXLevels {
  reverb: number;
  delay: number;
  master: number;
  masterLeft: number;
  masterRight: number;
  spectrum: number[];
  peakLeft: number;
  peakRight: number;
}

const SPECTRUM_BANDS = 8;
const PEAK_DECAY = 0.95;

export function useFXAnalyser(isPlaying: boolean): FXLevels {
  const [levels, setLevels] = useState<FXLevels>({
    reverb: 0,
    delay: 0,
    master: 0,
    masterLeft: 0,
    masterRight: 0,
    spectrum: Array(SPECTRUM_BANDS).fill(0),
    peakLeft: 0,
    peakRight: 0,
  });
  
  const frameRef = useRef<number>();
  const peakLeftRef = useRef(0);
  const peakRightRef = useRef(0);
  
  useEffect(() => {
    if (!isPlaying) {
      peakLeftRef.current = 0;
      peakRightRef.current = 0;
      setLevels({
        reverb: 0,
        delay: 0,
        master: 0,
        masterLeft: 0,
        masterRight: 0,
        spectrum: Array(SPECTRUM_BANDS).fill(0),
        peakLeft: 0,
        peakRight: 0,
      });
      return;
    }
    
    const reverbAnalyser = fxEngine.getReverbAnalyser();
    const delayAnalyser = fxEngine.getDelayAnalyser();
    const masterAnalyser = fxEngine.getMasterWetAnalyser();
    
    const reverbData = reverbAnalyser ? new Uint8Array(reverbAnalyser.frequencyBinCount) : null;
    const delayData = delayAnalyser ? new Uint8Array(delayAnalyser.frequencyBinCount) : null;
    const masterData = masterAnalyser ? new Uint8Array(masterAnalyser.frequencyBinCount) : null;
    
    // Band ranges (approximate bin indices for 44.1kHz sample rate, 2048 FFT size)
    const bandRanges = [
      [0, 2],      // Sub: 20-60 Hz
      [2, 8],      // Bass: 60-250 Hz
      [8, 16],     // Low-Mid: 250-500 Hz
      [16, 64],    // Mid: 500-2k Hz
      [64, 128],   // Upper-Mid: 2k-4k Hz
      [128, 192],  // Presence: 4k-6k Hz
      [192, 384],  // Brilliance: 6k-12k Hz
      [384, 512],  // Air: 12k-20k Hz
    ];
    
    const update = () => {
      let reverbLevel = 0;
      let delayLevel = 0;
      let masterLevel = 0;
      let masterLeft = 0;
      let masterRight = 0;
      const spectrum: number[] = [];
      
      if (reverbAnalyser && reverbData) {
        reverbAnalyser.getByteFrequencyData(reverbData);
        reverbLevel = reverbData.reduce((a, b) => a + b, 0) / (reverbData.length * 255);
      }
      
      if (delayAnalyser && delayData) {
        delayAnalyser.getByteFrequencyData(delayData);
        delayLevel = delayData.reduce((a, b) => a + b, 0) / (delayData.length * 255);
      }
      
      if (masterAnalyser && masterData) {
        masterAnalyser.getByteFrequencyData(masterData);
        masterLevel = masterData.reduce((a, b) => a + b, 0) / (masterData.length * 255);
        
        // Simulate stereo by using different frequency ranges
        const leftBins = masterData.slice(0, masterData.length / 2);
        const rightBins = masterData.slice(masterData.length / 2);
        masterLeft = leftBins.reduce((a, b) => a + b, 0) / (leftBins.length * 255);
        masterRight = rightBins.reduce((a, b) => a + b, 0) / (rightBins.length * 255);
        
        // Calculate spectrum bands
        for (const [start, end] of bandRanges) {
          const clampedEnd = Math.min(end, masterData.length);
          const clampedStart = Math.min(start, clampedEnd);
          const bandSlice = masterData.slice(clampedStart, clampedEnd);
          const bandLevel = bandSlice.length > 0 
            ? bandSlice.reduce((a, b) => a + b, 0) / (bandSlice.length * 255)
            : 0;
          spectrum.push(bandLevel);
        }
      } else {
        for (let i = 0; i < SPECTRUM_BANDS; i++) {
          spectrum.push(0);
        }
      }
      
      // Peak hold with decay
      peakLeftRef.current = Math.max(masterLeft, peakLeftRef.current * PEAK_DECAY);
      peakRightRef.current = Math.max(masterRight, peakRightRef.current * PEAK_DECAY);
      
      setLevels({
        reverb: reverbLevel,
        delay: delayLevel,
        master: masterLevel,
        masterLeft,
        masterRight,
        spectrum,
        peakLeft: peakLeftRef.current,
        peakRight: peakRightRef.current,
      });
      
      frameRef.current = requestAnimationFrame(update);
    };
    
    update();
    
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [isPlaying]);
  
  return levels;
}
