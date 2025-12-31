import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface KeyboardTabProps {
  onNoteOn?: (note: number, velocity?: number) => void;
  onNoteOff?: (note: number) => void;
  isAudioReady?: boolean;
  onInitAudio?: () => Promise<void>;
}

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

const WHITE_KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Convert note name + octave to MIDI number
const noteToMidi = (note: string, octave: number): number => {
  const noteMap: Record<string, number> = {
    'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
    'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
  };
  return (octave + 1) * 12 + noteMap[note];
};

// Convert MIDI to note name for display
const midiToNoteName = (midi: number): string => {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const noteName = noteNames[midi % 12];
  const noteOctave = Math.floor(midi / 12) - 1;
  return `${noteName}${noteOctave}`;
};

export const KeyboardTab = ({ onNoteOn, onNoteOff, isAudioReady = false, onInitAudio }: KeyboardTabProps) => {
  const [octave, setOctave] = useState(3);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [pressedMidi, setPressedMidi] = useState<Set<number>>(new Set());
  // Track which physical key triggered which MIDI note
  const [activeKeyMap, setActiveKeyMap] = useState<Map<string, number>>(new Map());

  // Initialize audio on first interaction (fire-and-forget)
  const ensureAudioReady = useCallback(() => {
    if (!isAudioReady && onInitAudio) {
      onInitAudio(); // Don't await - let it init in background
    }
  }, [isAudioReady, onInitAudio]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    // Check if key is mapped and not already pressed
    if (KEYBOARD_MAP[key] && !e.repeat && !activeKeyMap.has(key)) {
      ensureAudioReady();
      
      const { note, octaveOffset } = KEYBOARD_MAP[key];
      const midiNote = noteToMidi(note, octave + octaveOffset);
      const fullNote = `${note}${octave + octaveOffset}`;
      
      // Store the mapping so keyup knows which MIDI note to release
      setActiveKeyMap(prev => new Map(prev).set(key, midiNote));
      setPressedKeys(prev => new Set(prev).add(fullNote));
      setPressedMidi(prev => new Set(prev).add(midiNote));
      onNoteOn?.(midiNote, 100);
    }
  }, [octave, onNoteOn, ensureAudioReady, activeKeyMap]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    const midiNote = activeKeyMap.get(key);
    
    if (midiNote !== undefined) {
      onNoteOff?.(midiNote);
      
      // Clean up mappings
      setActiveKeyMap(prev => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      
      setPressedMidi(prev => {
        const next = new Set(prev);
        next.delete(midiNote);
        return next;
      });
      
      // Remove from visual pressed keys
      const fullNote = midiToNoteName(midiNote);
      setPressedKeys(prev => {
        const next = new Set(prev);
        next.delete(fullNote);
        return next;
      });
    }
  }, [activeKeyMap, onNoteOff]);

  // Release all notes when window loses focus
  useEffect(() => {
    const handleBlur = () => {
      activeKeyMap.forEach((midiNote) => {
        onNoteOff?.(midiNote);
      });
      setActiveKeyMap(new Map());
      setPressedKeys(new Set());
      setPressedMidi(new Set());
    };
    
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [activeKeyMap, onNoteOff]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Mouse/touch handlers for visual keys
  const handleMouseDown = useCallback((note: string, oct: number) => {
    ensureAudioReady();
    const fullNote = `${note}${oct}`;
    const midiNote = noteToMidi(note, oct);
    setPressedKeys(prev => new Set(prev).add(fullNote));
    setPressedMidi(prev => new Set(prev).add(midiNote));
    onNoteOn?.(midiNote, 100);
  }, [onNoteOn, ensureAudioReady]);

  const handleMouseUp = useCallback((note: string, oct: number) => {
    const fullNote = `${note}${oct}`;
    const midiNote = noteToMidi(note, oct);
    setPressedKeys(prev => {
      const next = new Set(prev);
      next.delete(fullNote);
      return next;
    });
    setPressedMidi(prev => {
      const next = new Set(prev);
      next.delete(midiNote);
      return next;
    });
    onNoteOff?.(midiNote);
  }, [onNoteOff]);

  const renderOctave = (oct: number) => (
    <div key={oct} className="flex relative h-full">
      {/* White keys */}
      {WHITE_KEYS.map((note) => {
        const fullNote = `${note}${oct}`;
        const isPressed = pressedKeys.has(fullNote);
        return (
          <button
            key={fullNote}
            onMouseDown={() => handleMouseDown(note, oct)}
            onMouseUp={() => handleMouseUp(note, oct)}
            onMouseLeave={() => pressedKeys.has(fullNote) && handleMouseUp(note, oct)}
            className={cn(
              "w-8 h-full border border-border rounded-b-sm transition-colors select-none",
              isPressed ? "bg-primary" : "bg-foreground/90 hover:bg-foreground/80"
            )}
          />
        );
      })}
      {/* Black keys */}
      <div className="absolute top-0 left-0 flex h-[60%] pointer-events-none">
        {ALL_NOTES.map((note, i) => {
          if (!note.includes('#')) return <div key={note} className="w-8" />;
          const fullNote = `${note}${oct}`;
          const isPressed = pressedKeys.has(fullNote);
          // Position black keys correctly between white keys
          const whiteKeyIndex = Math.floor(i / 2);
          const offset = whiteKeyIndex * 32 + 20; // 32px per white key, offset to center
          return (
            <button
              key={fullNote}
              onMouseDown={() => handleMouseDown(note, oct)}
              onMouseUp={() => handleMouseUp(note, oct)}
              onMouseLeave={() => pressedKeys.has(fullNote) && handleMouseUp(note, oct)}
              className={cn(
                "absolute w-5 h-full rounded-b-sm pointer-events-auto transition-colors select-none",
                isPressed ? "bg-primary" : "bg-background hover:bg-muted"
              )}
              style={{ left: `${offset}px` }}
            />
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex items-center justify-center h-full gap-4 px-4">
      {/* Octave controls */}
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={() => setOctave(o => Math.min(o + 1, 6))}
          className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80 text-foreground"
        >
          +
        </button>
        <span className="text-xs text-muted-foreground">Oct {octave}</span>
        <button
          onClick={() => setOctave(o => Math.max(o - 1, 1))}
          className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80 text-foreground"
        >
          -
        </button>
      </div>
      
      {/* Keyboard */}
      <div className="flex h-[90px]">
        {renderOctave(octave)}
        {renderOctave(octave + 1)}
      </div>
      
      <div className="text-xs text-muted-foreground ml-4 space-y-1">
        <div>Lower: Z-M</div>
        <div>Upper: Q-U</div>
        {!isAudioReady && (
          <div className="text-primary/70 text-[10px]">Press key to init</div>
        )}
      </div>
    </div>
  );
};
