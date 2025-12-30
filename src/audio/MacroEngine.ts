// Macro parameter mapping engine
import { audioEngine } from './AudioEngine';
import { fxEngine } from './FXEngine';
import { sceneEngine } from './SceneEngine';

type CurveType = 'linear' | 'exponential' | 'logarithmic';

interface MacroTarget {
  engineId: 'synth' | 'drums' | 'texture' | 'fx' | 'master';
  paramId: string;
  min: number;
  max: number;
  curve: CurveType;
}

interface MacroDefinition {
  id: string;
  name: string;
  targets: MacroTarget[];
}

type ParamUpdateCallback = (engineId: string, paramId: string, value: number) => void;
type MorphMacroCallback = (amount: number) => void;

export class MacroEngine {
  private static instance: MacroEngine;
  
  private macroValues: Map<string, number> = new Map();
  private paramUpdateCallback: ParamUpdateCallback | null = null;
  private morphMacroCallback: MorphMacroCallback | null = null;
  private activeScene: string = 'a';
  
  // Predefined macro mappings
  private macroDefinitions: Map<string, MacroDefinition> = new Map([
    ['m1', {
      id: 'm1',
      name: 'Filter',
      targets: [
        { engineId: 'synth', paramId: 'cutoff', min: 10, max: 100, curve: 'exponential' },
        { engineId: 'texture', paramId: 'pitch', min: 20, max: 80, curve: 'linear' },
      ]
    }],
    ['m2', {
      id: 'm2',
      name: 'Decay',
      targets: [
        { engineId: 'synth', paramId: 'release', min: 10, max: 90, curve: 'linear' },
        { engineId: 'drums', paramId: 'decay', min: 20, max: 100, curve: 'linear' },
      ]
    }],
    ['m3', {
      id: 'm3',
      name: 'Space',
      targets: [
        { engineId: 'fx', paramId: 'reverb.mix', min: 0, max: 100, curve: 'linear' },
        { engineId: 'fx', paramId: 'delay.mix', min: 0, max: 60, curve: 'linear' },
      ]
    }],
    ['m4', {
      id: 'm4',
      name: 'Chaos',
      targets: [
        { engineId: 'synth', paramId: 'detune', min: 0, max: 100, curve: 'exponential' },
        { engineId: 'texture', paramId: 'spread', min: 20, max: 100, curve: 'linear' },
        { engineId: 'fx', paramId: 'delay.feedback', min: 0, max: 85, curve: 'exponential' },
      ]
    }],
    ['m5', {
      id: 'm5',
      name: 'Drive',
      targets: [
        { engineId: 'texture', paramId: 'density', min: 30, max: 100, curve: 'exponential' },
        { engineId: 'synth', paramId: 'resonance', min: 20, max: 80, curve: 'linear' },
      ]
    }],
    ['m6', {
      id: 'm6',
      name: 'LFO',
      targets: [
        { engineId: 'texture', paramId: 'size', min: 10, max: 100, curve: 'linear' },
      ]
    }],
    ['m7', {
      id: 'm7',
      name: 'Morph',
      targets: [
        // Scene morphing - handled separately
      ]
    }],
    ['m8', {
      id: 'm8',
      name: 'Master',
      targets: [
        { engineId: 'master', paramId: 'volume', min: 0, max: 100, curve: 'logarithmic' },
      ]
    }],
  ]);

  private constructor() {
    // Initialize all macros to 50%
    this.macroDefinitions.forEach((_, id) => {
      this.macroValues.set(id, 50);
    });
  }

  static getInstance(): MacroEngine {
    if (!MacroEngine.instance) {
      MacroEngine.instance = new MacroEngine();
    }
    return MacroEngine.instance;
  }

  // Set callback for parameter updates (called by useAudioEngine)
  setParamUpdateCallback(callback: ParamUpdateCallback): void {
    this.paramUpdateCallback = callback;
  }

  // Set callback for morph macro (called by Index.tsx)
  setMorphMacroCallback(callback: MorphMacroCallback): void {
    this.morphMacroCallback = callback;
  }

  // Set active scene (called when scene changes)
  setActiveScene(sceneId: string): void {
    this.activeScene = sceneId;
  }

  getActiveScene(): string {
    return this.activeScene;
  }

  // Apply curve transformation
  private applyCurve(value: number, curve: CurveType): number {
    const normalized = value / 100;
    
    switch (curve) {
      case 'exponential':
        return Math.pow(normalized, 2) * 100;
      case 'logarithmic':
        return Math.sqrt(normalized) * 100;
      case 'linear':
      default:
        return value;
    }
  }

  // Map macro value to target range
  private mapToRange(value: number, min: number, max: number, curve: CurveType): number {
    const curved = this.applyCurve(value, curve);
    return min + (curved / 100) * (max - min);
  }

  // Update a macro value and propagate to all targets
  setMacroValue(macroId: string, value: number): void {
    const clampedValue = Math.max(0, Math.min(100, value));
    this.macroValues.set(macroId, clampedValue);
    
    // Special handling for M7 Morph
    if (macroId === 'm7') {
      this.handleMorphMacro(clampedValue);
      return;
    }
    
    const definition = this.macroDefinitions.get(macroId);
    if (!definition) return;
    
    // Apply to all targets
    definition.targets.forEach(target => {
      const mappedValue = this.mapToRange(clampedValue, target.min, target.max, target.curve);
      
      // Handle FX engine directly
      if (target.engineId === 'fx') {
        this.applyFXParam(target.paramId, mappedValue);
      } else if (target.engineId === 'master') {
        this.applyMasterParam(target.paramId, mappedValue);
      } else if (this.paramUpdateCallback) {
        // Delegate to callback for synth/drums/texture
        this.paramUpdateCallback(target.engineId, target.paramId, mappedValue);
      }
    });
  }

  // Handle M7 Morph macro - interpolates between active scene and target scene
  private handleMorphMacro(value: number): void {
    const amount = value / 100; // 0-1 range
    
    // Trigger morph through SceneEngine
    sceneEngine.triggerMorph(amount, this.activeScene);
    
    // Also call the morph callback if set
    if (this.morphMacroCallback) {
      this.morphMacroCallback(amount);
    }
  }

  private applyFXParam(paramId: string, value: number): void {
    const [fxType, param] = paramId.split('.');
    
    if (fxType === 'reverb') {
      fxEngine.setReverbParams({ [param]: value / 100 });
    } else if (fxType === 'delay') {
      fxEngine.setDelayParams({ [param]: value / 100 });
    }
  }

  private applyMasterParam(paramId: string, value: number): void {
    if (paramId === 'volume') {
      audioEngine.setMasterVolume(value / 100);
    }
  }

  getMacroValue(macroId: string): number {
    return this.macroValues.get(macroId) ?? 50;
  }

  getMacroDefinition(macroId: string): MacroDefinition | undefined {
    return this.macroDefinitions.get(macroId);
  }

  getAllMacroDefinitions(): MacroDefinition[] {
    return Array.from(this.macroDefinitions.values());
  }

  // Get current targets for a macro (useful for UI feedback)
  getMacroTargets(macroId: string): string[] {
    const definition = this.macroDefinitions.get(macroId);
    if (!definition) return [];
    return definition.targets.map(t => `${t.engineId}.${t.paramId}`);
  }
}

export const macroEngine = MacroEngine.getInstance();
