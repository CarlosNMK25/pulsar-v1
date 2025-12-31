import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Pause, Square, SkipBack, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Knob } from './Knob';

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

interface TransportControlsProps {
  isPlaying: boolean;
  bpm: number;
  swing: number;
  humanize: number;
  isRecording?: boolean;
  recordingTime?: number;
  fillActive?: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onBpmChange: (bpm: number) => void;
  onSwingChange: (swing: number) => void;
  onHumanizeChange: (humanize: number) => void;
  onRecordStart?: () => void;
  onRecordStop?: () => void;
  onFillActivate?: (active: boolean) => void;
}

export const TransportControls = ({
  isPlaying,
  bpm,
  swing,
  humanize,
  isRecording = false,
  recordingTime = 0,
  fillActive = false,
  onPlayPause,
  onStop,
  onBpmChange,
  onSwingChange,
  onHumanizeChange,
  onRecordStart,
  onRecordStop,
  onFillActivate,
}: TransportControlsProps) => {
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    };
  }, []);

  const handleTap = useCallback(() => {
    const now = Date.now();
    
    // Clear existing timeout and set new one
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = setTimeout(() => setTapTimes([]), 2000);
    
    setTapTimes(prev => {
      const newTaps = [...prev, now].slice(-8); // Keep last 8 taps
      
      if (newTaps.length >= 2) {
        // Calculate average interval between taps
        const intervals: number[] = [];
        for (let i = 1; i < newTaps.length; i++) {
          intervals.push(newTaps[i] - newTaps[i - 1]);
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const calculatedBpm = Math.round(60000 / avgInterval);
        
        // Clamp to valid BPM range
        if (calculatedBpm >= 40 && calculatedBpm <= 300) {
          onBpmChange(calculatedBpm);
        }
      }
      
      return newTaps;
    });
  }, [onBpmChange]);

  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-lg border border-border bg-card">
      {/* Transport buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onStop}
          className="transport-btn w-10 h-10"
          title="Stop & Reset"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          onClick={onPlayPause}
          className={cn('transport-btn w-12 h-12', isPlaying && 'playing')}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 text-primary" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </button>

        <button
          onClick={onStop}
          className="transport-btn w-10 h-10"
          title="Stop"
        >
          <Square className="w-4 h-4" />
        </button>

        {/* Record button */}
        <button
          onClick={isRecording ? onRecordStop : onRecordStart}
          className={cn(
            'transport-btn w-10 h-10 transition-colors',
            isRecording && 'bg-destructive/20 border-destructive'
          )}
          title={isRecording ? 'Stop Recording' : 'Start Recording'}
        >
          <Circle 
            className={cn(
              'w-4 h-4 transition-colors',
              isRecording ? 'fill-destructive text-destructive animate-pulse' : 'text-destructive'
            )} 
          />
        </button>
        
        {/* Recording time display */}
        {isRecording && (
          <div className="flex items-center gap-2 px-2 py-1 rounded bg-destructive/10 border border-destructive/30">
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm font-mono text-destructive tabular-nums">
              {formatTime(recordingTime)}
            </span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-border" />

      {/* BPM Control */}
      <div className="flex items-center gap-3">
        <span className="text-label">BPM</span>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => onBpmChange(Math.max(40, bpm - 1))}
            className="w-6 h-6 rounded bg-muted hover:bg-accent flex items-center justify-center text-sm"
          >
            -
          </button>
          
          <input
            type="number"
            value={bpm}
            onChange={(e) => onBpmChange(Math.min(300, Math.max(40, parseInt(e.target.value) || 120)))}
            className="w-16 h-8 px-2 text-center text-lg font-medium bg-surface-sunken rounded border border-border 
                       focus:outline-none focus:border-primary tabular-nums"
          />
          
          <button
            onClick={() => onBpmChange(Math.min(300, bpm + 1))}
            className="w-6 h-6 rounded bg-muted hover:bg-accent flex items-center justify-center text-sm"
          >
            +
          </button>
        </div>
        
        {/* Tap Tempo */}
        <button
          onClick={handleTap}
          className={cn(
            "px-3 h-8 rounded text-xs font-medium uppercase tracking-wider transition-colors",
            tapTimes.length > 1 
              ? "bg-primary/20 text-primary border border-primary/50" 
              : "bg-muted hover:bg-accent"
          )}
          title="Tap repeatedly to set tempo"
        >
          TAP
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-border" />

      {/* Swing Control */}
      <div className="flex items-center gap-2">
        <Knob
          value={swing}
          onChange={onSwingChange}
          label="Swing"
          size="sm"
          showValue
          unit="%"
        />
      </div>
      
      {/* Humanize Control */}
      <div className="flex items-center gap-2">
        <Knob
          value={humanize}
          onChange={onHumanizeChange}
          label="Human"
          size="sm"
          showValue
          unit="%"
          variant="secondary"
        />
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-border" />

      {/* FILL Button - momentary */}
      {onFillActivate && (
        <button
          onMouseDown={() => onFillActivate(true)}
          onMouseUp={() => onFillActivate(false)}
          onMouseLeave={() => onFillActivate(false)}
          onTouchStart={() => onFillActivate(true)}
          onTouchEnd={() => onFillActivate(false)}
          className={cn(
            'px-4 py-2 rounded border text-xs font-bold uppercase tracking-wider transition-all',
            fillActive 
              ? 'border-orange-400 bg-orange-400 text-black shadow-[0_0_12px_rgba(251,146,60,0.5)]' 
              : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground'
          )}
          title="Hold for FILL mode (triggers steps with FILL condition)"
        >
          FILL
        </button>
      )}

      {/* Play indicator */}
      {isPlaying && (
        <div className="flex items-center gap-2 ml-auto">
          <div className="led on animate-pulse-glow" />
          <span className="text-xs text-primary uppercase tracking-wider">Playing</span>
        </div>
      )}
    </div>
  );
};
