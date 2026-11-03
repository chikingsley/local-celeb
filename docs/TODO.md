# Local Celeb - TODO

Active work only. Completed reference work belongs in `CHANGELOG.md` or focused docs under `docs/research/`.

## Current Product Shape

Local Celeb is a transcript UI/product workbench for shaping reusable transcript review and editing flows.

- **Review**: read, search, summarize, ask questions, inspect metadata, and export transcripts.
- **Editor**: repair speaker turns, segment boundaries, timing, line breaks, and word alignment.

Canonical hierarchy:

```text
Transcript
  Turn
    Segment
      Word
```

- **Turn**: one speaker's continuous speech until another speaker starts.
- **Segment**: a timed chunk used for subtitles, timeline editing, audio operations, and alignment.
- **Word**: the smallest alignment unit, with optional timing and confidence metadata.

## Next Work

- [ ] Redesign the home screen around the bundled Samples list and transcript/media import entry points instead of a generic upload splash.
- [ ] Reset transient editor state deliberately when switching samples or importing a new transcript so undo/redo, selection, playback time, and panel state do not leak.
- [ ] Add a real add-speaker flow from the timeline speaker header.
- [ ] Validate speaker-row menu placement at narrow widths and short timeline heights, especially hover submenus near the viewport edge.
- [ ] Add an optional AI analyzer that emits the existing proposal format for contextual grammar, terminology, speaker-name, and diarization findings without mutating transcript text directly.
- [ ] Expand and persist per-transcript style profiles beyond the deterministic American/British spelling and serial-comma prototype; see `docs/research/transcript-style-profiles.md`.
- [ ] Attach reference labels or URLs to AI proposals when a style profile names an external dictionary, style guide, or terminology list.
- [ ] Preserve and display transcript/source dates when provider metadata includes them.
- [ ] Run a visual QA pass across the ten bundled samples for Review, Editor, proposal navigation, follow/resume behavior, minimap playback markers, and filled waveforms.
- [ ] Revisit whether grid/edge snap controls should move into a compact timeline settings menu.
