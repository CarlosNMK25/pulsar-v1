import { cn } from '@/lib/utils';

interface FXMeterProps {
  level: number;
  className?: string;
}

export function FXMeter({ level, className }: FXMeterProps) {
  const barCount = 16;
  
  return (
    <div className={cn("flex items-center gap-0.5 h-2", className)}>
      {Array.from({ length: barCount }).map((_, i) => {
        const threshold = i / barCount;
        const isActive = level > threshold;
        const isHot = i >= barCount - 2;
        const isWarm = i >= barCount - 5 && i < barCount - 2;
        
        return (
          <div
            key={i}
            className={cn(
              "flex-1 h-full rounded-[2px] transition-all duration-75",
              isActive
                ? isHot
                  ? "bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]"
                  : isWarm
                    ? "bg-yellow-500"
                    : "bg-primary"
                : "bg-muted/20"
            )}
          />
        );
      })}
    </div>
  );
}
