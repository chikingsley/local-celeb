import React, { useState } from 'react';
import { useTranscriptionStore } from '../../hooks/useTranscription';
import { Button } from '../ui/button';
import { Download, FileText, Settings } from 'lucide-react';
import { exportToSRT, exportToVTT, exportToTXT, exportToCSV } from '../../utils/transcriptionUtils';

interface ExportServiceProps {
  className?: string;
}

export const ExportService: React.FC<ExportServiceProps> = ({ className = '' }) => {
  const { transcription } = useTranscriptionStore();
  const [exportFormat, setExportFormat] = useState<'srt' | 'vtt' | 'json' | 'txt' | 'csv'>('srt');
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [includeSpeakers, setIncludeSpeakers] = useState(true);
  const [showOptions, setShowOptions] = useState(false);

  const exportData = () => {
    if (!transcription) return;

    let content = '';
    let filename = '';
    let mimeType = '';

    switch (exportFormat) {
      case 'srt':
        content = exportToSRT(transcription);
        filename = 'transcription.srt';
        mimeType = 'text/plain';
        break;
      case 'vtt':
        content = exportToVTT(transcription);
        filename = 'transcription.vtt';
        mimeType = 'text/vtt';
        break;
      case 'txt':
        content = exportToTXT(transcription);
        filename = 'transcription.txt';
        mimeType = 'text/plain';
        break;
      case 'csv':
        content = exportToCSV(transcription);
        filename = 'transcription.csv';
        mimeType = 'text/csv';
        break;
      case 'json':
        content = JSON.stringify(transcription, null, 2);
        filename = 'transcription.json';
        mimeType = 'application/json';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatOptions = [
    { value: 'srt', label: 'SRT (SubRip)', description: 'Standard subtitle format' },
    { value: 'vtt', label: 'VTT (WebVTT)', description: 'Web video text tracks' },
    { value: 'txt', label: 'Plain Text', description: 'Simple text file' },
    { value: 'csv', label: 'CSV', description: 'Comma-separated values' },
    { value: 'json', label: 'JSON', description: 'Full data with metadata' },
  ] as const;

  const getSegmentCount = () => transcription?.segments.length || 0;
  const getWordCount = () => transcription?.segments.reduce((acc, seg) => acc + seg.words.length, 0) || 0;

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          Export Transcription
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowOptions(!showOptions)}
        >
          <Settings className="h-4 w-4 mr-1" />
          Options
        </Button>
      </div>

      {/* Statistics */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Segments:</span>
            <span className="ml-2 font-medium">{getSegmentCount()}</span>
          </div>
          <div>
            <span className="text-gray-600">Words:</span>
            <span className="ml-2 font-medium">{getWordCount()}</span>
          </div>
        </div>
      </div>

      {/* Format Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Export Format
        </label>
        <select
          value={exportFormat}
          onChange={(e) => setExportFormat(e.target.value as any)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          {formatOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} - {option.description}
            </option>
          ))}
        </select>
      </div>

      {/* Export Options */}
      {showOptions && (
        <div className="mb-4 p-3 border border-gray-200 rounded-lg bg-gray-50">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Export Options</h4>
          
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={includeTimestamps}
                onChange={(e) => setIncludeTimestamps(e.target.checked)}
                className="mr-2"
                disabled={exportFormat === 'txt'}
              />
              <span className="text-sm text-gray-700">Include timestamps</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={includeSpeakers}
                onChange={(e) => setIncludeSpeakers(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Include speaker names</span>
            </label>
          </div>
        </div>
      )}

      {/* Export Button */}
      <Button
        onClick={exportData}
        disabled={!transcription}
        className="w-full"
      >
        <Download className="h-4 w-4 mr-2" />
        Export as {exportFormat.toUpperCase()}
      </Button>

      {!transcription && (
        <p className="text-sm text-gray-500 text-center mt-2">
          Load a transcription to enable export
        </p>
      )}
    </div>
  );
};