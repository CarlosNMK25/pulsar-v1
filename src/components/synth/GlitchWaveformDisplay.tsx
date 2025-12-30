import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { glitchEngine } from '@/audio/GlitchEngine';

interface GlitchWaveformDisplayProps {
  isPlaying: boolean;
  analyserData: Uint8Array;
  className?: string;
}

type ActiveGlitchEffect = 'stutter' | 'bitcrush' | 'tapestop' | 'freeze' | 'reverse' | 'chaos' | null;

export const GlitchWaveformDisplay = ({ 
  isPlaying, 
  analyserData, 
  className 
}: GlitchWaveformDisplayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [activeEffect, setActiveEffect] = useState<ActiveGlitchEffect>(null);
  const glitchIntensityRef = useRef(0);
  const scanlineOffsetRef = useRef(0);
  const noiseRef = useRef<Float32Array>(new Float32Array(256));
  
  // Track glitch activity by monitoring audio changes
  const prevDataRef = useRef<Uint8Array>(new Uint8Array(128));
  const glitchDetectionRef = useRef(0);

  // Generate noise pattern
  const generateNoise = useCallback(() => {
    for (let i = 0; i < noiseRef.current.length; i++) {
      noiseRef.current[i] = Math.random();
    }
  }, []);

  // Detect glitch effects by analyzing audio characteristics
  useEffect(() => {
    if (!isPlaying) {
      setActiveEffect(null);
      return;
    }

    const checkGlitchState = () => {
      const isBypassed = glitchEngine.isBypassed();
      const isChaos = glitchEngine.isChaosEnabled();
      
      if (isBypassed) {
        setActiveEffect(null);
        glitchIntensityRef.current = Math.max(0, glitchIntensityRef.current - 0.05);
      } else if (isChaos) {
        setActiveEffect('chaos');
        glitchIntensityRef.current = Math.min(1, glitchIntensityRef.current + 0.1);
      } else {
        // Detect effect by audio signal changes
        let totalChange = 0;
        for (let i = 0; i < Math.min(analyserData.length, prevDataRef.current.length); i++) {
          totalChange += Math.abs(analyserData[i] - prevDataRef.current[i]);
        }
        
        const avgChange = totalChange / analyserData.length;
        
        // High change indicates glitch activity
        if (avgChange > 20) {
          glitchDetectionRef.current = Math.min(glitchDetectionRef.current + 0.3, 1);
          glitchIntensityRef.current = Math.min(1, glitchIntensityRef.current + 0.15);
        } else {
          glitchDetectionRef.current = Math.max(0, glitchDetectionRef.current - 0.05);
          glitchIntensityRef.current = Math.max(0, glitchIntensityRef.current - 0.03);
        }
        
        // Store previous data
        prevDataRef.current = new Uint8Array(analyserData);
      }
    };

    const interval = setInterval(checkGlitchState, 50);
    return () => clearInterval(interval);
  }, [isPlaying, analyserData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameCount = 0;

    const draw = () => {
      frameCount++;
      const { width, height } = canvas;
      const intensity = glitchIntensityRef.current;
      const isChaos = activeEffect === 'chaos';
      
      // Regenerate noise occasionally
      if (frameCount % 3 === 0) {
        generateNoise();
      }

      // Clear with dynamic fade based on glitch intensity
      const fadeAlpha = 0.12 + intensity * 0.08;
      ctx.fillStyle = `rgba(12, 14, 18, ${fadeAlpha})`;
      ctx.fillRect(0, 0, width, height);

      // Glitch: RGB shift / chromatic aberration
      if (intensity > 0.1) {
        const shift = Math.sin(frameCount * 0.1) * intensity * 3;
        ctx.save();
        ctx.globalAlpha = intensity * 0.3;
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = `rgba(255, 0, 0, ${intensity * 0.1})`;
        ctx.fillRect(shift, 0, width, height);
        ctx.fillStyle = `rgba(0, 255, 255, ${intensity * 0.1})`;
        ctx.fillRect(-shift, 0, width, height);
        ctx.restore();
      }

      // Draw scanlines with glitch offset
      scanlineOffsetRef.current += 0.5 + intensity * 2;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.02 + intensity * 0.03})`;
      ctx.lineWidth = 1;
      
      for (let i = 0; i < height; i += 3) {
        const offset = intensity > 0.2 ? Math.sin(i * 0.1 + scanlineOffsetRef.current) * intensity * 5 : 0;
        ctx.beginPath();
        ctx.moveTo(offset, i);
        ctx.lineTo(width + offset, i);
        ctx.stroke();
      }

      // Draw grid with distortion
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.03 + intensity * 0.02})`;
      for (let i = 0; i < width; i += 20) {
        const distort = intensity > 0.3 ? (noiseRef.current[i % 256] - 0.5) * intensity * 10 : 0;
        ctx.beginPath();
        ctx.moveTo(i + distort, 0);
        ctx.lineTo(i + distort, height);
        ctx.stroke();
      }

      // Center line with glitch
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + intensity * 0.1})`;
      ctx.beginPath();
      const centerY = height / 2 + (intensity > 0.2 ? (Math.random() - 0.5) * intensity * 10 : 0);
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      if (isPlaying && analyserData.length > 0) {
        const barWidth = width / analyserData.length;
        
        // Determine colors based on glitch intensity
        const primaryHue = isChaos ? 0 : 180; // Red for chaos, cyan for normal
        const secondaryHue = isChaos ? 30 : 35; // Orange tones
        const glitchHue = 280 + Math.sin(frameCount * 0.1) * 40; // Purple/magenta shift

        // Main waveform with glitch distortion
        ctx.beginPath();
        ctx.strokeStyle = intensity > 0.3 
          ? `hsl(${glitchHue}, 100%, 60%)`
          : `hsl(${primaryHue}, 100%, 50%)`;
        ctx.lineWidth = 2 + intensity;
        ctx.shadowColor = intensity > 0.3 
          ? `hsl(${glitchHue}, 100%, 50%)`
          : `hsl(${primaryHue}, 100%, 50%)`;
        ctx.shadowBlur = 10 + intensity * 15;

        for (let i = 0; i < analyserData.length; i++) {
          const x = i * barWidth;
          let barHeight = (analyserData[i] / 255) * height * 0.8;
          
          // Glitch distortion: random height spikes
          if (intensity > 0.2 && noiseRef.current[i % 256] > 0.9) {
            barHeight *= 1 + intensity * 0.5;
          }
          
          // Horizontal glitch: random x offset
          const glitchX = intensity > 0.4 && noiseRef.current[(i + frameCount) % 256] > 0.95
            ? (Math.random() - 0.5) * intensity * 30
            : 0;
          
          const y = height - barHeight;

          if (i === 0) {
            ctx.moveTo(x + glitchX, y);
          } else {
            ctx.lineTo(x + glitchX, y);
          }
        }
        ctx.stroke();

        // Bitcrush effect: stepped/quantized waveform
        if (intensity > 0.5) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(255, 100, 100, ${intensity * 0.5})`;
          ctx.lineWidth = 1;
          ctx.shadowBlur = 0;
          
          const stepSize = Math.floor(2 + intensity * 6);
          for (let i = 0; i < analyserData.length; i += stepSize) {
            const x = i * barWidth;
            const barHeight = (analyserData[i] / 255) * height * 0.7;
            const quantizedHeight = Math.floor(barHeight / 10) * 10; // Quantize
            const y = height - quantizedHeight;
            
            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
              ctx.lineTo(x + stepSize * barWidth, y);
            }
          }
          ctx.stroke();
        }

        // Mirror effect with glitch
        ctx.beginPath();
        ctx.strokeStyle = `hsl(${secondaryHue}, 100%, ${55 + intensity * 20}%)`;
        ctx.lineWidth = 1;
        ctx.shadowColor = `hsl(${secondaryHue}, 100%, 55%)`;
        ctx.shadowBlur = 5 + intensity * 10;

        for (let i = 0; i < analyserData.length; i++) {
          const x = i * barWidth;
          let barHeight = (analyserData[i] / 255) * height * 0.4;
          
          // Inverse glitch for mirror
          if (intensity > 0.3 && noiseRef.current[(i + 128) % 256] > 0.85) {
            barHeight *= 0.5;
          }
          
          const y = barHeight;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        // Glitch blocks / artifacts
        if (intensity > 0.4) {
          const numBlocks = Math.floor(intensity * 5);
          for (let i = 0; i < numBlocks; i++) {
            const blockX = noiseRef.current[i * 10 % 256] * width;
            const blockY = noiseRef.current[(i * 10 + 1) % 256] * height;
            const blockW = 10 + noiseRef.current[(i * 10 + 2) % 256] * 50 * intensity;
            const blockH = 2 + noiseRef.current[(i * 10 + 3) % 256] * 10 * intensity;
            
            ctx.fillStyle = `hsla(${glitchHue + i * 30}, 100%, 60%, ${intensity * 0.4})`;
            ctx.fillRect(blockX, blockY, blockW, blockH);
          }
        }

        // VHS-style noise lines
        if (intensity > 0.6) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${intensity * 0.3})`;
          ctx.lineWidth = 1;
          for (let i = 0; i < 3; i++) {
            const lineY = (noiseRef.current[(frameCount + i * 50) % 256]) * height;
            ctx.beginPath();
            ctx.moveTo(0, lineY);
            ctx.lineTo(width, lineY);
            ctx.stroke();
          }
        }

        ctx.shadowBlur = 0;
      }

      // Overlay effect indicator
      if (intensity > 0.1 || isChaos) {
        ctx.save();
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = isChaos 
          ? `rgba(255, 50, 50, ${0.5 + Math.sin(frameCount * 0.2) * 0.3})`
          : `rgba(180, 100, 255, ${intensity * 0.8})`;
        
        const label = isChaos ? '◉ CHAOS' : '◉ GLITCH';
        ctx.fillText(label, width - 8, 14);
        ctx.restore();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, analyserData, activeEffect, generateNoise]);

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
    <div className={cn('waveform-container w-full h-24 relative overflow-hidden', className)}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
      {/* CRT overlay effect */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
        }}
      />
    </div>
  );
};
