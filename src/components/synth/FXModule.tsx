import { useState, useEffect } from 'react';
import { ModuleCard } from './ModuleCard';
import { Knob } from './Knob';
import { fxEngine, SyncDivision } from '@/audio/FXEngine';
import { cn } from '@/lib/utils';

interface FXModuleProps {
  reverbParams: {
    size: number;
    decay: number;
    damping: number;
    preDelay: number;
    lofi: number;
    mix: number;
  };
  delayParams: {
    time: number;
    feedback: number;
    filter: number;
    spread: number;
    mix: number;
    syncDivision: SyncDivision;
  };
  masterFilterParams: {
    lowpass: number;
    highpass: number;
  };
  bpm: number;
  onReverbChange: (params: Partial<FXModuleProps['reverbParams']>) => void;
  onDelayChange: (params: Partial<FXModuleProps['delayParams']>) => void;
  onMasterFilterChange: (params: Partial<FXModuleProps['masterFilterParams']>) => void;
}

const syncDivisions: SyncDivision[] = ['1/4', '1/8', '3/16'];

export function FXModule({ 
  reverbParams, 
  delayParams, 
  masterFilterParams,
  bpm,
  onReverbChange, 
  onDelayChange,
  onMasterFilterChange,
}: FXModuleProps) {
  const [muted, setMuted] = useState(false);

  // Apply bypass to FX engine when mute changes
  useEffect(() => {
    fxEngine.setBypass('all', muted);
  }, [muted]);

  // Sync delay to BPM when division changes
  const handleSyncChange = (division: SyncDivision) => {
    onDelayChange({ syncDivision: division });
    fxEngine.syncDelayToBpm(bpm, division);
  };
  
  return (
    <ModuleCard 
      title="FX" 
      icon="✧" 
      muted={muted} 
      onMuteToggle={() => setMuted(!muted)}
    >
      <div className="space-y-3">
        {/* Reverb + Delay in 2 columns */}
        <div className="grid grid-cols-2 gap-4">
          {/* Reverb Column */}
          <div className="space-y-2">
            <div className="text-label text-muted-foreground flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
              Reverb
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <Knob
                value={reverbParams.size * 100}
                onChange={(v) => onReverbChange({ size: v / 100 })}
                label="Size"
                size="sm"
                variant={muted ? 'secondary' : 'primary'}
              />
              <Knob
                value={reverbParams.decay * 100}
                onChange={(v) => onReverbChange({ decay: v / 100 })}
                label="Decay"
                size="sm"
                variant={muted ? 'secondary' : 'primary'}
              />
              <Knob
                value={reverbParams.damping * 100}
                onChange={(v) => onReverbChange({ damping: v / 100 })}
                label="Damp"
                size="sm"
                variant={muted ? 'secondary' : 'primary'}
              />
              <Knob
                value={reverbParams.preDelay * 100}
                onChange={(v) => onReverbChange({ preDelay: v / 100 })}
                label="PreDly"
                size="sm"
                variant={muted ? 'secondary' : 'primary'}
              />
              <Knob
                value={reverbParams.lofi * 100}
                onChange={(v) => onReverbChange({ lofi: v / 100 })}
                label="LoFi"
                size="sm"
                variant={muted ? 'secondary' : 'primary'}
              />
              <Knob
                value={reverbParams.mix * 100}
                onChange={(v) => onReverbChange({ mix: v / 100 })}
                label="Mix"
                size="sm"
                variant={muted ? 'secondary' : 'accent'}
              />
            </div>
          </div>

          {/* Delay Column */}
          <div className="space-y-2">
            <div className="text-label text-muted-foreground flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent/60" />
                Delay
              </div>
              <div className="flex gap-0.5">
                {syncDivisions.map(div => (
                  <button 
                    key={div}
                    onClick={() => handleSyncChange(div)}
                    className={cn(
                      "px-1 py-0.5 text-[9px] rounded transition-colors",
                      delayParams.syncDivision === div 
                        ? "bg-accent text-accent-foreground" 
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    )}
                  >
                    {div}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <Knob
                value={delayParams.time * 100}
                onChange={(v) => onDelayChange({ time: v / 100 })}
                label="Time"
                size="sm"
                variant={muted ? 'secondary' : 'primary'}
              />
              <Knob
                value={delayParams.feedback * 100}
                onChange={(v) => onDelayChange({ feedback: v / 100 })}
                label="Fdbk"
                size="sm"
                variant={muted ? 'secondary' : 'primary'}
              />
              <Knob
                value={delayParams.filter * 100}
                onChange={(v) => onDelayChange({ filter: v / 100 })}
                label="Filter"
                size="sm"
                variant={muted ? 'secondary' : 'primary'}
              />
              <Knob
                value={delayParams.spread * 100}
                onChange={(v) => onDelayChange({ spread: v / 100 })}
                label="Spread"
                size="sm"
                variant={muted ? 'secondary' : 'primary'}
              />
              <Knob
                value={delayParams.mix * 100}
                onChange={(v) => onDelayChange({ mix: v / 100 })}
                label="Mix"
                size="sm"
                variant={muted ? 'secondary' : 'accent'}
              />
            </div>
          </div>
        </div>

        {/* Master Filter Section */}
        <div className="pt-2 border-t border-border/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Knob 
                value={masterFilterParams.highpass * 100}
                onChange={(v) => onMasterFilterChange({ highpass: v / 100 })}
                label="HiPass" 
                size="sm" 
                variant="secondary" 
              />
            </div>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-px bg-gradient-to-r from-border/50 via-border to-border/50" />
              <span className="text-[9px] text-muted-foreground/60">Master</span>
              <div className="flex-1 h-px bg-gradient-to-r from-border/50 via-border to-border/50" />
            </div>
            <div className="flex items-center gap-2">
              <Knob 
                value={masterFilterParams.lowpass * 100}
                onChange={(v) => onMasterFilterChange({ lowpass: v / 100 })}
                label="LoPass" 
                size="sm" 
                variant="secondary" 
              />
            </div>
          </div>
        </div>
      </div>
    </ModuleCard>
  );
}