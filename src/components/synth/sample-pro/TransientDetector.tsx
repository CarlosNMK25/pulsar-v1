import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { detectTransients, transientsToSlices } from '@/audio/TransientAnalyzer';
import { Zap, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TransientDetectorProps {
  buffer: AudioBuffer | null;
  onTransientsDetected: (positions: number[]) => void;
  onApplyAsSlices: (sliceMarkers: number[]) => void;
}

export const TransientDetector = ({
  buffer,
  onTransientsDetected,
  onApplyAsSlices,
}: TransientDetectorProps) => {
  const [threshold, setThreshold] = useState(30);
  const [minDistance, setMinDistance] = useState(50);
  const [mode, setMode] = useState<'peak' | 'rms'>('peak');
  const [detectedCount, setDetectedCount] = useState<number | null>(null);
  const [lastTransients, setLastTransients] = useState<number[]>([]);

  const handleDetect = useCallback(() => {
    if (!buffer) return;

    const result = detectTransients(buffer, {
      threshold: threshold / 100,
      minDistance,
      mode,
    });

    setDetectedCount(result.positions.length);
    setLastTransients(result.positions);
    onTransientsDetected(result.positions);
  }, [buffer, threshold, minDistance, mode, onTransientsDetected]);

  const handleApplySlices = useCallback(() => {
    if (lastTransients.length === 0) return;
    const slices = transientsToSlices(lastTransients, 32);
    onApplyAsSlices(slices);
  }, [lastTransients, onApplyAsSlices]);

  return (
    <div className="space-y-4 p-4 bg-card rounded-lg border border-border">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-chart-4" />
        <h3 className="text-sm font-medium">Transient Detection</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Threshold */}
        <div className="space-y-2">
          <Label className="text-xs">Threshold: {threshold}%</Label>
          <Slider
            value={[threshold]}
            onValueChange={([v]) => setThreshold(v)}
            min={10}
            max={80}
            step={1}
          />
        </div>

        {/* Min Distance */}
        <div className="space-y-2">
          <Label className="text-xs">Min Distance: {minDistance}ms</Label>
          <Slider
            value={[minDistance]}
            onValueChange={([v]) => setMinDistance(v)}
            min={20}
            max={500}
            step={10}
          />
        </div>
      </div>

      {/* Mode selector */}
      <div className="flex items-center gap-2">
        <Label className="text-xs">Mode:</Label>
        <div className="flex gap-1">
          {(['peak', 'rms'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'px-3 py-1 text-xs uppercase rounded border transition-colors',
                mode === m
                  ? 'border-primary bg-primary/20 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDetect}
          disabled={!buffer}
          className="flex-1"
        >
          <Zap className="w-3 h-3 mr-1" />
          Detect
        </Button>
        
        <Button
          variant="default"
          size="sm"
          onClick={handleApplySlices}
          disabled={lastTransients.length === 0}
          className="flex-1"
        >
          <Check className="w-3 h-3 mr-1" />
          Apply as Slices
        </Button>
      </div>

      {/* Results */}
      {detectedCount !== null && (
        <div className="text-xs text-muted-foreground text-center">
          Found {detectedCount} transients
        </div>
      )}
    </div>
  );
};
