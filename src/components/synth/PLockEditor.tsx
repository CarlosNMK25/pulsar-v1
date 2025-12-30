import { useState, useEffect } from 'react';
import { Knob } from './Knob';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { X } from 'lucide-react';
import type { PLocks, AcidModifiers } from '@/hooks/useAudioEngine';
import { cn } from '@/lib/utils';

interface PLockEditorProps {
  stepIndex: number;
  pLocks?: PLocks;
  acid?: AcidModifiers;
  onPLocksChange: (pLocks: PLocks | undefined) => void;
  onAcidChange?: (acid: AcidModifiers | undefined) => void;
  showAcid?: boolean;
  trigger: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PLockEditor = ({
  stepIndex,
  pLocks,
  acid,
  onPLocksChange,
  onAcidChange,
  showAcid = false,
  trigger,
  open,
  onOpenChange,
}: PLockEditorProps) => {
  const [localPLocks, setLocalPLocks] = useState<PLocks>(pLocks || {});
  const [localAcid, setLocalAcid] = useState<AcidModifiers>(acid || {});

  useEffect(() => {
    setLocalPLocks(pLocks || {});
    setLocalAcid(acid || {});
  }, [pLocks, acid, stepIndex]);

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

  const clearPLock = (key: keyof PLocks) => {
    const updated = { ...localPLocks };
    delete updated[key];
    setLocalPLocks(updated);
    onPLocksChange(Object.keys(updated).length > 0 ? updated : undefined);
  };

  const clearAll = () => {
    setLocalPLocks({});
    setLocalAcid({});
    onPLocksChange(undefined);
    onAcidChange?.(undefined);
  };

  const hasPLocks = Object.keys(localPLocks).length > 0;
  const hasAcid = Object.values(localAcid).some(v => v);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent 
        className="w-64 p-3 bg-card border-border" 
        side="top"
        align="center"
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">
              Step {stepIndex + 1} P-Locks
            </span>
            {(hasPLocks || hasAcid) && (
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
          <div className="grid grid-cols-2 gap-3">
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
        </div>
      </PopoverContent>
    </Popover>
  );
};
