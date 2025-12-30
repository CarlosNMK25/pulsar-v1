// WAV Encoder utility - converts audio data to WAV format

export function encodeWAV(
  audioData: Float32Array[],
  sampleRate: number,
  numChannels: number = 2
): ArrayBuffer {
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  
  // Calculate total samples (assuming all channels have same length)
  const numSamples = audioData[0]?.length || 0;
  const dataLength = numSamples * blockAlign;
  const bufferLength = 44 + dataLength; // 44 bytes for header
  
  const buffer = new ArrayBuffer(bufferLength);
  const view = new DataView(buffer);
  
  // Write WAV header
  writeWAVHeader(view, sampleRate, numChannels, dataLength);
  
  // Interleave and convert to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = audioData[ch]?.[i] ?? 0;
      // Clamp and convert to 16-bit
      const clamped = Math.max(-1, Math.min(1, sample));
      const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }
  
  return buffer;
}

function writeWAVHeader(
  view: DataView,
  sampleRate: number,
  numChannels: number,
  dataLength: number
): void {
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  
  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true); // File size - 8
  writeString(view, 8, 'WAVE');
  
  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true); // BitsPerSample
  
  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

export function downloadWAV(arrayBuffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function generateFilename(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
  return `synth-export-${date}-${time}.wav`;
}
