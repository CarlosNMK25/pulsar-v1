import { useEffect, useRef, useCallback, useState } from 'react';
import { KeyboardTarget } from '@/components/synth/dock/KeyboardTab';

// Synth keyboard mapping
const KEYBOARD_MAP: Record<string, { note: string; octaveOffset: number }> = {
  // Lower row - C3 to B3
  'z': { note: 'C', octaveOffset: 0 },
  's': { note: 'C#', octaveOffset: 0 },
  'x': { note: 'D', octaveOffset: 0 },
  'd': { note: 'D#', octaveOffset: 0 },
  'c': { note: 'E', octaveOffset: 0 },
  'v': { note: 'F', octaveOffset: 0 },
  'g': { note: 'F#', octaveOffset: 0 },
  'b': { note: 'G', octaveOffset: 0 },
  'h': { note: 'G#', octaveOffset: 0 },
  'n': { note: 'A', octaveOffset: 0 },
  'j': { note: 'A#', octaveOffset: 0 },
  'm': { note: 'B', octaveOffset: 0 },
  // Upper row - C4 to B4
  'q': { note: 'C', octaveOffset: 1 },
  '2': { note: 'C#', octaveOffset: 1 },
  'w': { note: 'D', octaveOffset: 1 },
  '3': { note: 'D#', octaveOffset: 1 },
  'e': { note: 'E', octaveOffset: 1 },
  'r': { note: 'F', octaveOffset: 1 },
  '5': { note: 'F#', octaveOffset: 1 },
  't': { note: 'G', octaveOffset: 1 },
  '6': { note: 'G#', octaveOffset: 1 },
  'y': { note: 'A', octaveOffset: 1 },
  '7': { note: 'A#', octaveOffset: 1 },
  'u': { note: 'B', octaveOffset: 1 },
};

// Drum keyboard mapping
const DRUM_MAP: Record<string, 'kick' | 'snare' | 'hat'> = {
  'z': 'kick',
  'x': 'snare',
  'c': 'hat',
  'v': 'kick',
  'b': 'snare',
  'n': 'hat',
};

// Convert note name + octave to MIDI number
const noteToMidi = (note: string, octave: number): number => {
  const noteMap: Record<string, number> = {
    'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
    'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
  };
  return (octave + 1) * 12 + noteMap[note];
};

interface UseMusicalKeyboardProps {
  target: KeyboardTarget;
  octave: number;
  onNoteOn?: (note: number, velocity?: number) => void;
  onNoteOff?: (note: number) => void;
  onDrumTrigger?: (drum: 'kick' | 'snare' | 'hat', velocity?: number) => void;
  onSampleTrigger?: (velocity?: number) => void;
  isAudioReady?: boolean;
  onInitAudio?: () => Promise<void>;
}

export const useMusicalKeyboard = ({
  target,
  octave,
  onNoteOn,
  onNoteOff,
  onDrumTrigger,
  onSampleTrigger,
  isAudioReady = false,
  onInitAudio,
}: UseMusicalKeyboardProps) => {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [pressedMidi, setPressedMidi] = useState<Set<number>>(new Set());
  const [pressedDrums, setPressedDrums] = useState<Set<string>>(new Set());
  
  // Use refs to avoid stale closures in event handlers
  const activeKeyMapRef = useRef<Map<string, number>>(new Map());
  const octaveRef = useRef(octave);
  const targetRef = useRef(target);
  const onNoteOnRef = useRef(onNoteOn);
  const onNoteOffRef = useRef(onNoteOff);
  const onDrumTriggerRef = useRef(onDrumTrigger);
  const onSampleTriggerRef = useRef(onSampleTrigger);
  
  // Keep refs in sync
  useEffect(() => { octaveRef.current = octave; }, [octave]);
  useEffect(() => { targetRef.current = target; }, [target]);
  useEffect(() => { onNoteOnRef.current = onNoteOn; }, [onNoteOn]);
  useEffect(() => { onNoteOffRef.current = onNoteOff; }, [onNoteOff]);
  useEffect(() => { onDrumTriggerRef.current = onDrumTrigger; }, [onDrumTrigger]);
  useEffect(() => { onSampleTriggerRef.current = onSampleTrigger; }, [onSampleTrigger]);

  // Initialize audio on first interaction
  const ensureAudioReady = useCallback(() => {
    if (!isAudioReady && onInitAudio) {
      onInitAudio();
    }
  }, [isAudioReady, onInitAudio]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent musical keyboard when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const key = e.key.toLowerCase();
      const currentTarget = targetRef.current;
      const keyMap = activeKeyMapRef.current;
      
      if (e.repeat) return;
      
      // Skip if this key isn't a musical key for current target
      if (currentTarget === 'synth' && !KEYBOARD_MAP[key]) return;
      if (currentTarget === 'drums' && !DRUM_MAP[key]) return;
      
      ensureAudioReady();
      
      // Handle based on target
      if (currentTarget === 'synth' && KEYBOARD_MAP[key] && !keyMap.has(key)) {
        const { note, octaveOffset } = KEYBOARD_MAP[key];
        const midiNote = noteToMidi(note, octaveRef.current + octaveOffset);
        
        keyMap.set(key, midiNote);
        setPressedMidi(prev => new Set(prev).add(midiNote));
        onNoteOnRef.current?.(midiNote, 100);
      } else if (currentTarget === 'drums' && DRUM_MAP[key]) {
        const drum = DRUM_MAP[key];
        setPressedDrums(prev => new Set(prev).add(drum));
        onDrumTriggerRef.current?.(drum, 100);
      } else if (currentTarget === 'sample') {
        // Any key triggers sample
        if (!keyMap.has(key)) {
          keyMap.set(key, 0);
          onSampleTriggerRef.current?.(100);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const currentTarget = targetRef.current;
      const keyMap = activeKeyMapRef.current;
      const midiNote = keyMap.get(key);
      
      if (currentTarget === 'synth' && midiNote !== undefined) {
        keyMap.delete(key);
        onNoteOffRef.current?.(midiNote);
        
        setPressedMidi(prev => {
          const next = new Set(prev);
          next.delete(midiNote);
          return next;
        });
      } else if (currentTarget === 'drums' && DRUM_MAP[key]) {
        const drum = DRUM_MAP[key];
        setPressedDrums(prev => {
          const next = new Set(prev);
          next.delete(drum);
          return next;
        });
      } else if (currentTarget === 'sample') {
        keyMap.delete(key);
      }
    };

    const handleBlur = () => {
      const keyMap = activeKeyMapRef.current;
      keyMap.forEach((midiNote) => {
        onNoteOffRef.current?.(midiNote);
      });
      keyMap.clear();
      setPressedKeys(new Set());
      setPressedMidi(new Set());
      setPressedDrums(new Set());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [ensureAudioReady]);

  return {
    pressedKeys,
    pressedMidi,
    pressedDrums,
  };
};
