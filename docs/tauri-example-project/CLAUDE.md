# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Local-Celeb is a local-first desktop application that enables users to extract, clean, and clone character voices from movies for use in AI conversational agents with persistent character memory. Built with Tauri (Rust) + React + TypeScript.

## Development Commands

```bash
# Install dependencies (using Bun)

bun install

# Run development server

bun run dev

# Build for production

bun run build

# Preview production build

bun run preview

# Run Tauri CLI commands

bun run tauri [command]

```text

### Python Voice Cloning Tools

```bash
cd data_prep_voice_clone

# Install dependencies with Poetry

poetry install

# Run dataset preparation

poetry run python prepare_dataset.py

```text

## Architecture Overview

### Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Desktop Framework**: Tauri v2 (Rust backend)
- **Package Manager**: Bun
- **UI Components**: Radix UI primitives + shadcn/ui patterns
- **State Management**: Zustand
- **Audio Processing**: WaveSurfer.js for waveform visualization

### Key Directories

- `/src/components/TranscriptionEditor/` - Core transcription editing components
- `/src/hooks/` - Custom React hooks for state management
- `/src-tauri/` - Rust backend code
- `/data_prep_voice_clone/` - Python tools for voice cloning preparation
- `/docs/` - Project documentation and roadmap

### Core Components

- `TranscriptionView.tsx` - Main editor interface
- `AudioPlayer.tsx` - Audio playback with waveform visualization
- `WordLevelEditor.tsx` - Word-level transcription editing
- `SpeakerManager.tsx` - Character/speaker management

## Model Integration Targets

Based on the roadmap, the application will integrate:
- **Transcription**: WhisperX with speaker diarization
- **TTS**: Orpheus 3B (4-bit quantized)
- **LLM**: DeepSeek-R1-0528-Qwen3-8B
- **Memory**: Mem0 + Milvus for persistent character memory

## Development Guidelines

### TypeScript Standards

- Strict mode is enabled - ensure all types are properly defined
- Use functional components with hooks
- Define interfaces in `/src/types/transcription.ts` for data models

### Component Development

- Follow existing patterns in `/src/components/ui/` for consistency
- Use Tailwind CSS for styling (v4 with CSS-based configuration)
- Implement keyboard shortcuts using `react-hotkeys-hook`

### State Management

- Use Zustand stores for global state
- Keep component-specific state local with useState
- Audio state is managed via `useAudioPlayer` hook

### Performance Requirements

- Target < 2s latency for AI conversations
- Optimize audio processing for real-time playback
- Implement efficient rendering for large transcripts

## Current Implementation Status

✅ Basic Tauri + React structure
✅ Transcription editor UI components
✅ Audio playback with waveform
✅ Word-level editing capabilities
⏳ WhisperX integration
⏳ Voice extraction pipeline
⏳ TTS model integration
⏳ Memory system implementation

## Testing

Currently no testing framework is configured. When implementing tests:
- Consider Vitest for unit tests (aligns with Vite)
- Use React Testing Library for component tests
- Implement E2E tests for critical user flows

## Notes

- The project follows a local-first approach with optional API integrations
- Hardware detection for GPU/VRAM capabilities is planned
- Dual-interface design: settings window + agent chat interface
- See `/docs/roadmap-v3.md` for detailed feature planning and success metrics
