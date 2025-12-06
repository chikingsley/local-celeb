import type { Segment, WordTimestamp } from "@/types";
import { parseTime } from "./playback-utils";

/**
 * Extended word with character positions for efficient lookup
 */
export interface WordIndex {
	segmentId: string;
	wordIndex: number;
	word: string;
	start: number; // Word start time in seconds
	end: number; // Word end time in seconds
	charStart: number; // Character position in segment text
	charEnd: number; // Character end position in segment text
	interpolated: boolean; // Whether timestamp was estimated
}

/**
 * Interpolate missing word timestamps within a segment.
 * Fills gaps where Whisper didn't return timestamps (~8% of words).
 *
 * Algorithm:
 * 1. Split segment text into words
 * 2. Match each text word to a Whisper word (fuzzy match for punctuation)
 * 3. For unmatched words, estimate timing based on position and neighbors
 */
export function interpolateWordTimestamps(
	segmentText: string,
	whisperWords: WordTimestamp[] | undefined,
	segmentStart: number,
	segmentEnd: number
): WordTimestamp[] {
	const textWords = segmentText.trim().split(/\s+/).filter(Boolean);
	if (textWords.length === 0) return [];

	// If no Whisper words at all, distribute evenly
	if (!whisperWords || whisperWords.length === 0) {
		const duration = segmentEnd - segmentStart;
		const avgDuration = duration / textWords.length;
		return textWords.map((word, i) => ({
			word,
			start: segmentStart + i * avgDuration,
			end: segmentStart + (i + 1) * avgDuration,
			interpolated: true,
		}));
	}

	// Create a map of whisper words for matching
	// Use a simple greedy approach: match in order, allowing for punctuation differences
	const result: WordTimestamp[] = [];
	let whisperIdx = 0;

	for (let i = 0; i < textWords.length; i++) {
		const textWord = textWords[i];
		const normalizedTextWord = normalizeWord(textWord);

		// Try to find matching Whisper word
		let matched = false;
		if (whisperIdx < whisperWords.length) {
			const whisperWord = whisperWords[whisperIdx];
			const normalizedWhisperWord = normalizeWord(whisperWord.word);

			if (normalizedTextWord === normalizedWhisperWord) {
				// Direct match
				result.push({
					word: textWord, // Use original text word to preserve punctuation
					start: whisperWord.start,
					end: whisperWord.end,
					interpolated: false,
				});
				whisperIdx++;
				matched = true;
			}
		}

		if (!matched) {
			// No match - need to interpolate
			// Find surrounding timestamps for estimation
			const prevEnd = result.length > 0 ? result[result.length - 1].end : segmentStart;
			const nextStart = findNextWhisperStart(whisperWords, whisperIdx, segmentEnd);
			const remainingTextWords = textWords.length - i;
			const remainingTime = nextStart - prevEnd;
			const estimatedDuration = remainingTime / remainingTextWords;

			result.push({
				word: textWord,
				start: prevEnd,
				end: Math.min(prevEnd + estimatedDuration, segmentEnd),
				interpolated: true,
			});
		}
	}

	return result;
}

/**
 * Normalize word for comparison (lowercase, remove punctuation)
 */
function normalizeWord(word: string): string {
	return word.toLowerCase().replace(/[.,!?;:'"()\[\]{}]/g, "").trim();
}

/**
 * Find the start time of the next available Whisper word
 */
function findNextWhisperStart(
	whisperWords: WordTimestamp[],
	fromIndex: number,
	segmentEnd: number
): number {
	if (fromIndex < whisperWords.length) {
		return whisperWords[fromIndex].start;
	}
	return segmentEnd;
}

/**
 * Build a sorted word index from segments for O(log n) time-based lookup.
 * Includes interpolation of missing timestamps.
 */
export function buildWordIndex(segments: Segment[]): WordIndex[] {
	const index: WordIndex[] = [];

	for (const segment of segments) {
		const segStart = parseTime(segment.startTime);
		const segEnd = parseTime(segment.endTime);

		// Interpolate to fill gaps
		const words = interpolateWordTimestamps(segment.text, segment.words, segStart, segEnd);

		// Calculate character positions
		let charPos = 0;
		const segmentText = segment.text;

		for (let i = 0; i < words.length; i++) {
			const word = words[i];
			// Find this word in segment text starting from current position
			const wordText = word.word;
			const foundIdx = segmentText.indexOf(wordText, charPos);

			if (foundIdx !== -1) {
				index.push({
					segmentId: segment.id,
					wordIndex: i,
					word: word.word,
					start: word.start,
					end: word.end,
					charStart: foundIdx,
					charEnd: foundIdx + wordText.length,
					interpolated: word.interpolated ?? false,
				});
				charPos = foundIdx + wordText.length;
			} else {
				// Word not found in text - try case-insensitive
				const lowerText = segmentText.toLowerCase();
				const lowerWord = wordText.toLowerCase();
				const lowerIdx = lowerText.indexOf(lowerWord, charPos);

				if (lowerIdx !== -1) {
					index.push({
						segmentId: segment.id,
						wordIndex: i,
						word: word.word,
						start: word.start,
						end: word.end,
						charStart: lowerIdx,
						charEnd: lowerIdx + wordText.length,
						interpolated: word.interpolated ?? false,
					});
					charPos = lowerIdx + wordText.length;
				}
				// If still not found, skip this word (shouldn't happen with proper interpolation)
			}
		}
	}

	// Sort by start time for binary search
	index.sort((a, b) => a.start - b.start);

	return index;
}

/**
 * Binary search to find word at given time - O(log n)
 */
export function findWordAtTimeFast(
	wordIndex: WordIndex[],
	timeSeconds: number
): WordIndex | null {
	if (wordIndex.length === 0) return null;

	let low = 0;
	let high = wordIndex.length - 1;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const word = wordIndex[mid];

		if (timeSeconds >= word.start && timeSeconds < word.end) {
			return word;
		}

		if (timeSeconds < word.start) {
			high = mid - 1;
		} else {
			low = mid + 1;
		}
	}

	return null;
}

/**
 * Find word at character position within a segment - O(n) but only for one segment
 */
export function findWordAtCharPositionFast(
	wordIndex: WordIndex[],
	segmentId: string,
	charPosition: number
): WordIndex | null {
	// Filter to segment and find by char position
	for (const word of wordIndex) {
		if (word.segmentId === segmentId) {
			if (charPosition >= word.charStart && charPosition < word.charEnd) {
				return word;
			}
		}
	}
	return null;
}

/**
 * Get all words for a specific segment from the index
 */
export function getSegmentWords(wordIndex: WordIndex[], segmentId: string): WordIndex[] {
	return wordIndex.filter((w) => w.segmentId === segmentId);
}
