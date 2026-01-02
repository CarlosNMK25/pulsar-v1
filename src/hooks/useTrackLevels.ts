import { useState, useEffect, useRef } from 'react';
import { audioEngine } from '@/audio/AudioEngine';

export interface TrackLevels {
  drums: number;
  synth: number;
  texture: number;
  sample: number;
}

export function useTrackLevels(isPlaying: boolean): TrackLevels {
  const [levels, setLevels] = useState<TrackLevels>({
    drums: -Infinity,
    synth: -Infinity,
    texture: -Infinity,
    sample: -Infinity,
  });
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    if (!isPlaying) {
      setLevels({
        drums: -Infinity,
        synth: -Infinity,
        texture: -Infinity,
        sample: -Infinity,
      });
      return;
    }

    const update = () => {
      setLevels({
        drums: audioEngine.getTrackPeakLevel('drums'),
        synth: audioEngine.getTrackPeakLevel('synth'),
        texture: audioEngine.getTrackPeakLevel('texture'),
        sample: audioEngine.getTrackPeakLevel('sample'),
      });
      animFrameRef.current = requestAnimationFrame(update);
    };
    update();

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying]);

  return levels;
}
