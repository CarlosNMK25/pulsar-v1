import { cn } from '@/lib/utils';

interface FXVisualizerProps {
  leftLevel: number;
  rightLevel: number;
  peakLeft: number;
  peakRight: number;
  spectrum: number[];
  isPlaying: boolean;
  compact?: boolean;
  className?: string;
}

const VU_SEGMENTS = 20;
const VU_SEGMENTS_COMPACT = 12;
const SPECTRUM_LABELS = ['Sub', 'Bass', 'Lo', 'Mid', 'Hi', 'Prs', 'Bri', 'Air'];
const SPECTRUM_LABELS_COMPACT = ['Lo', 'M', 'Hi', 'Air'];

function VUBar({ level, peak, label, compact }: { level: number; peak: number; label: string; compact?: boolean }) {
  const segments = compact ? VU_SEGMENTS_COMPACT : VU_SEGMENTS;
  
  return (
    <div className="flex items-center gap-1">
      <span className={cn("text-muted-foreground", compact ? "text-[7px] w-2" : "text-[8px] w-3")}>{label}</span>
      <div className={cn("flex-1 flex items-center gap-[1px] relative", compact ? "h-2" : "h-3")}>
        {Array.from({ length: segments }).map((_, i) => {
          const threshold = i / segments;
          const isActive = level > threshold;
          const isHot = i >= segments - 2;
          const isWarm = i >= segments - 4 && i < segments - 2;
          
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
            className={cn(
              "absolute top-0 h-full w-[2px] bg-foreground/80 rounded-sm transition-all duration-75",
              compact && "w-[1px]"
            )}
            style={{ left: `${Math.min(peak, 1) * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

function SpectrumBar({ level, label, compact }: { level: number; label: string; compact?: boolean }) {
  const height = Math.max(level * 100, 2);
  const isHigh = level > 0.6;
  const isMid = level > 0.35;
  
  return (
    <div className="flex flex-col items-center gap-0.5 flex-1">
      <div className={cn("w-full flex items-end justify-center", compact ? "h-4" : "h-6")}>
        <div 
          className={cn(
            "w-full rounded-t-sm transition-all duration-75",
            compact ? "max-w-[5px]" : "max-w-[8px]",
            isHigh 
              ? "bg-accent shadow-[0_0_6px_hsl(var(--accent)/0.5)]"
              : isMid
                ? "bg-primary"
                : "bg-primary/70"
          )}
          style={{ height: `${height}%` }}
        />
      </div>
      {!compact && <span className="text-[6px] text-muted-foreground/60">{label}</span>}
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
  compact,
  className 
}: FXVisualizerProps) {
  // In compact mode, show reduced spectrum bands
  const displaySpectrum = compact 
    ? [spectrum[0], spectrum[3], spectrum[5], spectrum[7]] 
    : spectrum;
  const displayLabels = compact ? SPECTRUM_LABELS_COMPACT : SPECTRUM_LABELS;
  
  if (compact) {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        {/* Wet Signal - Compact VU */}
        <div className="space-y-0.5">
          <div className="text-[7px] text-muted-foreground/50 uppercase tracking-wider">Wet</div>
          <VUBar level={isPlaying ? leftLevel : 0} peak={isPlaying ? peakLeft : 0} label="L" compact />
          <VUBar level={isPlaying ? rightLevel : 0} peak={isPlaying ? peakRight : 0} label="R" compact />
        </div>
        
        {/* Spectrum - Compact */}
        <div>
          <div className="text-[7px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">Spec</div>
          <div className="flex gap-[1px]">
            {displaySpectrum.map((level, i) => (
              <SpectrumBar 
                key={i} 
                level={isPlaying ? level : 0} 
                label={displayLabels[i]} 
                compact
              />
            ))}
          </div>
        </div>
      </div>
    );
  }
  
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
