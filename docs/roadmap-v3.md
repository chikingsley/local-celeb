# Local-Celeb - Project Roadmap v3.0

Updated with NV-Embed-v2 + Mem0 + Milvus Memory Stack + Chroma ClusterSemanticChunker

## Project Vision

Build a local-first application that enables users to extract, clean, and clone character voices from movies for use in AI conversational agents with **persistent character memory**. Extract character dialogue, enhance audio quality, train custom TTS models, and chat with AI agents that remember conversations and evolve personality over time.

## Tech Stack

### Core Architecture

- **Frontend**: Tauri + React + ShadCN UI
- **Package Manager**: Bun
- **Transcript Editor**: Custom built with:
  - Wavesurfer.js (waveform visualization)
  - TipTap.dev (transcript editing)
  - Custom sync engine
- **Backend**: Rust (Tauri backend)
- **Voice Pipeline**: PipedCat (open source voice assistant pipeline)

### Model Stack (Local-First)

```text
Local Stack:
- Transcription: WhisperX (with speaker diarization)
- TTS: Orpheus 3B (Unsloth 4-bit quantized)
- LLM: DeepSeek-R1-0528-Qwen3-8B (Unsloth 4-bit quantized)
- Voice Pipeline: PipedCat
- Embeddings: NV-Embed-v2 (MTEB leaderboard top performer)
- Memory System: Mem0 (intelligent memory management)
- Vector Database: Milvus (high-performance vector storage)
- Chunking: Chroma research strategies (ClusterSemanticChunker)

API Options:
- Transcription: ElevenLabs Scribe API
- Audio Enhancement: ElevenLabs Voice Isolator
- TTS Cloning: Replicate (Kokoro 82M, MiniMax Speech-02-HD)
- LLM: User's choice with API key management
```

### Memory Architecture

```text
Character Memory Stack:
- Structured Data: SQLite (projects, sessions, metadata)
- Vector Memory: Milvus + NV-Embed-v2 (dialogue, personality, context)
- Smart Memory: Mem0 (dynamic memory organization, retrieval)
- Memory Types: Working, Episodic, Semantic, Procedural
```

## Current Setup Status ✅

- [x] Tauri + React project structure
- [x] ShadCN UI installed
- [x] Bun package manager configured
- [x] Hot reload working
- [x] Cursor rules for Convex/Supabase (if needed)

## Core Features

### 1. Project Infrastructure

#### Basic Application Setup

- [x] Tauri + React frontend with ShadCN
- [ ] Settings menu/window system (primary interface)
- [ ] Separate agent chat interface (floating bubble/separate view)
- [ ] Hardware detection and compatibility check
  - [ ] GPU capability (CUDA/Metal/CPU)
  - [ ] VRAM detection
  - [ ] Model recommendations based on hardware
- [ ] Local-first database setup (SQLite + Rust backend)
- [ ] **NEW**: Milvus vector database setup and integration
- [ ] **NEW**: Mem0 memory system initialization

#### Model Management System

- [ ] Design model manifest format
- [ ] Download manager UI (inspired by SuperWhisper)
- [ ] Progress indicators for model downloads
- [ ] Local model storage and versioning
- [ ] API key management for external services
- [ ] **NEW**: NV-Embed-v2 model download and initialization
- [ ] **NEW**: Memory system model configuration

### 2. Movie Import & Processing

#### File Import System

- [ ] Drag & drop movie file import (MP4, MKV, etc.)
- [ ] Automatic subtitle detection from file
- [ ] Title extraction and metadata parsing
- [ ] IMDB/script database integration for character names

#### Transcription Pipeline

- [ ] **Primary**: WhisperX for local transcription + diarization
- [ ] **Alternative**: ElevenLabs Scribe API integration
- [ ] Automatic speaker diarization using PyAnnote
- [ ] Character name detection from transcript/script
- [ ] Manual speaker labeling interface

### 3. Transcript-Based Editor

#### Core Editor Features

- [ ] Waveform visualization (Wavesurfer.js)
- [ ] Rich text transcript editing (TipTap.dev)
- [ ] Time-sync between audio and text
- [ ] Click word to jump to audio position
- [ ] Select text to highlight audio region

#### Character Extraction Tools

- [ ] Character dropdown selector
- [ ] Auto-highlight all character dialogue
- [ ] Bulk select/export character clips
- [ ] Manual clip adjustment tools:
  - [ ] Extend/trim clip boundaries
  - [ ] Split/merge clips
  - [ ] Preview individual clips
