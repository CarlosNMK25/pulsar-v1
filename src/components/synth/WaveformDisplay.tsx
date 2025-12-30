import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface WaveformDisplayProps {
  isPlaying: boolean;
  analyserData: Uint8Array;
  className?: string;
}

export const WaveformDisplay = ({ isPlaying, analyserData, className }: WaveformDisplayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

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

      if (isPlaying && analyserData.length > 0) {
        // Draw frequency bars
        const barWidth = width / analyserData.length;
        
        ctx.beginPath();
        ctx.strokeStyle = 'hsl(180, 100%, 50%)';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'hsl(180, 100%, 50%)';
        ctx.shadowBlur = 10;

        for (let i = 0; i < analyserData.length; i++) {
          const x = i * barWidth;
          const barHeight = (analyserData[i] / 255) * height * 0.8;
          const y = height - barHeight;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        // Mirror effect
        ctx.beginPath();
        ctx.strokeStyle = 'hsl(35, 100%, 55%)';
        ctx.lineWidth = 1;
        ctx.shadowColor = 'hsl(35, 100%, 55%)';
        ctx.shadowBlur = 5;

        for (let i = 0; i < analyserData.length; i++) {
          const x = i * barWidth;
          const barHeight = (analyserData[i] / 255) * height * 0.4;
          const y = barHeight;

          if (i === 0) {
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
  }, [isPlaying, analyserData]);

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
