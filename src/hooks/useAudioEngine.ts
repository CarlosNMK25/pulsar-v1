import { useEffect, useRef, useCallback, useState } from 'react';
import { audioEngine, GlitchTarget } from '@/audio/AudioEngine';
import { SynthVoice, WaveformType, LfoSyncDivision } from '@/audio/SynthVoice';
import { DrumEngine } from '@/audio/DrumEngine';
import { TextureEngine, TextureMode } from '@/audio/TextureEngine';
import { SampleEngine, SampleParams } from '@/audio/SampleEngine';
import { scheduler, StepCallback } from '@/audio/Scheduler';
import { fxEngine } from '@/audio/FXEngine';
import { macroEngine } from '@/audio/MacroEngine';
import { glitchEngine } from '@/audio/GlitchEngine';
import { GlitchBus } from '@/audio/GlitchBus';
import { TrackSendLevels } from '@/hooks/useFXState';
// Conditional Trigger types (Elektron-style)
export type ConditionType = 
  | '1:2' | '1:3' | '1:4'           // X of every N repetitions
  | '2:3' | '2:4' | '3:4'           // Nth of every N
  | '!1:2' | '!1:3' | '!1:4'        // Inverse ratios
  | 'FILL' | '!FILL'                // When FILL is active/inactive
  | 'PRE' | '!PRE'                  // If previous step fired/didn't fire
  | null;                            // No condition (always fires)

// P-Lock parameters that can be locked per step
export interface PLocks {
  cutoff?: number;
  resonance?: number;
  pitch?: number;
  decay?: number;
  microTiming?: number; // -50 to +50 ms offset
  fmAmount?: number;    // 0-100 FM depth per step
}

// Acid 303 step modifiers
export interface AcidModifiers {
  slide?: boolean;
  accent?: boolean;
  tie?: boolean;
}

export interface Step {
  active: boolean;
  velocity: number;
  probability: number;
  pLocks?: PLocks;
  acid?: AcidModifiers;
  condition?: ConditionType;  // Conditional trigger
}

interface UseAudioEngineProps {
  isPlaying: boolean;
  bpm: number;
  swing: number;
  humanize: number;
  kickSteps: Step[];
  snareSteps: Step[];
  hatSteps: Step[];
  synthSteps: Step[];
  synthParams: {
    waveform: WaveformType;
    cutoff: number;
    resonance: number;
    attack: number;
    release: number;
    detune: number;
    lfoRate: number;
    lfoSyncDivision: LfoSyncDivision;
  };
  synthMuted: boolean;
  drumParams: {
    pitch: number;
    decay: number;
    drive: number;
    mix: number;
  };
  drumMuted: boolean;
  textureParams: {
    density: number;
    spread: number;
    pitch: number;
    size: number;
    feedback: number;
    mix: number;
  };
  textureMuted: boolean;
  textureMode: TextureMode;
  reverbParams: {
    size: number;
    decay: number;
    damping: number;
    preDelay: number;
    lofi: number;
    mix: number;
  };
  delayParams: {
    time: number;
    feedback: number;
    filter: number;
    spread: number;
    mix: number;
  };
  masterFilterParams: {
    lowpass: number;
    highpass: number;
  };
  sendLevels: TrackSendLevels;
  glitchTargets: GlitchTarget[];
  sampleBuffer: AudioBuffer | null;
  sampleParams: SampleParams;
  sampleMuted: boolean;
  sampleIsPlaying: boolean;
  fillActive?: boolean;  // FILL button state for conditional triggers
  autoFillConfig?: {
    enabled: boolean;
    interval: number;   // Every N bars (4, 8, 16, 32)
    duration: number;   // Fill lasts N bars (1, 2)
    probability: number; // 0-100
  };
  onAutoFillTrigger?: (active: boolean) => void;  // Callback to sync UI
}

// Evaluate conditional trigger
function evaluateCondition(
  condition: ConditionType,
  repetitionCount: number,
  fillActive: boolean,
  prevFired: boolean
): boolean {
  if (!condition) return true;
  
  switch (condition) {
    case '1:2': return repetitionCount % 2 === 0;
    case '1:3': return repetitionCount % 3 === 0;
    case '1:4': return repetitionCount % 4 === 0;
    case '2:3': return repetitionCount % 3 === 1;
    case '2:4': return repetitionCount % 4 === 1;
    case '3:4': return repetitionCount % 4 === 2;
    case '!1:2': return repetitionCount % 2 !== 0;
    case '!1:3': return repetitionCount % 3 !== 0;
    case '!1:4': return repetitionCount % 4 !== 0;
    case 'FILL': return fillActive;
    case '!FILL': return !fillActive;
    case 'PRE': return prevFired;
    case '!PRE': return !prevFired;
    default: return true;
  }
}

