import { useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface TranscriptionSegment {
  text: string;
  startTime: number;
  endTime: number;
  speakerId?: string;
  confidence?: number;
}

export interface TranscriptionResult {
  text: string;
  confidence?: number;
  segments?: TranscriptionSegment[];
  language?: string;
}

export interface TranscriptionProgress {
  stage: 'idle' | 'loading-models' | 'transcribing' | 'complete' | 'error';
  message: string;
  progress: number; // 0-100
  error?: string;
}

export interface UseFluidAudioOptions {
  modelVersion?: 'v2' | 'v3';
  withDiarization?: boolean;
  clusteringThreshold?: number;
  onProgress?: (progress: TranscriptionProgress) => void;
}

export function useFluidAudio(options: UseFluidAudioOptions = {}) {
  const {
    modelVersion = 'v3',
    withDiarization = false,
    clusteringThreshold = 0.7,
    onProgress,
  } = options;

  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<TranscriptionProgress>({
    stage: 'idle',
    message: '',
    progress: 0,
  });
  const abortRef = useRef(false);

  const updateProgress = useCallback(
    (update: Partial<TranscriptionProgress>) => {
      setProgress((prev) => {
        const newProgress = { ...prev, ...update };
        onProgress?.(newProgress);
        return newProgress;
      });
    },
    [onProgress]
  );

  const checkReady = useCallback(async () => {
    try {
      const result = await invoke<{ ready: boolean; diarizationReady: boolean }>(
        'plugin:fluidaudio|is_ready'
      );
      const ready = withDiarization ? result.diarizationReady : result.ready;
      setIsReady(ready);
      return ready;
    } catch (error) {
      console.error('Failed to check FluidAudio status:', error);
      return false;
    }
  }, [withDiarization]);

  const loadModels = useCallback(async () => {
    try {
      setIsLoading(true);
      updateProgress({
        stage: 'loading-models',
        message: 'Initializing FluidAudio...',
        progress: 0,
      });

      updateProgress({
        message: `Downloading ${modelVersion === 'v2' ? 'English' : 'Multilingual'} model...`,
        progress: 20,
      });

      const result = await invoke<{
        success: boolean;
        model: string;
        diarizationLoaded: boolean;
      }>('plugin:fluidaudio|load_model', {
        payload: {
          modelVersion,
          loadDiarizer: withDiarization,
        },
      });

      if (result.success) {
        updateProgress({
          message: 'Models loaded successfully',
          progress: 100,
          stage: 'idle',
        });
        setIsReady(true);
        return true;
      }
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      updateProgress({
        stage: 'error',
        message: 'Failed to load models',
        progress: 0,
        error: errorMessage,
      });
      console.error('Failed to load FluidAudio models:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [modelVersion, withDiarization, updateProgress]);

  const transcribe = useCallback(
    async (audioPath: string): Promise<TranscriptionResult | null> => {
      try {
        abortRef.current = false;
        setIsLoading(true);

        // Check if models are ready
        const ready = await checkReady();
        if (!ready) {
          updateProgress({
            stage: 'loading-models',
            message: 'Loading models for first use...',
            progress: 10,
          });
          const loaded = await loadModels();
          if (!loaded || abortRef.current) {
            return null;
          }
        }

        updateProgress({
          stage: 'transcribing',
          message: 'Converting audio format...',
          progress: 30,
        });

        if (abortRef.current) return null;

        updateProgress({
          message: withDiarization
            ? 'Transcribing with speaker identification...'
            : 'Transcribing audio...',
          progress: 50,
        });

        const result = await invoke<TranscriptionResult>('plugin:fluidaudio|transcribe_file', {
          payload: {
            path: audioPath,
            modelVersion,
            withDiarization,
            clusteringThreshold,
          },
        });

        if (abortRef.current) return null;

        updateProgress({
          stage: 'complete',
          message: 'Transcription complete!',
          progress: 100,
        });

        // Reset after a delay
        setTimeout(() => {
          updateProgress({
            stage: 'idle',
            message: '',
            progress: 0,
          });
        }, 2000);

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        updateProgress({
          stage: 'error',
          message: 'Transcription failed',
          progress: 0,
          error: errorMessage,
        });
        console.error('Transcription error:', error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [modelVersion, withDiarization, clusteringThreshold, checkReady, loadModels, updateProgress]
  );

  const cancel = useCallback(() => {
    abortRef.current = true;
    updateProgress({
      stage: 'idle',
      message: 'Cancelled',
      progress: 0,
    });
    setIsLoading(false);
  }, [updateProgress]);

  const getAvailableModels = useCallback(async () => {
    try {
      const result = await invoke<{ models: string[] }>('plugin:fluidaudio|get_available_models');
      return result.models;
    } catch (error) {
      console.error('Failed to get available models:', error);
      return [];
    }
  }, []);

  return {
    isReady,
    isLoading,
    progress,
    transcribe,
    loadModels,
    cancel,
    checkReady,
    getAvailableModels,
  };
}
