import { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from '@/components/synth/Header';
import { TransportControls } from '@/components/synth/TransportControls';
import { WaveformDisplay } from '@/components/synth/WaveformDisplay';
import { DrumModule } from '@/components/synth/DrumModule';
import { SynthModule } from '@/components/synth/SynthModule';
import { TextureModule } from '@/components/synth/TextureModule';
import { FXModule } from '@/components/synth/FXModule';
import { MacroKnobs } from '@/components/synth/MacroKnobs';
import { SceneSlots } from '@/components/synth/SceneSlots';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { WaveformType } from '@/audio/SynthVoice';
import { TextureMode } from '@/audio/TextureEngine';
import { sceneEngine, SceneData, InterpolatedParams } from '@/audio/SceneEngine';
import { macroEngine } from '@/audio/MacroEngine';
import { toast } from 'sonner';

const initialScenes = [
  { id: 'a', name: 'Init' },
  { id: 'b', name: 'Build' },
  { id: 'c', name: 'Drop' },
  { id: 'd', name: 'Break' },
  { id: 'e', name: 'Ambient' },
  { id: 'f', name: 'Chaos' },
  { id: 'g', name: 'Outro' },
  { id: 'h', name: 'Empty' },
];

const initialMacros = [
  { id: 'm1', name: 'Filter', value: 50, targets: ['synth.cutoff', 'texture.density'] },
  { id: 'm2', name: 'Decay', value: 40, targets: ['drums.decay'] },
  { id: 'm3', name: 'Space', value: 30, targets: ['reverb.mix', 'delay.feedback'] },
  { id: 'm4', name: 'Chaos', value: 0, targets: [] },
  { id: 'm5', name: 'Drive', value: 25, targets: ['master.drive'] },
  { id: 'm6', name: 'LFO', value: 50, targets: ['synth.lfo'] },
  { id: 'm7', name: 'Morph', value: 0, targets: [] },
  { id: 'm8', name: 'Master', value: 75, targets: ['master.gain'] },
];

const createInitialSteps = (pattern: number[]) => 
  Array(16).fill(null).map((_, i) => ({
    active: pattern.includes(i),
    velocity: 80 + Math.random() * 40,
    probability: 100,
  }));

const TRANSITION_DURATION = 500; // ms

const Index = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [swing, setSwing] = useState(0);
  const [activeScene, setActiveScene] = useState('a');
  const [morphTargetScene, setMorphTargetScene] = useState<string | null>(null);
  const [savedSceneIds, setSavedSceneIds] = useState<string[]>([]);
  const [macros, setMacros] = useState(initialMacros);

  // Drum steps and params
  const [kickSteps, setKickSteps] = useState(() => createInitialSteps([0, 4, 8, 12]));
  const [snareSteps, setSnareSteps] = useState(() => createInitialSteps([4, 12]));
  const [hatSteps, setHatSteps] = useState(() => createInitialSteps([0, 2, 4, 6, 8, 10, 12, 14]));
  const [drumParams, setDrumParams] = useState({ pitch: 50, decay: 60, drive: 30, mix: 75 });
  const [drumMuted, setDrumMuted] = useState(false);

  // Synth steps and params
  const [synthSteps, setSynthSteps] = useState(() => createInitialSteps([0, 3, 6, 8, 10, 12, 14]));
  const [synthMuted, setSynthMuted] = useState(false);
  const [synthParams, setSynthParams] = useState({
    waveform: 'saw' as WaveformType,
    cutoff: 65,
    resonance: 40,
    attack: 10,
    release: 45,
    detune: 25,
    lfoRate: 30,
  });

  // Texture params
  const [textureMuted, setTextureMuted] = useState(false);
  const [textureMode, setTextureMode] = useState<TextureMode>('granular');
  const [textureParams, setTextureParams] = useState({
    density: 45,
    spread: 60,
    pitch: 50,
    size: 35,
    feedback: 20,
    mix: 50,
  });

  // FX params
  const [reverbParams, setReverbParams] = useState({
    size: 0.5,
    decay: 0.5,
    damping: 0.5,
    mix: 0.3,
  });

  const [delayParams, setDelayParams] = useState({
    time: 0.375,
    feedback: 0.4,
    filter: 0.7,
    mix: 0.25,
  });

  // Refs for transition animation
  const transitionRef = useRef<number | null>(null);
  const morphBaseRef = useRef<SceneData | null>(null);

  // Audio engine hook
  const { 
    initAudio, 
    isInitialized, 
    analyserData, 
    currentStep,
    audioState,
    handleMacroChange: audioMacroChange,
  } = useAudioEngine({
    isPlaying,
    bpm,
    swing,
    kickSteps,
    snareSteps,
    hatSteps,
    synthSteps,
    synthParams,
    synthMuted,
    drumParams,
    drumMuted,
    textureParams,
    textureMuted,
    textureMode,
    reverbParams,
    delayParams,
  });

  // Load saved scenes on mount
  useEffect(() => {
    sceneEngine.loadFromLocalStorage();
    setSavedSceneIds(sceneEngine.getSavedSceneIds());
  }, []);

  // Get current state as SceneData
  const getCurrentSceneSnapshot = useCallback((): Omit<SceneData, 'id' | 'saved'> => {
    return {
      name: initialScenes.find(s => s.id === activeScene)?.name || 'Scene',
      drumSteps: { kick: kickSteps, snare: snareSteps, hat: hatSteps },
      drumParams,
      drumMuted,
      synthSteps,
      synthParams,
      synthMuted,
      textureMode,
      textureParams,
      textureMuted,
      reverbParams,
      delayParams,
      bpm,
      swing,
    };
  }, [
    activeScene, kickSteps, snareSteps, hatSteps, drumParams, drumMuted,
    synthSteps, synthParams, synthMuted, textureMode, textureParams, 
    textureMuted, reverbParams, delayParams, bpm, swing
  ]);

  // Apply interpolated params to state
  const applyInterpolatedParams = useCallback((params: InterpolatedParams) => {
    setDrumParams(params.drumParams);
    setSynthParams(prev => ({ ...prev, ...params.synthParams }));
    setTextureParams(params.textureParams);
    setReverbParams(params.reverbParams);
    setDelayParams(params.delayParams);
    setBpm(params.bpm);
    setSwing(params.swing);
  }, []);

  // Apply discrete params (steps, mutes, waveform, mode)
  const applyDiscreteParams = useCallback((scene: SceneData) => {
    setKickSteps(scene.drumSteps.kick);
    setSnareSteps(scene.drumSteps.snare);
    setHatSteps(scene.drumSteps.hat);
    setDrumMuted(scene.drumMuted);
    setSynthSteps(scene.synthSteps);
    setSynthParams(prev => ({ ...prev, waveform: scene.synthParams.waveform }));
    setSynthMuted(scene.synthMuted);
    setTextureMode(scene.textureMode);
    setTextureMuted(scene.textureMuted);
  }, []);

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
    sceneEngine.saveScene(sceneId, {
      ...snapshot,
      name: initialScenes.find(s => s.id === sceneId)?.name || 'Scene',
    });
    setSavedSceneIds(sceneEngine.getSavedSceneIds());
    toast.success(`Scene ${initialScenes.find(s => s.id === sceneId)?.name} saved`);
  }, [getCurrentSceneSnapshot]);

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

  // Set up morph callback
  useEffect(() => {
    sceneEngine.setMorphCallback((amount, _fromScene, _toScene) => {
      handleMorphChange(amount);
    });
    macroEngine.setMorphMacroCallback(handleMorphChange);
  }, [handleMorphChange]);

  const handlePlayPause = useCallback(async () => {
    if (!isInitialized) {
      await initAudio();
    }
    setIsPlaying((prev) => !prev);
  }, [isInitialized, initAudio]);

  const handleStop = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleMacroChange = useCallback((id: string, value: number) => {
    setMacros((prev) => 
      prev.map((m) => m.id === id ? { ...m, value } : m)
    );
    audioMacroChange(id, value);
  }, [audioMacroChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        await handlePlayPause();
      }
      if (e.code === 'Escape') {
        handleStop();
      }
      if (e.shiftKey && e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', ''));
        if (num >= 1 && num <= 8) {
          handleSceneSelect(initialScenes[num - 1].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayPause, handleStop, handleSceneSelect]);

  // Cleanup transition on unmount
  useEffect(() => {
    return () => {
      if (transitionRef.current) {
        cancelAnimationFrame(transitionRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <Header projectName="Untitled Session" />

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto scrollbar-thin">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Transport & Waveform */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <TransportControls
              isPlaying={isPlaying}
              bpm={bpm}
              swing={swing}
              onPlayPause={handlePlayPause}
              onStop={handleStop}
              onBpmChange={setBpm}
              onSwingChange={setSwing}
            />
            <div className="lg:col-span-2">
              <WaveformDisplay isPlaying={isPlaying} analyserData={analyserData} />
            </div>
          </div>

          {/* Instruments */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <DrumModule 
              currentStep={currentStep}
              kickSteps={kickSteps}
              snareSteps={snareSteps}
              hatSteps={hatSteps}
              onKickChange={setKickSteps}
              onSnareChange={setSnareSteps}
              onHatChange={setHatSteps}
              params={drumParams}
              onParamsChange={setDrumParams}
              muted={drumMuted}
              onMuteToggle={() => setDrumMuted(!drumMuted)}
            />
            <SynthModule 
              currentStep={currentStep}
              steps={synthSteps}
              onStepsChange={setSynthSteps}
              params={synthParams}
              onParamsChange={setSynthParams}
              muted={synthMuted}
              onMuteToggle={() => setSynthMuted(!synthMuted)}
            />
            <TextureModule 
              isPlaying={isPlaying}
              muted={textureMuted}
              onMuteToggle={() => setTextureMuted(!textureMuted)}
              mode={textureMode}
              onModeChange={setTextureMode}
              params={textureParams}
              onParamsChange={setTextureParams}
            />
            <FXModule
              reverbParams={reverbParams}
              delayParams={delayParams}
              onReverbChange={(params) => setReverbParams(prev => ({ ...prev, ...params }))}
              onDelayChange={(params) => setDelayParams(prev => ({ ...prev, ...params }))}
            />
          </div>

          {/* Performance layer */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="module">
              <MacroKnobs macros={macros} onMacroChange={handleMacroChange} />
            </div>
            <div className="module">
              <SceneSlots
                scenes={initialScenes}
                activeScene={activeScene}
                morphTargetScene={morphTargetScene}
                savedSceneIds={savedSceneIds}
                onSceneSelect={handleSceneSelect}
                onSceneSave={handleSceneSave}
                onMorphTargetSet={handleMorphTargetSet}
              />
            </div>
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-card/50 border border-border text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>Step: {currentStep + 1}/16</span>
              <span>Scene: {initialScenes.find(s => s.id === activeScene)?.name}</span>
              {morphTargetScene && (
                <span className="text-primary">
                  Morph → {initialScenes.find(s => s.id === morphTargetScene)?.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span>Audio: {audioState}</span>
              <span className="flex items-center gap-1">
                <span className={`led ${isInitialized ? 'on' : ''}`} />
                {isInitialized ? 'Engine Ready' : 'Click Play to Init'}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer hint */}
      <footer className="px-6 py-2 border-t border-border text-xs text-muted-foreground text-center">
        <span className="opacity-50">
          Space: Play/Pause • Esc: Stop • Shift+1-8: Scenes • Double-Click: Save Scene • Shift+Click: Morph Target
        </span>
      </footer>
    </div>
  );
};

export default Index;
