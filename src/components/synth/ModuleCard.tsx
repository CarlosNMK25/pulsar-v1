import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface ModuleCardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  active?: boolean;
  muted?: boolean;
  onMuteToggle?: () => void;
  className?: string;
}

export const ModuleCard = ({
  title,
  icon,
  children,
  active = true,
  muted = false,
  onMuteToggle,
  className,
}: ModuleCardProps) => {
  return (
    <div
      className={cn(
        'module relative overflow-hidden animate-fade-in',
        muted && 'opacity-50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {/* Active LED */}
          <div className={cn('led', active && !muted && 'on')} />
          
          {icon && (
            <span className="text-muted-foreground">{icon}</span>
          )}
          
          <h3 className="text-sm font-medium uppercase tracking-wider">
            {title}
          </h3>
        </div>

        {onMuteToggle && (
          <button
            onClick={onMuteToggle}
            className={cn(
              'px-2 py-0.5 text-xs uppercase tracking-wider rounded',
              'border transition-colors',
              muted 
                ? 'border-destructive/50 text-destructive bg-destructive/10' 
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {muted ? 'Muted' : 'Mute'}
          </button>
        )}
      </div>

      {/* Content */}
      <div className={cn('transition-opacity', muted && 'pointer-events-none')}>
        {children}
      </div>

      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent to-background/20" />
    </div>
  );
};
