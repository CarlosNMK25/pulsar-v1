// TransientAnalyzer - Detect attack transients in audio for intelligent slicing

export interface TransientDetectionOptions {
  threshold: number;      // 0-1, sensitivity to transients
  minDistance: number;    // Minimum ms between detected transients
  mode: 'peak' | 'rms';   // Detection algorithm
}

export interface TransientResult {
  positions: number[];    // Normalized 0-1 positions
  amplitudes: number[];   // Amplitude at each transient
}

const defaultOptions: TransientDetectionOptions = {
  threshold: 0.3,
  minDistance: 50,
  mode: 'peak',
};

/**
 * Detect transients (attacks) in an AudioBuffer
 * Returns normalized positions (0-1) where transients occur
 */
export function detectTransients(
  buffer: AudioBuffer,
  options: Partial<TransientDetectionOptions> = {}
): TransientResult {
  const opts = { ...defaultOptions, ...options };
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  
  // Window size for analysis (10ms windows)
  const windowSize = Math.floor(sampleRate * 0.01);
  const hopSize = Math.floor(windowSize / 2);
  
  // Calculate envelope based on mode
  const envelope: number[] = [];
  
  for (let i = 0; i < data.length - windowSize; i += hopSize) {
    let value: number;
    
    if (opts.mode === 'rms') {
      // RMS calculation
      let sum = 0;
      for (let j = 0; j < windowSize; j++) {
        sum += data[i + j] * data[i + j];
      }
      value = Math.sqrt(sum / windowSize);
    } else {
      // Peak calculation
      let max = 0;
      for (let j = 0; j < windowSize; j++) {
        max = Math.max(max, Math.abs(data[i + j]));
      }
      value = max;
    }
    
    envelope.push(value);
  }
  
  // Normalize envelope
  const maxEnv = Math.max(...envelope);
  if (maxEnv > 0) {
    for (let i = 0; i < envelope.length; i++) {
      envelope[i] /= maxEnv;
    }
  }
  
  // Detect transients using onset detection (first derivative)
  const positions: number[] = [];
  const amplitudes: number[] = [];
  const minSampleDistance = Math.floor((opts.minDistance / 1000) * sampleRate / hopSize);
  
  let lastTransient = -minSampleDistance;
  
  for (let i = 1; i < envelope.length - 1; i++) {
    // Calculate first derivative (onset strength)
    const diff = envelope[i] - envelope[i - 1];
    
    // Check if it's a local maximum in derivative and above threshold
    const prevDiff = i > 1 ? envelope[i - 1] - envelope[i - 2] : 0;
    const nextDiff = i < envelope.length - 2 ? envelope[i + 1] - envelope[i] : 0;
    
    const isOnset = diff > opts.threshold && 
                    diff > prevDiff && 
                    diff > nextDiff &&
                    (i - lastTransient) >= minSampleDistance;
    
    if (isOnset) {
      const position = (i * hopSize) / data.length;
      positions.push(position);
      amplitudes.push(envelope[i]);
      lastTransient = i;
    }
  }
  
  return { positions, amplitudes };
}

/**
 * Generate evenly-spaced slice points
 */
export function generateEvenSlices(count: number): number[] {
  const positions: number[] = [];
  for (let i = 0; i < count; i++) {
    positions.push(i / count);
  }
  return positions;
}

/**
 * Convert transient positions to slice boundaries
 * Each slice starts at a transient and ends at the next
 */
export function transientsToSlices(
  transients: number[],
  maxSlices: number = 32
): number[] {
  if (transients.length === 0) {
    return generateEvenSlices(8);
  }
  
  // Ensure we start from 0
  let slices = transients[0] > 0.01 ? [0, ...transients] : [...transients];
  
  // Limit to max slices
  if (slices.length > maxSlices) {
    // Downsample by taking every Nth transient
    const step = Math.ceil(slices.length / maxSlices);
    slices = slices.filter((_, i) => i % step === 0);
  }
  
  return slices;
}
