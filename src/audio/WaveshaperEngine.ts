import { audioEngine } from './AudioEngine';

export type DistortionCurve = 'soft' | 'hard' | 'tube' | 'foldback' | 'bitcrush';

export class WaveshaperEngine {
  private waveshaper: WaveShaperNode;
  private inputGain: GainNode;
  private outputGain: GainNode;
  private currentCurve: DistortionCurve = 'soft';
  private driveAmount: number = 0;

  constructor() {
    const ctx = audioEngine.getContext();
    
    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 1;
    
    this.waveshaper = ctx.createWaveShaper();
    this.waveshaper.oversample = '2x';
    
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1;
    
    // Connect chain
    this.inputGain.connect(this.waveshaper);
    this.waveshaper.connect(this.outputGain);
    
    // Initialize with soft curve
    this.setCurve('soft');
  }

  setCurve(type: DistortionCurve): void {
    this.currentCurve = type;
    this.waveshaper.curve = this.generateCurve(type, this.driveAmount) as Float32Array<ArrayBuffer>;
  }

  setDrive(amount: number): void {
    this.driveAmount = Math.max(0, Math.min(100, amount));
    
    // Update input gain (more drive = more saturation)
    const ctx = audioEngine.getContext();
    const inputGainValue = 1 + (this.driveAmount / 100) * 4; // 1x to 5x
    this.inputGain.gain.setTargetAtTime(inputGainValue, ctx.currentTime, 0.01);
    
    // Compensate output to maintain volume
    const outputCompensation = 1 / Math.sqrt(inputGainValue);
    this.outputGain.gain.setTargetAtTime(outputCompensation, ctx.currentTime, 0.01);
    
    // Regenerate curve with new drive
    this.waveshaper.curve = this.generateCurve(this.currentCurve, this.driveAmount) as Float32Array<ArrayBuffer>;
  }

  private generateCurve(type: DistortionCurve, drive: number): Float32Array {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const driveNorm = drive / 100;
    
    for (let i = 0; i < samples; i++) {
      const x = (i * 2 / samples) - 1; // -1 to 1
      
      switch (type) {
        case 'soft':
          // Soft clipping using tanh
          curve[i] = Math.tanh(x * (1 + driveNorm * 3));
          break;
          
        case 'hard':
          // Hard clipping
          const hardThreshold = 1 - driveNorm * 0.5;
          curve[i] = Math.max(-hardThreshold, Math.min(hardThreshold, x * (1 + driveNorm * 2)));
          break;
          
        case 'tube':
          // Asymmetric tube-style saturation (more even harmonics)
          const tubeAmount = 1 + driveNorm * 4;
          if (x >= 0) {
            curve[i] = 1 - Math.exp(-x * tubeAmount);
          } else {
            curve[i] = -1 + Math.exp(x * tubeAmount * 0.8); // Asymmetric for tube warmth
          }
          break;
          
        case 'foldback':
          // Wavefolding - very IDM/experimental
          const foldAmount = 1 + driveNorm * 4;
          curve[i] = Math.sin(x * Math.PI * foldAmount) / (1 + driveNorm);
          break;
          
        case 'bitcrush':
          // Bit reduction style quantization
          const bits = Math.max(2, 16 - Math.floor(driveNorm * 14));
          const levels = Math.pow(2, bits);
          curve[i] = Math.round(x * levels) / levels;
          break;
      }
    }
    
    return curve;
  }

  getCurve(): DistortionCurve {
    return this.currentCurve;
  }

  getDrive(): number {
    return this.driveAmount;
  }

  getInput(): AudioNode {
    return this.inputGain;
  }

  getOutput(): AudioNode {
    return this.outputGain;
  }

  // Bypass by connecting input directly to output
  bypass(bypassed: boolean): void {
    if (bypassed) {
      this.inputGain.disconnect();
      this.inputGain.connect(this.outputGain);
    } else {
      this.inputGain.disconnect();
      this.inputGain.connect(this.waveshaper);
    }
  }

  disconnect(): void {
    this.inputGain.disconnect();
    this.waveshaper.disconnect();
    this.outputGain.disconnect();
  }
}
