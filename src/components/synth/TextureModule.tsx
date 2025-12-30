import { useState, useEffect, useRef } from 'react';
import { CloudFog } from 'lucide-react';
import { ModuleCard } from './ModuleCard';
import { Knob } from './Knob';
import { cn } from '@/lib/utils';

interface TextureModuleProps {
  isPlaying: boolean;
}

export const TextureModule = ({ isPlaying }: TextureModuleProps) => {
  const [muted, setMuted] = useState(false);
  const [mode, setMode] = useState<'noise' | 'granular' | 'drone'>('granular');
  const [params, setParams] = useState({
    density: 45,
    spread: 60,
    pitch: 50,
    size: 35,
    feedback: 20,
    mix: 50,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; size: number }> = [];

    const draw = () => {
      const { width, height } = canvas;
      
      ctx.fillStyle = 'rgba(12, 14, 18, 0.1)';
      ctx.fillRect(0, 0, width, height);

      if (isPlaying && !muted) {
        // Add new particles based on density
        if (Math.random() < params.density / 100) {
          particles.push({
            x: Math.random() * width,
            y: height,
            vx: (Math.random() - 0.5) * (params.spread / 25),
            vy: -1 - Math.random() * 2,
            life: 1,
            size: 1 + (params.size / 50) * Math.random() * 3,
          });
        }

        // Update and draw particles
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.01;

          if (p.life <= 0 || p.y < 0) {
            particles.splice(i, 1);
            continue;
          }

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(180, 100%, 50%, ${p.life * 0.5})`;
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
  }, [isPlaying, muted, params.density, params.spread, params.size]);

  return (
    <ModuleCard
      title="Texture"
      icon={<CloudFog className="w-4 h-4" />}
      muted={muted}
      onMuteToggle={() => setMuted(!muted)}
    >
      <div className="space-y-4">
        {/* Mode selector */}
        <div className="flex gap-1">
          {(['noise', 'granular', 'drone'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
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
            onChange={(v) => setParams({ ...params, density: v })}
            label="Density"
            size="sm"
          />
          <Knob
            value={params.spread}
            onChange={(v) => setParams({ ...params, spread: v })}
            label="Spread"
            size="sm"
          />
          <Knob
            value={params.pitch}
            onChange={(v) => setParams({ ...params, pitch: v })}
            label="Pitch"
            size="sm"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Knob
            value={params.size}
            onChange={(v) => setParams({ ...params, size: v })}
            label="Size"
            size="sm"
            variant="secondary"
          />
          <Knob
            value={params.feedback}
            onChange={(v) => setParams({ ...params, feedback: v })}
            label="Feedback"
            size="sm"
            variant="secondary"
          />
          <Knob
            value={params.mix}
            onChange={(v) => setParams({ ...params, mix: v })}
            label="Mix"
            size="sm"
          />
        </div>
      </div>
    </ModuleCard>
  );
};
