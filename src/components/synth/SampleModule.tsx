import { useRef, useEffect, useCallback, useState } from "react";
import { Music, Upload, X, Play, Square } from "lucide-react";
import { ModuleCard } from "./ModuleCard";
import { Knob } from "./Knob";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SampleParams, PlaybackMode } from "@/audio/SampleEngine";
import { decodeAudioFile, validateAudioFile } from "@/utils/audioDecoder";
import { toast } from "sonner";
import { StepSequencer } from "./StepSequencer";
import { EuclideanControls } from "./EuclideanControls";
import { SampleStep, SamplePLocks } from "@/hooks/useSampleState";
import type { PLocks } from "@/hooks/useAudioEngine";

interface SampleModuleProps {
  buffer: AudioBuffer | null;
  sampleName: string;
  muted: boolean;
  params: SampleParams;
  isPlaying: boolean;
  activeSlice: number | null;
  sliceProgress: number; // 0-1 progress within active slice
  // Sequencer props
  steps: SampleStep[];
  currentStep: number;
  patternLength: number;
  onLoadSample: (buffer: AudioBuffer, name: string) => void;
  onClearSample: () => void;
  onParamsChange: (params: SampleParams) => void;
  onMuteToggle: () => void;
  onPlayToggle: () => void;
  onStepToggle: (index: number) => void;
  onStepVelocity: (index: number, velocity: number) => void;
  onStepSliceChange: (index: number, sliceIndex: number) => void;
  onStepPLocks: (index: number, pLocks: SamplePLocks | undefined) => void;
  onPatternGenerate: (steps: SampleStep[]) => void;
  onPatternLengthChange: (length: number) => void;
  onPreviewSlice: (sliceIndex: number) => void;
}

