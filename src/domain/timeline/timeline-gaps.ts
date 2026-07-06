import type { Segment, WordTimestamp } from "@/domain/transcript/types";
import { formatTime, parseTime } from "@/lib/utils";

export interface TimelineGap {
	closeAmount: number;
	duration: number;
	end: number;
	id: string;
	start: number;
}

interface GapOptions {
	minGapSeconds?: number;
	retainPaddingSeconds?: number;
}

interface SegmentRange {
	end: number;
	segment: Segment;
	start: number;
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
	if (ranges.length < 2) {
		return [];
	}

	const gaps: TimelineGap[] = [];
	let cursorEnd = ranges[0].end;

	for (const range of ranges.slice(1)) {
		const gapDuration = range.start - cursorEnd;
		if (gapDuration >= minGapSeconds) {
			gaps.push({
				closeAmount: Math.max(0, gapDuration - retainPaddingSeconds),
				duration: gapDuration,
				end: range.start,
				id: `gap-${formatTime(cursorEnd)}-${formatTime(range.start)}`,
				start: cursorEnd,
			});
		}
		cursorEnd = Math.max(cursorEnd, range.end);
	}

	return gaps;
}

export function closeSilenceGaps(segments: Segment[], options: GapOptions = {}): Segment[] {
	const gaps = findSilenceGaps(segments, options).filter((gap) => gap.closeAmount > 0);
	if (gaps.length === 0) {
		return segments;
	}

	return segments.map((segment) => {
		const start = parseTime(segment.startTime);
		const end = parseTime(segment.endTime);
		const shift = gaps
			.filter((gap) => gap.end <= start)
			.reduce((sum, gap) => sum + gap.closeAmount, 0);

		if (shift <= 0) {
			return segment;
		}

		const nextStart = Math.max(0, start - shift);
		const nextEnd = Math.max(nextStart + 0.1, end - shift);

		return {
			...segment,
			endTime: formatTime(nextEnd),
			startTime: formatTime(nextStart),
			...(segment.words ? { words: shiftWords(segment.words, shift) } : {}),
		};
	});
}

function sortedRanges(segments: Segment[]): SegmentRange[] {
	return segments
		.map((segment) => {
			const start = parseTime(segment.startTime);
			const end = parseTime(segment.endTime);
			return { end, segment, start };
		})
		.filter((range) => range.end > range.start)
		.sort((a, b) => a.start - b.start || a.end - b.end);
}

function shiftWords(words: WordTimestamp[], shift: number): WordTimestamp[] {
	return words.map((word) => {
		const start = Math.max(0, word.start - shift);
		return {
			...word,
			end: Math.max(start, word.end - shift),
			start,
		};
	});
}
