import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/synth/Header';
import { TransportControls } from '@/components/synth/TransportControls';
import { WaveformDisplay } from '@/components/synth/WaveformDisplay';
import { DrumModule } from '@/components/synth/DrumModule';
import { SynthModule } from '@/components/synth/SynthModule';
import { TextureModule } from '@/components/synth/TextureModule';
import { MacroKnobs } from '@/components/synth/MacroKnobs';
import { SceneSlots } from '@/components/synth/SceneSlots';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { WaveformType } from '@/audio/SynthVoice';

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
  { id: 'm7', name: 'Morph', value: 50, targets: [] },
  { id: 'm8', name: 'Master', value: 75, targets: ['master.gain'] },
];

const createInitialSteps = (pattern: number[]) => 
  Array(16).fill(null).map((_, i) => ({
    active: pattern.includes(i),
    velocity: 80 + Math.random() * 40,
    probability: 100,
  }));

const Index = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [currentStep, setCurrentStep] = useState(0);
  const [activeScene, setActiveScene] = useState('a');
  const [macros, setMacros] = useState(initialMacros);

  // Drum steps
  const [kickSteps, setKickSteps] = useState(() => createInitialSteps([0, 4, 8, 12]));
  const [snareSteps, setSnareSteps] = useState(() => createInitialSteps([4, 12]));
  const [hatSteps, setHatSteps] = useState(() => createInitialSteps([0, 2, 4, 6, 8, 10, 12, 14]));

  // Synth steps and params
  const [synthSteps, setSynthSteps] = useState(() => createInitialSteps([0, 3, 6, 8, 10, 12, 14]));
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
  const [textureParams, setTextureParams] = useState({
    density: 45,
    spread: 60,
    pitch: 50,
    size: 35,
    feedback: 20,
    mix: 50,
  });

  // Audio engine hook
  const { initAudio, isInitialized, analyserData, audioState } = useAudioEngine({
    isPlaying,
    bpm,
    currentStep,
    kickSteps,
    snareSteps,
    hatSteps,
    synthSteps,
    synthParams,
    textureParams,
    textureMuted,
  });

  // Sequencer clock
  useEffect(() => {
    if (!isPlaying) return;

    const stepDuration = (60 / bpm / 4) * 1000; // 16th notes
    
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % 16);
    }, stepDuration);

    return () => clearInterval(interval);
  }, [isPlaying, bpm]);

  const handlePlayPause = useCallback(async () => {
    if (!isInitialized) {
      await initAudio();
    }
    setIsPlaying((prev) => !prev);
  }, [isInitialized, initAudio]);

  const handleStop = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep(0);
  }, []);

  const handleMacroChange = useCallback((id: string, value: number) => {
    setMacros((prev) => 
      prev.map((m) => m.id === id ? { ...m, value } : m)
    );
  }, []);

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
          setActiveScene(initialScenes[num - 1].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayPause, handleStop]);

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
              onPlayPause={handlePlayPause}
              onStop={handleStop}
              onBpmChange={setBpm}
            />
            <div className="lg:col-span-2">
              <WaveformDisplay isPlaying={isPlaying} analyserData={analyserData} />
            </div>
          </div>

          {/* Instruments */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <DrumModule 
              currentStep={currentStep}
              kickSteps={kickSteps}
              snareSteps={snareSteps}
              hatSteps={hatSteps}
              onKickChange={setKickSteps}
              onSnareChange={setSnareSteps}
              onHatChange={setHatSteps}
            />
            <SynthModule 
              currentStep={currentStep}
              steps={synthSteps}
              onStepsChange={setSynthSteps}
              params={synthParams}
              onParamsChange={setSynthParams}
            />
            <TextureModule 
              isPlaying={isPlaying}
              muted={textureMuted}
              onMuteToggle={() => setTextureMuted(!textureMuted)}
              params={textureParams}
              onParamsChange={setTextureParams}
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
                onSceneSelect={setActiveScene}
              />
            </div>
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-card/50 border border-border text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>Step: {currentStep + 1}/16</span>
              <span>Scene: {initialScenes.find(s => s.id === activeScene)?.name}</span>
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
          Space: Play/Pause • Esc: Stop • Shift+1-8: Scenes • Click+Drag: Adjust knobs
        </span>
      </footer>
    </div>
  );
};

export default Index;
