import React from 'react';
import { Waves } from 'lucide-react';
import { ModuleCard } from './ModuleCard';
import { StepSequencer } from './StepSequencer';
import { Knob } from './Knob';
import { cn } from '@/lib/utils';
import { WaveformType } from '@/audio/SynthVoice';
import type { PLocks, AcidModifiers, ConditionType } from '@/hooks/useAudioEngine';

interface Step {
  active: boolean;
  velocity: number;
  probability: number;
  pLocks?: PLocks;
  acid?: AcidModifiers;
  condition?: ConditionType;
}

interface SynthModuleProps {
  currentStep: number;
  steps: Step[];
  onStepsChange: (steps: Step[]) => void;
  patternLength: number;
  onLengthChange: (length: number) => void;
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
  swing?: number;
  humanize?: number;
}

const waveforms: WaveformType[] = ['sine', 'saw', 'square', 'tri'];

export const SynthModule = ({ 
  currentStep, 
  steps,
  onStepsChange,
  patternLength,
  onLengthChange,
  params,
  onParamsChange,
  muted,
  onMuteToggle,
  swing = 0,
  humanize = 0,
}: SynthModuleProps) => {
  const toggleStep = (index: number) => {
    onStepsChange(steps.map((step, i) => 
      i === index ? { ...step, active: !step.active } : step
    ));
  };

  const updateParam = (key: keyof typeof params, value: number | WaveformType) => {
    onParamsChange({ ...params, [key]: value });
  };

  const handleStepPLocks = (index: number, pLocks: PLocks | undefined) => {
    onStepsChange(steps.map((step, i) => 
      i === index ? { ...step, pLocks } : step
    ));
  };

  const handleStepAcid = (index: number, acid: AcidModifiers | undefined) => {
    onStepsChange(steps.map((step, i) => 
      i === index ? { ...step, acid } : step
    ));
  };

  const handleStepCondition = (index: number, condition: ConditionType) => {
    onStepsChange(steps.map((step, i) => 
      i === index ? { ...step, condition } : step
    ));
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

        {/* Sequencer with P-Locks, Acid 303, and Conditional Triggers */}
        <StepSequencer
          steps={steps}
          currentStep={currentStep}
          onStepToggle={toggleStep}
          onStepPLocks={handleStepPLocks}
          onStepAcid={handleStepAcid}
          onStepCondition={handleStepCondition}
          onPatternGenerate={onStepsChange}
          showControls={true}
          showLengthSelector={true}
          patternLength={patternLength}
          onLengthChange={onLengthChange}
          showPLocks={true}
          showAcid={true}
          showConditions={true}
          label="Sequence"
          variant="primary"
          swing={swing}
          humanize={humanize}
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
