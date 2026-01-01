import { useRef, useEffect, useCallback, useState } from 'react';
import { SliceEnvelope } from '@/hooks/useSampleState';

interface EnvelopeEditorProps {
  envelope: SliceEnvelope;
  onChange: (envelope: SliceEnvelope) => void;
}

interface DragPoint {
  type: 'attack' | 'decay' | 'sustain' | 'release';
  startX: number;
  startY: number;
  startValue: number;
}

export const EnvelopeEditor = ({ envelope, onChange }: EnvelopeEditorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState<DragPoint | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Observe container size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Draw envelope
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    const { width, height } = dimensions;
    const padding = 20;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    // Background
    ctx.fillStyle = 'rgba(30, 35, 45, 0.8)';
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = 'rgba(100, 110, 130, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding + (graphHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Calculate envelope points
    const maxTime = 1500; // Total time scale in ms
    const attackX = padding + (envelope.attack / maxTime) * graphWidth;
    const decayX = attackX + (envelope.decay / maxTime) * graphWidth;
    const sustainY = padding + (1 - envelope.sustain) * graphHeight;
    const releaseX = Math.min(decayX + (envelope.release / maxTime) * graphWidth, width - padding);

    // Draw envelope path
    ctx.beginPath();
    ctx.strokeStyle = 'hsl(180, 100%, 50%)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'hsl(180, 100%, 50%)';
    ctx.shadowBlur = 8;

    // Start at bottom left
    ctx.moveTo(padding, height - padding);
    
    // Attack: rise to peak
    ctx.lineTo(attackX, padding);
    
    // Decay: fall to sustain level
    ctx.lineTo(decayX, sustainY);
    
    // Sustain: hold level
    ctx.lineTo(releaseX - (envelope.release / maxTime) * graphWidth * 0.5, sustainY);
    
    // Release: fall to zero
    ctx.lineTo(releaseX, height - padding);

    ctx.stroke();
    ctx.shadowBlur = 0;

    // Fill under curve
    ctx.lineTo(padding, height - padding);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 200, 200, 0.15)';
    ctx.fill();

    // Draw control points
    const drawPoint = (x: number, y: number, label: string, active: boolean) => {
      ctx.beginPath();
      ctx.arc(x, y, active ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = active ? 'hsl(45, 100%, 60%)' : 'hsl(180, 100%, 50%)';
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y - 12);
    };

    drawPoint(attackX, padding, 'A', dragging?.type === 'attack');
    drawPoint(decayX, sustainY, 'D', dragging?.type === 'decay');
    drawPoint(decayX + 20, sustainY, 'S', dragging?.type === 'sustain');
    drawPoint(releaseX, height - padding, 'R', dragging?.type === 'release');

    // Labels with values
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`A: ${envelope.attack}ms`, padding, height - 4);
    ctx.fillText(`D: ${envelope.decay}ms`, padding + 60, height - 4);
    ctx.fillText(`S: ${Math.round(envelope.sustain * 100)}%`, padding + 120, height - 4);
    ctx.fillText(`R: ${envelope.release}ms`, padding + 180, height - 4);

  }, [envelope, dimensions, dragging]);

  const getPointAtPosition = useCallback((x: number, y: number): DragPoint['type'] | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const canvasX = x - rect.left;
    const canvasY = y - rect.top;

    const { width, height } = dimensions;
    const padding = 20;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;
    const maxTime = 1500;

    const attackX = padding + (envelope.attack / maxTime) * graphWidth;
    const decayX = attackX + (envelope.decay / maxTime) * graphWidth;
    const sustainY = padding + (1 - envelope.sustain) * graphHeight;
    const releaseX = Math.min(decayX + (envelope.release / maxTime) * graphWidth, width - padding);

    const threshold = 15;

    // Check each point
    if (Math.hypot(canvasX - attackX, canvasY - padding) < threshold) return 'attack';
    if (Math.hypot(canvasX - decayX, canvasY - sustainY) < threshold) return 'decay';
    if (Math.hypot(canvasX - (decayX + 20), canvasY - sustainY) < threshold) return 'sustain';
    if (Math.hypot(canvasX - releaseX, canvasY - (height - padding)) < threshold) return 'release';

    return null;
  }, [dimensions, envelope]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const pointType = getPointAtPosition(e.clientX, e.clientY);
    if (pointType) {
      setDragging({
        type: pointType,
        startX: e.clientX,
        startY: e.clientY,
        startValue: envelope[pointType] as number,
      });
    }
  }, [getPointAtPosition, envelope]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;

    const deltaX = e.clientX - dragging.startX;
    const deltaY = e.clientY - dragging.startY;
    const { width, height } = dimensions;
    const graphWidth = width - 40;
    const graphHeight = height - 40;

    let newValue: number;

    switch (dragging.type) {
      case 'attack':
        newValue = Math.max(0, Math.min(500, dragging.startValue + (deltaX / graphWidth) * 500));
        onChange({ ...envelope, attack: Math.round(newValue) });
        break;
      case 'decay':
        newValue = Math.max(0, Math.min(500, dragging.startValue + (deltaX / graphWidth) * 500));
        onChange({ ...envelope, decay: Math.round(newValue) });
        break;
      case 'sustain':
        newValue = Math.max(0, Math.min(1, dragging.startValue - (deltaY / graphHeight)));
        onChange({ ...envelope, sustain: Math.round(newValue * 100) / 100 });
        break;
      case 'release':
        newValue = Math.max(0, Math.min(1000, dragging.startValue + (deltaX / graphWidth) * 1000));
        onChange({ ...envelope, release: Math.round(newValue) });
        break;
    }
  }, [dragging, dimensions, envelope, onChange]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Slice Envelope (ADSR)</span>
      </div>
      <div 
        className="relative w-full h-32 rounded-md overflow-hidden border border-border/50"
        onMouseLeave={handleMouseUp}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          style={{ display: 'block' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />
      </div>
      <div className="text-xs text-muted-foreground">
        Drag the A, D, S, R points to shape the envelope applied to each slice.
      </div>
    </div>
  );
};
