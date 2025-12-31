import { useState, useEffect, useRef, useMemo } from 'react';
import { Zap, Radio, Square, Disc, Sparkles, Rewind } from 'lucide-react';
import { Knob } from './Knob';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StutterParams, BitcrushParams } from '@/audio/GlitchEngine';
import { GlitchTarget } from '@/audio/AudioEngine';
import { GlitchTrackId, GlitchParamsPerTrack } from '@/hooks/useGlitchState';
import { GlitchWaveformDisplay } from './GlitchWaveformDisplay';

type RoutingMode = 'master' | 'individual';
type IndividualTarget = 'drums' | 'synth' | 'texture' | 'sample' | 'fx';

interface GlitchModuleCompactProps {
  className?: string;
  glitchTargets: GlitchTarget[];
  muted: boolean;
  paramsPerTrack: GlitchParamsPerTrack;
  isPlaying?: boolean;
  analyserData?: Uint8Array;
  onMuteToggle: () => void;
  onGlitchTargetsChange: (targets: GlitchTarget[]) => void;
  onTriggerGlitch: (effect: 'stutter' | 'tapestop' | 'freeze' | 'bitcrush' | 'reverse') => void;
  onStutterParamsChange: (track: GlitchTrackId, params: { division?: StutterParams['division']; decay?: number; mix?: number }) => void;
  onBitcrushParamsChange: (track: GlitchTrackId, params: { bits?: number; sampleRate?: number }) => void;
  onChaosToggle: (enabled: boolean, params: { density: number; intensity: number }) => void;
  onChaosParamsChange: (track: GlitchTrackId, params: { density?: number; intensity?: number }) => void;
}

