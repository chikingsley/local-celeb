import { create } from 'zustand';
import { TranscriptionData, Segment, Word, Speaker, EditAction } from '../types/transcription';

interface TranscriptionStore {
  transcription: TranscriptionData | null;
  currentTime: number;
  selectedSegmentId: string | null;
  selectedWordIndex: number | null;
  editHistory: EditAction[];
  speakers: Speaker[];
  
  // Actions
  setTranscription: (transcription: TranscriptionData) => void;
  setCurrentTime: (time: number) => void;
  selectSegment: (segmentId: string | null) => void;
  selectWord: (segmentId: string, wordIndex: number) => void;
  editWord: (segmentId: string, wordIndex: number, newText: string) => void;
  splitSegment: (segmentId: string, splitPosition: number) => void;
  mergeSegments: (segmentId1: string, segmentId2: string) => void;
  assignSpeaker: (segmentId: string, speakerId: string) => void;
  addSpeaker: (speaker: Speaker) => void;
  updateSpeaker: (speakerId: string, updates: Partial<Speaker>) => void;
  getCurrentWord: () => { segment: Segment; word: Word; wordIndex: number } | null;
  undo: () => void;
  redo: () => void;
}

export const useTranscriptionStore = create<TranscriptionStore>((set, get) => ({
  transcription: null,
  currentTime: 0,
  selectedSegmentId: null,
  selectedWordIndex: null,
  editHistory: [],
  speakers: [
    { id: 'speaker-1', name: 'Speaker 1', color: '#3b82f6' },
    { id: 'speaker-2', name: 'Speaker 2', color: '#ef4444' },
    { id: 'speaker-3', name: 'Speaker 3', color: '#10b981' },
  ],

  setTranscription: (transcription) => {
    set({ transcription });
  },

  setCurrentTime: (time) => {
    set({ currentTime: time });
  },

  selectSegment: (segmentId) => {
    set({ selectedSegmentId: segmentId, selectedWordIndex: null });
  },

  selectWord: (segmentId, wordIndex) => {
    set({ selectedSegmentId: segmentId, selectedWordIndex: wordIndex });
  },

  editWord: (segmentId, wordIndex, newText) => {
    const { transcription } = get();
    if (!transcription) return;

    const editAction: EditAction = {
      type: 'word_edit',
      segmentId,
      wordIndex,
      newText,
      timestamp: Date.now(),
    };

    const updatedSegments = transcription.segments.map(segment => {
      if (segment.id === segmentId) {
        const updatedWords = [...segment.words];
        updatedWords[wordIndex] = { ...updatedWords[wordIndex], text: newText };
        
        // Update segment text
        const updatedText = updatedWords.map(w => w.text).join('');
        
        return { ...segment, words: updatedWords, text: updatedText };
      }
      return segment;
    });

    set(state => ({
      transcription: { ...transcription, segments: updatedSegments },
      editHistory: [...state.editHistory, editAction],
    }));
  },

  splitSegment: (segmentId, splitPosition) => {
    const { transcription } = get();
    if (!transcription) return;

    const segmentIndex = transcription.segments.findIndex(s => s.id === segmentId);
    if (segmentIndex === -1) return;

    const segment = transcription.segments[segmentIndex];
    
    // Find the word at the split position
    let wordIndex = 0;
    let charCount = 0;
    
    for (let i = 0; i < segment.words.length; i++) {
      if (charCount + segment.words[i].text.length >= splitPosition) {
        wordIndex = i;
        break;
      }
      charCount += segment.words[i].text.length;
    }

    const firstWords = segment.words.slice(0, wordIndex + 1);
    const secondWords = segment.words.slice(wordIndex + 1);

    const firstSegment: Segment = {
      ...segment,
      id: `${segmentId}-1`,
      words: firstWords,
      text: firstWords.map(w => w.text).join(''),
      end_time: firstWords[firstWords.length - 1]?.end_time || segment.end_time,
    };

    const secondSegment: Segment = {
      ...segment,
      id: `${segmentId}-2`,
      words: secondWords,
      text: secondWords.map(w => w.text).join(''),
      start_time: secondWords[0]?.start_time || segment.start_time,
    };

    const updatedSegments = [
      ...transcription.segments.slice(0, segmentIndex),
      firstSegment,
      secondSegment,
      ...transcription.segments.slice(segmentIndex + 1),
    ];

    const editAction: EditAction = {
      type: 'segment_split',
      segmentId,
      splitPosition,
      timestamp: Date.now(),
    };

    set(state => ({
      transcription: { ...transcription, segments: updatedSegments },
      editHistory: [...state.editHistory, editAction],
    }));
  },

  mergeSegments: (segmentId1, segmentId2) => {
    const { transcription } = get();
    if (!transcription) return;

    const segment1Index = transcription.segments.findIndex(s => s.id === segmentId1);
    const segment2Index = transcription.segments.findIndex(s => s.id === segmentId2);
    
    if (segment1Index === -1 || segment2Index === -1) return;

    const segment1 = transcription.segments[segment1Index];
    const segment2 = transcription.segments[segment2Index];

    const mergedSegment: Segment = {
      ...segment1,
      id: `merged-${Date.now()}`,
      words: [...segment1.words, ...segment2.words],
      text: segment1.text + segment2.text,
      end_time: segment2.end_time,
    };

    const updatedSegments = transcription.segments
      .filter(s => s.id !== segmentId1 && s.id !== segmentId2)
      .concat(mergedSegment)
      .sort((a, b) => a.start_time - b.start_time);

    const editAction: EditAction = {
      type: 'segment_merge',
      segmentId: segmentId1,
      targetSegmentId: segmentId2,
      timestamp: Date.now(),
    };

    set(state => ({
      transcription: { ...transcription, segments: updatedSegments },
      editHistory: [...state.editHistory, editAction],
    }));
  },

  assignSpeaker: (segmentId, speakerId) => {
    const { transcription, speakers } = get();
    if (!transcription) return;

    const speaker = speakers.find(s => s.id === speakerId);
    if (!speaker) return;

    const updatedSegments = transcription.segments.map(segment => {
      if (segment.id === segmentId) {
        return { ...segment, speaker_id: speakerId, speaker_name: speaker.name };
      }
      return segment;
    });

    const editAction: EditAction = {
      type: 'speaker_assign',
      segmentId,
      speakerId,
      timestamp: Date.now(),
    };

    set(state => ({
      transcription: { ...transcription, segments: updatedSegments },
      editHistory: [...state.editHistory, editAction],
    }));
  },

  addSpeaker: (speaker) => {
    set(state => ({
      speakers: [...state.speakers, speaker],
    }));
  },

  updateSpeaker: (speakerId, updates) => {
    set(state => ({
      speakers: state.speakers.map(speaker =>
        speaker.id === speakerId ? { ...speaker, ...updates } : speaker
      ),
    }));
  },

  getCurrentWord: () => {
    const { transcription, currentTime } = get();
    if (!transcription) return null;

    for (const segment of transcription.segments) {
      if (currentTime >= segment.start_time && currentTime <= segment.end_time) {
        for (let i = 0; i < segment.words.length; i++) {
          const word = segment.words[i];
          if (currentTime >= word.start_time && currentTime <= word.end_time) {
            return { segment, word, wordIndex: i };
          }
        }
      }
    }
    return null;
  },

  undo: () => {
    // Implementation for undo functionality
    console.log('Undo not implemented yet');
  },

  redo: () => {
    // Implementation for redo functionality
    console.log('Redo not implemented yet');
  },
}));