export const SampleModule = ({
  buffer,
  sampleName,
  muted,
  params,
  isPlaying,
  activeSlice,
  sliceProgress,
  steps,
  currentStep,
  patternLength,
  onLoadSample,
  onClearSample,
  onParamsChange,
  onMuteToggle,
  onPlayToggle,
  onStepToggle,
  onStepVelocity,
  onStepSliceChange,
  onStepPLocks,
  onPatternGenerate,
  onPatternLengthChange,
  onPreviewSlice,
}: SampleModuleProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewingSlice, setPreviewingSlice] = useState<number | null>(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });

  // Observe container size changes - observe parent for reliable dimensions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const container = canvas.parentElement;
    if (!container) return;

    const measureContainer = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setCanvasDimensions({ width: rect.width, height: rect.height });
      }
    };

    // Initial measurement after browser paint
    requestAnimationFrame(() => {
      measureContainer();
    });

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setCanvasDimensions({ width, height });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [buffer]);

  // Handle click on waveform to preview slice
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!buffer || params.playbackMode !== 'slice') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const relativeX = x / rect.width;
    const sliceIndex = Math.floor(relativeX * params.sliceCount);
    
    // Trigger preview
    onPreviewSlice(sliceIndex);
    
    // Visual feedback
    setPreviewingSlice(sliceIndex);
    setTimeout(() => setPreviewingSlice(null), 200);
  }, [buffer, params.playbackMode, params.sliceCount, onPreviewSlice]);

  // Draw waveform with slice visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Guard: don't draw if dimensions aren't ready
    if (canvasDimensions.width === 0 || canvasDimensions.height === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions for retina displays
    canvas.width = canvasDimensions.width * 2;
    canvas.height = canvasDimensions.height * 2;

    const { width, height } = canvas;
    ctx.fillStyle = "rgba(30, 35, 45, 0.5)";
    ctx.fillRect(0, 0, width, height);

    if (!buffer) {
      // No sample loaded - show placeholder
      ctx.fillStyle = "rgba(120, 130, 150, 0.6)";
      ctx.font = "24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Drop WAV here", width / 2, height / 2 + 8);
      return;
    }

    // Draw waveform
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.strokeStyle = "hsl(180, 100%, 50%)";
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

    // Draw based on playback mode
    if (params.playbackMode === "slice") {
      // Draw slice dividers
      const sliceWidth = width / params.sliceCount;
      
      // Highlight active slice (playing) with stronger highlight
      if (activeSlice !== null && activeSlice >= 0 && activeSlice < params.sliceCount) {
        ctx.fillStyle = "rgba(34, 197, 94, 0.4)";
        ctx.fillRect(activeSlice * sliceWidth, 0, sliceWidth, height);
        
        // Draw glow border for active slice
        ctx.strokeStyle = "hsl(142, 76%, 45%)";
        ctx.lineWidth = 3;
        ctx.strokeRect(activeSlice * sliceWidth + 1, 1, sliceWidth - 2, height - 2);
        
        // Draw progress bar inside active slice
        if (sliceProgress > 0) {
          const sliceX = activeSlice * sliceWidth;
          const progressWidth = sliceWidth * sliceProgress;
          
          // Progress fill (semi-transparent green)
          ctx.fillStyle = "rgba(34, 197, 94, 0.6)";
          ctx.fillRect(sliceX, height - 12, progressWidth, 10);
          
          // Playhead line (white vertical line at progress position)
          ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sliceX + progressWidth, 0);
          ctx.lineTo(sliceX + progressWidth, height);
          ctx.stroke();
        }
      }
      
      // Highlight previewing slice (click preview)
      if (previewingSlice !== null && previewingSlice !== activeSlice) {
        ctx.fillStyle = "rgba(0, 255, 255, 0.3)";
        ctx.fillRect(previewingSlice * sliceWidth, 0, sliceWidth, height);
      }
      
      ctx.strokeStyle = "rgba(251, 191, 36, 0.6)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      for (let i = 1; i < params.sliceCount; i++) {
        const x = i * sliceWidth;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      ctx.setLineDash([]);

      // Draw slice numbers
      ctx.fillStyle = "rgba(251, 191, 36, 0.8)";
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      for (let i = 0; i < params.sliceCount; i++) {
        const x = (i + 0.5) * sliceWidth;
        // Highlight number if active
        if (i === activeSlice) {
          ctx.fillStyle = "hsl(142, 76%, 45%)";
          ctx.font = "bold 18px sans-serif";
        } else {
          ctx.fillStyle = "rgba(251, 191, 36, 0.8)";
          ctx.font = "16px sans-serif";
        }
        ctx.fillText(String(i + 1), x, 18);
      }
    } else if (params.playbackMode === "region") {
      // Draw start point marker
      const startX = params.startPoint * width;
      ctx.strokeStyle = "hsl(0, 85%, 55%)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX, height);
      ctx.stroke();

      // Draw loop end marker
      const endX = (params.startPoint + params.loopLength) * width;
      ctx.strokeStyle = "hsl(142, 76%, 45%)";
      ctx.beginPath();
      ctx.moveTo(Math.min(endX, width), 0);
      ctx.lineTo(Math.min(endX, width), height);
      ctx.stroke();

      // Shade active region
      ctx.fillStyle = "rgba(0, 255, 255, 0.1)";
      ctx.fillRect(startX, 0, Math.min(endX, width) - startX, height);
    }
    // Full mode: no markers needed, entire waveform is active
  }, [buffer, params.startPoint, params.loopLength, params.playbackMode, params.sliceCount, previewingSlice, activeSlice, sliceProgress, canvasDimensions]);

  const handleFileSelect = useCallback(
    async (file: File) => {
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
        toast.error("Failed to decode audio file");
        console.error(error);
      }
    },
    [onLoadSample],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
      e.target.value = "";
    },
    [handleFileSelect],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const updateParam = <K extends keyof SampleParams>(key: K, value: SampleParams[K]) => {
    onParamsChange({ ...params, [key]: value });
  };

  // Adapt steps to Step interface expected by StepSequencer
  const adaptedSteps = steps.map((s) => ({
    active: s.active,
    velocity: s.velocity,
    probability: s.probability,
    sliceIndex: s.sliceIndex,
    pLocks: s.pLocks as PLocks | undefined,
  }));

  // Handle P-Locks change from StepSequencer
  const handleStepPLocks = useCallback((index: number, pLocks: PLocks | undefined) => {
    onStepPLocks(index, pLocks as SamplePLocks | undefined);
  }, [onStepPLocks]);

  return (
    <ModuleCard title="Sample" icon={<Music className="w-4 h-4" />} muted={muted} onMuteToggle={onMuteToggle}>
      <div className="space-y-4">
        {/* Load button and sample name */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="flex-1">
            <Upload className="w-3 h-3 mr-1" />
            {buffer ? "Replace" : "Load WAV"}
          </Button>
          {buffer && (
            <>
              <Button variant={isPlaying ? "default" : "outline"} size="sm" onClick={onPlayToggle}>
                {isPlaying ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={onClearSample}>
                <X className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>

        {sampleName && <div className="text-xs text-muted-foreground truncate">{sampleName}</div>}

        {/* Waveform display */}
        <div 
          className={cn(
            "waveform-container h-20",
            buffer && params.playbackMode === 'slice' ? 'cursor-pointer' : 'cursor-default'
          )}
          onDrop={handleDrop} 
          onDragOver={handleDragOver}
        >
          <canvas 
            ref={canvasRef} 
            className="w-full h-full" 
            onClick={handleCanvasClick}
          />
        </div>

        {/* Playback Mode Selector */}
        {buffer && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Mode:</span>
            <div className="flex gap-1 flex-1">
              {(["full", "region", "slice"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => updateParam("playbackMode", mode)}
                  className={cn(
                    "flex-1 py-1 text-xs uppercase tracking-wider rounded border transition-colors",
                    params.playbackMode === mode
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground",
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Slice Count Selector - only in slice mode */}
        {buffer && params.playbackMode === "slice" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Slices:</span>
            <div className="flex gap-1 flex-1">
              {[4, 8, 16, 32].map((count) => (
                <button
                  key={count}
                  onClick={() => updateParam("sliceCount", count)}
                  className={cn(
                    "flex-1 py-1 text-xs rounded border transition-colors",
                    params.sliceCount === count
                      ? "border-chart-4 bg-chart-4/20 text-chart-4"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground",
                  )}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sync Mode Selector - gate with drums */}
        {buffer && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Gate:</span>
            <div className="flex gap-1 flex-1">
              {([
                { value: 'independent', label: 'Free' },
                { value: 'gate-kick', label: 'Kick' },
                { value: 'gate-snare', label: 'Snare' },
                { value: 'gate-hat', label: 'Hat' },
              ] as const).map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => updateParam("syncMode", mode.value)}
                  className={cn(
                    "flex-1 py-1 text-xs rounded border transition-colors",
                    params.syncMode === mode.value
                      ? "border-chart-5 bg-chart-5/20 text-chart-5"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground",
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step Sequencer - shown when sample is loaded */}
        {buffer && (
          <div className="space-y-2 pt-1 border-t border-border/50">
            <EuclideanControls
              onPatternGenerate={onPatternGenerate}
              currentSteps={adaptedSteps}
              patternLength={patternLength}
              variant="secondary"
            />
            <StepSequencer
              steps={adaptedSteps}
              currentStep={currentStep}
              onStepToggle={onStepToggle}
              onStepVelocity={onStepVelocity}
              onStepPLocks={handleStepPLocks}
              onStepSliceChange={onStepSliceChange}
              patternLength={patternLength}
              onLengthChange={onPatternLengthChange}
              showControls={false}
              showLengthSelector={true}
              showPLocks={true}
              showReverse={true}
              showRatchet={true}
              showSliceSelector={params.playbackMode === 'slice'}
              sliceCount={params.sliceCount}
            />
          </div>
        )}

        {/* Parameters - show Start/Length only in region mode */}
        <div className={cn("grid gap-3 pt-2", params.playbackMode === "region" ? "grid-cols-4" : "grid-cols-2")}>
          <Knob
            value={((params.pitch - 0.5) / 1.5) * 100}
            onChange={(v) => updateParam("pitch", 0.5 + (v / 100) * 1.5)}
            label="Pitch"
            size="sm"
          />
          {params.playbackMode === "region" && (
            <>
              <Knob
                value={params.startPoint * 100}
                onChange={(v) => updateParam("startPoint", v / 100)}
                label="Start"
                size="sm"
              />
              <Knob
                value={params.loopLength * 100}
                onChange={(v) => updateParam("loopLength", Math.max(0.01, v / 100))}
                label="Length"
                size="sm"
              />
            </>
          )}
          <Knob value={params.volume * 100} onChange={(v) => updateParam("volume", v / 100)} label="Vol" size="sm" />
        </div>

        {/* Toggles */}
        <div className="flex gap-2">
          <button
            onClick={() => updateParam("loop", !params.loop)}
            className={cn(
              "flex-1 py-1.5 text-xs uppercase tracking-wider rounded border transition-colors",
              params.loop
                ? "border-primary bg-primary/20 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            Loop
          </button>
          <button
            onClick={() => updateParam("reverse", !params.reverse)}
            className={cn(
              "flex-1 py-1.5 text-xs uppercase tracking-wider rounded border transition-colors",
              params.reverse
                ? "border-primary bg-primary/20 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
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
