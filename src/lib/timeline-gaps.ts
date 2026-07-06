import type { Segment, WordTimestamp } from "@/types";
import { formatTime, parseTime } from "./utils";

export interface TimelineGap {
	id: string;
	start: number;
	end: number;
	duration: number;
	closeAmount: number;
}

interface GapOptions {
	minGapSeconds?: number;
	retainPaddingSeconds?: number;
}

interface SegmentRange {
	segment: Segment;
	start: number;
	end: number;
}

const DEFAULT_MIN_GAP_SECONDS = 0.5;
const DEFAULT_RETAIN_PADDING_SECONDS = 0.25;

export function findSilenceGaps(segments: Segment[], options: GapOptions = {}): TimelineGap[] {
	const minGapSeconds = options.minGapSeconds ?? DEFAULT_MIN_GAP_SECONDS;
	const retainPaddingSeconds = Math.max(
		0,
		options.retainPaddingSeconds ?? DEFAULT_RETAIN_PADDING_SECONDS
	);
	const ranges = sortedRanges(segments);
	if (ranges.length < 2) return [];

	const gaps: TimelineGap[] = [];
	let cursorEnd = ranges[0].end;

	for (const range of ranges.slice(1)) {
		const gapDuration = range.start - cursorEnd;
		if (gapDuration >= minGapSeconds) {
			gaps.push({
				id: `gap-${formatTime(cursorEnd)}-${formatTime(range.start)}`,
				start: cursorEnd,
				end: range.start,
				duration: gapDuration,
				closeAmount: Math.max(0, gapDuration - retainPaddingSeconds),
			});
		}
		cursorEnd = Math.max(cursorEnd, range.end);
	}

	return gaps;
}

export function closeSilenceGaps(segments: Segment[], options: GapOptions = {}): Segment[] {
	const gaps = findSilenceGaps(segments, options).filter((gap) => gap.closeAmount > 0);
	if (gaps.length === 0) return segments;

	return segments.map((segment) => {
		const start = parseTime(segment.startTime);
		const end = parseTime(segment.endTime);
		const shift = gaps
			.filter((gap) => gap.end <= start)
			.reduce((sum, gap) => sum + gap.closeAmount, 0);

		if (shift <= 0) return segment;

		const nextStart = Math.max(0, start - shift);
		const nextEnd = Math.max(nextStart + 0.1, end - shift);

		return {
			...segment,
			startTime: formatTime(nextStart),
			endTime: formatTime(nextEnd),
			...(segment.words ? { words: shiftWords(segment.words, shift) } : {}),
		};
	});
}

function sortedRanges(segments: Segment[]): SegmentRange[] {
	return segments
		.map((segment) => {
			const start = parseTime(segment.startTime);
			const end = parseTime(segment.endTime);
			return { segment, start, end };
		})
		.filter((range) => range.end > range.start)
		.sort((a, b) => a.start - b.start || a.end - b.end);
}

function shiftWords(words: WordTimestamp[], shift: number): WordTimestamp[] {
	return words.map((word) => {
		const start = Math.max(0, word.start - shift);
		return {
			...word,
			start,
			end: Math.max(start, word.end - shift),
		};
	});
}
