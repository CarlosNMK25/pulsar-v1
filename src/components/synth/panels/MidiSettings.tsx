import { useState, useEffect } from 'react';
import { Music, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
}

export const MidiSettings = () => {
  const [midiSupported, setMidiSupported] = useState(false);
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null);
  const [inputs, setInputs] = useState<MidiDevice[]>([]);
  const [selectedInput, setSelectedInput] = useState<string | null>(null);
  const [midiActivity, setMidiActivity] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if ('requestMIDIAccess' in navigator) {
      setMidiSupported(true);
      requestMidiAccess();
    }
  }, []);

  const requestMidiAccess = async () => {
    try {
      const access = await navigator.requestMIDIAccess();
      setMidiAccess(access);
      updateInputs(access);
      
      access.onstatechange = () => {
        updateInputs(access);
      };
    } catch (err) {
      setError('MIDI access denied or unavailable');
    }
  };

  const updateInputs = (access: MIDIAccess) => {
    const deviceList: MidiDevice[] = [];
    access.inputs.forEach((input) => {
      deviceList.push({
        id: input.id,
        name: input.name || 'Unknown Device',
        manufacturer: input.manufacturer || 'Unknown',
      });
    });
    setInputs(deviceList);
  };

  const handleSelectInput = (id: string) => {
    setSelectedInput(id);
    
    if (midiAccess) {
      // Clear previous listeners
      midiAccess.inputs.forEach((input) => {
        input.onmidimessage = null;
      });
      
      // Set up listener for selected input
      const input = midiAccess.inputs.get(id);
      if (input) {
        input.onmidimessage = (event) => {
          // Flash activity indicator
          setMidiActivity(true);
          setTimeout(() => setMidiActivity(false), 100);
          
          // Here we would forward MIDI to the synth
          // For now just logging
          console.log('MIDI:', event.data);
        };
      }
    }
  };

  if (!midiSupported) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
        <p className="text-xs text-muted-foreground">
          Web MIDI is not supported in this browser.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <AlertCircle className="w-8 h-8 text-destructive/70 mb-2" />
        <p className="text-xs text-muted-foreground mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={requestMidiAccess}>
          <RefreshCw className="w-3 h-3 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with activity indicator */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground uppercase">
          MIDI Input
        </h3>
        <div className="flex items-center gap-2">
          <span className={cn(
            "w-2 h-2 rounded-full transition-colors",
            midiActivity ? "bg-primary animate-pulse" : "bg-muted-foreground/30"
          )} />
          <span className="text-[10px] text-muted-foreground">
            {midiActivity ? 'Active' : 'Idle'}
          </span>
        </div>
      </div>

      {/* Device list */}
      <div className="space-y-1">
        {inputs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No MIDI devices detected. Connect a device and refresh.
          </p>
        ) : (
          inputs.map((device) => (
            <button
              key={device.id}
              onClick={() => handleSelectInput(device.id)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded text-xs",
                "hover:bg-muted/50 transition-colors text-left",
                selectedInput === device.id && "bg-primary/20 text-primary border border-primary/30"
              )}
            >
              <Music className="w-3.5 h-3.5" />
              <div className="flex-1 min-w-0">
                <div className="truncate">{device.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {device.manufacturer}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Refresh button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs"
        onClick={requestMidiAccess}
      >
        <RefreshCw className="w-3 h-3 mr-1" />
        Refresh Devices
      </Button>

      {/* Info */}
      <div className="pt-3 border-t border-border">
        <p className="text-[10px] text-muted-foreground">
          MIDI Learn and CC mapping coming soon.
        </p>
      </div>
    </div>
  );
};
