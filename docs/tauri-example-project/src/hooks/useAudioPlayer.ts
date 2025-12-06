import { useRef, useEffect, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { PlaybackState } from '../types/transcription';

interface UseAudioPlayerProps {
  audioUrl?: string;
  onTimeUpdate?: (currentTime: number) => void;
  // onWordHighlight?: (wordIndex: number, segmentId: string) => void;
}

export const useAudioPlayer = ({ audioUrl, onTimeUpdate }: UseAudioPlayerProps) => {
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initializeWaveSurfer = useCallback(() => {
    if (!containerRef.current || !audioUrl) return;

    try {
      setIsLoading(true);
      setError(null);

      const wavesurfer = WaveSurfer.create({
        container: containerRef.current,
        waveColor: '#94a3b8',
        progressColor: '#3b82f6',
        cursorColor: '#ef4444',
        barWidth: 2,
        barRadius: 3,
        height: 80,
        normalize: true,
        backend: 'WebAudio',
        mediaControls: false,
      });

      wavesurfer.load(audioUrl);

      wavesurfer.on('ready', () => {
        setIsLoading(false);
        setPlaybackState(prev => ({
          ...prev,
          duration: wavesurfer.getDuration(),
        }));
      });

      wavesurfer.on('audioprocess', () => {
        const currentTime = wavesurfer.getCurrentTime();
        setPlaybackState(prev => ({
          ...prev,
          currentTime,
        }));
        onTimeUpdate?.(currentTime);
      });

      wavesurfer.on('play', () => {
        setPlaybackState(prev => ({ ...prev, isPlaying: true }));
      });

      wavesurfer.on('pause', () => {
        setPlaybackState(prev => ({ ...prev, isPlaying: false }));
      });

      wavesurfer.on('error', (err) => {
        setError(`Failed to load audio: ${err}`);
        setIsLoading(false);
      });

      wavesurferRef.current = wavesurfer;

    } catch (err) {
      setError(`Failed to initialize audio player: ${err}`);
      setIsLoading(false);
    }
  }, [audioUrl, onTimeUpdate]);

  useEffect(() => {
    initializeWaveSurfer();

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [initializeWaveSurfer]);

  const play = useCallback(() => {
    wavesurferRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    wavesurferRef.current?.pause();
  }, []);

  const togglePlayPause = useCallback(() => {
    if (playbackState.isPlaying) {
      pause();
    } else {
      play();
    }
  }, [playbackState.isPlaying, play, pause]);

  const seekTo = useCallback((time: number) => {
    if (wavesurferRef.current) {
      wavesurferRef.current.seekTo(time / wavesurferRef.current.getDuration());
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setPlaybackRate(rate);
      setPlaybackState(prev => ({ ...prev, playbackRate: rate }));
    }
  }, []);

  const seekToWord = useCallback((startTime: number) => {
    if (wavesurferRef.current) {
      const duration = wavesurferRef.current.getDuration();
      const startProgress = startTime / duration;
      wavesurferRef.current.seekTo(startProgress);
    }
  }, []);

  return {
    containerRef,
    playbackState,
    isLoading,
    error,
    play,
    pause,
    togglePlayPause,
    seekTo,
    seekToWord,
    setPlaybackRate,
  };
};