import { useState, useCallback } from 'react';
import { 
  ChorusParams, 
  FlangerParams, 
  PhaserParams, 
  TremoloParams, 
  RingModParams, 
  AutoPanParams,
  ModEffect,
  defaultModulationParams,
} from '@/audio/ModulationEngine';

export type ModRoutingMode = 'master' | 'individual';
export type ModTarget = 'drums' | 'synth' | 'texture' | 'sample';

export interface ModulationState {
  chorus: ChorusParams;
  flanger: FlangerParams;
  phaser: PhaserParams;
  tremolo: TremoloParams;
  ringMod: RingModParams;
  autoPan: AutoPanParams;
  bypassed: Record<ModEffect, boolean>;
  routingMode: ModRoutingMode;
  targets: ModTarget[];
}

const defaultBypassed: Record<ModEffect, boolean> = {
  chorus: true,
  flanger: true,
  phaser: true,
  tremolo: true,
  ringMod: true,
  autoPan: true,
};

export const useModulationState = () => {
  const [chorus, setChorus] = useState<ChorusParams>(defaultModulationParams.chorus);
  const [flanger, setFlanger] = useState<FlangerParams>(defaultModulationParams.flanger);
  const [phaser, setPhaser] = useState<PhaserParams>(defaultModulationParams.phaser);
  const [tremolo, setTremolo] = useState<TremoloParams>(defaultModulationParams.tremolo);
  const [ringMod, setRingMod] = useState<RingModParams>(defaultModulationParams.ringMod);
  const [autoPan, setAutoPan] = useState<AutoPanParams>(defaultModulationParams.autoPan);
  const [bypassed, setBypassed] = useState<Record<ModEffect, boolean>>(defaultBypassed);
  const [routingMode, setRoutingMode] = useState<ModRoutingMode>('master');
  const [targets, setTargets] = useState<ModTarget[]>([]);

  const updateChorusParams = useCallback((params: Partial<ChorusParams>) => {
    setChorus(prev => ({ ...prev, ...params }));
  }, []);

  const updateFlangerParams = useCallback((params: Partial<FlangerParams>) => {
    setFlanger(prev => ({ ...prev, ...params }));
  }, []);

  const updatePhaserParams = useCallback((params: Partial<PhaserParams>) => {
    setPhaser(prev => ({ ...prev, ...params }));
  }, []);

  const updateTremoloParams = useCallback((params: Partial<TremoloParams>) => {
    setTremolo(prev => ({ ...prev, ...params }));
  }, []);

  const updateRingModParams = useCallback((params: Partial<RingModParams>) => {
    setRingMod(prev => ({ ...prev, ...params }));
  }, []);

  const updateAutoPanParams = useCallback((params: Partial<AutoPanParams>) => {
    setAutoPan(prev => ({ ...prev, ...params }));
  }, []);

  const toggleBypass = useCallback((effect: ModEffect) => {
    setBypassed(prev => ({ ...prev, [effect]: !prev[effect] }));
  }, []);

  const setEffectBypassed = useCallback((effect: ModEffect, value: boolean) => {
    setBypassed(prev => ({ ...prev, [effect]: value }));
  }, []);

  const toggleTarget = useCallback((target: ModTarget) => {
    setTargets(prev => {
      if (prev.includes(target)) {
        return prev.filter(t => t !== target);
      }
      return [...prev, target];
    });
  }, []);

  // Batch setter for scene loading
  const setAllModulationState = useCallback((state: Partial<ModulationState>) => {
    if (state.chorus !== undefined) setChorus(state.chorus);
    if (state.flanger !== undefined) setFlanger(state.flanger);
    if (state.phaser !== undefined) setPhaser(state.phaser);
    if (state.tremolo !== undefined) setTremolo(state.tremolo);
    if (state.ringMod !== undefined) setRingMod(state.ringMod);
    if (state.autoPan !== undefined) setAutoPan(state.autoPan);
    if (state.bypassed !== undefined) setBypassed(state.bypassed);
    if (state.routingMode !== undefined) setRoutingMode(state.routingMode);
    if (state.targets !== undefined) setTargets(state.targets);
  }, []);

  return {
    // Params
    chorus,
    flanger,
    phaser,
    tremolo,
    ringMod,
    autoPan,
    bypassed,
    routingMode,
    targets,
    // Setters
    setChorus,
    setFlanger,
    setPhaser,
    setTremolo,
    setRingMod,
    setAutoPan,
    setBypassed,
    setRoutingMode,
    setTargets,
    // Updaters
    updateChorusParams,
    updateFlangerParams,
    updatePhaserParams,
    updateTremoloParams,
    updateRingModParams,
    updateAutoPanParams,
    toggleBypass,
    setEffectBypassed,
    toggleTarget,
    setAllModulationState,
  };
};

export type UseModulationStateReturn = ReturnType<typeof useModulationState>;