- [ ] Quality control and clip validation

### 4. Audio Enhancement

#### Enhancement Options

- [ ] **Primary**: ElevenLabs Voice Isolator API
- [ ] **Alternative**: PlayHT audio cleaning
- [ ] Before/after preview system
- [ ] Batch processing queue
- [ ] Quality settings (fast/balanced/best)

#### Export & Finalization

- [ ] Individual WAV files per dialogue line
- [ ] Concatenated character audio compilation
- [ ] Video segments retention (optional)
- [ ] Audio enhancement and finalization workflow

### 5. Voice Cloning & TTS

#### Local TTS Training

- [ ] **Primary**: Orpheus 3B fine-tuning (Unsloth)
  - [ ] 4-bit quantization support
  - [ ] One-click training from character clips
  - [ ] Training progress visualization
- [ ] **Cloud Options**:
  - [ ] Kokoro 82M via Replicate
  - [ ] MiniMax Speech-02-HD via Replicate

#### Voice Model Management

- [ ] Save/load voice profiles
- [ ] Model evaluation and preview
- [ ] Export trained models
- [ ] Voice model library management

### 6. **NEW**: Advanced Memory System

#### Smart Chunking Implementation

- [ ] Chroma ClusterSemanticChunker integration
- [ ] LLM-based chunking for character dialogue
- [ ] Dialogue-optimized chunk sizes (300-400 tokens)
- [ ] Context-preserving overlap strategies
- [ ] Scene-aware chunking boundaries

#### Mem0 Memory Management

- [ ] Character memory initialization per project
- [ ] Intelligent memory categorization
- [ ] Dynamic memory retrieval and ranking
- [ ] Memory connection learning over time
- [ ] Character personality extraction from dialogue

#### Milvus Vector Storage

- [ ] Character collection creation
- [ ] NV-Embed-v2 embedding generation
- [ ] Vector similarity search optimization
- [ ] Memory type indexing (working, episodic, semantic, procedural)
- [ ] Efficient retrieval with metadata filtering

#### Memory Types Implementation

- [ ] **Working Memory**: Current conversation context
- [ ] **Episodic Memory**: Past conversation experiences
- [ ] **Semantic Memory**: Character knowledge and facts
- [ ] **Procedural Memory**: Speech patterns and behaviors
- [ ] Memory cleanup and archival strategies

### 7. AI Agent Integration

#### LLM Backend

- [ ] **Primary**: DeepSeek-R1-0528-Qwen3-8B (local)
- [ ] Ollama integration for model management
- [ ] System prompt templates per character
- [ ] Character personality fine-tuning options
- [ ] **NEW**: Memory-aware conversation system

#### Voice Assistant Pipeline (PipedCat)

- [ ] Microphone input → WhisperX STT
- [ ] Text → Memory Retrieval → LLM → Response
- [ ] Response → Character TTS → Audio output
- [ ] Real-time latency optimization
- [ ] Voice activity detection
- [ ] **NEW**: Memory integration into conversation flow

#### Character Personality System

- [ ] Import character dialogue as training data
- [ ] Generate character profiles from transcripts
- [ ] Synthetic data generation for character training
- [ ] LoRA training for character personalities
- [ ] Character configuration management
- [ ] **NEW**: Dynamic personality evolution through conversations
- [ ] **NEW**: Character memory persistence across sessions

### 8. Enhanced Chat Experience

#### Memory-Powered Conversations

- [ ] Context-aware character responses
- [ ] Conversation history retention
- [ ] Character learning from interactions
- [ ] Personality consistency over time
- [ ] Multi-session conversation continuity

#### Advanced Chat Features

- [ ] Character mood and state tracking
- [ ] Scene context integration
- [ ] Emotional response modeling
- [ ] Reference to past conversations
- [ ] Character growth and development

### 9. User Interface & Experience

#### Main Application Interface

- [ ] Settings-focused primary window
- [ ] Hardware compatibility dashboard
- [ ] Model download and management
- [ ] Project management (save/load)
- [ ] Progress tracking for all operations
- [ ] **NEW**: Memory system dashboard
- [ ] **NEW**: Character knowledge visualization

#### Agent Chat Interface

- [ ] Separate floating bubble interface
- [ ] Or dedicated chat window
- [ ] Character voice visualization
- [ ] Real-time conversation display
- [ ] Voice input/output controls
- [ ] **NEW**: Memory insights panel
- [ ] **NEW**: Character learning progress indicator

