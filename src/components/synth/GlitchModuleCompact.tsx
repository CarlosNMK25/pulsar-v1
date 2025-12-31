import { useState, useEffect, useRef, useMemo } from 'react';
import { Zap, Radio, Square, Disc, Sparkles, Rewind } from 'lucide-react';
import { Knob } from './Knob';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { StutterParams } from '@/audio/GlitchEngine';
import { GlitchTarget } from '@/audio/AudioEngine';
import { GlitchTrackId, GlitchParamsPerTrack, TrackGlitchParams } from '@/hooks/useGlitchState';
import { GlitchWaveformDisplay } from './GlitchWaveformDisplay';

type RoutingMode = 'master' | 'individual';
type IndividualTarget = 'drums' | 'synth' | 'texture' | 'sample' | 'fx';

interface GlitchModuleCompactProps {
  className?: string;
  glitchTargets: GlitchTarget[];
  muted: boolean;
  paramsPerTrack: GlitchParamsPerTrack;
  masterMix: number;
  isPlaying: boolean;
  analyserData: Uint8Array;
  onMuteToggle: () => void;
  onGlitchTargetsChange: (targets: GlitchTarget[]) => void;
  onTriggerGlitch: (effect: 'stutter' | 'tapestop' | 'freeze' | 'bitcrush' | 'reverse') => void;
  onStutterParamsChange: (track: GlitchTrackId, params: Partial<TrackGlitchParams['stutter']>) => void;
  onBitcrushParamsChange: (track: GlitchTrackId, params: Partial<TrackGlitchParams['bitcrush']>) => void;
  onTapeStopParamsChange: (track: GlitchTrackId, params: Partial<TrackGlitchParams['tapeStop']>) => void;
  onFreezeParamsChange: (track: GlitchTrackId, params: Partial<TrackGlitchParams['freeze']>) => void;
  onReverseParamsChange: (track: GlitchTrackId, params: Partial<TrackGlitchParams['reverse']>) => void;
  onChaosToggle: (enabled: boolean, params: { density: number; intensity: number }) => void;
  onChaosParamsChange: (track: GlitchTrackId, params: Partial<TrackGlitchParams['chaos']>) => void;
  onFXSendsChange: (track: GlitchTrackId, params: Partial<TrackGlitchParams['fxSends']>) => void;
  onMasterMixChange: (value: number) => void;
  onFreezeHoldStart?: () => void;
  onFreezeHoldStop?: () => void;
}

