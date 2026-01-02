/**
 * Pitch Shift utility using resample + time stretch technique
 * Changes pitch without (significantly) changing duration
 */

import { timeStretch } from './timeStretch';

/**
 * Convert semitones to pitch ratio
 * @param semitones - Number of semitones (+12 = 1 octave up, -12 = 1 octave down)
 * @returns Pitch ratio
 */
export function semitonesToRatio(semitones: number): number {
  return Math.pow(2, semitones / 12);
}

/**
 * Convert cents to pitch ratio
 * @param cents - Cents adjustment (-100 to +100 for semitone range)
 * @returns Pitch ratio multiplier
 */
export function centsToRatio(cents: number): number {
  return Math.pow(2, cents / 1200);
}

/**
 * Pitch shift an AudioBuffer by semitones and cents
 * Algorithm: Resample to change pitch, then time stretch to restore duration
 * 
 * @param buffer - Source AudioBuffer
 * @param semitones - Semitone shift (-24 to +24)
 * @param cents - Fine tune in cents (-100 to +100)
 * @returns Promise<AudioBuffer> with pitch-shifted audio
 */
export async function pitchShift(
  buffer: AudioBuffer,
  semitones: number,
  cents: number = 0
): Promise<AudioBuffer> {
  // Calculate total pitch ratio
  const pitchRatio = semitonesToRatio(semitones) * centsToRatio(cents);
  
  if (Math.abs(pitchRatio - 1) < 0.001) {
    // No significant change, return copy
    const ctx = new OfflineAudioContext(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );
    const copy = ctx.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      copy.getChannelData(ch).set(buffer.getChannelData(ch));
    }
    return copy;
  }
  
  // Step 1: Resample to change pitch
  // Higher pitch = higher sample rate interpretation = shorter playback
  const resampledRate = Math.round(buffer.sampleRate * pitchRatio);
  const resampledLength = Math.round(buffer.length / pitchRatio);
  
  // Create resampled buffer using OfflineAudioContext
  const resampleCtx = new OfflineAudioContext(
    buffer.numberOfChannels,
    resampledLength,
    resampledRate
  );
  
  const source = resampleCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(resampleCtx.destination);
  source.start(0);
  
  const resampledBuffer = await resampleCtx.startRendering();
  
  // Step 2: Time stretch to restore original duration
  // Since resampling changed the duration, we need to stretch it back
  const stretchRatio = pitchRatio; // Stretch by inverse of pitch change
  const stretchedBuffer = timeStretch(resampledBuffer, stretchRatio);
  
  // Step 3: Resample back to original sample rate if needed
  if (resampledRate !== buffer.sampleRate) {
    const finalCtx = new OfflineAudioContext(
      stretchedBuffer.numberOfChannels,
      Math.round(stretchedBuffer.length * (buffer.sampleRate / resampledRate)),
      buffer.sampleRate
    );
    
    const finalSource = finalCtx.createBufferSource();
    finalSource.buffer = stretchedBuffer;
    finalSource.connect(finalCtx.destination);
    finalSource.start(0);
    
    return finalCtx.startRendering();
  }
  
  return stretchedBuffer;
}

/**
 * Quick pitch shift by semitones only
 */
export async function pitchShiftSemitones(
  buffer: AudioBuffer,
  semitones: number
): Promise<AudioBuffer> {
  return pitchShift(buffer, semitones, 0);
}
