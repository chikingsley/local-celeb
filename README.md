# Local Celeb

Local Celeb is a local transcript review and editing workbench. The current repo is focused on the transcript UI/product shape: importing existing transcripts, reviewing by speaker turn, editing speaker/timing/segment data, and exporting useful transcript formats.

## Current Shape

- **Review mode** renders the transcript as speaker turns. A turn is one speaker's continuous speech until another speaker starts.
- **Editor mode** keeps the turn, segment, word, and timeline surfaces for diarization, segment boundaries, timing, and word-alignment work.
- The canonical direction is `Transcript -> Turn -> Segment -> Word`; turns are derived from the segment stream instead of stored as duplicate transcript text.
- Transcript files can be imported directly without the proxy: JSON, JSONL, SRT, and VTT.
- Audio/video transcription is still available through the optional Groq proxy when `GROQ_API_KEY` is configured.

## Tech Stack

- React 19, TypeScript, Vite
- Tailwind CSS v4
- Zustand
- Bun
- Optional Elysia/Groq transcription proxy
- Biome

## Setup

```bash
bun install
```

For transcript-only UI work, run just the client:

```bash
bun run dev:client -- --host 0.0.0.0
```

For audio/video transcription through Groq, configure the API key and run both client and server:

```bash
cp .env.example .env.local
# edit .env.local and set GROQ_API_KEY
bun run dev
```

The Vite client defaults to <http://localhost:3000>. The proxy server defaults to port `3001`.

## Scripts

| Command | Description |
| ------- | ----------- |
| `bun run dev` | Start client and optional Groq proxy |
| `bun run dev:client` | Start the Vite client |
| `bun run dev:server` | Start the Elysia/Groq proxy |
| `bun run build` | Build the client |
| `bun run preview` | Preview the production build |
| `bun run typecheck` | Run TypeScript without emit |
| `bun run lint` | Run Biome checks |
| `bun run lint:fix` | Apply Biome safe fixes |

## Useful Paths

- `src/lib/transcript-import.ts`: transcript import adapters.
- `src/lib/transcript-turns.ts`: derived turn model and segment/turn mappings.
- `src/components/ReviewEditor.tsx`: turn-level review surface.
- `src/components/Editor.tsx`: segment-level editor.
- `public/fixtures/`: local sample media/transcript fixtures, including the multi-speaker Scribe fixture.
- `docs/TODO.md`: active product and editor backlog.
- `docs/research/`: evidence notes for transcript shapes and UI/editor references.
