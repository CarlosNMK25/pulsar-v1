import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { Zap, Volume2, VolumeX, Target } from 'lucide-react';

interface PerformancePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Module mutes
  drumMuted?: boolean;
  synthMuted?: boolean;
  textureMuted?: boolean;
  sampleMuted?: boolean;
  onDrumMuteToggle?: () => void;
  onSynthMuteToggle?: () => void;
  onTextureMuteToggle?: () => void;
  onSampleMuteToggle?: () => void;
  // Scene controls
  scenes?: { id: string; name: string }[];
  activeScene?: string;
  onSceneSelect?: (id: string) => void;
  // Morph
  morphAmount?: number;
  onMorphChange?: (value: number) => void;
}

export const PerformancePanel = ({
  open,
  onOpenChange,
  drumMuted = false,
  synthMuted = false,
  textureMuted = false,
  sampleMuted = false,
  onDrumMuteToggle,
  onSynthMuteToggle,
  onTextureMuteToggle,
  onSampleMuteToggle,
  scenes = [],
  activeScene,
  onSceneSelect,
  morphAmount = 0,
  onMorphChange,
}: PerformancePanelProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="left" 
        className="w-[200px] p-4 bg-card/95 backdrop-blur-sm border-r border-border"
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-2 text-sm font-medium">
            <Zap className="w-4 h-4 text-primary" />
            <span>Performance</span>
          </div>

          {/* Kill Switches */}
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Kill Switches</span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'Drum', muted: drumMuted, toggle: onDrumMuteToggle },
                { name: 'Synth', muted: synthMuted, toggle: onSynthMuteToggle },
                { name: 'Texture', muted: textureMuted, toggle: onTextureMuteToggle },
                { name: 'Sample', muted: sampleMuted, toggle: onSampleMuteToggle },
              ].map((item) => (
                <button
                  key={item.name}
                  onClick={item.toggle}
                  className={cn(
                    "flex flex-col items-center justify-center p-2 rounded-md border transition-colors",
                    item.muted 
                      ? "bg-destructive/20 border-destructive/50 text-destructive" 
                      : "bg-muted/50 border-border hover:bg-muted text-foreground"
                  )}
                >
                  {item.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  <span className="text-[10px] mt-1">{item.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Scene Quick Select */}
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Scenes</span>
            <div className="grid grid-cols-4 gap-1">
              {scenes.slice(0, 8).map((scene) => (
                <button
                  key={scene.id}
                  onClick={() => onSceneSelect?.(scene.id)}
                  className={cn(
                    "w-8 h-8 rounded text-xs font-medium transition-colors",
                    scene.id === activeScene
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-foreground"
                  )}
                >
                  {scene.id}
                </button>
              ))}
            </div>
          </div>

          {/* Morph Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Morph</span>
              <span className="text-xs text-primary">{Math.round(morphAmount * 100)}%</span>
            </div>
            <Slider
              value={[morphAmount * 100]}
              onValueChange={([v]) => onMorphChange?.(v / 100)}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          {/* XY Pad placeholder */}
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">XY Pad</span>
            <div className="aspect-square w-full rounded-md border border-border bg-muted/30 flex items-center justify-center">
              <Target className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <p className="text-[10px] text-muted-foreground text-center">Coming soon</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
