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

- [ ] Redesign the home screen around actual project/file entry points instead of a generic upload splash.
- [ ] Research and design a real left sidebar for local projects/files, including how files are created, listed, selected, renamed, and removed.
- [ ] Isolate editor state per open file/project so undo/redo, selected segment, playback time, view, and panel state do not leak across files.
- [ ] Decide the local project data model: single transcript file, project JSON with media sidecar, or indexed local library.
- [ ] Add a real add-speaker flow from the timeline speaker header.
- [ ] Validate speaker-row menu placement at narrow widths and short timeline heights, especially hover submenus near the viewport edge.
- [ ] Turn assisted cleanup placeholders into a review queue with accept/reject actions instead of disabled buttons.
- [ ] Preserve and display transcript/source dates when provider metadata includes them.
- [ ] Run a visual QA pass for the multi-speaker fixture across Review and Editor views.
- [ ] Revisit whether grid/edge snap controls should move into a compact timeline settings menu.

## External Validation

- [ ] Re-check the live Superwhisper transcription endpoint once `/v1/transcriptions` stops returning Cloudflare 502 for the small diarized fixture.
