import { useState } from 'react';
import { Zap, Radio, Square, Disc, Sparkles } from 'lucide-react';
import { ModuleCard } from './ModuleCard';
import { Knob } from './Knob';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  glitchEngine, 
  StutterParams, 
  BitcrushParams 
} from '@/audio/GlitchEngine';

interface GlitchModuleProps {
  className?: string;
}

export const GlitchModule = ({ className }: GlitchModuleProps) => {
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
    <ModuleCard
      title="Glitch"
      icon={<Zap className="w-4 h-4" />}
      muted={muted}
      onMuteToggle={handleMuteToggle}
      className={className}
    >
      <div className="space-y-4">
        {/* Trigger Buttons */}
        <div className="grid grid-cols-4 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleStutterTrigger}
            disabled={muted}
            className={cn(
              'h-10 flex flex-col items-center justify-center gap-1',
              activeEffect === 'stutter' && 'bg-primary/20 border-primary'
            )}
          >
            <Radio className="w-4 h-4" />
            <span className="text-[10px]">Stutter</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleTapeStopTrigger}
            disabled={muted}
            className={cn(
              'h-10 flex flex-col items-center justify-center gap-1',
              activeEffect === 'tapestop' && 'bg-primary/20 border-primary'
            )}
          >
            <Square className="w-4 h-4" />
            <span className="text-[10px]">Tape</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleFreezeTrigger}
            disabled={muted}
            className={cn(
              'h-10 flex flex-col items-center justify-center gap-1',
              activeEffect === 'freeze' && 'bg-primary/20 border-primary'
            )}
          >
            <Disc className="w-4 h-4" />
            <span className="text-[10px]">Freeze</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleBitcrushTrigger}
            disabled={muted}
            className={cn(
              'h-10 flex flex-col items-center justify-center gap-1',
              activeEffect === 'crush' && 'bg-primary/20 border-primary'
            )}
          >
            <Zap className="w-4 h-4" />
            <span className="text-[10px]">Crush</span>
          </Button>
        </div>

        {/* Stutter Section */}
        <div className="space-y-2">
          <div className="text-label text-muted-foreground flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
            Stutter
          </div>
          
          {/* Division selector */}
          <div className="flex gap-1">
            {divisions.map((div) => (
              <button
                key={div}
                onClick={() => {
                  setStutterParams(prev => ({ ...prev, division: div }));
                  glitchEngine.setStutterParams({ division: div });
                }}
                disabled={muted}
                className={cn(
                  'flex-1 py-1 text-[10px] font-mono rounded border transition-colors',
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
          
          <div className="grid grid-cols-2 gap-3">
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

        {/* Bitcrush Section */}
        <div className="space-y-2">
          <div className="text-label text-muted-foreground flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent/60" />
            Bitcrush
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Knob
              value={bitcrushParams.bits * 6.25}
              onChange={(v) => {
                const bits = Math.round(v / 6.25);
                setBitcrushParams(prev => ({ ...prev, bits: Math.max(1, Math.min(16, bits)) }));
                glitchEngine.setBitcrushParams({ bits });
              }}
              label={`Bits: ${bitcrushParams.bits}`}
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
        
        {/* Chaos Mode Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-label text-muted-foreground flex items-center gap-2">
              <span className={cn(
                'w-1.5 h-1.5 rounded-full',
                chaosEnabled ? 'bg-destructive animate-pulse' : 'bg-muted-foreground/60'
              )} />
              Chaos Mode
            </div>
            <Button
              variant={chaosEnabled ? 'destructive' : 'outline'}
              size="sm"
              onClick={handleChaosToggle}
              disabled={muted}
              className={cn(
                'h-7 px-3',
                chaosEnabled && 'animate-pulse'
              )}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              {chaosEnabled ? 'Active' : 'Enable'}
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <Knob
              value={chaosParams.density}
              onChange={(v) => {
                setChaosParams(prev => ({ ...prev, density: v }));
                if (chaosEnabled) {
                  glitchEngine.setChaosParams({ density: v / 100 });
                }
              }}
              label="Density"
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
              label="Intensity"
              size="sm"
              variant={muted ? 'secondary' : chaosEnabled ? 'accent' : 'secondary'}
            />
          </div>
        </div>
      </div>
    </ModuleCard>
  );
};
