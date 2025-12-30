// Track configuration for per-track settings
export interface TrackConfig {
  id: string;
  length: number;      // Pattern length (1-32)
  offset: number;      // Step offset (for polyrhythmic patterns)
  muted: boolean;
  solo: boolean;
}

export const DEFAULT_TRACK_LENGTH = 16;
export const MIN_TRACK_LENGTH = 1;
export const MAX_TRACK_LENGTH = 32;

export function createDefaultTrackConfig(id: string): TrackConfig {
  return {
    id,
    length: DEFAULT_TRACK_LENGTH,
    offset: 0,
    muted: false,
    solo: false,
  };
}
