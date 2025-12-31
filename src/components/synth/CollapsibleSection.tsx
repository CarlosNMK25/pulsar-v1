import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  moduleCount?: number;
}

export const CollapsibleSection = ({
  title,
  isOpen,
  onToggle,
  children,
  moduleCount,
}: CollapsibleSectionProps) => {
  return (
    <section className="space-y-3">
      <button
        onClick={onToggle}
        className="flex items-center gap-3 w-full group cursor-pointer"
      >
        <div className="h-px flex-1 bg-border/50" />
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
          <ChevronDown 
            className={cn(
              "w-4 h-4 transition-transform duration-200",
              !isOpen && "-rotate-90"
            )} 
          />
          <span>{title}</span>
          {!isOpen && moduleCount && (
            <span className="text-primary/70">({moduleCount})</span>
          )}
        </div>
        <div className="h-px flex-1 bg-border/50" />
      </button>
      
      <div
        className={cn(
          "grid transition-all duration-200 ease-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          {children}
        </div>
      </div>
    </section>
  );
};
