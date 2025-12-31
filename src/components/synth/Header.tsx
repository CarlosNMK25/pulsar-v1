import { Settings, Save, FolderOpen, Cpu, PanelLeft, PanelRight, ChevronDown, Volume2, Undo2, Redo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DockState } from '@/hooks/useUILayout';

interface HeaderProps {
  projectName: string;
  // Panel toggles
  onToggleLeftPanel?: () => void;
  onToggleRightPanel?: () => void;
  onToggleDock?: () => void;
  leftPanelOpen?: boolean;
  rightPanelOpen?: boolean;
  dockState?: DockState;
  // Status info (moved from status bar)
  currentStep?: number;
  activeSceneName?: string;
  morphTargetName?: string;
  audioState?: string;
  isInitialized?: boolean;
}

export const Header = ({ 
  projectName,
  onToggleLeftPanel,
  onToggleRightPanel,
  onToggleDock,
  leftPanelOpen = false,
  rightPanelOpen = false,
  dockState = 'hidden',
  currentStep = 0,
  activeSceneName,
  morphTargetName,
  audioState = 'suspended',
  isInitialized = false,
}: HeaderProps) => {
  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
      {/* Left section */}
      <div className="flex items-center gap-3">
        {/* Left panel toggle */}
        {onToggleLeftPanel && (
          <button
            onClick={onToggleLeftPanel}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-md',
              'text-muted-foreground hover:text-foreground',
              'border border-transparent hover:border-border hover:bg-muted/50',
              'transition-colors',
              leftPanelOpen && 'bg-primary/20 text-primary border-primary/50'
            )}
            title="Performance Panel"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}

        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-base font-display font-semibold tracking-tight hidden sm:inline">
            PULSAR
          </span>
        </div>

        <div className="w-px h-5 bg-border hidden sm:block" />

        {/* Project name */}
        <div className="flex items-center gap-2 hidden md:flex">
          <span className="text-muted-foreground text-xs">Project:</span>
          <span className="text-xs font-medium">{projectName}</span>
        </div>
      </div>

      {/* Center section - Status info */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="hidden lg:inline">Step: {currentStep + 1}/16</span>
        {activeSceneName && (
          <span className="hidden md:inline">Scene: {activeSceneName}</span>
        )}
        {morphTargetName && (
          <span className="text-primary hidden lg:inline">→ {morphTargetName}</span>
        )}
        <span className="flex items-center gap-1">
          <span className={cn("led", isInitialized && "on")} />
          <span className="hidden sm:inline">{isInitialized ? 'Ready' : 'Init'}</span>
        </span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Undo/Redo (disabled placeholders) */}
        <button
          disabled
          className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground/50 cursor-not-allowed"
          title="Undo (coming soon)"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          disabled
          className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground/50 cursor-not-allowed"
          title="Redo (coming soon)"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        <button
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-md',
            'text-xs text-muted-foreground hover:text-foreground',
            'border border-transparent hover:border-border hover:bg-muted/50',
            'transition-colors'
          )}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Load</span>
        </button>

        <button
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-md',
            'text-xs text-muted-foreground hover:text-foreground',
            'border border-transparent hover:border-border hover:bg-muted/50',
            'transition-colors'
          )}
        >
          <Save className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Save</span>
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Dock toggle */}
        {onToggleDock && (
          <button
            onClick={onToggleDock}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-md',
              'text-muted-foreground hover:text-foreground',
              'border border-transparent hover:border-border hover:bg-muted/50',
              'transition-colors',
              dockState !== 'hidden' && 'bg-primary/20 text-primary border-primary/50'
            )}
            title="Bottom Dock"
          >
            <ChevronDown className={cn(
              "w-4 h-4 transition-transform",
              dockState === 'expanded' && "rotate-180"
            )} />
          </button>
        )}

        {/* Settings */}
        <button
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-md',
            'text-muted-foreground hover:text-foreground',
            'border border-transparent hover:border-border hover:bg-muted/50',
            'transition-colors'
          )}
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Right panel toggle */}
        {onToggleRightPanel && (
          <button
            onClick={onToggleRightPanel}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-md',
              'text-muted-foreground hover:text-foreground',
              'border border-transparent hover:border-border hover:bg-muted/50',
              'transition-colors',
              rightPanelOpen && 'bg-primary/20 text-primary border-primary/50'
            )}
            title="Settings Panel"
          >
            <PanelRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
