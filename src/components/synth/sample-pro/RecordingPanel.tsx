import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AudioRecorder, RecordingState } from '@/audio/AudioRecorder';
import { Mic, Square, Circle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface RecordingPanelProps {
  onRecordingComplete: (buffer: AudioBuffer) => void;
}

export const RecordingPanel = ({ onRecordingComplete }: RecordingPanelProps) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [level, setLevel] = useState(0);
  const recorderRef = useRef<AudioRecorder | null>(null);

  useEffect(() => {
    recorderRef.current = new AudioRecorder();
    return () => {
      recorderRef.current?.disconnect();
    };
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      await recorderRef.current?.requestInput();
      setHasPermission(true);
      toast.success('Microphone access granted');
    } catch (error) {
      toast.error('Failed to access microphone');
    }
  }, []);

  const handleStateChange = useCallback((state: RecordingState) => {
    setIsRecording(state.isRecording);
    setDuration(state.duration);
    setLevel(state.level);
  }, []);

  const startRecording = useCallback(() => {
    if (!recorderRef.current || !hasPermission) return;
    recorderRef.current.startRecording(handleStateChange);
    toast.info('Recording started');
  }, [hasPermission, handleStateChange]);

  const stopRecording = useCallback(async () => {
    if (!recorderRef.current) return;

    try {
      const buffer = await recorderRef.current.stopRecording();
      onRecordingComplete(buffer);
      toast.success(`Recorded ${duration.toFixed(1)}s of audio`);
    } catch (error) {
      toast.error('Failed to process recording');
    }
  }, [onRecordingComplete, duration]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="space-y-4 p-4 bg-card rounded-lg border border-border">
      <div className="flex items-center gap-2">
        <Mic className="w-4 h-4 text-destructive" />
        <h3 className="text-sm font-medium">Audio Recording</h3>
      </div>

      {!hasPermission ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            <span>Microphone permission required</span>
          </div>
          <Button onClick={requestPermission} className="w-full">
            <Mic className="w-4 h-4 mr-2" />
            Allow Microphone Access
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Recording status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isRecording && (
                <Circle className="w-3 h-3 text-destructive animate-pulse fill-destructive" />
              )}
              <span className="text-2xl font-mono tabular-nums">
                {formatDuration(duration)}
              </span>
            </div>
          </div>

          {/* Level meter */}
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Input Level</div>
            <Progress value={level * 100} className="h-2" />
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                variant="destructive"
                className="flex-1"
              >
                <Circle className="w-4 h-4 mr-2 fill-current" />
                Record
              </Button>
            ) : (
              <Button
                onClick={stopRecording}
                variant="outline"
                className="flex-1"
              >
                <Square className="w-4 h-4 mr-2 fill-current" />
                Stop
              </Button>
            )}
          </div>

          <div className="text-xs text-muted-foreground text-center">
            {isRecording
              ? 'Recording in progress...'
              : 'Click Record to capture audio from your microphone'}
          </div>
        </div>
      )}
    </div>
  );
};
