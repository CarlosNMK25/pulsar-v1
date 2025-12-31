import { Settings2 } from 'lucide-react';

export const ParamsTab = () => {
  return (
    <div className="flex items-center justify-center h-full gap-4 px-4 text-muted-foreground">
      <Settings2 className="w-6 h-6" />
      <div className="text-sm">
        <div className="font-medium text-foreground">MIDI Learn & Parameters</div>
        <div className="text-xs">Coming soon - Map MIDI controllers to any parameter</div>
      </div>
    </div>
  );
};
