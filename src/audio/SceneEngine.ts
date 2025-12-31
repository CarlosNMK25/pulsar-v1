// Scene System Engine - Manages save/load/morph between scenes
import { WaveformType, LfoSyncDivision } from './SynthVoice';
import { TextureMode } from './TextureEngine';
import { DistortionCurve } from './WaveshaperEngine';
import { factoryPresets, FactoryPresetName } from './factoryPresets';
import type { TrackSendLevels } from '@/hooks/useFXState';

export interface Step {
  active: boolean;
  velocity: number;
  probability: number;
}

export interface DrumParams {
  pitch: number;
  decay: number;
  drive: number;
  driveType: DistortionCurve;
  mix: number;
}

export interface SynthParams {
  waveform: WaveformType;
  cutoff: number;
  resonance: number;
  attack: number;
  release: number;
  detune: number;
  lfoRate: number;
  lfoSyncDivision: LfoSyncDivision;
  fmAmount: number;
  fmRatio: number;
  drive: number;
  driveType: DistortionCurve;
}

export interface TextureParams {
  density: number;
  spread: number;
  pitch: number;
  size: number;
  feedback: number;
  mix: number;
}

export type SyncDivision = '1/4' | '1/8' | '1/16' | '3/16';

export interface ReverbParams {
  size: number;
  decay: number;
  damping: number;
  preDelay: number;
  lofi: number;
  mix: number;
}

export interface DelayParams {
  time: number;
  feedback: number;
  filter: number;
  spread: number;
  mix: number;
  syncDivision: SyncDivision;
}

export interface MasterFilterParams {
  lowpass: number;
  highpass: number;
}

export interface SceneData {
  id: string;
  name: string;
  saved: boolean;
  
  // Drum module
  drumSteps: {
    kick: Step[];
    snare: Step[];
    hat: Step[];
  };
  drumParams: DrumParams;
  drumMuted: boolean;
  
  // Synth module
  synthSteps: Step[];
  synthParams: SynthParams;
  synthMuted: boolean;
  
  // Texture module
  textureMode: TextureMode;
  textureParams: TextureParams;
  textureMuted: boolean;
  
  // FX module
  reverbParams: ReverbParams;
  delayParams: DelayParams;
  masterFilterParams: MasterFilterParams;
  sendLevels?: TrackSendLevels;  // Optional for backward compatibility
  
  // Global
  bpm: number;
  swing: number;
}

// Interpolated params (all numeric values that can be smoothly transitioned)
export interface InterpolatedParams {
  drumParams: Omit<DrumParams, 'driveType'> & { driveType: DistortionCurve };
  synthParams: Omit<SynthParams, 'waveform' | 'lfoSyncDivision' | 'driveType'> & { driveType: DistortionCurve };
  textureParams: TextureParams;
  reverbParams: ReverbParams;
  delayParams: Omit<DelayParams, 'syncDivision'>;
  masterFilterParams: MasterFilterParams;
  bpm: number;
  swing: number;
}

type MorphCallback = (amount: number, fromScene: string, toScene: string) => void;

class SceneEngine {
  private static instance: SceneEngine;
  private scenes: Map<string, SceneData> = new Map();
  private morphCallback: MorphCallback | null = null;
  private morphTargetScene: string | null = null;
  private clipboard: SceneData | null = null;
  
  private constructor() {}
  
  static getInstance(): SceneEngine {
    if (!SceneEngine.instance) {
      SceneEngine.instance = new SceneEngine();
    }
    return SceneEngine.instance;
  }
  
  // Set the morph callback (called from Index.tsx)
  setMorphCallback(callback: MorphCallback): void {
    this.morphCallback = callback;
  }
  
  setMorphTarget(sceneId: string | null): void {
    this.morphTargetScene = sceneId;
  }
  
  getMorphTarget(): string | null {
    return this.morphTargetScene;
  }
  
  // Save current state to a scene
  saveScene(sceneId: string, data: Omit<SceneData, 'id' | 'saved'>): void {
    this.scenes.set(sceneId, {
      ...data,
      id: sceneId,
      saved: true,
    });
    this.saveToLocalStorage();
  }
  
  // Load scene data
  loadScene(sceneId: string): SceneData | undefined {
    return this.scenes.get(sceneId);
  }
  
