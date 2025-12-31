import { useState, useEffect, useCallback, useRef } from 'react';
import { scheduler } from '@/audio/Scheduler';

export interface PatternChainConfig {
  chain: string[];           // Array of scene IDs ['a', 'b', 'a', 'c']
  barsPerPattern: number;    // Bars before advancing (1-16)
  loopChain: boolean;        // Repeat when finished
  enabled: boolean;          // Chain active/inactive
}

interface UsePatternChainProps {
  onSceneChange: (sceneId: string) => void;
  isPlaying: boolean;
  activeScene: string;
  savedSceneIds: string[];
}

export const usePatternChain = ({
  onSceneChange,
  isPlaying,
  activeScene,
  savedSceneIds,
}: UsePatternChainProps) => {
  const [config, setConfig] = useState<PatternChainConfig>({
    chain: [],
    barsPerPattern: 4,
    loopChain: true,
    enabled: false,
  });
  
  const [currentChainIndex, setCurrentChainIndex] = useState(0);
  const lastBarRef = useRef(-1);

  // Reset chain index when chain changes or is disabled
  useEffect(() => {
    if (!config.enabled) {
      setCurrentChainIndex(0);
      lastBarRef.current = -1;
    }
  }, [config.enabled]);

  // Listen to bar callbacks from scheduler
  useEffect(() => {
    if (!config.enabled || !isPlaying || config.chain.length === 0) return;

    const unsubscribe = scheduler.onBar((bar) => {
      // Only advance on new bars we haven't processed
      if (bar === lastBarRef.current) return;
      lastBarRef.current = bar;

      // Check if we should advance (every N bars)
      if (bar > 0 && bar % config.barsPerPattern === 0) {
        setCurrentChainIndex(prevIndex => {
          const nextIndex = prevIndex + 1;
          
          // Check if we've reached the end
          if (nextIndex >= config.chain.length) {
            if (config.loopChain) {
              // Loop back to start
              const loopedIndex = 0;
              const nextSceneId = config.chain[loopedIndex];
              if (nextSceneId) {
                onSceneChange(nextSceneId);
              }
              return loopedIndex;
            } else {
              // Stop chaining
              setConfig(prev => ({ ...prev, enabled: false }));
              return prevIndex;
            }
          }
          
          // Advance to next pattern
          const nextSceneId = config.chain[nextIndex];
          if (nextSceneId) {
            onSceneChange(nextSceneId);
          }
          return nextIndex;
        });
      }
    });

    return unsubscribe;
  }, [config.enabled, config.barsPerPattern, config.loopChain, config.chain, isPlaying, onSceneChange]);

  // Sync chain index when scene is manually changed
  useEffect(() => {
    if (!config.enabled) return;
    
    const sceneIndex = config.chain.findIndex(id => id === activeScene);
    if (sceneIndex !== -1 && sceneIndex !== currentChainIndex) {
      setCurrentChainIndex(sceneIndex);
    }
  }, [activeScene, config.chain, config.enabled, currentChainIndex]);

  const setChain = useCallback((chain: string[]) => {
    setConfig(prev => ({ ...prev, chain }));
    setCurrentChainIndex(0);
  }, []);

  const addToChain = useCallback((sceneId: string) => {
    setConfig(prev => ({ ...prev, chain: [...prev.chain, sceneId] }));
  }, []);

  const removeFromChain = useCallback((index: number) => {
    setConfig(prev => ({
      ...prev,
      chain: prev.chain.filter((_, i) => i !== index),
    }));
    // Adjust current index if needed
    setCurrentChainIndex(prev => {
      if (index < prev) return prev - 1;
      if (index === prev && prev >= config.chain.length - 1) return Math.max(0, prev - 1);
      return prev;
    });
  }, [config.chain.length]);

  const reorderChain = useCallback((from: number, to: number) => {
    setConfig(prev => {
      const newChain = [...prev.chain];
      const [removed] = newChain.splice(from, 1);
      newChain.splice(to, 0, removed);
      return { ...prev, chain: newChain };
    });
  }, []);

  const setBarsPerPattern = useCallback((bars: number) => {
    setConfig(prev => ({ ...prev, barsPerPattern: Math.max(1, Math.min(16, bars)) }));
  }, []);

  const setLoopChain = useCallback((loop: boolean) => {
    setConfig(prev => ({ ...prev, loopChain: loop }));
  }, []);

  const toggleChainEnabled = useCallback(() => {
    setConfig(prev => {
      const newEnabled = !prev.enabled;
      if (newEnabled && prev.chain.length === 0) {
        // Can't enable empty chain
        return prev;
      }
      return { ...prev, enabled: newEnabled };
    });
    lastBarRef.current = -1;
  }, []);

  const clearChain = useCallback(() => {
    setConfig(prev => ({ ...prev, chain: [], enabled: false }));
    setCurrentChainIndex(0);
  }, []);

  // Get available scenes (only saved ones can be chained)
  const availableScenes = savedSceneIds;

  return {
    config,
    currentChainIndex,
    isChainActive: config.enabled && isPlaying,
    availableScenes,
    // Actions
    setChain,
    addToChain,
    removeFromChain,
    reorderChain,
    setBarsPerPattern,
    setLoopChain,
    toggleChainEnabled,
    clearChain,
  };
};

export type UsePatternChainReturn = ReturnType<typeof usePatternChain>;
