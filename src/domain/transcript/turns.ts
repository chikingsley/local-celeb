import type { Segment } from "@/domain/transcript/types";

const TOKEN_WITH_TRAILING_SPACE_PATTERN = /\S+\s*/g;
const WORD_SPLIT_PATTERN = /\s+/;

export interface TurnSegmentRange {
	end: number;
	endTime: string;
	segmentId: string;
	start: number;
	startTime: string;
}

export interface TranscriptTurn {
	endTime: string;
	hasWordTiming: boolean;
	id: string;
	segmentIds: string[];
	segmentRanges: TurnSegmentRange[];
	speakerId: string;
	startTime: string;
	text: string;
	wordsDirty: boolean;
}

export interface TurnLookup {
	turnById: Map<string, TranscriptTurn>;
	turnIdBySegmentId: Map<string, string>;
}

export function deriveTranscriptTurns(segments: Segment[]): TranscriptTurn[] {
	const turns: TranscriptTurn[] = [];
	let currentSegments: Segment[] = [];

	const flush = () => {
		if (currentSegments.length === 0) {
			return;
		}
		turns.push(buildTurn(currentSegments, turns.length));
		currentSegments = [];
	};

	for (const segment of segments) {
		const currentSpeakerId = currentSegments.at(-1)?.speakerId;
		if (currentSpeakerId && segment.speakerId !== currentSpeakerId) {
			flush();
		}
		currentSegments.push(segment);
	}

	flush();
	return turns;
}

export function buildTurnLookup(turns: TranscriptTurn[]): TurnLookup {
	const turnById = new Map<string, TranscriptTurn>();
	const turnIdBySegmentId = new Map<string, string>();

	for (const turn of turns) {
		turnById.set(turn.id, turn);
		for (const segmentId of turn.segmentIds) {
			turnIdBySegmentId.set(segmentId, turn.id);
		}
	}

	return { turnById, turnIdBySegmentId };
}

export function getSegmentIdAtTurnChar(turn: TranscriptTurn, charIndex: number): string | null {
	if (turn.segmentRanges.length === 0) {
		return null;
	}

	const contained = turn.segmentRanges.find(
		(range) => charIndex >= range.start && charIndex <= range.end
	);
	if (contained) {
		return contained.segmentId;
	}

	const next = turn.segmentRanges.find((range) => charIndex < range.start);
	if (next) {
		return next.segmentId;
	}

	return turn.segmentRanges.at(-1)?.segmentId ?? null;
}

export function splitTurnTextAcrossSegments(
	text: string,
	segments: Segment[]
): Map<string, string> {
	const updates = new Map<string, string>();
	if (segments.length === 0) {
		return updates;
	}
	if (segments.length === 1) {
		updates.set(segments[0].id, text.trim());
		return updates;
	}

	const tokens = tokenizeWordsWithTrailingSpace(text);
	if (tokens.length === 0) {
		for (const segment of segments) {
			updates.set(segment.id, "");
		}
		return updates;
	}

	const originalWordCounts = segments.map((segment) => countWords(segment.text));
	const totalOriginalWords = originalWordCounts.reduce((sum, count) => sum + count, 0);

	if (totalOriginalWords === 0) {
		updates.set(segments[0].id, text.trim());
		for (const segment of segments.slice(1)) {
			updates.set(segment.id, "");
		}
		return updates;
	}

	let tokenIndex = 0;
	for (const [segmentIndex, segment] of segments.entries()) {
		if (segmentIndex === segments.length - 1) {
			updates.set(segment.id, joinTokens(tokens.slice(tokenIndex)));
			break;
		}

		const remainingSegments = segments.slice(segmentIndex + 1);
		const minimumRemainingWords = remainingSegments.filter(
			(remainingSegment) => countWords(remainingSegment.text) > 0
		).length;
		const targetCount = Math.round(
			(tokens.length * originalWordCounts[segmentIndex]) / totalOriginalWords
		);
		const availableCount = Math.max(0, tokens.length - tokenIndex - minimumRemainingWords);
		const takeCount = Math.min(Math.max(targetCount, 0), availableCount);

		updates.set(segment.id, joinTokens(tokens.slice(tokenIndex, tokenIndex + takeCount)));
		tokenIndex += takeCount;
	}

	return updates;
}

function buildTurn(segments: Segment[], index: number): TranscriptTurn {
	const { text, ranges } = joinSegmentText(segments);
	const [first] = segments;
	const last = segments.at(-1) ?? first;

	return {
		endTime: last.endTime,
		hasWordTiming: segments.some((segment) => (segment.words?.length ?? 0) > 0),
		id: `turn-${index + 1}-${first.id}`,
		segmentIds: segments.map((segment) => segment.id),
		segmentRanges: ranges,
		speakerId: first.speakerId,
		startTime: first.startTime,
		text,
		wordsDirty: segments.some((segment) => segment.wordsDirty),
	};
}

function joinSegmentText(segments: Segment[]): { text: string; ranges: TurnSegmentRange[] } {
	let text = "";
	const ranges: TurnSegmentRange[] = [];

	for (const [index, segment] of segments.entries()) {
		if (index > 0 && text.length > 0) {
			text += " ";
		}

		const start = text.length;
		text += segment.text;
		ranges.push({
			end: text.length,
			endTime: segment.endTime,
			segmentId: segment.id,
			start,
			startTime: segment.startTime,
		});
	}

	return { ranges, text };
}

function tokenizeWordsWithTrailingSpace(text: string): string[] {
	return text.match(TOKEN_WITH_TRAILING_SPACE_PATTERN) ?? [];
}

function joinTokens(tokens: string[]): string {
	return tokens.join("").trim();
}

function countWords(text: string): number {
	return text.trim().split(WORD_SPLIT_PATTERN).filter(Boolean).length;
}
