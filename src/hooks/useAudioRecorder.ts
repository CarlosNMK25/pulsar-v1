import { useState, useRef, useCallback, useEffect } from 'react';
import { audioEngine } from '@/audio/AudioEngine';
import { encodeWAV, downloadWAV, generateFilename } from '@/utils/wavEncoder';
import { toast } from 'sonner';

interface UseAudioRecorderReturn {
  isRecording: boolean;
  recordingTime: number;
  startRecording: () => void;
  stopRecording: () => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = useCallback(() => {
    try {
      const destination = audioEngine.getMediaStreamDestination();
      const stream = destination.stream;
      
      // Check for supported mime types
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        try {
          // Convert chunks to audio buffer, then to WAV
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const arrayBuffer = await blob.arrayBuffer();
          
          // Decode the audio data
          const audioContext = new AudioContext();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          // Extract channel data
          const numChannels = audioBuffer.numberOfChannels;
          const audioData: Float32Array[] = [];
          for (let ch = 0; ch < numChannels; ch++) {
            audioData.push(audioBuffer.getChannelData(ch));
          }
          
          // Encode to WAV
          const wavBuffer = encodeWAV(audioData, audioBuffer.sampleRate, numChannels);
          
          // Download
          const filename = generateFilename();
          downloadWAV(wavBuffer, filename);
          
          toast.success(`Exported: ${filename}`);
          
          // Cleanup
          await audioContext.close();
        } catch (err) {
          console.error('[AudioRecorder] Error processing recording:', err);
          toast.error('Failed to export audio');
        }
      };
      
      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      startTimeRef.current = Date.now();
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
      
      toast.info('Recording started');
      console.log('[AudioRecorder] Recording started');
    } catch (err) {
      console.error('[AudioRecorder] Failed to start recording:', err);
      toast.error('Failed to start recording');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      console.log('[AudioRecorder] Recording stopped');
    }
  }, []);

  return {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
  };
}
