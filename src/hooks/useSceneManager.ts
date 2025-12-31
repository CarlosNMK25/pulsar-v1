import { useState, useEffect, useCallback, useRef } from 'react';
import { sceneEngine, SceneData, InterpolatedParams } from '@/audio/SceneEngine';
import { macroEngine } from '@/audio/MacroEngine';
import { FactoryPresetName } from '@/audio/factoryPresets';
import { toast } from 'sonner';
import { initialScenes, initialMacros, TRANSITION_DURATION } from '@/constants/initialState';
import { UseDrumStateReturn } from './useDrumState';
import { UseSynthStateReturn } from './useSynthState';
import { UseTextureStateReturn } from './useTextureState';
import { UseFXStateReturn } from './useFXState';

interface UseSceneManagerProps {
  drumState: UseDrumStateReturn;
  synthState: UseSynthStateReturn;
  textureState: UseTextureStateReturn;
  fxState: UseFXStateReturn;
  bpm: number;
  swing: number;
  setBpm: (bpm: number) => void;
  setSwing: (swing: number) => void;
}

export const useSceneManager = ({
  drumState,
  synthState,
  textureState,
  fxState,
  bpm,
  swing,
  setBpm,
  setSwing,
}: UseSceneManagerProps) => {
  const [activeScene, setActiveScene] = useState('a');
  const [morphTargetScene, setMorphTargetScene] = useState<string | null>(null);
  const [savedSceneIds, setSavedSceneIds] = useState<string[]>([]);
  const [scenes, setScenes] = useState(initialScenes);
  const [hasClipboard, setHasClipboard] = useState(false);
  const [clipboardName, setClipboardName] = useState<string | undefined>();
  const [macros, setMacros] = useState(initialMacros);

  // File input refs for import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const allFilesInputRef = useRef<HTMLInputElement>(null);
  const importTargetRef = useRef<string | null>(null);

  // Refs for transition animation
  const transitionRef = useRef<number | null>(null);
  const morphBaseRef = useRef<SceneData | null>(null);

  // Load saved scenes on mount
  useEffect(() => {
    sceneEngine.loadFromLocalStorage();
    setSavedSceneIds(sceneEngine.getSavedSceneIds());
  }, []);

  // Cleanup transition on unmount
  useEffect(() => {
    return () => {
      if (transitionRef.current) {
        cancelAnimationFrame(transitionRef.current);
      }
    };
  }, []);

  // Get current state as SceneData
  const getCurrentSceneSnapshot = useCallback((): Omit<SceneData, 'id' | 'saved'> => {
    return {
      name: scenes.find(s => s.id === activeScene)?.name || 'Scene',
      drumSteps: { 
        kick: drumState.kickSteps, 
        snare: drumState.snareSteps, 
        hat: drumState.hatSteps 
      },
      drumParams: drumState.drumParams,
      drumMuted: drumState.drumMuted,
      synthSteps: synthState.synthSteps,
      synthParams: synthState.synthParams,
      synthMuted: synthState.synthMuted,
      textureMode: textureState.textureMode,
      textureParams: textureState.textureParams,
      textureMuted: textureState.textureMuted,
      reverbParams: fxState.reverbParams,
      delayParams: fxState.delayParams,
      masterFilterParams: fxState.masterFilterParams,
      sendLevels: fxState.sendLevels,
      bpm,
      swing,
    };
  }, [
    activeScene, scenes,
    drumState.kickSteps, drumState.snareSteps, drumState.hatSteps, 
    drumState.drumParams, drumState.drumMuted,
    synthState.synthSteps, synthState.synthParams, synthState.synthMuted, 
    textureState.textureMode, textureState.textureParams, textureState.textureMuted, 
    fxState.reverbParams, fxState.delayParams, fxState.masterFilterParams,
    bpm, swing
  ]);

  // Apply interpolated params to state
  const applyInterpolatedParams = useCallback((params: InterpolatedParams) => {
    drumState.setDrumParams(params.drumParams);
    synthState.setSynthParams(prev => ({ ...prev, ...params.synthParams }));
    textureState.setTextureParams(params.textureParams);
    fxState.setReverbParams(params.reverbParams);
    fxState.setDelayParams(prev => ({ ...prev, ...params.delayParams }));
    fxState.setMasterFilterParams(params.masterFilterParams);
    setBpm(params.bpm);
    setSwing(params.swing);
  }, [drumState, synthState, textureState, fxState, setBpm, setSwing]);

  // Apply discrete params (steps, mutes, waveform, mode, sendLevels)
  const applyDiscreteParams = useCallback((scene: SceneData) => {
    drumState.setKickSteps(scene.drumSteps.kick);
    drumState.setSnareSteps(scene.drumSteps.snare);
    drumState.setHatSteps(scene.drumSteps.hat);
    drumState.setDrumMuted(scene.drumMuted);
    synthState.setSynthSteps(scene.synthSteps);
    synthState.setSynthParams(prev => ({ ...prev, waveform: scene.synthParams.waveform }));
    synthState.setSynthMuted(scene.synthMuted);
    textureState.setTextureMode(scene.textureMode);
    textureState.setTextureMuted(scene.textureMuted);
    // Apply sendLevels if present
    if (scene.sendLevels) {
      fxState.setSendLevels(scene.sendLevels);
    }
  }, [drumState, synthState, textureState, fxState]);

  // Transition to a scene with smooth animation
  const transitionToScene = useCallback((targetScene: SceneData, duration: number = TRANSITION_DURATION) => {
    // Cancel any existing transition
    if (transitionRef.current) {
      cancelAnimationFrame(transitionRef.current);
    }

    const startSnapshot = getCurrentSceneSnapshot();
    const startScene: SceneData = { ...startSnapshot, id: 'temp', saved: false };
    const startTime = performance.now();

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const rawProgress = Math.min(elapsed / duration, 1);
      const progress = sceneEngine.easeInOutCubic(rawProgress);

      const interpolated = sceneEngine.interpolateParams(startScene, targetScene, progress);
      applyInterpolatedParams(interpolated);

      if (rawProgress < 1) {
        transitionRef.current = requestAnimationFrame(animate);
      } else {
        // Apply discrete params at the end
        applyDiscreteParams(targetScene);
        transitionRef.current = null;
      }
    };

    transitionRef.current = requestAnimationFrame(animate);
  }, [getCurrentSceneSnapshot, applyInterpolatedParams, applyDiscreteParams]);

  // Handle scene selection
  const handleSceneSelect = useCallback((sceneId: string) => {
    const sceneData = sceneEngine.loadScene(sceneId);
    
    if (sceneData) {
      transitionToScene(sceneData);
    }
    
    setActiveScene(sceneId);
    macroEngine.setActiveScene(sceneId);
    
    // Reset morph to 0 when changing scenes
    setMacros(prev => prev.map(m => m.id === 'm7' ? { ...m, value: 0 } : m));
  }, [transitionToScene]);

  // Handle scene save
  const handleSceneSave = useCallback((sceneId: string) => {
    const snapshot = getCurrentSceneSnapshot();
    const sceneName = scenes.find(s => s.id === sceneId)?.name || 'Scene';
    sceneEngine.saveScene(sceneId, {
      ...snapshot,
      name: sceneName,
    });
    setSavedSceneIds(sceneEngine.getSavedSceneIds());
    toast.success(`Scene ${sceneName} saved`);
  }, [getCurrentSceneSnapshot, scenes]);

  // Handle morph target change
  const handleMorphTargetSet = useCallback((sceneId: string | null) => {
    setMorphTargetScene(sceneId);
    sceneEngine.setMorphTarget(sceneId);
    
    // Store current state as morph base
    if (sceneId) {
      const snapshot = getCurrentSceneSnapshot();
      morphBaseRef.current = { ...snapshot, id: activeScene, saved: false };
    } else {
      morphBaseRef.current = null;
    }
  }, [getCurrentSceneSnapshot, activeScene]);

  // Handle morph callback from MacroEngine/SceneEngine
  const handleMorphChange = useCallback((amount: number) => {
    if (!morphTargetScene || !morphBaseRef.current) return;
    
    const targetScene = sceneEngine.loadScene(morphTargetScene);
    if (!targetScene) return;

    const interpolated = sceneEngine.interpolateParams(morphBaseRef.current, targetScene, amount);
    applyInterpolatedParams(interpolated);

    // At 100%, apply discrete params
    if (amount >= 0.99) {
      applyDiscreteParams(targetScene);
    }
  }, [morphTargetScene, applyInterpolatedParams, applyDiscreteParams]);

  // Handle scene copy
  const handleSceneCopy = useCallback((sceneId: string) => {
    // First save current state if it's the active scene
    if (sceneId === activeScene) {
      const snapshot = getCurrentSceneSnapshot();
      sceneEngine.saveScene(sceneId, {
        ...snapshot,
        name: scenes.find(s => s.id === sceneId)?.name || 'Scene',
      });
    }
    
    if (sceneEngine.copyScene(sceneId)) {
      setHasClipboard(true);
      setClipboardName(sceneEngine.getClipboardName());
      toast.success('Scene copied to clipboard');
    }
  }, [activeScene, getCurrentSceneSnapshot, scenes]);

  // Handle scene paste
  const handleScenePaste = useCallback((targetId: string) => {
    const pasted = sceneEngine.pasteScene(targetId);
    if (pasted) {
      setSavedSceneIds(sceneEngine.getSavedSceneIds());
      setScenes(prev => prev.map(s => 
        s.id === targetId ? { ...s, name: pasted.name } : s
      ));
      
      // If pasting to active scene, apply the params
      if (targetId === activeScene) {
        transitionToScene(pasted);
      }
      toast.success('Scene pasted');
    }
  }, [activeScene, transitionToScene]);

  // Handle scene rename
  const handleSceneRename = useCallback((sceneId: string, newName: string) => {
    setScenes(prev => prev.map(s => 
      s.id === sceneId ? { ...s, name: newName } : s
    ));
    sceneEngine.renameScene(sceneId, newName);
    toast.success(`Scene renamed to "${newName}"`);
  }, []);

  // Handle factory preset load
  const handleLoadPreset = useCallback((preset: FactoryPresetName, targetId: string) => {
    const sceneData = sceneEngine.loadFactoryPreset(preset, targetId);
    setSavedSceneIds(sceneEngine.getSavedSceneIds());
    setScenes(prev => prev.map(s => 
      s.id === targetId ? { ...s, name: sceneData.name } : s
    ));
    
    // Apply the preset to current view
    transitionToScene(sceneData);
    toast.success(`Loaded ${preset} preset`);
  }, [transitionToScene]);

  // Handle export scene
  const handleExportScene = useCallback((sceneId: string) => {
    // Save current state first
    if (sceneId === activeScene) {
      const snapshot = getCurrentSceneSnapshot();
      sceneEngine.saveScene(sceneId, {
        ...snapshot,
        name: scenes.find(s => s.id === sceneId)?.name || 'Scene',
      });
    }
    
    const json = sceneEngine.exportSceneToJSON(sceneId);
    if (json) {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scene-${sceneId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Scene exported');
    } else {
      toast.error('No scene data to export');
    }
  }, [activeScene, getCurrentSceneSnapshot, scenes]);

  // Handle export all scenes
  const handleExportAll = useCallback(() => {
    const json = sceneEngine.exportAllScenesToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'groovebox-scenes.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('All scenes exported');
  }, []);

  // Handle import scene
  const handleImportScene = useCallback((targetId: string) => {
    importTargetRef.current = targetId;
    fileInputRef.current?.click();
  }, []);

  // Handle import all scenes
  const handleImportAll = useCallback(() => {
    allFilesInputRef.current?.click();
  }, []);

  // File import handlers
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importTargetRef.current) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const json = event.target?.result as string;
      const scene = sceneEngine.importSceneFromJSON(json, importTargetRef.current!);
      if (scene) {
        setSavedSceneIds(sceneEngine.getSavedSceneIds());
        setScenes(prev => prev.map(s => 
          s.id === importTargetRef.current ? { ...s, name: scene.name } : s
        ));
        if (importTargetRef.current === activeScene) {
          transitionToScene(scene);
        }
        toast.success('Scene imported');
      } else {
        toast.error('Failed to import scene');
      }
      importTargetRef.current = null;
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [activeScene, transitionToScene]);

  const handleAllFilesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const json = event.target?.result as string;
      if (sceneEngine.importAllScenesFromJSON(json)) {
        setSavedSceneIds(sceneEngine.getSavedSceneIds());
        toast.success('All scenes imported');
      } else {
        toast.error('Failed to import scenes');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  // Set up morph callback
  useEffect(() => {
    sceneEngine.setMorphCallback((amount, _fromScene, _toScene) => {
      handleMorphChange(amount);
    });
    macroEngine.setMorphMacroCallback(handleMorphChange);
  }, [handleMorphChange]);

  return {
    // State
    activeScene,
    morphTargetScene,
    savedSceneIds,
    scenes,
    hasClipboard,
    clipboardName,
    macros,
    setMacros,
    // Refs for file inputs
    fileInputRef,
    allFilesInputRef,
    // Handlers
    handleSceneSelect,
    handleSceneSave,
    handleMorphTargetSet,
    handleSceneCopy,
    handleScenePaste,
    handleSceneRename,
    handleLoadPreset,
    handleExportScene,
    handleExportAll,
    handleImportScene,
    handleImportAll,
    handleFileChange,
    handleAllFilesChange,
  };
};

export type UseSceneManagerReturn = ReturnType<typeof useSceneManager>;