export const GlitchModuleCompact = ({ 
  className, 
  glitchTargets,
  muted,
  paramsPerTrack,
  masterMix,
  isPlaying,
  analyserData,
  onMuteToggle,
  onGlitchTargetsChange,
  onTriggerGlitch,
  onStutterParamsChange,
  onBitcrushParamsChange,
  onTapeStopParamsChange,
  onFreezeParamsChange,
  onReverseParamsChange,
  onChaosToggle,
  onChaosParamsChange,
  onFXSendsChange,
  onMasterMixChange,
  onFreezeHoldStart,
  onFreezeHoldStop,
}: GlitchModuleCompactProps) => {
  const [activeEffect, setActiveEffect] = useState<string | null>(null);
  const [freezeHolding, setFreezeHolding] = useState(false);
  const [chaosEnabled, setChaosEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState('stutter');
  
  const isExternalUpdateRef = useRef(false);
  
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

  const [selectedEditTrack, setSelectedEditTrack] = useState<IndividualTarget | null>(null);

  const editingTrack: GlitchTrackId = useMemo(() => {
    if (routingMode === 'master') return 'master';
    if (selectedEditTrack && individualTargets.has(selectedEditTrack)) {
      return selectedEditTrack;
    }
    const targetsArray = Array.from(individualTargets);
    return targetsArray.length > 0 ? targetsArray[0] : 'drums';
  }, [routingMode, individualTargets, selectedEditTrack]);

  const currentParams = paramsPerTrack[editingTrack];

  useEffect(() => {
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

  useEffect(() => {
    const isMasterMode = glitchTargets.includes('master');
    const currentIsMaster = routingMode === 'master';
    const currentTargetsArray = Array.from(individualTargets).sort();
    const incomingTargetsArray = glitchTargets.filter(t => t !== 'master').sort() as IndividualTarget[];
    
    const modeChanged = isMasterMode !== currentIsMaster;
    const targetsChanged = !isMasterMode && (
      currentTargetsArray.length !== incomingTargetsArray.length ||
      currentTargetsArray.some((t, i) => t !== incomingTargetsArray[i])
    );
    
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
        if (selectedEditTrack === target) {
          setSelectedEditTrack(null);
        }
      } else {
        next.add(target);
      }
      return next;
    });
  };

  const handleTrackClick = (target: IndividualTarget) => {
    const isCurrentlyActive = individualTargets.has(target);
    toggleIndividualTarget(target);
    if (!isCurrentlyActive) {
      setSelectedEditTrack(target);
    }
  };

  const handleTrigger = (effect: 'stutter' | 'tapestop' | 'freeze' | 'bitcrush' | 'reverse', duration: number = 200) => {
    if (!isActive) return;
    setActiveEffect(effect);
    onTriggerGlitch(effect);
    setTimeout(() => setActiveEffect(null), duration);
  };
  
  const handleChaosToggle = () => {
    if (!isActive) return;
    const newEnabled = !chaosEnabled;
    setChaosEnabled(newEnabled);
    
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
    { id: 'sample', label: 'Smp' },
    { id: 'fx', label: 'FX' },
  ];

  const effectTabs = [
    { id: 'stutter', label: 'Stut', icon: Radio },
    { id: 'tape', label: 'Tape', icon: Square },
    { id: 'freeze', label: 'Frz', icon: Disc },
    { id: 'crush', label: 'Crsh', icon: Zap },
    { id: 'reverse', label: 'Rev', icon: Rewind },
    { id: 'chaos', label: 'Chaos', icon: Sparkles },
  ];

  return (
    <div className={cn('space-y-2', className, muted && 'opacity-50')}>
      {/* Header with Mute */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('led', !muted && isActive && 'on')} />
          <Zap className="w-3 h-3 text-muted-foreground" />
          <span className="text-label text-muted-foreground">Glitch</span>
          {multipleTracksSelected && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-mono">
              {editingTrack.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <button
          onClick={onMuteToggle}
          className={cn(
            'px-2 py-0.5 text-[10px] uppercase tracking-wider rounded border transition-colors',
            muted 
              ? 'border-destructive/50 text-destructive bg-destructive/10' 
              : 'border-border text-muted-foreground hover:text-foreground'
          )}
        >
          {muted ? 'Muted' : 'Mute'}
        </button>
      </div>

      {/* Routing Mode Selector - Compact */}
      <div className="flex gap-1">
        <Button
          variant={routingMode === 'master' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleModeChange('master')}
          className={cn(
            'h-6 text-[9px] font-medium px-2',
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
            'h-6 text-[9px] font-medium px-2',
            routingMode === 'individual' && 'bg-primary text-primary-foreground'
          )}
        >
          TRACKS
        </Button>
        
        {routingMode === 'individual' && (
          <div className="flex gap-0.5 ml-1">
            {individualButtons.map(({ id, label }) => {
              const isActive = individualTargets.has(id);
              const isEditing = id === editingTrack;
              return (
                <Button
                  key={id}
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleTrackClick(id)}
                  className={cn(
                    'h-6 text-[9px] font-mono px-1.5 min-w-0',
                    isActive 
                      ? isEditing
                        ? 'bg-primary text-primary-foreground ring-1 ring-yellow-400'
                        : 'bg-primary/60 text-primary-foreground'
                      : 'opacity-50 hover:opacity-80'
                  )}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        )}
      </div>
      
      {showNoTargetWarning && (
        <div className="text-[9px] text-muted-foreground/60 text-center italic">
          Select a track
        </div>
      )}

      {/* Integrated Waveform Display */}
      <GlitchWaveformDisplay 
        isPlaying={isPlaying} 
        analyserData={analyserData}
        className="h-14 rounded-sm"
      />

      {/* Effect Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-6 h-7 p-0.5">
          {effectTabs.map(tab => {
            const Icon = tab.icon;
            const isTabActive = activeEffect === tab.id || (tab.id === 'chaos' && chaosEnabled);
            return (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id} 
                className={cn(
                  'text-[8px] h-6 px-1 gap-0.5',
                  isTabActive && 'bg-primary/20'
                )}
              >
                <Icon className="w-2.5 h-2.5" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
        
        {/* STUTTER Tab */}
        <TabsContent value="stutter" className="space-y-2 mt-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTrigger('stutter', 200)}
              disabled={!isActive}
              className={cn(
                'h-7 flex-1 text-[10px]',
                activeEffect === 'stutter' && 'bg-primary/20 border-primary'
              )}
            >
              <Radio className="w-3 h-3 mr-1" />
              TRIGGER
            </Button>
          </div>
          <div className="flex gap-0.5">
            {divisions.map((div) => (
              <button
                key={div}
                onClick={() => onStutterParamsChange(editingTrack, { division: div })}
                disabled={!isActive}
                className={cn(
                  'flex-1 py-0.5 text-[9px] font-mono rounded border transition-colors',
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
          <div className="grid grid-cols-4 gap-1">
            <Knob
              value={currentParams.stutter.decay}
              onChange={(v) => onStutterParamsChange(editingTrack, { decay: v })}
              label="Decay"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
            <Knob
              value={currentParams.stutter.mix}
              onChange={(v) => onStutterParamsChange(editingTrack, { mix: v })}
              label="Mix"
              size="sm"
              variant={!isActive ? 'secondary' : 'accent'}
            />
            <Knob
              value={(currentParams.stutter.repeatCount / 16) * 100}
              onChange={(v) => {
                const reps = Math.max(1, Math.round((v / 100) * 16));
                onStutterParamsChange(editingTrack, { repeatCount: reps });
              }}
              label={`${currentParams.stutter.repeatCount}x`}
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
            <Knob
              value={currentParams.stutter.probability}
              onChange={(v) => onStutterParamsChange(editingTrack, { probability: v })}
              label="Prob"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
          </div>
        </TabsContent>

        {/* TAPE STOP Tab */}
        <TabsContent value="tape" className="space-y-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleTrigger('tapestop', 500)}
            disabled={!isActive}
            className={cn(
              'h-7 w-full text-[10px]',
              activeEffect === 'tapestop' && 'bg-primary/20 border-primary'
            )}
          >
            <Square className="w-3 h-3 mr-1" />
            TRIGGER
          </Button>
          
          {/* Curve selector */}
          <div className="flex gap-0.5">
            {(['linear', 'exp', 'log', 'scurve'] as const).map((curve) => (
              <button
                key={curve}
                onClick={() => onTapeStopParamsChange(editingTrack, { curve })}
                disabled={!isActive}
                className={cn(
                  'flex-1 py-0.5 text-[9px] font-mono uppercase rounded border transition-colors',
                  currentParams.tapeStop.curve === curve
                    ? 'border-primary bg-primary/20 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground',
                  !isActive && 'opacity-50'
                )}
              >
                {curve === 'scurve' ? 'S' : curve.slice(0, 3)}
              </button>
            ))}
          </div>
          
          {/* Knobs: Speed, Dur, Wobble */}
          <div className="grid grid-cols-3 gap-2">
            <Knob
              value={currentParams.tapeStop.speed}
              onChange={(v) => onTapeStopParamsChange(editingTrack, { speed: v })}
              label="Speed"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
            <Knob
              value={currentParams.tapeStop.duration}
              onChange={(v) => onTapeStopParamsChange(editingTrack, { duration: v })}
              label="Dur"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
            <Knob
              value={currentParams.tapeStop.wobble}
              onChange={(v) => onTapeStopParamsChange(editingTrack, { wobble: v })}
              label="Wobble"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
          </div>
          
          {/* Knobs: Mix, Prob */}
          <div className="grid grid-cols-2 gap-2">
            <Knob
              value={currentParams.tapeStop.mix}
              onChange={(v) => onTapeStopParamsChange(editingTrack, { mix: v })}
              label="Mix"
              size="sm"
              variant={!isActive ? 'secondary' : 'accent'}
            />
            <Knob
              value={currentParams.tapeStop.probability}
              onChange={(v) => onTapeStopParamsChange(editingTrack, { probability: v })}
              label="Prob"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
          </div>
        </TabsContent>

        {/* FREEZE Tab - Real Granular Synthesis */}
        <TabsContent value="freeze" className="space-y-2 mt-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTrigger('freeze', 300)}
              disabled={!isActive}
              className={cn(
                'h-7 flex-1 text-[10px]',
                activeEffect === 'freeze' && 'bg-primary/20 border-primary'
              )}
            >
              <Disc className="w-3 h-3 mr-1" />
              TRIG
            </Button>
            <Button
              variant="outline"
              size="sm"
              onMouseDown={() => {
                if (!isActive) return;
                setFreezeHolding(true);
                setActiveEffect('freeze');
                onFreezeHoldStart?.();
              }}
              onMouseUp={() => {
                setFreezeHolding(false);
                setActiveEffect(null);
                onFreezeHoldStop?.();
              }}
              onMouseLeave={() => {
                if (freezeHolding) {
                  setFreezeHolding(false);
                  setActiveEffect(null);
                  onFreezeHoldStop?.();
                }
              }}
              onTouchStart={() => {
                if (!isActive) return;
                setFreezeHolding(true);
                setActiveEffect('freeze');
                onFreezeHoldStart?.();
              }}
              onTouchEnd={() => {
                setFreezeHolding(false);
                setActiveEffect(null);
                onFreezeHoldStop?.();
              }}
              disabled={!isActive}
              className={cn(
                'h-7 flex-1 text-[10px]',
                freezeHolding && 'bg-primary/30 border-primary animate-pulse'
              )}
            >
              <Disc className="w-3 h-3 mr-1" />
              HOLD
            </Button>
            <button
              onClick={() => onFreezeParamsChange(editingTrack, { reverse: !currentParams.freeze.reverse })}
              disabled={!isActive}
              className={cn(
                'h-7 px-2 text-[9px] font-mono rounded border transition-colors',
                currentParams.freeze.reverse
                  ? 'border-primary bg-primary/20 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground',
                !isActive && 'opacity-50'
              )}
            >
              REV
            </button>
          </div>
          {/* Row 1: Timing controls */}
          <div className="grid grid-cols-4 gap-1">
            <Knob
              value={currentParams.freeze.grainSize}
              onChange={(v) => onFreezeParamsChange(editingTrack, { grainSize: v })}
              label="Size"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
            <Knob
              value={currentParams.freeze.density}
              onChange={(v) => onFreezeParamsChange(editingTrack, { density: v })}
              label="Dens"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
            <Knob
              value={currentParams.freeze.overlap}
              onChange={(v) => onFreezeParamsChange(editingTrack, { overlap: v })}
              label="Ovlp"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
            <Knob
              value={currentParams.freeze.position}
              onChange={(v) => onFreezeParamsChange(editingTrack, { position: v })}
              label="Pos"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
          </div>
          {/* Row 2: Pitch & Modulation */}
          <div className="grid grid-cols-4 gap-1">
            <Knob
              value={currentParams.freeze.pitch}
              onChange={(v) => onFreezeParamsChange(editingTrack, { pitch: v })}
              label="Pitch"
              size="sm"
              variant={!isActive ? 'secondary' : 'accent'}
            />
            <Knob
              value={currentParams.freeze.detune}
              onChange={(v) => onFreezeParamsChange(editingTrack, { detune: v })}
              label="Dtune"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
            <Knob
              value={currentParams.freeze.scatter}
              onChange={(v) => onFreezeParamsChange(editingTrack, { scatter: v })}
              label="Scat"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
            <Knob
              value={currentParams.freeze.jitter}
              onChange={(v) => onFreezeParamsChange(editingTrack, { jitter: v })}
              label="Jit"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
          </div>
          {/* Row 3: Envelope & Output */}
          <div className="grid grid-cols-4 gap-1">
            <Knob
              value={currentParams.freeze.attack}
              onChange={(v) => onFreezeParamsChange(editingTrack, { attack: v })}
              label="Atk"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
            <Knob
              value={currentParams.freeze.spread}
              onChange={(v) => onFreezeParamsChange(editingTrack, { spread: v })}
              label="Sprd"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
            <Knob
              value={currentParams.freeze.mix}
              onChange={(v) => onFreezeParamsChange(editingTrack, { mix: v })}
              label="Mix"
              size="sm"
              variant={!isActive ? 'secondary' : 'accent'}
            />
            <Knob
              value={currentParams.freeze.probability}
              onChange={(v) => onFreezeParamsChange(editingTrack, { probability: v })}
              label="Prob"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
          </div>
        </TabsContent>

        {/* BITCRUSH Tab */}
        <TabsContent value="crush" className="space-y-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleTrigger('bitcrush', 500)}
            disabled={!isActive}
            className={cn(
              'h-7 w-full text-[10px]',
              activeEffect === 'crush' && 'bg-primary/20 border-primary'
            )}
          >
            <Zap className="w-3 h-3 mr-1" />
            TRIGGER
          </Button>
          <div className="grid grid-cols-3 gap-2">
            <Knob
              value={currentParams.bitcrush.bits * 6.25}
              onChange={(v) => {
                const bits = Math.round(v / 6.25);
                onBitcrushParamsChange(editingTrack, { bits: Math.max(1, Math.min(16, bits)) });
              }}
              label={`${currentParams.bitcrush.bits}bit`}
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
            <Knob
              value={currentParams.bitcrush.sampleRate}
              onChange={(v) => onBitcrushParamsChange(editingTrack, { sampleRate: v })}
              label="Crush"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
            <Knob
              value={currentParams.bitcrush.mix}
              onChange={(v) => onBitcrushParamsChange(editingTrack, { mix: v })}
              label="Mix"
              size="sm"
              variant={!isActive ? 'secondary' : 'accent'}
            />
          </div>
        </TabsContent>

        {/* REVERSE Tab */}
        <TabsContent value="reverse" className="space-y-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleTrigger('reverse', 400)}
            disabled={!isActive}
            className={cn(
              'h-7 w-full text-[10px]',
              activeEffect === 'reverse' && 'bg-primary/20 border-primary'
            )}
          >
            <Rewind className="w-3 h-3 mr-1" />
            TRIGGER
          </Button>
          {/* Row 1: Position, Crossfade, Speed */}
          <div className="grid grid-cols-3 gap-1">
            <Knob
              value={currentParams.reverse.position}
              onChange={(v) => onReverseParamsChange(editingTrack, { position: v })}
              label="Pos"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
            <Knob
              value={currentParams.reverse.crossfade}
              onChange={(v) => onReverseParamsChange(editingTrack, { crossfade: v })}
              label="XFade"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
            <Knob
              value={currentParams.reverse.speed}
              onChange={(v) => onReverseParamsChange(editingTrack, { speed: v })}
              label="Speed"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
          </div>
          {/* Row 2: Duration, Feedback, Loop, Mix, Prob */}
          <div className="grid grid-cols-5 gap-1">
            <Knob
              value={currentParams.reverse.duration}
              onChange={(v) => onReverseParamsChange(editingTrack, { duration: v })}
              label="Dur"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
            <Knob
              value={currentParams.reverse.feedback}
              onChange={(v) => onReverseParamsChange(editingTrack, { feedback: v })}
              label="Fdbk"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
            <Knob
              value={currentParams.reverse.loop}
              onChange={(v) => onReverseParamsChange(editingTrack, { loop: v })}
              label="Loop"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
            <Knob
              value={currentParams.reverse.mix}
              onChange={(v) => onReverseParamsChange(editingTrack, { mix: v })}
              label="Mix"
              size="sm"
              variant={!isActive ? 'secondary' : 'accent'}
            />
            <Knob
              value={currentParams.reverse.probability}
              onChange={(v) => onReverseParamsChange(editingTrack, { probability: v })}
              label="Prob"
              size="sm"
              variant={!isActive ? 'secondary' : 'primary'}
            />
          </div>
        </TabsContent>

        {/* CHAOS Tab */}
        <TabsContent value="chaos" className="space-y-2 mt-2">
          <Button
            variant={chaosEnabled ? 'destructive' : 'outline'}
            size="sm"
            onClick={handleChaosToggle}
            disabled={!isActive}
            className={cn(
              'h-7 w-full text-[10px]',
              chaosEnabled && 'animate-pulse'
            )}
          >
            <Sparkles className="w-3 h-3 mr-1" />
            {chaosEnabled ? 'CHAOS ON' : 'CHAOS OFF'}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Knob
              value={currentParams.chaos.density}
              onChange={(v) => onChaosParamsChange(editingTrack, { density: v })}
              label="Density"
              size="sm"
              variant={!isActive ? 'secondary' : chaosEnabled ? 'accent' : 'secondary'}
            />
            <Knob
              value={currentParams.chaos.intensity}
              onChange={(v) => onChaosParamsChange(editingTrack, { intensity: v })}
              label="Intensity"
              size="sm"
              variant={!isActive ? 'secondary' : chaosEnabled ? 'accent' : 'secondary'}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Footer: Master Mix + FX Sends */}
      <div className="flex gap-3 pt-2 border-t border-border/30">
        <div className="flex-shrink-0">
          <Knob
            value={masterMix}
            onChange={onMasterMixChange}
            label="Master"
            size="sm"
            variant="primary"
          />
        </div>
        <div className="flex gap-2 flex-1 justify-end">
          <Knob
            value={currentParams.fxSends.reverb}
            onChange={(v) => onFXSendsChange(editingTrack, { reverb: v })}
            label="RevSnd"
            size="sm"
            variant="secondary"
          />
          <Knob
            value={currentParams.fxSends.delay}
            onChange={(v) => onFXSendsChange(editingTrack, { delay: v })}
            label="DlySnd"
            size="sm"
            variant="secondary"
          />
        </div>
      </div>
    </div>
  );
};