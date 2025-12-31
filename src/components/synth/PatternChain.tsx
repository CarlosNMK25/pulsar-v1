import { useCallback } from 'react';
import { Link, Repeat, Plus, X, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { PatternChainConfig } from '@/hooks/usePatternChain';

interface Scene {
  id: string;
  name: string;
}

interface PatternChainProps {
  config: PatternChainConfig;
  currentChainIndex: number;
  isChainActive: boolean;
  scenes: Scene[];
  savedSceneIds: string[];
  activeScene: string;
  onAddToChain: (sceneId: string) => void;
  onRemoveFromChain: (index: number) => void;
  onBarsPerPatternChange: (bars: number) => void;
  onLoopChainChange: (loop: boolean) => void;
  onToggleEnabled: () => void;
  onClearChain: () => void;
}

export const PatternChain = ({
  config,
  currentChainIndex,
  isChainActive,
  scenes,
  savedSceneIds,
  activeScene,
  onAddToChain,
  onRemoveFromChain,
  onBarsPerPatternChange,
  onLoopChainChange,
  onToggleEnabled,
  onClearChain,
}: PatternChainProps) => {
  const getSceneName = useCallback((sceneId: string) => {
    return scenes.find(s => s.id === sceneId)?.name || sceneId.toUpperCase();
  }, [scenes]);

  const availableScenes = scenes.filter(s => savedSceneIds.includes(s.id));

  const handleAddCurrent = useCallback(() => {
    if (savedSceneIds.includes(activeScene)) {
      onAddToChain(activeScene);
    }
  }, [activeScene, savedSceneIds, onAddToChain]);

  return (
    <div className="space-y-3">
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Pattern Chain
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-xs transition-colors",
            config.enabled ? "text-primary" : "text-muted-foreground"
          )}>
            {config.enabled ? 'ON' : 'OFF'}
          </span>
          <Switch
            checked={config.enabled}
            onCheckedChange={onToggleEnabled}
            disabled={config.chain.length === 0}
            className="data-[state=checked]:bg-primary"
          />
        </div>
      </div>

      {/* Chain visualization */}
      <div className="flex items-center gap-1 flex-wrap min-h-[40px] p-2 rounded-md bg-muted/30 border border-border/50">
        {config.chain.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">
            No patterns in chain. Add saved scenes below.
          </span>
        ) : (
          <>
            {config.chain.map((sceneId, index) => (
              <div key={`${sceneId}-${index}`} className="flex items-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onRemoveFromChain(index)}
                        className={cn(
                          "px-2 py-1 text-xs font-mono rounded border transition-all",
                          isChainActive && index === currentChainIndex
                            ? "bg-primary text-primary-foreground border-primary glow-primary"
                            : "bg-card border-border hover:border-primary/50 hover:bg-accent"
                        )}
                      >
                        {getSceneName(sceneId)}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Click to remove</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {index < config.chain.length - 1 && (
                  <ChevronRight className="h-3 w-3 text-muted-foreground mx-0.5" />
                )}
              </div>
            ))}
            {config.loopChain && config.chain.length > 0 && (
              <>
                <ChevronRight className="h-3 w-3 text-muted-foreground mx-0.5" />
                <Repeat className="h-3 w-3 text-primary" />
              </>
            )}
          </>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Add scene selector */}
        <div className="flex items-center gap-1">
          <Select onValueChange={onAddToChain}>
            <SelectTrigger className="h-7 w-24 text-xs">
              <SelectValue placeholder="Add..." />
            </SelectTrigger>
            <SelectContent>
              {availableScenes.length === 0 ? (
                <SelectItem value="_" disabled>
                  Save scenes first
                </SelectItem>
              ) : (
                availableScenes.map(scene => (
                  <SelectItem key={scene.id} value={scene.id}>
                    {scene.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleAddCurrent}
                  disabled={!savedSceneIds.includes(activeScene)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add current scene</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Bars per pattern */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Bars:</span>
          <Select
            value={config.barsPerPattern.toString()}
            onValueChange={(v) => onBarsPerPatternChange(parseInt(v))}
          >
            <SelectTrigger className="h-7 w-14 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 4, 8, 16].map(bars => (
                <SelectItem key={bars} value={bars.toString()}>
                  {bars}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Loop toggle */}
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={config.loopChain ? "default" : "outline"}
                  size="icon"
                  className={cn("h-7 w-7", config.loopChain && "bg-primary")}
                  onClick={() => onLoopChainChange(!config.loopChain)}
                >
                  <Repeat className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{config.loopChain ? 'Loop enabled' : 'Loop disabled'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Clear button */}
        {config.chain.length > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={onClearChain}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Clear chain</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Status indicator */}
      {isChainActive && (
        <div className="flex items-center gap-2 text-xs text-primary">
          <span className="led on" />
          <span>
            Playing {currentChainIndex + 1}/{config.chain.length}: {getSceneName(config.chain[currentChainIndex])}
          </span>
        </div>
      )}
    </div>
  );
};
