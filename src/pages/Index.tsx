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
import { PatternChain } from '@/components/synth/PatternChain';
import { CollapsibleSection } from '@/components/synth/CollapsibleSection';
import { BottomDock } from '@/components/synth/BottomDock';
import { PerformancePanel } from '@/components/synth/panels/PerformancePanel';
import { SettingsPanel } from '@/components/synth/panels/SettingsPanel';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useDrumState } from '@/hooks/useDrumState';
import { useSynthState } from '@/hooks/useSynthState';
import { useTextureState } from '@/hooks/useTextureState';
import { useFXState } from '@/hooks/useFXState';
import { useSampleState } from '@/hooks/useSampleState';
import { useSceneManager } from '@/hooks/useSceneManager';
import { usePatternChain } from '@/hooks/usePatternChain';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useMusicalKeyboard } from '@/hooks/useMusicalKeyboard';
import { useUILayout } from '@/hooks/useUILayout';
import { useGlitchState, GlitchTrackId } from '@/hooks/useGlitchState';
import { SampleModule } from '@/components/synth/SampleModule';
import { KeyboardTarget } from '@/components/synth/dock/KeyboardTab';

import { AutoFillConfig } from '@/components/synth/TransportControls';

// Dock height for padding calculation
const DOCK_HEIGHTS = { hidden: 0, mini: 48, expanded: 160 };

