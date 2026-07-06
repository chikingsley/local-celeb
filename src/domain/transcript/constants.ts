import type { Speaker } from "./types";

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
	{ color: "#3b82f6", id: "speaker_1", name: "Narrator" },
	{ color: "#f97316", id: "speaker_2", name: "French Narrator" },
	{ color: "#a855f7", id: "speaker_3", name: "Male Speaker" },
	{ color: "#ec4899", id: "speaker_4", name: "Female Speaker" },
];
