import React, { useState, useRef, useEffect } from 'react';
import { useTranscriptionStore } from '../../hooks/useTranscription';
import { Segment, Word } from '../../types/transcription';
import { useHotkeys } from 'react-hotkeys-hook';

interface WordComponentProps {
  word: Word;
  wordIndex: number;
  segment: Segment;
  isSelected: boolean;
  isCurrentWord: boolean;
  onWordClick: (segmentId: string, wordIndex: number) => void;
  onWordEdit: (segmentId: string, wordIndex: number, newText: string) => void;
}

const WordComponent: React.FC<WordComponentProps> = ({
  word,
  wordIndex,
  segment,
  isSelected,
  isCurrentWord,
  onWordClick,
  onWordEdit,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(word.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditText(word.text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditText(word.text);
    }
  };

  const handleSave = () => {
    if (editText.trim() !== word.text) {
      onWordEdit(segment.id, wordIndex, editText.trim());
    }
    setIsEditing(false);
  };

  const handleBlur = () => {
    handleSave();
  };

  const getWordClasses = () => {
    let classes = 'inline-block px-1 py-0.5 rounded cursor-pointer transition-colors duration-150 ';
    
    if (isCurrentWord) {
      classes += 'bg-blue-500 text-white ';
    } else if (isSelected) {
      classes += 'bg-blue-100 text-blue-800 ';
    } else {
      classes += 'hover:bg-gray-100 ';
    }

    if (isEditing) {
      classes += 'bg-yellow-100 ';
    }

    return classes;
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="inline-block px-1 py-0.5 border border-blue-300 rounded bg-white text-sm min-w-[20px]"
        style={{ width: `${Math.max(editText.length * 8, 20)}px` }}
      />
    );
  }

  return (
    <span
      className={getWordClasses()}
      onClick={() => onWordClick(segment.id, wordIndex)}
      onDoubleClick={handleDoubleClick}
      title={`${word.start_time.toFixed(2)}s - ${word.end_time.toFixed(2)}s`}
    >
      {word.text}
    </span>
  );
};

interface SegmentComponentProps {
  segment: Segment;
  speakers: Array<{ id: string; name: string; color: string }>;
  onSpeakerChange: (segmentId: string, speakerId: string) => void;
  onSegmentSplit: (segmentId: string, position: number) => void;
}

const SegmentComponent: React.FC<SegmentComponentProps> = ({
  segment,
  speakers,
  onSpeakerChange,
  // onSegmentSplit,
}) => {
  const {
    currentTime,
    selectedSegmentId,
    selectedWordIndex,
    selectWord,
    editWord,
    getCurrentWord,
  } = useTranscriptionStore();

  const currentWord = getCurrentWord();
  const isCurrentSegment = currentTime >= segment.start_time && currentTime <= segment.end_time;
  const speaker = speakers.find(s => s.id === segment.speaker_id);

  const handleWordClick = (segmentId: string, wordIndex: number) => {
    selectWord(segmentId, wordIndex);
  };

  const handleWordEdit = (segmentId: string, wordIndex: number, newText: string) => {
    editWord(segmentId, wordIndex, newText);
  };

  const handleSpeakerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSpeakerChange(segment.id, e.target.value);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`border rounded-lg p-4 mb-4 transition-all duration-200 ${
        isCurrentSegment ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'
      }`}
      style={{ borderLeftColor: speaker?.color || '#6b7280', borderLeftWidth: '4px' }}
    >
      {/* Segment Header */}
      <div className="flex items-center justify-between mb-3 text-sm text-gray-600">
        <div className="flex items-center space-x-4">
          <span className="font-mono">
            {formatTime(segment.start_time)} - {formatTime(segment.end_time)}
          </span>
          <select
            value={segment.speaker_id || ''}
            onChange={handleSpeakerChange}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="">No Speaker</option>
            {speakers.map((speaker) => (
              <option key={speaker.id} value={speaker.id}>
                {speaker.name}
              </option>
            ))}
          </select>
        </div>
        <div className="text-xs text-gray-400">
          Segment ID: {segment.id}
        </div>
      </div>

      {/* Words */}
      <div className="leading-relaxed text-base">
        {segment.words.map((word, wordIndex) => {
          const isSelected = selectedSegmentId === segment.id && selectedWordIndex === wordIndex;
          const isCurrentWord = currentWord?.segment.id === segment.id && currentWord?.wordIndex === wordIndex;

          return (
            <WordComponent
              key={`${segment.id}-${wordIndex}`}
              word={word}
              wordIndex={wordIndex}
              segment={segment}
              isSelected={isSelected}
              isCurrentWord={isCurrentWord}
              onWordClick={handleWordClick}
              onWordEdit={handleWordEdit}
            />
          );
        })}
      </div>
    </div>
  );
};

interface WordLevelEditorProps {
  className?: string;
}

export const WordLevelEditor: React.FC<WordLevelEditorProps> = ({ className = '' }) => {
  const {
    transcription,
    speakers,
    assignSpeaker,
    splitSegment,
  } = useTranscriptionStore();

  // Keyboard shortcuts
  useHotkeys('ctrl+z', () => {
    // Undo functionality
    console.log('Undo');
  });

  useHotkeys('ctrl+y', () => {
    // Redo functionality
    console.log('Redo');
  });

  useHotkeys('enter', (e) => {
    // Split segment at current position
    e.preventDefault();
    console.log('Split segment');
  });

  if (!transcription) {
    return (
      <div className={`flex items-center justify-center h-64 text-gray-500 ${className}`}>
        <p>No transcription loaded. Please load an audio file and transcription.</p>
      </div>
    );
  }

  const handleSpeakerChange = (segmentId: string, speakerId: string) => {
    assignSpeaker(segmentId, speakerId);
  };

  const handleSegmentSplit = (segmentId: string, position: number) => {
    splitSegment(segmentId, position);
  };

  return (
    <div className={`max-h-96 overflow-y-auto p-4 ${className}`}>
      <div className="space-y-1">
        {transcription.segments.map((segment) => (
          <SegmentComponent
            key={segment.id}
            segment={segment}
            speakers={speakers}
            onSpeakerChange={handleSpeakerChange}
            onSegmentSplit={handleSegmentSplit}
          />
        ))}
      </div>
    </div>
  );
};