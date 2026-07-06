# Transcript Shapes Evidence

Date: 2026-07-04

This note records the evidence checked before locking the transcript model. The goal is to keep the app model tied to actual transcript artifacts instead of guessing from a preferred UI.

## Sources Checked

### Local Celeb Groq Shape

Files:

- `public/sample-transcript.json`
- `dist/sample-transcript.json`
- `server/src/index.ts`
- `src/types/index.ts`
- `docs/phase-2.5-sync.md`

Observed shape:

```json
{
  "meta": {},
  "segments": [
    {
      "id": "seg-1",
      "speakerId": "speaker_1",
      "startTime": "00:00",
      "endTime": "00:02",
      "text": "Life's not fair, is it?",
      "words": [
        { "word": "Life's", "start": 0.26, "end": 0.92 }
      ]
    }
  ]
}
```

The current Groq proxy requests `response_format: "verbose_json"` and `timestamp_granularities: ["word", "segment"]`. It maps provider segments into the app's `Segment` shape, assigns every segment to `speaker_1`, and filters provider words into each segment by timestamp.

Implications:

- Groq gives segment and word timing, but not diarization in the current path.
- The app's current persisted unit is segment-first.
- Word timing can be incomplete. The prior local note measured 521 timestamped words out of 568 text words on a 4:30 sample, or 91.7 percent coverage.
- The current app already marks edited segment text with `wordsDirty`.
- SRT/VTT export is segment-based.

### Retained Scribe JSONL Shape

Files:

- `/home/simon/github/jobkit/tefl-course/sources/las-vegas-teaching-archive/transcripts-diarized.jsonl`
- `/home/simon/github/jobkit/tefl-course/src/tefl_course/pipeline/turns.py`
- `/home/simon/github/jobkit/tefl-course/src/tefl_course/pipeline/transcribe_archive.py`

Observed record count: 714 line-delimited JSON records.

Observed top-level keys:

```json
[
  "audio_path",
  "datetime",
  "duration",
  "model_id",
  "model_key",
  "processing_time",
  "provider",
  "raw_response",
  "recording_id",
  "transcript"
]
```

Observed `raw_response` keys:

```json
[
  "audio_duration_secs",
  "language_code",
  "language_probability",
  "text",
  "transcription_id",
  "words"
]
```

Observed word item:

```json
{
  "text": "Unit",
  "start": 0.419,
  "end": 0.699,
  "type": "word",
  "speaker_id": "speaker_0",
  "logprob": -0.0005782362422905862
}
```

Observed spacing item:

```json
{
  "text": " ",
  "start": 0.699,
  "end": 0.879,
  "type": "spacing",
  "speaker_id": "speaker_0",
  "logprob": -0.003607671707868576
}
```

Across the retained JSONL, word-level speaker labels included `speaker_0` through `speaker_12`. Word item type counts were:

```text
184639 word
184917 spacing
1020 audio_event
```

Current importer smoke on the full retained JSONL produced 13,171 segments, 184,639 timed words, 13 speakers, `recordCount=714`, and one expected concatenation warning. This verifies the Scribe adapter against the retained file, not against the live service.

The rendering pipeline derives display blocks from raw words with `words_to_turns(words)`. That helper accepts Scribe-style `text` / `speaker_id` and Deepgram-style `word` / `punctuated_word` / `speaker`.

Important correction for Local Celeb:

- The `jobkit` helper calls its output `Turn`, but it breaks on speaker change or a silence gap.
- For this app, reserve `Turn` for the user's definition: one speaker's continuous speech until another speaker speaks.
- A silence gap inside the same speaker's speech should create a segment, subtitle cue, or display break, not a new canonical turn.

Implications:

- Scribe evidence is word-first, not segment-first.
- Speaker cleanup can be derived from word speaker labels even when provider segments are absent.
- `logprob`, `language_code`, and `language_probability` are useful quality metadata and should not be discarded at import.
- Spacing and audio-event items mean word normalization cannot assume every item is a spoken word.

