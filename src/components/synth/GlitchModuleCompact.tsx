import { useState, useEffect, useRef } from 'react';
import { Zap, Radio, Square, Disc, Sparkles, Rewind } from 'lucide-react';
import { Knob } from './Knob';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StutterParams, BitcrushParams } from '@/audio/GlitchEngine';
import { GlitchTarget } from '@/audio/AudioEngine';

type RoutingMode = 'master' | 'individual';
type IndividualTarget = 'drums' | 'synth' | 'texture' | 'sample' | 'fx';

interface GlitchModuleCompactProps {
  className?: string;
  glitchTargets: GlitchTarget[];
  onGlitchTargetsChange: (targets: GlitchTarget[]) => void;
  onTriggerGlitch: (effect: 'stutter' | 'tapestop' | 'freeze' | 'bitcrush' | 'reverse') => void;
  onStutterParamsChange: (params: { division?: StutterParams['division']; decay?: number; mix?: number }) => void;
  onBitcrushParamsChange: (params: { bits?: number; sampleRate?: number; mix?: number }) => void;
  onChaosToggle: (enabled: boolean, params: { density: number; intensity: number }) => void;
  onChaosParamsChange: (params: { density?: number; intensity?: number }) => void;
}

export const GlitchModuleCompact = ({ 
  className, 
  glitchTargets, 
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
  
  const [stutterParams, setStutterParams] = useState<StutterParams>({
    active: false,
    mix: 50,
    division: '1/16',
    decay: 50,
  });
  
  const [bitcrushParams, setBitcrushParams] = useState<BitcrushParams>({
    active: false,
    mix: 50,
    bits: 8,
    sampleRate: 50,
  });
  
  const [chaosParams, setChaosParams] = useState({
    density: 30,
    intensity: 50,
  });

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

  const handleModeChange = (mode: RoutingMode) => {
    setRoutingMode(mode);
  };

  const toggleIndividualTarget = (target: IndividualTarget) => {
    setIndividualTargets(prev => {
      const next = new Set(prev);
      if (next.has(target)) {
        next.delete(target);
      } else {
        next.add(target);
      }
      return next;
    });
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
      density: chaosParams.density / 100,
      intensity: chaosParams.intensity / 100,
    });
  };

  const divisions: StutterParams['division'][] = ['1/4', '1/8', '1/16', '1/32', '1/64'];
  
  const individualButtons: { id: IndividualTarget; label: string; color: string }[] = [
    { id: 'drums', label: 'D', color: 'hsl(var(--primary))' },
    { id: 'synth', label: 'S', color: 'hsl(var(--accent))' },
    { id: 'texture', label: 'T', color: 'hsl(var(--secondary))' },
    { id: 'sample', label: 'Smp', color: 'hsl(var(--muted))' },
    { id: 'fx', label: 'FX', color: 'hsl(var(--chart-4))' },
  ];

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Zap className="w-3 h-3 text-muted-foreground" />
        <span className="text-label text-muted-foreground">Glitch</span>
      </div>

      {/* Routing Mode Selector */}
      <div className="space-y-2">
        <div className="flex gap-1">
          <Button
            variant={routingMode === 'master' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleModeChange('master')}
            className={cn(
              'flex-1 h-7 text-[10px] font-medium',
              routingMode === 'master' && 'bg-primary text-primary-foreground'
            )}
          >
            MASTER
          </Button>
          <Button
            variant={routingMode === 'individual' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleModeChange('individual')}
            className={cn(
              'flex-1 h-7 text-[10px] font-medium',
              routingMode === 'individual' && 'bg-primary text-primary-foreground'
            )}
          >
            TRACKS
          </Button>
        </div>
        
        {/* Individual track selectors - only visible in individual mode */}
        {routingMode === 'individual' && (
          <div className="flex gap-1">
            {individualButtons.map(({ id, label }) => (
              <Button
                key={id}
                variant={individualTargets.has(id) ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleIndividualTarget(id)}
                className={cn(
                  'flex-1 h-6 text-[10px] font-mono transition-all',
                  individualTargets.has(id) 
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

      {/* 5 Trigger Buttons - compact */}
      <div className="grid grid-cols-5 gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleStutterTrigger}
          disabled={!isActive}
          className={cn(
            'h-8 flex flex-col items-center justify-center gap-0 px-0.5',
            activeEffect === 'stutter' && 'bg-primary/20 border-primary'
          )}
        >
          <Radio className="w-3 h-3" />
          <span className="text-[8px]">Stut</span>
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleTapeStopTrigger}
          disabled={!isActive}
          className={cn(
            'h-8 flex flex-col items-center justify-center gap-0 px-0.5',
            activeEffect === 'tapestop' && 'bg-primary/20 border-primary'
          )}
        >
          <Square className="w-3 h-3" />
          <span className="text-[8px]">Tape</span>
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleFreezeTrigger}
          disabled={!isActive}
          className={cn(
            'h-8 flex flex-col items-center justify-center gap-0 px-0.5',
            activeEffect === 'freeze' && 'bg-primary/20 border-primary'
          )}
        >
          <Disc className="w-3 h-3" />
          <span className="text-[8px]">Frz</span>
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleBitcrushTrigger}
          disabled={!isActive}
          className={cn(
            'h-8 flex flex-col items-center justify-center gap-0 px-0.5',
            activeEffect === 'crush' && 'bg-primary/20 border-primary'
          )}
        >
          <Zap className="w-3 h-3" />
          <span className="text-[8px]">Crsh</span>
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleReverseTrigger}
          disabled={!isActive}
          className={cn(
            'h-8 flex flex-col items-center justify-center gap-0 px-0.5',
            activeEffect === 'reverse' && 'bg-primary/20 border-primary'
          )}
        >
          <Rewind className="w-3 h-3" />
          <span className="text-[8px]">Rev</span>
        </Button>
      </div>

      {/* Stutter: Division selector + 2 knobs */}
      <div className="space-y-1.5">
        <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Stutter</div>
        <div className="flex gap-0.5">
          {divisions.map((div) => (
            <button
              key={div}
              onClick={() => {
                setStutterParams(prev => ({ ...prev, division: div }));
                onStutterParamsChange({ division: div });
              }}
              disabled={!isActive}
              className={cn(
                'flex-1 py-0.5 text-[9px] font-mono rounded border transition-colors',
                stutterParams.division === div
                  ? 'border-primary bg-primary/20 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground',
                !isActive && 'opacity-50'
              )}
            >
              {div}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Knob
            value={stutterParams.decay}
            onChange={(v) => {
              setStutterParams(prev => ({ ...prev, decay: v }));
              onStutterParamsChange({ decay: v / 100 });
            }}
            label="Decay"
            size="sm"
            variant={!isActive ? 'secondary' : 'primary'}
          />
          <Knob
            value={stutterParams.mix}
            onChange={(v) => {
              setStutterParams(prev => ({ ...prev, mix: v }));
              onStutterParamsChange({ mix: v / 100 });
            }}
            label="Mix"
            size="sm"
            variant={!isActive ? 'secondary' : 'accent'}
          />
        </div>
      </div>

      {/* Bitcrush: 2 knobs */}
      <div className="space-y-1.5">
        <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Bitcrush</div>
        <div className="grid grid-cols-2 gap-2">
          <Knob
            value={bitcrushParams.bits * 6.25}
            onChange={(v) => {
              const bits = Math.round(v / 6.25);
              setBitcrushParams(prev => ({ ...prev, bits: Math.max(1, Math.min(16, bits)) }));
              onBitcrushParamsChange({ bits });
            }}
            label={`${bitcrushParams.bits}bit`}
            size="sm"
            variant={!isActive ? 'secondary' : 'primary'}
          />
          <Knob
            value={bitcrushParams.sampleRate}
            onChange={(v) => {
              setBitcrushParams(prev => ({ ...prev, sampleRate: v }));
              onBitcrushParamsChange({ sampleRate: v / 100 });
            }}
            label="Crush"
            size="sm"
            variant={!isActive ? 'secondary' : 'accent'}
          />
        </div>
      </div>
      
      {/* Chaos Mode: Toggle + 2 knobs in row */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <span className={cn(
              'w-1.5 h-1.5 rounded-full',
              chaosEnabled ? 'bg-destructive animate-pulse' : 'bg-muted-foreground/40'
            )} />
            Chaos
          </div>
          <Button
            variant={chaosEnabled ? 'destructive' : 'outline'}
            size="sm"
            onClick={handleChaosToggle}
            disabled={!isActive}
            className={cn(
              'h-5 px-2 text-[9px] ml-auto',
              chaosEnabled && 'animate-pulse'
            )}
          >
            <Sparkles className="w-2.5 h-2.5 mr-0.5" />
            {chaosEnabled ? 'On' : 'Off'}
          </Button>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <Knob
            value={chaosParams.density}
            onChange={(v) => {
              setChaosParams(prev => ({ ...prev, density: v }));
              if (chaosEnabled) {
                onChaosParamsChange({ density: v / 100 });
              }
            }}
            label="Dens"
            size="sm"
            variant={!isActive ? 'secondary' : chaosEnabled ? 'accent' : 'secondary'}
          />
          <Knob
            value={chaosParams.intensity}
            onChange={(v) => {
              setChaosParams(prev => ({ ...prev, intensity: v }));
              if (chaosEnabled) {
                onChaosParamsChange({ intensity: v / 100 });
              }
            }}
            label="Int"
            size="sm"
            variant={!isActive ? 'secondary' : chaosEnabled ? 'accent' : 'secondary'}
          />
        </div>
      </div>
    </div>
  );
};
