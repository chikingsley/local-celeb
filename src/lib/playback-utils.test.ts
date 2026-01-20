import { describe, expect, it } from "vitest";
import type { Segment, WordTimestamp } from "@/types";
import {
	findClosestSegment,
	findClosestVisibleMatch,
	findSegmentAtTime,
	findSegmentIndexAtTime,
	findWordAtCharPosition,
	findWordAtTime,
	findWordCharacterRange,
	parseTime,
} from "./playback-utils";

describe("parseTime", () => {
	it("parses MM:SS format correctly", () => {
		expect(parseTime("00:00")).toBe(0);
		expect(parseTime("00:30")).toBe(30);
		expect(parseTime("01:00")).toBe(60);
		expect(parseTime("01:30")).toBe(90);
		expect(parseTime("10:45")).toBe(645);
	});

	it("handles invalid formats", () => {
		expect(parseTime("")).toBe(0);
		expect(parseTime("invalid")).toBe(0);
		expect(parseTime("1:2:3")).toBe(0);
	});
});

describe("findSegmentAtTime", () => {
	const segments: Segment[] = [
		{ id: "1", speakerId: "s1", startTime: "00:00", endTime: "00:10", text: "First" },
		{ id: "2", speakerId: "s1", startTime: "00:10", endTime: "00:20", text: "Second" },
		{ id: "3", speakerId: "s2", startTime: "00:25", endTime: "00:35", text: "Third" },
	];

	it("finds segment containing the time", () => {
		expect(findSegmentAtTime(segments, 5)?.id).toBe("1");
		expect(findSegmentAtTime(segments, 15)?.id).toBe("2");
		expect(findSegmentAtTime(segments, 30)?.id).toBe("3");
	});

	it("returns segment at exact start time", () => {
		expect(findSegmentAtTime(segments, 0)?.id).toBe("1");
		expect(findSegmentAtTime(segments, 10)?.id).toBe("2");
	});

	it("returns null for time outside all segments", () => {
		expect(findSegmentAtTime(segments, 22)).toBeNull();
		expect(findSegmentAtTime(segments, 100)).toBeNull();
	});

	it("returns null for empty segments array", () => {
		expect(findSegmentAtTime([], 5)).toBeNull();
	});
});

describe("findSegmentIndexAtTime", () => {
	const segments: Segment[] = [
		{ id: "1", speakerId: "s1", startTime: "00:00", endTime: "00:10", text: "First" },
		{ id: "2", speakerId: "s1", startTime: "00:10", endTime: "00:20", text: "Second" },
	];

	it("returns correct index", () => {
		expect(findSegmentIndexAtTime(segments, 5)).toBe(0);
		expect(findSegmentIndexAtTime(segments, 15)).toBe(1);
	});

	it("returns -1 when not found", () => {
		expect(findSegmentIndexAtTime(segments, 25)).toBe(-1);
	});
});

describe("findWordAtTime", () => {
	const words: WordTimestamp[] = [
		{ word: "Hello", start: 0, end: 0.5 },
		{ word: "world", start: 0.5, end: 1.0 },
		{ word: "test", start: 1.2, end: 1.5 },
	];

	it("finds word at time", () => {
		const result = findWordAtTime(words, 0.3);
		expect(result?.word.word).toBe("Hello");
		expect(result?.index).toBe(0);
	});

	it("finds correct word index", () => {
		const result = findWordAtTime(words, 0.7);
		expect(result?.word.word).toBe("world");
		expect(result?.index).toBe(1);
	});

	it("returns null for time between words", () => {
		expect(findWordAtTime(words, 1.1)).toBeNull();
	});

	it("returns null for undefined words", () => {
		expect(findWordAtTime(undefined, 0.5)).toBeNull();
	});

	it("returns null for empty words array", () => {
		expect(findWordAtTime([], 0.5)).toBeNull();
	});
});

describe("findClosestSegment", () => {
	const segments: Segment[] = [
		{ id: "1", speakerId: "s1", startTime: "00:00", endTime: "00:10", text: "First" },
		{ id: "2", speakerId: "s1", startTime: "00:20", endTime: "00:30", text: "Second" },
	];

	it("finds closest segment by midpoint", () => {
		// Time 12 is closer to segment 1 (midpoint 5) than segment 2 (midpoint 25)
		expect(findClosestSegment(segments, 12)?.id).toBe("1");
		// Time 18 is closer to segment 2 (midpoint 25) than segment 1 (midpoint 5)
		expect(findClosestSegment(segments, 18)?.id).toBe("2");
	});

	it("returns null for empty array", () => {
		expect(findClosestSegment([], 5)).toBeNull();
	});
});

