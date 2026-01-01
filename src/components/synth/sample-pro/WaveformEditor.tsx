import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, SkipBack, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WaveformEditorProps {
  buffer: AudioBuffer | null;
  sliceMarkers: number[];
  transientPositions?: number[];
  onSliceMarkersChange: (markers: number[]) => void;
  onPositionClick?: (position: number) => void;
  showTransients?: boolean;
}

export const WaveformEditor = ({
  buffer,
  sliceMarkers,
  transientPositions = [],
  onSliceMarkersChange,
  onPositionClick,
  showTransients = false,
}: WaveformEditorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMarkerIndex, setDragMarkerIndex] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Observe container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions for retina
    canvas.width = dimensions.width * 2;
    canvas.height = dimensions.height * 2;
    ctx.scale(2, 2);

    const { width, height } = dimensions;

    // Background
    ctx.fillStyle = 'hsl(222, 20%, 12%)';
    ctx.fillRect(0, 0, width, height);

    if (!buffer) {
      ctx.fillStyle = 'hsl(215, 15%, 40%)';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No sample loaded', width / 2, height / 2);
      return;
    }

    const data = buffer.getChannelData(0);
    const visibleDuration = 1 / zoom;
    const startSample = Math.floor(scrollOffset * data.length);
    const endSample = Math.floor((scrollOffset + visibleDuration) * data.length);
    const samplesPerPixel = (endSample - startSample) / width;

    // Draw waveform
    ctx.strokeStyle = 'hsl(180, 100%, 45%)';
    ctx.lineWidth = 1;
    ctx.beginPath();

    const amp = height / 2;
    for (let x = 0; x < width; x++) {
      const sampleIndex = Math.floor(startSample + x * samplesPerPixel);
      const value = data[Math.min(sampleIndex, data.length - 1)] || 0;
      const y = amp + value * amp * 0.9;

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw transients
    if (showTransients && transientPositions.length > 0) {
      ctx.strokeStyle = 'hsl(45, 100%, 50%)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      for (const pos of transientPositions) {
        if (pos >= scrollOffset && pos <= scrollOffset + visibleDuration) {
          const x = ((pos - scrollOffset) / visibleDuration) * width;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
    }

    // Draw slice markers
    ctx.strokeStyle = 'hsl(142, 76%, 50%)';
    ctx.lineWidth = 2;

    for (let i = 0; i < sliceMarkers.length; i++) {
      const pos = sliceMarkers[i];
      if (pos >= scrollOffset && pos <= scrollOffset + visibleDuration) {
        const x = ((pos - scrollOffset) / visibleDuration) * width;
        
        // Draw marker line
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Draw handle
        ctx.fillStyle = 'hsl(142, 76%, 50%)';
        ctx.beginPath();
        ctx.arc(x, 12, 6, 0, Math.PI * 2);
        ctx.fill();

        // Draw slice number
        ctx.fillStyle = 'hsl(0, 0%, 100%)';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), x, 16);
      }
    }

    // Draw center line
    ctx.strokeStyle = 'hsl(215, 15%, 30%)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

  }, [buffer, zoom, scrollOffset, sliceMarkers, transientPositions, showTransients, dimensions]);

  // Handle mouse events for dragging markers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!buffer) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const visibleDuration = 1 / zoom;
    const clickPosition = scrollOffset + (x / rect.width) * visibleDuration;

    // Check if clicking near a marker
    const markerThreshold = 0.01 / zoom;
    for (let i = 0; i < sliceMarkers.length; i++) {
      if (Math.abs(sliceMarkers[i] - clickPosition) < markerThreshold) {
        setIsDragging(true);
        setDragMarkerIndex(i);
        return;
      }
    }

    // Not near a marker, trigger position click
    onPositionClick?.(clickPosition);
  }, [buffer, zoom, scrollOffset, sliceMarkers, onPositionClick]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || dragMarkerIndex === null || !buffer) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const visibleDuration = 1 / zoom;
    const newPosition = Math.max(0, Math.min(1, scrollOffset + (x / rect.width) * visibleDuration));

    const newMarkers = [...sliceMarkers];
    newMarkers[dragMarkerIndex] = newPosition;
    newMarkers.sort((a, b) => a - b);
    onSliceMarkersChange(newMarkers);
  }, [isDragging, dragMarkerIndex, buffer, zoom, scrollOffset, sliceMarkers, onSliceMarkersChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragMarkerIndex(null);
  }, []);

  const handleZoomIn = () => setZoom((z) => Math.min(32, z * 2));
  const handleZoomOut = () => {
    setZoom((z) => Math.max(1, z / 2));
    setScrollOffset(0);
  };
  const handleScrollLeft = () => setScrollOffset((s) => Math.max(0, s - 0.1 / zoom));
  const handleScrollRight = () => setScrollOffset((s) => Math.min(1 - 1 / zoom, s + 0.1 / zoom));

  return (
    <div className="space-y-2">
      {/* Zoom and scroll controls */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={zoom <= 1}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground min-w-[40px] text-center">{zoom}x</span>
        <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={zoom >= 32}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        
        <div className="flex-1" />
        
        {zoom > 1 && (
          <>
            <Button variant="outline" size="sm" onClick={handleScrollLeft} disabled={scrollOffset <= 0}>
              <SkipBack className="w-4 h-4" />
            </Button>
            <Slider
              value={[scrollOffset * 100]}
              onValueChange={([v]) => setScrollOffset(Math.min(1 - 1 / zoom, v / 100))}
              max={Math.max(0, (1 - 1 / zoom) * 100)}
              step={1}
              className="w-32"
            />
            <Button variant="outline" size="sm" onClick={handleScrollRight} disabled={scrollOffset >= 1 - 1 / zoom}>
              <SkipForward className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>

      {/* Waveform canvas */}
      <div
        ref={containerRef}
        className={cn(
          'h-48 rounded-lg border border-border overflow-hidden',
          isDragging ? 'cursor-ew-resize' : 'cursor-crosshair'
        )}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>
    </div>
  );
};
