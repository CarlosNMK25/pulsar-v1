import { useState } from 'react';
import { Search, Star, Trash2, Download, Upload, ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getFactoryPresetNames, FactoryPresetName } from '@/audio/factoryPresets';
import { UseSceneManagerReturn } from '@/hooks/useSceneManager';

interface PresetBrowserProps {
  sceneManager: UseSceneManagerReturn;
}

export const PresetBrowser = ({ sceneManager }: PresetBrowserProps) => {
  const [search, setSearch] = useState('');
  const [factoryOpen, setFactoryOpen] = useState(true);
  const [userOpen, setUserOpen] = useState(true);

  const factoryPresets = getFactoryPresetNames();
  const userScenes = sceneManager.scenes.filter(s => 
    sceneManager.savedSceneIds.includes(s.id)
  );

  const filteredFactory = factoryPresets.filter(name =>
    name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredUser = userScenes.filter(scene =>
    scene.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleLoadFactory = (presetName: FactoryPresetName) => {
    // Load to active scene
    sceneManager.handleLoadPreset(presetName, sceneManager.activeScene);
  };

  const handleLoadUser = (sceneId: string) => {
    sceneManager.handleSceneSelect(sceneId);
  };

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search presets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-xs bg-muted/50"
        />
      </div>

      {/* Preset list */}
      <ScrollArea className="flex-1">
        <div className="space-y-2 pr-2">
          {/* Factory Presets */}
          <Collapsible open={factoryOpen} onOpenChange={setFactoryOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-xs font-medium text-muted-foreground hover:text-foreground py-1">
              <ChevronRight className={cn(
                "w-3 h-3 transition-transform",
                factoryOpen && "rotate-90"
              )} />
              {factoryOpen ? <FolderOpen className="w-3.5 h-3.5" /> : <Folder className="w-3.5 h-3.5" />}
              FACTORY ({filteredFactory.length})
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5 mt-1">
              {filteredFactory.map((presetName) => (
                <button
                  key={presetName}
                  onClick={() => handleLoadFactory(presetName)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs",
                    "text-foreground/80 hover:text-foreground",
                    "hover:bg-muted/50 transition-colors",
                    "text-left capitalize"
                  )}
                >
                  <Star className="w-3 h-3 text-amber-500/70" />
                  {presetName}
                </button>
              ))}
            </CollapsibleContent>
          </Collapsible>

          {/* User Scenes */}
          <Collapsible open={userOpen} onOpenChange={setUserOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-xs font-medium text-muted-foreground hover:text-foreground py-1">
              <ChevronRight className={cn(
                "w-3 h-3 transition-transform",
                userOpen && "rotate-90"
              )} />
              {userOpen ? <FolderOpen className="w-3.5 h-3.5" /> : <Folder className="w-3.5 h-3.5" />}
              USER SCENES ({filteredUser.length})
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5 mt-1">
              {filteredUser.length === 0 ? (
                <p className="text-xs text-muted-foreground px-3 py-2">
                  No saved scenes yet. Save a scene to see it here.
                </p>
              ) : (
                filteredUser.map((scene) => (
                  <div
                    key={scene.id}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs",
                      "hover:bg-muted/50 transition-colors group",
                      sceneManager.activeScene === scene.id && "bg-primary/20 text-primary"
                    )}
                  >
                    <button
                      onClick={() => handleLoadUser(scene.id)}
                      className="flex-1 text-left"
                    >
                      {scene.name}
                    </button>
                    <button
                      onClick={() => sceneManager.handleExportScene(scene.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-opacity"
                      title="Export"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs h-8"
          onClick={() => sceneManager.handleSceneSave(sceneManager.activeScene)}
        >
          Save Current
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2"
          onClick={sceneManager.handleExportAll}
          title="Export All"
        >
          <Download className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2"
          onClick={sceneManager.handleImportAll}
          title="Import"
        >
          <Upload className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};
