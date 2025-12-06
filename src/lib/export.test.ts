import { describe, expect, it } from "vitest";
import type { Segment, Speaker } from "@/types";
import {
	exportToCsv,
	exportToHtml,
	exportToJson,
	exportToSrt,
	exportToTxt,
	exportToVtt,
	exportTranscript,
	getFileExtension,
	getMimeType,
	secondsToSrtTime,
	secondsToVttTime,
} from "./export";

// Sample test data
const speakers: Speaker[] = [
	{ id: "speaker_1", name: "Alice", color: "#3b82f6" },
	{ id: "speaker_2", name: "Bob", color: "#f97316" },
];

const segments: Segment[] = [
	{
		id: "1",
		speakerId: "speaker_1",
		startTime: "00:00",
		endTime: "00:04",
		text: "Hello, how are you?",
	},
	{
		id: "2",
		speakerId: "speaker_2",
		startTime: "00:04",
		endTime: "00:08",
		text: "I'm doing great, thanks!",
	},
	{
		id: "3",
		speakerId: "speaker_1",
		startTime: "00:08",
		endTime: "00:12.5",
		text: "That's wonderful to hear.",
	},
];

describe("secondsToSrtTime", () => {
	it("should format 0 seconds", () => {
		expect(secondsToSrtTime(0)).toBe("00:00:00,000");
	});

	it("should format seconds only", () => {
		expect(secondsToSrtTime(45)).toBe("00:00:45,000");
	});

	it("should format minutes and seconds", () => {
		expect(secondsToSrtTime(125)).toBe("00:02:05,000");
	});

	it("should format hours, minutes, and seconds", () => {
		expect(secondsToSrtTime(3661)).toBe("01:01:01,000");
	});

	it("should handle milliseconds", () => {
		expect(secondsToSrtTime(5.5)).toBe("00:00:05,500");
		expect(secondsToSrtTime(90.123)).toBe("00:01:30,123");
	});
});

describe("secondsToVttTime", () => {
	it("should format 0 seconds", () => {
		expect(secondsToVttTime(0)).toBe("00:00:00.000");
	});

	it("should format with dot separator for milliseconds", () => {
		expect(secondsToVttTime(5.5)).toBe("00:00:05.500");
	});

	it("should format complex times", () => {
		expect(secondsToVttTime(3723.456)).toBe("01:02:03.456");
	});
});

describe("exportToTxt", () => {
	it("should export segments as plain text", () => {
		const result = exportToTxt(segments, speakers);

		expect(result).toContain("[00:00 - 00:04] Alice");
		expect(result).toContain("Hello, how are you?");
		expect(result).toContain("[00:04 - 00:08] Bob");
		expect(result).toContain("I'm doing great, thanks!");
	});

	it("should separate segments with blank lines", () => {
		const result = exportToTxt(segments, speakers);
		const segmentBlocks = result.split("\n\n");
		expect(segmentBlocks.length).toBe(3);
	});

	it("should use speaker ID if speaker not found", () => {
		const unknownSegment: Segment[] = [
			{
				id: "1",
				speakerId: "unknown_speaker",
				startTime: "00:00",
				endTime: "00:05",
				text: "Test",
			},
		];
		const result = exportToTxt(unknownSegment, speakers);
		expect(result).toContain("unknown_speaker");
	});

	it("should handle empty segments array", () => {
		const result = exportToTxt([], speakers);
		expect(result).toBe("");
	});
});

describe("exportToSrt", () => {
	it("should export segments in SRT format", () => {
		const result = exportToSrt(segments, speakers);

		// Check first subtitle
		expect(result).toContain("1\n");
		expect(result).toContain("00:00:00,000 --> 00:00:04,000");
		expect(result).toContain("Alice: Hello, how are you?");

		// Check second subtitle
		expect(result).toContain("2\n");
		expect(result).toContain("00:00:04,000 --> 00:00:08,000");
		expect(result).toContain("Bob: I'm doing great, thanks!");
	});

	it("should number subtitles sequentially", () => {
		const result = exportToSrt(segments, speakers);
		expect(result).toMatch(/^1\n/);
		expect(result).toContain("\n\n2\n");
		expect(result).toContain("\n\n3\n");
	});

	it("should handle decimal times", () => {
		const result = exportToSrt(segments, speakers);
		expect(result).toContain("00:00:12,500");
	});
});

describe("exportToVtt", () => {
	it("should start with WEBVTT header", () => {
		const result = exportToVtt(segments, speakers);
		expect(result.startsWith("WEBVTT")).toBe(true);
	});

	it("should use VTT timestamp format with dots", () => {
		const result = exportToVtt(segments, speakers);
		expect(result).toContain("00:00:00.000 --> 00:00:04.000");
	});

	it("should use voice tags for speakers", () => {
		const result = exportToVtt(segments, speakers);
		expect(result).toContain("<v Alice>Hello, how are you?");
		expect(result).toContain("<v Bob>I'm doing great, thanks!");
	});

	it("should handle empty segments", () => {
		const result = exportToVtt([], speakers);
		expect(result).toBe("WEBVTT\n\n");
	});
});

