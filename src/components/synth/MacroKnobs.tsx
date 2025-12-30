import { Knob } from './Knob';

interface Macro {
  id: string;
  name: string;
  value: number;
  targets: string[];
}

interface MacroKnobsProps {
  macros: Macro[];
  onMacroChange: (id: string, value: number) => void;
}

export const MacroKnobs = ({ macros, onMacroChange }: MacroKnobsProps) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-label">Macros</span>
        <span className="text-xs text-muted-foreground">Click + drag</span>
      </div>
      
      <div className="grid grid-cols-4 gap-4">
        {macros.map((macro) => (
          <Knob
            key={macro.id}
            value={macro.value}
            onChange={(value) => onMacroChange(macro.id, value)}
            label={macro.name}
            size="md"
            variant={macro.targets.length > 0 ? 'primary' : 'secondary'}
          />
        ))}
      </div>
    </div>
  );
};
