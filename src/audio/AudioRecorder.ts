// AudioRecorder - Record audio from microphone or system input

import { audioEngine } from './AudioEngine';

export interface RecordingState {
  isRecording: boolean;
  duration: number;
  level: number;
}

export class AudioRecorder {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private analyser: AnalyserNode | null = null;
  private isRecording = false;
  private startTime = 0;
  private onStateChange?: (state: RecordingState) => void;
  private levelInterval: number | null = null;
  
  async requestInput(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100,
        },
      });
      
      this.mediaStream = stream;
      
      // Create analyser for level metering
      const ctx = audioEngine.getContext();
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 256;
      
      const source = ctx.createMediaStreamSource(stream);
      source.connect(this.analyser);
      
      return stream;
    } catch (error) {
      console.error('Failed to get audio input:', error);
      throw new Error('Microphone access denied');
    }
  }
  
  startRecording(onStateChange?: (state: RecordingState) => void): void {
    if (!this.mediaStream || this.isRecording) return;
    
    this.onStateChange = onStateChange;
    this.audioChunks = [];
    this.startTime = performance.now();
    
    // Create MediaRecorder
    this.mediaRecorder = new MediaRecorder(this.mediaStream, {
      mimeType: 'audio/webm;codecs=opus',
    });
    
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };
    
    this.mediaRecorder.start(100); // Collect data every 100ms
    this.isRecording = true;
    
    // Start level monitoring
    this.levelInterval = window.setInterval(() => {
      const level = this.getLevel();
      const duration = (performance.now() - this.startTime) / 1000;
      
      this.onStateChange?.({
        isRecording: true,
        duration,
        level,
      });
    }, 50);
    
    this.onStateChange?.({
      isRecording: true,
      duration: 0,
      level: 0,
    });
  }
  
  async stopRecording(): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('Not recording'));
        return;
      }
      
      this.mediaRecorder.onstop = async () => {
        // Stop level monitoring
        if (this.levelInterval !== null) {
          clearInterval(this.levelInterval);
          this.levelInterval = null;
        }
        
        this.isRecording = false;
        
        this.onStateChange?.({
          isRecording: false,
          duration: (performance.now() - this.startTime) / 1000,
          level: 0,
        });
        
        // Convert chunks to AudioBuffer
        try {
          const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
          const arrayBuffer = await blob.arrayBuffer();
          const ctx = audioEngine.getContext();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          resolve(audioBuffer);
        } catch (error) {
          reject(new Error('Failed to decode recorded audio'));
        }
      };
      
      this.mediaRecorder.stop();
    });
  }
  
  getLevel(): number {
    if (!this.analyser) return 0;
    
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    
    // Calculate RMS
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    const rms = Math.sqrt(sum / data.length);
    
    // Normalize to 0-1
    return rms / 255;
  }
  
  isActive(): boolean {
    return this.isRecording;
  }
  
  disconnect(): void {
    if (this.levelInterval !== null) {
      clearInterval(this.levelInterval);
      this.levelInterval = null;
    }
    
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    this.analyser?.disconnect();
    this.analyser = null;
  }
}
