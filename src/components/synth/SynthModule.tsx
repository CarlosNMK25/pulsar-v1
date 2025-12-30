import { useState } from 'react';
import { Waves } from 'lucide-react';
import { ModuleCard } from './ModuleCard';
import { StepSequencer } from './StepSequencer';
import { Knob } from './Knob';
import { cn } from '@/lib/utils';

interface SynthModuleProps {
  currentStep: number;
}

const waveforms = ['sine', 'saw', 'square', 'tri'] as const;

const initialSteps = Array(16).fill(null).map((_, i) => ({
  active: [0, 3, 6, 8, 10, 12, 14].includes(i),
  velocity: 80 + Math.random() * 20,
  probability: 100,
}));

export const SynthModule = ({ currentStep }: SynthModuleProps) => {
  const [muted, setMuted] = useState(false);
  const [steps, setSteps] = useState(initialSteps);
  const [waveform, setWaveform] = useState<typeof waveforms[number]>('saw');
  const [params, setParams] = useState({
    cutoff: 65,
    resonance: 40,
    attack: 10,
    release: 45,
    detune: 25,
    lfoRate: 30,
  });

  const toggleStep = (index: number) => {
    setSteps(steps.map((step, i) => 
      i === index ? { ...step, active: !step.active } : step
    ));
  };

  return (
    <ModuleCard
      title="Synth"
      icon={<Waves className="w-4 h-4" />}
      muted={muted}
      onMuteToggle={() => setMuted(!muted)}
    >
      <div className="space-y-4">
        {/* Waveform selector */}
        <div className="flex gap-1">
          {waveforms.map((wf) => (
            <button
              key={wf}
              onClick={() => setWaveform(wf)}
              className={cn(
                'flex-1 py-1.5 text-xs uppercase tracking-wider rounded border transition-colors',
                waveform === wf
                  ? 'border-primary bg-primary/20 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {wf}
            </button>
          ))}
        </div>

        {/* Sequencer */}
        <StepSequencer
          steps={steps}
          currentStep={currentStep}
          onStepToggle={toggleStep}
          label="Sequence"
          variant="primary"
        />

        {/* Parameters */}
        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border">
          <Knob
            value={params.cutoff}
            onChange={(v) => setParams({ ...params, cutoff: v })}
            label="Cutoff"
            size="sm"
          />
          <Knob
            value={params.resonance}
            onChange={(v) => setParams({ ...params, resonance: v })}
            label="Reso"
            size="sm"
            variant="secondary"
          />
          <Knob
            value={params.detune}
            onChange={(v) => setParams({ ...params, detune: v })}
            label="Detune"
            size="sm"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Knob
            value={params.attack}
            onChange={(v) => setParams({ ...params, attack: v })}
            label="Attack"
            size="sm"
          />
          <Knob
            value={params.release}
            onChange={(v) => setParams({ ...params, release: v })}
            label="Release"
            size="sm"
          />
          <Knob
            value={params.lfoRate}
            onChange={(v) => setParams({ ...params, lfoRate: v })}
            label="LFO"
            size="sm"
            variant="secondary"
          />
        </div>
      </div>
    </ModuleCard>
  );
};