#### Memory Management UI

- [ ] Character memory browser
- [ ] Memory type filtering and search
- [ ] Conversation history timeline
- [ ] Memory connection visualization
- [ ] Manual memory editing and curation

### 10. Advanced Features

#### Multi-Character Support

- [ ] Multiple character voice training
- [ ] Character switching during conversations
- [ ] Multi-character dialogue scenarios
- [ ] Voice mixing and blending
- [ ] **NEW**: Cross-character memory references
- [ ] **NEW**: Character relationship modeling

#### Performance Optimization

- [ ] GPU acceleration utilization
- [ ] Model caching strategies
- [ ] Background processing queues
- [ ] Memory management optimization
- [ ] **NEW**: Vector search optimization
- [ ] **NEW**: Memory archival and compression

#### Integration Options

- [ ] System audio capture capability
- [ ] YouTube video processing
- [ ] Batch movie processing
- [ ] Cloud training endpoints (if available)
- [ ] **NEW**: Memory export/import
- [ ] **NEW**: Character backup and restore

## Technical Implementation Details

### Model Specifications

#### NV-Embed-v2

- 4096 dimensions
- Top performer on MTEB leaderboard
- Optimized for retrieval tasks
- Commercial use allowed

#### WhisperX Configuration

- Uses PyAnnote for speaker diarization
- Word-level timestamps for precise alignment
- VAD (Voice Activity Detection) included
- Supports multiple Whisper model sizes

#### Orpheus 3B TTS (Unsloth)

- 4-bit quantized for efficiency
- Fine-tuning notebooks available
- ~6GB VRAM requirement
- Real-time inference capability

#### DeepSeek-R1-0528-Qwen3-8B

- Reasoning-capable model for character consistency
- Unsloth 4-bit quantization
- Fine-tunable for character personalities
- Maintains base intelligence while adding character traits

#### Mem0 + Milvus Integration

- Intelligent memory organization and retrieval
- High-performance vector similarity search
- Automatic memory categorization
- Dynamic learning and adaptation

### PipedCat Integration

- Open source voice assistant pipeline
- Handles microphone → STT → Memory → LLM → TTS → speaker flow
- Real-time processing capabilities
- Configurable for different model backends
- **NEW**: Memory-aware conversation flow

## Success Metrics

- [ ] Extract character voice in < 5 minutes
- [ ] Training time < 30 minutes on consumer GPU
- [ ] Real-time conversation with < 2s latency
- [ ] 90%+ user success rate on first attempt
- [ ] **NEW**: Character memory recall accuracy > 85%
- [ ] **NEW**: Personality consistency across sessions > 90%

## MVP Definition

**Minimum Viable Product for v0.1:**

1. Import movie + process with WhisperX
2. View transcript with character labels
3. Select character → export enhanced audio
4. Train Orpheus TTS model on character voice
5. **NEW**: Extract and store character personality in memory system
6. Voice chat with character using trained model + memory
7. **NEW**: Character remembers conversations across sessions
8. Local-first operation with API options

**Core User Flow:**

1. Drag movie file into app
2. Automatic transcription and diarization
3. Label/identify characters
4. Select character and enhance audio
5. **NEW**: Automatic personality extraction and memory setup
6. Train TTS model (one-click)
7. **NEW**: Character memory system initialization
8. Launch voice chat with persistent memory character

## Distribution Strategy

- **Model**: Free application with optional paid API integrations
- **Open Source**: No (keep proprietary)
- **Monetization**: API usage for premium features
- **Legal**: Terms of service for personal use only
- **Updates**: Built-in auto-updater

## Key Technical Decisions

1. **Tauri over Electron**: Better performance and smaller bundle
2. **TipTap over Monaco**: Better for rich text transcript editing
3. **Local-first**: All core functionality works offline
4. **PipedCat**: Proven voice pipeline solution
5. **Unsloth models**: Optimized for consumer hardware
6. **ElevenLabs**: Best-in-class audio enhancement
7. **No model tiers**: Single optimized local stack
8. **NEW**: **NV-Embed-v2**: Best open-source embedding model
9. **NEW**: **Mem0**: Easy intelligent memory management
10. **NEW**: **Milvus**: High-performance vector database
11. **NEW**: **Chroma chunking**: Research-backed chunking strategies

---

*Everything else is iterative improvement beyond the MVP!*
