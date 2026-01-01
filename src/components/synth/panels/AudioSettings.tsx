import { useState, useEffect } from 'react';
import { Volume2, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AudioSettingsProps {
  bpm?: number;
}

export const AudioSettings = ({ bpm = 120 }: AudioSettingsProps) => {
  const [sampleRate, setSampleRate] = useState('48000');
  const [bufferSize, setBufferSize] = useState('auto');
  const [latency, setLatency] = useState<number | null>(null);
  const [testPlaying, setTestPlaying] = useState(false);

  useEffect(() => {
    // Calculate estimated latency
    const buffer = bufferSize === 'auto' ? 256 : parseInt(bufferSize);
    const rate = parseInt(sampleRate);
    const estimated = (buffer / rate) * 1000 * 2; // Double buffer
    setLatency(Math.round(estimated * 10) / 10);
  }, [sampleRate, bufferSize]);

  const handleTestAudio = async () => {
    if (testPlaying) return;
    
    setTestPlaying(true);
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.frequency.value = 440;
      osc.type = 'sine';
      gain.gain.value = 0.3;
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      
      setTimeout(() => {
        osc.stop();
        ctx.close();
        setTestPlaying(false);
      }, 500);
    } catch (e) {
      setTestPlaying(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sample Rate */}
      <div className="space-y-1.5">
        <label className="text-[10px] text-muted-foreground uppercase">
          Sample Rate
        </label>
        <Select value={sampleRate} onValueChange={setSampleRate}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="44100">44.1 kHz</SelectItem>
            <SelectItem value="48000">48 kHz</SelectItem>
            <SelectItem value="96000">96 kHz</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Buffer Size */}
      <div className="space-y-1.5">
        <label className="text-[10px] text-muted-foreground uppercase">
          Buffer Size
        </label>
        <Select value={bufferSize} onValueChange={setBufferSize}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="128">128 samples</SelectItem>
            <SelectItem value="256">256 samples</SelectItem>
            <SelectItem value="512">512 samples</SelectItem>
            <SelectItem value="1024">1024 samples</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Latency indicator */}
      <div className="space-y-1.5">
        <label className="text-[10px] text-muted-foreground uppercase">
          Estimated Latency
        </label>
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex-1 h-2 bg-muted rounded-full overflow-hidden"
          )}>
            <div 
              className={cn(
                "h-full rounded-full transition-all",
                latency && latency < 10 ? "bg-green-500" :
                latency && latency < 20 ? "bg-yellow-500" : "bg-red-500"
              )}
              style={{ width: `${Math.min((latency || 0) / 50 * 100, 100)}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground min-w-[50px]">
            ~{latency}ms
          </span>
        </div>
      </div>

      {/* BPM (read-only) */}
      <div className="space-y-1.5">
        <label className="text-[10px] text-muted-foreground uppercase">
          Current BPM
        </label>
        <div className="text-sm font-mono">{bpm}</div>
      </div>

      {/* Test button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs"
        onClick={handleTestAudio}
        disabled={testPlaying}
      >
        <Volume2 className={cn("w-3 h-3 mr-1", testPlaying && "animate-pulse")} />
        {testPlaying ? 'Playing...' : 'Test Audio'}
      </Button>

      {/* Info */}
      <div className="pt-3 border-t border-border">
        <div className="flex items-start gap-2 text-[10px] text-muted-foreground">
          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <p>
            Audio settings require engine restart to take effect. Changes will apply on next play.
          </p>
        </div>
      </div>
    </div>
  );
};
