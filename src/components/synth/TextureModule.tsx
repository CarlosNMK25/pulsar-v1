import { useEffect, useRef } from 'react';
import { CloudFog } from 'lucide-react';
import { ModuleCard } from './ModuleCard';
import { Knob } from './Knob';
import { cn } from '@/lib/utils';
import { TextureMode } from '@/audio/TextureEngine';

interface TextureModuleProps {
  isPlaying: boolean;
  muted: boolean;
  onMuteToggle: () => void;
  mode: TextureMode;
  onModeChange: (mode: TextureMode) => void;
  params: {
    density: number;
    spread: number;
    pitch: number;
    size: number;
    feedback: number;
    mix: number;
  };
  onParamsChange: (params: TextureModuleProps['params']) => void;
}

export const TextureModule = ({ 
  isPlaying, 
  muted, 
  onMuteToggle,
  mode,
  onModeChange,
  params,
  onParamsChange,
}: TextureModuleProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  const updateParam = (key: keyof typeof params, value: number) => {
    onParamsChange({ ...params, [key]: value });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; size: number }> = [];

    // Different colors for different modes
    const modeColors: Record<TextureMode, string> = {
      noise: '280, 70%, 50%',    // Purple for noise
      granular: '180, 100%, 50%', // Cyan for granular
      drone: '30, 90%, 55%',      // Orange for drone
    };

    const draw = () => {
      const { width, height } = canvas;
      
      ctx.fillStyle = 'rgba(12, 14, 18, 0.1)';
      ctx.fillRect(0, 0, width, height);

      if (isPlaying && !muted) {
        // Different particle behavior based on mode
        const spawnRate = mode === 'granular' 
          ? params.density / 50 
          : mode === 'drone' 
            ? 0.05 
            : params.density / 100;

        if (Math.random() < spawnRate) {
          const baseVy = mode === 'drone' ? -0.3 : -1 - Math.random() * 2;
          const baseSize = mode === 'drone' 
            ? 2 + (params.size / 30) * Math.random() * 5
            : 1 + (params.size / 50) * Math.random() * 3;

          particles.push({
            x: Math.random() * width,
            y: height,
            vx: (Math.random() - 0.5) * (params.spread / 25),
            vy: baseVy,
            life: 1,
            size: baseSize,
          });
        }

        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life -= mode === 'drone' ? 0.005 : 0.01;

          if (p.life <= 0 || p.y < 0) {
            particles.splice(i, 1);
            continue;
          }

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${modeColors[mode]}, ${p.life * 0.5})`;
          ctx.fill();
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, muted, mode, params.density, params.spread, params.size]);

  return (
    <ModuleCard
      title="Texture"
      icon={<CloudFog className="w-4 h-4" />}
      muted={muted}
      onMuteToggle={onMuteToggle}
    >
      <div className="space-y-4">
        {/* Mode selector */}
        <div className="flex gap-1">
          {(['noise', 'granular', 'drone'] as const).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={cn(
                'flex-1 py-1.5 text-xs uppercase tracking-wider rounded border transition-colors',
                mode === m
                  ? 'border-primary bg-primary/20 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Visualization */}
        <div className="waveform-container h-16">
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>

        {/* Parameters */}
        <div className="grid grid-cols-3 gap-4 pt-2">
          <Knob
            value={params.density}
            onChange={(v) => updateParam('density', v)}
            label="Density"
            size="sm"
          />
          <Knob
            value={params.spread}
            onChange={(v) => updateParam('spread', v)}
            label="Spread"
            size="sm"
          />
          <Knob
            value={params.pitch}
            onChange={(v) => updateParam('pitch', v)}
            label="Pitch"
            size="sm"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Knob
            value={params.size}
            onChange={(v) => updateParam('size', v)}
            label="Size"
            size="sm"
            variant="secondary"
          />
          <Knob
            value={params.feedback}
            onChange={(v) => updateParam('feedback', v)}
            label="Feedback"
            size="sm"
            variant="secondary"
          />
          <Knob
            value={params.mix}
            onChange={(v) => updateParam('mix', v)}
            label="Mix"
            size="sm"
          />
        </div>
      </div>
    </ModuleCard>
  );
};
