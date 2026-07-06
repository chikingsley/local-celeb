# Local Transcription Proxy

This Elysia server is optional. The app can import existing JSON, JSONL, SRT,
and VTT transcript files without running the proxy.

Run it from the repo root when you want audio/video transcription through Groq:

```bash
cp .env.example .env.local
# edit .env.local and set GROQ_API_KEY
bun run dev:server
```

Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | empty | Enables `/api/transcribe`; missing key returns `503` instead of crashing. |
| `TRANSCRIPTION_SERVER_PORT` | `3001` | Server port. `PORT` is also accepted. |
| `GROQ_MODEL` | `whisper-large-v3-turbo` | Groq speech-to-text model. |
| `GROQ_LANGUAGE` | `en` | Language hint sent to Groq. |

The health route stays available even without an API key:

```bash
curl http://localhost:3001/api/health
```
