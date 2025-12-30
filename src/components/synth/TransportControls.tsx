import { Play, Pause, Square, SkipBack } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Knob } from './Knob';

interface TransportControlsProps {
  isPlaying: boolean;
  bpm: number;
  swing: number;
  humanize: number;
  onPlayPause: () => void;
  onStop: () => void;
  onBpmChange: (bpm: number) => void;
  onSwingChange: (swing: number) => void;
  onHumanizeChange: (humanize: number) => void;
}

export const TransportControls = ({
  isPlaying,
  bpm,
  swing,
  humanize,
  onPlayPause,
  onStop,
  onBpmChange,
  onSwingChange,
  onHumanizeChange,
}: TransportControlsProps) => {
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