const Index = () => {
  // UI Layout state
  const uiLayout = useUILayout();

  // Transport state
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [swing, setSwing] = useState(0);
  const [humanize, setHumanize] = useState(0);
  const [fillActive, setFillActive] = useState(false);
  const [autoFillConfig, setAutoFillConfig] = useState<AutoFillConfig>({
    enabled: false,
    interval: 8,
    duration: 1,
    probability: 100,
  });
  
  // Glitch targets state
  const [glitchTargets, setGlitchTargets] = useState<GlitchTarget[]>(['master']);
  const [glitchMuted, setGlitchMuted] = useState(false);

  // Instrument state hooks
  const drumState = useDrumState();
  const synthState = useSynthState();
  const textureState = useTextureState();
  const fxState = useFXState();
  const sampleState = useSampleState();
  const glitchState = useGlitchState();
  const [sampleIsPlaying, setSampleIsPlaying] = useState(false);
  const [keyboardTarget, setKeyboardTarget] = useState<KeyboardTarget>('synth');
  const [keyboardOctave, setKeyboardOctave] = useState(3);

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

  // Pattern chain
  const patternChain = usePatternChain({
    onSceneChange: sceneManager.handleSceneSelect,
    isPlaying,
    activeScene: sceneManager.activeScene,
    savedSceneIds: sceneManager.savedSceneIds,
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
    setGlitchTapeStopParams,
    setGlitchFreezeParams,
    setGlitchReverseParams,
    setGlitchMasterMix,
    setGlitchFXSends,
    setChaosEnabled,
    setGlitchChaosParams,
    playNote,
    stopNote,
    triggerDrum,
    triggerSample,
    volumes,
    setChannelVolume,
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
    sendLevels: fxState.sendLevels,
    trackRouting: fxState.trackRouting,
    fxOffsetsPerTrack: fxState.fxOffsetsPerTrack,
    glitchTargets,
    sampleBuffer: sampleState.sampleBuffer,
    sampleParams: sampleState.sampleParams,
    sampleMuted: sampleState.sampleMuted,
    sampleIsPlaying,
    fillActive,
    autoFillConfig,
    onAutoFillTrigger: setFillActive,
    fxRoutingMode: fxState.fxRoutingMode,
    fxTargets: fxState.fxTargets,
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

  // Musical keyboard (global - works in any tab)
  const { pressedMidi, pressedDrums } = useMusicalKeyboard({
    target: keyboardTarget,
    octave: keyboardOctave,
    onNoteOn: playNote,
    onNoteOff: stopNote,
    onDrumTrigger: triggerDrum,
    onSampleTrigger: triggerSample,
    isAudioReady: isInitialized,
    onInitAudio: initAudio,
  });

  // Calculate main content padding based on dock state
  const dockHeight = DOCK_HEIGHTS[uiLayout.dockState];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with panel toggles and status */}
      <Header 
        projectName="Untitled Session"
        onToggleLeftPanel={uiLayout.toggleLeftPanel}
        onToggleRightPanel={uiLayout.toggleRightPanel}
        onToggleDock={uiLayout.cycleDockState}
        leftPanelOpen={uiLayout.leftPanelOpen}
        rightPanelOpen={uiLayout.rightPanelOpen}
        dockState={uiLayout.dockState}
        currentStep={currentStep}
        activeSceneName={sceneManager.scenes.find(s => s.id === sceneManager.activeScene)?.name}
        morphTargetName={sceneManager.morphTargetScene ? sceneManager.scenes.find(s => s.id === sceneManager.morphTargetScene)?.name : undefined}
        audioState={audioState}
        isInitialized={isInitialized}
      />

      {/* Main content */}
      <main 
        className="flex-1 p-6 overflow-auto scrollbar-thin transition-all duration-200"
        style={{ paddingBottom: dockHeight + 24 }}
      >
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Transport & Waveform */}
          <div className="space-y-4">
            <TransportControls
              isPlaying={isPlaying}
              bpm={bpm}
              swing={swing}
              humanize={humanize}
              isRecording={isRecording}
              recordingTime={recordingTime}
              fillActive={fillActive}
              onPlayPause={handlePlayPause}
              onStop={handleStop}
              onBpmChange={setBpm}
              onSwingChange={setSwing}
              onHumanizeChange={setHumanize}
              onRecordStart={startRecording}
              onRecordStop={stopRecording}
              onFillActivate={setFillActive}
              autoFillConfig={autoFillConfig}
              onAutoFillConfigChange={setAutoFillConfig}
            />
            <GlitchWaveformDisplay isPlaying={isPlaying} analyserData={analyserData} />
          </div>

          {/* GENERADORES - Sound Sources */}
          <CollapsibleSection
            title="Generadores"
            isOpen={uiLayout.generatorsOpen}
            onToggle={uiLayout.toggleGenerators}
            moduleCount={4}
          >
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
          </CollapsibleSection>

          {/* PROCESAMIENTO - Effects */}
          <CollapsibleSection
            title="Procesamiento"
            isOpen={uiLayout.processingOpen}
            onToggle={uiLayout.toggleProcessing}
            moduleCount={2}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="min-h-[200px]">
                <FXModule
                  reverbParams={fxState.reverbParams}
                  delayParams={fxState.delayParams}
                  masterFilterParams={fxState.masterFilterParams}
                  sendLevels={fxState.sendLevels}
                  bpm={bpm}
                  isPlaying={isPlaying}
                  fxRoutingMode={fxState.fxRoutingMode}
                  fxTargets={fxState.fxTargets}
                  fxOffsetsPerTrack={fxState.fxOffsetsPerTrack}
                  onReverbChange={fxState.updateReverbParams}
                  onDelayChange={fxState.updateDelayParams}
                  onMasterFilterChange={fxState.updateMasterFilterParams}
                  onSendChange={fxState.updateSendLevel}
                  onRoutingModeChange={fxState.setFxRoutingMode}
                  onTargetToggle={fxState.toggleFxTarget}
                  onFXOffsetChange={fxState.updateFXOffset}
                  onResetTrackOffsets={fxState.resetTrackOffsets}
                />
              </div>
              <div className="module p-4 min-h-[200px]">
                <GlitchModuleCompact 
                  glitchTargets={glitchTargets}
                  muted={glitchMuted}
                  paramsPerTrack={glitchState.paramsPerTrack}
                  masterMix={glitchState.masterMix}
                  isPlaying={isPlaying}
                  analyserData={analyserData}
                  onMuteToggle={() => setGlitchMuted(prev => !prev)}
                  onGlitchTargetsChange={setGlitchTargets}
                  onTriggerGlitch={(effect) => !glitchMuted && triggerGlitch(effect)}
                  onStutterParamsChange={(track: GlitchTrackId, params) => {
                    glitchState.updateStutterParams(track, params);
                    setGlitchStutterParams(track, {
                      division: params.division,
                      decay: params.decay !== undefined ? params.decay / 100 : undefined,
                      mix: params.mix !== undefined ? params.mix / 100 : undefined,
                      repeatCount: params.repeatCount,
                      probability: params.probability !== undefined ? params.probability / 100 : undefined,
                    });
                  }}
                  onBitcrushParamsChange={(track: GlitchTrackId, params) => {
                    glitchState.updateBitcrushParams(track, params);
                    setGlitchBitcrushParams(track, {
                      bits: params.bits,
                      sampleRate: params.sampleRate !== undefined ? params.sampleRate / 100 : undefined,
                    });
                  }}
                  onTapeStopParamsChange={(track: GlitchTrackId, params) => {
                    glitchState.updateTapeStopParams(track, params);
                    setGlitchTapeStopParams(track, {
                      speed: params.speed !== undefined ? params.speed / 100 : undefined,
                      duration: params.duration !== undefined ? params.duration / 100 : undefined,
                      mix: params.mix !== undefined ? params.mix / 100 : undefined,
                      curve: params.curve,
                      wobble: params.wobble !== undefined ? params.wobble / 100 : undefined,
                      probability: params.probability !== undefined ? params.probability / 100 : undefined,
                    });
                  }}
                  onFreezeParamsChange={(track: GlitchTrackId, params) => {
                    glitchState.updateFreezeParams(track, params);
                    setGlitchFreezeParams(track, {
                      grainSize: params.grainSize !== undefined ? params.grainSize / 100 : undefined,
                      pitch: params.pitch !== undefined ? params.pitch / 100 : undefined,
                      spread: params.spread !== undefined ? params.spread / 100 : undefined,
                      mix: params.mix !== undefined ? params.mix / 100 : undefined,
                      position: params.position !== undefined ? params.position / 100 : undefined,
                      overlap: params.overlap !== undefined ? params.overlap / 100 : undefined,
                      density: params.density !== undefined ? params.density / 100 : undefined,
                      jitter: params.jitter !== undefined ? params.jitter / 100 : undefined,
                      attack: params.attack !== undefined ? params.attack / 100 : undefined,
                      detune: params.detune !== undefined ? params.detune / 100 : undefined,
                      scatter: params.scatter !== undefined ? params.scatter / 100 : undefined,
                      reverse: params.reverse,
                      probability: params.probability !== undefined ? params.probability / 100 : undefined,
                    });
                  }}
                  onReverseParamsChange={(track: GlitchTrackId, params) => {
                    glitchState.updateReverseParams(track, params);
                    setGlitchReverseParams(track, {
                      duration: params.duration !== undefined ? params.duration / 100 : undefined,
                      mix: params.mix !== undefined ? params.mix / 100 : undefined,
                      position: params.position !== undefined ? params.position / 100 : undefined,
                      crossfade: params.crossfade !== undefined ? params.crossfade / 100 : undefined,
                      speed: params.speed !== undefined ? params.speed / 100 : undefined,
                      feedback: params.feedback !== undefined ? params.feedback / 100 : undefined,
                      loop: params.loop !== undefined ? params.loop / 100 : undefined,
                      probability: params.probability !== undefined ? params.probability / 100 : undefined,
                    });
                  }}
                  onChaosToggle={(enabled, params) => !glitchMuted && setChaosEnabled(enabled, params)}
                  onChaosParamsChange={(track: GlitchTrackId, params) => {
                    glitchState.updateChaosParams(track, params);
                    setGlitchChaosParams(track, { 
                      density: params.density !== undefined ? params.density / 100 : undefined,
                      intensity: params.intensity !== undefined ? params.intensity / 100 : undefined,
                    });
                  }}
                  onFXSendsChange={(track: GlitchTrackId, params) => {
                    glitchState.updateFXSendsParams(track, params);
                    // FIX: Ahora aplicamos FX sends al engine
                    const current = glitchState.paramsPerTrack[track].fxSends;
                    setGlitchFXSends(
                      (params.reverb ?? current.reverb) / 100,
                      (params.delay ?? current.delay) / 100
                    );
                  }}
                  onMasterMixChange={(value) => {
                    glitchState.setMasterMix(value);
                    // FIX: Ahora aplicamos master mix al engine
                    setGlitchMasterMix(value);
                  }}
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* CONTROL - Performance */}
          <CollapsibleSection
            title="Control"
            isOpen={uiLayout.controlOpen}
            onToggle={uiLayout.toggleControl}
            moduleCount={3}
          >
            <div className="space-y-4">
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
              {/* Pattern Chain */}
              <div className="module">
                <PatternChain
                  config={patternChain.config}
                  currentChainIndex={patternChain.currentChainIndex}
                  isChainActive={patternChain.isChainActive}
                  scenes={sceneManager.scenes}
                  savedSceneIds={sceneManager.savedSceneIds}
                  activeScene={sceneManager.activeScene}
                  onAddToChain={patternChain.addToChain}
                  onRemoveFromChain={patternChain.removeFromChain}
                  onBarsPerPatternChange={patternChain.setBarsPerPattern}
                  onLoopChainChange={patternChain.setLoopChain}
                  onToggleEnabled={patternChain.toggleChainEnabled}
                  onClearChain={patternChain.clearChain}
                />
              </div>
            </div>
          </CollapsibleSection>
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
          Space: Play/Pause • Esc: Stop • Shift+1-8: Scenes • Ctrl+C/V: Copy/Paste
        </span>
      </footer>

      {/* Bottom Dock */}
      <BottomDock
        state={uiLayout.dockState}
        onStateChange={uiLayout.setDockState}
        activeTab={uiLayout.activeDockTab}
        onTabChange={uiLayout.setActiveDockTab}
        analyserData={analyserData}
        onNoteOn={playNote}
        onNoteOff={stopNote}
        onDrumTrigger={triggerDrum}
        onSampleTrigger={triggerSample}
        isAudioReady={isInitialized}
        onInitAudio={initAudio}
        keyboardTarget={keyboardTarget}
        onKeyboardTargetChange={setKeyboardTarget}
        keyboardOctave={keyboardOctave}
        onKeyboardOctaveChange={setKeyboardOctave}
        pressedMidi={pressedMidi}
        pressedDrums={pressedDrums}
        drumMuted={drumState.drumMuted}
        synthMuted={synthState.synthMuted}
        textureMuted={textureState.textureMuted}
        sampleMuted={sampleState.sampleMuted}
        onDrumMuteToggle={drumState.toggleDrumMute}
        onSynthMuteToggle={synthState.toggleSynthMute}
        onTextureMuteToggle={textureState.toggleTextureMute}
        onSampleMuteToggle={sampleState.toggleSampleMute}
        volumes={volumes}
        onVolumeChange={setChannelVolume}
        trackRouting={fxState.trackRouting}
        onRoutingChange={fxState.updateTrackRouting}
        sendLevels={fxState.sendLevels}
        onSendChange={fxState.updateSendLevel}
      />

      {/* Performance Panel (Left) */}
      <PerformancePanel
        open={uiLayout.leftPanelOpen}
        onOpenChange={(open) => !open && uiLayout.toggleLeftPanel()}
        drumMuted={drumState.drumMuted}
        synthMuted={synthState.synthMuted}
        textureMuted={textureState.textureMuted}
        sampleMuted={sampleState.sampleMuted}
        onDrumMuteToggle={drumState.toggleDrumMute}
        onSynthMuteToggle={synthState.toggleSynthMute}
        onTextureMuteToggle={textureState.toggleTextureMute}
        onSampleMuteToggle={sampleState.toggleSampleMute}
        scenes={sceneManager.scenes}
        activeScene={sceneManager.activeScene}
        onSceneSelect={sceneManager.handleSceneSelect}
      />

      {/* Settings Panel (Right) */}
      <SettingsPanel
        open={uiLayout.rightPanelOpen}
        onOpenChange={(open) => !open && uiLayout.toggleRightPanel()}
        projectName="Untitled Session"
        bpm={bpm}
      />
    </div>
  );
};

export default Index;
