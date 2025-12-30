import { useState } from 'react';
import { Shuffle, Target, Trash2, RotateCcw, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { 
  generateEuclidean, 
  generateRandom, 
  euclideanPresets, 
  EuclideanPresetName 
} from '@/audio/EuclideanGenerator';

interface Step {
  active: boolean;
  velocity: number;
  probability: number;
}

interface EuclideanControlsProps {
  onPatternGenerate: (steps: Step[]) => void;
  patternLength?: number;
  variant?: 'primary' | 'secondary' | 'muted';
}

export const EuclideanControls = ({
  onPatternGenerate,
  patternLength = 16,
  variant = 'primary',
}: EuclideanControlsProps) => {
  const [euclideanOpen, setEuclideanOpen] = useState(false);
  const [pulses, setPulses] = useState(4);
  const [rotation, setRotation] = useState(0);
  const [randomDensity, setRandomDensity] = useState(0.5);

  const applyEuclidean = () => {
    const { steps } = generateEuclidean(pulses, patternLength, rotation);
    const newSteps: Step[] = steps.map((active) => ({
      active,
      velocity: 80 + Math.random() * 40,
      probability: 100,
    }));
    onPatternGenerate(newSteps);
    setEuclideanOpen(false);
  };

  const applyPreset = (presetName: EuclideanPresetName) => {
    const preset = euclideanPresets[presetName];
    // Adapt preset to current pattern length
    const adaptedPulses = Math.round((preset.pulses / preset.steps) * patternLength);
    const { steps } = generateEuclidean(adaptedPulses, patternLength, preset.rotation);
    const newSteps: Step[] = steps.map((active) => ({
      active,
      velocity: 80 + Math.random() * 40,
      probability: 100,
    }));
    onPatternGenerate(newSteps);
    setEuclideanOpen(false);
  };

  const applyRandom = () => {
    const steps = generateRandom(patternLength, randomDensity);
    const newSteps: Step[] = steps.map((active) => ({
      active,
      velocity: 80 + Math.random() * 40,
      probability: 100,
    }));
    onPatternGenerate(newSteps);
  };

  const clearPattern = () => {
    const newSteps: Step[] = Array(patternLength).fill(null).map(() => ({
      active: false,
      velocity: 100,
      probability: 100,
    }));
    onPatternGenerate(newSteps);
  };

  const variantColors = {
    primary: 'text-primary hover:bg-primary/10',
    secondary: 'text-secondary hover:bg-secondary/10',
    muted: 'text-muted-foreground hover:bg-muted',
  };

  return (
    <div className="flex items-center gap-1">
      {/* Euclidean Generator */}
      <Popover open={euclideanOpen} onOpenChange={setEuclideanOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-6 px-1.5', variantColors[variant])}
            title="Euclidean Generator"
          >
            <Target className="w-3 h-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="space-y-3">
            <div className="text-xs font-medium text-foreground">Euclidean Generator</div>
            
            {/* Pulses slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Pulses</span>
                <span>{pulses}</span>
              </div>
              <Slider
                value={[pulses]}
                onValueChange={([v]) => setPulses(v)}
                min={1}
                max={patternLength}
                step={1}
              />
            </div>

            {/* Rotation slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Rotation</span>
                <span>{rotation}</span>
              </div>
              <Slider
                value={[rotation]}
                onValueChange={([v]) => setRotation(v)}
                min={0}
                max={patternLength - 1}
                step={1}
              />
            </div>

            {/* Apply button */}
            <Button 
              size="sm" 
              onClick={applyEuclidean} 
              className="w-full"
            >
              Generate
            </Button>

            {/* Presets */}
            <div className="pt-2 border-t border-border">
              <div className="text-xs text-muted-foreground mb-2">Presets</div>
              <div className="grid grid-cols-2 gap-1">
                {(['4-on-floor', 'offbeat-hat', 'son-clave', 'idm-sparse'] as EuclideanPresetName[]).map((preset) => (
                  <Button
                    key={preset}
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset)}
                    className="text-xs h-7"
                  >
                    {preset}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Random Generator */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-6 px-1.5', variantColors[variant])}
            title="Random Pattern"
          >
            <Shuffle className="w-3 h-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-3" align="start">
          <div className="space-y-3">
            <div className="text-xs font-medium text-foreground">Random Pattern</div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Density</span>
                <span>{Math.round(randomDensity * 100)}%</span>
              </div>
              <Slider
                value={[randomDensity * 100]}
                onValueChange={([v]) => setRandomDensity(v / 100)}
                min={10}
                max={90}
                step={10}
              />
            </div>

            <Button 
              size="sm" 
              onClick={applyRandom} 
              className="w-full"
            >
              Randomize
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear */}
      <Button
        variant="ghost"
        size="sm"
        className={cn('h-6 px-1.5', variantColors[variant])}
        onClick={clearPattern}
        title="Clear Pattern"
      >
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
};
