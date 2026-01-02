import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { SampleParams } from '@/audio/SampleEngine';
import { GranularParams } from '@/audio/GranularEngine';
import { SliceEnvelope } from '@/hooks/useSampleState';
import { WaveformEditor } from './sample-pro/WaveformEditor';
import { TransientDetector } from './sample-pro/TransientDetector';
import { GranularControls } from './sample-pro/GranularControls';
import { RecordingPanel } from './sample-pro/RecordingPanel';
import { ProcessingTools } from './sample-pro/ProcessingTools';
import { EnvelopeEditor } from './sample-pro/EnvelopeEditor';
import { AudioWaveform, Zap, Waves, Mic, Wrench } from 'lucide-react';

interface SampleProModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buffer: AudioBuffer | null;
  sampleName: string;
  params: SampleParams;
  onLoadSample: (buffer: AudioBuffer, name: string) => void;
  onParamsChange: (params: SampleParams) => void;
  // Granular state (global)
  granularEnabled: boolean;
  granularParams: GranularParams;
  onGranularEnabledChange: (enabled: boolean) => void;
  onGranularParamsChange: (params: Partial<GranularParams>) => void;
  // Custom slice markers
  customSliceMarkers: number[] | null;
  onCustomSliceMarkersChange: (markers: number[] | null) => void;
  // Slice envelope
  sliceEnvelope: SliceEnvelope;
  onSliceEnvelopeChange: (envelope: SliceEnvelope) => void;
  // Crossfade
  crossfadeMs: number;
  crossfadeEnabled: boolean;
  onCrossfadeMsChange: (ms: number) => void;
  onCrossfadeEnabledChange: (enabled: boolean) => void;
  // Preview callback
  onPreviewPosition: (position: number) => void;
}

