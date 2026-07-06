# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added an evidence-backed transcript model with `Transcript -> Turn -> Segment -> Word` as the canonical hierarchy.
- Added import normalization for Local Celeb JSON, Scribe JSONL word-first records, Superwhisper-style provider JSON, job-wrapper results, SRT, and VTT.
- Added Review and Editor workflows, with Editor views for Turns, Segments, and Words.
- Added turn-based review/editing, turn-level JSON export, subtitle export, review text export, project JSON export, and segment/word JSON export.
- Added sidecar media/subtitle import detection for local media plus SRT/VTT files.
- Added a retained multi-speaker Scribe fixture and matching MP3 sample for speaker-repair UI testing.
- Added waveform rendering, per-segment waveform thumbnails, silence-gap visualization, close-gaps timing repair, local word re-alignment, and browser-generated audio export by speaker or turn.
- Added mode-aware right panels for review metadata/actions and editor view/assisted cleanup details.

### Changed

- Renamed the visible cleanup workflow to `Editor` and moved the `Turns | Segments | Words` view selector into the right panel.
- Moved manual speaker management toward the timeline speaker rail, including inline rename, color cycling, speaker deletion, and hover-based move-segments submenu.
- Simplified timeline controls by making drag-near-edge scrolling automatic and removing the non-action waveform status badge.
- Made the Groq transcription proxy optional/configurable and updated environment/server docs away from the older Gemini wording.
- Updated dependencies and shadcn/Tailwind-related component setup for the current app direction.
- Refreshed `docs/TODO.md` to be active-work only instead of a completed phase checklist.

### Removed

- Deleted the archived Tauri example project from `docs/tauri-example-project`.
- Deleted the low-value Vitest/unit-test layer and old test setup.
- Removed `package-lock.json` in favor of the Bun lockfile.

### Fixed

- Fixed transcript import/export flows around provider metadata, missing word timing, dirty alignment state, and optional service wrappers.
- Fixed playback/editor follow behavior so manual scroll can pause following and click/seek actions resume it.
- Fixed timeline track clipping at short panel heights by giving the track surface enough height to match speaker rows.

## [0.5.0] - 2024-12-01

### Added

- **Word-level editing in Properties Panel**
  - Shows all words for selected segment with timestamps
  - Editable start/end times per word
  - Click word to seek to that time
  - Current word highlighted during playback
  - "Out of sync" badge when text edited but timestamps stale
- **Save status indicator** - Shows "Saved just now" / "Saved Xm ago" with green dot in toolbar
- **Properties Panel auto-follow** - Automatically shows current segment during playback
- **Editor auto-scroll** - Fixed bug where Editor wasn't scrolling during playback
- **Click-to-seek re-enables auto-follow** - Clicking a segment/word jumps there and continues following

### Changed

- **Properties Panel redesign**
  - Darker section headers (slate-100 background)
  - Editable file name (click to edit)
  - Editable segment duration field (alongside start/end)
  - Removed redundant "Preview Text" section
  - Cleaner visual hierarchy
- **Welcome screen redesign** - Modern AI-app style (like Claude/ChatGPT), removed gradient backgrounds
- Updated TODO with new vision: Voice Cloning Prep Pipeline

### Fixed

- Editor auto-scroll now works correctly (was using wrong scroll container reference)
- Click on segment/word now properly re-enables auto-follow if it was disabled by scrolling

## [0.4.0] - 2024-11-28

### Added

- **Drag to move entire segment** - Grab center of segment to reposition (not just edges)
- **Grid snapping** - Segments snap to 0.5s intervals when dragging (toggle in toolbar)
- **Edge snapping** - Segments snap to other segment edges with visual guide lines (toggle in toolbar)
- **Auto-scroll during drag** - Timeline scrolls when dragging segments near edges (toggle in toolbar)
- **Right-click context menu** on segments:
  - Assign speaker (submenu)
  - Split segment at center
  - Copy text to clipboard
  - Delete segment

### Changed

- **Improved selection highlighting** - Increased background opacity, added blue glow effect, thicker borders
- Segment drag handles now have visual indicators (vertical lines)
- Active segment (under playhead) now has stronger amber ring

### Removed

- Removed unused `react-timeline-editor` dependency (evaluating but not using)

## [0.3.0] - 2024-11-26

### Added

- Playback speed control (0.2x - 2.0x) with Select dropdown
- Add segment button creates new segments at cursor position
- Drag segment edges to adjust timing in timeline
- shadcn/ui component library (Button, Select, Slider, Tooltip)
- Radix UI primitives for accessible components

### Changed

- Home button now shows welcome page with sidebar visible
- Sidebar navigation now functional (Home, Projects)
- Improved visual feedback on selection (border, ring, background)
- Segments highlight when playing (amber) and selected (blue)
- Timeline segments now clickable to select and seek

## [0.2.0] - 2024-11-26

### Added

- Zustand state management with persistence
- ElysiaJS backend for secure API calls
- Biome for linting and formatting
- Vitest with React Testing Library
- Project persistence to localStorage
- Proper time formatting utilities

### Changed

- Migrated from inline state to Zustand stores
- Moved API calls to backend (no more exposed keys)
- Restructured project to src/ directory

### Fixed

- Memory leak with Object URLs (now properly revoked)
- Timeline time formatting bug (was using toISOString incorrectly)
- Various lint errors and type issues

### Security

- API keys now stored server-side only
- Added input validation with Zod schemas

## [0.1.0] - 2024-11-25

### Added

- Initial transcription editor
- Audio file upload and playback
- Segment-based transcript editing
- Speaker management (add, rename, color)
- Timeline visualization with zoom
- Undo/redo functionality
- Gemini AI transcription integration
- Dark mode UI
