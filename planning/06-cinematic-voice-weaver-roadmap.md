# Cinematic Voice Weaver - Project Roadmap

## Project Vision

Build a local-first application that enables users to extract, clean, and clone character voices from movies for use in AI conversational agents. The key differentiator is the transcript-based character extraction editor.

## Tech Stack Decision

### Core Architecture

- **Frontend**: Electron (or Tauri for lighter weight)
- **Transcript Editor**: Fork/adapt Audapolis or build with:
  - Wavesurfer.js (waveform visualization)
  - Monaco Editor (transcript editing)
  - Custom sync engine
- **Backend**: Python/FastAPI
- **Models**: Managed via Ollama + custom model downloader

### Model Tiers (Based on Hardware)

```text
Tier 1 (4GB VRAM):
- Whisper.cpp tiny/base
- MeloTTS/OpenVoice2 for instant cloning
- Llama 3.2 3B for chat

Tier 2 (8GB VRAM):
- Whisper.cpp medium
- Orpheus 4bit or Kokoro
- Mistral 7B

Tier 3 (16GB+ VRAM):
- Whisper large
- Orpheus FP16
- Llama 3 70B
```

## Phase 1: Core Infrastructure (Week 1-2)

### Foundation Setup

- [ ] Choose between Electron vs Tauri vs Web-based
- [ ] Set up project structure with hot reload
- [ ] Create basic window with menu system
- [ ] Implement hardware detection system
  - [ ] GPU capability check (CUDA/Metal/CPU)
  - [ ] VRAM detection
  - [ ] Recommend appropriate models

### Model Management System

- [ ] Design model manifest format
- [ ] Create download manager UI (like MacWhisper)
- [ ] Implement quality/speed meter display
- [ ] Add progress indicators for downloads
- [ ] Store models locally with versioning

## Phase 2: Transcript-Based Editor MVP (Week 3-6)

### Core Editor Features

- [ ] Evaluate Audapolis for forking potential
- [ ] If not forking, build custom editor:
  - [ ] Waveform visualization (wavesurfer.js)
  - [ ] Transcript display (Monaco editor)
  - [ ] Time-sync between audio and text
  - [ ] Click word to jump to audio position
  - [ ] Select text to select audio region

### Character Extraction Pipeline

- [ ] Movie file import (support common formats)
- [ ] Subtitle/transcript import (.srt, .vtt, .txt)
- [ ] If no subtitles available:
  - [ ] Auto-transcribe with Whisper
  - [ ] Display transcription progress
- [ ] Character identification:
  - [ ] Manual character labeling
  - [ ] Speaker diarization (Pyannote)
  - [ ] Character name detection from script

### Editing Tools

- [ ] Select character from dropdown
- [ ] Auto-highlight all character lines
- [ ] Bulk select/export character dialogue
- [ ] Manual adjustment tools:
  - [ ] Extend/trim clip boundaries
  - [ ] Split/merge clips
  - [ ] Preview individual clips
- [ ] Export options:
  - [ ] Individual WAV files per line
  - [ ] Concatenated character audio
  - [ ] Keep video segments option

## Phase 3: Audio Enhancement (Week 7-8)

### Local Processing

- [ ] Integrate DeepFilterNet for noise reduction
- [ ] Add RNNoise as lightweight option
- [ ] Implement Demucs for voice isolation
- [ ] Create quality comparison UI

### API Integration (Optional)

- [ ] ElevenLabs Voice Isolator integration
- [ ] Play.ht Audio Cleaner integration
- [ ] Adobe Enhance Speech (manual workflow)
- [ ] Add API key management

### Enhancement UI

- [ ] Before/after preview
- [ ] Processing queue with progress
- [ ] Batch processing support
- [ ] Quality settings (fast/balanced/best)

## Phase 4: Voice Cloning (Week 9-10)

### TTS Model Integration

- [ ] Primary: Orpheus 3B with Unsloth
  - [ ] 4-bit quantization support
  - [ ] Fine-tuning scripts
- [ ] Instant cloning: MeloTTS/OpenVoice2
- [ ] Budget option: Kokoro via Replicate
- [ ] Premium option: MiniMax Speech-02-HD

### Training Pipeline

- [ ] One-click training from character clips
- [ ] Training progress visualization
- [ ] Model evaluation/preview
- [ ] Save/load voice profiles
- [ ] Export trained models

## Phase 5: AI Assistant Integration (Week 11-12)

### LLM Backend

- [ ] Ollama integration for local models
- [ ] Model selection based on hardware
- [ ] System prompt templates per character
- [ ] Conversation memory (ChromaDB)

### Voice Assistant Pipeline

- [ ] Microphone input → Whisper STT
- [ ] Text → LLM → Response
- [ ] Response → Character TTS → Audio
- [ ] Latency optimization

### Character Personality

- [ ] Import character dialogue as training data
- [ ] Generate character profile from transcript
- [ ] Personality tuning interface
- [ ] Save/load character configs

## Phase 6: Polish & Advanced Features (Week 13+)

### UI/UX Improvements

- [ ] Onboarding tutorial
- [ ] Keyboard shortcuts
- [ ] Dark/light theme
- [ ] Project management (save/load)
- [ ] Undo/redo system

### Advanced Features

- [ ] Multi-character conversation support
- [ ] System audio capture for streaming
- [ ] LLM fine-tuning on character dialogue
- [ ] Voice mixing/blending
- [ ] Batch movie processing

### Performance

- [ ] GPU acceleration optimization
- [ ] Model caching strategies
- [ ] Background processing
- [ ] Memory management

## Phase 7: Distribution (When Ready)

### Packaging

- [ ] Code signing for Mac/Windows
- [ ] Auto-updater integration
- [ ] Installer creation
- [ ] Model CDN setup

### Documentation

- [ ] User guide with screenshots
- [ ] Video tutorials
- [ ] API documentation
- [ ] Model compatibility matrix

### Community

- [ ] GitHub repository setup
- [ ] Discord/forum creation
- [ ] Contribution guidelines
- [ ] License selection (GPL/MIT?)

## Key Decisions Needed Now

1. **Audapolis Integration**
   - Fork and modernize? (Pros: faster start, Cons: technical debt)
   - Build from scratch? (Pros: exact features, Cons: more work)
   - Hybrid approach? (Use concepts, not code)

2. **Distribution Model**
   - Open source everything?
   - Open source app, paid model hub?
   - Freemium with advanced features?

3. **Legal Safeguards**
   - Terms of service checkbox
   - Watermarking options
   - Usage analytics (opt-in)

## Success Metrics

- [ ] Extract character voice in < 5 minutes
- [ ] Training time < 30 minutes on consumer GPU
- [ ] Real-time conversation with < 2s latency
- [ ] 90%+ user success rate on first try

## MVP Definition

The absolute minimum for v0.1:

1. Import movie + subtitle file
2. See transcript with character labels
3. Select character → export all their audio
4. Basic noise reduction
5. Train simple TTS model
6. Text chat with character voice output

Everything else is iterative improvement!
