import { useState, useEffect, useRef } from 'react';
import { fxEngine } from '@/audio/FXEngine';

interface FXLevels {
  reverb: number;
  delay: number;
  master: number;
}

export function useFXAnalyser(isPlaying: boolean): FXLevels {
  const [levels, setLevels] = useState<FXLevels>({
    reverb: 0,
    delay: 0,
    master: 0,
  });
  
  const frameRef = useRef<number>();
  
  useEffect(() => {
    if (!isPlaying) {
      setLevels({ reverb: 0, delay: 0, master: 0 });
      return;
    }
    
    const reverbAnalyser = fxEngine.getReverbAnalyser();
    const delayAnalyser = fxEngine.getDelayAnalyser();
    const masterAnalyser = fxEngine.getMasterWetAnalyser();
    
    const reverbData = reverbAnalyser ? new Uint8Array(reverbAnalyser.frequencyBinCount) : null;
    const delayData = delayAnalyser ? new Uint8Array(delayAnalyser.frequencyBinCount) : null;
    const masterData = masterAnalyser ? new Uint8Array(masterAnalyser.frequencyBinCount) : null;
    
    const update = () => {
      let reverbLevel = 0;
      let delayLevel = 0;
      let masterLevel = 0;
      
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
      }
      
      setLevels({
        reverb: reverbLevel,
        delay: delayLevel,
        master: masterLevel,
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
