import type { Segment, WordTimestamp, WordTimingStatus } from "@/domain/transcript/types";
import { parseTime } from "@/lib/utils";

const WORD_SPLIT_PATTERN = /\s+/;

export interface WordTimingDisplay {
	description: string;
	label: string;
	tone: "slate" | "amber" | "emerald" | "blue";
}

export function countTextWords(text: string): number {
	return text.trim().split(WORD_SPLIT_PATTERN).filter(Boolean).length;
}

export function getWordTimingStatus(segment: Segment): WordTimingStatus {
	if (segment.wordsDirty) {
		return "dirty";
	}
	if (segment.wordTimingStatus) {
		return segment.wordTimingStatus;
	}
	if (!segment.words || segment.words.length === 0) {
		return "absent";
	}
	if (segment.words.some((word) => word.interpolated)) {
		return "estimated";
	}
	if (segment.words.length < countTextWords(segment.text)) {
		return "estimated";
	}
	return "provider";
}

export function getWordTimingDisplay(status: WordTimingStatus): WordTimingDisplay {
	switch (status) {
		case "provider":
			return {
				description: "Word timings came from the imported transcript provider.",
				label: "provider timing",
				tone: "emerald",
			};
		case "manual":
			return {
				description: "Word timings were edited in this project.",
				label: "manual timing",
				tone: "blue",
			};
		case "estimated":
			return {
				description: "Some word timings are interpolated or inferred.",
				label: "estimated timing",
				tone: "amber",
			};
		case "dirty":
			return {
				description: "Transcript text changed after word timing was generated.",
				label: "alignment dirty",
				tone: "amber",
			};
		case "absent":
			return {
				description: "This source did not include word-level timing.",
				label: "word timing absent",
				tone: "slate",
			};
		default:
			return {
				description: "This source did not include word-level timing.",
				label: "word timing absent",
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
	const textWords = segment.text.split(WORD_SPLIT_PATTERN).filter(Boolean);
	if (textWords.length === 0) {
		return [];
	}

	const segmentStart = parseTime(segment.startTime);
	const segmentEnd = parseTime(segment.endTime);
	const duration = Math.max(0, segmentEnd - segmentStart);

	return textWords.map((word, index) => ({
		end: segmentStart + (duration * (index + 1)) / textWords.length,
		interpolated: true,
		start: segmentStart + (duration * index) / textWords.length,
		word,
	}));
}
