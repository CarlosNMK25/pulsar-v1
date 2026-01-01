import { useState } from 'react';
import { cn } from '@/lib/utils';
import { EuclideanControls } from './EuclideanControls';
import { PatternLengthSelector } from './PatternLengthSelector';
import { PLockEditor } from './PLockEditor';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { PLocks, AcidModifiers, ConditionType } from '@/hooks/useAudioEngine';

export interface Step {
  active: boolean;
  velocity: number;
  probability: number;
  pLocks?: PLocks;
  acid?: AcidModifiers;
  condition?: ConditionType;
  sliceIndex?: number; // For sample steps: which slice to trigger (-1 = sequential)
}

interface StepSequencerProps {
  steps: Step[];
  currentStep: number;
  onStepToggle: (index: number) => void;
  onStepVelocity?: (index: number, velocity: number) => void;
  onStepPLocks?: (index: number, pLocks: PLocks | undefined) => void;
  onStepAcid?: (index: number, acid: AcidModifiers | undefined) => void;
  onStepCondition?: (index: number, condition: ConditionType) => void;
  onStepSliceChange?: (index: number, sliceIndex: number) => void;
  onPatternGenerate?: (steps: Step[]) => void;
  onLengthChange?: (length: number) => void;
  patternLength?: number;
  showControls?: boolean;
  showLengthSelector?: boolean;
  showPLocks?: boolean;
  showAcid?: boolean;
  showConditions?: boolean;
  showSliceSelector?: boolean;
  showReverse?: boolean;
  showRatchet?: boolean;
  sliceCount?: number;
  label?: string;
  variant?: 'primary' | 'secondary' | 'muted';
  swing?: number;
  humanize?: number;
}