// Note sequence for synth (C minor pentatonic)
const synthNotes = [48, 51, 53, 55, 58, 60, 63, 65, 67, 70, 72, 75, 77, 79, 82, 84];

export const useAudioEngine = ({
  isPlaying,
  bpm,
  swing,
  humanize,
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
  masterFilterParams,
  sendLevels,
  glitchTargets,
  sampleBuffer,
  sampleParams,
  sampleMuted,
  sampleIsPlaying,
  fillActive = false,
  autoFillConfig,
  onAutoFillTrigger,
}: UseAudioEngineProps) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [analyserData, setAnalyserData] = useState<Uint8Array>(new Uint8Array(128));
  const [currentStep, setCurrentStep] = useState(0);
  
  const synthRef = useRef<SynthVoice | null>(null);
  const drumRef = useRef<DrumEngine | null>(null);
  const textureRef = useRef<TextureEngine | null>(null);
  const sampleRef = useRef<SampleEngine | null>(null);
  const animationFrameRef = useRef<number>();
  
  // Track-specific glitch buses
  const drumsGlitchRef = useRef<GlitchBus | null>(null);
  const synthGlitchRef = useRef<GlitchBus | null>(null);
  const textureGlitchRef = useRef<GlitchBus | null>(null);
  const sampleGlitchRef = useRef<GlitchBus | null>(null);
  const fxGlitchRef = useRef<GlitchBus | null>(null);
  
  // Store step data in refs for scheduler callback access
  const stepsRef = useRef({ kickSteps, snareSteps, hatSteps, synthSteps });
  useEffect(() => {
    stepsRef.current = { kickSteps, snareSteps, hatSteps, synthSteps };
  }, [kickSteps, snareSteps, hatSteps, synthSteps]);

  // Conditional trigger tracking
  const stepRepetitionCount = useRef<Map<string, number>>(new Map());
  const previousStepFired = useRef<boolean>(false);
  const fillActiveRef = useRef<boolean>(false);
  
  // Keep fillActive ref in sync
  useEffect(() => {
    fillActiveRef.current = fillActive;
  }, [fillActive]);

  // Auto-fill config ref for scheduler callback
  const autoFillConfigRef = useRef(autoFillConfig);
  const onAutoFillTriggerRef = useRef(onAutoFillTrigger);
  useEffect(() => {
    autoFillConfigRef.current = autoFillConfig;
    onAutoFillTriggerRef.current = onAutoFillTrigger;
  }, [autoFillConfig, onAutoFillTrigger]);

  // Initialize audio engine
  const initAudio = useCallback(async () => {
    if (isInitialized) return;

    try {
      await audioEngine.init();
      await audioEngine.resume();

      synthRef.current = new SynthVoice();
      drumRef.current = new DrumEngine();
      textureRef.current = new TextureEngine();
      sampleRef.current = new SampleEngine();
      
      // Initialize FX engine (singleton, auto-init on first access)
      fxEngine.getReverbSend();
      fxEngine.getDelaySend();
      
      // Initialize and insert Glitch engine into master chain
      glitchEngine.init();
      audioEngine.insertGlitchEngine(
        glitchEngine.getInputNode(),
        glitchEngine.getOutputNode()
      );
      
      // Initialize track-specific glitch buses
      drumsGlitchRef.current = new GlitchBus('drums');
      drumsGlitchRef.current.init();
      
      synthGlitchRef.current = new GlitchBus('synth');
      synthGlitchRef.current.init();
      
      textureGlitchRef.current = new GlitchBus('texture');
      textureGlitchRef.current.init();
      
      sampleGlitchRef.current = new GlitchBus('sample');
      sampleGlitchRef.current.init();
      
      fxGlitchRef.current = new GlitchBus('fx');
      fxGlitchRef.current.init();
      
      // Connect instruments to FX sends
      synthRef.current.connectFX();
      drumRef.current.connectFX();
      textureRef.current.connectFX();
      sampleRef.current.connectFX();
      
      // Setup macro engine callback - actually update parameters
      macroEngine.setParamUpdateCallback((engineId, paramId, value) => {
        switch (engineId) {
          case 'synth':
            if (synthRef.current) {
              synthRef.current.setParams({ [paramId]: value });
            }
            break;
          case 'texture':
            if (textureRef.current) {
              textureRef.current.setParams({ [paramId]: value });
            }
            break;
          case 'drums':
            if (drumRef.current) {
              drumRef.current.setParams({ [paramId]: value });
            }
            break;
          case 'fx':
            if (paramId.startsWith('reverb.')) {
              fxEngine.setReverbParams({ [paramId.replace('reverb.', '')]: value });
            } else if (paramId.startsWith('delay.')) {
              fxEngine.setDelayParams({ [paramId.replace('delay.', '')]: value });
            }
            break;
          case 'master':
            if (paramId === 'gain') {
              audioEngine.setMasterVolume(value);
            }
            break;
        }
      });

      setIsInitialized(true);
      console.log('[useAudioEngine] Audio initialized with Scheduler, FX, and Macros');
    } catch (error) {
      console.error('[useAudioEngine] Init failed:', error);
    }
  }, [isInitialized]);

  // Update BPM and sync LFO
  useEffect(() => {
    scheduler.setBpm(bpm);
    // Optionally sync delay to BPM
    if (isInitialized) {
      fxEngine.syncDelayToBpm(bpm);
      // Sync LFO to BPM if using synced division
      synthRef.current?.setLfoSync(bpm);
    }
  }, [bpm, isInitialized]);

  // Update Swing
  useEffect(() => {
    scheduler.setSwing(swing / 100);
  }, [swing]);

  // Update Humanize
  useEffect(() => {
    scheduler.setHumanize(humanize / 100);
  }, [humanize]);

  // Update synth parameters
  useEffect(() => {
    if (!synthRef.current) return;

    synthRef.current.setParams({
      waveform: synthParams.waveform,
      cutoff: 200 + (synthParams.cutoff / 100) * 4000,
      resonance: (synthParams.resonance / 100) * 20,
      attack: 0.001 + (synthParams.attack / 100) * 0.5,
      release: 0.05 + (synthParams.release / 100) * 1,
      detune: (synthParams.detune / 100) * 50,
      lfoRate: synthParams.lfoRate,
      lfoSyncDivision: synthParams.lfoSyncDivision,
    });
    
    // Re-sync LFO when division changes
    if (synthParams.lfoSyncDivision !== 'free') {
      synthRef.current.setLfoSync(bpm, synthParams.lfoSyncDivision);
    }
  }, [synthParams, bpm]);

  // Update synth mute
  useEffect(() => {
    if (!synthRef.current) return;
    synthRef.current.setMuted(synthMuted);
  }, [synthMuted]);

  // Update drum parameters
  useEffect(() => {
    if (!drumRef.current) return;
    drumRef.current.setParams(drumParams);
  }, [drumParams]);

  // Update drum mute
  useEffect(() => {
    if (!drumRef.current) return;
    drumRef.current.setMuted(drumMuted);
  }, [drumMuted]);

  // Update texture parameters
  useEffect(() => {
    if (!textureRef.current) return;

    textureRef.current.setParams({
      density: textureParams.density / 100,
      spread: textureParams.spread / 100,
      pitch: textureParams.pitch / 100,
      size: textureParams.size / 100,
      feedback: textureParams.feedback / 100,
      mix: textureParams.mix / 100,
    });
  }, [textureParams]);

  // Update texture mode
  useEffect(() => {
    if (!textureRef.current) return;
    textureRef.current.setMode(textureMode);
  }, [textureMode]);

  // Update FX parameters
  useEffect(() => {
    if (!isInitialized) return;
    fxEngine.setReverbParams(reverbParams);
  }, [reverbParams, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    fxEngine.setDelayParams(delayParams);
  }, [delayParams, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    fxEngine.setMasterFilterParams(masterFilterParams);
  }, [masterFilterParams, isInitialized]);

  // Sync send levels to engines
  useEffect(() => {
    if (!isInitialized) return;
    if (drumRef.current) {
      drumRef.current.setFXSend(sendLevels.drums.reverb, sendLevels.drums.delay);
    }
    if (synthRef.current) {
      synthRef.current.setFXSend(sendLevels.synth.reverb, sendLevels.synth.delay);
    }
    if (textureRef.current) {
      textureRef.current.setFXSend(sendLevels.texture.reverb, sendLevels.texture.delay);
    }
    if (sampleRef.current) {
      sampleRef.current.setFXSend(sendLevels.sample.reverb, sendLevels.sample.delay);
    }
  }, [sendLevels, isInitialized]);

  // Handle texture mute and playback
  useEffect(() => {
    if (!textureRef.current) return;

    if (isPlaying && !textureMuted) {
      textureRef.current.start();
    } else {
      textureRef.current.stop();
    }
  }, [isPlaying, textureMuted]);

  // Sample engine: load buffer
  useEffect(() => {
    if (!sampleRef.current) return;
    if (sampleBuffer) {
      sampleRef.current.loadSample(sampleBuffer);
    } else {
      sampleRef.current.clearSample();
    }
  }, [sampleBuffer]);

  // Sample engine: sync params
  useEffect(() => {
    if (!sampleRef.current) return;
    sampleRef.current.setParams(sampleParams);
  }, [sampleParams]);

  // Sample engine: mute
  useEffect(() => {
    if (!sampleRef.current) return;
    sampleRef.current.setMuted(sampleMuted);
  }, [sampleMuted]);

  // Sample engine: play/stop
  useEffect(() => {
    if (!sampleRef.current || !isInitialized) return;
    
    if (sampleIsPlaying) {
      sampleRef.current.start();
    } else {
      sampleRef.current.stop();
    }
  }, [sampleIsPlaying, isInitialized]);

  // Scheduler step callback - triggers sounds with precise timing
  useEffect(() => {
    if (!isInitialized) return;

    const stepCallback: StepCallback = (step, time) => {
      const { kickSteps, snareSteps, hatSteps, synthSteps } = stepsRef.current;
      
      // Update UI step indicator
      setCurrentStep(step);

      // Track if any step fired this round (for PRE condition)
      let anyFiredThisStep = false;

      // Helper to check if step should fire based on all conditions
      const shouldStepFire = (stepData: Step, trackId: string, stepIndex: number): boolean => {
        if (!stepData.active) return false;
        
        // Probability check
        if (stepData.probability < 100 && Math.random() * 100 > stepData.probability) {
          return false;
        }
        
        // Conditional trigger check
        if (stepData.condition) {
          const stepKey = `${trackId}-${stepIndex}`;
          const count = stepRepetitionCount.current.get(stepKey) || 0;
          
          if (!evaluateCondition(
            stepData.condition,
            count,
            fillActiveRef.current,
            previousStepFired.current
          )) {
            // Increment repetition count even if condition fails
            stepRepetitionCount.current.set(stepKey, count + 1);
            return false;
          }
          
          // Increment repetition count on successful evaluation
          stepRepetitionCount.current.set(stepKey, count + 1);
        }
        
        return true;
      };

      // Helper to trigger with micro-timing offset
      const triggerWithMicroTiming = (callback: () => void, microTimingMs?: number) => {
        if (microTimingMs && microTimingMs > 0) {
          setTimeout(callback, microTimingMs);
        } else {
          callback();
        }
      };

      // Drums - use Web Audio time for precise scheduling with micro-timing
      const kick = kickSteps[step];
      if (shouldStepFire(kick, 'kick', step)) {
        anyFiredThisStep = true;
        triggerWithMicroTiming(
          () => drumRef.current?.trigger('kick', kick.velocity),
          kick.pLocks?.microTiming
        );
      }

      const snare = snareSteps[step];
      if (shouldStepFire(snare, 'snare', step)) {
        anyFiredThisStep = true;
        triggerWithMicroTiming(
          () => drumRef.current?.trigger('snare', snare.velocity),
          snare.pLocks?.microTiming
        );
      }

      const hat = hatSteps[step];
      if (shouldStepFire(hat, 'hat', step)) {
        anyFiredThisStep = true;
        triggerWithMicroTiming(
          () => drumRef.current?.trigger('hat', hat.velocity),
          hat.pLocks?.microTiming
        );
      }

      // Synth with P-Locks, Acid 303 support, and micro-timing
      const synth = synthSteps[step];
      if (shouldStepFire(synth, 'synth', step)) {
        anyFiredThisStep = true;
        const synthTrigger = () => {
          let note = synthNotes[step % synthNotes.length];
          
          // Apply Pitch P-Lock: map 0-100 to -12 to +12 semitones (50 = no change)
          if (synth.pLocks?.pitch !== undefined) {
            const pitchOffset = Math.round((synth.pLocks.pitch - 50) / 50 * 12);
            note = note + pitchOffset;
          }
          
          // Apply P-Locks temporarily if present
          let originalParams: { cutoff?: number; resonance?: number; release?: number; fmAmount?: number } | null = null;
          if (synth.pLocks) {
            originalParams = {};
            if (synth.pLocks.cutoff !== undefined) {
              originalParams.cutoff = synthRef.current?.getParams?.().cutoff;
              synthRef.current?.setParams({ cutoff: 200 + (synth.pLocks.cutoff / 100) * 4000 });
            }
            if (synth.pLocks.resonance !== undefined) {
              originalParams.resonance = synthRef.current?.getParams?.().resonance;
              synthRef.current?.setParams({ resonance: (synth.pLocks.resonance / 100) * 20 });
            }
            // Apply Decay P-Lock: map 0-100 to 0.05-1.0 seconds
            if (synth.pLocks.decay !== undefined) {
              originalParams.release = synthRef.current?.getParams?.().release;
              synthRef.current?.setParams({ release: 0.05 + (synth.pLocks.decay / 100) * 0.95 });
            }
            // Apply FM Amount P-Lock
            if (synth.pLocks.fmAmount !== undefined) {
              originalParams.fmAmount = synthRef.current?.getParams?.().fmAmount;
              synthRef.current?.setParams({ fmAmount: synth.pLocks.fmAmount });
            }
          }
          
          // Trigger note with Acid 303 options
          synthRef.current?.noteOn(note, synth.velocity, synth.acid);
          
          // Schedule note-off using precise timing
          const stepDuration = 60 / scheduler.getBpm() / 4;
          setTimeout(() => {
            synthRef.current?.noteOff(note);
            
            // Restore original params after P-Lock
            if (originalParams) {
              if (originalParams.cutoff !== undefined) {
                synthRef.current?.setParams({ cutoff: originalParams.cutoff });
              }
              if (originalParams.resonance !== undefined) {
                synthRef.current?.setParams({ resonance: originalParams.resonance });
              }
              if (originalParams.release !== undefined) {
                synthRef.current?.setParams({ release: originalParams.release });
              }
              if (originalParams.fmAmount !== undefined) {
                synthRef.current?.setParams({ fmAmount: originalParams.fmAmount });
              }
            }
          }, stepDuration * 0.8 * 1000);
        };
        
        triggerWithMicroTiming(synthTrigger, synth.pLocks?.microTiming);
      }

      // Update previousStepFired for next step's PRE condition
      previousStepFired.current = anyFiredThisStep;
    };

    const unsubscribe = scheduler.onStep(stepCallback);
    return unsubscribe;
  }, [isInitialized]);

  // Auto-Fill: Trigger FILL automatically every N bars
  useEffect(() => {
    if (!isInitialized) return;

    const barCallback = (barNumber: number) => {
      const config = autoFillConfigRef.current;
      if (!config?.enabled) return;

      // Check probability
      if (config.probability < 100 && Math.random() * 100 > config.probability) {
        return;
      }

      // Check if this bar should trigger fill (every N bars)
      if (barNumber % config.interval === 0) {
        // Activate fill
        fillActiveRef.current = true;
        onAutoFillTriggerRef.current?.(true);

        // Calculate fill duration in ms
        const barDurationMs = (60 / scheduler.getBpm()) * 4 * 1000; // 4 beats per bar
        const fillDurationMs = barDurationMs * config.duration;

        // Deactivate fill after duration
        setTimeout(() => {
          fillActiveRef.current = false;
          onAutoFillTriggerRef.current?.(false);
        }, fillDurationMs);
      }
    };

    const unsubscribe = scheduler.onBar(barCallback);
    return unsubscribe;
  }, [isInitialized]);

  // Start/stop scheduler based on isPlaying
  useEffect(() => {
    if (!isInitialized) return;

    if (isPlaying) {
      scheduler.start();
    } else {
      scheduler.stop();
      synthRef.current?.allNotesOff();
      setCurrentStep(0);
    }
  }, [isPlaying, isInitialized]);

  // Analyser animation loop
  useEffect(() => {
    if (!isInitialized) return;

    const updateAnalyser = () => {
      try {
        const analyser = audioEngine.getAnalyser();
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        setAnalyserData(data.slice(0, 128));
      } catch {
        // Not initialized yet
      }
      animationFrameRef.current = requestAnimationFrame(updateAnalyser);
    };

    updateAnalyser();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isInitialized]);

  // Cleanup
  useEffect(() => {
    return () => {
      scheduler.stop();
      synthRef.current?.disconnect();
      drumRef.current?.disconnect();
      textureRef.current?.disconnect();
      sampleRef.current?.disconnect();
      drumsGlitchRef.current?.disconnect();
      synthGlitchRef.current?.disconnect();
      textureGlitchRef.current?.disconnect();
      sampleGlitchRef.current?.disconnect();
      fxGlitchRef.current?.disconnect();
    };
  }, []);

  // Update glitch targets bypass state
  useEffect(() => {
    if (!isInitialized) return;
    
    // Master glitch
    glitchEngine.setBypass(!glitchTargets.includes('master'));
    
    // Track glitches
    drumsGlitchRef.current?.setBypass(!glitchTargets.includes('drums'));
    synthGlitchRef.current?.setBypass(!glitchTargets.includes('synth'));
    textureGlitchRef.current?.setBypass(!glitchTargets.includes('texture'));
    sampleGlitchRef.current?.setBypass(!glitchTargets.includes('sample'));
    fxGlitchRef.current?.setBypass(!glitchTargets.includes('fx'));
  }, [glitchTargets, isInitialized]);

  // Macro change handler
  const handleMacroChange = useCallback((macroId: string, value: number) => {
    macroEngine.setMacroValue(macroId, value);
  }, []);

  // Glitch trigger handlers - triggers on active targets
  const triggerGlitch = useCallback((effect: 'stutter' | 'tapestop' | 'freeze' | 'bitcrush' | 'reverse') => {
    if (glitchTargets.includes('master')) {
      switch (effect) {
        case 'stutter': glitchEngine.triggerStutter(); break;
        case 'tapestop': glitchEngine.triggerTapeStop(); break;
        case 'freeze': glitchEngine.triggerGranularFreeze(); break;
        case 'bitcrush': glitchEngine.triggerBitcrush(); break;
        case 'reverse': glitchEngine.triggerReverse(); break;
      }
    }
    if (glitchTargets.includes('drums') && drumsGlitchRef.current) {
      switch (effect) {
        case 'stutter': drumsGlitchRef.current.triggerStutter(); break;
        case 'tapestop': drumsGlitchRef.current.triggerTapeStop(); break;
        case 'freeze': drumsGlitchRef.current.triggerGranularFreeze(); break;
        case 'bitcrush': drumsGlitchRef.current.triggerBitcrush(); break;
        case 'reverse': drumsGlitchRef.current.triggerReverse(); break;
      }
    }
    if (glitchTargets.includes('synth') && synthGlitchRef.current) {
      switch (effect) {
        case 'stutter': synthGlitchRef.current.triggerStutter(); break;
        case 'tapestop': synthGlitchRef.current.triggerTapeStop(); break;
        case 'freeze': synthGlitchRef.current.triggerGranularFreeze(); break;
        case 'bitcrush': synthGlitchRef.current.triggerBitcrush(); break;
        case 'reverse': synthGlitchRef.current.triggerReverse(); break;
      }
    }
    if (glitchTargets.includes('texture') && textureGlitchRef.current) {
      switch (effect) {
        case 'stutter': textureGlitchRef.current.triggerStutter(); break;
        case 'tapestop': textureGlitchRef.current.triggerTapeStop(); break;
        case 'freeze': textureGlitchRef.current.triggerGranularFreeze(); break;
        case 'bitcrush': textureGlitchRef.current.triggerBitcrush(); break;
        case 'reverse': textureGlitchRef.current.triggerReverse(); break;
      }
    }
    if (glitchTargets.includes('sample') && sampleGlitchRef.current) {
      switch (effect) {
        case 'stutter': sampleGlitchRef.current.triggerStutter(); break;
        case 'tapestop': sampleGlitchRef.current.triggerTapeStop(); break;
        case 'freeze': sampleGlitchRef.current.triggerGranularFreeze(); break;
        case 'bitcrush': sampleGlitchRef.current.triggerBitcrush(); break;
        case 'reverse': sampleGlitchRef.current.triggerReverse(); break;
      }
    }
    if (glitchTargets.includes('fx') && fxGlitchRef.current) {
      switch (effect) {
        case 'stutter': fxGlitchRef.current.triggerStutter(); break;
        case 'tapestop': fxGlitchRef.current.triggerTapeStop(); break;
        case 'freeze': fxGlitchRef.current.triggerGranularFreeze(); break;
        case 'bitcrush': fxGlitchRef.current.triggerBitcrush(); break;
        case 'reverse': fxGlitchRef.current.triggerReverse(); break;
      }
    }
  }, [glitchTargets]);

  // Update glitch params on all active targets
  const setGlitchStutterParams = useCallback((params: { division?: '1/4' | '1/8' | '1/16' | '1/32' | '1/64'; decay?: number; mix?: number }) => {
    glitchEngine.setStutterParams(params);
    drumsGlitchRef.current?.setStutterParams(params);
    synthGlitchRef.current?.setStutterParams(params);
    textureGlitchRef.current?.setStutterParams(params);
    sampleGlitchRef.current?.setStutterParams(params);
    fxGlitchRef.current?.setStutterParams(params);
  }, []);

  const setGlitchBitcrushParams = useCallback((params: { bits?: number; sampleRate?: number; mix?: number }) => {
    glitchEngine.setBitcrushParams(params);
    drumsGlitchRef.current?.setBitcrushParams(params);
    synthGlitchRef.current?.setBitcrushParams(params);
    textureGlitchRef.current?.setBitcrushParams(params);
    sampleGlitchRef.current?.setBitcrushParams(params);
    fxGlitchRef.current?.setBitcrushParams(params);
  }, []);

  // Chaos mode control - applies to active targets
  const setChaosEnabled = useCallback((enabled: boolean, params?: { density?: number; intensity?: number }) => {
    if (params) {
      glitchEngine.setChaosParams(params);
      drumsGlitchRef.current?.setChaosParams(params);
      synthGlitchRef.current?.setChaosParams(params);
      textureGlitchRef.current?.setChaosParams(params);
      sampleGlitchRef.current?.setChaosParams(params);
      fxGlitchRef.current?.setChaosParams(params);
    }

    if (enabled) {
      if (glitchTargets.includes('master')) {
        glitchEngine.setChaosParams({ enabled: true, ...(params || {}) });
      }
      if (glitchTargets.includes('drums')) {
        drumsGlitchRef.current?.startChaos();
      }
      if (glitchTargets.includes('synth')) {
        synthGlitchRef.current?.startChaos();
      }
      if (glitchTargets.includes('texture')) {
        textureGlitchRef.current?.startChaos();
      }
      if (glitchTargets.includes('sample')) {
        sampleGlitchRef.current?.startChaos();
      }
      if (glitchTargets.includes('fx')) {
        fxGlitchRef.current?.startChaos();
      }
    } else {
      glitchEngine.stopChaos();
      drumsGlitchRef.current?.stopChaos();
      synthGlitchRef.current?.stopChaos();
      textureGlitchRef.current?.stopChaos();
      sampleGlitchRef.current?.stopChaos();
      fxGlitchRef.current?.stopChaos();
    }
  }, [glitchTargets]);

  // Update chaos params on active targets
  const setGlitchChaosParams = useCallback((params: { density?: number; intensity?: number }) => {
    glitchEngine.setChaosParams(params);
    drumsGlitchRef.current?.setChaosParams(params);
    synthGlitchRef.current?.setChaosParams(params);
    textureGlitchRef.current?.setChaosParams(params);
    sampleGlitchRef.current?.setChaosParams(params);
    fxGlitchRef.current?.setChaosParams(params);
  }, []);

  return {
    initAudio,
    isInitialized,
    analyserData,
    currentStep,
    audioState: audioEngine.state,
    handleMacroChange,
    triggerGlitch,
    setGlitchStutterParams,
    setGlitchBitcrushParams,
    setChaosEnabled,
    setGlitchChaosParams,
  };
};
