import { useState, useMemo } from 'react';
import { ModuleCard } from './ModuleCard';
import { Knob } from './Knob';
import { 
  ChorusParams, 
  FlangerParams, 
  PhaserParams, 
  TremoloParams, 
  RingModParams, 
  AutoPanParams,
  ModEffect,
  modulationEngine,
} from '@/audio/ModulationEngine';
import { ModRoutingMode, ModTarget, ModOffsetsPerTrack } from '@/hooks/useModulationState';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RotateCcw } from 'lucide-react';

interface ModulationModuleProps {
  chorus: ChorusParams;
  flanger: FlangerParams;
  phaser: PhaserParams;
  tremolo: TremoloParams;
  ringMod: RingModParams;
  autoPan: AutoPanParams;
  bypassed: Record<ModEffect, boolean>;
  routingMode: ModRoutingMode;
  targets: ModTarget[];
  modOffsetsPerTrack: ModOffsetsPerTrack;
  onChorusChange: (params: Partial<ChorusParams>) => void;
  onFlangerChange: (params: Partial<FlangerParams>) => void;
  onPhaserChange: (params: Partial<PhaserParams>) => void;
  onTremoloChange: (params: Partial<TremoloParams>) => void;
  onRingModChange: (params: Partial<RingModParams>) => void;
  onAutoPanChange: (params: Partial<AutoPanParams>) => void;
  onBypassToggle: (effect: ModEffect) => void;
  onRoutingModeChange: (mode: ModRoutingMode) => void;
  onTargetToggle: (target: ModTarget) => void;
  onModOffsetChange: (track: ModTarget, effect: ModEffect, param: string, value: number) => void;
  onResetTrackModOffsets: (track: ModTarget) => void;
}

const targetButtons: { id: ModTarget; label: string }[] = [
  { id: 'drums', label: 'D' },
  { id: 'synth', label: 'S' },
  { id: 'texture', label: 'T' },
  { id: 'sample', label: 'Smp' },
];

const voiceOptions: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];
const stageOptions: (2 | 4 | 6 | 8)[] = [2, 4, 6, 8];
const shapeOptions: ('sine' | 'square' | 'triangle')[] = ['sine', 'square', 'triangle'];
const panShapeOptions: ('sine' | 'triangle')[] = ['sine', 'triangle'];

// Offset <-> Knob conversions (offset -0.5 to +0.5, knob 0 to 100)
const offsetToKnob = (offset: number) => 50 + offset * 100;
const knobToOffset = (knob: number) => (knob - 50) / 100;

