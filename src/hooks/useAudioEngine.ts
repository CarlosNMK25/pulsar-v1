import { useEffect, useRef, useCallback, useState } from 'react';
import { audioEngine } from '@/audio/AudioEngine';
import { SynthVoice, WaveformType } from '@/audio/SynthVoice';
import { DrumEngine } from '@/audio/DrumEngine';
import { TextureEngine } from '@/audio/TextureEngine';
import { scheduler, StepCallback } from '@/audio/Scheduler';
import { fxEngine } from '@/audio/FXEngine';
import { macroEngine } from '@/audio/MacroEngine';

interface Step {
  active: boolean;
  velocity: number;
  probability: number;
}

interface UseAudioEngineProps {
  isPlaying: boolean;
  bpm: number;
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
  };
  textureParams: {
    density: number;
    spread: number;
    pitch: number;
    size: number;
    feedback: number;
    mix: number;
  };
  textureMuted: boolean;
  reverbParams: {
    size: number;
    decay: number;
    damping: number;
    mix: number;
  };
  delayParams: {
    time: number;
    feedback: number;
    filter: number;
    mix: number;
  };
}

// Note sequence for synth (C minor pentatonic)
const synthNotes = [48, 51, 53, 55, 58, 60, 63, 65, 67, 70, 72, 75, 77, 79, 82, 84];

export const useAudioEngine = ({
  isPlaying,
  bpm,
  kickSteps,
  snareSteps,
  hatSteps,
  synthSteps,
  synthParams,
  textureParams,
  textureMuted,
  reverbParams,
  delayParams,
}: UseAudioEngineProps) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [analyserData, setAnalyserData] = useState<Uint8Array>(new Uint8Array(128));
  const [currentStep, setCurrentStep] = useState(0);
  
  const synthRef = useRef<SynthVoice | null>(null);
  const drumRef = useRef<DrumEngine | null>(null);
  const textureRef = useRef<TextureEngine | null>(null);
  const animationFrameRef = useRef<number>();
  
  // Store step data in refs for scheduler callback access
  const stepsRef = useRef({ kickSteps, snareSteps, hatSteps, synthSteps });
  useEffect(() => {
    stepsRef.current = { kickSteps, snareSteps, hatSteps, synthSteps };
  }, [kickSteps, snareSteps, hatSteps, synthSteps]);

  // Initialize audio engine
  const initAudio = useCallback(async () => {
    if (isInitialized) return;

    try {
      await audioEngine.init();
      await audioEngine.resume();

      synthRef.current = new SynthVoice();
      drumRef.current = new DrumEngine();
      textureRef.current = new TextureEngine();
      
      // Initialize FX engine (singleton, auto-init on first access)
      fxEngine.getReverbSend();
      fxEngine.getDelaySend();
      
      // Connect instruments to FX sends
      synthRef.current.connectFX();
      drumRef.current.connectFX();
      textureRef.current.connectFX();
      
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

  // Update BPM
  useEffect(() => {
    scheduler.setBpm(bpm);
    // Optionally sync delay to BPM
    if (isInitialized) {
      fxEngine.syncDelayToBpm(bpm);
    }
  }, [bpm, isInitialized]);

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
    });
  }, [synthParams]);

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

  // Update FX parameters
  useEffect(() => {
    if (!isInitialized) return;
    fxEngine.setReverbParams(reverbParams);
  }, [reverbParams, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    fxEngine.setDelayParams(delayParams);
  }, [delayParams, isInitialized]);

  // Handle texture mute and playback
  useEffect(() => {
    if (!textureRef.current) return;

    if (isPlaying && !textureMuted) {
      textureRef.current.start();
    } else {
      textureRef.current.stop();
    }
  }, [isPlaying, textureMuted]);

  // Scheduler step callback - triggers sounds with precise timing
  useEffect(() => {
    if (!isInitialized) return;

    const stepCallback: StepCallback = (step, time) => {
      const { kickSteps, snareSteps, hatSteps, synthSteps } = stepsRef.current;
      
      // Update UI step indicator
      setCurrentStep(step);

      // Drums - use Web Audio time for precise scheduling
      const kick = kickSteps[step];
      if (kick.active && Math.random() * 100 < kick.probability) {
        drumRef.current?.trigger('kick', kick.velocity);
      }

      const snare = snareSteps[step];
      if (snare.active && Math.random() * 100 < snare.probability) {
        drumRef.current?.trigger('snare', snare.velocity);
      }

      const hat = hatSteps[step];
      if (hat.active && Math.random() * 100 < hat.probability) {
        drumRef.current?.trigger('hat', hat.velocity);
      }

      // Synth
      const synth = synthSteps[step];
      if (synth.active && Math.random() * 100 < synth.probability) {
        const note = synthNotes[step % synthNotes.length];
        synthRef.current?.noteOn(note, synth.velocity);
        
        // Schedule note-off using precise timing
        const stepDuration = 60 / scheduler.getBpm() / 4;
        setTimeout(() => {
          synthRef.current?.noteOff(note);
        }, stepDuration * 0.8 * 1000);
      }
    };

    const unsubscribe = scheduler.onStep(stepCallback);
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
    };
  }, []);

  // Macro change handler
  const handleMacroChange = useCallback((macroId: string, value: number) => {
    macroEngine.setMacroValue(macroId, value);
  }, []);

  return {
    initAudio,
    isInitialized,
    analyserData,
    currentStep,
    audioState: audioEngine.state,
    handleMacroChange,
  };
};
