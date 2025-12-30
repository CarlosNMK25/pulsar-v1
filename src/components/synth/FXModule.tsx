import { useState } from 'react';
import { ModuleCard } from './ModuleCard';
import { Knob } from './Knob';

interface FXModuleProps {
  reverbParams: {
    size: number;
    decay: number;
    damping: number;
    mix: number;
  };
  delayParams: {
    time: number;
    feedback: number;
    filter: number;
    mix: number;
  };
  onReverbChange: (params: Partial<FXModuleProps['reverbParams']>) => void;
  onDelayChange: (params: Partial<FXModuleProps['delayParams']>) => void;
}

export function FXModule({ 
  reverbParams, 
  delayParams, 
  onReverbChange, 
  onDelayChange 
}: FXModuleProps) {
  const [muted, setMuted] = useState(false);
  
  return (
    <ModuleCard 
      title="FX" 
      icon="✧" 
      muted={muted} 
      onMuteToggle={() => setMuted(!muted)}
    >
      <div className="space-y-4">
        {/* Reverb Section */}
        <div className="space-y-2">
          <div className="text-label text-muted-foreground flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
            Reverb
          </div>
          <div className="grid grid-cols-4 gap-3">
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
              value={reverbParams.mix * 100}
              onChange={(v) => onReverbChange({ mix: v / 100 })}
              label="Mix"
              size="sm"
              variant={muted ? 'secondary' : 'accent'}
            />
          </div>
        </div>

        {/* Delay Section */}
        <div className="space-y-2">
          <div className="text-label text-muted-foreground flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent/60" />
            Delay
          </div>
          <div className="grid grid-cols-4 gap-3">
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
              value={delayParams.mix * 100}
              onChange={(v) => onDelayChange({ mix: v / 100 })}
              label="Mix"
              size="sm"
              variant={muted ? 'secondary' : 'accent'}
            />
          </div>
        </div>
      </div>
    </ModuleCard>
  );
}
