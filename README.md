# Local Celeb

Local Celeb is a local transcript review and editing workbench. The current repo is focused on the transcript UI/product shape: importing existing transcripts, reviewing by speaker turn, editing speaker/timing/segment data, and exporting useful transcript formats.

## Current Shape

- **Review mode** renders the transcript as speaker turns. A turn is one speaker's continuous speech until another speaker starts.
- **Editor mode** keeps the turn, segment, word, and timeline surfaces for diarization, segment boundaries, timing, and word-alignment work.
- The canonical direction is `Transcript -> Turn -> Segment -> Word`; turns are derived from the segment stream instead of stored as duplicate transcript text.
- Transcript files can be imported directly: JSON, JSONL, SRT, and VTT.
- Audio/video files can be opened together with an SRT/VTT sidecar transcript. Live transcription is intentionally out of scope for this UI workbench.

## Tech Stack

- React 19, TypeScript, Vite
- Tailwind CSS v4
- shadcn/Base UI components
- Zustand
- Bun
- Biome

## Setup

```bash
bun install
```

Run the Vite app:

```bash
bun run dev
```

The Vite dev server binds to `0.0.0.0` on port `3000` so it can be reached from another machine on the same network.

## Scripts

| Command | Description |
| ------- | ----------- |
| `bun run dev` | Start the Vite client on `0.0.0.0:3000` |
| `bun run build` | Build the client |
| `bun run preview` | Preview the production build |
| `bun run typecheck` | Run TypeScript without emit |
| `bun run lint` | Run Biome checks |
| `bun run lint:fix` | Apply Biome safe fixes |

## Useful Paths

- `src/app/`: app shell, sidebar, view state, and layout constants.
- `src/features/`: feature surfaces for editor, timeline, export, find/replace, settings, and welcome.
- `src/components/ui/`: generated shadcn/Base UI primitives.
- `src/domain/transcript/`: transcript types, import/export adapters, turn derivation, and word alignment.
- `src/domain/timeline/`: timeline math and gap repair helpers.
- `public/fixtures/`: local sample media/transcript fixtures, including the multi-speaker Scribe fixture.
- `docs/TODO.md`: active product and editor backlog.
- `docs/research/`: evidence notes for transcript shapes and UI/editor references.
