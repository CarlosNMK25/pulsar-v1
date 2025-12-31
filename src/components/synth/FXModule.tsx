import { useState, useEffect, useMemo } from 'react';
import { ModuleCard } from './ModuleCard';
import { Knob } from './Knob';
import { FXVisualizer } from './FXVisualizer';
import { SendMatrix } from './SendMatrix';
import { fxEngine, SyncDivision } from '@/audio/FXEngine';
import { useFXAnalyser } from '@/hooks/useFXAnalyser';
import { 
  TrackName, 
  TrackSendLevels, 
  FXRoutingMode, 
  FXTarget,
  FXOffsetsPerTrack,
  TrackFXOffsets,
} from '@/hooks/useFXState';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RotateCcw } from 'lucide-react';

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
    resonance: number;
    width: number;
  };
  sendLevels: TrackSendLevels;
  bpm: number;
  isPlaying: boolean;
  fxRoutingMode: FXRoutingMode;
  fxTargets: FXTarget[];
  fxOffsetsPerTrack: FXOffsetsPerTrack;
  onReverbChange: (params: Partial<FXModuleProps['reverbParams']>) => void;
  onDelayChange: (params: Partial<FXModuleProps['delayParams']>) => void;
  onMasterFilterChange: (params: Partial<FXModuleProps['masterFilterParams']>) => void;
  onSendChange: (track: TrackName, effect: 'reverb' | 'delay', value: number) => void;
  onRoutingModeChange: (mode: FXRoutingMode) => void;
  onTargetToggle: (target: FXTarget) => void;
  onFXOffsetChange: (track: TrackName, effect: 'reverb' | 'delay', param: string, value: number) => void;
  onResetTrackOffsets: (track: TrackName) => void;
}

const syncDivisions: SyncDivision[] = ['1/4', '1/8', '3/16'];

// Only tracks that can have offsets (excludes glitch)
type OffsetTrack = Exclude<FXTarget, 'glitch'>;
const trackButtons: { id: OffsetTrack; label: string }[] = [
  { id: 'drums', label: 'D' },
  { id: 'synth', label: 'S' },
  { id: 'texture', label: 'T' },
  { id: 'sample', label: 'Smp' },
];