  // Check if scene has saved data
  isSceneSaved(sceneId: string): boolean {
    return this.scenes.get(sceneId)?.saved ?? false;
  }
  
  // Get all scene IDs that have saved data
  getSavedSceneIds(): string[] {
    return Array.from(this.scenes.entries())
      .filter(([_, data]) => data.saved)
      .map(([id]) => id);
  }
  
  // Get scene name
  getSceneName(sceneId: string): string | undefined {
    return this.scenes.get(sceneId)?.name;
  }
  
  // Rename scene
  renameScene(sceneId: string, newName: string): void {
    const scene = this.scenes.get(sceneId);
    if (scene) {
      scene.name = newName;
      this.scenes.set(sceneId, scene);
      this.saveToLocalStorage();
    }
  }
  
  // Linear interpolation helper
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
  
  // Interpolate all numeric parameters between two scenes
  interpolateParams(from: SceneData, to: SceneData, progress: number): InterpolatedParams {
    const t = progress;
    
    return {
      drumParams: {
        pitch: this.lerp(from.drumParams.pitch, to.drumParams.pitch, t),
        decay: this.lerp(from.drumParams.decay, to.drumParams.decay, t),
        drive: this.lerp(from.drumParams.drive, to.drumParams.drive, t),
        driveType: t < 0.5 ? from.drumParams.driveType : to.drumParams.driveType,
        mix: this.lerp(from.drumParams.mix, to.drumParams.mix, t),
      },
      synthParams: {
        cutoff: this.lerp(from.synthParams.cutoff, to.synthParams.cutoff, t),
        resonance: this.lerp(from.synthParams.resonance, to.synthParams.resonance, t),
        attack: this.lerp(from.synthParams.attack, to.synthParams.attack, t),
        release: this.lerp(from.synthParams.release, to.synthParams.release, t),
        detune: this.lerp(from.synthParams.detune, to.synthParams.detune, t),
        lfoRate: this.lerp(from.synthParams.lfoRate, to.synthParams.lfoRate, t),
        fmAmount: this.lerp(from.synthParams.fmAmount ?? 0, to.synthParams.fmAmount ?? 0, t),
        fmRatio: this.lerp(from.synthParams.fmRatio ?? 50, to.synthParams.fmRatio ?? 50, t),
        drive: this.lerp(from.synthParams.drive ?? 0, to.synthParams.drive ?? 0, t),
        driveType: t < 0.5 ? (from.synthParams.driveType ?? 'soft') : (to.synthParams.driveType ?? 'soft'),
      },
      textureParams: {
        density: this.lerp(from.textureParams.density, to.textureParams.density, t),
        spread: this.lerp(from.textureParams.spread, to.textureParams.spread, t),
        pitch: this.lerp(from.textureParams.pitch, to.textureParams.pitch, t),
        size: this.lerp(from.textureParams.size, to.textureParams.size, t),
        feedback: this.lerp(from.textureParams.feedback, to.textureParams.feedback, t),
        mix: this.lerp(from.textureParams.mix, to.textureParams.mix, t),
      },
      reverbParams: {
        size: this.lerp(from.reverbParams.size, to.reverbParams.size, t),
        decay: this.lerp(from.reverbParams.decay, to.reverbParams.decay, t),
        damping: this.lerp(from.reverbParams.damping, to.reverbParams.damping, t),
        preDelay: this.lerp(from.reverbParams.preDelay ?? 0.1, to.reverbParams.preDelay ?? 0.1, t),
        lofi: this.lerp(from.reverbParams.lofi ?? 0, to.reverbParams.lofi ?? 0, t),
        mix: this.lerp(from.reverbParams.mix, to.reverbParams.mix, t),
      },
      delayParams: {
        time: this.lerp(from.delayParams.time, to.delayParams.time, t),
        feedback: this.lerp(from.delayParams.feedback, to.delayParams.feedback, t),
        filter: this.lerp(from.delayParams.filter, to.delayParams.filter, t),
        spread: this.lerp(from.delayParams.spread ?? 0.3, to.delayParams.spread ?? 0.3, t),
        mix: this.lerp(from.delayParams.mix, to.delayParams.mix, t),
      },
      masterFilterParams: {
        lowpass: this.lerp(from.masterFilterParams?.lowpass ?? 1, to.masterFilterParams?.lowpass ?? 1, t),
        highpass: this.lerp(from.masterFilterParams?.highpass ?? 0, to.masterFilterParams?.highpass ?? 0, t),
      },
      bpm: Math.round(this.lerp(from.bpm, to.bpm, t)),
      swing: this.lerp(from.swing, to.swing, t),
    };
  }
  
