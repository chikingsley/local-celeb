import { describe, expect, it } from "vitest";
import { cn, formatTime, generateId, parseTime } from "./utils";

describe("cn", () => {
	it("should merge class names", () => {
		expect(cn("foo", "bar")).toBe("foo bar");
	});

	it("should handle conditional classes", () => {
		expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
	});

	it("should merge tailwind classes correctly", () => {
		expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
	});
});

describe("formatTime", () => {
	it("should format 0 seconds", () => {
		expect(formatTime(0)).toBe("00:00");
	});

	it("should format seconds only", () => {
		expect(formatTime(45)).toBe("00:45");
	});

	it("should format minutes and seconds", () => {
		expect(formatTime(125)).toBe("02:05");
	});

	it("should handle large values", () => {
		expect(formatTime(3661)).toBe("61:01");
	});

	it("should preserve decimal seconds", () => {
		expect(formatTime(5.5)).toBe("00:05.5");
		expect(formatTime(90.5)).toBe("01:30.5");
		expect(formatTime(0.3)).toBe("00:00.3");
	});

	it("should round to 1 decimal place", () => {
		expect(formatTime(5.55)).toBe("00:05.6");
		expect(formatTime(5.54)).toBe("00:05.5");
	});

	it("should not show decimal for whole seconds", () => {
		expect(formatTime(5.0)).toBe("00:05");
		expect(formatTime(10)).toBe("00:10");
	});
});

describe("parseTime", () => {
	it("should parse MM:SS format", () => {
		expect(parseTime("00:00")).toBe(0);
		expect(parseTime("00:45")).toBe(45);
		expect(parseTime("02:05")).toBe(125);
	});

	it("should handle decimal seconds", () => {
		expect(parseTime("01:30.5")).toBe(90.5);
	});

	it("should return 0 for invalid format", () => {
		expect(parseTime("invalid")).toBe(0);
		expect(parseTime("")).toBe(0);
	});
});

describe("generateId", () => {
	it("should generate unique IDs", () => {
		const id1 = generateId();
		const id2 = generateId();
		expect(id1).not.toBe(id2);
	});

	it("should use custom prefix", () => {
		const id = generateId("segment");
		expect(id.startsWith("segment-")).toBe(true);
	});
});
