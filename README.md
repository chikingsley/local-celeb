# Local Celeb

Professional AI transcription editor with speaker diarization and voice cloning preparation.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS v4
- **State Management:** Zustand
- **Backend:** ElysiaJS (Bun)
- **AI:** Google Gemini API
- **Testing:** Vitest + React Testing Library
- **Linting/Formatting:** Biome

## Project Structure

```text
local-celeb-3/
├── src/
│   ├── components/     # React components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utilities (cn, formatTime, etc.)
│   ├── services/       # API services
│   ├── stores/         # Zustand stores
│   ├── test/           # Test setup
│   ├── types/          # TypeScript types & Zod schemas
│   ├── App.tsx         # Main app component
│   ├── main.tsx        # Entry point
│   └── index.css       # Global styles
├── server/
│   └── index.ts        # ElysiaJS backend (Gemini proxy)
├── biome.json          # Biome config
├── vite.config.ts      # Vite config
├── vitest.config.ts    # Vitest config
└── tsconfig.json       # TypeScript config
```

## Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- Google Gemini API key

## Setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Set up your environment:

   ```bash
   cp .env.local.example .env.local
   # Edit .env.local and add your GEMINI_API_KEY
   ```

3. Start the development servers:

   ```bash
   # Terminal 1 - Frontend
   bun run dev:client

   # Terminal 2 - Backend (API proxy)
   bun run dev:server
   ```

   Or run both together:

   ```bash
   bun run dev
   ```

4. Open <http://localhost:3000>

## Scripts

| Command | Description |
| ------- | ----------- |
| `bun run dev` | Start both frontend and backend |
| `bun run dev:client` | Start Vite dev server (port 3000) |
| `bun run dev:server` | Start ElysiaJS server (port 3001) |
| `bun run build` | Build for production |
| `bun run preview` | Preview production build |
| `bun run test` | Run tests in watch mode |
| `bun run test:run` | Run tests once |
| `bun run lint` | Check code with Biome |
| `bun run lint:fix` | Fix lint issues |
| `bun run format` | Format code with Biome |

## Features

- Upload audio/video files for transcription
- AI-powered speaker diarization
- Interactive transcript editor
- Timeline visualization with playback controls
- Speaker management (rename, merge, reorder, delete)
- Undo/redo support
- Resizable panels