export const StepSequencer = ({
  steps,
  currentStep,
  onStepToggle,
  onStepPLocks,
  onStepAcid,
  onStepCondition,
  onStepSliceChange,
  onPatternGenerate,
  onLengthChange,
  patternLength,
  showControls = false,
  showLengthSelector = false,
  showPLocks = false,
  showAcid = false,
  showConditions = false,
  showSliceSelector = false,
  showReverse = false,
  showRatchet = false,
  sliceCount = 8,
  label,
  variant = 'primary',
  swing = 0,
  humanize = 0,
}: StepSequencerProps) => {
  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [sliceEditingStep, setSliceEditingStep] = useState<number | null>(null);
  
  // Use patternLength if provided, otherwise use steps.length
  const displayLength = patternLength ?? steps.length;
  const displaySteps = steps.slice(0, displayLength);
  
  // Calculate group indicators based on pattern length
  const numGroups = Math.ceil(displayLength / 4);
  const currentGroup = Math.floor(currentStep / 4);

  const handleContextMenu = (e: React.MouseEvent, index: number) => {
    if (!showPLocks && !showAcid && !showConditions && !showSliceSelector) return;
    e.preventDefault();
    if (showSliceSelector && onStepSliceChange) {
      setSliceEditingStep(index);
    } else {
      setEditingStep(index);
    }
  };

  const hasPLocks = (step: Step) => step.pLocks && Object.keys(step.pLocks).length > 0;
  const hasAcid = (step: Step) => step.acid && Object.values(step.acid).some(v => v);
  const hasCondition = (step: Step) => step.condition !== null && step.condition !== undefined;
  const hasSlice = (step: Step) => step.sliceIndex !== undefined && step.sliceIndex >= -2 && step.sliceIndex !== -1;

  // Get condition display color
  const getConditionColor = (condition: ConditionType) => {
    if (!condition) return '';
    if (condition.startsWith('!') && !condition.includes(':')) return 'text-orange-400'; // !FILL, !PRE
    if (condition === 'FILL' || condition === 'PRE') return 'text-orange-400';
    if (condition.startsWith('!')) return 'text-purple-400'; // !1:2, etc
    return 'text-cyan-400'; // ratio conditions
  };

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
                currentSteps={displaySteps}
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
              {/* Slice index indicator - top center */}
              {step.active && hasSlice(step) && (
                <div 
                  className={cn(
                    "absolute top-0 left-1/2 -translate-x-1/2 px-0.5 text-[8px] font-mono leading-none font-bold",
                    step.sliceIndex === -2 ? "text-secondary" : "text-chart-4"
                  )}
                  title={step.sliceIndex === -2 ? 'Random slice' : `Slice: ${(step.sliceIndex ?? 0) + 1}`}
                >
                  {step.sliceIndex === -2 ? '?' : (step.sliceIndex ?? 0) + 1}
                </div>
              )}
              
              {/* Ratchet indicator - bottom right */}
              {step.active && step.pLocks?.ratchet && step.pLocks.ratchet > 1 && (
                <div 
                  className="absolute bottom-0 right-0 px-0.5 text-[7px] font-mono leading-none font-bold text-orange-400"
                  title={`Ratchet: ${step.pLocks.ratchet}x`}
                >
                  {step.pLocks.ratchet}×
                </div>
              )}
              
              {/* Condition indicator - top left */}
              {step.active && hasCondition(step) && (
                <div 
                  className={cn(
                    "absolute top-0 left-0 px-0.5 text-[5px] font-mono leading-none font-bold",
                    getConditionColor(step.condition)
                  )}
                  title={`Condition: ${step.condition}`}
                >
                  {step.condition}
                </div>
              )}
              
              {/* Micro-timing indicator - shows timing offset visually */}
              {step.active && step.pLocks?.microTiming !== undefined && step.pLocks.microTiming !== 0 && (
                <div 
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 flex items-center justify-center"
                  title={`Micro-timing: ${step.pLocks.microTiming > 0 ? '+' : ''}${step.pLocks.microTiming}ms`}
                >
                  <div 
                    className="h-0.5 bg-cyan-400 rounded-full transition-all"
                    style={{
                      width: `${Math.abs(step.pLocks.microTiming)}%`,
                      marginLeft: step.pLocks.microTiming > 0 ? '50%' : undefined,
                      marginRight: step.pLocks.microTiming < 0 ? '50%' : undefined,
                      transformOrigin: step.pLocks.microTiming > 0 ? 'left' : 'right',
                    }}
                  />
                </div>
              )}
              
              {/* P-Lock indicator */}
              {step.active && hasPLocks(step) && !hasCondition(step) && (
                <div 
                  className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-yellow-400"
                  title="P-Lock active"
                />
              )}
              
              {/* P-Lock indicator when condition is present */}
              {step.active && hasPLocks(step) && hasCondition(step) && (
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
              {step.active && step.probability < 100 && !hasPLocks(step) && !hasCondition(step) && (
                <div 
                  className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-secondary"
                  title={`${step.probability}% probability`}
                />
              )}
              
              {/* Swing indicator - odd steps only */}
              {swing > 0 && index % 2 === 1 && (
                <div 
                  className="absolute top-0 right-0 w-0 h-0 border-t-[6px] border-r-[6px] border-t-cyan-400 border-r-transparent rounded-tr"
                  style={{ opacity: 0.3 + (swing / 100) * 0.7 }}
                  title={`Swing: ${swing}%`}
                />
              )}
              
              {/* Humanize indicator */}
              {humanize > 0 && step.active && (
                <div 
                  className="absolute inset-0 rounded border border-dashed border-orange-400"
                  style={{ opacity: 0.2 + (humanize / 100) * 0.4 }}
                  title={`Humanize: ${humanize}%`}
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

          // Wrap with slice selector popover if enabled
          if (showSliceSelector && onStepSliceChange) {
            return (
              <Popover 
                key={index}
                open={sliceEditingStep === index} 
                onOpenChange={(open) => setSliceEditingStep(open ? index : null)}
              >
                <PopoverTrigger asChild>
                  {stepButton}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="center">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Slice for Step {index + 1}</div>
                    <div className="grid grid-cols-4 gap-1">
                      <button
                        onClick={() => {
                          onStepSliceChange(index, -1);
                          setSliceEditingStep(null);
                        }}
                        className={cn(
                          'px-2 py-1 text-xs rounded border transition-colors col-span-2',
                          step.sliceIndex === -1 || step.sliceIndex === undefined
                            ? 'border-primary bg-primary/20 text-primary'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        )}
                      >
                        Sequential
                      </button>
                      <button
                        onClick={() => {
                          onStepSliceChange(index, -2);
                          setSliceEditingStep(null);
                        }}
                        className={cn(
                          'px-2 py-1 text-xs rounded border transition-colors col-span-2',
                          step.sliceIndex === -2
                            ? 'border-secondary bg-secondary/20 text-secondary'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        )}
                      >
                        🎲 Random
                      </button>
                      {Array.from({ length: sliceCount }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            onStepSliceChange(index, i);
                            setSliceEditingStep(null);
                          }}
                          className={cn(
                            'px-2 py-1 text-xs rounded border transition-colors',
                            step.sliceIndex === i
                              ? 'border-chart-4 bg-chart-4/20 text-chart-4'
                              : 'border-border text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            );
          }

          // Wrap with PLockEditor if editing is enabled
          if ((showPLocks || showAcid || showConditions) && onStepPLocks) {
            return (
              <PLockEditor
                key={index}
                stepIndex={index}
                pLocks={step.pLocks}
                acid={step.acid}
                condition={step.condition}
                onPLocksChange={(pLocks) => onStepPLocks(index, pLocks)}
                onAcidChange={onStepAcid ? (acid) => onStepAcid(index, acid) : undefined}
                onConditionChange={onStepCondition ? (cond) => onStepCondition(index, cond) : undefined}
                showAcid={showAcid}
                showConditions={showConditions}
                showReverse={showReverse}
                showRatchet={showRatchet}
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
      {(showPLocks || showAcid || showConditions || showSliceSelector) && (
        <div className="text-[10px] text-muted-foreground/50 text-right">
          {showSliceSelector ? 'Right-click step for slice selection' : `Right-click step for P-Locks${showConditions ? ' & Conditions' : ''}`}
        </div>
      )}
    </div>
  );
};
