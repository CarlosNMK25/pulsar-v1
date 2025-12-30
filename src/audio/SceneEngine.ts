// Scene System Engine - Manages save/load/morph between scenes
import { WaveformType } from './SynthVoice';
import { TextureMode } from './TextureEngine';

export interface Step {
  active: boolean;
  velocity: number;
  probability: number;
}

export interface DrumParams {
  pitch: number;
  decay: number;
  drive: number;
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
}

export interface TextureParams {
  density: number;
  spread: number;
  pitch: number;
  size: number;
  feedback: number;
  mix: number;
}

export interface ReverbParams {
  size: number;
  decay: number;
  damping: number;
  mix: number;
}

export interface DelayParams {
  time: number;
  feedback: number;
  filter: number;
  mix: number;
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
  
  // Global
  bpm: number;
  swing: number;
}

// Interpolated params (all numeric values that can be smoothly transitioned)
export interface InterpolatedParams {
  drumParams: DrumParams;
  synthParams: Omit<SynthParams, 'waveform'>;
  textureParams: TextureParams;
  reverbParams: ReverbParams;
  delayParams: DelayParams;
  bpm: number;
  swing: number;
}

type MorphCallback = (amount: number, fromScene: string, toScene: string) => void;

class SceneEngine {
  private static instance: SceneEngine;
  private scenes: Map<string, SceneData> = new Map();
  private morphCallback: MorphCallback | null = null;
  private morphTargetScene: string | null = null;
  
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
        mix: this.lerp(from.drumParams.mix, to.drumParams.mix, t),
      },
      synthParams: {
        cutoff: this.lerp(from.synthParams.cutoff, to.synthParams.cutoff, t),
        resonance: this.lerp(from.synthParams.resonance, to.synthParams.resonance, t),
        attack: this.lerp(from.synthParams.attack, to.synthParams.attack, t),
        release: this.lerp(from.synthParams.release, to.synthParams.release, t),
        detune: this.lerp(from.synthParams.detune, to.synthParams.detune, t),
        lfoRate: this.lerp(from.synthParams.lfoRate, to.synthParams.lfoRate, t),
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
        mix: this.lerp(from.reverbParams.mix, to.reverbParams.mix, t),
      },
      delayParams: {
        time: this.lerp(from.delayParams.time, to.delayParams.time, t),
        feedback: this.lerp(from.delayParams.feedback, to.delayParams.feedback, t),
        filter: this.lerp(from.delayParams.filter, to.delayParams.filter, t),
        mix: this.lerp(from.delayParams.mix, to.delayParams.mix, t),
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
  
  // LocalStorage persistence
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
