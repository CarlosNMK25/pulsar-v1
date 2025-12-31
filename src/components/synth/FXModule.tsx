import { useState, useEffect } from 'react';
import { ModuleCard } from './ModuleCard';
import { Knob } from './Knob';
import { FXVisualizer } from './FXVisualizer';
import { SendMatrix } from './SendMatrix';
import { fxEngine, SyncDivision } from '@/audio/FXEngine';
import { useFXAnalyser } from '@/hooks/useFXAnalyser';
import { TrackName, TrackSendLevels, FXRoutingMode, FXTarget } from '@/hooks/useFXState';
import { Button } from '@/components/ui/button';
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
  sendLevels: TrackSendLevels;
  bpm: number;
  isPlaying: boolean;
  fxRoutingMode: FXRoutingMode;
  fxTargets: FXTarget[];
  onReverbChange: (params: Partial<FXModuleProps['reverbParams']>) => void;
  onDelayChange: (params: Partial<FXModuleProps['delayParams']>) => void;
  onMasterFilterChange: (params: Partial<FXModuleProps['masterFilterParams']>) => void;
  onSendChange: (track: TrackName, effect: 'reverb' | 'delay', value: number) => void;
  onRoutingModeChange: (mode: FXRoutingMode) => void;
  onTargetToggle: (target: FXTarget) => void;
}

const syncDivisions: SyncDivision[] = ['1/4', '1/8', '3/16'];

const individualButtons: { id: FXTarget; label: string }[] = [
  { id: 'drums', label: 'D' },
  { id: 'synth', label: 'S' },
  { id: 'texture', label: 'T' },
  { id: 'sample', label: 'Smp' },
  { id: 'glitch', label: 'G' },
];

