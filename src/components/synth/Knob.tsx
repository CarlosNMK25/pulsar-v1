import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface KnobProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'accent';
  showValue?: boolean;
  unit?: string;
}

const variantColors = {
  primary: 'hsl(var(--primary))',
  secondary: 'hsl(var(--secondary))',
  accent: 'hsl(var(--accent))',
};

const sizeClasses = {
  sm: 'w-10 h-10',
  md: 'w-14 h-14',
  lg: 'w-20 h-20',
};

const indicatorSizes = {
  sm: 'w-0.5 h-2',
  md: 'w-1 h-3',
  lg: 'w-1 h-4',
};

export function Knob({
  value,
  min = 0,
  max = 100,
  onChange,
  label,
  size = 'md',
  variant = 'primary',
  showValue = true,
  unit = '',
}: KnobProps) {
  const [isDragging, setIsDragging] = useState(false);
  const knobRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startValue = useRef(0);

  const normalizedValue = ((value - min) / (max - min)) * 270 - 135;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startY.current = e.clientY;
    startValue.current = value;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startY.current - e.clientY;
      const range = max - min;
      const sensitivity = range / 150;
      const newValue = Math.min(max, Math.max(min, startValue.current + delta * sensitivity));
      onChange(Math.round(newValue * 10) / 10);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [value, min, max, onChange]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        ref={knobRef}
        className={cn(
          'knob cursor-grab select-none transition-transform',
          sizeClasses[size],
          isDragging && 'cursor-grabbing scale-105',
          isDragging && variant === 'primary' && 'ring-2 ring-primary/50',
          isDragging && variant === 'secondary' && 'ring-2 ring-secondary/50',
          isDragging && variant === 'accent' && 'ring-2 ring-accent/50'
        )}
        onMouseDown={handleMouseDown}
      >
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-2 border-border/50" />
        
        {/* Value arc background */}
        <svg className="absolute inset-0 w-full h-full -rotate-[135deg]">
          <circle
            cx="50%"
            cy="50%"
            r="45%"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="2"
            strokeDasharray={`${270 * 0.9} 360`}
            strokeLinecap="round"
          />
          <circle
            cx="50%"
            cy="50%"
            r="45%"
            fill="none"
            stroke={variantColors[variant]}
            strokeWidth="2"
            strokeDasharray={`${((value - min) / (max - min)) * 270 * 0.9} 360`}
            strokeLinecap="round"
            className="transition-all duration-75"
            style={{
              filter: isDragging ? `drop-shadow(0 0 4px ${variantColors[variant]})` : 'none'
            }}
          />
        </svg>

        {/* Indicator line */}
        <div
          className={cn(
            'absolute rounded-full transition-all duration-75',
            indicatorSizes[size],
            variant === 'primary' && 'bg-primary',
            variant === 'secondary' && 'bg-secondary',
            variant === 'accent' && 'bg-accent'
          )}
          style={{
            transform: `rotate(${normalizedValue}deg)`,
            transformOrigin: 'center 200%',
            top: '15%',
            boxShadow: isDragging ? `0 0 8px ${variantColors[variant]}` : 'none'
          }}
        />
      </div>

      {showValue && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {Math.round(value)}{unit}
        </span>
      )}

      {label && (
        <span className="text-label">{label}</span>
      )}
    </div>
  );
}