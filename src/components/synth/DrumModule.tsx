import { useCallback } from 'react';
import { Disc3 } from 'lucide-react';
import { ModuleCard } from './ModuleCard';
import { StepSequencer } from './StepSequencer';
import { Knob } from './Knob';

interface Step {
  active: boolean;
  velocity: number;
  probability: number;
}

interface DrumParams {
  pitch: number;
  decay: number;
  drive: number;
  mix: number;
}

interface DrumModuleProps {
  currentStep: number;
  kickSteps: Step[];
  snareSteps: Step[];
  hatSteps: Step[];
  onKickChange: (steps: Step[]) => void;
  onSnareChange: (steps: Step[]) => void;
  onHatChange: (steps: Step[]) => void;
  kickLength: number;
  snareLength: number;
  hatLength: number;
  onKickLengthChange: (length: number) => void;
  onSnareLengthChange: (length: number) => void;
  onHatLengthChange: (length: number) => void;
  params: DrumParams;
  onParamsChange: (params: DrumParams) => void;
  muted: boolean;
  onMuteToggle: () => void;
  swing?: number;
  humanize?: number;
}

export const DrumModule = ({ 
  currentStep, 
  kickSteps, 
  snareSteps, 
  hatSteps,
  onKickChange,
  onSnareChange,
  onHatChange,
  kickLength,
  snareLength,
  hatLength,
  onKickLengthChange,
  onSnareLengthChange,
  onHatLengthChange,
  params,
  onParamsChange,
  muted,
  onMuteToggle,
  swing = 0,
  humanize = 0,
}: DrumModuleProps) => {
  const toggleStep = useCallback((track: 'kick' | 'snare' | 'hat', index: number) => {
    const steps = { kick: kickSteps, snare: snareSteps, hat: hatSteps };
    const setters = { kick: onKickChange, snare: onSnareChange, hat: onHatChange };
    
    setters[track](steps[track].map((step, i) => 
      i === index ? { ...step, active: !step.active } : step
    ));
  }, [kickSteps, snareSteps, hatSteps, onKickChange, onSnareChange, onHatChange]);

  return (
    <ModuleCard
      title="Drums"
      icon={<Disc3 className="w-4 h-4" />}
      muted={muted}
      onMuteToggle={onMuteToggle}
    >
      <div className="space-y-4">
        {/* Sequencers */}
        <div className="space-y-3">
          <StepSequencer
            steps={kickSteps}
            currentStep={currentStep}
            onStepToggle={(i) => toggleStep('kick', i)}
            onPatternGenerate={onKickChange}
            showControls={true}
            showLengthSelector={true}
            patternLength={kickLength}
            onLengthChange={onKickLengthChange}
            label="KICK"
            variant="primary"
            swing={swing}
            humanize={humanize}
          />
          <StepSequencer
            steps={snareSteps}
            currentStep={currentStep}
            onStepToggle={(i) => toggleStep('snare', i)}
            onPatternGenerate={onSnareChange}
            showControls={true}
            showLengthSelector={true}
            patternLength={snareLength}
            onLengthChange={onSnareLengthChange}
            label="SNARE"
            variant="secondary"
            swing={swing}
            humanize={humanize}
          />
          <StepSequencer
            steps={hatSteps}
            currentStep={currentStep}
            onStepToggle={(i) => toggleStep('hat', i)}
            onPatternGenerate={onHatChange}
            showControls={true}
            showLengthSelector={true}
            patternLength={hatLength}
            onLengthChange={onHatLengthChange}
            label="HI-HAT"
            variant="muted"
            swing={swing}
            humanize={humanize}
          />
        </div>

        {/* Parameters */}
        <div className="flex justify-between pt-3 border-t border-border">
          <Knob
            value={params.pitch}
            onChange={(v) => onParamsChange({ ...params, pitch: v })}
            label="Pitch"
            size="sm"
          />
          <Knob
            value={params.decay}
            onChange={(v) => onParamsChange({ ...params, decay: v })}
            label="Decay"
            size="sm"
          />
          <Knob
            value={params.drive}
            onChange={(v) => onParamsChange({ ...params, drive: v })}
            label="Drive"
            size="sm"
            variant="secondary"
          />
          <Knob
            value={params.mix}
            onChange={(v) => onParamsChange({ ...params, mix: v })}
            label="Mix"
            size="sm"
          />
        </div>
      </div>
    </ModuleCard>
  );
};