export function FXModule({ 
  reverbParams, 
  delayParams, 
  masterFilterParams,
  sendLevels,
  bpm,
  isPlaying,
  fxRoutingMode,
  fxTargets,
  onReverbChange, 
  onDelayChange,
  onMasterFilterChange,
  onSendChange,
  onRoutingModeChange,
  onTargetToggle,
}: FXModuleProps) {
  const [muted, setMuted] = useState(false);
  const levels = useFXAnalyser(isPlaying && !muted);
  const { reverb: reverbLevel, delay: delayLevel } = levels;
  
  const isActive = fxRoutingMode === 'master' || fxTargets.length > 0;
  const showNoTargetWarning = fxRoutingMode === 'individual' && fxTargets.length === 0;

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
        {/* Routing Mode Selector */}
        <div className="space-y-2">
          <div className="flex gap-1">
            <Button
              variant={fxRoutingMode === 'master' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onRoutingModeChange('master')}
              className={cn(
                'flex-1 h-7 text-[10px] font-medium',
                fxRoutingMode === 'master' && 'bg-primary text-primary-foreground'
              )}
            >
              MASTER
            </Button>
            <Button
              variant={fxRoutingMode === 'individual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onRoutingModeChange('individual')}
              className={cn(
                'flex-1 h-7 text-[10px] font-medium',
                fxRoutingMode === 'individual' && 'bg-primary text-primary-foreground'
              )}
            >
              TRACKS
            </Button>
          </div>
          
          {/* Individual track selectors - only visible in individual mode */}
          {fxRoutingMode === 'individual' && (
            <div className="flex gap-1">
              {individualButtons.map(({ id, label }) => (
                <Button
                  key={id}
                  variant={fxTargets.includes(id) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onTargetToggle(id)}
                  className={cn(
                    'flex-1 h-6 text-[10px] font-mono transition-all',
                    fxTargets.includes(id) 
                      ? 'bg-primary/80 text-primary-foreground border-primary' 
                      : 'opacity-60 hover:opacity-100'
                  )}
                >
                  {label}
                </Button>
              ))}
            </div>
          )}
          
          {/* Warning when no target selected in individual mode */}
          {showNoTargetWarning && (
            <div className="text-[9px] text-muted-foreground/60 text-center italic">
              Select a track
            </div>
          )}
        </div>

        {/* Reverb + Delay in 2 columns */}
        <div className="grid grid-cols-2 gap-4">
          {/* Reverb Column */}
          <div className="space-y-2">
            <div className="text-label text-muted-foreground flex items-center gap-2">
              <span 
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all duration-100",
                  reverbLevel > 0.05 
                    ? "bg-primary shadow-[0_0_6px_hsl(var(--primary))]"
                    : "bg-primary/30"
                )} 
              />
              Reverb
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <Knob
                value={reverbParams.size * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onReverbChange({ size: val });
                  fxEngine.setReverbParams({ size: val });
                }}
                label="Size"
                size="sm"
                variant={muted ? 'secondary' : 'primary'}
              />
              <Knob
                value={reverbParams.decay * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onReverbChange({ decay: val });
                  fxEngine.setReverbParams({ decay: val });
                }}
                label="Decay"
                size="sm"
                variant={muted ? 'secondary' : 'primary'}
              />
              <Knob
                value={reverbParams.damping * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onReverbChange({ damping: val });
                  fxEngine.setReverbParams({ damping: val });
                }}
                label="Damp"
                size="sm"
                variant={muted ? 'secondary' : 'primary'}
              />
              <Knob
                value={reverbParams.preDelay * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onReverbChange({ preDelay: val });
                  fxEngine.setReverbParams({ preDelay: val });
                }}
                label="PreDly"
                size="sm"
                variant={muted ? 'secondary' : 'primary'}
              />
              <Knob
                value={reverbParams.lofi * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onReverbChange({ lofi: val });
                  fxEngine.setReverbParams({ lofi: val });
                }}
                label="LoFi"
                size="sm"
                variant={muted ? 'secondary' : 'primary'}
              />
              <Knob
                value={reverbParams.mix * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onReverbChange({ mix: val });
                  fxEngine.setReverbParams({ mix: val });
                }}
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
                <span 
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all duration-100",
                    delayLevel > 0.05 
                      ? "bg-accent shadow-[0_0_6px_hsl(var(--accent))]"
                      : "bg-accent/30"
                  )} 
                />
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
                onChange={(v) => {
                  const val = v / 100;
                  onDelayChange({ time: val });
                  fxEngine.setDelayParams({ time: val });
                }}
                label="Time"
                size="sm"
                variant={muted ? 'secondary' : 'primary'}
              />
              <Knob
                value={delayParams.feedback * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onDelayChange({ feedback: val });
                  fxEngine.setDelayParams({ feedback: val });
                }}
                label="Fdbk"
                size="sm"
                variant={muted ? 'secondary' : 'primary'}
              />
              <Knob
                value={delayParams.filter * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onDelayChange({ filter: val });
                  fxEngine.setDelayParams({ filter: val });
                }}
                label="Filter"
                size="sm"
                variant={muted ? 'secondary' : 'primary'}
              />
              <Knob
                value={delayParams.spread * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onDelayChange({ spread: val });
                  fxEngine.setDelayParams({ spread: val });
                }}
                label="Spread"
                size="sm"
                variant={muted ? 'secondary' : 'primary'}
              />
              <Knob
                value={delayParams.mix * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onDelayChange({ mix: val });
                  fxEngine.setDelayParams({ mix: val });
                }}
                label="Mix"
                size="sm"
                variant={muted ? 'secondary' : 'accent'}
              />
            </div>
          </div>
        </div>

        {/* Wet Signal Visualizer */}
        <div className="py-2">
          <FXVisualizer 
            leftLevel={levels.masterLeft}
            rightLevel={levels.masterRight}
            peakLeft={levels.peakLeft}
            peakRight={levels.peakRight}
            spectrum={levels.spectrum}
            isPlaying={isPlaying && !muted}
          />
        </div>

        {/* Send Matrix */}
        <div className="py-2 border-t border-border/30">
          <SendMatrix sendLevels={sendLevels} onSendChange={onSendChange} />
        </div>

        {/* Master Filter Section */}
        <div className="pt-2 border-t border-border/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Knob 
                value={masterFilterParams.highpass * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onMasterFilterChange({ highpass: val });
                  fxEngine.setMasterFilterParams({ highpass: val });
                }}
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
                onChange={(v) => {
                  const val = v / 100;
                  onMasterFilterChange({ lowpass: val });
                  fxEngine.setMasterFilterParams({ lowpass: val });
                }}
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