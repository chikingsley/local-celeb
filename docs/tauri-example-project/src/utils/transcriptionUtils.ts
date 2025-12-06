import { TranscriptionData, Segment, Word } from '../types/transcription';

export const convertLegacyTranscription = (data: any): TranscriptionData => {
  return {
    language_code: data.language_code || 'en',
    segments: data.segments?.map((segment: any, index: number) => ({
      ...segment,
      id: segment.id || `segment-${index}`,
      words: segment.words || [],
    })) || [],
    speakers: data.speakers || [],
    audio_file: data.audio_file,
    duration: data.duration,
  };
};

export const exportToSRT = (transcription: TranscriptionData): string => {
  let srt = '';
  
  transcription.segments.forEach((segment, index) => {
    const startTime = formatSRTTime(segment.start_time);
    const endTime = formatSRTTime(segment.end_time);
    const speakerPrefix = segment.speaker_name ? `${segment.speaker_name}: ` : '';
    
    srt += `${index + 1}\n`;
    srt += `${startTime} --> ${endTime}\n`;
    srt += `${speakerPrefix}${segment.text}\n\n`;
  });
  
  return srt;
};

export const exportToVTT = (transcription: TranscriptionData): string => {
  let vtt = 'WEBVTT\n\n';
  
  transcription.segments.forEach((segment) => {
    const startTime = formatVTTTime(segment.start_time);
    const endTime = formatVTTTime(segment.end_time);
    const speakerPrefix = segment.speaker_name ? `<v ${segment.speaker_name}>` : '';
    
    vtt += `${startTime} --> ${endTime}\n`;
    vtt += `${speakerPrefix}${segment.text}\n\n`;
  });
  
  return vtt;
};

export const exportToTXT = (transcription: TranscriptionData): string => {
  return transcription.segments
    .map(segment => {
      const speakerPrefix = segment.speaker_name ? `${segment.speaker_name}: ` : '';
      return `${speakerPrefix}${segment.text}`;
    })
    .join('\n');
};

export const exportToCSV = (transcription: TranscriptionData): string => {
  const headers = ['Start Time', 'End Time', 'Speaker', 'Text'];
  const rows = [headers.join(',')];
  
  transcription.segments.forEach(segment => {
    const row = [
      segment.start_time.toString(),
      segment.end_time.toString(),
      segment.speaker_name || '',
      `"${segment.text.replace(/"/g, '""')}"` // Escape quotes in CSV
    ];
    rows.push(row.join(','));
  });
  
  return rows.join('\n');
};

const formatSRTTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
};

const formatVTTTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`;
  }
};

export const findWordAtTime = (transcription: TranscriptionData, time: number): { segment: Segment; word: Word; wordIndex: number } | null => {
  for (const segment of transcription.segments) {
    if (time >= segment.start_time && time <= segment.end_time) {
      for (let i = 0; i < segment.words.length; i++) {
        const word = segment.words[i];
        if (time >= word.start_time && time <= word.end_time) {
          return { segment, word, wordIndex: i };
        }
      }
    }
  }
  return null;
};

export const searchTranscription = (transcription: TranscriptionData, query: string): Array<{ segmentId: string; wordIndex: number; match: string }> => {
  const results: Array<{ segmentId: string; wordIndex: number; match: string }> = [];
  const regex = new RegExp(query, 'gi');
  
  transcription.segments.forEach(segment => {
    segment.words.forEach((word, wordIndex) => {
      const matches = word.text.match(regex);
      if (matches) {
        matches.forEach(match => {
          results.push({
            segmentId: segment.id,
            wordIndex,
            match
          });
        });
      }
    });
  });
  
  return results;
};

export const replaceInTranscription = (
  transcription: TranscriptionData, 
  searchQuery: string, 
  replacement: string
): TranscriptionData => {
  const updatedSegments = transcription.segments.map(segment => ({
    ...segment,
    words: segment.words.map(word => ({
      ...word,
      text: word.text.replace(new RegExp(searchQuery, 'gi'), replacement)
    })),
    text: segment.text.replace(new RegExp(searchQuery, 'gi'), replacement)
  }));
  
  return {
    ...transcription,
    segments: updatedSegments
  };
};