### Historical Pimsleur Scribe Workflow

Evidence from prior chat/memory, not live files in this checkout:

- The older maintained package path was `audio_model("scribe-v2")` plus `create_process_fn(..., key=None, language=..., diarize=True)`.
- The useful artifact was `TranscriptResult.as_dict()["raw_response"]`, especially `raw_response.words`.
- A 10 second Hebrew fixture had previously returned `provider=elevenlabs`, `model_key=scribe-v2`, `words=27`, and `speaker_labels=2`.
- A larger Pimsleur run preserved raw JSON, normalized result JSON, and turn text files.
- A 2026-06-20 migration check against the deployed service found that `timestamps: true` is required before service words include `start` / `end`.
- In that service shape, `words` items are `{ text, start, end, speaker }`, where `speaker` is like `speaker_0`; they do not include Scribe raw `type: "spacing"` items or `speaker_id`.
- The same migration reconstructed old-shape `raw_response.words` for compatibility by mapping service `speaker` to `speaker_id` and preserving timestamped words.

Local verification note:

- The old `/home/simon/github/episodic/all-language-data-work/french-course-transcripts/Pimsleur` checkout is not present on this machine now.
- Treat this as historical evidence for provider shape and workflow requirements, not a currently inspected artifact.

### Deployed Superwhisper Service

Files:

- `/home/simon/github/peacock-asr/packages/omni-curator/src/omni_curator/scribe/swservice.py`
- `home-mac:~/GitHub/superwhisper-api/cloudflare-api/src/routes/transcriptions.ts`
- `home-mac:~/GitHub/superwhisper-api/cloudflare-api/src/jobs/schema.ts`
- `home-mac:~/GitHub/superwhisper-api/cloudflare-api/src/jobs/transcription.ts`
- `home-mac:~/GitHub/superwhisper-api/cloudflare-api/src/captions/models.ts`
- `home-mac:~/GitHub/superwhisper-api/cloudflare-api/src/captions/converters.ts`
- `home-mac:~/GitHub/superwhisper-api/gmkserver-api/src/gmkserver_api/service/routes/transcription.py`
- Chat-history service migration prompt from 2026-06-20

Current checked service-family contract:

- The local `omni-curator` wrapper posts a readable local path to `/v1/transcriptions` and reads a result dict inline.
- The current Cloudflare Worker route uses an upload-backed `input_key`, returns `202` with a job view, and stores the same build-result shape in `jobs.result_json`.
- The gmkserver FastAPI route assembles a Cloudflare `buildResult`-shaped result dict inline.
- In the shared result shape, callers read `result["transcript"]`.
- When requested with `detail`, callers read `result["words"]` and `result["turns"]`.
- `timestamps=True` controls whether returned word and turn JSON includes `start` / `end`.
- The current caption model is `CaptionWord { text, start, end, speaker?, confidence? }` and `CaptionTurn { text, start, end, speaker?, words }`.

Historical prompt contract:

- A migration prompt described `POST /v1/transcriptions` returning `202 {job_id}`, then polling `/v1/jobs/{id}`.
- The same prompt said final output exposes `.result.transcript`, `.result.words`, and `.result.turns`.
- The import adapter should therefore tolerate both direct result dicts and job-wrapper `.result` dicts.

Historical live fixture evidence from 2026-06-20:

- `detail: ["words", "turns"]` without `timestamps: true` returned words without `start` / `end`.
- With `timestamps: true`, service words carried `text`, `start`, `end`, and `speaker`.
- Service turns used display-style speaker labels such as `Speaker 1`, so provider turns should not be copied directly into canonical UI turns without normalization.

Current home-mac code evidence:

