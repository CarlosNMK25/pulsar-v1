import { ScrollArea } from '@/components/ui/scroll-area';

interface ShortcutItem {
  keys: string;
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutItem[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Transport',
    shortcuts: [
      { keys: 'Space', description: 'Play / Pause' },
      { keys: 'Esc', description: 'Stop' },
    ],
  },
  {
    title: 'Scenes',
    shortcuts: [
      { keys: '1-8', description: 'Select Scene' },
      { keys: 'Shift + 1-8', description: 'Save to Scene' },
      { keys: 'Ctrl/⌘ + C', description: 'Copy Scene' },
      { keys: 'Ctrl/⌘ + V', description: 'Paste Scene' },
    ],
  },
  {
    title: 'Musical Keyboard',
    shortcuts: [
      { keys: 'A-L', description: 'Play notes (white keys)' },
      { keys: 'W, E, T, Y, U', description: 'Play notes (black keys)' },
      { keys: 'Z', description: 'Octave down' },
      { keys: 'X', description: 'Octave up' },
    ],
  },
  {
    title: 'Drums',
    shortcuts: [
      { keys: 'Q', description: 'Trigger Kick' },
      { keys: 'W', description: 'Trigger Snare' },
      { keys: 'E', description: 'Trigger Hat' },
    ],
  },
];

export const ShortcutsReference = () => {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 pr-2">
        {shortcutGroups.map((group) => (
          <div key={group.title}>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {group.title}
            </h3>
            <div className="space-y-1">
              {group.shortcuts.map((shortcut) => (
                <div
                  key={shortcut.keys}
                  className="flex items-center justify-between text-xs py-1"
                >
                  <span className="text-foreground/80">{shortcut.description}</span>
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono text-muted-foreground border border-border">
                    {shortcut.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="pt-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground">
            Tip: The musical keyboard works globally when the dock is visible.
          </p>
        </div>
      </div>
    </ScrollArea>
  );
};
