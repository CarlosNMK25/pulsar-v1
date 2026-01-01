import { cn } from '@/lib/utils';
import { ModEffect } from '@/audio/ModulationEngine';
import { ModTarget, ModSendLevels } from '@/hooks/useModulationState';

interface ModSendMatrixProps {
  modSendLevels: ModSendLevels;
  onModSendChange: (track: ModTarget, effect: ModEffect, value: number) => void;
}

const tracks: { id: ModTarget; label: string; icon: string }[] = [
  { id: 'drums', label: 'D', icon: '◼' },
  { id: 'synth', label: 'S', icon: '◇' },
  { id: 'texture', label: 'T', icon: '≋' },
  { id: 'sample', label: 'Smp', icon: '▸' },
];

const effects: { id: ModEffect; label: string }[] = [
  { id: 'chorus', label: 'CHR' },
  { id: 'flanger', label: 'FLG' },
  { id: 'phaser', label: 'PHS' },
  { id: 'tremolo', label: 'TRM' },
  { id: 'ringMod', label: 'RNG' },
  { id: 'autoPan', label: 'PAN' },
];

function MiniSlider({
  value,
  onChange,
  active = true,
}: {
  value: number;
  onChange: (v: number) => void;
  active?: boolean;
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
      className={cn(
        "h-2 w-7 bg-muted/40 rounded-sm cursor-pointer relative overflow-hidden group",
        !active && "opacity-40"
      )}
      onClick={handleClick}
      onMouseMove={handleDrag}
    >
      <div
        className={cn(
          "h-full rounded-sm transition-all duration-75",
          active 
            ? "bg-primary/70 group-hover:bg-primary" 
            : "bg-muted-foreground/50"
        )}
        style={{ width: `${value * 100}%` }}
      />
    </div>
  );
}

export function ModSendMatrix({ modSendLevels, onModSendChange }: ModSendMatrixProps) {
  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center gap-1 text-[8px] text-muted-foreground/70 uppercase tracking-wider">
        <span className="w-7" />
        {effects.map(effect => (
          <span key={effect.id} className="w-7 text-center">{effect.label}</span>
        ))}
      </div>

      {/* Track rows */}
      {tracks.map((track) => (
        <div key={track.id} className="flex items-center gap-1">
          <span className="w-7 text-[9px] text-muted-foreground flex items-center gap-0.5">
            <span className="opacity-50 text-[8px]">{track.icon}</span>
            {track.label}
          </span>
          {effects.map((effect) => (
            <MiniSlider
              key={effect.id}
              value={modSendLevels[track.id][effect.id]}
              onChange={(v) => onModSendChange(track.id, effect.id, v)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
