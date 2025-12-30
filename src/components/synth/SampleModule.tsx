import { useRef, useEffect, useCallback } from 'react';
import { Music, Upload, X, Play, Square } from 'lucide-react';
import { ModuleCard } from './ModuleCard';
import { Knob } from './Knob';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SampleParams } from '@/audio/SampleEngine';
import { decodeAudioFile, validateAudioFile } from '@/utils/audioDecoder';
import { toast } from 'sonner';

interface SampleModuleProps {
  buffer: AudioBuffer | null;
  sampleName: string;
  muted: boolean;
  params: SampleParams;
  isPlaying: boolean;
  onLoadSample: (buffer: AudioBuffer, name: string) => void;
  onClearSample: () => void;
  onParamsChange: (params: SampleParams) => void;
  onMuteToggle: () => void;
  onPlayToggle: () => void;
}

export const SampleModule = ({
  buffer,
  sampleName,
  muted,
  params,
  isPlaying,
  onLoadSample,
  onClearSample,
  onParamsChange,
  onMuteToggle,
  onPlayToggle,
}: SampleModuleProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;

    const { width, height } = canvas;
    ctx.fillStyle = 'hsl(var(--muted) / 0.3)';
    ctx.fillRect(0, 0, width, height);

    if (!buffer) {
      // No sample loaded - show placeholder
      ctx.fillStyle = 'hsl(var(--muted-foreground) / 0.3)';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Drop WAV here', width / 2, height / 2 + 8);
      return;
    }

    // Draw waveform
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.strokeStyle = 'hsl(var(--primary))';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let i = 0; i < width; i++) {
      const idx = Math.floor(i * step);
      const value = data[idx] || 0;
      const y = amp + value * amp * 0.9;

      if (i === 0) {
        ctx.moveTo(i, y);
      } else {
        ctx.lineTo(i, y);
      }
    }

    ctx.stroke();

    // Draw start point marker
    const startX = params.startPoint * width;
    ctx.strokeStyle = 'hsl(var(--destructive))';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, height);
    ctx.stroke();

    // Draw loop end marker
    const endX = (params.startPoint + params.loopLength) * width;
    ctx.strokeStyle = 'hsl(var(--chart-2))';
    ctx.beginPath();
    ctx.moveTo(Math.min(endX, width), 0);
    ctx.lineTo(Math.min(endX, width), height);
    ctx.stroke();

    // Shade active region
    ctx.fillStyle = 'hsl(var(--primary) / 0.1)';
    ctx.fillRect(startX, 0, Math.min(endX, width) - startX, height);
  }, [buffer, params.startPoint, params.loopLength]);

  const handleFileSelect = useCallback(async (file: File) => {
    const validation = validateAudioFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    try {
      const audioBuffer = await decodeAudioFile(file);
      onLoadSample(audioBuffer, file.name);
      toast.success(`Loaded: ${file.name}`);
    } catch (error) {
      toast.error('Failed to decode audio file');
      console.error(error);
    }
  }, [onLoadSample]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    e.target.value = '';
  }, [handleFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const updateParam = (key: keyof SampleParams, value: number | boolean) => {
    onParamsChange({ ...params, [key]: value });
  };

  return (
    <ModuleCard
      title="Sample"
      icon={<Music className="w-4 h-4" />}
      muted={muted}
      onMuteToggle={onMuteToggle}
    >
      <div className="space-y-4">
        {/* Load button and sample name */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1"
          >
            <Upload className="w-3 h-3 mr-1" />
            {buffer ? 'Replace' : 'Load WAV'}
          </Button>
          {buffer && (
            <>
              <Button
                variant={isPlaying ? 'default' : 'outline'}
                size="sm"
                onClick={onPlayToggle}
              >
                {isPlaying ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSample}
              >
                <X className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>

        {sampleName && (
          <div className="text-xs text-muted-foreground truncate">
            {sampleName}
          </div>
        )}

        {/* Waveform display */}
        <div
          className="waveform-container h-16 cursor-pointer"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>

        {/* Parameters */}
        <div className="grid grid-cols-4 gap-3 pt-2">
          <Knob
            value={(params.pitch - 0.5) / 1.5 * 100}
            onChange={(v) => updateParam('pitch', 0.5 + (v / 100) * 1.5)}
            label="Pitch"
            size="sm"
          />
          <Knob
            value={params.startPoint * 100}
            onChange={(v) => updateParam('startPoint', v / 100)}
            label="Start"
            size="sm"
          />
          <Knob
            value={params.loopLength * 100}
            onChange={(v) => updateParam('loopLength', Math.max(0.01, v / 100))}
            label="Length"
            size="sm"
          />
          <Knob
            value={params.volume * 100}
            onChange={(v) => updateParam('volume', v / 100)}
            label="Vol"
            size="sm"
          />
        </div>

        {/* Toggles */}
        <div className="flex gap-2">
          <button
            onClick={() => updateParam('loop', !params.loop)}
            className={cn(
              'flex-1 py-1.5 text-xs uppercase tracking-wider rounded border transition-colors',
              params.loop
                ? 'border-primary bg-primary/20 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            Loop
          </button>
          <button
            onClick={() => updateParam('reverse', !params.reverse)}
            className={cn(
              'flex-1 py-1.5 text-xs uppercase tracking-wider rounded border transition-colors',
              params.reverse
                ? 'border-primary bg-primary/20 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            Reverse
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".wav,.mp3,.ogg,.flac"
          className="hidden"
          onChange={handleFileInputChange}
        />
      </div>
    </ModuleCard>
  );
};
