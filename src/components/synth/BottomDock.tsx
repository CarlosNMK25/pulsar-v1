import { Keyboard, SlidersHorizontal, Activity, Settings2, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DockState } from '@/hooks/useUILayout';
import { KeyboardTab, KeyboardTarget } from './dock/KeyboardTab';
import { MixerTab } from './dock/MixerTab';
import { ScopeTab } from './dock/ScopeTab';
import { ParamsTab } from './dock/ParamsTab';
import { TrackName, TrackRoutingState, TrackSendLevels } from '@/hooks/useFXState';

interface BottomDockProps {
  state: DockState;
  onStateChange: (state: DockState) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  // Audio data for tabs
  analyserData?: Uint8Array;
  // Keyboard callbacks
  onNoteOn?: (note: number, velocity?: number) => void;
  onNoteOff?: (note: number) => void;
  onDrumTrigger?: (drum: 'kick' | 'snare' | 'hat', velocity?: number) => void;
  onSampleTrigger?: (velocity?: number) => void;
  isAudioReady?: boolean;
  onInitAudio?: () => Promise<void>;
  // Keyboard target and state
  keyboardTarget?: KeyboardTarget;
  onKeyboardTargetChange?: (target: KeyboardTarget) => void;
  keyboardOctave?: number;
  onKeyboardOctaveChange?: (octave: number) => void;
  pressedMidi?: Set<number>;
  pressedDrums?: Set<string>;
  // Mixer data
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
  // Track routing
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

const tabs = [
  { id: 'keys', label: 'Keys', icon: Keyboard },
  { id: 'mixer', label: 'Mixer', icon: SlidersHorizontal },
  { id: 'scope', label: 'Scope', icon: Activity },
  { id: 'params', label: 'Params', icon: Settings2 },
];

const DOCK_HEIGHTS = {
  hidden: 0,
  mini: 48,
  expanded: 320,
};

export const BottomDock = ({
  state,
  onStateChange,
  activeTab,
  onTabChange,
  analyserData,
  onNoteOn,
  onNoteOff,
  onDrumTrigger,
  onSampleTrigger,
  isAudioReady = false,
  onInitAudio,
  keyboardTarget = 'synth',
  onKeyboardTargetChange,
  keyboardOctave = 3,
  onKeyboardOctaveChange,
  pressedMidi,
  pressedDrums,
  drumMuted = false,
  synthMuted = false,
  textureMuted = false,
  sampleMuted = false,
  onDrumMuteToggle,
  onSynthMuteToggle,
  onTextureMuteToggle,
  onSampleMuteToggle,
  volumes,
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
}: BottomDockProps) => {
  const height = DOCK_HEIGHTS[state];
  const isVisible = state !== 'hidden';
  const isExpanded = state === 'expanded';

  const handleToggleExpand = () => {
    onStateChange(isExpanded ? 'mini' : 'expanded');
  };

  const handleClose = () => {
    onStateChange('hidden');
  };

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40",
        "border-t border-border bg-card/95 backdrop-blur-sm",
        "transition-all duration-200 ease-out",
        !isVisible && "translate-y-full"
      )}
      style={{ height: isVisible ? height : 0 }}
    >
      {/* Tab bar - always visible when dock is open */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-border/50">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  onTabChange(tab.id);
                  if (state === 'mini') onStateChange('expanded');
                }}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium",
                  "transition-colors duration-150",
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleExpand}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title={isExpanded ? "Minimize" : "Expand"}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Close dock"
          >
            <span className="text-xs">✕</span>
          </button>
        </div>
      </div>

      {/* Tab content - only visible when expanded */}
      {isExpanded && (
        <div className="h-[calc(100%-48px)] overflow-hidden">
          {activeTab === 'keys' && (
            <KeyboardTab 
              onNoteOn={onNoteOn} 
              onNoteOff={onNoteOff}
              onDrumTrigger={onDrumTrigger}
              onSampleTrigger={onSampleTrigger}
              isAudioReady={isAudioReady}
              onInitAudio={onInitAudio}
              target={keyboardTarget}
              onTargetChange={onKeyboardTargetChange}
              octave={keyboardOctave}
              onOctaveChange={onKeyboardOctaveChange}
              pressedMidi={pressedMidi}
              pressedDrums={pressedDrums}
            />
          )}
          {activeTab === 'mixer' && (
            <MixerTab
              drumMuted={drumMuted}
              synthMuted={synthMuted}
              textureMuted={textureMuted}
              sampleMuted={sampleMuted}
              onDrumMuteToggle={onDrumMuteToggle}
              onSynthMuteToggle={onSynthMuteToggle}
              onTextureMuteToggle={onTextureMuteToggle}
              onSampleMuteToggle={onSampleMuteToggle}
              volumes={volumes}
              onVolumeChange={onVolumeChange}
              trackRouting={trackRouting}
              onRoutingChange={onRoutingChange}
              sendLevels={sendLevels}
              onSendChange={onSendChange}
              masterHighpass={masterHighpass}
              masterLowpass={masterLowpass}
              onMasterHighpassChange={onMasterHighpassChange}
              onMasterLowpassChange={onMasterLowpassChange}
              isPlaying={isPlaying}
            />
          )}
          {activeTab === 'scope' && <ScopeTab analyserData={analyserData} />}
          {activeTab === 'params' && <ParamsTab />}
        </div>
      )}
    </div>
  );
};