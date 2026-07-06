export const AppView = {
	EDITOR: "EDITOR",
	WELCOME: "WELCOME",
} as const;

export type AppView = (typeof AppView)[keyof typeof AppView];

export const TranscriptMode = {
	CLEANUP: "cleanup",
	REVIEW: "review",
} as const;

export type TranscriptMode = (typeof TranscriptMode)[keyof typeof TranscriptMode];

export const CleanupGranularity = {
	SEGMENTS: "segments",
	TURNS: "turns",
	WORDS: "words",
} as const;

export type CleanupGranularity = (typeof CleanupGranularity)[keyof typeof CleanupGranularity];
