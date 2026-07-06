import type { Segment, WordTimestamp, WordTimingStatus } from "@/types";
import { parseTime } from "./utils";

export interface WordTimingDisplay {
	label: string;
	description: string;
	tone: "slate" | "amber" | "emerald" | "blue";
}

export function countTextWords(text: string): number {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

export function getWordTimingStatus(segment: Segment): WordTimingStatus {
	if (segment.wordsDirty) return "dirty";
	if (segment.wordTimingStatus) return segment.wordTimingStatus;
	if (!segment.words || segment.words.length === 0) return "absent";
	if (segment.words.some((word) => word.interpolated)) return "estimated";
	if (segment.words.length < countTextWords(segment.text)) return "estimated";
	return "provider";
}

export function getWordTimingDisplay(status: WordTimingStatus): WordTimingDisplay {
	switch (status) {
		case "provider":
			return {
				label: "provider timing",
				description: "Word timings came from the imported transcript provider.",
				tone: "emerald",
			};
		case "manual":
			return {
				label: "manual timing",
				description: "Word timings were edited in this project.",
				tone: "blue",
			};
		case "estimated":
			return {
				label: "estimated timing",
				description: "Some word timings are interpolated or inferred.",
				tone: "amber",
			};
		case "dirty":
			return {
				label: "alignment dirty",
				description: "Transcript text changed after word timing was generated.",
				tone: "amber",
			};
		case "absent":
			return {
				label: "word timing absent",
				description: "This source did not include word-level timing.",
				tone: "slate",
			};
	}
}

export function getDisplayWords(segment: Segment): WordTimestamp[] {
	if (segment.words && segment.words.length > 0 && !segment.wordsDirty) {
		return segment.words;
	}

	return estimateSegmentWordTiming(segment);
}

export function estimateSegmentWordTiming(segment: Segment): WordTimestamp[] {
	const textWords = segment.text.split(/\s+/).filter(Boolean);
	if (textWords.length === 0) return [];

	const segmentStart = parseTime(segment.startTime);
	const segmentEnd = parseTime(segment.endTime);
	const duration = Math.max(0, segmentEnd - segmentStart);

	return textWords.map((word, index) => ({
		word,
		start: segmentStart + (duration * index) / textWords.length,
		end: segmentStart + (duration * (index + 1)) / textWords.length,
		interpolated: true,
	}));
}
