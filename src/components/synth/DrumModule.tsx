import { useState } from 'react';
import { Disc3 } from 'lucide-react';
import { ModuleCard } from './ModuleCard';
import { StepSequencer } from './StepSequencer';
import { Knob } from './Knob';

interface DrumModuleProps {
  currentStep: number;
}

const initialKickSteps = Array(16).fill(null).map((_, i) => ({
  active: i % 4 === 0,
  velocity: 100,
  probability: 100,
}));

const initialSnareSteps = Array(16).fill(null).map((_, i) => ({
  active: i % 8 === 4,
  velocity: 90,
  probability: 100,
}));

const initialHatSteps = Array(16).fill(null).map((_, i) => ({
  active: i % 2 === 0,
  velocity: 70 + Math.random() * 30,
  probability: i % 4 === 2 ? 70 : 100,
}));

export const DrumModule = ({ currentStep }: DrumModuleProps) => {
  const [muted, setMuted] = useState(false);
  const [kickSteps, setKickSteps] = useState(initialKickSteps);
  const [snareSteps, setSnareSteps] = useState(initialSnareSteps);
  const [hatSteps, setHatSteps] = useState(initialHatSteps);
  const [params, setParams] = useState({
    pitch: 50,
    decay: 60,
    drive: 30,
    mix: 75,
  });

  const toggleStep = (track: 'kick' | 'snare' | 'hat', index: number) => {
    const setters = { kick: setKickSteps, snare: setSnareSteps, hat: setHatSteps };
    const steps = { kick: kickSteps, snare: snareSteps, hat: hatSteps };
    
    setters[track](steps[track].map((step, i) => 
      i === index ? { ...step, active: !step.active } : step
    ));
  };

  return (
    <ModuleCard
      title="Drums"
      icon={<Disc3 className="w-4 h-4" />}
      muted={muted}
      onMuteToggle={() => setMuted(!muted)}
    >
      <div className="space-y-4">
        {/* Sequencers */}
        <div className="space-y-3">
          <StepSequencer
            steps={kickSteps}
            currentStep={currentStep}
            onStepToggle={(i) => toggleStep('kick', i)}
            label="KICK"
            variant="primary"
          />
          <StepSequencer
            steps={snareSteps}
            currentStep={currentStep}
            onStepToggle={(i) => toggleStep('snare', i)}
            label="SNARE"
            variant="secondary"
          />
          <StepSequencer
            steps={hatSteps}
            currentStep={currentStep}
            onStepToggle={(i) => toggleStep('hat', i)}
            label="HI-HAT"
            variant="muted"
          />
        </div>

        {/* Parameters */}
        <div className="flex justify-between pt-3 border-t border-border">
          <Knob
            value={params.pitch}
            onChange={(v) => setParams({ ...params, pitch: v })}
            label="Pitch"
            size="sm"
          />
          <Knob
            value={params.decay}
            onChange={(v) => setParams({ ...params, decay: v })}
            label="Decay"
            size="sm"
          />
          <Knob
            value={params.drive}
            onChange={(v) => setParams({ ...params, drive: v })}
            label="Drive"
            size="sm"
            variant="secondary"
          />
          <Knob
            value={params.mix}
            onChange={(v) => setParams({ ...params, mix: v })}
            label="Mix"
            size="sm"
          />
        </div>
      </div>
    </ModuleCard>
  );
};
