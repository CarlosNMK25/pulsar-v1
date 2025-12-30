import { cn } from '@/lib/utils';
import { EuclideanControls } from './EuclideanControls';
import { PatternLengthSelector } from './PatternLengthSelector';
import type { PLocks, AcidModifiers } from '@/hooks/useAudioEngine';

export interface Step {
  active: boolean;
  velocity: number;
  probability: number;
  pLocks?: PLocks;
  acid?: AcidModifiers;
}

interface StepSequencerProps {
  steps: Step[];
  currentStep: number;
  onStepToggle: (index: number) => void;
  onStepVelocity?: (index: number, velocity: number) => void;
  onPatternGenerate?: (steps: Step[]) => void;
  onLengthChange?: (length: number) => void;
  patternLength?: number;
  showControls?: boolean;
  showLengthSelector?: boolean;
  label?: string;
  variant?: 'primary' | 'secondary' | 'muted';
}

export const StepSequencer = ({
  steps,
  currentStep,
  onStepToggle,
  onPatternGenerate,
  onLengthChange,
  patternLength,
  showControls = false,
  showLengthSelector = false,
  label,
  variant = 'primary',
}: StepSequencerProps) => {
  // Use patternLength if provided, otherwise use steps.length
  const displayLength = patternLength ?? steps.length;
  const displaySteps = steps.slice(0, displayLength);
  
  // Calculate group indicators based on pattern length
  const numGroups = Math.ceil(displayLength / 4);
  const currentGroup = Math.floor(currentStep / 4);

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-label">{label}</span>
            {showLengthSelector && onLengthChange && (
              <PatternLengthSelector
                length={displayLength}
                onChange={onLengthChange}
                variant={variant}
              />
            )}
            {showControls && onPatternGenerate && (
              <EuclideanControls
                onPatternGenerate={onPatternGenerate}
                patternLength={displayLength}
                variant={variant}
              />
            )}
          </div>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(numGroups, 8) }).map((_, group) => (
              <div key={group} className={cn(
                'w-1.5 h-1.5 rounded-full',
                currentGroup === group && currentStep < displayLength ? 'bg-primary' : 'bg-muted'
              )} />
            ))}
          </div>
        </div>
      )}
      
      <div className="flex gap-1">
        {displaySteps.map((step, index) => (
          <button
            key={index}
            onClick={() => onStepToggle(index)}
            className={cn(
              'relative flex-1 aspect-square rounded transition-all duration-75',
              'hover:scale-105 active:scale-95',
              'min-w-0', // Allow steps to shrink for longer patterns
              step.active ? (
                variant === 'primary' 
                  ? 'bg-primary shadow-glow-sm' 
                  : variant === 'secondary'
                    ? 'bg-secondary'
                    : 'bg-muted-foreground'
              ) : 'bg-muted hover:bg-muted/80',
              currentStep === index && currentStep < displayLength && 'ring-2 ring-foreground/50',
              // Accent every 4th step
              index % 4 === 0 && !step.active && 'bg-muted/80'
            )}
            style={{
              opacity: step.active ? 0.5 + (step.velocity / 127) * 0.5 : 1,
            }}
          >
            {/* Probability indicator */}
            {step.active && step.probability < 100 && (
              <div 
                className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-secondary"
                title={`${step.probability}% probability`}
              />
            )}
            
            {/* Current step glow */}
            {currentStep === index && step.active && (
              <div className={cn(
                'absolute inset-0 rounded animate-step-trigger',
                variant === 'primary' ? 'bg-primary/50' : 'bg-secondary/50'
              )} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
