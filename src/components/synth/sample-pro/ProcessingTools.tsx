import { useCallback, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { audioEngine } from '@/audio/AudioEngine';
import { Maximize, Scissors, RotateCcw, ArrowRightFromLine, ArrowLeftFromLine, RefreshCw, Volume2, VolumeX, Clock, Music, Copy, ClipboardPaste, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { timeStretch, estimateBPMFromDuration } from '@/utils/timeStretch';
import { pitchShift } from '@/utils/pitchShift';

interface ProcessingToolsProps {
  buffer: AudioBuffer | null;
  onBufferProcessed: (buffer: AudioBuffer, name: string) => void;
  selectionStart?: number | null;
  selectionEnd?: number | null;
  clipboard?: Float32Array[] | null;
  clipboardSampleRate?: number;
  onClipboardChange?: (data: Float32Array[] | null, sampleRate: number) => void;
}

const SAMPLE_RATES = [
  { value: 22050, label: '22050 Hz (-1 oct)' },
  { value: 32000, label: '32000 Hz' },
  { value: 44100, label: '44100 Hz' },
  { value: 48000, label: '48000 Hz' },
  { value: 88200, label: '88200 Hz (+1 oct)' },
];

export const ProcessingTools = ({ 
  buffer, 
  onBufferProcessed,
  selectionStart,
  selectionEnd,
  clipboard,
  clipboardSampleRate = 44100,
  onClipboardChange,
}: ProcessingToolsProps) => {
  const [targetSampleRate, setTargetSampleRate] = useState(44100);
  const [stretchRatio, setStretchRatio] = useState(1.0);
  const [pitchSemitones, setPitchSemitones] = useState(0);
  const [pitchCents, setPitchCents] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const hasSelection = selectionStart !== null && selectionEnd !== null;

  // Calculate selection info for display
  const selectionInfo = useMemo(() => {
    if (!buffer || selectionStart === null || selectionEnd === null) return null;
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    const startTime = (start * buffer.length / buffer.sampleRate);
    const endTime = (end * buffer.length / buffer.sampleRate);
    const duration = endTime - startTime;
    return {
      startTime: startTime.toFixed(2),
      endTime: endTime.toFixed(2),
      duration: duration.toFixed(2),
    };
  }, [buffer, selectionStart, selectionEnd]);

  // Estimate BPM from buffer
  const estimatedBPM = useMemo(() => {
    if (!buffer) return null;
    return estimateBPMFromDuration(buffer, 1, 4);
  }, [buffer]);

  // Helper to get selection sample range
  const getSelectionRange = useCallback(() => {
    if (!buffer || selectionStart === null || selectionEnd === null) return null;
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    return {
      startSample: Math.floor(start * buffer.length),
      endSample: Math.floor(end * buffer.length),
    };
  }, [buffer, selectionStart, selectionEnd]);
  
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

  const handleTrim = useCallback(() => {
    if (!buffer) return;

    const ctx = audioEngine.getContext();
    const threshold = 0.01;
    const data = buffer.getChannelData(0);
    
    let startSample = 0;
    let endSample = data.length - 1;

    for (let i = 0; i < data.length; i++) {
      if (Math.abs(data[i]) > threshold) {
        startSample = Math.max(0, i - 100);
        break;
      }
    }

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

  const handleFadeIn = useCallback(() => {
    if (!buffer) return;

    const ctx = audioEngine.getContext();
    const fadeLength = Math.min(buffer.length, Math.floor(buffer.sampleRate * 0.1));
    
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

  const handleFadeOut = useCallback(() => {
    if (!buffer) return;

    const ctx = audioEngine.getContext();
    const fadeLength = Math.min(buffer.length, Math.floor(buffer.sampleRate * 0.1));
    
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

  // Region operations
  const handleReverseRegion = useCallback(() => {
    const range = getSelectionRange();
    if (!buffer || !range) return;

    const { startSample, endSample } = range;
    const ctx = audioEngine.getContext();
    const newBuffer = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const source = buffer.getChannelData(ch);
      const dest = newBuffer.getChannelData(ch);
      dest.set(source);
      
      for (let i = startSample; i < endSample; i++) {
        dest[i] = source[endSample - 1 - (i - startSample)];
      }
    }

    const durationMs = ((endSample - startSample) / buffer.sampleRate * 1000).toFixed(0);
    onBufferProcessed(newBuffer, 'region-reversed');
    toast.success(`Region reversed (${durationMs}ms)`);
  }, [buffer, getSelectionRange, onBufferProcessed]);

  const handleFadeInRegion = useCallback(() => {
    const range = getSelectionRange();
    if (!buffer || !range) return;

    const { startSample, endSample } = range;
    const ctx = audioEngine.getContext();
    const newBuffer = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    const regionLength = endSample - startSample;

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const source = buffer.getChannelData(ch);
      const dest = newBuffer.getChannelData(ch);
      dest.set(source);
      
      for (let i = startSample; i < endSample; i++) {
        const progress = (i - startSample) / regionLength;
        dest[i] = source[i] * progress;
      }
    }

    const durationMs = (regionLength / buffer.sampleRate * 1000).toFixed(0);
    onBufferProcessed(newBuffer, 'region-fade-in');
    toast.success(`Fade in applied (${durationMs}ms)`);
  }, [buffer, getSelectionRange, onBufferProcessed]);

  const handleFadeOutRegion = useCallback(() => {
    const range = getSelectionRange();
    if (!buffer || !range) return;

    const { startSample, endSample } = range;
    const ctx = audioEngine.getContext();
    const newBuffer = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    const regionLength = endSample - startSample;

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const source = buffer.getChannelData(ch);
      const dest = newBuffer.getChannelData(ch);
      dest.set(source);
      
      for (let i = startSample; i < endSample; i++) {
        const progress = 1 - (i - startSample) / regionLength;
        dest[i] = source[i] * progress;
      }
    }

    const durationMs = (regionLength / buffer.sampleRate * 1000).toFixed(0);
    onBufferProcessed(newBuffer, 'region-fade-out');
    toast.success(`Fade out applied (${durationMs}ms)`);
  }, [buffer, getSelectionRange, onBufferProcessed]);

  const handleNormalizeRegion = useCallback(() => {
    const range = getSelectionRange();
    if (!buffer || !range) return;

    const { startSample, endSample } = range;
    const ctx = audioEngine.getContext();
    const newBuffer = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

    let maxPeak = 0;
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = startSample; i < endSample; i++) {
        maxPeak = Math.max(maxPeak, Math.abs(data[i]));
      }
    }

    if (maxPeak === 0) {
      toast.error('Region is silent');
      return;
    }

    const gain = 1.0 / maxPeak;

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const source = buffer.getChannelData(ch);
      const dest = newBuffer.getChannelData(ch);
      dest.set(source);
      
      for (let i = startSample; i < endSample; i++) {
        dest[i] = source[i] * gain;
      }
    }

    const durationMs = ((endSample - startSample) / buffer.sampleRate * 1000).toFixed(0);
    onBufferProcessed(newBuffer, 'region-normalized');
    toast.success(`Region normalized ${gain.toFixed(2)}x (${durationMs}ms)`);
  }, [buffer, getSelectionRange, onBufferProcessed]);

  const handleMuteRegion = useCallback(() => {
    const range = getSelectionRange();
    if (!buffer || !range) return;

    const { startSample, endSample } = range;
    const ctx = audioEngine.getContext();
    const newBuffer = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const source = buffer.getChannelData(ch);
      const dest = newBuffer.getChannelData(ch);
      dest.set(source);
      
      for (let i = startSample; i < endSample; i++) {
        dest[i] = 0;
      }
    }

    const durationMs = ((endSample - startSample) / buffer.sampleRate * 1000).toFixed(0);
    onBufferProcessed(newBuffer, 'region-muted');
    toast.success(`Region muted (${durationMs}ms)`);
  }, [buffer, getSelectionRange, onBufferProcessed]);

  const handleBoostRegion = useCallback(() => {
    const range = getSelectionRange();
    if (!buffer || !range) return;

    const { startSample, endSample } = range;
    const ctx = audioEngine.getContext();
    const newBuffer = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    const boostGain = 2; // +6dB

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const source = buffer.getChannelData(ch);
      const dest = newBuffer.getChannelData(ch);
      dest.set(source);
      
      for (let i = startSample; i < endSample; i++) {
        const boosted = source[i] * boostGain;
        // Soft clip if exceeds 1.0
        dest[i] = Math.abs(boosted) > 1 ? Math.sign(boosted) * (1 - Math.exp(-Math.abs(boosted))) : boosted;
      }
    }

    const durationMs = ((endSample - startSample) / buffer.sampleRate * 1000).toFixed(0);
    onBufferProcessed(newBuffer, 'region-boosted');
    toast.success(`Region boosted +6dB (${durationMs}ms)`);
  }, [buffer, getSelectionRange, onBufferProcessed]);

  // Time Stretch handler
  const handleTimeStretch = useCallback(() => {
    if (!buffer || isProcessing) return;
    
    setIsProcessing(true);
    try {
      const stretched = timeStretch(buffer, stretchRatio);
      const newDuration = (stretched.length / stretched.sampleRate).toFixed(2);
      onBufferProcessed(stretched, `stretched-${stretchRatio.toFixed(2)}x`);
      toast.success(`Time stretched ${stretchRatio.toFixed(2)}x → ${newDuration}s`);
    } catch (err) {
      toast.error('Time stretch failed');
    } finally {
      setIsProcessing(false);
    }
  }, [buffer, stretchRatio, isProcessing, onBufferProcessed]);

  // Pitch Shift handler
  const handlePitchShift = useCallback(async () => {
    if (!buffer || isProcessing) return;
    
    setIsProcessing(true);
    try {
      const shifted = await pitchShift(buffer, pitchSemitones, pitchCents);
      const sign = pitchSemitones >= 0 ? '+' : '';
      onBufferProcessed(shifted, `pitch-${sign}${pitchSemitones}st`);
      toast.success(`Pitch shifted ${sign}${pitchSemitones} semitones`);
    } catch (err) {
      toast.error('Pitch shift failed');
    } finally {
    setIsProcessing(false);
    }
  }, [buffer, pitchSemitones, pitchCents, isProcessing, onBufferProcessed]);

  // Copy region to clipboard
  const handleCopyRegion = useCallback(() => {
    const range = getSelectionRange();
    if (!buffer || !range || !onClipboardChange) return;

    const { startSample, endSample } = range;
    const regionLength = endSample - startSample;
    const channelData: Float32Array[] = [];

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const source = buffer.getChannelData(ch);
      const data = new Float32Array(regionLength);
      for (let i = 0; i < regionLength; i++) {
        data[i] = source[startSample + i];
      }
      channelData.push(data);
    }

    onClipboardChange(channelData, buffer.sampleRate);
    const durationMs = (regionLength / buffer.sampleRate * 1000).toFixed(0);
    toast.success(`Copiado ${durationMs}ms al clipboard`);
  }, [buffer, getSelectionRange, onClipboardChange]);

  // Cut region (copy + mute)
  const handleCutRegion = useCallback(() => {
    const range = getSelectionRange();
    if (!buffer || !range || !onClipboardChange) return;

    const { startSample, endSample } = range;
    const regionLength = endSample - startSample;
    const channelData: Float32Array[] = [];

    // Copy to clipboard first
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const source = buffer.getChannelData(ch);
      const data = new Float32Array(regionLength);
      for (let i = 0; i < regionLength; i++) {
        data[i] = source[startSample + i];
      }
      channelData.push(data);
    }
    onClipboardChange(channelData, buffer.sampleRate);

    // Then mute the region
    const ctx = audioEngine.getContext();
    const newBuffer = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const source = buffer.getChannelData(ch);
      const dest = newBuffer.getChannelData(ch);
      dest.set(source);
      for (let i = startSample; i < endSample; i++) {
        dest[i] = 0;
      }
    }

    const durationMs = (regionLength / buffer.sampleRate * 1000).toFixed(0);
    onBufferProcessed(newBuffer, 'cut');
    toast.success(`Cortado ${durationMs}ms`);
  }, [buffer, getSelectionRange, onClipboardChange, onBufferProcessed]);

  // Paste clipboard at end
  const handlePaste = useCallback(() => {
    if (!buffer || !clipboard || clipboard.length === 0) return;

    const ctx = audioEngine.getContext();
    const clipboardLength = clipboard[0].length;
    const newLength = buffer.length + clipboardLength;
    const newBuffer = ctx.createBuffer(buffer.numberOfChannels, newLength, buffer.sampleRate);

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const source = buffer.getChannelData(ch);
      const dest = newBuffer.getChannelData(ch);
      
      // Copy original buffer
      dest.set(source);
      
      // Append clipboard (use channel 0 if clipboard has fewer channels)
      const clipCh = Math.min(ch, clipboard.length - 1);
      for (let i = 0; i < clipboardLength; i++) {
        dest[buffer.length + i] = clipboard[clipCh][i];
      }
    }

    const durationMs = (clipboardLength / clipboardSampleRate * 1000).toFixed(0);
    onBufferProcessed(newBuffer, 'pasted');
    toast.success(`Pegado ${durationMs}ms al final`);
  }, [buffer, clipboard, clipboardSampleRate, onBufferProcessed]);

  // Clear clipboard
  const handleClearClipboard = useCallback(() => {
    if (onClipboardChange) {
      onClipboardChange(null, 44100);
      toast.success('Clipboard limpiado');
    }
  }, [onClipboardChange]);

  const isDisabled = !buffer || isProcessing;
  const hasClipboard = clipboard && clipboard.length > 0 && clipboard[0].length > 0;
  const clipboardDuration = hasClipboard ? (clipboard[0].length / clipboardSampleRate).toFixed(2) : '0';

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
      
      {/* Time Stretch */}
      <div className="pt-2 border-t border-border space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Time Stretch
          </span>
          <span className="text-xs text-muted-foreground">
            {stretchRatio.toFixed(2)}x
          </span>
        </div>
        <Slider
          value={[stretchRatio]}
          onValueChange={([v]) => setStretchRatio(v)}
          min={0.5}
          max={2}
          step={0.05}
          disabled={isDisabled}
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTimeStretch}
            disabled={isDisabled}
            className="flex-1 gap-1"
          >
            Apply Stretch
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStretchRatio(1)}
            disabled={isDisabled}
          >
            Reset
          </Button>
        </div>
        {estimatedBPM && (
          <p className="text-xs text-muted-foreground">
            Est. BPM: {estimatedBPM} → {(estimatedBPM / stretchRatio).toFixed(1)}
          </p>
        )}
      </div>

      {/* Pitch Shift */}
      <div className="pt-2 border-t border-border space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium flex items-center gap-1">
            <Music className="w-3 h-3" />
            Pitch Shift
          </span>
          <span className="text-xs text-muted-foreground">
            {pitchSemitones >= 0 ? '+' : ''}{pitchSemitones} st, {pitchCents >= 0 ? '+' : ''}{pitchCents} ct
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-8">Semi</span>
            <Slider
              value={[pitchSemitones]}
              onValueChange={([v]) => setPitchSemitones(v)}
              min={-12}
              max={12}
              step={1}
              disabled={isDisabled}
              className="flex-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-8">Cents</span>
            <Slider
              value={[pitchCents]}
              onValueChange={([v]) => setPitchCents(v)}
              min={-100}
              max={100}
              step={5}
              disabled={isDisabled}
              className="flex-1"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePitchShift}
            disabled={isDisabled}
            className="flex-1 gap-1"
          >
            Apply Pitch
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setPitchSemitones(0); setPitchCents(0); }}
            disabled={isDisabled}
          >
            Reset
          </Button>
        </div>
      </div>
      
      {/* Region-based operations */}
      {hasSelection && selectionInfo && (
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-primary">
              Región seleccionada
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              {selectionInfo.startTime}s - {selectionInfo.endTime}s ({selectionInfo.duration}s)
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleFadeInRegion}
              className="gap-1"
            >
              <ArrowRightFromLine className="w-3 h-3" />
              Fade In
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleFadeOutRegion}
              className="gap-1"
            >
              <ArrowLeftFromLine className="w-3 h-3" />
              Fade Out
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNormalizeRegion}
              className="gap-1"
            >
              <Maximize className="w-3 h-3" />
              Normalize
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleMuteRegion}
              className="gap-1"
            >
              <VolumeX className="w-3 h-3" />
              Mute
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBoostRegion}
              className="gap-1"
            >
              <Volume2 className="w-3 h-3" />
              Boost
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReverseRegion}
              className="gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reverse
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyRegion}
              className="gap-1"
            >
              <Copy className="w-3 h-3" />
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCutRegion}
              className="gap-1"
            >
              <Scissors className="w-3 h-3" />
              Cut
            </Button>
          </div>
        </div>
      )}

      {/* Clipboard section */}
      {hasClipboard && (
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-primary">
              Clipboard
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              {clipboardDuration}s copiado
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePaste}
              disabled={isDisabled}
              className="flex-1 gap-1"
            >
              <ClipboardPaste className="w-3 h-3" />
              Paste al final
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearClipboard}
              className="gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
