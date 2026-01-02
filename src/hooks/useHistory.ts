import { useRef, useCallback, useState } from 'react';
import type { DrumState } from './useDrumState';
import type { SynthState } from './useSynthState';
import type { TextureState } from './useTextureState';
import type { FXState } from './useFXState';
import type { ModulationState } from './useModulationState';
import type { GlitchParamsPerTrack } from './useGlitchState';

// Snapshot without heavy data like AudioBuffer
export interface HistorySnapshot {
  timestamp: number;
  drums: DrumState;
  synth: SynthState;
  texture: TextureState;
  fx: FXState;
  sample: {
    sampleSteps: any[];
    sampleParams: any;
    sampleMuted: boolean;
    granularEnabled: boolean;
    granularParams: any;
    customSliceMarkers: number[];
    sliceEnvelope: any;
    crossfadeMs: number;
    crossfadeEnabled: boolean;
  };
  modulation: ModulationState;
  glitch: {
    paramsPerTrack: GlitchParamsPerTrack;
    masterMix: number;
  };
  transport: {
    bpm: number;
    swing: number;
  };
}

interface UseHistoryOptions {
  maxStackSize?: number;
  debounceMs?: number;
}

export const useHistory = (options: UseHistoryOptions = {}) => {
  const { maxStackSize = 50, debounceMs = 300 } = options;
  
  const undoStackRef = useRef<HistorySnapshot[]>([]);
  const redoStackRef = useRef<HistorySnapshot[]>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastPushTimeRef = useRef<number>(0);
  
  // Force re-render when stacks change
  const [, forceUpdate] = useState(0);
  const triggerUpdate = useCallback(() => forceUpdate(n => n + 1), []);

  // Push a new state to the undo stack
  const pushState = useCallback((snapshot: HistorySnapshot, immediate = false) => {
    const now = Date.now();
    
    // Clear any pending debounced push
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    const doPush = () => {
      // Deep clone to avoid reference issues
      const clonedSnapshot = structuredClone(snapshot);
      
      undoStackRef.current.push(clonedSnapshot);
      
      // Limit stack size
      if (undoStackRef.current.length > maxStackSize) {
        undoStackRef.current.shift();
      }
      
      // Clear redo stack on new action
      redoStackRef.current = [];
      lastPushTimeRef.current = now;
      triggerUpdate();
    };
    
    if (immediate) {
      doPush();
    } else {
      // Debounce rapid changes (e.g., knob drags)
      debounceTimerRef.current = setTimeout(doPush, debounceMs);
    }
  }, [maxStackSize, debounceMs, triggerUpdate]);

  // Undo: pop from undo stack, push current state to redo stack
  const undo = useCallback((currentSnapshot: HistorySnapshot): HistorySnapshot | null => {
    if (undoStackRef.current.length === 0) return null;
    
    // Push current state to redo stack
    const clonedCurrent = structuredClone(currentSnapshot);
    redoStackRef.current.push(clonedCurrent);
    
    // Pop from undo stack
    const previousState = undoStackRef.current.pop()!;
    triggerUpdate();
    
    return previousState;
  }, [triggerUpdate]);

  // Redo: pop from redo stack, push current state to undo stack
  const redo = useCallback((currentSnapshot: HistorySnapshot): HistorySnapshot | null => {
    if (redoStackRef.current.length === 0) return null;
    
    // Push current state to undo stack
    const clonedCurrent = structuredClone(currentSnapshot);
    undoStackRef.current.push(clonedCurrent);
    
    // Pop from redo stack
    const nextState = redoStackRef.current.pop()!;
    triggerUpdate();
    
    return nextState;
  }, [triggerUpdate]);

  // Clear all history
  const clearHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    triggerUpdate();
  }, [triggerUpdate]);

  return {
    pushState,
    undo,
    redo,
    clearHistory,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
    undoCount: undoStackRef.current.length,
    redoCount: redoStackRef.current.length,
  };
};

export type UseHistoryReturn = ReturnType<typeof useHistory>;
