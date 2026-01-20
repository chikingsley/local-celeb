import { describe, expect, it } from "vitest";
import type { Segment, WordTimestamp } from "@/types";
import {
	buildWordIndex,
	findWordAtCharPositionFast,
	findWordAtTimeFast,
	getSegmentWords,
	interpolateWordTimestamps,
} from "./word-index";

describe("interpolateWordTimestamps", () => {
	it("returns empty array for empty text", () => {
		const result = interpolateWordTimestamps("", [], 0, 5);
		expect(result).toEqual([]);
	});

	it("distributes evenly when no Whisper words provided", () => {
		const result = interpolateWordTimestamps("Hello world test", undefined, 0, 3);
		expect(result).toHaveLength(3);
		expect(result[0]).toEqual({ word: "Hello", start: 0, end: 1, interpolated: true });
		expect(result[1]).toEqual({ word: "world", start: 1, end: 2, interpolated: true });
		expect(result[2]).toEqual({ word: "test", start: 2, end: 3, interpolated: true });
	});

	it("matches Whisper words and marks as not interpolated", () => {
		const whisperWords: WordTimestamp[] = [
			{ word: "Hello", start: 0.2, end: 0.5 },
			{ word: "world", start: 0.6, end: 1.0 },
		];
		const result = interpolateWordTimestamps("Hello world", whisperWords, 0, 2);
		expect(result).toHaveLength(2);
		expect(result[0].interpolated).toBe(false);
		expect(result[1].interpolated).toBe(false);
		expect(result[0].start).toBe(0.2);
		expect(result[1].start).toBe(0.6);
	});

	it("interpolates missing words between matched ones", () => {
		// Whisper returns "Life's" and "fair" but misses "not"
		const whisperWords: WordTimestamp[] = [
			{ word: "Life's", start: 0.2, end: 0.8 },
			{ word: "fair", start: 1.5, end: 2.0 },
		];
		const result = interpolateWordTimestamps("Life's not fair", whisperWords, 0, 3);
		expect(result).toHaveLength(3);
		expect(result[0].word).toBe("Life's");
		expect(result[0].interpolated).toBe(false);
		expect(result[1].word).toBe("not");
		expect(result[1].interpolated).toBe(true);
		expect(result[1].start).toBe(0.8); // Starts after "Life's" ends
		expect(result[2].word).toBe("fair");
		expect(result[2].interpolated).toBe(false);
	});

	it("handles punctuation differences in matching", () => {
		const whisperWords: WordTimestamp[] = [
			{ word: "Hello", start: 0.2, end: 0.5 },
			{ word: "world", start: 0.6, end: 1.0 },
		];
		const result = interpolateWordTimestamps("Hello, world!", whisperWords, 0, 2);
		expect(result).toHaveLength(2);
		// Should match despite punctuation in text
		expect(result[0].word).toBe("Hello,");
		expect(result[1].word).toBe("world!");
	});

	it("interpolates last word if missing", () => {
		const whisperWords: WordTimestamp[] = [
			{ word: "Is", start: 0.0, end: 0.3 },
			{ word: "it", start: 0.3, end: 0.5 },
		];
		// "it?" in text but Whisper only has "it"
		const result = interpolateWordTimestamps("Is it?", whisperWords, 0, 1);
		expect(result).toHaveLength(2);
		expect(result[0].word).toBe("Is");
		expect(result[1].word).toBe("it?");
	});
});

describe("buildWordIndex", () => {
	const createSegment = (
		id: string,
		text: string,
		startTime: string,
		endTime: string,
		words?: WordTimestamp[]
	): Segment => ({
		id,
		speakerId: "speaker_1",
		startTime,
		endTime,
		text,
		words,
	});

	it("builds empty index for empty segments", () => {
		const result = buildWordIndex([]);
		expect(result).toEqual([]);
	});

	it("builds index with correct character positions", () => {
		const segments: Segment[] = [
			createSegment("seg1", "Hello world", "00:00", "00:02", [
				{ word: "Hello", start: 0.0, end: 0.8 },
				{ word: "world", start: 0.9, end: 1.5 },
			]),
		];
		const result = buildWordIndex(segments);
		expect(result).toHaveLength(2);
		expect(result[0].charStart).toBe(0);
		expect(result[0].charEnd).toBe(5);
		expect(result[1].charStart).toBe(6);
		expect(result[1].charEnd).toBe(11);
	});

	it("interpolates missing words and includes in index", () => {
		const segments: Segment[] = [
			createSegment("seg1", "One two three", "00:00", "00:03", [
				{ word: "One", start: 0.0, end: 0.8 },
				// "two" missing
				{ word: "three", start: 2.0, end: 2.8 },
			]),
		];
		const result = buildWordIndex(segments);
		expect(result).toHaveLength(3);
		expect(result.find((w) => w.word === "two")?.interpolated).toBe(true);
	});

	it("sorts index by start time across segments", () => {
		const segments: Segment[] = [
			createSegment("seg2", "Later", "00:05", "00:07", [{ word: "Later", start: 5.0, end: 6.0 }]),
			createSegment("seg1", "Earlier", "00:00", "00:02", [
				{ word: "Earlier", start: 0.0, end: 1.0 },
			]),
		];
		const result = buildWordIndex(segments);
		expect(result[0].word).toBe("Earlier");
		expect(result[1].word).toBe("Later");
	});
});

