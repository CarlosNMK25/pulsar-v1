import { useState, useCallback } from 'react';
import { GlitchTarget } from '@/audio/AudioEngine';
import { Header } from '@/components/synth/Header';
import { TransportControls } from '@/components/synth/TransportControls';
import { GlitchWaveformDisplay } from '@/components/synth/GlitchWaveformDisplay';
import { DrumModule } from '@/components/synth/DrumModule';
import { SynthModule } from '@/components/synth/SynthModule';
import { TextureModule } from '@/components/synth/TextureModule';
import { FXModule } from '@/components/synth/FXModule';
import { GlitchModuleCompact } from '@/components/synth/GlitchModuleCompact';
import { MacroKnobs } from '@/components/synth/MacroKnobs';
import { SceneSlots } from '@/components/synth/SceneSlots';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useDrumState } from '@/hooks/useDrumState';
import { useSynthState } from '@/hooks/useSynthState';
import { useTextureState } from '@/hooks/useTextureState';
import { useFXState } from '@/hooks/useFXState';
import { useSampleState } from '@/hooks/useSampleState';
import { useSceneManager } from '@/hooks/useSceneManager';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { SampleModule } from '@/components/synth/SampleModule';

const Index = () => {
  // Transport state
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [swing, setSwing] = useState(0);
  const [humanize, setHumanize] = useState(0);
  
  // Glitch targets state
  const [glitchTargets, setGlitchTargets] = useState<GlitchTarget[]>(['master']);
  const [glitchMuted, setGlitchMuted] = useState(false);

  // Instrument state hooks
  const drumState = useDrumState();
  const synthState = useSynthState();
  const textureState = useTextureState();
  const fxState = useFXState();
  const sampleState = useSampleState();
  const [sampleIsPlaying, setSampleIsPlaying] = useState(false);

  // Scene manager
  const sceneManager = useSceneManager({
    drumState,
    synthState,
    textureState,
    fxState,
    bpm,
    swing,
    setBpm,
    setSwing,
  });

  // Audio recorder hook
  const {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
  } = useAudioRecorder();

  // Audio engine hook
  const { 
    initAudio, 
    isInitialized, 
    analyserData, 
    currentStep,
    audioState,
    handleMacroChange: audioMacroChange,
    triggerGlitch,
    setGlitchStutterParams,
    setGlitchBitcrushParams,
    setChaosEnabled,
    setGlitchChaosParams,
  } = useAudioEngine({
    isPlaying,
    bpm,
    swing,
    humanize,
    kickSteps: drumState.kickSteps,
    snareSteps: drumState.snareSteps,
    hatSteps: drumState.hatSteps,
    synthSteps: synthState.synthSteps,
    synthParams: synthState.synthParams,
    synthMuted: synthState.synthMuted,
    drumParams: drumState.drumParams,
    drumMuted: drumState.drumMuted,
    textureParams: textureState.textureParams,
    textureMuted: textureState.textureMuted,
    textureMode: textureState.textureMode,
    reverbParams: fxState.reverbParams,
    delayParams: fxState.delayParams,
    masterFilterParams: fxState.masterFilterParams,
    glitchTargets,
    sampleBuffer: sampleState.sampleBuffer,
    sampleParams: sampleState.sampleParams,
    sampleMuted: sampleState.sampleMuted,
    sampleIsPlaying,
  });

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
    sceneManager.setMacros((prev) => 
      prev.map((m) => m.id === id ? { ...m, value } : m)
    );
    audioMacroChange(id, value);
  }, [audioMacroChange, sceneManager]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    handlePlayPause,
    handleStop,
    handleSceneSelect: sceneManager.handleSceneSelect,
    handleSceneCopy: sceneManager.handleSceneCopy,
    handleScenePaste: sceneManager.handleScenePaste,
    activeScene: sceneManager.activeScene,
    hasClipboard: sceneManager.hasClipboard,
    scenes: sceneManager.scenes,
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <Header projectName="Untitled Session" />

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto scrollbar-thin">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Transport & Waveform */}
          <div className="space-y-4">
            <TransportControls
              isPlaying={isPlaying}
              bpm={bpm}
              swing={swing}
              humanize={humanize}
              isRecording={isRecording}
              recordingTime={recordingTime}
              onPlayPause={handlePlayPause}
              onStop={handleStop}
              onBpmChange={setBpm}
              onSwingChange={setSwing}
              onHumanizeChange={setHumanize}
              onRecordStart={startRecording}
              onRecordStop={stopRecording}
            />
            <GlitchWaveformDisplay isPlaying={isPlaying} analyserData={analyserData} />
          </div>

          {/* GENERADORES - Sound Sources */}
          <section className="space-y-3">
            <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <div className="h-px flex-1 bg-border/50" />
              <span>Generadores</span>
              <div className="h-px flex-1 bg-border/50" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <DrumModule 
                currentStep={currentStep}
                kickSteps={drumState.kickSteps}
                snareSteps={drumState.snareSteps}
                hatSteps={drumState.hatSteps}
                onKickChange={drumState.setKickSteps}
                onSnareChange={drumState.setSnareSteps}
                onHatChange={drumState.setHatSteps}
                kickLength={drumState.kickLength}
                snareLength={drumState.snareLength}
                hatLength={drumState.hatLength}
                onKickLengthChange={drumState.setKickLength}
                onSnareLengthChange={drumState.setSnareLength}
                onHatLengthChange={drumState.setHatLength}
                params={drumState.drumParams}
                onParamsChange={drumState.setDrumParams}
                muted={drumState.drumMuted}
                onMuteToggle={drumState.toggleDrumMute}
                swing={swing}
                humanize={humanize}
              />
              <SynthModule 
                currentStep={currentStep}
                steps={synthState.synthSteps}
                onStepsChange={synthState.setSynthSteps}
                patternLength={synthState.synthLength}
                onLengthChange={synthState.setSynthLength}
                params={synthState.synthParams}
                onParamsChange={synthState.setSynthParams}
                muted={synthState.synthMuted}
                onMuteToggle={synthState.toggleSynthMute}
                swing={swing}
                humanize={humanize}
              />
              <TextureModule 
                isPlaying={isPlaying}
                muted={textureState.textureMuted}
                onMuteToggle={textureState.toggleTextureMute}
                mode={textureState.textureMode}
                onModeChange={textureState.setTextureMode}
                params={textureState.textureParams}
                onParamsChange={textureState.setTextureParams}
              />
              <SampleModule
                buffer={sampleState.sampleBuffer}
                sampleName={sampleState.sampleName}
                muted={sampleState.sampleMuted}
                params={sampleState.sampleParams}
                isPlaying={sampleIsPlaying}
                onLoadSample={(buffer, name) => {
                  sampleState.setSampleBuffer(buffer);
                  sampleState.setSampleName(name);
                }}
                onClearSample={sampleState.clearSample}
                onParamsChange={sampleState.setSampleParams}
                onMuteToggle={sampleState.toggleSampleMute}
                onPlayToggle={() => setSampleIsPlaying(prev => !prev)}
              />
            </div>
          </section>

          {/* PROCESAMIENTO - Effects */}
          <section className="space-y-3">
            <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <div className="h-px flex-1 bg-border/50" />
              <span>Procesamiento</span>
              <div className="h-px flex-1 bg-border/50" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="min-h-[200px]">
                <FXModule
                  reverbParams={fxState.reverbParams}
                  delayParams={fxState.delayParams}
                  masterFilterParams={fxState.masterFilterParams}
                  bpm={bpm}
                  isPlaying={isPlaying}
                  onReverbChange={fxState.updateReverbParams}
                  onDelayChange={fxState.updateDelayParams}
                  onMasterFilterChange={fxState.updateMasterFilterParams}
                />
              </div>
              <div className="module p-4 min-h-[200px]">
                <GlitchModuleCompact 
                  glitchTargets={glitchTargets}
                  muted={glitchMuted}
                  onMuteToggle={() => setGlitchMuted(prev => !prev)}
                  onGlitchTargetsChange={setGlitchTargets}
                  onTriggerGlitch={(effect) => !glitchMuted && triggerGlitch(effect)}
                  onStutterParamsChange={setGlitchStutterParams}
                  onBitcrushParamsChange={setGlitchBitcrushParams}
                  onChaosToggle={(enabled, params) => !glitchMuted && setChaosEnabled(enabled, params)}
                  onChaosParamsChange={setGlitchChaosParams}
                />
              </div>
            </div>
          </section>

          {/* CONTROL - Performance */}
          <section className="space-y-3">
            <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <div className="h-px flex-1 bg-border/50" />
              <span>Control</span>
              <div className="h-px flex-1 bg-border/50" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="module">
                <MacroKnobs macros={sceneManager.macros} onMacroChange={handleMacroChange} />
              </div>
              <div className="module">
                <SceneSlots
                  scenes={sceneManager.scenes}
                  activeScene={sceneManager.activeScene}
                  morphTargetScene={sceneManager.morphTargetScene}
                  savedSceneIds={sceneManager.savedSceneIds}
                  hasClipboard={sceneManager.hasClipboard}
                  clipboardName={sceneManager.clipboardName}
                  onSceneSelect={sceneManager.handleSceneSelect}
                  onSceneSave={sceneManager.handleSceneSave}
                  onMorphTargetSet={sceneManager.handleMorphTargetSet}
                  onSceneCopy={sceneManager.handleSceneCopy}
                  onScenePaste={sceneManager.handleScenePaste}
                  onSceneRename={sceneManager.handleSceneRename}
                  onLoadPreset={sceneManager.handleLoadPreset}
                  onExportScene={sceneManager.handleExportScene}
                  onExportAll={sceneManager.handleExportAll}
                  onImportScene={sceneManager.handleImportScene}
                  onImportAll={sceneManager.handleImportAll}
                />
              </div>
            </div>
          </section>

          {/* Status bar */}
          <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-card/50 border border-border text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>Step: {currentStep + 1}/16</span>
              <span>Scene: {sceneManager.scenes.find(s => s.id === sceneManager.activeScene)?.name}</span>
              {sceneManager.morphTargetScene && (
                <span className="text-primary">
                  Morph → {sceneManager.scenes.find(s => s.id === sceneManager.morphTargetScene)?.name}
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

      {/* Hidden file inputs for import */}
      <input
        ref={sceneManager.fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={sceneManager.handleFileChange}
      />
      <input
        ref={sceneManager.allFilesInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={sceneManager.handleAllFilesChange}
      />

      {/* Footer hint */}
      <footer className="px-6 py-2 border-t border-border text-xs text-muted-foreground text-center">
        <span className="opacity-50">
          Space: Play/Pause • Esc: Stop • Shift+1-8: Scenes • Ctrl+C/V: Copy/Paste • Right-Click: Menu
        </span>
      </footer>
    </div>
  );
};

export default Index;
