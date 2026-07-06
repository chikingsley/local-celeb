import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";
import Groq from "groq-sdk";

// Word timestamp from Groq
interface WordTimestamp {
	word: string;
	start: number;
	end: number;
}

// Segment from Groq verbose_json response
interface GroqSegment {
	id: number;
	seek: number;
	start: number;
	end: number;
	text: string;
	tokens: number[];
	temperature: number;
	avg_logprob: number;
	compression_ratio: number;
	no_speech_prob: number;
}

// Our output segment format
interface OutputSegment {
	id: string;
	speakerId: string;
	startTime: string;
	endTime: string;
	text: string;
	words?: WordTimestamp[];
}

const port = Number(process.env.TRANSCRIPTION_SERVER_PORT ?? process.env.PORT ?? 3001);
const groqModel = process.env.GROQ_MODEL ?? "whisper-large-v3-turbo";
const groqLanguage = process.env.GROQ_LANGUAGE ?? "en";
const hasGroqApiKey = () => Boolean(process.env.GROQ_API_KEY);

// Convert seconds to MM:SS format
function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// Convert base64 to File for Groq API
function base64ToFile(base64: string, mimeType: string): File {
	const byteCharacters = atob(base64);
	const byteNumbers = new Array(byteCharacters.length);
	for (let i = 0; i < byteCharacters.length; i++) {
		byteNumbers[i] = byteCharacters.charCodeAt(i);
	}
	const byteArray = new Uint8Array(byteNumbers);
	const blob = new Blob([byteArray], { type: mimeType });

	// Extract extension from mime type
	const ext = mimeType.split("/")[1] || "wav";
	return new File([blob], `audio.${ext}`, { type: mimeType });
}

const app = new Elysia()
	.use(cors())
	.get("/api/health", () => ({
		status: "ok",
		provider: "groq",
		configured: hasGroqApiKey(),
		model: groqModel,
		language: groqLanguage,
		timestamp: new Date().toISOString(),
	}))
	.post(
		"/api/transcribe",
		async ({ body, set }) => {
			const apiKey = process.env.GROQ_API_KEY;
			if (!apiKey) {
				set.status = 503;
				return {
					error:
						"Groq transcription proxy is not configured. Set GROQ_API_KEY or import transcript files directly.",
				};
			}

			const groq = new Groq({ apiKey });

			try {
				// Convert base64 to File
				const audioFile = base64ToFile(body.audio, body.mimeType);

				console.log(`Transcribing audio: ${audioFile.size} bytes, type: ${body.mimeType}`);

				// Call Groq's Whisper API with word-level timestamps
				const transcription = await groq.audio.transcriptions.create({
					file: audioFile,
					model: groqModel,
					response_format: "verbose_json",
					timestamp_granularities: ["word", "segment"],
					language: groqLanguage,
					temperature: 0,
				});

				console.log("Transcription complete:", transcription.text?.substring(0, 100));

				// Transform Groq response to our segment format
				// Note: Whisper doesn't do speaker diarization, so we assign all to speaker_1
				// For diarization, we'd need to add pyannote or similar
				const groqSegments = (transcription as { segments?: GroqSegment[] }).segments || [];
				const groqWords = (transcription as { words?: WordTimestamp[] }).words || [];

				const segments: OutputSegment[] = groqSegments.map((seg, index) => {
					// Find words that belong to this segment
					const segmentWords = groqWords.filter(
						(w) => w.start >= seg.start && w.end <= seg.end + 0.1
					);

					return {
						id: `segment-${index}-${Date.now()}`,
						speakerId: "speaker_1", // No diarization with Whisper
						startTime: formatTime(seg.start),
						endTime: formatTime(seg.end),
						text: seg.text.trim(),
						words: segmentWords,
					};
				});

				// Log word coverage (Whisper typically returns ~90% with timestamps)
				const totalTextWords = groqSegments.reduce(
					(sum, s) => sum + s.text.trim().split(/\s+/).length,
					0
				);
				const totalTimestampedWords = segments.reduce((sum, s) => sum + (s.words?.length || 0), 0);
				console.log(
					`Word coverage: ${totalTimestampedWords}/${totalTextWords} (${((totalTimestampedWords / totalTextWords) * 100).toFixed(0)}%)`
				);

				// If no segments but we have text, create a single segment
				if (segments.length === 0 && transcription.text) {
					segments.push({
						id: `segment-0-${Date.now()}`,
						speakerId: "speaker_1",
						startTime: "00:00",
						endTime: formatTime((transcription as { duration?: number }).duration || 0),
						text: transcription.text.trim(),
						words: groqWords,
					});
				}

				return { segments };
			} catch (error) {
				console.error("Transcription error:", error);
				throw error;
			}
		},
		{
			body: t.Object({
				audio: t.String({ description: "Base64 encoded audio data" }),
				mimeType: t.String({ description: "MIME type of the audio file" }),
			}),
		}
	)
	.listen(Number.isFinite(port) ? port : 3001);

console.log(`Server running at http://localhost:${app.server?.port}`);
console.log(`Groq transcription proxy: ${hasGroqApiKey() ? "configured" : "not configured"}`);
console.log(`Groq model: ${groqModel}, language: ${groqLanguage}`);

export type App = typeof app;
