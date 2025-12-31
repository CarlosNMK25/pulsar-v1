import { cn } from '@/lib/utils';
import { Volume2, VolumeX, Sparkles, Waves } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { TrackName, TrackRoutingState, TrackSendLevels } from '@/hooks/useFXState';
import { SendMatrix } from '../SendMatrix';

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
  trackRouting?: TrackRoutingState;
  onRoutingChange?: (track: TrackName, routing: { fxBypass?: boolean; glitchBypass?: boolean }) => void;
  // Send levels
  sendLevels?: TrackSendLevels;
  onSendChange?: (track: TrackName, effect: 'reverb' | 'delay', value: number) => void;
}

interface ChannelProps {
  name: string;
  channelId: string;
  muted: boolean;
  volume: number;
  onMuteToggle?: () => void;
  onVolumeChange?: (value: number) => void;
  color: string;
  fxBypass?: boolean;
  glitchBypass?: boolean;
  onFxBypassToggle?: () => void;
  onGlitchBypassToggle?: () => void;
  showRouting?: boolean;
}

const Channel = ({ 
  name, 
  channelId, 
  muted, 
  volume, 
  onMuteToggle, 
  onVolumeChange, 
  color,
  fxBypass = false,
  glitchBypass = false,
  onFxBypassToggle,
  onGlitchBypassToggle,
  showRouting = false,
}: ChannelProps) => {
  return (
    <div className="flex flex-col items-center gap-1.5 px-3 py-2">
      {/* Label */}
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{name}</span>
      
      {/* Fader + Meter container */}
      <div className="relative h-32 w-6 flex items-center justify-center">
        {/* Level meter background */}
        <div className="absolute inset-0 w-1.5 left-1/2 -translate-x-1/2 bg-muted/50 rounded-full overflow-hidden">
          <div 
            className={cn("absolute bottom-0 w-full rounded-full transition-all duration-75", color)}
            style={{ height: muted ? '0%' : `${volume * 100}%`, opacity: muted ? 0.3 : 1 }}
          />
        </div>
        
        {/* Slider */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Slider
            orientation="vertical"
            value={[volume]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={([val]) => onVolumeChange?.(val)}
            className="h-28"
            disabled={muted}
          />
        </div>
      </div>
      
      {/* Volume value */}
      <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
        {Math.round(volume * 100)}
      </span>
      
      {/* Controls row: Routing + Mute */}
      <div className="flex items-center gap-1">
        {/* Routing toggles */}
        {showRouting && (
          <>
            <button
              onClick={onFxBypassToggle}
              className={cn(
                "w-6 h-6 rounded flex items-center justify-center transition-colors",
                fxBypass 
                  ? "bg-muted/30 text-muted-foreground/50" 
                  : "bg-primary/10 text-primary"
              )}
              title={fxBypass ? "FX bypassed" : "FX active"}
            >
              <Waves className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onGlitchBypassToggle}
              className={cn(
                "w-6 h-6 rounded flex items-center justify-center transition-colors",
                glitchBypass 
                  ? "bg-muted/30 text-muted-foreground/50" 
                  : "bg-primary/10 text-primary"
              )}
              title={glitchBypass ? "Glitch bypassed" : "Glitch active"}
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        
        {/* Mute button */}
        {onMuteToggle && (
          <button
            onClick={onMuteToggle}
            className={cn(
              "w-6 h-6 rounded flex items-center justify-center transition-colors",
              muted 
                ? "bg-destructive/20 text-destructive" 
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            )}
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
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
  trackRouting,
  onRoutingChange,
  sendLevels,
  onSendChange,
}: MixerTabProps) => {
  return (
    <div className="flex items-center justify-center h-full gap-2 px-4">
      {/* Channel strips */}
      <div className="flex items-center gap-0.5">
        <Channel 
          name="Drum" 
          channelId="drum"
          muted={drumMuted} 
          volume={volumes.drum ?? 0.8}
          onMuteToggle={onDrumMuteToggle} 
          onVolumeChange={(v) => onVolumeChange?.('drum', v)}
          color="bg-secondary"
          fxBypass={trackRouting?.drums.fxBypass}
          glitchBypass={trackRouting?.drums.glitchBypass}
          onFxBypassToggle={() => onRoutingChange?.('drums', { fxBypass: !trackRouting?.drums.fxBypass })}
          onGlitchBypassToggle={() => onRoutingChange?.('drums', { glitchBypass: !trackRouting?.drums.glitchBypass })}
          showRouting={!!trackRouting}
        />
        <div className="w-px h-44 bg-border/30" />
        <Channel 
          name="Synth" 
          channelId="synth"
          muted={synthMuted} 
          volume={volumes.synth ?? 0.8}
          onMuteToggle={onSynthMuteToggle} 
          onVolumeChange={(v) => onVolumeChange?.('synth', v)}
          color="bg-primary"
          fxBypass={trackRouting?.synth.fxBypass}
          glitchBypass={trackRouting?.synth.glitchBypass}
          onFxBypassToggle={() => onRoutingChange?.('synth', { fxBypass: !trackRouting?.synth.fxBypass })}
          onGlitchBypassToggle={() => onRoutingChange?.('synth', { glitchBypass: !trackRouting?.synth.glitchBypass })}
          showRouting={!!trackRouting}
        />
        <div className="w-px h-44 bg-border/30" />
        <Channel 
          name="Texture" 
          channelId="texture"
          muted={textureMuted} 
          volume={volumes.texture ?? 0.8}
          onMuteToggle={onTextureMuteToggle} 
          onVolumeChange={(v) => onVolumeChange?.('texture', v)}
          color="bg-accent-foreground"
          fxBypass={trackRouting?.texture.fxBypass}
          glitchBypass={trackRouting?.texture.glitchBypass}
          onFxBypassToggle={() => onRoutingChange?.('texture', { fxBypass: !trackRouting?.texture.fxBypass })}
          onGlitchBypassToggle={() => onRoutingChange?.('texture', { glitchBypass: !trackRouting?.texture.glitchBypass })}
          showRouting={!!trackRouting}
        />
        <div className="w-px h-44 bg-border/30" />
        <Channel 
          name="Sample" 
          channelId="sample"
          muted={sampleMuted} 
          volume={volumes.sample ?? 0.8}
          onMuteToggle={onSampleMuteToggle} 
          onVolumeChange={(v) => onVolumeChange?.('sample', v)}
          color="bg-primary/70"
          fxBypass={trackRouting?.sample.fxBypass}
          glitchBypass={trackRouting?.sample.glitchBypass}
          onFxBypassToggle={() => onRoutingChange?.('sample', { fxBypass: !trackRouting?.sample.fxBypass })}
          onGlitchBypassToggle={() => onRoutingChange?.('sample', { glitchBypass: !trackRouting?.sample.glitchBypass })}
          showRouting={!!trackRouting}
        />
        <div className="w-px h-44 bg-border/50 mx-2" />
        <Channel 
          name="Master" 
          channelId="master"
          muted={false} 
          volume={volumes.master ?? 0.8}
          onVolumeChange={(v) => onVolumeChange?.('master', v)}
          color="bg-foreground/70"
          showRouting={false}
        />
      </div>

      {/* Send Matrix */}
      {sendLevels && onSendChange && (
        <>
          <div className="w-px h-32 bg-border/50" />
          <div className="flex flex-col justify-center h-full py-4">
            <SendMatrix 
              sendLevels={sendLevels} 
              onSendChange={onSendChange} 
            />
          </div>
        </>
      )}
    </div>
  );
};
