import { cn } from '@/lib/utils';
import { Volume2, VolumeX } from 'lucide-react';

interface MixerTabProps {
  drumMuted?: boolean;
  synthMuted?: boolean;
  textureMuted?: boolean;
  sampleMuted?: boolean;
  onDrumMuteToggle?: () => void;
  onSynthMuteToggle?: () => void;
  onTextureMuteToggle?: () => void;
  onSampleMuteToggle?: () => void;
}

interface ChannelProps {
  name: string;
  muted: boolean;
  onMuteToggle?: () => void;
  color: string;
}

const Channel = ({ name, muted, onMuteToggle, color }: ChannelProps) => {
  return (
    <div className="flex flex-col items-center gap-2 px-3">
      {/* Level meter placeholder */}
      <div className="w-2 h-16 bg-muted rounded-full overflow-hidden relative">
        <div 
          className={cn("absolute bottom-0 w-full rounded-full transition-all", color)}
          style={{ height: muted ? '0%' : '60%' }}
        />
      </div>
      
      {/* Mute button */}
      <button
        onClick={onMuteToggle}
        className={cn(
          "p-1.5 rounded transition-colors",
          muted ? "bg-destructive/20 text-destructive" : "bg-muted hover:bg-muted/80 text-foreground"
        )}
      >
        {muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
      </button>
      
      {/* Label */}
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{name}</span>
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
}: MixerTabProps) => {
  return (
    <div className="flex items-center justify-center h-full gap-2 px-4">
      <Channel name="Drum" muted={drumMuted} onMuteToggle={onDrumMuteToggle} color="bg-secondary" />
      <div className="w-px h-20 bg-border" />
      <Channel name="Synth" muted={synthMuted} onMuteToggle={onSynthMuteToggle} color="bg-primary" />
      <div className="w-px h-20 bg-border" />
      <Channel name="Texture" muted={textureMuted} onMuteToggle={onTextureMuteToggle} color="bg-accent-foreground" />
      <div className="w-px h-20 bg-border" />
      <Channel name="Sample" muted={sampleMuted} onMuteToggle={onSampleMuteToggle} color="bg-primary/70" />
      <div className="w-px h-20 bg-border mx-2" />
      <Channel name="FX" muted={false} color="bg-secondary/70" />
      <div className="w-px h-20 bg-border" />
      <Channel name="Master" muted={false} color="bg-foreground" />
    </div>
  );
};
