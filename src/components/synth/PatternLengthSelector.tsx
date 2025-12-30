import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface PatternLengthSelectorProps {
  length: number;
  onChange: (length: number) => void;
  variant?: 'primary' | 'secondary' | 'muted';
  min?: number;
  max?: number;
}

const commonLengths = [4, 8, 12, 16, 24, 32];

export const PatternLengthSelector = ({
  length,
  onChange,
  variant = 'primary',
  min = 1,
  max = 32,
}: PatternLengthSelectorProps) => {
  const variantColors = {
    primary: 'text-primary hover:bg-primary/10',
    secondary: 'text-secondary hover:bg-secondary/10',
    muted: 'text-muted-foreground hover:bg-muted',
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (length < max) {
      onChange(length + 1);
    }
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (length > min) {
      onChange(length - 1);
    }
  };

  return (
    <div className="flex items-center gap-0.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-6 px-1.5 text-xs font-mono', variantColors[variant])}
          >
            {length}
            <ChevronDown className="w-3 h-3 ml-0.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[80px]">
          {commonLengths.filter(l => l >= min && l <= max).map((len) => (
            <DropdownMenuItem
              key={len}
              onClick={() => onChange(len)}
              className={cn(
                'font-mono text-xs',
                length === len && 'bg-accent'
              )}
            >
              {len} steps
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
