import { useState } from 'react';
import { Zap, Radio, Square, Disc, Sparkles, Rewind } from 'lucide-react';
import { Knob } from './Knob';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  glitchEngine, 
  StutterParams, 
  BitcrushParams 
} from '@/audio/GlitchEngine';

interface GlitchModuleCompactProps {
  className?: string;
}

export const GlitchModuleCompact = ({ className }: GlitchModuleCompactProps) => {
  const [muted, setMuted] = useState(true);
  const [activeEffect, setActiveEffect] = useState<string | null>(null);
  const [chaosEnabled, setChaosEnabled] = useState(false);
  
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

  const handleMuteToggle = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    glitchEngine.setBypass(newMuted);
    if (newMuted && chaosEnabled) {
      setChaosEnabled(false);
      glitchEngine.stopChaos();
    }
  };

  const handleStutterTrigger = () => {
    if (muted) return;
    setActiveEffect('stutter');
    glitchEngine.triggerStutter();
    setTimeout(() => setActiveEffect(null), 200);
  };

  const handleTapeStopTrigger = () => {
    if (muted) return;
    setActiveEffect('tapestop');
    glitchEngine.triggerTapeStop();
    setTimeout(() => setActiveEffect(null), 500);
  };

  const handleFreezeTrigger = () => {
    if (muted) return;
    setActiveEffect('freeze');
    glitchEngine.triggerGranularFreeze();
    setTimeout(() => setActiveEffect(null), 300);
  };
  
  const handleBitcrushTrigger = () => {
    if (muted) return;
    setActiveEffect('crush');
    glitchEngine.triggerBitcrush();
    setTimeout(() => setActiveEffect(null), 500);
  };

  const handleReverseTrigger = () => {
    if (muted) return;
    setActiveEffect('reverse');
    glitchEngine.triggerReverse();
    setTimeout(() => setActiveEffect(null), 400);
  };
  
  const handleChaosToggle = () => {
    if (muted) return;
    const newEnabled = !chaosEnabled;
    setChaosEnabled(newEnabled);
    
    if (newEnabled) {
      glitchEngine.setChaosParams({
        enabled: true,
        density: chaosParams.density / 100,
        intensity: chaosParams.intensity / 100,
      });
    } else {
      glitchEngine.stopChaos();
    }
  };

  const divisions: StutterParams['division'][] = ['1/4', '1/8', '1/16', '1/32', '1/64'];

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header with mute toggle */}
      <div className="flex items-center justify-between">
        <span className="text-label text-muted-foreground flex items-center gap-2">
          <Zap className="w-3 h-3" />
          Glitch
        </span>
        <Button
          variant={muted ? 'outline' : 'default'}
          size="sm"
          onClick={handleMuteToggle}
          className="h-6 px-2 text-[10px]"
        >
          {muted ? 'Off' : 'On'}
        </Button>
      </div>

      {/* 5 Trigger Buttons - compact */}
      <div className="grid grid-cols-5 gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleStutterTrigger}
          disabled={muted}
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
          disabled={muted}
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
          disabled={muted}
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
          disabled={muted}
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
          disabled={muted}
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
                glitchEngine.setStutterParams({ division: div });
              }}
              disabled={muted}
              className={cn(
                'flex-1 py-0.5 text-[9px] font-mono rounded border transition-colors',
                stutterParams.division === div
                  ? 'border-primary bg-primary/20 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground',
                muted && 'opacity-50'
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
              glitchEngine.setStutterParams({ decay: v / 100 });
            }}
            label="Decay"
            size="sm"
            variant={muted ? 'secondary' : 'primary'}
          />
          <Knob
            value={stutterParams.mix}
            onChange={(v) => {
              setStutterParams(prev => ({ ...prev, mix: v }));
              glitchEngine.setStutterParams({ mix: v / 100 });
            }}
            label="Mix"
            size="sm"
            variant={muted ? 'secondary' : 'accent'}
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
              glitchEngine.setBitcrushParams({ bits });
            }}
            label={`${bitcrushParams.bits}bit`}
            size="sm"
            variant={muted ? 'secondary' : 'primary'}
          />
          <Knob
            value={bitcrushParams.sampleRate}
            onChange={(v) => {
              setBitcrushParams(prev => ({ ...prev, sampleRate: v }));
              glitchEngine.setBitcrushParams({ sampleRate: v / 100 });
            }}
            label="Crush"
            size="sm"
            variant={muted ? 'secondary' : 'accent'}
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
            disabled={muted}
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
                glitchEngine.setChaosParams({ density: v / 100 });
              }
            }}
            label="Dens"
            size="sm"
            variant={muted ? 'secondary' : chaosEnabled ? 'accent' : 'secondary'}
          />
          <Knob
            value={chaosParams.intensity}
            onChange={(v) => {
              setChaosParams(prev => ({ ...prev, intensity: v }));
              if (chaosEnabled) {
                glitchEngine.setChaosParams({ intensity: v / 100 });
              }
            }}
            label="Int"
            size="sm"
            variant={muted ? 'secondary' : chaosEnabled ? 'accent' : 'secondary'}
          />
        </div>
      </div>
    </div>
  );
};
