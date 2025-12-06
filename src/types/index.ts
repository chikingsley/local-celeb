import { z } from "zod";

// Zod schemas for validation
export const SpeakerSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

// Word-level timestamp for karaoke-style highlighting
export const WordTimestampSchema = z.object({
	word: z.string(),
	start: z.number(), // seconds
	end: z.number(), // seconds
	interpolated: z.boolean().optional(), // true if timestamp was estimated, not from Whisper
});

export const SegmentSchema = z.object({
	id: z.string().min(1),
	speakerId: z.string().min(1),
	startTime: z.string(), // "MM:SS" format
	endTime: z.string(),
	text: z.string(),
	words: z.array(WordTimestampSchema).optional(), // Word-level timestamps from Groq/Whisper
	wordsDirty: z.boolean().optional(), // true if text was edited and timestamps need re-alignment
});

export const FileMetaDataSchema = z.object({
	name: z.string(),
	duration: z.number().nonnegative(),
	language: z.string(),
	date: z.string(),
});

export const TranscriptionResponseSchema = z.object({
	segments: z.array(SegmentSchema),
});

// TypeScript types derived from schemas
export type Speaker = z.infer<typeof SpeakerSchema>;
export type WordTimestamp = z.infer<typeof WordTimestampSchema>;
export type Segment = z.infer<typeof SegmentSchema>;
export type FileMetaData = z.infer<typeof FileMetaDataSchema>;
export type TranscriptionResponse = z.infer<typeof TranscriptionResponseSchema>;

// App view enum
export enum AppView {
	WELCOME = "WELCOME",
	EDITOR = "EDITOR",
}

// Processing step for loading states
export interface ProcessingStep {
	label: string;
	status: "pending" | "processing" | "completed" | "error";
}

// Constants
export const SPEAKER_COLORS = [
	"#3b82f6",
	"#f97316",
	"#a855f7",
	"#ec4899",
	"#10b981",
	"#f59e0b",
	"#6366f1",
	"#84cc16",
] as const;

export const DEFAULT_SPEAKERS: Speaker[] = [
	{ id: "speaker_1", name: "Narrator", color: "#3b82f6" },
	{ id: "speaker_2", name: "French Narrator", color: "#f97316" },
	{ id: "speaker_3", name: "Male Speaker", color: "#a855f7" },
	{ id: "speaker_4", name: "Female Speaker", color: "#ec4899" },
];

// Layout constants
export const LAYOUT = {
	SIDEBAR_WIDTH: 64,
	SIDEBAR_WIDTH_EXPANDED: 200,
	MIN_TIMELINE_HEIGHT: 150,
	MAX_TIMELINE_HEIGHT_OFFSET: 200,
	MIN_RIGHT_SIDEBAR_WIDTH: 250,
	MAX_RIGHT_SIDEBAR_WIDTH: 600,
	RIGHT_SIDEBAR_SNAP_THRESHOLD: 50,
	DEFAULT_TIMELINE_HEIGHT: 320,
	DEFAULT_RIGHT_SIDEBAR_WIDTH: 320,
} as const;

// Zoom level constraints
export const ZOOM = {
	MIN: 10,
	MAX: 200,
	DEFAULT: 50,
} as const;
