import { invoke } from '@tauri-apps/api/core'

// Types
export interface LoadModelOptions {
  modelName: string;
  downloadIfNeeded?: boolean;
}

export interface TranscribeFileOptions {
  path: string;
  modelName?: string;
  language?: string;
  task?: 'transcribe' | 'translate';
}

export interface TranscribeAudioOptions {
  audioData: string; // Base64 encoded audio data
  modelName?: string;
  language?: string;
  task?: 'transcribe' | 'translate';
}

export interface TranscriptionSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avgLogprob: number;
  compressionRatio: number;
  noSpeechProb: number;
}

export interface TranscriptionTimings {
  fullPipeline: number;
  tokensPerSecond: number;
  realTimeFactor: number;
  firstTokenTime: number;
}

export interface TranscriptionResult {
  text: string;
  segments?: TranscriptionSegment[];
  language?: string;
  timings?: TranscriptionTimings;
}

// API Functions

export async function loadModel(options: LoadModelOptions): Promise<{ success: boolean; model: string }> {
  return await invoke('plugin:whisperkit|load_model', {
    payload: {
      modelName: options.modelName,
      downloadIfNeeded: options.downloadIfNeeded ?? true,
    },
  });
}

export async function unloadModel(): Promise<{ success: boolean }> {
  return await invoke('plugin:whisperkit|unload_model');
}

export async function transcribeFile(options: TranscribeFileOptions): Promise<TranscriptionResult> {
  return await invoke('plugin:whisperkit|transcribe_file', {
    payload: {
      path: options.path,
      modelName: options.modelName,
      language: options.language,
      task: options.task,
    },
  });
}

export async function transcribeAudio(options: TranscribeAudioOptions): Promise<TranscriptionResult> {
  return await invoke('plugin:whisperkit|transcribe_audio', {
    payload: {
      audioData: options.audioData,
      modelName: options.modelName,
      language: options.language,
      task: options.task,
    },
  });
}

export async function getAvailableModels(): Promise<{ models: string[] }> {
  return await invoke('plugin:whisperkit|get_available_models');
}

export async function getCurrentModel(): Promise<{ model: string | null }> {
  return await invoke('plugin:whisperkit|get_current_model');
}

export async function isReady(): Promise<{ ready: boolean }> {
  return await invoke('plugin:whisperkit|is_ready');
}

// Helper function to convert audio file to base64
export async function audioFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result?.toString().split(',')[1];
      if (base64) {
        resolve(base64);
      } else {
        reject(new Error('Failed to convert audio file to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}