describe("findWordAtTimeFast", () => {
	const createIndex = (): ReturnType<typeof buildWordIndex> => [
		{
			segmentId: "s1",
			wordIndex: 0,
			word: "One",
			start: 0.0,
			end: 0.5,
			charStart: 0,
			charEnd: 3,
			interpolated: false,
		},
		{
			segmentId: "s1",
			wordIndex: 1,
			word: "two",
			start: 0.5,
			end: 1.0,
			charStart: 4,
			charEnd: 7,
			interpolated: false,
		},
		{
			segmentId: "s1",
			wordIndex: 2,
			word: "three",
			start: 1.0,
			end: 1.5,
			charStart: 8,
			charEnd: 13,
			interpolated: false,
		},
		{
			segmentId: "s2",
			wordIndex: 0,
			word: "four",
			start: 2.0,
			end: 2.5,
			charStart: 0,
			charEnd: 4,
			interpolated: false,
		},
	];

	it("returns null for empty index", () => {
		expect(findWordAtTimeFast([], 0.5)).toBeNull();
	});

	it("finds word at exact start time", () => {
		const index = createIndex();
		const result = findWordAtTimeFast(index, 0.0);
		expect(result?.word).toBe("One");
	});

	it("finds word at middle of time range", () => {
		const index = createIndex();
		const result = findWordAtTimeFast(index, 0.7);
		expect(result?.word).toBe("two");
	});

	it("finds word in second segment", () => {
		const index = createIndex();
		const result = findWordAtTimeFast(index, 2.2);
		expect(result?.word).toBe("four");
	});

	it("returns null for time between segments (gap)", () => {
		const index = createIndex();
		const result = findWordAtTimeFast(index, 1.7);
		expect(result).toBeNull();
	});

	it("returns null for time before first word", () => {
		const index = [
			{
				segmentId: "s1",
				wordIndex: 0,
				word: "test",
				start: 1.0,
				end: 2.0,
				charStart: 0,
				charEnd: 4,
				interpolated: false,
			},
		];
		expect(findWordAtTimeFast(index, 0.5)).toBeNull();
	});
});

describe("findWordAtCharPositionFast", () => {
	const createIndex = (): ReturnType<typeof buildWordIndex> => [
		{
			segmentId: "s1",
			wordIndex: 0,
			word: "Hello",
			start: 0.0,
			end: 0.5,
			charStart: 0,
			charEnd: 5,
			interpolated: false,
		},
		{
			segmentId: "s1",
			wordIndex: 1,
			word: "world",
			start: 0.5,
			end: 1.0,
			charStart: 6,
			charEnd: 11,
			interpolated: false,
		},
		{
			segmentId: "s2",
			wordIndex: 0,
			word: "Test",
			start: 2.0,
			end: 2.5,
			charStart: 0,
			charEnd: 4,
			interpolated: false,
		},
	];

	it("finds word at character position", () => {
		const index = createIndex();
		const result = findWordAtCharPositionFast(index, "s1", 2);
		expect(result?.word).toBe("Hello");
	});

	it("finds second word by char position", () => {
		const index = createIndex();
		const result = findWordAtCharPositionFast(index, "s1", 8);
		expect(result?.word).toBe("world");
	});

	it("returns null for position between words (space)", () => {
		const index = createIndex();
		const result = findWordAtCharPositionFast(index, "s1", 5);
		expect(result).toBeNull();
	});

	it("returns null for wrong segment", () => {
		const index = createIndex();
		const result = findWordAtCharPositionFast(index, "s2", 8);
		expect(result).toBeNull();
	});
});

describe("getSegmentWords", () => {
	it("returns only words for specified segment", () => {
		const index = [
			{
				segmentId: "s1",
				wordIndex: 0,
				word: "One",
				start: 0,
				end: 0.5,
				charStart: 0,
				charEnd: 3,
				interpolated: false,
			},
			{
				segmentId: "s2",
				wordIndex: 0,
				word: "Two",
				start: 1,
				end: 1.5,
				charStart: 0,
				charEnd: 3,
				interpolated: false,
			},
			{
				segmentId: "s1",
				wordIndex: 1,
				word: "Three",
				start: 0.5,
				end: 1,
				charStart: 4,
				charEnd: 9,
				interpolated: false,
			},
		];
		const result = getSegmentWords(index, "s1");
		expect(result).toHaveLength(2);
		expect(result.every((w) => w.segmentId === "s1")).toBe(true);
	});

	it("returns empty array for unknown segment", () => {
		const index = [
			{
				segmentId: "s1",
				wordIndex: 0,
				word: "One",
				start: 0,
				end: 0.5,
				charStart: 0,
				charEnd: 3,
				interpolated: false,
			},
		];
		const result = getSegmentWords(index, "unknown");
		expect(result).toEqual([]);
	});
});
