import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface WaveformDisplayProps {
  isPlaying: boolean;
  className?: string;
}

export const WaveformDisplay = ({ isPlaying, className }: WaveformDisplayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const { width, height } = canvas;
      
      // Clear with fade effect
      ctx.fillStyle = 'rgba(12, 14, 18, 0.15)';
      ctx.fillRect(0, 0, width, height);

      if (isPlaying) {
        phaseRef.current += 0.05;
      }

      // Draw grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      
      for (let i = 0; i < width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }
      
      for (let i = 0; i < height; i += 20) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
      }

      // Center line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      if (isPlaying) {
        // Draw waveform
        ctx.beginPath();
        ctx.strokeStyle = 'hsl(180, 100%, 50%)';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'hsl(180, 100%, 50%)';
        ctx.shadowBlur = 10;

        for (let x = 0; x < width; x++) {
          const y = height / 2 + 
            Math.sin((x * 0.02) + phaseRef.current) * 30 +
            Math.sin((x * 0.05) + phaseRef.current * 1.5) * 15 +
            Math.sin((x * 0.01) + phaseRef.current * 0.5) * 20 +
            (Math.random() - 0.5) * 5;
          
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        // Secondary wave
        ctx.beginPath();
        ctx.strokeStyle = 'hsl(35, 100%, 55%)';
        ctx.lineWidth = 1;
        ctx.shadowColor = 'hsl(35, 100%, 55%)';
        ctx.shadowBlur = 8;

        for (let x = 0; x < width; x++) {
          const y = height / 2 + 
            Math.sin((x * 0.03) + phaseRef.current * 0.7) * 20 +
            Math.cos((x * 0.02) + phaseRef.current) * 10;
          
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        ctx.shadowBlur = 0;
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        canvas.width = entry.contentRect.width;
        canvas.height = entry.contentRect.height;
      }
    });

    resizeObserver.observe(canvas.parentElement!);
    
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div className={cn('waveform-container w-full h-24', className)}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
    </div>
  );
};
