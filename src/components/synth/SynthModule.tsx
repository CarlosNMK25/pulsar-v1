import React from 'react';
import { Waves } from 'lucide-react';
import { ModuleCard } from './ModuleCard';
import { StepSequencer } from './StepSequencer';
import { Knob } from './Knob';
import { cn } from '@/lib/utils';
import { WaveformType, LfoSyncDivision } from '@/audio/SynthVoice';
import type { PLocks, AcidModifiers, ConditionType } from '@/hooks/useAudioEngine';
import type { DistortionCurve } from '@/audio/WaveshaperEngine';

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
    lfoSyncDivision: LfoSyncDivision;
    fmAmount: number;
    fmRatio: number;
    drive: number;
    driveType: DistortionCurve;
  };
  onParamsChange: (params: SynthModuleProps['params']) => void;
  muted: boolean;
  onMuteToggle: () => void;
  swing?: number;
  humanize?: number;
}

const waveforms: WaveformType[] = ['sine', 'saw', 'square', 'tri'];
const lfoSyncDivisions: LfoSyncDivision[] = ['free', '1/1', '1/2', '1/4', '1/8', '1/16', '3/16', '5/16'];
const distortionCurves: DistortionCurve[] = ['soft', 'hard', 'tube', 'foldback', 'bitcrush'];

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

  const updateParam = <K extends keyof typeof params>(key: K, value: typeof params[K]) => {
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
        <div className="grid grid-cols-5 gap-2 pt-3 border-t border-border">
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
            value={params.fmAmount}
            onChange={(v) => updateParam('fmAmount', v)}
            label="FM Amt"
            size="sm"
            variant="accent"
          />
          <Knob
            value={params.fmRatio}
            onChange={(v) => updateParam('fmRatio', v)}
            label="FM Ratio"
            size="sm"
            variant="accent"
          />
          <div className="flex flex-col items-center">
            <Knob
              value={params.drive}
              onChange={(v) => updateParam('drive', v)}
              label="Drive"
              size="sm"
              variant="secondary"
            />
            <select
              value={params.driveType}
              onChange={(e) => updateParam('driveType', e.target.value as DistortionCurve)}
              className="w-full text-[9px] bg-surface-sunken border border-border rounded px-0.5 py-0.5 text-center focus:outline-none focus:border-primary mt-1"
              title="Distortion Type"
            >
              {distortionCurves.map((curve) => (
                <option key={curve} value={curve}>
                  {curve.charAt(0).toUpperCase() + curve.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
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
            value={params.detune}
            onChange={(v) => updateParam('detune', v)}
            label="Detune"
            size="sm"
          />
          <div className="flex flex-col items-center gap-1">
            {params.lfoSyncDivision === 'free' ? (
              <Knob
                value={params.lfoRate}
                onChange={(v) => updateParam('lfoRate', v)}
                label="LFO"
                size="sm"
                variant="secondary"
              />
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-secondary/20 border border-secondary/50 flex items-center justify-center">
                  <span className="text-xs font-medium text-secondary">{params.lfoSyncDivision}</span>
                </div>
                <span className="text-[10px] text-muted-foreground mt-1">LFO</span>
              </div>
            )}
            {/* LFO Sync Division Selector */}
            <select
              value={params.lfoSyncDivision}
              onChange={(e) => updateParam('lfoSyncDivision', e.target.value as LfoSyncDivision)}
              className="w-full text-[10px] bg-surface-sunken border border-border rounded px-1 py-0.5 text-center focus:outline-none focus:border-primary"
              title="LFO Sync to BPM"
            >
              {lfoSyncDivisions.map((div) => (
                <option key={div} value={div}>
                  {div === 'free' ? 'Free' : div}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </ModuleCard>
  );
};
