import React from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '../ui/button';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';

interface AudioPlayerProps {
  audioUrl?: string;
  onTimeUpdate?: (currentTime: number) => void;
  className?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  onTimeUpdate,
  className = '',
}) => {
  const {
    containerRef,
    playbackState,
    isLoading,
    error,
    togglePlayPause,
    seekTo,
    setPlaybackRate,
  } = useAudioPlayer({ audioUrl, onTimeUpdate });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSkipBack = () => {
    seekTo(Math.max(0, playbackState.currentTime - 5));
  };

  const handleSkipForward = () => {
    seekTo(Math.min(playbackState.duration, playbackState.currentTime + 5));
  };

  const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2];

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <p className="text-red-700 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      {/* Waveform Container */}
      <div 
        ref={containerRef} 
        className="w-full mb-4 bg-gray-50 rounded"
      />

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSkipBack}
            disabled={isLoading}
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          <Button
            onClick={togglePlayPause}
            disabled={isLoading || !audioUrl}
            size="sm"
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
            ) : playbackState.isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSkipForward}
            disabled={isLoading}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Time Display */}
        <div className="text-sm text-gray-600">
          {formatTime(playbackState.currentTime)} / {formatTime(playbackState.duration)}
        </div>

        {/* Playback Rate */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Speed:</span>
          <select
            value={playbackState.playbackRate}
            onChange={(e) => setPlaybackRate(Number(e.target.value))}
            className="text-sm border border-gray-300 rounded px-2 py-1"
            disabled={isLoading}
          >
            {playbackRates.map((rate) => (
              <option key={rate} value={rate}>
                {rate}x
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};