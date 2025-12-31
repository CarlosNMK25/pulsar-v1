import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ScopeTabProps {
  analyserData?: Uint8Array;
}

export const ScopeTab = ({ analyserData }: ScopeTabProps) => {
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const waveformCanvas = waveformCanvasRef.current;
    const spectrumCanvas = spectrumCanvasRef.current;
    if (!waveformCanvas || !spectrumCanvas) return;

    const wCtx = waveformCanvas.getContext('2d');
    const sCtx = spectrumCanvas.getContext('2d');
    if (!wCtx || !sCtx) return;

    const wWidth = waveformCanvas.width;
    const wHeight = waveformCanvas.height;
    const sWidth = spectrumCanvas.width;
    const sHeight = spectrumCanvas.height;

    // Clear canvases
    wCtx.fillStyle = 'hsl(220, 20%, 4%)';
    wCtx.fillRect(0, 0, wWidth, wHeight);
    sCtx.fillStyle = 'hsl(220, 20%, 4%)';
    sCtx.fillRect(0, 0, sWidth, sHeight);

    // Draw waveform
    wCtx.strokeStyle = 'hsl(180, 100%, 50%)';
    wCtx.lineWidth = 1.5;
    wCtx.beginPath();
    
    if (!analyserData || analyserData.length === 0) {
      wCtx.moveTo(0, wHeight / 2);
      wCtx.lineTo(wWidth, wHeight / 2);
    } else {
      const sliceWidth = wWidth / analyserData.length;
      let x = 0;
      for (let i = 0; i < analyserData.length; i++) {
        const v = analyserData[i] / 128.0;
        const y = (v * wHeight) / 2;
        if (i === 0) {
          wCtx.moveTo(x, y);
        } else {
          wCtx.lineTo(x, y);
        }
        x += sliceWidth;
      }
    }
    wCtx.stroke();

    // Draw simple spectrum visualization from waveform data
    if (analyserData && analyserData.length > 0) {
      const barCount = 32;
      const samplesPerBar = Math.floor(analyserData.length / barCount);
      for (let i = 0; i < barCount; i++) {
        let sum = 0;
        for (let j = 0; j < samplesPerBar; j++) {
          sum += Math.abs(analyserData[i * samplesPerBar + j] - 128);
        }
        const barHeight = (sum / samplesPerBar / 128) * sHeight;
        const hue = 180 + (i / barCount) * 20;
        sCtx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        sCtx.fillRect(i * (sWidth / barCount), sHeight - barHeight, (sWidth / barCount) - 1, barHeight);
      }
    }
  }, [analyserData]);

  return (
    <div className="flex items-center justify-center h-full gap-4 px-4">
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] text-muted-foreground uppercase">Waveform</span>
        <canvas
          ref={waveformCanvasRef}
          width={200}
          height={80}
          className="rounded border border-border bg-surface-sunken"
        />
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] text-muted-foreground uppercase">Spectrum</span>
        <canvas
          ref={spectrumCanvasRef}
          width={200}
          height={80}
          className="rounded border border-border bg-surface-sunken"
        />
      </div>
    </div>
  );
};
