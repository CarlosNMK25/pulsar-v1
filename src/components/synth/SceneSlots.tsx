import { cn } from '@/lib/utils';
import { Save, Target } from 'lucide-react';

interface Scene {
  id: string;
  name: string;
  color?: string;
  saved?: boolean;
}

interface SceneSlotsProps {
  scenes: Scene[];
  activeScene: string;
  morphTargetScene: string | null;
  savedSceneIds: string[];
  onSceneSelect: (id: string) => void;
  onSceneSave: (id: string) => void;
  onMorphTargetSet: (id: string | null) => void;
}

export function SceneSlots({ 
  scenes, 
  activeScene, 
  morphTargetScene,
  savedSceneIds,
  onSceneSelect, 
  onSceneSave,
  onMorphTargetSet,
}: SceneSlotsProps) {
  
  const handleClick = (e: React.MouseEvent, sceneId: string) => {
    if (e.shiftKey) {
      // Shift+Click sets morph target
      if (morphTargetScene === sceneId) {
        onMorphTargetSet(null); // Toggle off if clicking same target
      } else {
        onMorphTargetSet(sceneId);
      }
    } else {
      onSceneSelect(sceneId);
    }
  };
  
  const handleDoubleClick = (sceneId: string) => {
    onSceneSave(sceneId);
  };
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-label">Scenes</span>
        <span className="text-xs text-muted-foreground">Shift+Click: Morph Target • Double-Click: Save</span>
      </div>
      
      <div className="grid grid-cols-4 gap-2">
        {scenes.map((scene, index) => {
          const isSaved = savedSceneIds.includes(scene.id);
          const isActive = activeScene === scene.id;
          const isMorphTarget = morphTargetScene === scene.id;
          
          return (
            <button
              key={scene.id}
              onClick={(e) => handleClick(e, scene.id)}
              onDoubleClick={() => handleDoubleClick(scene.id)}
              className={cn(
                'scene-slot relative flex flex-col items-center justify-center h-14 transition-all',
                isActive && 'active',
                isMorphTarget && 'ring-2 ring-primary/60 ring-offset-1 ring-offset-background',
                isSaved && 'border-primary/50'
              )}
            >
              {/* Saved indicator */}
              {isSaved && (
                <div className="absolute top-1 right-1">
                  <Save className="w-2.5 h-2.5 text-primary/70" />
                </div>
              )}
              
              {/* Morph target indicator */}
              {isMorphTarget && (
                <div className="absolute top-1 left-1">
                  <Target className="w-2.5 h-2.5 text-primary animate-pulse" />
                </div>
              )}
              
              <span className="text-xs font-medium">{scene.name}</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">
                {index + 1}
              </span>
            </button>
          );
        })}
      </div>
      
      {/* Morph indicator */}
      {morphTargetScene && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-card/50 rounded py-1.5 border border-border/50">
          <span className="text-foreground font-medium">
            {scenes.find(s => s.id === activeScene)?.name}
          </span>
          <span className="text-primary">→ M7 →</span>
          <span className="text-foreground font-medium">
            {scenes.find(s => s.id === morphTargetScene)?.name}
          </span>
        </div>
      )}
    </div>
  );
}
