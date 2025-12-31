import { useCallback, useRef } from 'react';
import { Disc3, Upload, X } from 'lucide-react';
import { ModuleCard } from './ModuleCard';
import { StepSequencer } from './StepSequencer';
import { Knob } from './Knob';
import { Button } from '@/components/ui/button';
import { decodeAudioFile, validateAudioFile } from '@/utils/audioDecoder';
import { toast } from 'sonner';
import type { ConditionType } from '@/hooks/useAudioEngine';
import type { DistortionCurve } from '@/audio/WaveshaperEngine';

interface Step {
  active: boolean;
  velocity: number;
  probability: number;
  condition?: ConditionType;
}

interface DrumParams {
  pitch: number;
  decay: number;
  drive: number;
  driveType: DistortionCurve;
  mix: number;
}

const distortionCurves: DistortionCurve[] = ['soft', 'hard', 'tube', 'foldback', 'bitcrush'];

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
  loadedSamples?: { kick: boolean; snare: boolean; hat: boolean };
  onLoadSample?: (drumType: 'kick' | 'snare' | 'hat', buffer: AudioBuffer) => void;
  onClearSample?: (drumType: 'kick' | 'snare' | 'hat') => void;
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
  loadedSamples = { kick: false, snare: false, hat: false },
  onLoadSample,
  onClearSample,
}: DrumModuleProps) => {
  const kickInputRef = useRef<HTMLInputElement>(null);
  const snareInputRef = useRef<HTMLInputElement>(null);
  const hatInputRef = useRef<HTMLInputElement>(null);
  const toggleStep = useCallback((track: 'kick' | 'snare' | 'hat', index: number) => {
    const steps = { kick: kickSteps, snare: snareSteps, hat: hatSteps };
    const setters = { kick: onKickChange, snare: onSnareChange, hat: onHatChange };
    
    setters[track](steps[track].map((step, i) => 
      i === index ? { ...step, active: !step.active } : step
    ));
  }, [kickSteps, snareSteps, hatSteps, onKickChange, onSnareChange, onHatChange]);

  const handleKickCondition = useCallback((index: number, condition: ConditionType) => {
    onKickChange(kickSteps.map((step, i) => 
      i === index ? { ...step, condition } : step
    ));
  }, [kickSteps, onKickChange]);

  const handleSnareCondition = useCallback((index: number, condition: ConditionType) => {
    onSnareChange(snareSteps.map((step, i) => 
      i === index ? { ...step, condition } : step
    ));
  }, [snareSteps, onSnareChange]);

  const handleHatCondition = useCallback((index: number, condition: ConditionType) => {
    onHatChange(hatSteps.map((step, i) => 
      i === index ? { ...step, condition } : step
    ));
  }, [hatSteps, onHatChange]);

  const handleFileSelect = useCallback(async (drumType: 'kick' | 'snare' | 'hat', file: File) => {
    const validation = validateAudioFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    try {
      const audioBuffer = await decodeAudioFile(file);
      onLoadSample?.(drumType, audioBuffer);
      toast.success(`${drumType.toUpperCase()} sample loaded`);
    } catch (error) {
      toast.error('Failed to decode audio file');
      console.error(error);
    }
  }, [onLoadSample]);

  const handleInputChange = useCallback((drumType: 'kick' | 'snare' | 'hat') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(drumType, file);
    }
    e.target.value = '';
  }, [handleFileSelect]);

  const inputRefs = { kick: kickInputRef, snare: snareInputRef, hat: hatInputRef };

  const renderSampleButton = (drumType: 'kick' | 'snare' | 'hat') => (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-5 w-5 p-0"
        onClick={() => inputRefs[drumType].current?.click()}
        title={`Load ${drumType} sample`}
      >
        <Upload className="w-2.5 h-2.5" />
      </Button>
      {loadedSamples[drumType] && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 text-destructive"
          onClick={() => onClearSample?.(drumType)}
          title={`Clear ${drumType} sample`}
        >
          <X className="w-2.5 h-2.5" />
        </Button>
      )}
    </div>
  );

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
            showConditions={true}
            onStepCondition={handleKickCondition}
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
            showConditions={true}
            onStepCondition={handleSnareCondition}
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
            showConditions={true}
            onStepCondition={handleHatCondition}
          />
        </div>

        {/* Hidden file inputs */}
        <input ref={kickInputRef} type="file" accept=".wav,.mp3,.ogg" className="hidden" onChange={handleInputChange('kick')} />
        <input ref={snareInputRef} type="file" accept=".wav,.mp3,.ogg" className="hidden" onChange={handleInputChange('snare')} />
        <input ref={hatInputRef} type="file" accept=".wav,.mp3,.ogg" className="hidden" onChange={handleInputChange('hat')} />

        {/* Parameters */}
        <div className="grid grid-cols-5 gap-2 pt-3 border-t border-border">
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
          <div className="flex flex-col items-center">
            <Knob
              value={params.drive}
              onChange={(v) => onParamsChange({ ...params, drive: v })}
              label="Drive"
              size="sm"
              variant="secondary"
            />
            <select
              value={params.driveType}
              onChange={(e) => onParamsChange({ ...params, driveType: e.target.value as DistortionCurve })}
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