export const GlitchModuleCompact = ({ 
  className, 
  glitchTargets,
  muted,
  paramsPerTrack,
  isPlaying = false,
  analyserData,
  onMuteToggle,
  onGlitchTargetsChange,
  onTriggerGlitch,
  onStutterParamsChange,
  onBitcrushParamsChange,
  onChaosToggle,
  onChaosParamsChange,
}: GlitchModuleCompactProps) => {
  const [activeEffect, setActiveEffect] = useState<string | null>(null);
  const [chaosEnabled, setChaosEnabled] = useState(false);
  
  // Flag to prevent notifying parent of changes that came from props
  const isExternalUpdateRef = useRef(false);
  
  // Routing mode: master vs individual tracks
  const [routingMode, setRoutingMode] = useState<RoutingMode>(() => 
    glitchTargets.includes('master') ? 'master' : 'individual'
  );
  const [individualTargets, setIndividualTargets] = useState<Set<IndividualTarget>>(() => {
    const targets = new Set<IndividualTarget>();
    if (glitchTargets.includes('drums')) targets.add('drums');
    if (glitchTargets.includes('synth')) targets.add('synth');
    if (glitchTargets.includes('texture')) targets.add('texture');
    if (glitchTargets.includes('sample')) targets.add('sample');
    if (glitchTargets.includes('fx')) targets.add('fx');
    return targets;
  });

  // Explicit track being edited (user-selectable when multiple tracks active)
  const [selectedEditTrack, setSelectedEditTrack] = useState<IndividualTarget | null>(null);

  // Determine which track's params to display
  const editingTrack: GlitchTrackId = useMemo(() => {
    if (routingMode === 'master') return 'master';
    // If user explicitly selected an edit track and it's still active, use it
    if (selectedEditTrack && individualTargets.has(selectedEditTrack)) {
      return selectedEditTrack;
    }
    // Otherwise use first active track
    const targetsArray = Array.from(individualTargets);
    return targetsArray.length > 0 ? targetsArray[0] : 'drums';
  }, [routingMode, individualTargets, selectedEditTrack]);

  // Get current params for the editing track
  const currentParams = paramsPerTrack[editingTrack];

  // Sync routing mode changes to parent (only for local user interactions)
  useEffect(() => {
    // Skip if this change came from external props
    if (isExternalUpdateRef.current) {
      isExternalUpdateRef.current = false;
      return;
    }
    
    if (routingMode === 'master') {
      onGlitchTargetsChange(['master']);
    } else {
      onGlitchTargetsChange(Array.from(individualTargets) as GlitchTarget[]);
    }
  }, [routingMode, individualTargets, onGlitchTargetsChange]);

  // Sync local state with props when glitchTargets changes externally (e.g. preset load)
  useEffect(() => {
    const isMasterMode = glitchTargets.includes('master');
    
    // Compare current state with incoming props
    const currentIsMaster = routingMode === 'master';
    const currentTargetsArray = Array.from(individualTargets).sort();
    const incomingTargetsArray = glitchTargets.filter(t => t !== 'master').sort() as IndividualTarget[];
    
    const modeChanged = isMasterMode !== currentIsMaster;
    const targetsChanged = !isMasterMode && (
      currentTargetsArray.length !== incomingTargetsArray.length ||
      currentTargetsArray.some((t, i) => t !== incomingTargetsArray[i])
    );
    
    // Only update if there's an actual difference
    if (modeChanged || targetsChanged) {
      isExternalUpdateRef.current = true;
      
      if (isMasterMode) {
        setRoutingMode('master');
      } else {
        setRoutingMode('individual');
        setIndividualTargets(new Set(incomingTargetsArray));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glitchTargets]);

  const isActive = glitchTargets.length > 0;
  const showNoTargetWarning = routingMode === 'individual' && individualTargets.size === 0;
  const multipleTracksSelected = routingMode === 'individual' && individualTargets.size > 1;

  const handleModeChange = (mode: RoutingMode) => {
    setRoutingMode(mode);
  };

  const toggleIndividualTarget = (target: IndividualTarget) => {
    setIndividualTargets(prev => {
      const next = new Set(prev);
      if (next.has(target)) {
        next.delete(target);
        // If we're removing the currently edited track, clear selection
        if (selectedEditTrack === target) {
          setSelectedEditTrack(null);
        }
      } else {
        next.add(target);
      }
      return next;
    });
  };

  // Handle clicking on track button - always toggle, set as editing if activating
  const handleTrackClick = (target: IndividualTarget) => {
    const isCurrentlyActive = individualTargets.has(target);
    
    // Always toggle active state
    toggleIndividualTarget(target);
    
    if (!isCurrentlyActive) {
      // Just activated - set as editing
      setSelectedEditTrack(target);
    }
    // If deactivated, editingTrack useMemo handles selecting next active
  };

  const handleStutterTrigger = () => {
    if (!isActive) return;
    setActiveEffect('stutter');
    onTriggerGlitch('stutter');
    setTimeout(() => setActiveEffect(null), 200);
  };

  const handleTapeStopTrigger = () => {
    if (!isActive) return;
    setActiveEffect('tapestop');
    onTriggerGlitch('tapestop');
    setTimeout(() => setActiveEffect(null), 500);
  };

  const handleFreezeTrigger = () => {
    if (!isActive) return;
    setActiveEffect('freeze');
    onTriggerGlitch('freeze');
    setTimeout(() => setActiveEffect(null), 300);
  };
  
  const handleBitcrushTrigger = () => {
    if (!isActive) return;
    setActiveEffect('crush');
    onTriggerGlitch('bitcrush');
    setTimeout(() => setActiveEffect(null), 500);
  };

  const handleReverseTrigger = () => {
    if (!isActive) return;
    setActiveEffect('reverse');
    onTriggerGlitch('reverse');
    setTimeout(() => setActiveEffect(null), 400);
  };
  
  const handleChaosToggle = () => {
    if (!isActive) return;
    const newEnabled = !chaosEnabled;
    setChaosEnabled(newEnabled);
    
    // Use parent callback to route chaos to correct targets
    onChaosToggle(newEnabled, {
      density: currentParams.chaos.density / 100,
      intensity: currentParams.chaos.intensity / 100,
    });
  };

  const divisions: StutterParams['division'][] = ['1/4', '1/8', '1/16', '1/32', '1/64'];
  
  const individualButtons: { id: IndividualTarget; label: string }[] = [
    { id: 'drums', label: 'D' },
    { id: 'synth', label: 'S' },
    { id: 'texture', label: 'T' },
    { id: 'sample', label: 'Sm' },
    { id: 'fx', label: 'FX' },
  ];

  const triggerButtons = [
    { id: 'stutter', icon: Radio, label: 'Stut', handler: handleStutterTrigger },
    { id: 'tapestop', icon: Square, label: 'Tape', handler: handleTapeStopTrigger },
    { id: 'freeze', icon: Disc, label: 'Frz', handler: handleFreezeTrigger },
    { id: 'crush', icon: Zap, label: 'Crsh', handler: handleBitcrushTrigger },
    { id: 'reverse', icon: Rewind, label: 'Rev', handler: handleReverseTrigger },
  ];

  return (
    <div className={cn('space-y-2', className, muted && 'opacity-50')}>
      {/* Header: LED + Title + Routing + Mute - all in one line */}
      <div className="flex items-center gap-2">
        <div className={cn('led flex-shrink-0', !muted && isActive && 'on')} />
        <Zap className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        
        {/* Routing buttons inline */}
        <div className="flex gap-0.5 flex-shrink-0">
          <button
            onClick={() => handleModeChange('master')}
            className={cn(
              'px-1.5 py-0.5 text-[8px] font-medium rounded border transition-colors',
              routingMode === 'master'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            MST
          </button>
          <button
            onClick={() => handleModeChange('individual')}
            className={cn(
              'px-1.5 py-0.5 text-[8px] font-medium rounded border transition-colors',
              routingMode === 'individual'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            TRK
          </button>
        </div>

        {/* Individual track selectors - inline when in individual mode */}
        {routingMode === 'individual' && (
          <div className="flex gap-0.5 flex-shrink-0">
            {individualButtons.map(({ id, label }) => {
              const isActiveTarget = individualTargets.has(id);
              const isEditing = id === editingTrack;
              return (
                <button
                  key={id}
                  onClick={() => handleTrackClick(id)}
                  className={cn(
                    'w-5 h-5 text-[7px] font-mono rounded border transition-all',
                    isActiveTarget 
                      ? isEditing
                        ? 'bg-primary text-primary-foreground border-primary ring-1 ring-yellow-400'
                        : 'bg-primary/60 text-primary-foreground border-primary/60'
                      : 'border-border text-muted-foreground/50 hover:text-muted-foreground'
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Editing indicator */}
        {multipleTracksSelected && (
          <span className="text-[7px] text-yellow-400/80 font-mono flex-shrink-0">
            ✏️{editingTrack.charAt(0).toUpperCase()}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Mute button */}
        <button
          onClick={onMuteToggle}
          className={cn(
            'px-1.5 py-0.5 text-[8px] uppercase tracking-wider rounded border transition-colors flex-shrink-0',
            muted 
              ? 'border-destructive/50 text-destructive bg-destructive/10' 
              : 'border-border text-muted-foreground hover:text-foreground'
          )}
        >
          {muted ? 'M' : 'Mute'}
        </button>
      </div>

      {/* Warning when no target selected */}
      {showNoTargetWarning && (
        <div className="text-[8px] text-muted-foreground/60 text-center italic">
          Select a track
        </div>
      )}

      {/* Triggers Row: 5 triggers + Division selector in same line */}
      <div className="flex items-center gap-1">
        {/* 5 Trigger buttons */}
        {triggerButtons.map(({ id, icon: Icon, label, handler }) => (
          <Button
            key={id}
            variant="outline"
            size="sm"
            onClick={handler}
            disabled={!isActive}
            className={cn(
              'h-7 w-7 p-0 flex flex-col items-center justify-center gap-0',
              activeEffect === id && 'bg-primary/20 border-primary'
            )}
          >
            <Icon className="w-3 h-3" />
            <span className="text-[6px]">{label}</span>
          </Button>
        ))}

        {/* Vertical separator */}
        <div className="w-px h-6 bg-border mx-0.5" />

        {/* Stutter Division inline */}
        <div className="flex gap-0.5">
          {divisions.map((div) => (
            <button
              key={div}
              onClick={() => onStutterParamsChange(editingTrack, { division: div })}
              disabled={!isActive}
              className={cn(
                'px-1 py-0.5 text-[7px] font-mono rounded border transition-colors',
                currentParams.stutter.division === div
                  ? 'border-primary bg-primary/20 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground',
                !isActive && 'opacity-50'
              )}
            >
              {div}
            </button>
          ))}
        </div>

        {/* Chaos toggle at end */}
        <div className="ml-auto">
          <Button
            variant={chaosEnabled ? 'destructive' : 'outline'}
            size="sm"
            onClick={handleChaosToggle}
            disabled={!isActive}
            className={cn(
              'h-7 px-2 text-[8px]',
              chaosEnabled && 'animate-pulse'
            )}
          >
            <Sparkles className="w-3 h-3 mr-0.5" />
            <span className={cn(
              'w-1.5 h-1.5 rounded-full mr-0.5',
              chaosEnabled ? 'bg-white animate-pulse' : 'bg-muted-foreground/40'
            )} />
            Chaos
          </Button>
        </div>
      </div>

      {/* All Knobs in Single Row: Stutter(2) + Bitcrush(2) + Chaos(2) */}
      <div className="flex items-start justify-between gap-1 px-1">
        {/* Stutter knobs */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[7px] text-muted-foreground uppercase tracking-wider">Stut</span>
          <div className="flex gap-1">
            <Knob
              value={currentParams.stutter.decay}
              onChange={(v) => onStutterParamsChange(editingTrack, { decay: v / 100 })}
              label="Dec"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
            <Knob
              value={currentParams.stutter.mix}
              onChange={(v) => onStutterParamsChange(editingTrack, { mix: v / 100 })}
              label="Mix"
              size="sm"
              variant={!isActive ? 'secondary' : 'accent'}
            />
          </div>
        </div>

        {/* Vertical separator */}
        <div className="w-px h-12 bg-border/50 self-center" />

        {/* Bitcrush knobs */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[7px] text-muted-foreground uppercase tracking-wider">Crush</span>
          <div className="flex gap-1">
            <Knob
              value={currentParams.bitcrush.bits * 6.25}
              onChange={(v) => {
                const bits = Math.round(v / 6.25);
                onBitcrushParamsChange(editingTrack, { bits: Math.max(1, Math.min(16, bits)) });
              }}
              label={`${currentParams.bitcrush.bits}b`}
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
            <Knob
              value={currentParams.bitcrush.sampleRate}
              onChange={(v) => onBitcrushParamsChange(editingTrack, { sampleRate: v / 100 })}
              label="Rate"
              size="sm"
              variant={!isActive ? 'secondary' : 'accent'}
            />
          </div>
        </div>

        {/* Vertical separator */}
        <div className="w-px h-12 bg-border/50 self-center" />

        {/* Chaos knobs */}
        <div className="flex flex-col items-center gap-0.5">
          <span className={cn(
            "text-[7px] uppercase tracking-wider",
            chaosEnabled ? "text-destructive" : "text-muted-foreground"
          )}>Chaos</span>
          <div className="flex gap-1">
            <Knob
              value={currentParams.chaos.density}
              onChange={(v) => onChaosParamsChange(editingTrack, { density: v })}
              label="Dens"
              size="sm"
              variant={!isActive ? 'secondary' : chaosEnabled ? 'accent' : 'secondary'}
            />
            <Knob
              value={currentParams.chaos.intensity}
              onChange={(v) => onChaosParamsChange(editingTrack, { intensity: v })}
              label="Int"
              size="sm"
              variant={!isActive ? 'secondary' : chaosEnabled ? 'accent' : 'secondary'}
            />
          </div>
        </div>
      </div>

      {/* Waveform Display as Footer */}
      <GlitchWaveformDisplay 
        isPlaying={isPlaying} 
        analyserData={analyserData || new Uint8Array(128)}
        className="h-12 rounded-sm border border-border/50"
      />
    </div>
  );
};
