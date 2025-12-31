import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Music, Drum, FileAudio } from 'lucide-react';

export type KeyboardTarget = 'synth' | 'drums' | 'sample';

interface KeyboardTabProps {
  onNoteOn?: (note: number, velocity?: number) => void;
  onNoteOff?: (note: number) => void;
  onDrumTrigger?: (drum: 'kick' | 'snare' | 'hat', velocity?: number) => void;
  onSampleTrigger?: (velocity?: number) => void;
  isAudioReady?: boolean;
  onInitAudio?: () => Promise<void>;
  target?: KeyboardTarget;
  onTargetChange?: (target: KeyboardTarget) => void;
}

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

export const KeyboardTab = ({ 
  onNoteOn, 
  onNoteOff, 
  onDrumTrigger,
  onSampleTrigger,
  isAudioReady = false, 
  onInitAudio,
  target = 'synth',
  onTargetChange,
}: KeyboardTabProps) => {
  const [octave, setOctave] = useState(3);
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

  // Initialize audio on first interaction (fire-and-forget)
  const ensureAudioReady = useCallback(() => {
    if (!isAudioReady && onInitAudio) {
      onInitAudio();
    }
  }, [isAudioReady, onInitAudio]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const currentTarget = targetRef.current;
      const keyMap = activeKeyMapRef.current;
      
      if (e.repeat) return;
      
      ensureAudioReady();
      
      // Handle based on target
      if (currentTarget === 'synth' && KEYBOARD_MAP[key] && !keyMap.has(key)) {
        const { note, octaveOffset } = KEYBOARD_MAP[key];
        const midiNote = noteToMidi(note, octaveRef.current + octaveOffset);
        const fullNote = `${note}${octaveRef.current + octaveOffset}`;
        
        keyMap.set(key, midiNote);
        
        setPressedKeys(prev => new Set(prev).add(fullNote));
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
        
        const fullNote = midiToNoteName(midiNote);
        setPressedKeys(prev => {
          const next = new Set(prev);
          next.delete(fullNote);
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


  // Mouse/touch handlers for visual keys
  const handleMouseDown = useCallback((note: string, oct: number) => {
    if (target !== 'synth') return;
    ensureAudioReady();
    const fullNote = `${note}${oct}`;
    const midiNote = noteToMidi(note, oct);
    setPressedKeys(prev => new Set(prev).add(fullNote));
    setPressedMidi(prev => new Set(prev).add(midiNote));
    onNoteOn?.(midiNote, 100);
  }, [onNoteOn, ensureAudioReady, target]);

  const handleMouseUp = useCallback((note: string, oct: number) => {
    if (target !== 'synth') return;
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
  }, [onNoteOff, target]);

  const handleDrumClick = useCallback((drum: 'kick' | 'snare' | 'hat') => {
    ensureAudioReady();
    onDrumTrigger?.(drum, 100);
  }, [onDrumTrigger, ensureAudioReady]);

  const handleSampleClick = useCallback(() => {
    ensureAudioReady();
    onSampleTrigger?.(100);
  }, [onSampleTrigger, ensureAudioReady]);

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

  // Render drum pads
  const renderDrumPads = () => (
    <div className="flex items-center justify-center gap-4 h-full">
      {(['kick', 'snare', 'hat'] as const).map((drum) => (
        <button
          key={drum}
          onClick={() => handleDrumClick(drum)}
          className={cn(
            "w-16 h-16 rounded-lg flex flex-col items-center justify-center gap-1 transition-all",
            "border-2 font-medium uppercase text-xs",
            pressedDrums.has(drum) 
              ? "bg-primary border-primary scale-95" 
              : "bg-muted hover:bg-muted/80 border-border"
          )}
        >
          <span>{drum === 'hat' ? 'HH' : drum.charAt(0).toUpperCase()}</span>
          <span className="text-[10px] text-muted-foreground">
            {drum === 'kick' ? 'Z/V' : drum === 'snare' ? 'X/B' : 'C/N'}
          </span>
        </button>
      ))}
    </div>
  );

  // Render sample trigger
  const renderSampleTrigger = () => (
    <div className="flex items-center justify-center h-full">
      <button
        onClick={handleSampleClick}
        className={cn(
          "w-24 h-20 rounded-lg flex flex-col items-center justify-center gap-2 transition-all",
          "border-2 font-medium text-sm",
          "bg-muted hover:bg-muted/80 border-border hover:border-primary"
        )}
      >
        <FileAudio className="w-8 h-8" />
        <span className="text-xs text-muted-foreground">Any key</span>
      </button>
    </div>
  );

  return (
    <div className="flex items-center justify-center h-full gap-4 px-4">
      {/* Target selector */}
      <div className="flex flex-col items-center gap-1">
        {(['synth', 'drums', 'sample'] as const).map((t) => (
          <button
            key={t}
            onClick={() => onTargetChange?.(t)}
            className={cn(
              "p-1.5 rounded transition-colors",
              target === t 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            )}
            title={t.charAt(0).toUpperCase() + t.slice(1)}
          >
            {t === 'synth' && <Music className="w-4 h-4" />}
            {t === 'drums' && <Drum className="w-4 h-4" />}
            {t === 'sample' && <FileAudio className="w-4 h-4" />}
          </button>
        ))}
      </div>
      
      {/* Synth-specific octave controls */}
      {target === 'synth' && (
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
      )}
      
      {/* Content based on target */}
      {target === 'synth' && (
        <div className="flex h-[90px]">
          {renderOctave(octave)}
          {renderOctave(octave + 1)}
        </div>
      )}
      {target === 'drums' && renderDrumPads()}
      {target === 'sample' && renderSampleTrigger()}
      
      <div className="text-xs text-muted-foreground ml-4 space-y-1">
        {target === 'synth' && (
          <>
            <div>Lower: Z-M</div>
            <div>Upper: Q-U</div>
          </>
        )}
        {target === 'drums' && (
          <>
            <div>Kick: Z/V</div>
            <div>Snare: X/B</div>
            <div>Hat: C/N</div>
          </>
        )}
        {target === 'sample' && (
          <div>Press any key</div>
        )}
        {!isAudioReady && (
          <div className="text-primary/70 text-[10px]">Press key to init</div>
        )}
      </div>
    </div>
  );
};
