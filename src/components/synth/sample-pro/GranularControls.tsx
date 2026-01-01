import { Knob } from '../Knob';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { GranularParams } from '@/audio/GranularEngine';
import { Waves } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GranularControlsProps {
  params: GranularParams;
  enabled: boolean;
  onParamsChange: (params: Partial<GranularParams>) => void;
  onEnabledChange: (enabled: boolean) => void;
}

export const GranularControls = ({
  params,
  enabled,
  onParamsChange,
  onEnabledChange,
}: GranularControlsProps) => {
  const windowTypes: ('hann' | 'triangle' | 'trapezoid')[] = ['hann', 'triangle', 'trapezoid'];

  return (
    <div className="space-y-4 p-4 bg-card rounded-lg border border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Waves className="w-4 h-4 text-chart-5" />
          <h3 className="text-sm font-medium">Granular Synthesis</h3>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>

      <div className={cn('space-y-4 transition-opacity', !enabled && 'opacity-40 pointer-events-none')}>
        {/* Main controls */}
        <div className="grid grid-cols-4 gap-3">
          <Knob
            value={(params.grainSize - 10) / 4.9}
            onChange={(v) => onParamsChange({ grainSize: 10 + v * 4.9 })}
            label="Size"
            size="sm"
          />
          <Knob
            value={(params.grainDensity - 1) / 0.49}
            onChange={(v) => onParamsChange({ grainDensity: 1 + v * 0.49 })}
            label="Density"
            size="sm"
          />
          <Knob
            value={(params.timeStretch - 0.25) / 0.0375}
            onChange={(v) => onParamsChange({ timeStretch: 0.25 + v * 0.0375 })}
            label="Stretch"
            size="sm"
          />
          <Knob
            value={(params.pitchShift + 12) / 0.24}
            onChange={(v) => onParamsChange({ pitchShift: v * 0.24 - 12 })}
            label="Pitch"
            size="sm"
          />
        </div>

        {/* Scatter controls */}
        <div className="grid grid-cols-2 gap-3">
          <Knob
            value={params.pitchScatter * 100}
            onChange={(v) => onParamsChange({ pitchScatter: v / 100 })}
            label="Pitch Scatter"
            size="sm"
          />
          <Knob
            value={params.positionScatter * 100}
            onChange={(v) => onParamsChange({ positionScatter: v / 100 })}
            label="Pos Scatter"
            size="sm"
          />
        </div>

        {/* Window type */}
        <div className="space-y-2">
          <Label className="text-xs">Window Type:</Label>
          <div className="flex gap-1">
            {windowTypes.map((type) => (
              <button
                key={type}
                onClick={() => onParamsChange({ windowType: type })}
                className={cn(
                  'flex-1 py-1 text-xs capitalize rounded border transition-colors',
                  params.windowType === type
                    ? 'border-chart-5 bg-chart-5/20 text-chart-5'
                    : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
