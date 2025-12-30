import { useState } from 'react';
import { cn } from '@/lib/utils';
import { EuclideanControls } from './EuclideanControls';
import { PatternLengthSelector } from './PatternLengthSelector';
import { PLockEditor } from './PLockEditor';
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
  onStepPLocks?: (index: number, pLocks: PLocks | undefined) => void;
  onStepAcid?: (index: number, acid: AcidModifiers | undefined) => void;
  onPatternGenerate?: (steps: Step[]) => void;
  onLengthChange?: (length: number) => void;
  patternLength?: number;
  showControls?: boolean;
  showLengthSelector?: boolean;
  showPLocks?: boolean;
  showAcid?: boolean;
  label?: string;
  variant?: 'primary' | 'secondary' | 'muted';
}

export const StepSequencer = ({
  steps,
  currentStep,
  onStepToggle,
  onStepPLocks,
  onStepAcid,
  onPatternGenerate,
  onLengthChange,
  patternLength,
  showControls = false,
  showLengthSelector = false,
  showPLocks = false,
  showAcid = false,
  label,
  variant = 'primary',
}: StepSequencerProps) => {
  const [editingStep, setEditingStep] = useState<number | null>(null);
  
  // Use patternLength if provided, otherwise use steps.length
  const displayLength = patternLength ?? steps.length;
  const displaySteps = steps.slice(0, displayLength);
  
  // Calculate group indicators based on pattern length
  const numGroups = Math.ceil(displayLength / 4);
  const currentGroup = Math.floor(currentStep / 4);

  const handleContextMenu = (e: React.MouseEvent, index: number) => {
    if (!showPLocks && !showAcid) return;
    e.preventDefault();
    setEditingStep(index);
  };

  const hasPLocks = (step: Step) => step.pLocks && Object.keys(step.pLocks).length > 0;
  const hasAcid = (step: Step) => step.acid && Object.values(step.acid).some(v => v);

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
        {displaySteps.map((step, index) => {
          const stepButton = (
            <button
              key={index}
              onClick={() => onStepToggle(index)}
              onContextMenu={(e) => handleContextMenu(e, index)}
              className={cn(
                'relative flex-1 aspect-square rounded transition-all duration-75',
                'hover:scale-105 active:scale-95',
                'min-w-0',
                step.active ? (
                  variant === 'primary' 
                    ? 'bg-primary shadow-glow-sm' 
                    : variant === 'secondary'
                      ? 'bg-secondary'
                      : 'bg-muted-foreground'
                ) : 'bg-muted hover:bg-muted/80',
                currentStep === index && currentStep < displayLength && 'ring-2 ring-foreground/50',
                index % 4 === 0 && !step.active && 'bg-muted/80'
              )}
              style={{
                opacity: step.active ? 0.5 + (step.velocity / 127) * 0.5 : 1,
              }}
            >
              {/* P-Lock indicator */}
              {step.active && hasPLocks(step) && (
                <div 
                  className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-yellow-400"
                  title="P-Lock active"
                />
              )}
              
              {/* Acid 303 indicators */}
              {step.active && hasAcid(step) && (
                <div className="absolute bottom-0.5 left-0.5 flex gap-0.5">
                  {step.acid?.slide && (
                    <span className="text-[6px] text-primary" title="Slide">↗</span>
                  )}
                  {step.acid?.accent && (
                    <span className="text-[6px] text-secondary" title="Accent">●</span>
                  )}
                  {step.acid?.tie && (
                    <span className="text-[6px] text-foreground" title="Tie">─</span>
                  )}
                </div>
              )}
              
              {/* Probability indicator */}
              {step.active && step.probability < 100 && !hasPLocks(step) && (
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
          );

          // Wrap with PLockEditor if editing is enabled
          if ((showPLocks || showAcid) && onStepPLocks) {
            return (
              <PLockEditor
                key={index}
                stepIndex={index}
                pLocks={step.pLocks}
                acid={step.acid}
                onPLocksChange={(pLocks) => onStepPLocks(index, pLocks)}
                onAcidChange={onStepAcid ? (acid) => onStepAcid(index, acid) : undefined}
                showAcid={showAcid}
                trigger={stepButton}
                open={editingStep === index}
                onOpenChange={(open) => setEditingStep(open ? index : null)}
              />
            );
          }

          return stepButton;
        })}
      </div>
      
      {/* Right-click hint */}
      {(showPLocks || showAcid) && (
        <div className="text-[10px] text-muted-foreground/50 text-right">
          Right-click step for P-Locks
        </div>
      )}
    </div>
  );
};
