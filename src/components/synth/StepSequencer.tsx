import { cn } from '@/lib/utils';

interface Step {
  active: boolean;
  velocity: number;
  probability: number;
}

interface StepSequencerProps {
  steps: Step[];
  currentStep: number;
  onStepToggle: (index: number) => void;
  onStepVelocity?: (index: number, velocity: number) => void;
  label?: string;
  variant?: 'primary' | 'secondary' | 'muted';
}

export const StepSequencer = ({
  steps,
  currentStep,
  onStepToggle,
  label,
  variant = 'primary',
}: StepSequencerProps) => {
  const getStepColor = (step: Step, index: number) => {
    if (!step.active) return 'bg-muted hover:bg-muted-foreground/20';
    
    const colors = {
      primary: 'bg-primary',
      secondary: 'bg-secondary',
      muted: 'bg-muted-foreground',
    };
    
    // Vary opacity by velocity
    const opacity = 0.5 + (step.velocity / 127) * 0.5;
    
    return cn(colors[variant], `opacity-${Math.round(opacity * 100)}`);
  };

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-label">{label}</span>
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((group) => (
              <div key={group} className={cn(
                'w-1.5 h-1.5 rounded-full',
                Math.floor(currentStep / 4) === group ? 'bg-primary' : 'bg-muted'
              )} />
            ))}
          </div>
        </div>
      )}
      
      <div className="flex gap-1">
        {steps.map((step, index) => (
          <button
            key={index}
            onClick={() => onStepToggle(index)}
            className={cn(
              'relative flex-1 aspect-square rounded transition-all duration-75',
              'hover:scale-105 active:scale-95',
              step.active ? (
                variant === 'primary' 
                  ? 'bg-primary shadow-glow-sm' 
                  : variant === 'secondary'
                    ? 'bg-secondary'
                    : 'bg-muted-foreground'
              ) : 'bg-muted hover:bg-muted/80',
              currentStep === index && 'ring-2 ring-foreground/50',
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
