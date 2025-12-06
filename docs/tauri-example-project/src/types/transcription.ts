export interface Word {
  text: string;
  start_time: number;
  end_time: number;
  confidence?: number;
}

export interface Segment {
  id: string;
  text: string;
  start_time: number;
  end_time: number;
  words: Word[];
  speaker_id?: string;
  speaker_name?: string;
}

export interface Speaker {
  id: string;
  name: string;
  color: string;
}

export interface TranscriptionData {
  language_code: string;
  segments: Segment[];
  speakers?: Speaker[];
  audio_file?: string;
  duration?: number;
}

export interface EditAction {
  type: 'word_edit' | 'segment_split' | 'segment_merge' | 'speaker_assign';
  segmentId: string;
  wordIndex?: number;
  newText?: string;
  splitPosition?: number;
  targetSegmentId?: string;
  speakerId?: string;
  timestamp: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
}

export interface EditorState {
  transcription: TranscriptionData;
  playbackState: PlaybackState;
  selectedSegmentId?: string;
  selectedWordIndex?: number;
  editHistory: EditAction[];
  isLoading: boolean;
  error?: string;
}

export interface AlignmentOptions {
  forceAlignment: boolean;
  confidenceThreshold: number;
  maxDrift: number;
}

export interface ExportOptions {
  format: 'srt' | 'vtt' | 'json' | 'txt' | 'csv';
  includeSpeakers: boolean;
  includeTimestamps: boolean;
  includeConfidence: boolean;
}