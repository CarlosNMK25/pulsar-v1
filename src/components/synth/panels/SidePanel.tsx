import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Library, Keyboard, Settings, Music } from 'lucide-react';
import { PresetBrowser } from './PresetBrowser';
import { ShortcutsReference } from './ShortcutsReference';
import { MidiSettings } from './MidiSettings';
import { AudioSettings } from './AudioSettings';
import { UseSceneManagerReturn } from '@/hooks/useSceneManager';

interface SidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  sceneManager: UseSceneManagerReturn;
  bpm?: number;
}

export const SidePanel = ({
  open,
  onOpenChange,
  activeTab,
  onTabChange,
  sceneManager,
  bpm = 120,
}: SidePanelProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="left" 
        className="w-[320px] p-0 bg-card/95 backdrop-blur-sm border-r border-border flex flex-col"
      >
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="text-sm font-medium flex items-center gap-2">
            <Library className="w-4 h-4 text-primary" />
            Browser
          </SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={onTabChange} className="flex-1 flex flex-col">
          <TabsList className="grid grid-cols-4 mx-3 mt-3 bg-muted/50">
            <TabsTrigger value="presets" className="text-xs gap-1">
              <Library className="w-3 h-3" />
              <span className="hidden sm:inline">Presets</span>
            </TabsTrigger>
            <TabsTrigger value="midi" className="text-xs gap-1">
              <Music className="w-3 h-3" />
              <span className="hidden sm:inline">MIDI</span>
            </TabsTrigger>
            <TabsTrigger value="audio" className="text-xs gap-1">
              <Settings className="w-3 h-3" />
              <span className="hidden sm:inline">Audio</span>
            </TabsTrigger>
            <TabsTrigger value="shortcuts" className="text-xs gap-1">
              <Keyboard className="w-3 h-3" />
              <span className="hidden sm:inline">Keys</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="presets" className="h-full m-0 p-3">
              <PresetBrowser sceneManager={sceneManager} />
            </TabsContent>

            <TabsContent value="midi" className="h-full m-0 p-3">
              <MidiSettings />
            </TabsContent>

            <TabsContent value="audio" className="h-full m-0 p-3">
              <AudioSettings bpm={bpm} />
            </TabsContent>

            <TabsContent value="shortcuts" className="h-full m-0 p-3">
              <ShortcutsReference />
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
