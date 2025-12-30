import { useEffect, useRef, useCallback, useState } from 'react';
import { audioEngine } from '@/audio/AudioEngine';
import { SynthVoice, WaveformType } from '@/audio/SynthVoice';
import { DrumEngine } from '@/audio/DrumEngine';
import { TextureEngine } from '@/audio/TextureEngine';

interface Step {
  active: boolean;
  velocity: number;
  probability: number;
}

interface UseAudioEngineProps {
  isPlaying: boolean;
  bpm: number;
  currentStep: number;
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
}

// Note sequence for synth (C minor pentatonic)
const synthNotes = [48, 51, 53, 55, 58, 60, 63, 65, 67, 70, 72, 75, 77, 79, 82, 84];

export const useAudioEngine = ({
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
}: UseAudioEngineProps) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [analyserData, setAnalyserData] = useState<Uint8Array>(new Uint8Array(128));
  
  const synthRef = useRef<SynthVoice | null>(null);
  const drumRef = useRef<DrumEngine | null>(null);
  const textureRef = useRef<TextureEngine | null>(null);
  const prevStepRef = useRef(-1);
  const animationFrameRef = useRef<number>();

  // Initialize audio engine
  const initAudio = useCallback(async () => {
    if (isInitialized) return;

    try {
      await audioEngine.init();
      await audioEngine.resume();

      synthRef.current = new SynthVoice();
      drumRef.current = new DrumEngine();
      textureRef.current = new TextureEngine();

      setIsInitialized(true);
      console.log('[useAudioEngine] Audio initialized');
    } catch (error) {
      console.error('[useAudioEngine] Init failed:', error);
    }
  }, [isInitialized]);

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

  // Handle texture mute and playback
  useEffect(() => {
    if (!textureRef.current) return;

    if (isPlaying && !textureMuted) {
      textureRef.current.start();
    } else {
      textureRef.current.stop();
    }
  }, [isPlaying, textureMuted]);

  // Trigger sounds on step change
  useEffect(() => {
    if (!isPlaying || currentStep === prevStepRef.current) return;
    if (!drumRef.current || !synthRef.current) return;

    prevStepRef.current = currentStep;

    // Drums
    const kick = kickSteps[currentStep];
    if (kick.active && Math.random() * 100 < kick.probability) {
      drumRef.current.trigger('kick', kick.velocity);
    }

    const snare = snareSteps[currentStep];
    if (snare.active && Math.random() * 100 < snare.probability) {
      drumRef.current.trigger('snare', snare.velocity);
    }

    const hat = hatSteps[currentStep];
    if (hat.active && Math.random() * 100 < hat.probability) {
      drumRef.current.trigger('hat', hat.velocity);
    }

    // Synth - trigger note on step, release on next
    const synth = synthSteps[currentStep];
    if (synth.active && Math.random() * 100 < synth.probability) {
      const note = synthNotes[currentStep % synthNotes.length];
      synthRef.current.noteOn(note, synth.velocity);
      
      // Auto note-off after half step duration
      const stepDuration = (60 / bpm / 4) * 1000;
      setTimeout(() => {
        synthRef.current?.noteOff(note);
      }, stepDuration * 0.8);
    }
  }, [currentStep, isPlaying, kickSteps, snareSteps, hatSteps, synthSteps, bpm]);

  // Stop all on playback stop
  useEffect(() => {
    if (!isPlaying) {
      synthRef.current?.allNotesOff();
      prevStepRef.current = -1;
    }
  }, [isPlaying]);

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
      synthRef.current?.disconnect();
      drumRef.current?.disconnect();
      textureRef.current?.disconnect();
    };
  }, []);

  return {
    initAudio,
    isInitialized,
    analyserData,
    audioState: audioEngine.state,
  };
};
