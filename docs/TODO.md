# Local Celeb - TODO

## Vision

**Voice Cloning Prep Pipeline** - From raw video/audio to clean, isolated voice samples ready for cloning (ElevenLabs, local models).

```
Input Sources              Segmentation              Audio Processing           Output
─────────────────          ─────────────             ────────────────           ──────
Video/Audio file    →      Transcription (Whisper)   Silence removal     →      Clean audio per speaker
  +                   →      or                    →   Speaker isolation    →      → Voice cloning service
SRT/VTT subtitles          SRT/VTT import            Normalization              → Local training
```

---

## Phase 1 - Core Improvements ✅ COMPLETED

- [x] Add playback speed control (0.2x - 2.0x, increment 0.2)
- [x] Add segment button functionality (create at cursor position with selected speaker)
- [x] Drag segment edges to adjust timing
- [x] Home button shows welcome page with sidebar visible
- [x] Better visual feedback on selection/highlighting
- [x] shadcn/ui component library integration

## Phase 1.5 - Timeline Enhancements ✅ COMPLETED

- [x] Drag to move entire segment (not just edges)
- [x] Grid snapping (0.5s intervals, toggle in toolbar)
- [x] Edge snapping with visual guides (snap to other segments)
- [x] Auto-scroll during drag
- [x] Right-click context menu (assign speaker, split, copy text, delete)
- [x] Extract snap logic to testable utilities (47 tests)

## Phase 2 - Export & Productivity ✅ COMPLETED

- [x] Export transcripts (TXT, SRT, VTT, JSON, HTML, CSV) with tests
- [x] Keyboard shortcuts (play/pause, seek, undo/redo, find, export)
- [x] Find & Replace (match case, whole word, regex, preserve case, VS Code style UI)
- [x] Command Palette (Cmd+K) for quick access to all features
- [x] Search highlighting in Editor (yellow/orange backgrounds)
- [x] Minimap with viewport indicator and search markers
- [x] Selected text auto-populates Find field
- [x] Word-level timestamps (using Groq Whisper turbo)
- [x] Word-level highlighting during playback (karaoke style - blue underline)

## Phase 2.5 - Sync & Navigation ✅ COMPLETED

**See: [docs/phase-2.5-sync.md](docs/phase-2.5-sync.md) for design decisions**

