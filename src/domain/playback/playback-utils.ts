import type { Segment, WordTimestamp } from "@/domain/transcript/types";

/**
 * Parse "MM:SS" time string to seconds
 */
export function parseTime(timeStr: string): number {
	const parts = timeStr.split(":");
	if (parts.length !== 2) {
		return 0;
	}
	const [mins, secs] = parts.map(Number);
	return mins * 60 + secs;
}

/**
 * Find the segment that contains the given time
 */
export function findSegmentAtTime(segments: Segment[], timeSeconds: number): Segment | null {
	for (const segment of segments) {
		const start = parseTime(segment.startTime);
		const end = parseTime(segment.endTime);
		if (timeSeconds >= start && timeSeconds < end) {
			return segment;
		}
	}
	return null;
}

/**
 * Find the segment index that contains the given time
 */
export function findSegmentIndexAtTime(segments: Segment[], timeSeconds: number): number {
	for (const [index, segment] of segments.entries()) {
		const start = parseTime(segment.startTime);
		const end = parseTime(segment.endTime);
		if (timeSeconds >= start && timeSeconds < end) {
			return index;
		}
	}
	return -1;
}

/**
 * Find the word being spoken at the given time within a segment
 */
export function findWordAtTime(
	words: WordTimestamp[] | undefined,
	timeSeconds: number
): { word: WordTimestamp; index: number } | null {
	if (!words || words.length === 0) {
		return null;
	}

	for (const [index, word] of words.entries()) {
		if (timeSeconds >= word.start && timeSeconds < word.end) {
			return { index, word };
		}
	}
	return null;
}

/**
 * Find the closest segment to the given time (for when not inside any segment)
 */
export function findClosestSegment(segments: Segment[], timeSeconds: number): Segment | null {
	if (segments.length === 0) {
		return null;
	}

	const [firstSegment] = segments;
	let closest = firstSegment;
	let closestDistance = Number.POSITIVE_INFINITY;

	for (const segment of segments) {
		const start = parseTime(segment.startTime);
		const end = parseTime(segment.endTime);
		const midpoint = (start + end) / 2;
		const distance = Math.abs(timeSeconds - midpoint);

		if (distance < closestDistance) {
			closestDistance = distance;
			closest = segment;
		}
	}

	return closest;
}

/**
 * Get the character range for a word within segment text
 * Returns { start, end } character indices or null if not found
 */
export function findWordCharacterRange(
	segmentText: string,
	words: WordTimestamp[] | undefined,
	wordIndex: number
): { start: number; end: number } | null {
	if (!words || wordIndex < 0 || wordIndex >= words.length) {
		return null;
	}

	let searchStart = 0;

	// Find the nth occurrence by iterating through previous words
	for (const [index, wordTimestamp] of words.entries()) {
		if (index > wordIndex) {
			break;
		}

		const word = wordTimestamp.word.trim();
		const foundIndex = segmentText.indexOf(word, searchStart);
		if (foundIndex === -1) {
			// Word not found, try case-insensitive
			const lowerText = segmentText.toLowerCase();
			const lowerWord = word.toLowerCase();
			const lowerIndex = lowerText.indexOf(lowerWord, searchStart);
			if (lowerIndex === -1) {
				return null;
			}
			if (index === wordIndex) {
				return { end: lowerIndex + word.length, start: lowerIndex };
			}
			searchStart = lowerIndex + word.length;
		} else {
			if (index === wordIndex) {
				return { end: foundIndex + word.length, start: foundIndex };
			}
			searchStart = foundIndex + word.length;
		}
	}

	return null;
}

/**
 * Find the word index at a given character position in segment text
 * Returns the word's timestamp or null if not found
 */
export function findWordAtCharPosition(
	segmentText: string,
	words: WordTimestamp[] | undefined,
	charPosition: number
): { word: WordTimestamp; index: number } | null {
	if (!words || words.length === 0) {
		return null;
	}

	let searchStart = 0;

	for (const [index, wordTimestamp] of words.entries()) {
		const word = wordTimestamp.word.trim();
		const foundIndex = segmentText.indexOf(word, searchStart);

		if (foundIndex === -1) {
			// Try case-insensitive
			const lowerText = segmentText.toLowerCase();
			const lowerWord = word.toLowerCase();
			const lowerIndex = lowerText.indexOf(lowerWord, searchStart);
			if (lowerIndex === -1) {
				continue;
			}

			if (charPosition >= lowerIndex && charPosition < lowerIndex + word.length) {
				return { index, word: wordTimestamp };
			}
			searchStart = lowerIndex + word.length;
		} else {
			if (charPosition >= foundIndex && charPosition < foundIndex + word.length) {
				return { index, word: wordTimestamp };
			}
			searchStart = foundIndex + word.length;
		}
	}

	return null;
}

/**
 * Find the closest visible match in a list, prioritizing ones on screen
 */
export function findClosestVisibleMatch<T extends { segmentId: string }>(
	matches: T[],
	visibleSegmentIds: Set<string>,
	currentIndex: number,
	direction: "next" | "prev"
): number {
	if (matches.length === 0) {
		return -1;
	}

	// First, try to find a match in visible segments
	const visibleMatches = matches
		.map((m, i) => ({ index: i, match: m }))
		.filter(({ match }) => visibleSegmentIds.has(match.segmentId));

	if (visibleMatches.length > 0) {
		if (direction === "next") {
			// Find first visible match after current
			const next = visibleMatches.find(({ index }) => index > currentIndex);
			if (next) {
				return next.index;
			}
			// Wrap around to first visible
			return visibleMatches[0].index;
		}
		// Find last visible match before current
		const prev = [...visibleMatches].reverse().find(({ index }) => index < currentIndex);
		if (prev) {
			return prev.index;
		}
		// Wrap around to last visible
		return visibleMatches.at(-1)?.index ?? -1;
	}

	// No visible matches, just go to next/prev
	if (direction === "next") {
		return (currentIndex + 1) % matches.length;
	}
	return (currentIndex - 1 + matches.length) % matches.length;
}
