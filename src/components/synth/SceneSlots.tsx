import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface Scene {
  id: string;
  name: string;
  color?: string;
}

interface SceneSlotsProps {
  scenes: Scene[];
  activeScene: string;
  onSceneSelect: (id: string) => void;
}

export const SceneSlots = forwardRef<HTMLDivElement, SceneSlotsProps>(({ scenes, activeScene, onSceneSelect }, ref) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-label">Scenes</span>
        <span className="text-xs text-muted-foreground">Shift + 1-8</span>
      </div>
      
      <div className="grid grid-cols-4 gap-2">
        {scenes.map((scene, index) => (
          <button
            key={scene.id}
            onClick={() => onSceneSelect(scene.id)}
            className={cn(
              'scene-slot flex flex-col items-center justify-center h-14 transition-all',
              activeScene === scene.id && 'active'
            )}
          >
            <span className="text-xs font-medium">{scene.name}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">
              {index + 1}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
});

SceneSlots.displayName = 'SceneSlots';
