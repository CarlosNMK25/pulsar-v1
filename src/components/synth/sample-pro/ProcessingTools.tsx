import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { audioEngine } from '@/audio/AudioEngine';
import { Maximize, Scissors, RotateCcw, ArrowRightFromLine, ArrowLeftFromLine, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface ProcessingToolsProps {
  buffer: AudioBuffer | null;
  onBufferProcessed: (buffer: AudioBuffer, name: string) => void;
}

const SAMPLE_RATES = [
  { value: 22050, label: '22050 Hz (-1 oct)' },
  { value: 32000, label: '32000 Hz' },
  { value: 44100, label: '44100 Hz' },
  { value: 48000, label: '48000 Hz' },
  { value: 88200, label: '88200 Hz (+1 oct)' },
];

export const ProcessingTools = ({ buffer, onBufferProcessed }: ProcessingToolsProps) => {
  const [targetSampleRate, setTargetSampleRate] = useState(44100);
  
  // Normalize audio to peak at 1.0
  const handleNormalize = useCallback(async () => {
    if (!buffer) return;
    
    const ctx = audioEngine.getContext();
    const newBuffer = ctx.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    let maxPeak = 0;
    
    // Find max peak across all channels
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        maxPeak = Math.max(maxPeak, Math.abs(data[i]));
      }
    }

    if (maxPeak === 0) {
      toast.error('Buffer is silent');
      return;
    }

    const gain = 1.0 / maxPeak;

    // Apply normalization
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const source = buffer.getChannelData(ch);
      const dest = newBuffer.getChannelData(ch);
      for (let i = 0; i < source.length; i++) {
        dest[i] = source[i] * gain;
      }
    }

    onBufferProcessed(newBuffer, 'normalized');
    toast.success(`Normalized by ${(gain).toFixed(2)}x`);
  }, [buffer, onBufferProcessed]);

  // Trim silence from start and end
  const handleTrim = useCallback(() => {
    if (!buffer) return;

    const ctx = audioEngine.getContext();
    const threshold = 0.01;
    const data = buffer.getChannelData(0);
    
    let startSample = 0;
    let endSample = data.length - 1;

    // Find first non-silent sample
    for (let i = 0; i < data.length; i++) {
      if (Math.abs(data[i]) > threshold) {
        startSample = Math.max(0, i - 100); // Keep tiny buffer
        break;
      }
    }

    // Find last non-silent sample
    for (let i = data.length - 1; i >= 0; i--) {
      if (Math.abs(data[i]) > threshold) {
        endSample = Math.min(data.length - 1, i + 100);
        break;
      }
    }

    const newLength = endSample - startSample + 1;
    
    if (newLength === data.length) {
      toast.info('No silence to trim');
      return;
    }

    const newBuffer = ctx.createBuffer(
      buffer.numberOfChannels,
      newLength,
      buffer.sampleRate
    );

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const source = buffer.getChannelData(ch);
      const dest = newBuffer.getChannelData(ch);
      for (let i = 0; i < newLength; i++) {
        dest[i] = source[startSample + i];
      }
    }

    const trimmedMs = ((buffer.length - newLength) / buffer.sampleRate * 1000).toFixed(0);
    onBufferProcessed(newBuffer, 'trimmed');
    toast.success(`Trimmed ${trimmedMs}ms of silence`);
  }, [buffer, onBufferProcessed]);

  // Reverse entire buffer
  const handleReverse = useCallback(() => {
    if (!buffer) return;

    const ctx = audioEngine.getContext();
    const newBuffer = ctx.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const source = buffer.getChannelData(ch);
      const dest = newBuffer.getChannelData(ch);
      for (let i = 0; i < buffer.length; i++) {
        dest[i] = source[buffer.length - 1 - i];
      }
    }

    onBufferProcessed(newBuffer, 'reversed');
    toast.success('Audio reversed');
  }, [buffer, onBufferProcessed]);

  // Apply fade in
  const handleFadeIn = useCallback(() => {
    if (!buffer) return;

    const ctx = audioEngine.getContext();
    const fadeLength = Math.min(buffer.length, Math.floor(buffer.sampleRate * 0.1)); // 100ms fade
    
    const newBuffer = ctx.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const source = buffer.getChannelData(ch);
      const dest = newBuffer.getChannelData(ch);
      
      for (let i = 0; i < buffer.length; i++) {
        let gain = 1;
        if (i < fadeLength) {
          gain = i / fadeLength;
        }
        dest[i] = source[i] * gain;
      }
    }

    onBufferProcessed(newBuffer, 'fade-in');
    toast.success('Fade in applied');
  }, [buffer, onBufferProcessed]);

  // Apply fade out
  const handleFadeOut = useCallback(() => {
    if (!buffer) return;

    const ctx = audioEngine.getContext();
    const fadeLength = Math.min(buffer.length, Math.floor(buffer.sampleRate * 0.1)); // 100ms fade
    
    const newBuffer = ctx.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const source = buffer.getChannelData(ch);
      const dest = newBuffer.getChannelData(ch);
      
      for (let i = 0; i < buffer.length; i++) {
        let gain = 1;
        const fromEnd = buffer.length - 1 - i;
        if (fromEnd < fadeLength) {
          gain = fromEnd / fadeLength;
        }
        dest[i] = source[i] * gain;
      }
    }

    onBufferProcessed(newBuffer, 'fade-out');
    toast.success('Fade out applied');
  }, [buffer, onBufferProcessed]);

  // Resample to target sample rate
  const handleResample = useCallback(async () => {
    if (!buffer) return;
    
    const ratio = buffer.sampleRate / targetSampleRate;
    const newLength = Math.round(buffer.length * ratio);
    
    const offlineCtx = new OfflineAudioContext(
      buffer.numberOfChannels,
      newLength,
      targetSampleRate
    );
    
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineCtx.destination);
    source.start(0);
    
    try {
      const renderedBuffer = await offlineCtx.startRendering();
      onBufferProcessed(renderedBuffer, `resampled-${targetSampleRate}hz`);
      toast.success(`Resampled to ${targetSampleRate} Hz`);
    } catch (err) {
      toast.error('Resample failed');
    }
  }, [buffer, targetSampleRate, onBufferProcessed]);

  const isDisabled = !buffer;

  return (
    <div className="space-y-4 p-4 bg-card rounded-lg border border-border">
      <h3 className="text-sm font-medium">Processing Tools</h3>
      
      {buffer && (
        <p className="text-xs text-muted-foreground">
          Current: {buffer.sampleRate} Hz
        </p>
      )}
      
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleNormalize}
          disabled={isDisabled}
          className="gap-1"
        >
          <Maximize className="w-3 h-3" />
          Normalize
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleTrim}
          disabled={isDisabled}
          className="gap-1"
        >
          <Scissors className="w-3 h-3" />
          Trim Silence
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleReverse}
          disabled={isDisabled}
          className="gap-1"
        >
          <RotateCcw className="w-3 h-3" />
          Reverse
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleFadeIn}
          disabled={isDisabled}
          className="gap-1"
        >
          <ArrowRightFromLine className="w-3 h-3" />
          Fade In
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleFadeOut}
          disabled={isDisabled}
          className="gap-1"
        >
          <ArrowLeftFromLine className="w-3 h-3" />
          Fade Out
        </Button>
      </div>
      
      <div className="flex gap-2">
        <Select value={String(targetSampleRate)} onValueChange={(v) => setTargetSampleRate(Number(v))}>
          <SelectTrigger className="flex-1 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SAMPLE_RATES.map((sr) => (
              <SelectItem key={sr.value} value={String(sr.value)}>
                {sr.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={handleResample}
          disabled={isDisabled}
          className="gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          Resample
        </Button>
      </div>
    </div>
  );
};
