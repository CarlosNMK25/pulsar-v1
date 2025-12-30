// Euclidean rhythm generator using Bjorklund's algorithm
// https://en.wikipedia.org/wiki/Euclidean_rhythm

export interface EuclideanPattern {
  steps: boolean[];
  pulses: number;
  length: number;
  rotation: number;
}

/**
 * Bjorklund's algorithm for generating Euclidean rhythms
 * Distributes pulses as evenly as possible across the pattern
 */
function bjorklund(pulses: number, steps: number): boolean[] {
  if (pulses >= steps) {
    return Array(steps).fill(true);
  }
  if (pulses === 0) {
    return Array(steps).fill(false);
  }

  let pattern: number[][] = [];
  let remainder: number[][] = [];

  // Initialize groups
  for (let i = 0; i < pulses; i++) {
    pattern.push([1]);
  }
  for (let i = 0; i < steps - pulses; i++) {
    remainder.push([0]);
  }

  // Recursively distribute
  while (remainder.length > 1) {
    const newPattern: number[][] = [];
    const minLen = Math.min(pattern.length, remainder.length);

    for (let i = 0; i < minLen; i++) {
      newPattern.push([...pattern[i], ...remainder[i]]);
    }

    if (pattern.length > remainder.length) {
      remainder = pattern.slice(minLen);
    } else {
      remainder = remainder.slice(minLen);
    }

    pattern = newPattern;
  }

  // Flatten and merge remaining
  const result = [...pattern, ...remainder].flat();
  return result.map(v => v === 1);
}

/**
 * Rotate a pattern by n steps
 */
function rotatePattern(pattern: boolean[], rotation: number): boolean[] {
  if (rotation === 0) return pattern;
  const len = pattern.length;
  const normalizedRotation = ((rotation % len) + len) % len;
  return [...pattern.slice(normalizedRotation), ...pattern.slice(0, normalizedRotation)];
}

/**
 * Generate a Euclidean rhythm pattern
 */
export function generateEuclidean(pulses: number, steps: number, rotation: number = 0): EuclideanPattern {
  const base = bjorklund(pulses, steps);
  const rotated = rotatePattern(base, rotation);
  
  return {
    steps: rotated,
    pulses,
    length: steps,
    rotation,
  };
}

/**
 * Generate a random pattern with a given density (0-1)
 */
export function generateRandom(steps: number, density: number = 0.5): boolean[] {
  return Array(steps).fill(null).map(() => Math.random() < density);
}

/**
 * Mutate an existing pattern by randomly flipping some steps
 */
export function mutatePattern(pattern: boolean[], mutationRate: number = 0.2): boolean[] {
  return pattern.map(step => Math.random() < mutationRate ? !step : step);
}

/**
 * Shift a pattern left or right
 */
export function shiftPattern(pattern: boolean[], amount: number): boolean[] {
  return rotatePattern(pattern, -amount);
}

/**
 * Invert a pattern (on becomes off, off becomes on)
 */
export function invertPattern(pattern: boolean[]): boolean[] {
  return pattern.map(step => !step);
}

/**
 * Common Euclidean rhythm presets
 */
export const euclideanPresets = {
  // Classic patterns
  'son-clave': { pulses: 5, steps: 16, rotation: 0 },      // Cuban son clave
  'rumba-clave': { pulses: 5, steps: 16, rotation: 3 },    // Rumba clave
  'bossa-nova': { pulses: 5, steps: 16, rotation: 5 },     // Bossa nova
  'gahu': { pulses: 4, steps: 12, rotation: 0 },           // Ghanaian Gahu
  'fume-fume': { pulses: 5, steps: 12, rotation: 0 },      // African Fume-Fume
  
  // Electronic music patterns
  '4-on-floor': { pulses: 4, steps: 16, rotation: 0 },     // Classic 4/4
  'offbeat-hat': { pulses: 8, steps: 16, rotation: 1 },    // Offbeat hi-hats
  'dnb-snare': { pulses: 2, steps: 16, rotation: 4 },      // D&B snare pattern
  'idm-sparse': { pulses: 3, steps: 16, rotation: 2 },     // Sparse IDM
  'idm-dense': { pulses: 7, steps: 16, rotation: 1 },      // Dense IDM
  
  // Polyrhythmic
  'triplet': { pulses: 3, steps: 8, rotation: 0 },
  'quintuplet': { pulses: 5, steps: 8, rotation: 0 },
  'septuplet': { pulses: 7, steps: 12, rotation: 0 },
} as const;

export type EuclideanPresetName = keyof typeof euclideanPresets;
