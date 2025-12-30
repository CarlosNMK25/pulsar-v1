import { Settings, Save, FolderOpen, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  projectName: string;
}

export const Header = ({ projectName }: HeaderProps) => {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/50">
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-display font-semibold tracking-tight">
            PULSAR
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-border" />

        {/* Project name */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Project:</span>
          <span className="text-sm font-medium">{projectName}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md',
            'text-sm text-muted-foreground hover:text-foreground',
            'border border-transparent hover:border-border hover:bg-muted/50',
            'transition-colors'
          )}
        >
          <FolderOpen className="w-4 h-4" />
          <span>Load</span>
        </button>

        <button
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md',
            'text-sm text-muted-foreground hover:text-foreground',
            'border border-transparent hover:border-border hover:bg-muted/50',
            'transition-colors'
          )}
        >
          <Save className="w-4 h-4" />
          <span>Save</span>
        </button>

        <div className="w-px h-6 bg-border mx-2" />

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
      </div>
    </header>
  );
};
