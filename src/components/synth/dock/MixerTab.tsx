import { cn } from '@/lib/utils';
import { Volume2, VolumeX, Sparkles, Waves } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { TrackName, TrackRoutingState, TrackSendLevels } from '@/hooks/useFXState';
import { SendMatrix } from '../SendMatrix';
import { Knob } from '../Knob';
import { useState, useEffect, useRef } from 'react';
import { audioEngine } from '@/audio/AudioEngine';
import { useTrackLevels } from '@/hooks/useTrackLevels';

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
  // Master filter controls
  masterHighpass?: number;
  masterLowpass?: number;
  onMasterHighpassChange?: (value: number) => void;
  onMasterLowpassChange?: (value: number) => void;
  isPlaying?: boolean;
}

// VU Meter component with LED-style segments
const VUMeter = ({ level, isPlaying }: { level: number; isPlaying: boolean }) => {
  // Convert dB to 0-10 segment scale (-60dB to 0dB)
  const normalizedLevel = isPlaying ? Math.max(0, Math.min(10, ((level + 60) / 60) * 10)) : 0;
  const activeSegments = Math.floor(normalizedLevel);
  
  return (
    <div className="flex flex-col-reverse gap-0.5 h-24">
      {Array.from({ length: 10 }).map((_, i) => {
        const isActive = i < activeSegments;
        const segmentIndex = i;
        
        // Color based on segment position
        let bgColor = 'bg-muted/30';
        let glowColor = '';
        if (isActive) {
          if (segmentIndex >= 9) {
            bgColor = 'bg-red-500';
            glowColor = 'shadow-[0_0_6px_hsl(0_84%_60%/0.8)]';
          } else if (segmentIndex >= 7) {
            bgColor = 'bg-orange-500';
            glowColor = 'shadow-[0_0_4px_hsl(25_95%_53%/0.6)]';
          } else if (segmentIndex >= 5) {
            bgColor = 'bg-yellow-500';
            glowColor = 'shadow-[0_0_4px_hsl(45_93%_47%/0.5)]';
          } else {
            bgColor = 'bg-green-500';
            glowColor = 'shadow-[0_0_4px_hsl(142_71%_45%/0.5)]';
          }
        }
        
        return (
          <div
            key={i}
            className={cn(
              "w-1.5 h-2 rounded-[1px] transition-all duration-75",
              bgColor,
              glowColor
            )}
          />
        );
      })}
    </div>
  );
};

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
  peakLevel?: number;
  isPlaying?: boolean;
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
  peakLevel = -Infinity,
  isPlaying = false,
}: ChannelProps) => {
  const volumePercent = volume * 100;
  
  return (
    <div className="flex flex-col items-center gap-2 px-3 py-3">
      {/* Label */}
      <span className="text-[10px] font-semibold text-foreground/80 uppercase tracking-widest">{name}</span>
      
      {/* VU Meter + Fader container */}
      <div className="flex gap-1.5 items-center">
        {/* VU Meter */}
        <VUMeter level={muted ? -Infinity : peakLevel} isPlaying={isPlaying} />
        
        {/* Fader container with glow effect */}
        <div className="relative h-28 w-8 flex items-center justify-center">
        {/* Track background with border */}
        <div className="absolute inset-x-0 top-2 bottom-2 w-2 left-1/2 -translate-x-1/2 bg-background/80 rounded-full border border-primary/30 overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
          {/* Level fill with gradient */}
          <div 
            className="absolute bottom-0 w-full rounded-full transition-all duration-100"
            style={{ 
              height: muted ? '0%' : `${volumePercent}%`, 
              opacity: muted ? 0.3 : 1,
              background: `linear-gradient(to top, hsl(var(--primary) / 0.6), hsl(var(--primary)))`,
              boxShadow: !muted && volumePercent > 0 ? '0 0 8px hsl(var(--primary) / 0.5)' : 'none'
            }}
          />
        </div>
        
          {/* Slider thumb overlay */}
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <Slider
              orientation="vertical"
              value={[volume]}
              min={0}
              max={1}
              step={0.01}
              onValueChange={([val]) => onVolumeChange?.(val)}
              className="h-24"
              disabled={muted}
            />
          </div>
        </div>
      </div>
      
      {/* Volume value with subtle glow */}
      <span className={cn(
        "text-[11px] font-mono tabular-nums transition-colors",
        muted ? "text-muted-foreground/50" : "text-primary"
      )}>
        {Math.round(volumePercent)}
      </span>
      
      {/* Controls row: Routing + Mute */}
      <div className="flex items-center gap-1.5">
        {/* Routing toggles */}
        {showRouting && (
          <>
            <button
              onClick={onFxBypassToggle}
              className={cn(
                "w-7 h-7 rounded-md flex items-center justify-center transition-all border",
                fxBypass 
                  ? "bg-muted/20 text-muted-foreground/40 border-muted/30" 
                  : "bg-primary/10 text-primary border-primary/40 shadow-[0_0_6px_hsl(var(--primary)/0.3)]"
              )}
              title={fxBypass ? "FX bypassed" : "FX active"}
            >
              <Waves className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onGlitchBypassToggle}
              className={cn(
                "w-7 h-7 rounded-md flex items-center justify-center transition-all border",
                glitchBypass 
                  ? "bg-muted/20 text-muted-foreground/40 border-muted/30" 
                  : "bg-accent/10 text-accent border-accent/40 shadow-[0_0_6px_hsl(var(--accent)/0.3)]"
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
              "w-7 h-7 rounded-md flex items-center justify-center transition-all border",
              muted 
                ? "bg-destructive/20 text-destructive border-destructive/50 shadow-[0_0_6px_hsl(var(--destructive)/0.4)]" 
                : "bg-muted/20 text-muted-foreground border-muted/40 hover:border-muted-foreground/50"
            )}
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
};

// Extended Master Channel with filters and metering
interface MasterChannelProps {
  volume: number;
  onVolumeChange?: (value: number) => void;
  highpass: number;
  lowpass: number;
  onHighpassChange?: (value: number) => void;
  onLowpassChange?: (value: number) => void;
  isPlaying?: boolean;
}

const MasterChannel = ({
  volume,
  onVolumeChange,
  highpass,
  lowpass,
  onHighpassChange,
  onLowpassChange,
  isPlaying = false,
}: MasterChannelProps) => {
  const [peakDb, setPeakDb] = useState(-Infinity);
  const [limiterGr, setLimiterGr] = useState(0);
  const [isClipping, setIsClipping] = useState(false);
  const animFrameRef = useRef<number>(0);

  // Animate peak meter and limiter GR
  useEffect(() => {
    if (!isPlaying) {
      setPeakDb(-Infinity);
      setLimiterGr(0);
      setIsClipping(false);
      return;
    }

    const update = () => {
      const peak = audioEngine.getPeakLevel();
      const gr = audioEngine.getLimiterReduction();
      setPeakDb(peak);
      setLimiterGr(gr);
      setIsClipping(peak > -0.5);
      animFrameRef.current = requestAnimationFrame(update);
    };
    update();

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying]);

  // Convert dB to percentage for meter display (-60dB to 0dB range)
  const peakPercent = Math.max(0, Math.min(100, ((peakDb + 60) / 60) * 100));
  
  // Format dB for display
  const formatDb = (db: number) => {
    if (db === -Infinity || db < -60) return '-∞';
    return db.toFixed(1);
  };

  return (
    <div className="flex flex-col items-center gap-1.5 px-3 py-2">
      {/* Label */}
      <span className="text-[10px] font-medium text-foreground uppercase tracking-wider">Master</span>
      
      {/* HPF / LPF Knobs */}
      <div className="flex gap-2 mb-1">
        <div className="flex flex-col items-center">
          <Knob
            label=""
            value={Math.log10(highpass / 20) / Math.log10(100) * 100}
            onChange={(v) => {
              const freq = 20 * Math.pow(100, v / 100);
              onHighpassChange?.(freq);
            }}
            size="sm"
            showValue={false}
          />
          <span className="text-[8px] text-muted-foreground mt-0.5">
            {highpass >= 1000 ? `${(highpass/1000).toFixed(1)}k` : Math.round(highpass)}
          </span>
          <span className="text-[7px] text-muted-foreground/70">HPF</span>
        </div>
        <div className="flex flex-col items-center">
          <Knob
            label=""
            value={Math.log10(lowpass / 200) / Math.log10(100) * 100}
            onChange={(v) => {
              const freq = 200 * Math.pow(100, v / 100);
              onLowpassChange?.(freq);
            }}
            size="sm"
            showValue={false}
          />
          <span className="text-[8px] text-muted-foreground mt-0.5">
            {lowpass >= 1000 ? `${(lowpass/1000).toFixed(1)}k` : Math.round(lowpass)}
          </span>
          <span className="text-[7px] text-muted-foreground/70">LPF</span>
        </div>
      </div>

      {/* Fader + Real Peak Meter */}
      <div className="flex gap-2">
        {/* Volume Fader */}
        <div className="relative h-24 w-6 flex items-center justify-center">
          <div className="absolute inset-0 w-1.5 left-1/2 -translate-x-1/2 bg-muted/50 rounded-full overflow-hidden">
            <div 
              className="absolute bottom-0 w-full rounded-full transition-all duration-75 bg-foreground/70"
              style={{ height: `${volume * 100}%` }}
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Slider
              orientation="vertical"
              value={[volume]}
              min={0}
              max={1}
              step={0.01}
              onValueChange={([val]) => onVolumeChange?.(val)}
              className="h-20"
            />
          </div>
        </div>

        {/* Peak Meter */}
        <div className="flex flex-col items-center gap-1">
          <div className="relative h-24 w-3 bg-muted/30 rounded overflow-hidden">
            {/* Gradient meter */}
            <div 
              className="absolute bottom-0 w-full transition-all duration-75"
              style={{ 
                height: `${peakPercent}%`,
                background: peakPercent > 90 
                  ? 'linear-gradient(to top, hsl(var(--primary)), hsl(var(--destructive)))' 
                  : peakPercent > 70 
                    ? 'linear-gradient(to top, hsl(var(--primary)), hsl(45 100% 50%))' 
                    : 'hsl(var(--primary))'
              }}
            />
            {/* Clip indicator line at top */}
            <div className={cn(
              "absolute top-0 left-0 right-0 h-0.5 transition-colors",
              isClipping ? "bg-destructive animate-pulse" : "bg-muted-foreground/20"
            )} />
          </div>
          
          {/* dB readout */}
          <span className="text-[9px] font-mono text-muted-foreground tabular-nums w-8 text-center">
            {isPlaying ? formatDb(peakDb) : '---'}
          </span>
        </div>
      </div>

      {/* Limiter GR and Clip */}
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-[8px] text-muted-foreground">
          GR: {limiterGr < -0.1 ? limiterGr.toFixed(1) : '0'}
        </span>
        <div className={cn(
          "w-3 h-3 rounded-full transition-colors border border-muted-foreground/30",
          isClipping ? "bg-destructive animate-pulse shadow-[0_0_6px_hsl(var(--destructive))]" : "bg-muted/50"
        )} title="Clip indicator" />
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
  masterHighpass = 20,
  masterLowpass = 20000,
  onMasterHighpassChange,
  onMasterLowpassChange,
  isPlaying = false,
}: MixerTabProps) => {
  // Get real-time track levels
  const trackLevels = useTrackLevels(isPlaying);
  
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
          peakLevel={trackLevels.drums}
          isPlaying={isPlaying}
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
          peakLevel={trackLevels.synth}
          isPlaying={isPlaying}
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
          peakLevel={trackLevels.texture}
          isPlaying={isPlaying}
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
          peakLevel={trackLevels.sample}
          isPlaying={isPlaying}
        />
        <div className="w-px h-44 bg-border/50 mx-2" />
        
        {/* Enhanced Master Channel */}
        <MasterChannel
          volume={volumes.master ?? 0.8}
          onVolumeChange={(v) => onVolumeChange?.('master', v)}
          highpass={masterHighpass}
          lowpass={masterLowpass}
          onHighpassChange={onMasterHighpassChange}
          onLowpassChange={onMasterLowpassChange}
          isPlaying={isPlaying}
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