describe("exportToJson", () => {
	it("should export valid JSON", () => {
		const result = exportToJson(segments, speakers);
		expect(() => JSON.parse(result)).not.toThrow();
	});

	it("should include version field", () => {
		const result = exportToJson(segments, speakers);
		const parsed = JSON.parse(result);
		expect(parsed.version).toBe("1.0");
	});

	it("should include exportedAt timestamp", () => {
		const result = exportToJson(segments, speakers);
		const parsed = JSON.parse(result);
		expect(parsed.exportedAt).toBeDefined();
		expect(new Date(parsed.exportedAt).getTime()).not.toBeNaN();
	});

	it("should include speakers and segments", () => {
		const result = exportToJson(segments, speakers);
		const parsed = JSON.parse(result);
		expect(parsed.speakers).toEqual(speakers);
		expect(parsed.segments).toEqual(segments);
	});

	it("should include meta data when provided", () => {
		const meta = { name: "test.mp3", duration: 60 };
		const result = exportToJson(segments, speakers, meta);
		const parsed = JSON.parse(result);
		expect(parsed.meta).toEqual(meta);
	});

	it("should be pretty-printed with 2 space indent", () => {
		const result = exportToJson(segments, speakers);
		expect(result).toContain("\n  ");
	});
});

describe("exportToHtml", () => {
	it("should export valid HTML document", () => {
		const result = exportToHtml(segments, speakers);
		expect(result).toContain("<!DOCTYPE html>");
		expect(result).toContain("<html");
		expect(result).toContain("</html>");
	});

	it("should include title from meta", () => {
		const result = exportToHtml(segments, speakers, { name: "Test Transcript" });
		expect(result).toContain("<title>Test Transcript</title>");
	});

	it("should include speaker names and text", () => {
		const result = exportToHtml(segments, speakers);
		expect(result).toContain("Alice");
		expect(result).toContain("Hello, how are you?");
	});

	it("should include speaker color styles", () => {
		const result = exportToHtml(segments, speakers);
		expect(result).toContain(".speaker-speaker_1");
		expect(result).toContain("#3b82f6");
	});
});

describe("exportToCsv", () => {
	it("should include header row", () => {
		const result = exportToCsv(segments, speakers);
		expect(result.startsWith("Start Time,End Time,Speaker,Text")).toBe(true);
	});

	it("should include all segments", () => {
		const result = exportToCsv(segments, speakers);
		const lines = result.split("\n");
		expect(lines.length).toBe(4); // header + 3 segments
	});

	it("should escape quotes in text", () => {
		const segmentWithQuotes: Segment[] = [
			{
				id: "1",
				speakerId: "speaker_1",
				startTime: "00:00",
				endTime: "00:05",
				text: 'He said "hello"',
			},
		];
		const result = exportToCsv(segmentWithQuotes, speakers);
		expect(result).toContain('""hello""');
	});

	it("should include speaker names", () => {
		const result = exportToCsv(segments, speakers);
		expect(result).toContain('"Alice"');
		expect(result).toContain('"Bob"');
	});
});

describe("exportTranscript", () => {
	it("should delegate to correct export function for txt", () => {
		const result = exportTranscript("txt", segments, speakers);
		expect(result).toContain("[00:00 - 00:04] Alice");
	});

	it("should delegate to correct export function for srt", () => {
		const result = exportTranscript("srt", segments, speakers);
		expect(result).toContain("00:00:00,000 --> 00:00:04,000");
	});

	it("should delegate to correct export function for vtt", () => {
		const result = exportTranscript("vtt", segments, speakers);
		expect(result.startsWith("WEBVTT")).toBe(true);
	});

	it("should delegate to correct export function for json", () => {
		const result = exportTranscript("json", segments, speakers);
		const parsed = JSON.parse(result);
		expect(parsed.version).toBe("1.0");
	});

	it("should delegate to correct export function for html", () => {
		const result = exportTranscript("html", segments, speakers);
		expect(result).toContain("<!DOCTYPE html>");
	});

	it("should delegate to correct export function for csv", () => {
		const result = exportTranscript("csv", segments, speakers);
		expect(result).toContain("Start Time,End Time,Speaker,Text");
	});

	it("should throw for unsupported format", () => {
		expect(() =>
			// @ts-expect-error Testing invalid format
			exportTranscript("invalid", segments, speakers)
		).toThrow("Unsupported export format: invalid");
	});
});

describe("getFileExtension", () => {
	it("should return correct extensions", () => {
		expect(getFileExtension("txt")).toBe("txt");
		expect(getFileExtension("srt")).toBe("srt");
		expect(getFileExtension("vtt")).toBe("vtt");
		expect(getFileExtension("json")).toBe("json");
	});
});

describe("getMimeType", () => {
	it("should return correct MIME types", () => {
		expect(getMimeType("txt")).toBe("text/plain");
		expect(getMimeType("srt")).toBe("application/x-subrip");
		expect(getMimeType("vtt")).toBe("text/vtt");
		expect(getMimeType("json")).toBe("application/json");
		expect(getMimeType("html")).toBe("text/html");
		expect(getMimeType("csv")).toBe("text/csv");
	});

	it("should return text/plain for unknown format", () => {
		// @ts-expect-error Testing invalid format
		expect(getMimeType("unknown")).toBe("text/plain");
	});
});
