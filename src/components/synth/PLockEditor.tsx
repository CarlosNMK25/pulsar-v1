import { useState, useEffect } from 'react';
import { Knob } from './Knob';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { X } from 'lucide-react';
import type { PLocks, AcidModifiers, ConditionType } from '@/hooks/useAudioEngine';
import { cn } from '@/lib/utils';

interface PLockEditorProps {
  stepIndex: number;
  pLocks?: PLocks;
  acid?: AcidModifiers;
  condition?: ConditionType;
  onPLocksChange: (pLocks: PLocks | undefined) => void;
  onAcidChange?: (acid: AcidModifiers | undefined) => void;
  onConditionChange?: (condition: ConditionType) => void;
  showAcid?: boolean;
  showConditions?: boolean;
  showReverse?: boolean;
  showRatchet?: boolean;
  trigger: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RATIO_CONDITIONS: ConditionType[] = ['1:2', '1:3', '1:4', '2:3', '2:4', '3:4'];
const INVERSE_CONDITIONS: ConditionType[] = ['!1:2', '!1:3', '!1:4'];
const SPECIAL_CONDITIONS: ConditionType[] = ['FILL', '!FILL', 'PRE', '!PRE'];

export const PLockEditor = ({
  stepIndex,
  pLocks,
  acid,
  condition,
  onPLocksChange,
  onAcidChange,
  onConditionChange,
  showAcid = false,
  showConditions = false,
  showReverse = false,
  showRatchet = false,
  trigger,
  open,
  onOpenChange,
}: PLockEditorProps) => {
  const [localPLocks, setLocalPLocks] = useState<PLocks>(pLocks || {});
  const [localAcid, setLocalAcid] = useState<AcidModifiers>(acid || {});
  const [localCondition, setLocalCondition] = useState<ConditionType>(condition || null);

  useEffect(() => {
    setLocalPLocks(pLocks || {});
    setLocalAcid(acid || {});
    setLocalCondition(condition || null);
  }, [pLocks, acid, condition, stepIndex]);

  const handlePLockChange = (key: keyof PLocks, value: number) => {
    const updated = { ...localPLocks, [key]: value };
    setLocalPLocks(updated);
    onPLocksChange(Object.keys(updated).length > 0 ? updated : undefined);
  };

  const handleAcidToggle = (key: keyof AcidModifiers) => {
    const updated = { ...localAcid, [key]: !localAcid[key] };
    setLocalAcid(updated);
    onAcidChange?.(Object.values(updated).some(v => v) ? updated : undefined);
  };

  const handleConditionChange = (cond: ConditionType) => {
    const newCondition = localCondition === cond ? null : cond;
    setLocalCondition(newCondition);
    onConditionChange?.(newCondition);
  };

  const clearPLock = (key: keyof PLocks) => {
    const updated = { ...localPLocks };
    delete updated[key];
    setLocalPLocks(updated);
    onPLocksChange(Object.keys(updated).length > 0 ? updated : undefined);
  };

  const clearAll = () => {
    setLocalPLocks({});
    setLocalAcid({});
    setLocalCondition(null);
    onPLocksChange(undefined);
    onAcidChange?.(undefined);
    onConditionChange?.(null);
  };

  const hasPLocks = Object.keys(localPLocks).length > 0;
  const hasAcid = Object.values(localAcid).some(v => v);
  const hasCondition = localCondition !== null;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent 
        className="w-72 p-3 bg-card border-border" 
        side="top"
        align="center"
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">
              Step {stepIndex + 1} P-Locks
            </span>
            {(hasPLocks || hasAcid || hasCondition) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={clearAll}
              >
                <X className="w-3 h-3 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* P-Lock Knobs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="relative">
              <Knob
                value={localPLocks.cutoff ?? 50}
                onChange={(v) => handlePLockChange('cutoff', v)}
                label="Cutoff"
                size="sm"
                variant={localPLocks.cutoff !== undefined ? 'primary' : 'secondary'}
              />
              {localPLocks.cutoff !== undefined && (
                <button
                  onClick={() => clearPLock('cutoff')}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center"
                >
                  ×
                </button>
              )}
            </div>
            <div className="relative">
              <Knob
                value={localPLocks.resonance ?? 50}
                onChange={(v) => handlePLockChange('resonance', v)}
                label="Reso"
                size="sm"
                variant={localPLocks.resonance !== undefined ? 'secondary' : 'accent'}
              />
              {localPLocks.resonance !== undefined && (
                <button
                  onClick={() => clearPLock('resonance')}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center"
                >
                  ×
                </button>
              )}
            </div>
            <div className="relative">
              <Knob
                value={localPLocks.pitch ?? 50}
                onChange={(v) => handlePLockChange('pitch', v)}
                label="Pitch"
                size="sm"
                variant={localPLocks.pitch !== undefined ? 'primary' : 'accent'}
              />
              {localPLocks.pitch !== undefined && (
                <button
                  onClick={() => clearPLock('pitch')}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center"
                >
                  ×
                </button>
              )}
            </div>
            <div className="relative">
              <Knob
                value={localPLocks.decay ?? 50}
                onChange={(v) => handlePLockChange('decay', v)}
                label="Decay"
                size="sm"
                variant={localPLocks.decay !== undefined ? 'secondary' : 'accent'}
              />
              {localPLocks.decay !== undefined && (
                <button
                  onClick={() => clearPLock('decay')}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center"
                >
                  ×
                </button>
              )}
            </div>
            <div className="relative">
              <Knob
                value={localPLocks.fmAmount ?? 0}
                onChange={(v) => handlePLockChange('fmAmount', v)}
                label="FM"
                size="sm"
                variant={localPLocks.fmAmount !== undefined ? 'primary' : 'accent'}
              />
              {localPLocks.fmAmount !== undefined && (
                <button
                  onClick={() => clearPLock('fmAmount')}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center"
                >
                  ×
                </button>
              )}
            </div>
          </div>
          
          {/* Micro-Timing Slider */}
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Micro-Timing</span>
              <span className="text-xs font-mono text-foreground">
                {localPLocks.microTiming !== undefined 
                  ? `${localPLocks.microTiming > 0 ? '+' : ''}${localPLocks.microTiming}ms` 
                  : '0ms'}
              </span>
            </div>
            <div className="relative">
              <input
                type="range"
                min={-50}
                max={50}
                step={1}
                value={localPLocks.microTiming ?? 0}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (value === 0) {
                    clearPLock('microTiming');
                  } else {
                    handlePLockChange('microTiming', value);
                  }
                }}
                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted"
                style={{
                  background: `linear-gradient(to right, 
                    hsl(var(--muted)) 0%, 
                    hsl(var(--muted)) 50%, 
                    hsl(var(--muted)) 100%)`
                }}
              />
              <div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-3 bg-primary/50"
              />
            </div>
          </div>

