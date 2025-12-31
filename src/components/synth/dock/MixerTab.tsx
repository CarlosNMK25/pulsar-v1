import { cn } from '@/lib/utils';
import { Volume2, VolumeX } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface MixerTabProps {
  drumMuted?: boolean;
  synthMuted?: boolean;
  textureMuted?: boolean;
  sampleMuted?: boolean;
  onDrumMuteToggle?: () => void;
  onSynthMuteToggle?: () => void;
  onTextureMuteToggle?: () => void;
  onSampleMuteToggle?: () => void;
  volumes?: Record<string, number>;
  onVolumeChange?: (channel: string, value: number) => void;
}

interface ChannelProps {
  name: string;
  channelId: string;
  muted: boolean;
  volume: number;
  onMuteToggle?: () => void;
  onVolumeChange?: (value: number) => void;
  color: string;
}

const Channel = ({ name, channelId, muted, volume, onMuteToggle, onVolumeChange, color }: ChannelProps) => {
  return (
    <div className="flex flex-col items-center gap-1.5 px-2">
      {/* Vertical fader container */}
      <div className="relative h-16 w-6 flex items-center justify-center">
        {/* Level meter background */}
        <div className="absolute inset-0 w-1.5 left-1/2 -translate-x-1/2 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn("absolute bottom-0 w-full rounded-full transition-all", color)}
            style={{ height: muted ? '0%' : `${volume * 100}%` }}
          />
        </div>
        
        {/* Slider - rotated vertical */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Slider
            orientation="vertical"
            value={[volume]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={([val]) => onVolumeChange?.(val)}
            className="h-14"
            disabled={muted}
          />
        </div>
      </div>
      
      {/* Volume value */}
      <span className="text-[9px] text-muted-foreground tabular-nums">
        {Math.round(volume * 100)}
      </span>
      
      {/* Mute button */}
      <button
        onClick={onMuteToggle}
        className={cn(
          "p-1 rounded transition-colors",
          muted ? "bg-destructive/20 text-destructive" : "bg-muted hover:bg-muted/80 text-foreground"
        )}
      >
        {muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
      </button>
      
      {/* Label */}
      <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{name}</span>
    </div>
  );
};

export const MixerTab = ({
  drumMuted = false,
  synthMuted = false,
  textureMuted = false,
  sampleMuted = false,
  onDrumMuteToggle,
  onSynthMuteToggle,
  onTextureMuteToggle,
  onSampleMuteToggle,
  volumes = { drum: 0.8, synth: 0.8, texture: 0.8, sample: 0.8, master: 0.8 },
  onVolumeChange,
}: MixerTabProps) => {
  return (
    <div className="flex items-center justify-center h-full gap-1 px-4">
      <Channel 
        name="Drum" 
        channelId="drum"
        muted={drumMuted} 
        volume={volumes.drum ?? 0.8}
        onMuteToggle={onDrumMuteToggle} 
        onVolumeChange={(v) => onVolumeChange?.('drum', v)}
        color="bg-secondary" 
      />
      <div className="w-px h-20 bg-border" />
      <Channel 
        name="Synth" 
        channelId="synth"
        muted={synthMuted} 
        volume={volumes.synth ?? 0.8}
        onMuteToggle={onSynthMuteToggle} 
        onVolumeChange={(v) => onVolumeChange?.('synth', v)}
        color="bg-primary" 
      />
      <div className="w-px h-20 bg-border" />
      <Channel 
        name="Texture" 
        channelId="texture"
        muted={textureMuted} 
        volume={volumes.texture ?? 0.8}
        onMuteToggle={onTextureMuteToggle} 
        onVolumeChange={(v) => onVolumeChange?.('texture', v)}
        color="bg-accent-foreground" 
      />
      <div className="w-px h-20 bg-border" />
      <Channel 
        name="Sample" 
        channelId="sample"
        muted={sampleMuted} 
        volume={volumes.sample ?? 0.8}
        onMuteToggle={onSampleMuteToggle} 
        onVolumeChange={(v) => onVolumeChange?.('sample', v)}
        color="bg-primary/70" 
      />
      <div className="w-px h-20 bg-border mx-1" />
      <Channel 
        name="Master" 
        channelId="master"
        muted={false} 
        volume={volumes.master ?? 0.8}
        onVolumeChange={(v) => onVolumeChange?.('master', v)}
        color="bg-foreground" 
      />
    </div>
  );
};