  // Trigger morph callback (called from MacroEngine)
  triggerMorph(amount: number, activeScene: string): void {
    if (this.morphCallback && this.morphTargetScene) {
      this.morphCallback(amount, activeScene, this.morphTargetScene);
    }
  }
  
  // Easing function for smooth transitions
  easeInOutCubic(t: number): number {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  
  // ========== CLIPBOARD (Copy/Paste) ==========
  
  copyScene(sceneId: string): boolean {
    const scene = this.scenes.get(sceneId);
    if (scene) {
      this.clipboard = { ...scene };
      return true;
    }
    return false;
  }
  
  pasteScene(targetId: string): SceneData | null {
    if (!this.clipboard) return null;
    
    const pastedScene: SceneData = {
      ...this.clipboard,
      id: targetId,
      saved: true,
    };
    this.scenes.set(targetId, pastedScene);
    this.saveToLocalStorage();
    return pastedScene;
  }
  
  hasClipboard(): boolean {
    return this.clipboard !== null;
  }
  
  getClipboardName(): string | undefined {
    return this.clipboard?.name;
  }
  
  // ========== FACTORY PRESETS ==========
  
  getFactoryPresetNames(): FactoryPresetName[] {
    return Object.keys(factoryPresets) as FactoryPresetName[];
  }
  
  loadFactoryPreset(presetName: FactoryPresetName, targetId: string): SceneData {
    const preset = factoryPresets[presetName];
    const sceneData: SceneData = {
      ...preset,
      id: targetId,
      saved: true,
    };
    this.scenes.set(targetId, sceneData);
    this.saveToLocalStorage();
    return sceneData;
  }
  
  // ========== EXPORT/IMPORT ==========
  
  exportSceneToJSON(sceneId: string): string | null {
    const scene = this.scenes.get(sceneId);
    if (!scene) return null;
    return JSON.stringify(scene, null, 2);
  }
  
  exportAllScenesToJSON(): string {
    const allScenes = Array.from(this.scenes.entries());
    return JSON.stringify(allScenes, null, 2);
  }
  
  importSceneFromJSON(json: string, targetId: string): SceneData | null {
    try {
      const parsed = JSON.parse(json) as SceneData;
      // Validate basic structure
      if (!parsed.drumSteps || !parsed.synthSteps || !parsed.synthParams) {
        throw new Error('Invalid scene structure');
      }
      const sceneData: SceneData = {
        ...parsed,
        id: targetId,
        saved: true,
      };
      this.scenes.set(targetId, sceneData);
      this.saveToLocalStorage();
      return sceneData;
    } catch (e) {
      console.error('Failed to import scene:', e);
      return null;
    }
  }
  
  importAllScenesFromJSON(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as [string, SceneData][];
      // Validate array structure
      if (!Array.isArray(parsed)) {
        throw new Error('Invalid scenes array');
      }
      this.scenes = new Map(parsed);
      this.saveToLocalStorage();
      return true;
    } catch (e) {
      console.error('Failed to import scenes:', e);
      return false;
    }
  }
  
  // ========== LOCALSTORAGE ==========
  
  saveToLocalStorage(): void {
    try {
      const data = Array.from(this.scenes.entries());
      localStorage.setItem('groovebox-scenes', JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save scenes to localStorage:', e);
    }
  }
  
  loadFromLocalStorage(): void {
    try {
      const saved = localStorage.getItem('groovebox-scenes');
      if (saved) {
        const data = JSON.parse(saved) as [string, SceneData][];
        this.scenes = new Map(data);
      }
    } catch (e) {
      console.warn('Failed to load scenes from localStorage:', e);
    }
  }
  
  // Clear a specific scene
  clearScene(sceneId: string): void {
    this.scenes.delete(sceneId);
    this.saveToLocalStorage();
  }
  
  // Clear all scenes
  clearAllScenes(): void {
    this.scenes.clear();
    localStorage.removeItem('groovebox-scenes');
  }
}

export const sceneEngine = SceneEngine.getInstance();
