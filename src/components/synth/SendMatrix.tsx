import { cn } from '@/lib/utils';
import { TrackName, TrackSendLevels } from '@/hooks/useFXState';

interface SendMatrixProps {
  sendLevels: TrackSendLevels;
  onSendChange: (track: TrackName, effect: 'reverb' | 'delay', value: number) => void;
}

const tracks: { id: TrackName; label: string; icon: string }[] = [
  { id: 'drums', label: 'D', icon: '◼' },
  { id: 'synth', label: 'S', icon: '◇' },
  { id: 'texture', label: 'T', icon: '≋' },
  { id: 'sample', label: 'Smp', icon: '▸' },
];

function MiniSlider({
  value,
  onChange,
  variant = 'primary',
}: {
  value: number;
  onChange: (v: number) => void;
  variant?: 'primary' | 'accent';
}) {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    onChange(Math.max(0, Math.min(1, x)));
  };

  const handleDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    handleClick(e);
  };

  return (
    <div
      className="h-2.5 w-10 bg-muted/40 rounded-sm cursor-pointer relative overflow-hidden group"
      onClick={handleClick}
      onMouseMove={handleDrag}
    >
      <div
        className={cn(
          "h-full rounded-sm transition-all duration-75",
          variant === 'primary' 
            ? "bg-primary/70 group-hover:bg-primary" 
            : "bg-accent/70 group-hover:bg-accent"
        )}
        style={{ width: `${value * 100}%` }}
      />
    </div>
  );
}

export function SendMatrix({ sendLevels, onSendChange }: SendMatrixProps) {
  return (
    <div className="space-y-1.5">
      {/* Header */}
      <div className="flex items-center gap-2 text-[9px] text-muted-foreground/70 uppercase tracking-wider">
        <span className="w-8">Sends</span>
        <span className="w-10 text-center">Rev</span>
        <span className="w-10 text-center">Dly</span>
      </div>

      {/* Track rows */}
      {tracks.map((track) => (
        <div key={track.id} className="flex items-center gap-2">
          <span className="w-8 text-[10px] text-muted-foreground flex items-center gap-1">
            <span className="opacity-50">{track.icon}</span>
            {track.label}
          </span>
          <MiniSlider
            value={sendLevels[track.id].reverb}
            onChange={(v) => onSendChange(track.id, 'reverb', v)}
            variant="primary"
          />
          <MiniSlider
            value={sendLevels[track.id].delay}
            onChange={(v) => onSendChange(track.id, 'delay', v)}
            variant="accent"
          />
        </div>
      ))}
    </div>
  );
}