- [x] Word timestamp interpolation (fills 100% gaps from Whisper's ~92%)
- [x] Word index with O(log n) binary search for playback highlighting
- [x] Unified `seekTo` action as single source of truth
- [x] Editor click-to-seek with word index (includes interpolated words)
- [x] Timeline proportional click-to-seek (click position within segment)
- [x] Auto-follow indicator (red/green) - pauses on user scroll
- [x] `wordsDirty` flag on segments when text is edited
- [x] 22 new tests for word-index utilities

## Phase 3 - Word-Level Editing ✅ COMPLETED

Adds UI for viewing/editing word timestamps.

- [x] Word list in Properties Panel (show all words for selected segment)
  - Display: word text, start time, end time
  - Editable timestamps
  - Click word → seek to that time
  - Highlight current word during playback
- [x] Show "dirty" indicator on segments with `wordsDirty: true`
- [x] Properties Panel auto-follow (shows current segment during playback)
- [x] Editor auto-scroll fix (was using wrong container reference)
- [x] Click-to-seek re-enables auto-follow

## Phase 4 - Alternative Input Sources ⬅️ NEXT

Transcription isn't always needed - movies have subtitles.

- [ ] Import SRT/VTT files as segment source (skip transcription)
- [ ] Import existing transcripts (JSON format)
- [ ] Auto-detect subtitle files alongside video
- [ ] Map subtitle cues to segments with speaker assignment UI

## Phase 5 - Audio Visualization

Foundation for audio editing features.

- [ ] Waveform visualization in Timeline (Web Audio API / AudioContext)
- [ ] Waveform thumbnail per segment
- [ ] Zoom into waveform detail
- [ ] Visual silence detection (highlight low-amplitude regions)

## Phase 6 - Audio Processing & Export

The core value for voice cloning prep.

- [ ] Silence gap visualization (gray blocks between segments)
- [ ] Delete silence gaps (shifts segment times)
- [ ] Speaker isolation (vocal separation - Demucs/Spleeter via ffmpeg or API)
- [ ] Export audio per speaker (concatenate all segments for a speaker)
- [ ] Audio normalization
- [ ] Noise reduction (optional)
- [ ] "Remove all silence" bulk action (Descript-style)
- [ ] Export to voice cloning services
  - ElevenLabs API integration
  - Local export for other services

## Phase 7 - Desktop App (Tauri)

Native performance, local processing, offline support.

- [ ] Initialize Tauri in project
- [ ] Configure native window (size, title, menu bar)
- [ ] Local transcription with FluidAudio (Apple platforms)
  - Rust ↔ Swift FFI bridge
  - Parakeet TDT v3 model
  - Speaker diarization support
  - See: <https://github.com/FluidInference/FluidAudio>
- [ ] Whisper.cpp fallback for non-Apple platforms
- [ ] Local speaker isolation (Demucs model)
- [ ] Offline mode support
- [ ] Auto-updates
- [ ] Code signing & notarization (macOS)

## Phase 8 - Settings, Storage & Collaboration

- [ ] Settings menu/modal (theme, shortcuts, defaults)
- [ ] Cloudflare R2 integration for audio storage
- [ ] Project persistence to cloud
- [ ] User authentication with Clerk
- [ ] Project sharing
- [ ] Version history

---

## Future Enhancements (Backlog)

### Timeline Word Expansion

- [ ] Expand segment to word blocks in Timeline on focus/hover
- [ ] Roll/ripple edit handles between words (adjust shared boundary)
- [ ] Collapse back when focus leaves

### Other

- [ ] "Re-align" button - send segment audio slice for re-transcription (requires backend)
- [ ] Multiple projects support
- [ ] Minimap with actual text rendering (Canvas approach, VS Code style)
- [ ] Find in Timeline (not just Editor)
- [ ] Batch processing (multiple files)

---

## Technical Debt

- [x] Fix server setup (Elysia + Bun + Groq Whisper)
- [x] Fix TS errors in components (FindReplace, Minimap, CommandPalette)
- [ ] Add comprehensive test coverage
- [ ] Set up CI/CD pipeline
- [ ] Add error boundaries
- [ ] Improve accessibility (ARIA labels, keyboard navigation)
- [ ] Performance optimization for large transcripts

---

## Notes

### Why Tauri?

- **Bundle size**: 2.5-10 MB (vs Electron's 80-120 MB)
- **RAM usage**: 30-40 MB (vs Electron's 200-400 MB)
- **Native performance**: Rust backend, system WebView
- **Swift FFI**: Easy integration with FluidAudio
- **Your React/Vite/Tailwind code works as-is**

### FluidAudio Integration

FluidAudio is a Swift SDK for Apple platforms (macOS/iOS) that provides:

- State-of-the-art speech recognition using Parakeet models
- Speaker diarization (who spoke when)
- Runs locally on device
- No cloud dependencies

Integration path:

1. Tauri Rust backend calls Swift via FFI
2. Swift code uses FluidAudio SDK
3. Results passed back to React frontend via Tauri commands

### Voice Cloning Workflow

The end-to-end dream workflow:

1. **Upload** movie/video file
2. **Extract** audio track (ffmpeg)
3. **Diarize** speakers (FluidAudio or pyannote)
4. **Optional**: Import official subtitles for timing (skip transcription)
5. **Segment** by speaker with timeline UI
6. **Clean** each speaker's audio:
   - Isolate vocals (remove music/sfx)
   - Remove silence gaps
   - Normalize levels
7. **Export** clean audio per speaker
8. **Send** to ElevenLabs or local cloning model

This replaces manual work in Audacity/Logic with a purpose-built tool.
