// Precise lookahead scheduler using AudioContext timing
import { audioEngine } from './AudioEngine';
import { DEFAULT_TRACK_LENGTH } from './TrackConfig';

export type StepCallback = (step: number, time: number, trackSteps?: Map<string, number>) => void;

export type BarCallback = (bar: number) => void;

export class Scheduler {
  private static instance: Scheduler;
  
  private bpm = 120;
  private swing = 0; // 0-1, where 0.5 is 50% swing
  private humanize = 0; // 0-1, amount of random timing offset
  private isRunning = false;
  private currentStep = 0;
  private nextStepTime = 0;
  
  // Per-track step counters and lengths
  private trackLengths: Map<string, number> = new Map();
  private trackSteps: Map<string, number> = new Map();
  
  // Bar tracking for pattern chaining
  private barCount = 0;
  private stepsPerBar = 16;
  private barCallbacks: Set<BarCallback> = new Set();
  
  // Timing constants
  private readonly lookahead = 0.025; // 25ms lookahead
  private readonly scheduleAheadTime = 0.1; // 100ms ahead scheduling
  private timerInterval: number | null = null;
  
  private stepCallbacks: Set<StepCallback> = new Set();

  private constructor() {}

  static getInstance(): Scheduler {
    if (!Scheduler.instance) {
      Scheduler.instance = new Scheduler();
    }
    return Scheduler.instance;
  }

  setBpm(bpm: number): void {
    this.bpm = Math.max(20, Math.min(300, bpm));
  }

  getBpm(): number {
    return this.bpm;
  }

  setSwing(amount: number): void {
    this.swing = Math.max(0, Math.min(1, amount));
  }

  getSwing(): number {
    return this.swing;
  }
  
  setHumanize(amount: number): void {
    this.humanize = Math.max(0, Math.min(1, amount));
  }
  
  getHumanize(): number {
    return this.humanize;
  }

  getCurrentStep(): number {
    return this.currentStep;
  }

  // Per-track length management
  setTrackLength(trackId: string, length: number): void {
    const clampedLength = Math.max(1, Math.min(32, length));
    this.trackLengths.set(trackId, clampedLength);
    // Initialize track step if not exists
    if (!this.trackSteps.has(trackId)) {
      this.trackSteps.set(trackId, 0);
    }
  }

  getTrackLength(trackId: string): number {
    return this.trackLengths.get(trackId) || DEFAULT_TRACK_LENGTH;
  }

  getTrackStep(trackId: string): number {
    const trackStep = this.trackSteps.get(trackId);
    if (trackStep !== undefined) {
      return trackStep;
    }
    // Fallback to global step modulo track length
    const length = this.getTrackLength(trackId);
    return this.currentStep % length;
  }

  getAllTrackSteps(): Map<string, number> {
    return new Map(this.trackSteps);
  }

  onStep(callback: StepCallback): () => void {
    this.stepCallbacks.add(callback);
    return () => this.stepCallbacks.delete(callback);
  }

  // Bar callback for pattern chaining
  onBar(callback: BarCallback): () => void {
    this.barCallbacks.add(callback);
    return () => this.barCallbacks.delete(callback);
  }

  getBarCount(): number {
    return this.barCount;
  }

  setStepsPerBar(steps: number): void {
    this.stepsPerBar = Math.max(4, Math.min(32, steps));
  }

  getStepsPerBar(): number {
    return this.stepsPerBar;
  }

  private get stepDuration(): number {
    // 16th note duration in seconds
    return 60 / this.bpm / 4;
  }

  private getHumanizeOffset(): number {
    if (this.humanize <= 0) return 0;
    // Random offset up to ±20ms based on humanize amount
    const maxOffset = 0.02 * this.humanize;
    return (Math.random() - 0.5) * 2 * maxOffset;
  }

  private getSwingOffset(step: number): number {
    // Apply swing to off-beat steps (odd steps in 16th note grid)
    if (step % 2 === 1 && this.swing > 0) {
      return this.stepDuration * this.swing * 0.5;
    }
    return 0;
  }

  private scheduleStep(step: number, time: number): void {
    // Update per-track steps before notifying callbacks
    const trackSteps = new Map(this.trackSteps);
    
    // Notify all callbacks with precise timing and track steps
    this.stepCallbacks.forEach(callback => {
      try {
        callback(step, time, trackSteps);
      } catch (e) {
        console.error('[Scheduler] Callback error:', e);
      }
    });
  }

  private advanceTrackSteps(): void {
    // Advance each track's step counter according to its length
    this.trackLengths.forEach((length, trackId) => {
      const currentTrackStep = this.trackSteps.get(trackId) || 0;
      this.trackSteps.set(trackId, (currentTrackStep + 1) % length);
    });
  }

  private notifyBarCallbacks(): void {
    this.barCallbacks.forEach(callback => {
      try {
        callback(this.barCount);
      } catch (e) {
        console.error('[Scheduler] Bar callback error:', e);
      }
    });
  }

  private scheduler(): void {
    const ctx = audioEngine.getContext();
    
    // Schedule all steps that fall within the lookahead window
    while (this.nextStepTime < ctx.currentTime + this.scheduleAheadTime) {
      const swingOffset = this.getSwingOffset(this.currentStep);
      const humanizeOffset = this.getHumanizeOffset();
      const scheduledTime = this.nextStepTime + swingOffset + humanizeOffset;
      
      this.scheduleStep(this.currentStep, scheduledTime);
      
      // Advance global and per-track steps
      this.nextStepTime += this.stepDuration;
      const prevStep = this.currentStep;
      this.currentStep = (this.currentStep + 1) % 16;
      this.advanceTrackSteps();
      
      // Check for bar completion (when step wraps from stepsPerBar-1 to 0)
      if (prevStep === this.stepsPerBar - 1 && this.currentStep === 0) {
        this.barCount++;
        this.notifyBarCallbacks();
      }
    }
  }

  start(): void {
    if (this.isRunning) return;
    
    const ctx = audioEngine.getContext();
    this.currentStep = 0;
    this.barCount = 0;
    this.nextStepTime = ctx.currentTime + 0.05; // Small delay for smooth start
    this.isRunning = true;
    
    // Reset all track steps to 0
    this.trackSteps.forEach((_, trackId) => {
      this.trackSteps.set(trackId, 0);
    });
    
    // Use setInterval as fallback (Web Workers would be better for production)
    // The key is that we're using AudioContext.currentTime for precise scheduling
    this.timerInterval = window.setInterval(() => {
      this.scheduler();
    }, this.lookahead * 1000);
    
    console.log('[Scheduler] Started at BPM:', this.bpm);
  }

  stop(): void {
    if (!this.isRunning) return;
    
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    
    this.isRunning = false;
    this.currentStep = 0;
    this.barCount = 0;
    
    // Reset all track steps
    this.trackSteps.forEach((_, trackId) => {
      this.trackSteps.set(trackId, 0);
    });
    
    console.log('[Scheduler] Stopped');
  }

  pause(): void {
    if (!this.isRunning) return;
    
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    
    this.isRunning = false;
    console.log('[Scheduler] Paused at step:', this.currentStep);
  }

  resume(): void {
    if (this.isRunning) return;
    
    const ctx = audioEngine.getContext();
    this.nextStepTime = ctx.currentTime + 0.05;
    this.isRunning = true;
    
    this.timerInterval = window.setInterval(() => {
      this.scheduler();
    }, this.lookahead * 1000);
    
    console.log('[Scheduler] Resumed from step:', this.currentStep);
  }

  isPlaying(): boolean {
    return this.isRunning;
  }
}

export const scheduler = Scheduler.getInstance();
