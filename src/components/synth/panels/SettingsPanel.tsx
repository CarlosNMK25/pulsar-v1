import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Settings, Music, Headphones, FolderOpen, Download } from 'lucide-react';

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName?: string;
  bpm?: number;
}

export const SettingsPanel = ({
  open,
  onOpenChange,
  projectName = 'Untitled Session',
  bpm = 120,
}: SettingsPanelProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-[280px] p-4 bg-card/95 backdrop-blur-sm border-l border-border"
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2 text-sm font-medium">
            <Settings className="w-4 h-4 text-primary" />
            <span>Settings</span>
          </div>

          <Accordion type="multiple" defaultValue={["project", "audio"]} className="w-full">
            {/* Project */}
            <AccordionItem value="project">
              <AccordionTrigger className="text-xs py-2">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5" />
                  Project
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase">Name</label>
                  <input
                    type="text"
                    value={projectName}
                    readOnly
                    className="w-full px-2 py-1 text-xs bg-muted border border-border rounded"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase">Default BPM</label>
                  <div className="text-xs text-foreground">{bpm}</div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Audio */}
            <AccordionItem value="audio">
              <AccordionTrigger className="text-xs py-2">
                <div className="flex items-center gap-2">
                  <Headphones className="w-3.5 h-3.5" />
                  Audio
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase">Sample Rate</label>
                  <div className="text-xs text-foreground">48000 Hz</div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase">Buffer Size</label>
                  <div className="text-xs text-foreground">Auto</div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase">Latency</label>
                  <div className="text-xs text-muted-foreground">~10ms</div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* MIDI */}
            <AccordionItem value="midi">
              <AccordionTrigger className="text-xs py-2">
                <div className="flex items-center gap-2">
                  <Music className="w-3.5 h-3.5" />
                  MIDI
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <p className="text-xs text-muted-foreground">
                  MIDI device configuration coming soon.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* Export */}
            <AccordionItem value="export">
              <AccordionTrigger className="text-xs py-2">
                <div className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5" />
                  Export
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <button className="w-full px-3 py-2 text-xs bg-muted hover:bg-muted/80 rounded border border-border transition-colors">
                  Export WAV
                </button>
                <button className="w-full px-3 py-2 text-xs bg-muted hover:bg-muted/80 rounded border border-border transition-colors">
                  Export Project JSON
                </button>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </SheetContent>
    </Sheet>
  );
};