describe("findWordCharacterRange", () => {
	it("finds word position in text", () => {
		const text = "Hello world test";
		const words: WordTimestamp[] = [
			{ word: "Hello", start: 0, end: 0.5 },
			{ word: "world", start: 0.5, end: 1.0 },
			{ word: "test", start: 1.0, end: 1.5 },
		];

		expect(findWordCharacterRange(text, words, 0)).toEqual({ start: 0, end: 5 });
		expect(findWordCharacterRange(text, words, 1)).toEqual({ start: 6, end: 11 });
		expect(findWordCharacterRange(text, words, 2)).toEqual({ start: 12, end: 16 });
	});

	it("handles repeated words", () => {
		const text = "the cat and the dog";
		const words: WordTimestamp[] = [
			{ word: "the", start: 0, end: 0.3 },
			{ word: "cat", start: 0.3, end: 0.6 },
			{ word: "and", start: 0.6, end: 0.9 },
			{ word: "the", start: 0.9, end: 1.2 },
			{ word: "dog", start: 1.2, end: 1.5 },
		];

		// First "the" at position 0
		expect(findWordCharacterRange(text, words, 0)).toEqual({ start: 0, end: 3 });
		// Second "the" at position 12
		expect(findWordCharacterRange(text, words, 3)).toEqual({ start: 12, end: 15 });
	});

	it("returns null for invalid index", () => {
		const words: WordTimestamp[] = [{ word: "test", start: 0, end: 0.5 }];
		expect(findWordCharacterRange("test", words, -1)).toBeNull();
		expect(findWordCharacterRange("test", words, 5)).toBeNull();
	});

	it("returns null for undefined words", () => {
		expect(findWordCharacterRange("test", undefined, 0)).toBeNull();
	});
});

describe("findClosestVisibleMatch", () => {
	const matches = [
		{ segmentId: "1", startIndex: 0 },
		{ segmentId: "2", startIndex: 5 },
		{ segmentId: "3", startIndex: 10 },
		{ segmentId: "4", startIndex: 15 },
	];

	it("finds next visible match", () => {
		const visible = new Set(["2", "3"]);
		// Current at 0, should find next visible (index 1, segmentId "2")
		expect(findClosestVisibleMatch(matches, visible, 0, "next")).toBe(1);
	});

	it("finds prev visible match", () => {
		const visible = new Set(["1", "2"]);
		// Current at 3, should find prev visible (index 1, segmentId "2")
		expect(findClosestVisibleMatch(matches, visible, 3, "prev")).toBe(1);
	});

	it("wraps around when no next visible", () => {
		const visible = new Set(["1"]);
		// Current at 0, next should wrap to first visible (index 0)
		expect(findClosestVisibleMatch(matches, visible, 0, "next")).toBe(0);
	});

	it("falls back to regular next/prev when no visible matches", () => {
		const visible = new Set<string>();
		expect(findClosestVisibleMatch(matches, visible, 0, "next")).toBe(1);
		expect(findClosestVisibleMatch(matches, visible, 0, "prev")).toBe(3);
	});

	it("returns -1 for empty matches", () => {
		expect(findClosestVisibleMatch([], new Set(), 0, "next")).toBe(-1);
	});
});

describe("findWordAtCharPosition", () => {
	const words: WordTimestamp[] = [
		{ word: "Hello", start: 0, end: 0.5 },
		{ word: "world", start: 0.5, end: 1.0 },
		{ word: "test", start: 1.0, end: 1.5 },
	];
	const text = "Hello world test";

	it("finds word at character position", () => {
		// Position 0 is in "Hello"
		const result = findWordAtCharPosition(text, words, 0);
		expect(result).not.toBeNull();
		expect(result?.word.word).toBe("Hello");
		expect(result?.index).toBe(0);
	});

	it("finds middle word", () => {
		// Position 7 is in "world"
		const result = findWordAtCharPosition(text, words, 7);
		expect(result).not.toBeNull();
		expect(result?.word.word).toBe("world");
		expect(result?.index).toBe(1);
	});

	it("finds last word", () => {
		// Position 12 is in "test"
		const result = findWordAtCharPosition(text, words, 12);
		expect(result).not.toBeNull();
		expect(result?.word.word).toBe("test");
		expect(result?.index).toBe(2);
	});

	it("returns null for position in whitespace", () => {
		// Position 5 is space between Hello and world
		const result = findWordAtCharPosition(text, words, 5);
		expect(result).toBeNull();
	});

	it("returns null for undefined words", () => {
		expect(findWordAtCharPosition(text, undefined, 0)).toBeNull();
	});

	it("returns null for empty words array", () => {
		expect(findWordAtCharPosition(text, [], 0)).toBeNull();
	});
});
