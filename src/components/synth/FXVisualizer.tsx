import { cn } from '@/lib/utils';

interface FXVisualizerProps {
  leftLevel: number;
  rightLevel: number;
  peakLeft: number;
  peakRight: number;
  spectrum: number[];
  isPlaying: boolean;
  className?: string;
}

const VU_SEGMENTS = 20;
const SPECTRUM_LABELS = ['Sub', 'Bass', 'Lo', 'Mid', 'Hi', 'Prs', 'Bri', 'Air'];

function VUBar({ level, peak, label }: { level: number; peak: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[8px] text-muted-foreground w-3">{label}</span>
      <div className="flex-1 flex items-center gap-[2px] h-3 relative">
        {Array.from({ length: VU_SEGMENTS }).map((_, i) => {
          const threshold = i / VU_SEGMENTS;
          const isActive = level > threshold;
          const isHot = i >= VU_SEGMENTS - 2;
          const isWarm = i >= VU_SEGMENTS - 5 && i < VU_SEGMENTS - 2;
          
          return (
            <div
              key={i}
              className={cn(
                "flex-1 h-full rounded-[1px] transition-all duration-50",
                isActive
                  ? isHot
                    ? "bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.6)]"
                    : isWarm
                      ? "bg-yellow-500"
                      : "bg-primary"
                  : "bg-muted/20"
              )}
            />
          );
        })}
        {/* Peak indicator */}
        {peak > 0.02 && (
          <div 
            className="absolute top-0 h-full w-[3px] bg-foreground/80 rounded-sm transition-all duration-75"
            style={{ left: `${Math.min(peak, 1) * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

function SpectrumBar({ level, label }: { level: number; label: string }) {
  const height = Math.max(level * 100, 2);
  const isHigh = level > 0.6;
  const isMid = level > 0.35;
  
  return (
    <div className="flex flex-col items-center gap-0.5 flex-1">
      <div className="h-6 w-full flex items-end justify-center">
        <div 
          className={cn(
            "w-full max-w-[8px] rounded-t-sm transition-all duration-75",
            isHigh 
              ? "bg-accent shadow-[0_0_6px_hsl(var(--accent)/0.5)]"
              : isMid
                ? "bg-primary"
                : "bg-primary/70"
          )}
          style={{ height: `${height}%` }}
        />
      </div>
      <span className="text-[6px] text-muted-foreground/60">{label}</span>
    </div>
  );
}

export function FXVisualizer({ 
  leftLevel, 
  rightLevel, 
  peakLeft, 
  peakRight, 
  spectrum,
  isPlaying,
  className 
}: FXVisualizerProps) {
  return (
    <div className={cn("flex gap-3", className)}>
      {/* VU Meters - Stereo L/R */}
      <div className="flex-[3] space-y-1">
        <div className="text-[8px] text-muted-foreground/50 uppercase tracking-wider mb-1">Wet Signal</div>
        <VUBar level={isPlaying ? leftLevel : 0} peak={isPlaying ? peakLeft : 0} label="L" />
        <VUBar level={isPlaying ? rightLevel : 0} peak={isPlaying ? peakRight : 0} label="R" />
      </div>
      
      {/* Divider */}
      <div className="w-px bg-border/30" />
      
      {/* Spectrum Analyzer */}
      <div className="flex-[2]">
        <div className="text-[8px] text-muted-foreground/50 uppercase tracking-wider mb-1">Spectrum</div>
        <div className="flex gap-[2px]">
          {spectrum.map((level, i) => (
            <SpectrumBar 
              key={i} 
              level={isPlaying ? level : 0} 
              label={SPECTRUM_LABELS[i]} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}
