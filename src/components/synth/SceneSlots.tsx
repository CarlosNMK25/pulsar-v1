import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Save, Target, Copy, Clipboard, Download, Upload, ChevronDown } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FactoryPresetName } from '@/audio/factoryPresets';

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
  hasClipboard: boolean;
  clipboardName?: string;
  onSceneSelect: (id: string) => void;
  onSceneSave: (id: string) => void;
  onMorphTargetSet: (id: string | null) => void;
  onSceneCopy: (id: string) => void;
  onScenePaste: (id: string) => void;
  onSceneRename: (id: string, name: string) => void;
  onLoadPreset: (preset: FactoryPresetName, targetId: string) => void;
  onExportScene: (id: string) => void;
  onExportAll: () => void;
  onImportScene: (id: string) => void;
  onImportAll: () => void;
}

export function SceneSlots({ 
  scenes, 
  activeScene, 
  morphTargetScene,
  savedSceneIds,
  hasClipboard,
  clipboardName,
  onSceneSelect, 
  onSceneSave,
  onMorphTargetSet,
  onSceneCopy,
  onScenePaste,
  onSceneRename,
  onLoadPreset,
  onExportScene,
  onExportAll,
  onImportScene,
  onImportAll,
}: SceneSlotsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);
  
  const handleClick = (e: React.MouseEvent, sceneId: string) => {
    if (editingId) return; // Don't process clicks while editing
    
    if (e.shiftKey) {
      if (morphTargetScene === sceneId) {
        onMorphTargetSet(null);
      } else {
        onMorphTargetSet(sceneId);
      }
    } else {
      onSceneSelect(sceneId);
    }
  };
  
  const handleDoubleClick = (sceneId: string) => {
    if (!editingId) {
      onSceneSave(sceneId);
    }
  };
  
  const startEditing = (sceneId: string, currentName: string) => {
    setEditingId(sceneId);
    setEditValue(currentName);
  };
  
  const finishEditing = () => {
    if (editingId && editValue.trim()) {
      onSceneRename(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  };
  
  const cancelEditing = () => {
    setEditingId(null);
    setEditValue('');
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      finishEditing();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };
  
  const presets: FactoryPresetName[] = ['techno', 'ambient', 'breaks', 'experimental'];
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-label">Scenes</span>
        
        <div className="flex items-center gap-1">
          {/* Presets Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                Presets
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {presets.map((preset) => (
                <DropdownMenuItem
                  key={preset}
                  onClick={() => onLoadPreset(preset, activeScene)}
                  className="capitalize"
                >
                  {preset}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Export/Import Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                <Download className="w-3 h-3 mr-1" />
                File
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onExportScene(activeScene)}>
                <Download className="w-3 h-3 mr-2" />
                Export Current Scene
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportAll}>
                <Download className="w-3 h-3 mr-2" />
                Export All Scenes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onImportScene(activeScene)}>
                <Upload className="w-3 h-3 mr-2" />
                Import to Current Scene
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onImportAll}>
                <Upload className="w-3 h-3 mr-2" />
                Import All Scenes
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <div className="grid grid-cols-4 gap-2">
        {scenes.map((scene, index) => {
          const isSaved = savedSceneIds.includes(scene.id);
          const isActive = activeScene === scene.id;
          const isMorphTarget = morphTargetScene === scene.id;
          const isEditing = editingId === scene.id;
          
          return (
            <ContextMenu key={scene.id}>
              <ContextMenuTrigger asChild>
                <button
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
                  
                  {isEditing ? (
                    <Input
                      ref={inputRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={finishEditing}
                      onKeyDown={handleKeyDown}
                      className="h-5 text-xs text-center px-1 w-full bg-background"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="text-xs font-medium">{scene.name}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {index + 1}
                  </span>
                </button>
              </ContextMenuTrigger>
              
              <ContextMenuContent>
                <ContextMenuItem onClick={() => onSceneSave(scene.id)}>
                  <Save className="w-3 h-3 mr-2" />
                  Save Scene
                </ContextMenuItem>
                <ContextMenuItem onClick={() => startEditing(scene.id, scene.name)}>
                  Rename
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => onSceneCopy(scene.id)}>
                  <Copy className="w-3 h-3 mr-2" />
                  Copy
                </ContextMenuItem>
                <ContextMenuItem 
                  onClick={() => onScenePaste(scene.id)}
                  disabled={!hasClipboard}
                >
                  <Clipboard className="w-3 h-3 mr-2" />
                  Paste {clipboardName ? `(${clipboardName})` : ''}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => onMorphTargetSet(scene.id)}>
                  <Target className="w-3 h-3 mr-2" />
                  Set as Morph Target
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
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
      
      {/* Clipboard indicator */}
      {hasClipboard && (
        <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
          <Clipboard className="w-2.5 h-2.5" />
          <span>Clipboard: {clipboardName}</span>
        </div>
      )}
    </div>
  );
}