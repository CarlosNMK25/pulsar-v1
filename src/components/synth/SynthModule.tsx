import React from 'react';
import { Waves } from 'lucide-react';
import { ModuleCard } from './ModuleCard';
import { StepSequencer } from './StepSequencer';
import { Knob } from './Knob';
import { cn } from '@/lib/utils';
import { WaveformType } from '@/audio/SynthVoice';

interface Step {
  active: boolean;
  velocity: number;
  probability: number;
}

interface SynthModuleProps {
  currentStep: number;
  steps: Step[];
  onStepsChange: (steps: Step[]) => void;
  params: {
    waveform: WaveformType;
    cutoff: number;
    resonance: number;
    attack: number;
    release: number;
    detune: number;
    lfoRate: number;
  };
  onParamsChange: (params: SynthModuleProps['params']) => void;
  muted: boolean;
  onMuteToggle: () => void;
}

const waveforms: WaveformType[] = ['sine', 'saw', 'square', 'tri'];

export const SynthModule = ({ 
  currentStep, 
  steps,
  onStepsChange,
  params,
  onParamsChange,
  muted,
  onMuteToggle,
}: SynthModuleProps) => {
  const toggleStep = (index: number) => {
    onStepsChange(steps.map((step, i) => 
      i === index ? { ...step, active: !step.active } : step
    ));
  };

  const updateParam = (key: keyof typeof params, value: number | WaveformType) => {
    onParamsChange({ ...params, [key]: value });
  };

  return (
    <ModuleCard
      title="Synth"
      icon={<Waves className="w-4 h-4" />}
      muted={muted}
      onMuteToggle={onMuteToggle}
    >
      <div className="space-y-4">
        {/* Waveform selector */}
        <div className="flex gap-1">
          {waveforms.map((wf) => (
            <button
              key={wf}
              onClick={() => updateParam('waveform', wf)}
              className={cn(
                'flex-1 py-1.5 text-xs uppercase tracking-wider rounded border transition-colors',
                params.waveform === wf
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
            onChange={(v) => updateParam('cutoff', v)}
            label="Cutoff"
            size="sm"
          />
          <Knob
            value={params.resonance}
            onChange={(v) => updateParam('resonance', v)}
            label="Reso"
            size="sm"
            variant="secondary"
          />
          <Knob
            value={params.detune}
            onChange={(v) => updateParam('detune', v)}
            label="Detune"
            size="sm"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Knob
            value={params.attack}
            onChange={(v) => updateParam('attack', v)}
            label="Attack"
            size="sm"
          />
          <Knob
            value={params.release}
            onChange={(v) => updateParam('release', v)}
            label="Release"
            size="sm"
          />
          <Knob
            value={params.lfoRate}
            onChange={(v) => updateParam('lfoRate', v)}
            label="LFO"
            size="sm"
            variant="secondary"
          />
        </div>
      </div>
    </ModuleCard>
  );
};