const individualButtons: { id: FXTarget; label: string }[] = [
  ...trackButtons,
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
  fxOffsetsPerTrack,
  onReverbChange, 
  onDelayChange,
  onMasterFilterChange,
  onSendChange,
  onRoutingModeChange,
  onTargetToggle,
  onFXOffsetChange,
  onResetTrackOffsets,
}: FXModuleProps) {
  const [muted, setMuted] = useState(false);
  const [selectedEditTrack, setSelectedEditTrack] = useState<OffsetTrack | null>(null);
  
  const levels = useFXAnalyser(isPlaying && !muted);
  const { reverb: reverbLevel, delay: delayLevel } = levels;
  
  const isActive = fxRoutingMode === 'master' || fxTargets.length > 0;
  const showNoTargetWarning = fxRoutingMode === 'individual' && fxTargets.length === 0;

  // Determine which track to show offsets for
  const editingTrack: OffsetTrack = useMemo(() => {
    if (fxRoutingMode === 'master') return 'drums';
    // Filter to only offset-capable tracks (no glitch)
    const offsetTargets = fxTargets.filter((t): t is OffsetTrack => t !== 'glitch');
    if (selectedEditTrack && offsetTargets.includes(selectedEditTrack)) {
      return selectedEditTrack;
    }
    return offsetTargets[0] || 'drums';
  }, [fxRoutingMode, fxTargets, selectedEditTrack]);

  const currentOffsets: TrackFXOffsets = fxOffsetsPerTrack[editingTrack];
  const offsetTargets = fxTargets.filter((t): t is OffsetTrack => t !== 'glitch');
  const multipleTracksSelected = fxRoutingMode === 'individual' && offsetTargets.length > 1;

  // Handle track button click
  const handleTrackClick = (target: FXTarget) => {
    const isCurrentlyActive = fxTargets.includes(target);
    onTargetToggle(target);
    
    // If activating and it's an offset-capable track, set as editing
    if (!isCurrentlyActive && target !== 'glitch') {
      setSelectedEditTrack(target as OffsetTrack);
    }
  };

  // Apply bypass to FX engine when mute changes
  useEffect(() => {
    fxEngine.setBypass('all', muted);
  }, [muted]);

  // Sync delay to BPM when division changes
  const handleSyncChange = (division: SyncDivision) => {
    onDelayChange({ syncDivision: division });
    fxEngine.syncDelayToBpm(bpm, division);
  };

  // Helper to convert offset value to knob value (0-100 where 50 = neutral)
  const offsetToKnob = (offset: number) => 50 + offset * 100;
  // Helper to convert knob value to offset (-0.5 to +0.5)
  const knobToOffset = (knob: number) => (knob - 50) / 100;
  
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
              {individualButtons.map(({ id, label }) => {
                const isActiveTarget = fxTargets.includes(id);
                const isEditing = id !== 'glitch' && id === editingTrack;
                
                return (
                  <Button
                    key={id}
                    variant={isActiveTarget ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleTrackClick(id)}
                    className={cn(
                      'flex-1 h-6 text-[10px] font-mono transition-all relative',
                      isActiveTarget 
                        ? 'bg-primary/80 text-primary-foreground border-primary' 
                        : 'opacity-60 hover:opacity-100',
                      isEditing && isActiveTarget && 'ring-2 ring-yellow-400/70 ring-offset-1 ring-offset-background'
                    )}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          )}
          
          {/* Editing indicator */}
          {fxRoutingMode === 'individual' && multipleTracksSelected && (
            <div className="text-[9px] text-yellow-400 text-center flex items-center justify-center gap-1">
              <span>✏️ Editing:</span>
              <span className="font-mono uppercase">{editingTrack}</span>
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

        {/* Track Offsets Section - only visible in individual mode with tracks selected */}
        {fxRoutingMode === 'individual' && offsetTargets.length > 0 && (
          <div className="pt-2 border-t border-border/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                Track Offsets
                {multipleTracksSelected && (
                  <span className="text-yellow-400 font-mono">({editingTrack})</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onResetTrackOffsets(editingTrack)}
                className="h-5 px-1.5 text-[9px] text-muted-foreground hover:text-foreground"
                title="Reset offsets"
              >
                <RotateCcw className="w-3 h-3" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {/* Reverb Offsets */}
              <div className="space-y-1">
                <div className="text-[8px] text-muted-foreground/60 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-primary/50" />
                  Rev Offsets
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <Knob
                    value={offsetToKnob(currentOffsets.reverb.size)}
                    onChange={(v) => onFXOffsetChange(editingTrack, 'reverb', 'size', knobToOffset(v))}
                    label="Size"
                    size="sm"
                    variant="secondary"
                  />
                  <Knob
                    value={offsetToKnob(currentOffsets.reverb.decay)}
                    onChange={(v) => onFXOffsetChange(editingTrack, 'reverb', 'decay', knobToOffset(v))}
                    label="Decay"
                    size="sm"
                    variant="secondary"
                  />
                  <Knob
                    value={offsetToKnob(currentOffsets.reverb.damping)}
                    onChange={(v) => onFXOffsetChange(editingTrack, 'reverb', 'damping', knobToOffset(v))}
                    label="Damp"
                    size="sm"
                    variant="secondary"
                  />
                </div>
              </div>
              
              {/* Delay Offsets */}
              <div className="space-y-1">
                <div className="text-[8px] text-muted-foreground/60 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-accent/50" />
                  Dly Offsets
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <Knob
                    value={offsetToKnob(currentOffsets.delay.time)}
                    onChange={(v) => onFXOffsetChange(editingTrack, 'delay', 'time', knobToOffset(v))}
                    label="Time"
                    size="sm"
                    variant="secondary"
                  />
                  <Knob
                    value={offsetToKnob(currentOffsets.delay.feedback)}
                    onChange={(v) => onFXOffsetChange(editingTrack, 'delay', 'feedback', knobToOffset(v))}
                    label="Fdbk"
                    size="sm"
                    variant="secondary"
                  />
                  <Knob
                    value={offsetToKnob(currentOffsets.delay.filter)}
                    onChange={(v) => onFXOffsetChange(editingTrack, 'delay', 'filter', knobToOffset(v))}
                    label="Filt"
                    size="sm"
                    variant="secondary"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Combined Row: Send Matrix + Visualizers */}
        <div className="py-2 flex gap-3 items-stretch">
          {/* Send Matrix - Left */}
          <div className="flex-1">
            <SendMatrix sendLevels={sendLevels} onSendChange={onSendChange} />
          </div>
          
          {/* Visualizers - Right (stacked vertically) */}
          <div className="flex flex-col gap-1.5 w-56">
            <FXVisualizer 
              leftLevel={levels.masterLeft}
              rightLevel={levels.masterRight}
              peakLeft={levels.peakLeft}
              peakRight={levels.peakRight}
              spectrum={levels.spectrum}
              isPlaying={isPlaying && !muted}
              compact
            />
          </div>
        </div>

        {/* Master Filter Section */}
        <div className="pt-2 border-t border-border/30">
          <div className="flex items-center justify-between gap-2">
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
            <Knob 
              value={masterFilterParams.resonance * 100}
              onChange={(v) => {
                const val = v / 100;
                onMasterFilterChange({ resonance: val });
                fxEngine.setMasterFilterParams({ resonance: val });
              }}
              label="Reso" 
              size="sm" 
              variant="accent" 
            />
            <div className="flex items-center gap-1">
              <div className="w-4 h-px bg-border/50" />
              <span className="text-[8px] text-muted-foreground/50">Master</span>
              <div className="w-4 h-px bg-border/50" />
            </div>
            <Knob 
              value={masterFilterParams.width * 100}
              onChange={(v) => {
                const val = v / 100;
                onMasterFilterChange({ width: val });
                fxEngine.setMasterFilterParams({ width: val });
              }}
              label="Width" 
              size="sm" 
              variant="accent" 
            />
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
    </ModuleCard>
  );
}