- Cloudflare `TranscriptionRequestSchema` says `detail: ["words", "turns"]` is structured detail for `jobs.result_json`; `diarize=true` implies turns.
- `timestamps` is separate from `detail`; JSON renderers omit `start` / `end` when timestamps are not included.
- `cloudflare-api/src/captions/converters.ts` derives turns from words by speaker change or a gap over 3 seconds, so its turns are still provider/caption turns, not this app's canonical speaker-change-only turn definition.

Live check:

- `SUPERWHISPER_API_BASE` and `SUPERWHISPER_API_KEY` are configured in the adjacent `jobkit` repo.
- A tiny 8 second clip made from `public/sample.mp3` was posted with `asr_model: "scribe-v2"`, `diarize: true`, `detail: ["words", "turns"]`, and `timestamps: true`.
- The deployed service returned HTTP 502 on 2026-07-04.
- Re-check on 2026-07-04: `/health` returned `200 {"status":"ok"}` and `/v1/models` listed `scribe-v2` plus `deepgram-nova-3` as current diarization-capable audio models, but the same 8 second fixture still returned Cloudflare HTTP 502 HTML for both `scribe-v2` and `deepgram-nova-3`.
- Latest re-check on 2026-07-04: `/health` still returned `200`, `/v1/models` listed audio models including `scribe-v2`, `deepgram-nova-3`, `s1-voice`, and `ultra`, but `/v1/transcriptions` for the 8 second `scribe-v2` diarized `detail=["words","turns"]` fixture still returned Cloudflare HTTP 502 HTML.

Implications:

- The service contract is real enough to support an adapter, but the live transcription path was not healthy enough to confirm runtime result shape today.
- The adapter should tolerate either direct result dicts or job-wrapper result dicts.
- Do not make the UI depend on live Superwhisper while the app is still a local product workbench.
- Keep the fixture-backed live import as external validation to revisit after the deployed endpoint returns a real payload; do not keep it as active Local Celeb repo work.

## Model Conclusions

Use this canonical hierarchy in the UI:

```text
Transcript
  Turn
    Segment
      Word
```

But import adapters need to accept these source shapes:

| Source | Native units | Speaker labels | Timing | Quality metadata |
| --- | --- | --- | --- | --- |
| Local Celeb / Groq | segments plus optional words | app assigns one speaker | segment and partial word timing | segment stats from Groq, not currently stored |
| Scribe raw JSONL | words | `speaker_id` per word and spacing item | word timing | `logprob`, language metadata |
| Superwhisper service | transcript plus optional words and turns | `speaker` in words; display labels possible in turns | optional word and turn timing gated by `timestamps: true` | service/provider metadata varies |
| SRT/VTT | subtitle cues | VTT voice tags or none | cue timing | usually none |

Canonical rules:

- `Turn` is a speaker-change unit. Same-speaker adjacent material stays in one turn.
- `Segment` is the subtitle, timeline, and audio-editing unit inside a turn.
- `Word` is the alignment unit and may be incomplete, missing, interpolated, dirty, or provider raw.
- Provider-supplied turns can seed the model, but they must be normalized against the speaker-change definition.
- If only words exist, derive turns from consecutive speaker labels and derive segments separately.
- If only segments exist, derive turns from adjacent same-speaker segments.
- If only SRT/VTT exists, create segment-only data and mark word alignment absent.
- Missing provider word speakers should normalize to `speaker_0`, matching the Scribe fallback; transcript-only UI imports can keep the existing `speaker_1` fallback.
- Text edits mark affected word alignment dirty.
- Speaker edits can merge or split turns because turns are derived from speaker continuity.
- Preserve provider raw metadata separately enough to audit import quality and rebuild mapping decisions.

Near-term implementation consequence:

- Add import-normalization helpers before redesigning the editor UI.
- Start with three adapters: current Local Celeb JSON/Groq, Scribe raw JSONL, and SRT/VTT.
- Keep Superwhisper service support optional until the deployed ASR endpoint is healthy in a live check.
- The local adapter accepts mocked direct service results and job-wrapper `.result` results; the fixture-backed service import check stays open until the endpoint returns a real healthy payload.
