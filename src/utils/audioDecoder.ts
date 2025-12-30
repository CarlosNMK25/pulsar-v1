// Audio file decoder utility

import { audioEngine } from '@/audio/AudioEngine';

const MAX_DURATION = 30; // Maximum 30 seconds to prevent memory issues
const SUPPORTED_TYPES = ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/flac', 'audio/mp3'];

export interface AudioFileValidation {
  valid: boolean;
  error?: string;
}

export function validateAudioFile(file: File): AudioFileValidation {
  // Check file type
  const isValidType = SUPPORTED_TYPES.some(type => 
    file.type === type || file.name.toLowerCase().endsWith('.wav') || 
    file.name.toLowerCase().endsWith('.mp3') || 
    file.name.toLowerCase().endsWith('.ogg')
  );
  
  if (!isValidType) {
    return { valid: false, error: 'Unsupported file type. Use WAV, MP3, OGG, or FLAC.' };
  }
  
  // Check file size (max 50MB)
  if (file.size > 50 * 1024 * 1024) {
    return { valid: false, error: 'File too large. Maximum size is 50MB.' };
  }
  
  return { valid: true };
}

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const validation = validateAudioFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  const arrayBuffer = await file.arrayBuffer();
  const ctx = audioEngine.getContext();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  
  // Trim to max duration if needed
  if (audioBuffer.duration > MAX_DURATION) {
    return trimAudioBuffer(audioBuffer, MAX_DURATION);
  }
  
  return audioBuffer;
}

export function trimAudioBuffer(buffer: AudioBuffer, maxDuration: number): AudioBuffer {
  const ctx = audioEngine.getContext();
  const sampleRate = buffer.sampleRate;
  const maxSamples = Math.floor(maxDuration * sampleRate);
  const channels = buffer.numberOfChannels;
  
  const trimmedBuffer = ctx.createBuffer(channels, maxSamples, sampleRate);
  
  for (let ch = 0; ch < channels; ch++) {
    const source = buffer.getChannelData(ch);
    const dest = trimmedBuffer.getChannelData(ch);
    dest.set(source.slice(0, maxSamples));
  }
  
  return trimmedBuffer;
}

// Normalize audio buffer to prevent clipping
export function normalizeBuffer(buffer: AudioBuffer): AudioBuffer {
  const ctx = audioEngine.getContext();
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  
  // Find peak
  let peak = 0;
  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
    }
  }
  
  // If already normalized or very quiet, return original
  if (peak < 0.01 || peak > 0.95) {
    return buffer;
  }
  
  // Create normalized buffer
  const normalized = ctx.createBuffer(channels, length, buffer.sampleRate);
  const gain = 0.95 / peak;
  
  for (let ch = 0; ch < channels; ch++) {
    const source = buffer.getChannelData(ch);
    const dest = normalized.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      dest[i] = source[i] * gain;
    }
  }
  
  return normalized;
}
