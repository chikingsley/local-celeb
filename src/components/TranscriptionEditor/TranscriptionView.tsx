import React, { useState } from 'react';
import { AudioPlayer } from './AudioPlayer';
import { WordLevelEditor } from './WordLevelEditor';
import { SpeakerManager } from './SpeakerManager';
import { ExportService } from '../TranscriptionTools/ExportService';
import { useTranscriptionStore } from '../../hooks/useTranscription';
import { TranscriptionData } from '../../types/transcription';
import { Button } from '../ui/button';
import { Upload, Download, PanelRightOpen, PanelRightClose } from 'lucide-react';

interface TranscriptionViewProps {
  className?: string;
}

export const TranscriptionView: React.FC<TranscriptionViewProps> = ({ className = '' }) => {
  const {
    transcription,
    setTranscription,
    setCurrentTime,
  } = useTranscriptionStore();

  const [audioUrl, setAudioUrl] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    
    try {
      // Handle audio file
      const audioFile = Array.from(files).find(file => 
        file.type.startsWith('audio/') || file.name.endsWith('.mp3') || file.name.endsWith('.wav')
      );
      
      // Handle JSON file
      const jsonFile = Array.from(files).find(file => 
        file.type === 'application/json' || file.name.endsWith('.json')
      );

      if (audioFile) {
        const audioObjectUrl = URL.createObjectURL(audioFile);
        setAudioUrl(audioObjectUrl);
      }

      if (jsonFile) {
        const text = await jsonFile.text();
        const data = JSON.parse(text) as TranscriptionData;
        
        // Convert the data to our format if needed
        const convertedData: TranscriptionData = {
          language_code: data.language_code || 'en',
          segments: data.segments.map((segment, index) => ({
            ...segment,
            id: segment.id || `segment-${index}`,
          })),
          speakers: data.speakers || [],
          audio_file: audioFile?.name,
        };
        
        setTranscription(convertedData);
      }
    } catch (error) {
      console.error('Error loading files:', error);
      alert('Error loading files. Please check the file format.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimeUpdate = (currentTime: number) => {
    setCurrentTime(currentTime);
  };

  const handleExport = () => {
    if (!transcription) return;

    const dataStr = JSON.stringify(transcription, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'transcription-edited.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const loadSampleData = async () => {
    try {
      setIsLoading(true);
      
      // Load the existing sample data
      const response = await fetch('./scar_isolated.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      const convertedData: TranscriptionData = {
        language_code: data.language_code || 'eng',
        segments: data.segments.map((segment: any, index: number) => ({
          ...segment,
          id: `segment-${index}`,
        })),
        speakers: [],
        audio_file: 'scar_isolated.mp3',
      };
      
      setTranscription(convertedData);
      setAudioUrl('./scar_isolated.mp3');
      console.log('Sample data loaded successfully');
    } catch (error) {
      console.error('Error loading sample data:', error);
      alert(`Error loading sample data: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <h1 className="text-2xl font-bold text-gray-900">Transcription Editor</h1>
        
        <div className="flex items-center space-x-3">
          <input
            type="file"
            id="file-upload"
            multiple
            accept=".mp3,.wav,.json,audio/*,application/json"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          <Button
            variant="outline"
            onClick={() => document.getElementById('file-upload')?.click()}
            disabled={isLoading}
          >
            <Upload className="h-4 w-4 mr-2" />
            Load Files
          </Button>

          <Button
            variant="outline"
            onClick={loadSampleData}
            disabled={isLoading}
          >
            Load Sample
          </Button>

          <Button
            variant="outline"
            onClick={handleExport}
            disabled={!transcription}
          >
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>

          <Button
            variant="outline"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            {showSidebar ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Audio Player */}
          <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-gray-50">
            <AudioPlayer
              audioUrl={audioUrl}
              onTimeUpdate={handleTimeUpdate}
            />
          </div>

          {/* Transcription Editor */}
          <div className="flex-1 overflow-hidden">
            <WordLevelEditor className="h-full" />
          </div>
        </div>

        {/* Right Sidebar */}
        {showSidebar && (
          <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-gray-50 overflow-y-auto">
            <div className="p-4 space-y-6">
              <SpeakerManager />
              <ExportService />
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex-shrink-0 p-2 border-t border-gray-200 bg-gray-50 text-sm text-gray-600">
        <div className="flex items-center justify-between">
          <div>
            {transcription ? (
              <span>
                {transcription.segments.length} segments • {
                  transcription.segments.reduce((acc, seg) => acc + seg.words.length, 0)
                } words
              </span>
            ) : (
              <span>No transcription loaded</span>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            <span>Language: {transcription?.language_code || 'N/A'}</span>
            {isLoading && (
              <div className="flex items-center space-x-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                <span>Loading...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Help Text */}
      {!transcription && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Welcome to Transcription Editor
            </h2>
            <p className="text-gray-600 mb-6">
              Upload an audio file (.mp3, .wav) and a transcription JSON file to get started, 
              or load the sample data to try out the editor.
            </p>
            <div className="space-y-2 text-sm text-gray-500">
              <p>• Double-click words to edit them</p>
              <p>• Click words to select and navigate</p>
              <p>• Use speaker dropdowns to assign speakers</p>
              <p>• Audio playback syncs with word highlighting</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};