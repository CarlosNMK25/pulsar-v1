/**
 * Time Stretch utility using Granular/WSOLA-like algorithm
 * Adjusts duration without changing pitch
 */

interface TimeStretchOptions {
  grainSize?: number;      // Grain size in samples (default: 2048)
  overlapRatio?: number;   // Overlap between grains (default: 0.5)
}

/**
 * Time stretch an AudioBuffer by a given ratio
 * @param buffer - Source AudioBuffer
 * @param ratio - Stretch ratio (0.5 = half speed, 2.0 = double speed)
 * @param options - Optional grain parameters
 * @returns New AudioBuffer with adjusted duration
 */
export function timeStretch(
  buffer: AudioBuffer,
  ratio: number,
  options: TimeStretchOptions = {}
): AudioBuffer {
  const {
    grainSize = 2048,
    overlapRatio = 0.5,
  } = options;

  // Clamp ratio to reasonable range
  const clampedRatio = Math.max(0.25, Math.min(4, ratio));
  
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const sourceLength = buffer.length;
  const targetLength = Math.round(sourceLength / clampedRatio);
  
  // Create offline context for new buffer
  const ctx = new OfflineAudioContext(numChannels, targetLength, sampleRate);
  const outputBuffer = ctx.createBuffer(numChannels, targetLength, sampleRate);
  
  const hopSize = Math.round(grainSize * (1 - overlapRatio));
  const fadeLength = Math.round(grainSize * overlapRatio);
  
  for (let ch = 0; ch < numChannels; ch++) {
    const sourceData = buffer.getChannelData(ch);
    const outputData = outputBuffer.getChannelData(ch);
    
    // Initialize output to zero
    outputData.fill(0);
    
    let sourcePos = 0;
    let targetPos = 0;
    
    while (targetPos < targetLength && sourcePos < sourceLength - grainSize) {
      // Copy grain with crossfade
      for (let i = 0; i < grainSize; i++) {
        const sourceIdx = Math.floor(sourcePos) + i;
        const targetIdx = targetPos + i;
        
        if (targetIdx >= targetLength || sourceIdx >= sourceLength) break;
        
        // Window function (Hann window for smooth crossfade)
        let windowGain = 1;
        if (i < fadeLength) {
          windowGain = 0.5 * (1 - Math.cos((Math.PI * i) / fadeLength));
        } else if (i >= grainSize - fadeLength) {
          const fadePos = i - (grainSize - fadeLength);
          windowGain = 0.5 * (1 + Math.cos((Math.PI * fadePos) / fadeLength));
        }
        
        outputData[targetIdx] += sourceData[sourceIdx] * windowGain;
      }
      
      // Advance positions
      sourcePos += hopSize * clampedRatio;
      targetPos += hopSize;
    }
    
    // Normalize to prevent clipping from overlap-add
    let maxAmp = 0;
    for (let i = 0; i < targetLength; i++) {
      maxAmp = Math.max(maxAmp, Math.abs(outputData[i]));
    }
    if (maxAmp > 1) {
      for (let i = 0; i < targetLength; i++) {
        outputData[i] /= maxAmp;
      }
    }
  }
  
  return outputBuffer;
}

/**
 * Calculate stretch ratio to match a target BPM
 * @param currentBPM - Current detected or known BPM
 * @param targetBPM - Desired BPM
 * @returns Stretch ratio
 */
export function calculateBPMStretchRatio(currentBPM: number, targetBPM: number): number {
  return currentBPM / targetBPM;
}

/**
 * Estimate BPM from buffer duration (assumes 1, 2, 4, 8, or 16 bars at common tempos)
 * @param buffer - AudioBuffer to analyze
 * @param assumedBars - Number of bars in the sample
 * @param beatsPerBar - Beats per bar (default: 4)
 * @returns Estimated BPM
 */
export function estimateBPMFromDuration(
  buffer: AudioBuffer,
  assumedBars: number = 1,
  beatsPerBar: number = 4
): number {
  const durationSeconds = buffer.length / buffer.sampleRate;
  const totalBeats = assumedBars * beatsPerBar;
  const bpm = (totalBeats / durationSeconds) * 60;
  return Math.round(bpm * 10) / 10; // Round to 1 decimal
}
