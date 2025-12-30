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
  params: DrumParams;
  onParamsChange: (params: DrumParams) => void;
  muted: boolean;
  onMuteToggle: () => void;
}

export const DrumModule = ({ 
  currentStep, 
  kickSteps, 
  snareSteps, 
  hatSteps,
  onKickChange,
  onSnareChange,
  onHatChange,
  params,
  onParamsChange,
  muted,
  onMuteToggle,
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
            label="KICK"
            variant="primary"
          />
          <StepSequencer
            steps={snareSteps}
            currentStep={currentStep}
            onStepToggle={(i) => toggleStep('snare', i)}
            onPatternGenerate={onSnareChange}
            showControls={true}
            label="SNARE"
            variant="secondary"
          />
          <StepSequencer
            steps={hatSteps}
            currentStep={currentStep}
            onStepToggle={(i) => toggleStep('hat', i)}
            onPatternGenerate={onHatChange}
            showControls={true}
            label="HI-HAT"
            variant="muted"
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
