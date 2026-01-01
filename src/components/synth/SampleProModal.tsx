import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SampleParams } from '@/audio/SampleEngine';
import { GranularParams } from '@/audio/GranularEngine';
import { WaveformEditor } from './sample-pro/WaveformEditor';
import { TransientDetector } from './sample-pro/TransientDetector';
import { GranularControls } from './sample-pro/GranularControls';
import { RecordingPanel } from './sample-pro/RecordingPanel';
import { ProcessingTools } from './sample-pro/ProcessingTools';
import { AudioWaveform, Zap, Waves, Mic, Wrench } from 'lucide-react';

interface SampleProModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buffer: AudioBuffer | null;
  sampleName: string;
  params: SampleParams;
  onLoadSample: (buffer: AudioBuffer, name: string) => void;
  onParamsChange: (params: SampleParams) => void;
}

export const SampleProModal = ({
  open,
  onOpenChange,
  buffer,
  sampleName,
  params,
  onLoadSample,
  onParamsChange,
}: SampleProModalProps) => {
  const [sliceMarkers, setSliceMarkers] = useState<number[]>([]);
  const [transientPositions, setTransientPositions] = useState<number[]>([]);
  const [showTransients, setShowTransients] = useState(false);
  const [granularEnabled, setGranularEnabled] = useState(false);
  const [granularParams, setGranularParams] = useState<GranularParams>({
    grainSize: 100,
    grainDensity: 10,
    pitchScatter: 0,
    positionScatter: 0,
    timeStretch: 1.0,
    pitchShift: 0,
    windowType: 'hann',
  });

  // Generate initial slice markers from params
  useState(() => {
    if (params.playbackMode === 'slice') {
      const markers: number[] = [];
      for (let i = 0; i < params.sliceCount; i++) {
        markers.push(i / params.sliceCount);
      }
      setSliceMarkers(markers);
    }
  });

  const handleTransientsDetected = useCallback((positions: number[]) => {
    setTransientPositions(positions);
    setShowTransients(true);
  }, []);

  const handleApplySlices = useCallback((markers: number[]) => {
    setSliceMarkers(markers);
    // Update the slice count in params
    onParamsChange({ ...params, sliceCount: markers.length, playbackMode: 'slice' });
  }, [params, onParamsChange]);

  const handleBufferProcessed = useCallback((newBuffer: AudioBuffer, suffix: string) => {
    const newName = sampleName.replace(/\.[^.]+$/, '') + `-${suffix}.wav`;
    onLoadSample(newBuffer, newName);
  }, [sampleName, onLoadSample]);

  const handleRecordingComplete = useCallback((recordedBuffer: AudioBuffer) => {
    onLoadSample(recordedBuffer, `recording-${Date.now()}.wav`);
  }, [onLoadSample]);

  const handlePositionClick = useCallback((position: number) => {
    // Preview at this position
    console.log('Preview at position:', position);
  }, []);

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
              sliceMarkers={sliceMarkers}
              transientPositions={transientPositions}
              showTransients={showTransients}
              onSliceMarkersChange={setSliceMarkers}
              onPositionClick={handlePositionClick}
            />
            <div className="text-xs text-muted-foreground">
              Drag markers to adjust slice points. Click to preview position.
              Use zoom controls to inspect waveform details.
            </div>
          </TabsContent>

          <TabsContent value="transients" className="space-y-4 mt-4">
            <WaveformEditor
              buffer={buffer}
              sliceMarkers={sliceMarkers}
              transientPositions={transientPositions}
              showTransients={showTransients}
              onSliceMarkersChange={setSliceMarkers}
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
              onParamsChange={(p) => setGranularParams({ ...granularParams, ...p })}
              onEnabledChange={setGranularEnabled}
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