export function ModulationModule({
  chorus,
  flanger,
  phaser,
  tremolo,
  ringMod,
  autoPan,
  bypassed,
  routingMode,
  targets,
  modOffsetsPerTrack,
  onChorusChange,
  onFlangerChange,
  onPhaserChange,
  onTremoloChange,
  onRingModChange,
  onAutoPanChange,
  onBypassToggle,
  onRoutingModeChange,
  onTargetToggle,
  onModOffsetChange,
  onResetTrackModOffsets,
}: ModulationModuleProps) {
  const [muted, setMuted] = useState(false);
  const [activeTab, setActiveTab] = useState<ModEffect>('chorus');
  const [selectedEditTrack, setSelectedEditTrack] = useState<ModTarget>('drums');

  const isActive = routingMode === 'master' || targets.length > 0;
  const showNoTargetWarning = routingMode === 'individual' && targets.length === 0;

  // Determine which track is being edited (like FX module)
  const editingTrack: ModTarget = useMemo(() => {
    if (routingMode === 'master') return 'drums';
    if (selectedEditTrack && targets.includes(selectedEditTrack)) {
      return selectedEditTrack;
    }
    return targets[0] || 'drums';
  }, [routingMode, targets, selectedEditTrack]);

  const multipleTracksSelected = routingMode === 'individual' && targets.length > 1;

  // Check if any effect is active (not bypassed)
  const hasActiveEffect = Object.values(bypassed).some(b => !b);

  const handleBypassClick = (effect: ModEffect) => {
    onBypassToggle(effect);
    modulationEngine.setBypass(effect, !bypassed[effect]);
  };

  // Handle track click - toggle AND select for editing
  const handleTrackClick = (target: ModTarget) => {
    const isCurrentlyActive = targets.includes(target);
    onTargetToggle(target);
    // If activating, auto-select for editing
    if (!isCurrentlyActive) {
      setSelectedEditTrack(target);
    }
  };

  // Get current track's offsets for the active effect
  const currentTrackOffsets = modOffsetsPerTrack[editingTrack][activeTab];

  // Render offset knobs based on active effect
  const renderTrackOffsets = () => {
    const track = editingTrack;
    const effect = activeTab;

    switch (effect) {
      case 'chorus': {
        const offsets = modOffsetsPerTrack[track].chorus;
        return (
          <div className="grid grid-cols-3 gap-2">
            <Knob
              value={offsetToKnob(offsets.rate)}
              onChange={(v) => onModOffsetChange(track, effect, 'rate', knobToOffset(v))}
              label="Rate±"
              size="sm"
              variant="secondary"
            />
            <Knob
              value={offsetToKnob(offsets.depth)}
              onChange={(v) => onModOffsetChange(track, effect, 'depth', knobToOffset(v))}
              label="Depth±"
              size="sm"
              variant="secondary"
            />
            <Knob
              value={offsetToKnob(offsets.mix)}
              onChange={(v) => onModOffsetChange(track, effect, 'mix', knobToOffset(v))}
              label="Mix±"
              size="sm"
              variant="secondary"
            />
          </div>
        );
      }
      case 'flanger': {
        const offsets = modOffsetsPerTrack[track].flanger;
        return (
          <div className="grid grid-cols-4 gap-2">
            <Knob
              value={offsetToKnob(offsets.rate)}
              onChange={(v) => onModOffsetChange(track, effect, 'rate', knobToOffset(v))}
              label="Rate±"
              size="sm"
              variant="secondary"
            />
            <Knob
              value={offsetToKnob(offsets.depth)}
              onChange={(v) => onModOffsetChange(track, effect, 'depth', knobToOffset(v))}
              label="Depth±"
              size="sm"
              variant="secondary"
            />
            <Knob
              value={offsetToKnob(offsets.feedback)}
              onChange={(v) => onModOffsetChange(track, effect, 'feedback', knobToOffset(v))}
              label="Fdbk±"
              size="sm"
              variant="secondary"
            />
            <Knob
              value={offsetToKnob(offsets.mix)}
              onChange={(v) => onModOffsetChange(track, effect, 'mix', knobToOffset(v))}
              label="Mix±"
              size="sm"
              variant="secondary"
            />
          </div>
        );
      }
      case 'phaser': {
        const offsets = modOffsetsPerTrack[track].phaser;
        return (
          <div className="grid grid-cols-3 gap-2">
            <Knob
              value={offsetToKnob(offsets.rate)}
              onChange={(v) => onModOffsetChange(track, effect, 'rate', knobToOffset(v))}
              label="Rate±"
              size="sm"
              variant="secondary"
            />
            <Knob
              value={offsetToKnob(offsets.depth)}
              onChange={(v) => onModOffsetChange(track, effect, 'depth', knobToOffset(v))}
              label="Depth±"
              size="sm"
              variant="secondary"
            />
            <Knob
              value={offsetToKnob(offsets.mix)}
              onChange={(v) => onModOffsetChange(track, effect, 'mix', knobToOffset(v))}
              label="Mix±"
              size="sm"
              variant="secondary"
            />
          </div>
        );
      }
      case 'tremolo': {
        const offsets = modOffsetsPerTrack[track].tremolo;
        return (
          <div className="grid grid-cols-2 gap-2">
            <Knob
              value={offsetToKnob(offsets.rate)}
              onChange={(v) => onModOffsetChange(track, effect, 'rate', knobToOffset(v))}
              label="Rate±"
              size="sm"
              variant="secondary"
            />
            <Knob
              value={offsetToKnob(offsets.depth)}
              onChange={(v) => onModOffsetChange(track, effect, 'depth', knobToOffset(v))}
              label="Depth±"
              size="sm"
              variant="secondary"
            />
          </div>
        );
      }
      case 'ringMod': {
        const offsets = modOffsetsPerTrack[track].ringMod;
        return (
          <div className="grid grid-cols-2 gap-2">
            <Knob
              value={offsetToKnob(offsets.frequency)}
              onChange={(v) => onModOffsetChange(track, effect, 'frequency', knobToOffset(v))}
              label="Freq±"
              size="sm"
              variant="secondary"
            />
            <Knob
              value={offsetToKnob(offsets.mix)}
              onChange={(v) => onModOffsetChange(track, effect, 'mix', knobToOffset(v))}
              label="Mix±"
              size="sm"
              variant="secondary"
            />
          </div>
        );
      }
      case 'autoPan': {
        const offsets = modOffsetsPerTrack[track].autoPan;
        return (
          <div className="grid grid-cols-2 gap-2">
            <Knob
              value={offsetToKnob(offsets.rate)}
              onChange={(v) => onModOffsetChange(track, effect, 'rate', knobToOffset(v))}
              label="Rate±"
              size="sm"
              variant="secondary"
            />
            <Knob
              value={offsetToKnob(offsets.depth)}
              onChange={(v) => onModOffsetChange(track, effect, 'depth', knobToOffset(v))}
              label="Depth±"
              size="sm"
              variant="secondary"
            />
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <ModuleCard 
      title="MOD" 
      icon="~" 
      muted={muted} 
      onMuteToggle={() => setMuted(!muted)}
    >
      <div className="space-y-3">
        {/* Routing Mode Selector */}
        <div className="space-y-2">
          <div className="flex gap-1">
            <Button
              variant={routingMode === 'master' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onRoutingModeChange('master')}
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
              onClick={() => onRoutingModeChange('individual')}
              className={cn(
                'flex-1 h-7 text-[10px] font-medium',
                routingMode === 'individual' && 'bg-primary text-primary-foreground'
              )}
            >
              TRACKS
            </Button>
          </div>
          
          {/* Individual track selectors */}
          {routingMode === 'individual' && (
            <div className="flex flex-col gap-1">
              <div className="flex gap-1">
                {targetButtons.map(({ id, label }) => {
                  const isActiveTarget = targets.includes(id);
                  const isEditing = isActiveTarget && id === editingTrack;
                  return (
                    <Button
                      key={id}
                      variant={isActiveTarget ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleTrackClick(id)}
                      className={cn(
                        'flex-1 h-6 text-[10px] font-mono transition-all',
                        isActiveTarget 
                          ? 'bg-primary/80 text-primary-foreground border-primary' 
                          : 'opacity-60 hover:opacity-100',
                        isEditing && 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-background'
                      )}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
              {multipleTracksSelected && (
                <div className="text-[9px] text-yellow-400 text-center flex items-center justify-center gap-1">
                  <span>Editing:</span>
                  <span className="font-mono uppercase">{editingTrack}</span>
                </div>
              )}
            </div>
          )}
          
          {showNoTargetWarning && (
            <div className="text-[9px] text-muted-foreground/60 text-center italic">
              Select a track
            </div>
          )}
        </div>

        {/* Effect Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ModEffect)} className="w-full">
          <TabsList className="grid grid-cols-6 h-7 p-0.5 bg-muted/50">
            {(['chorus', 'flanger', 'phaser', 'tremolo', 'ringMod', 'autoPan'] as ModEffect[]).map(effect => (
              <TabsTrigger 
                key={effect}
                value={effect}
                className={cn(
                  'text-[9px] h-6 px-1 data-[state=active]:bg-background relative',
                  !bypassed[effect] && 'text-primary'
                )}
              >
                <span className={cn(
                  'absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full',
                  !bypassed[effect] 
                    ? 'bg-primary shadow-[0_0_4px_hsl(var(--primary))]' 
                    : 'bg-muted-foreground/30'
                )} />
                {effect === 'chorus' && 'CHR'}
                {effect === 'flanger' && 'FLG'}
                {effect === 'phaser' && 'PHS'}
                {effect === 'tremolo' && 'TRM'}
                {effect === 'ringMod' && 'RNG'}
                {effect === 'autoPan' && 'PAN'}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Chorus Tab */}
          <TabsContent value="chorus" className="mt-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Chorus</span>
              <Button
                variant={bypassed.chorus ? 'outline' : 'default'}
                size="sm"
                onClick={() => handleBypassClick('chorus')}
                className="h-5 px-2 text-[9px]"
              >
                {bypassed.chorus ? 'OFF' : 'ON'}
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <Knob
                value={chorus.rate * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onChorusChange({ rate: val });
                  modulationEngine.setChorusParams({ rate: val });
                }}
                label="Rate"
                size="sm"
                variant={muted || bypassed.chorus ? 'secondary' : 'primary'}
              />
              <Knob
                value={chorus.depth * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onChorusChange({ depth: val });
                  modulationEngine.setChorusParams({ depth: val });
                }}
                label="Depth"
                size="sm"
                variant={muted || bypassed.chorus ? 'secondary' : 'primary'}
              />
              <Knob
                value={chorus.mix * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onChorusChange({ mix: val });
                  modulationEngine.setChorusParams({ mix: val });
                }}
                label="Mix"
                size="sm"
                variant={muted || bypassed.chorus ? 'secondary' : 'accent'}
              />
              <div className="flex flex-col items-center gap-1">
                <span className="text-[8px] text-muted-foreground">Voices</span>
                <div className="flex gap-0.5">
                  {voiceOptions.map(v => (
                    <button
                      key={v}
                      onClick={() => {
                        onChorusChange({ voices: v });
                        modulationEngine.setChorusParams({ voices: v });
                      }}
                      className={cn(
                        'w-5 h-5 text-[9px] rounded transition-colors',
                        chorus.voices === v 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Flanger Tab */}
          <TabsContent value="flanger" className="mt-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Flanger</span>
              <Button
                variant={bypassed.flanger ? 'outline' : 'default'}
                size="sm"
                onClick={() => handleBypassClick('flanger')}
                className="h-5 px-2 text-[9px]"
              >
                {bypassed.flanger ? 'OFF' : 'ON'}
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <Knob
                value={flanger.rate * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onFlangerChange({ rate: val });
                  modulationEngine.setFlangerParams({ rate: val });
                }}
                label="Rate"
                size="sm"
                variant={muted || bypassed.flanger ? 'secondary' : 'primary'}
              />
              <Knob
                value={flanger.depth * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onFlangerChange({ depth: val });
                  modulationEngine.setFlangerParams({ depth: val });
                }}
                label="Depth"
                size="sm"
                variant={muted || bypassed.flanger ? 'secondary' : 'primary'}
              />
              <Knob
                value={flanger.feedback * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onFlangerChange({ feedback: val });
                  modulationEngine.setFlangerParams({ feedback: val });
                }}
                label="Fdbk"
                size="sm"
                variant={muted || bypassed.flanger ? 'secondary' : 'primary'}
              />
              <Knob
                value={flanger.mix * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onFlangerChange({ mix: val });
                  modulationEngine.setFlangerParams({ mix: val });
                }}
                label="Mix"
                size="sm"
                variant={muted || bypassed.flanger ? 'secondary' : 'accent'}
              />
            </div>
          </TabsContent>

          {/* Phaser Tab */}
          <TabsContent value="phaser" className="mt-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Phaser</span>
              <Button
                variant={bypassed.phaser ? 'outline' : 'default'}
                size="sm"
                onClick={() => handleBypassClick('phaser')}
                className="h-5 px-2 text-[9px]"
              >
                {bypassed.phaser ? 'OFF' : 'ON'}
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <Knob
                value={phaser.rate * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onPhaserChange({ rate: val });
                  modulationEngine.setPhaserParams({ rate: val });
                }}
                label="Rate"
                size="sm"
                variant={muted || bypassed.phaser ? 'secondary' : 'primary'}
              />
              <Knob
                value={phaser.depth * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onPhaserChange({ depth: val });
                  modulationEngine.setPhaserParams({ depth: val });
                }}
                label="Depth"
                size="sm"
                variant={muted || bypassed.phaser ? 'secondary' : 'primary'}
              />
              <Knob
                value={phaser.mix * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onPhaserChange({ mix: val });
                  modulationEngine.setPhaserParams({ mix: val });
                }}
                label="Mix"
                size="sm"
                variant={muted || bypassed.phaser ? 'secondary' : 'accent'}
              />
              <div className="flex flex-col items-center gap-1">
                <span className="text-[8px] text-muted-foreground">Stages</span>
                <div className="flex gap-0.5">
                  {stageOptions.map(s => (
                    <button
                      key={s}
                      onClick={() => {
                        onPhaserChange({ stages: s });
                        modulationEngine.setPhaserParams({ stages: s });
                      }}
                      className={cn(
                        'w-5 h-5 text-[9px] rounded transition-colors',
                        phaser.stages === s 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Tremolo Tab */}
          <TabsContent value="tremolo" className="mt-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Tremolo</span>
              <Button
                variant={bypassed.tremolo ? 'outline' : 'default'}
                size="sm"
                onClick={() => handleBypassClick('tremolo')}
                className="h-5 px-2 text-[9px]"
              >
                {bypassed.tremolo ? 'OFF' : 'ON'}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Knob
                value={tremolo.rate * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onTremoloChange({ rate: val });
                  modulationEngine.setTremoloParams({ rate: val });
                }}
                label="Rate"
                size="sm"
                variant={muted || bypassed.tremolo ? 'secondary' : 'primary'}
              />
              <Knob
                value={tremolo.depth * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onTremoloChange({ depth: val });
                  modulationEngine.setTremoloParams({ depth: val });
                }}
                label="Depth"
                size="sm"
                variant={muted || bypassed.tremolo ? 'secondary' : 'primary'}
              />
              <div className="flex flex-col items-center gap-1">
                <span className="text-[8px] text-muted-foreground">Shape</span>
                <div className="flex gap-0.5">
                  {shapeOptions.map(s => (
                    <button
                      key={s}
                      onClick={() => {
                        onTremoloChange({ shape: s });
                        modulationEngine.setTremoloParams({ shape: s });
                      }}
                      className={cn(
                        'px-1.5 h-5 text-[8px] rounded transition-colors',
                        tremolo.shape === s 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                      )}
                    >
                      {s === 'sine' ? '∿' : s === 'square' ? '⊓' : '△'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Ring Mod Tab */}
          <TabsContent value="ringMod" className="mt-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Ring Modulator</span>
              <Button
                variant={bypassed.ringMod ? 'outline' : 'default'}
                size="sm"
                onClick={() => handleBypassClick('ringMod')}
                className="h-5 px-2 text-[9px]"
              >
                {bypassed.ringMod ? 'OFF' : 'ON'}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Knob
                value={ringMod.frequency * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onRingModChange({ frequency: val });
                  modulationEngine.setRingModParams({ frequency: val });
                }}
                label="Freq"
                size="sm"
                variant={muted || bypassed.ringMod ? 'secondary' : 'primary'}
              />
              <Knob
                value={ringMod.mix * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onRingModChange({ mix: val });
                  modulationEngine.setRingModParams({ mix: val });
                }}
                label="Mix"
                size="sm"
                variant={muted || bypassed.ringMod ? 'secondary' : 'accent'}
              />
            </div>
          </TabsContent>

          {/* Auto-Pan Tab */}
          <TabsContent value="autoPan" className="mt-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Auto-Pan</span>
              <Button
                variant={bypassed.autoPan ? 'outline' : 'default'}
                size="sm"
                onClick={() => handleBypassClick('autoPan')}
                className="h-5 px-2 text-[9px]"
              >
                {bypassed.autoPan ? 'OFF' : 'ON'}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Knob
                value={autoPan.rate * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onAutoPanChange({ rate: val });
                  modulationEngine.setAutoPanParams({ rate: val });
                }}
                label="Rate"
                size="sm"
                variant={muted || bypassed.autoPan ? 'secondary' : 'primary'}
              />
              <Knob
                value={autoPan.depth * 100}
                onChange={(v) => {
                  const val = v / 100;
                  onAutoPanChange({ depth: val });
                  modulationEngine.setAutoPanParams({ depth: val });
                }}
                label="Depth"
                size="sm"
                variant={muted || bypassed.autoPan ? 'secondary' : 'primary'}
              />
              <div className="flex flex-col items-center gap-1">
                <span className="text-[8px] text-muted-foreground">Shape</span>
                <div className="flex gap-0.5">
                  {panShapeOptions.map(s => (
                    <button
                      key={s}
                      onClick={() => {
                        onAutoPanChange({ shape: s });
                        modulationEngine.setAutoPanParams({ shape: s });
                      }}
                      className={cn(
                        'px-2 h-5 text-[9px] rounded transition-colors',
                        autoPan.shape === s 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                      )}
                    >
                      {s === 'sine' ? '∿' : '△'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Track Offsets Section - Only shown in TRACKS mode */}
        {routingMode === 'individual' && targets.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                Track Offsets {multipleTracksSelected && `(${editingTrack})`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onResetTrackModOffsets(editingTrack)}
                className="h-5 px-1.5 text-[9px] text-muted-foreground hover:text-foreground"
                title={`Reset ${editingTrack} offsets`}
              >
                <RotateCcw className="w-3 h-3" />
              </Button>
            </div>
            {renderTrackOffsets()}
          </div>
        )}
      </div>
    </ModuleCard>
  );
}