export const SampleProModal = ({
  open,
  onOpenChange,
  buffer,
  sampleName,
  params,
  onLoadSample,
  onParamsChange,
  granularEnabled,
  granularParams,
  onGranularEnabledChange,
  onGranularParamsChange,
  customSliceMarkers,
  onCustomSliceMarkersChange,
  sliceEnvelope,
  onSliceEnvelopeChange,
  crossfadeMs,
  crossfadeEnabled,
  onCrossfadeMsChange,
  onCrossfadeEnabledChange,
  onPreviewPosition,
}: SampleProModalProps) => {
  const [transientPositions, setTransientPositions] = useState<number[]>([]);
  const [showTransients, setShowTransients] = useState(false);
  
  // Local slice markers for editing (synced from global on open)
  const [localSliceMarkers, setLocalSliceMarkers] = useState<number[]>(
    customSliceMarkers || []
  );

  // Generate initial slice markers from params if needed
  useState(() => {
    if (params.playbackMode === 'slice' && !customSliceMarkers) {
      const markers: number[] = [];
      for (let i = 0; i < params.sliceCount; i++) {
        markers.push(i / params.sliceCount);
      }
      setLocalSliceMarkers(markers);
    }
  });

  const handleTransientsDetected = useCallback((positions: number[]) => {
    setTransientPositions(positions);
    setShowTransients(true);
  }, []);

  const handleApplySlices = useCallback((markers: number[]) => {
    setLocalSliceMarkers(markers);
    // Persist to global state
    onCustomSliceMarkersChange(markers);
    // Update the slice count in params
    onParamsChange({ ...params, sliceCount: markers.length, playbackMode: 'slice' });
  }, [params, onParamsChange, onCustomSliceMarkersChange]);

  const handleBufferProcessed = useCallback((newBuffer: AudioBuffer, suffix: string) => {
    const newName = sampleName.replace(/\.[^.]+$/, '') + `-${suffix}.wav`;
    onLoadSample(newBuffer, newName);
  }, [sampleName, onLoadSample]);

  const handleRecordingComplete = useCallback((recordedBuffer: AudioBuffer) => {
    onLoadSample(recordedBuffer, `recording-${Date.now()}.wav`);
  }, [onLoadSample]);

  const handlePositionClick = useCallback((position: number) => {
    // Preview at this position using the real audio engine
    onPreviewPosition(position);
  }, [onPreviewPosition]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AudioWaveform className="w-5 h-5 text-primary" />
            Sample PRO - {sampleName || 'No sample loaded'}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="waveform" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="waveform" className="gap-1.5">
              <AudioWaveform className="w-3.5 h-3.5" />
              Waveform
            </TabsTrigger>
            <TabsTrigger value="transients" className="gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              Transients
            </TabsTrigger>
            <TabsTrigger value="granular" className="gap-1.5">
              <Waves className="w-3.5 h-3.5" />
              Granular
            </TabsTrigger>
            <TabsTrigger value="record" className="gap-1.5">
              <Mic className="w-3.5 h-3.5" />
              Record
            </TabsTrigger>
            <TabsTrigger value="process" className="gap-1.5">
              <Wrench className="w-3.5 h-3.5" />
              Process
            </TabsTrigger>
          </TabsList>

          <TabsContent value="waveform" className="space-y-4 mt-4">
            <WaveformEditor
              buffer={buffer}
              sliceMarkers={localSliceMarkers}
              transientPositions={transientPositions}
              showTransients={showTransients}
              onSliceMarkersChange={(markers) => {
                setLocalSliceMarkers(markers);
                onCustomSliceMarkersChange(markers);
              }}
              onPositionClick={handlePositionClick}
            />
            <EnvelopeEditor
              envelope={sliceEnvelope}
              onChange={onSliceEnvelopeChange}
            />
            
            {/* Crossfade Controls */}
            <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Switch
                  id="crossfade-enabled"
                  checked={crossfadeEnabled}
                  onCheckedChange={onCrossfadeEnabledChange}
                />
                <Label htmlFor="crossfade-enabled" className="text-xs">
                  Crossfade
                </Label>
              </div>
              <div className="flex-1 flex items-center gap-2">
                <Label className="text-xs text-muted-foreground w-16">
                  {crossfadeMs}ms
                </Label>
                <Slider
                  value={[crossfadeMs]}
                  onValueChange={([v]) => onCrossfadeMsChange(v)}
                  min={0}
                  max={50}
                  step={1}
                  disabled={!crossfadeEnabled}
                  className="flex-1"
                />
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground">
              Drag markers to adjust slice points. Click to preview position.
              Enable crossfade for smooth transitions between slices.
            </div>
          </TabsContent>

          <TabsContent value="transients" className="space-y-4 mt-4">
            <WaveformEditor
              buffer={buffer}
              sliceMarkers={localSliceMarkers}
              transientPositions={transientPositions}
              showTransients={showTransients}
              onSliceMarkersChange={(markers) => {
                setLocalSliceMarkers(markers);
                onCustomSliceMarkersChange(markers);
              }}
              onPositionClick={handlePositionClick}
            />
            <TransientDetector
              buffer={buffer}
              onTransientsDetected={handleTransientsDetected}
              onApplyAsSlices={handleApplySlices}
            />
          </TabsContent>

          <TabsContent value="granular" className="space-y-4 mt-4">
            <GranularControls
              params={granularParams}
              enabled={granularEnabled}
              onParamsChange={onGranularParamsChange}
              onEnabledChange={onGranularEnabledChange}
            />
            <div className="text-xs text-muted-foreground">
              Granular synthesis breaks the sample into tiny grains for time-stretching,
              pitch-shifting, and textural effects. Enable to replace standard playback.
            </div>
          </TabsContent>

          <TabsContent value="record" className="space-y-4 mt-4">
            <RecordingPanel onRecordingComplete={handleRecordingComplete} />
          </TabsContent>

          <TabsContent value="process" className="space-y-4 mt-4">
            <ProcessingTools
              buffer={buffer}
              onBufferProcessed={handleBufferProcessed}
            />
            <div className="text-xs text-muted-foreground">
              Apply destructive edits to the sample. Changes are applied immediately
              and can be undone by reloading the original file.
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