          {/* Reverse & Ratchet (Sample-specific) */}
          {(showReverse || showRatchet) && (
            <div className="pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground mb-2 block">Sample Options</span>
              <div className="flex gap-2">
                {showReverse && (
                  <button
                    onClick={() => {
                      const updated = { ...localPLocks, reverse: !localPLocks.reverse };
                      if (!updated.reverse) delete updated.reverse;
                      setLocalPLocks(updated);
                      onPLocksChange(Object.keys(updated).length > 0 ? updated : undefined);
                    }}
                    className={cn(
                      'flex-1 py-1.5 text-xs rounded border transition-colors',
                      localPLocks.reverse
                        ? 'border-destructive bg-destructive/20 text-destructive'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    ⟲ Reverse
                  </button>
                )}
                {showRatchet && (
                  <div className="flex-1 flex gap-1">
                    {[1, 2, 3, 4].map((count) => (
                      <button
                        key={count}
                        onClick={() => {
                          const updated = { ...localPLocks, ratchet: count === 1 ? undefined : count };
                          if (count === 1) delete updated.ratchet;
                          setLocalPLocks(updated);
                          onPLocksChange(Object.keys(updated).length > 0 ? updated : undefined);
                        }}
                        className={cn(
                          'flex-1 py-1.5 text-xs rounded border transition-colors',
                          (localPLocks.ratchet ?? 1) === count
                            ? 'border-orange-400 bg-orange-400/20 text-orange-400'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {count}×
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Acid 303 Toggles */}
          {showAcid && (
            <div className="pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground mb-2 block">Acid 303</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAcidToggle('slide')}
                  className={cn(
                    'flex-1 py-1.5 text-xs rounded border transition-colors',
                    localAcid.slide
                      ? 'border-primary bg-primary/20 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  ↗ Slide
                </button>
                <button
                  onClick={() => handleAcidToggle('accent')}
                  className={cn(
                    'flex-1 py-1.5 text-xs rounded border transition-colors',
                    localAcid.accent
                      ? 'border-secondary bg-secondary/20 text-secondary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  ● Accent
                </button>
                <button
                  onClick={() => handleAcidToggle('tie')}
                  className={cn(
                    'flex-1 py-1.5 text-xs rounded border transition-colors',
                    localAcid.tie
                      ? 'border-muted-foreground bg-muted text-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  ─ Tie
                </button>
              </div>
            </div>
          )}

          {/* Conditional Triggers */}
          {showConditions && (
            <div className="pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground mb-2 block">Condition</span>
              
              {/* Ratio conditions */}
              <div className="flex flex-wrap gap-1 mb-2">
                {RATIO_CONDITIONS.map(cond => (
                  <button
                    key={cond}
                    onClick={() => handleConditionChange(cond)}
                    className={cn(
                      'px-2 py-1 text-xs rounded border transition-colors font-mono',
                      localCondition === cond 
                        ? 'border-cyan-400 bg-cyan-400/20 text-cyan-400' 
                        : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                    )}
                  >
                    {cond}
                  </button>
                ))}
              </div>
              
              {/* Inverse conditions */}
              <div className="flex flex-wrap gap-1 mb-2">
                {INVERSE_CONDITIONS.map(cond => (
                  <button
                    key={cond}
                    onClick={() => handleConditionChange(cond)}
                    className={cn(
                      'px-2 py-1 text-xs rounded border transition-colors font-mono',
                      localCondition === cond 
                        ? 'border-purple-400 bg-purple-400/20 text-purple-400' 
                        : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                    )}
                  >
                    {cond}
                  </button>
                ))}
              </div>
              
              {/* FILL and PRE conditions */}
              <div className="flex gap-1">
                {SPECIAL_CONDITIONS.map(cond => (
                  <button
                    key={cond}
                    onClick={() => handleConditionChange(cond)}
                    className={cn(
                      'flex-1 py-1 text-xs rounded border transition-colors font-mono',
                      localCondition === cond 
                        ? 'border-orange-400 bg-orange-400/20 text-orange-400' 
                        : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                    )}
                  >
                    {cond}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
