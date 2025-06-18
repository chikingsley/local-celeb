import { useState, useEffect } from "react";
import { Button } from "./components/ui/button";
import { Upload, Download, Play, Pause } from 'lucide-react';
import "./App.css";

function App() {
  const [transcription, setTranscription] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [editingWord, setEditingWord] = useState(null); // {segmentIndex, wordIndex}
  const [editText, setEditText] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [highlightedWord, setHighlightedWord] = useState(null); // {segmentIndex, wordIndex}

  const testAlert = () => {
    alert("Button works!");
  };

  const loadSample = async () => {
    try {
      setIsLoading(true);
      console.log("Starting to load sample data...");
      
      const response = await fetch('./scar_isolated.json');
      console.log("Fetch response:", response);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Sample data loaded:", data);
      
      setTranscription(data);
      setAudioUrl('./scar_isolated.mp3');
      alert("Sample data loaded successfully!");
    } catch (error) {
      console.error('Error loading sample data:', error);
      alert(`Error loading sample data: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAudio = () => {
    const audio = document.getElementById('audio-player');
    if (audio) {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Track audio time and update highlighted word
  useEffect(() => {
    if (!audioUrl) return;

    const audio = document.getElementById('audio-player');
    if (!audio) return;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      
      // Find the current word based on audio time
      if (transcription && transcription.segments) {
        let foundWord = null;
        
        for (let segmentIndex = 0; segmentIndex < transcription.segments.length; segmentIndex++) {
          const segment = transcription.segments[segmentIndex];
          
          if (audio.currentTime >= segment.start_time && audio.currentTime <= segment.end_time) {
            for (let wordIndex = 0; wordIndex < segment.words.length; wordIndex++) {
              const word = segment.words[wordIndex];
              
              if (audio.currentTime >= word.start_time && audio.currentTime <= word.end_time) {
                foundWord = { segmentIndex, wordIndex };
                break;
              }
            }
            break;
          }
        }
        
        setHighlightedWord(foundWord);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [audioUrl, transcription]);

  const startEditingWord = (segmentIndex, wordIndex, currentText) => {
    setEditingWord({ segmentIndex, wordIndex });
    setEditText(currentText);
  };

  const saveWordEdit = () => {
    if (!editingWord || !transcription) return;
    
    const updatedTranscription = { ...transcription };
    const segment = updatedTranscription.segments[editingWord.segmentIndex];
    
    // Update the word
    segment.words[editingWord.wordIndex].text = editText;
    
    // Rebuild the segment text
    segment.text = segment.words.map(w => w.text).join('');
    
    setTranscription(updatedTranscription);
    setEditingWord(null);
    setEditText('');
  };

  const cancelEdit = () => {
    setEditingWord(null);
    setEditText('');
  };

  const seekToWord = (startTime) => {
    const audio = document.getElementById('audio-player');
    if (audio) {
      audio.currentTime = startTime;
    }
  };

  return (
    <div className="w-screen h-screen bg-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <h1 className="text-2xl font-bold text-gray-900">Transcription Editor</h1>
        
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={testAlert}>
            <Upload className="h-4 w-4 mr-2" />
            Load Files
          </Button>

          <Button variant="outline" onClick={loadSample} disabled={isLoading}>
            {isLoading ? "Loading..." : "Load Sample"}
          </Button>

          <Button variant="outline" onClick={testAlert}>
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        <p className="text-lg">Can you see the header with 3 buttons above?</p>
        <p className="text-sm text-gray-600 mt-2">Try clicking "Load Sample" - it should load the Scar transcription data.</p>
        
        {audioUrl && (
          <div className="mt-6 p-4 bg-white rounded-lg border">
            <h3 className="text-lg font-semibold mb-4">Audio Player</h3>
            <audio id="audio-player" src={audioUrl} className="w-full mb-4" controls />
            <div className="flex items-center justify-between mb-4">
              <Button onClick={toggleAudio}>
                {isPlaying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                {isPlaying ? 'Pause' : 'Play'}
              </Button>
              <div className="text-sm text-gray-600">
                Current time: {currentTime.toFixed(2)}s
                {highlightedWord && (
                  <span className="ml-2 px-2 py-1 bg-yellow-200 rounded text-xs">
                    Playing word
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {transcription && (
          <div className="mt-6 p-4 bg-white rounded-lg border">
            <h3 className="text-lg font-semibold mb-4">Transcription</h3>
            <p className="mb-2">Language: {transcription.language_code}</p>
            <p className="mb-4">Segments: {transcription.segments?.length || 0}</p>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {transcription.segments?.slice(0, 3).map((segment, segmentIndex) => (
                <div key={segmentIndex} className="p-3 border border-gray-200 rounded">
                  <div className="text-sm text-gray-600 mb-2">
                    {segment.start_time?.toFixed(2)}s - {segment.end_time?.toFixed(2)}s
                  </div>
                  <div className="text-base leading-relaxed">
                    {segment.words?.map((word, wordIndex) => {
                      const isEditing = editingWord?.segmentIndex === segmentIndex && editingWord?.wordIndex === wordIndex;
                      const isHighlighted = highlightedWord?.segmentIndex === segmentIndex && highlightedWord?.wordIndex === wordIndex;
                      
                      if (isEditing) {
                        return (
                          <span key={wordIndex} className="inline-block">
                            <input
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveWordEdit();
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              onBlur={saveWordEdit}
                              className="px-1 py-0.5 border border-blue-300 rounded bg-white text-sm"
                              style={{ width: `${Math.max(editText.length * 8, 20)}px` }}
                              autoFocus
                            />
                          </span>
                        );
                      }
                      
                      // Different styling for highlighted (currently playing) word
                      const baseClasses = "inline-block px-1 py-0.5 rounded cursor-pointer transition-all duration-200";
                      const highlightClasses = isHighlighted 
                        ? "bg-yellow-300 text-black font-semibold transform scale-105 shadow-md" 
                        : "hover:bg-blue-100";
                      
                      return (
                        <span
                          key={wordIndex}
                          className={`${baseClasses} ${highlightClasses}`}
                          onClick={() => seekToWord(word.start_time)}
                          onDoubleClick={() => startEditingWord(segmentIndex, wordIndex, word.text)}
                          title={`${word.start_time?.toFixed(2)}s - ${word.end_time?.toFixed(2)}s. Click to seek, double-click to edit`}
                        >
                          {word.text}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
              {transcription.segments?.length > 3 && (
                <p className="text-sm text-gray-500">... and {transcription.segments.length - 3} more segments</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
