import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { AppView } from "@/app/view-state";
import { closeSilenceGaps } from "@/domain/timeline/timeline-gaps";
import { DEFAULT_SPEAKERS, SPEAKER_COLORS } from "@/domain/transcript/constants";
import type { FileMetaData, Segment, Speaker } from "@/domain/transcript/types";
import { formatTime, generateId, parseTime } from "@/lib/utils";

interface HistoryEntry {
	segments: Segment[];
	speakers: Speaker[];
}

interface ProjectState {
	addSegment: (currentTime: number, speakerId?: string) => void;
	audioUrl: string | null;
	canRedo: () => boolean;
	canUndo: () => boolean;

	// Cleanup
	cleanupAudioUrl: () => void;
	closeTimelineGaps: () => void;
	deleteSegment: (id: string) => void;
	deleteSpeaker: (id: string) => void;

	// File/Audio state
	file: File | null;
	future: HistoryEntry[];

	// Processing state
	isProcessing: boolean;

	// Save status - timestamp of last successful persist to localStorage
	lastSavedAt: number | null;
	loadingMessage: string;
	markSaved: () => void;
	mergeAdjacentSegment: (id: string, direction: "previous" | "next") => void;
	mergeSpeakers: (fromId: string, toId: string) => void;
	meta: FileMetaData;

	// History for undo/redo
	past: HistoryEntry[];
	redo: () => void;
	reorderSpeakers: (fromIndex: number, toIndex: number) => void;
	reset: () => void;

	// Project data
	segments: Segment[];

	// Selection
	selectedSegmentId: string | null;
	setAudioUrl: (url: string | null) => void;
	setFile: (file: File | null) => void;
	setMeta: (meta: Partial<FileMetaData>) => void;
	setProcessing: (isProcessing: boolean, message?: string) => void;

	// Actions
	setProjectData: (segments: Segment[], speakers: Speaker[]) => void;
	setSelectedSegmentId: (id: string | null) => void;
	setView: (view: AppView) => void;
	speakers: Speaker[];
	splitSegment: (id: string, splitTime?: number) => void;

	// History actions
	undo: () => void;
	updateSegment: (id: string, updates: Partial<Segment>) => void;
	updateSegments: (updatesById: Record<string, Partial<Segment>>) => void;
	updateSpeaker: (id: string, updates: Partial<Speaker>) => void;
	// View state
	view: AppView;
}

const initialMeta: FileMetaData = {
	date: "",
	duration: 0,
	language: "English",
	name: "Untitled Project",
};

function sortSegmentsByStart(segments: Segment[]): Segment[] {
	return [...segments].sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));
}

function splitTextAtRatio(text: string, ratio: number): [string, string] {
	const trimmed = text.trim();
	if (!trimmed) {
		return ["", ""];
	}

	const target = Math.max(1, Math.min(trimmed.length - 1, Math.round(trimmed.length * ratio)));
	const leftBoundary = trimmed.lastIndexOf(" ", target);
	const rightBoundary = trimmed.indexOf(" ", target);
	let splitIndex = target;
	if (
		leftBoundary > 0 &&
		target - leftBoundary <= Math.max(12, (rightBoundary - target || 0) + 8)
	) {
		splitIndex = leftBoundary;
	} else if (rightBoundary > 0) {
		splitIndex = rightBoundary;
	}

	return [trimmed.slice(0, splitIndex).trim(), trimmed.slice(splitIndex).trim()];
}

function splitWordsAtTime(
	segment: Segment,
	splitTime: number
): [Segment["words"], Segment["words"]] {
	if (!segment.words || segment.words.length === 0) {
		return [undefined, undefined];
	}

	const leftWords = segment.words.filter((word) => (word.start + word.end) / 2 <= splitTime);
	const rightWords = segment.words.filter((word) => (word.start + word.end) / 2 > splitTime);

	return [
		leftWords.length > 0 ? leftWords : undefined,
		rightWords.length > 0 ? rightWords : undefined,
	];
}

function wordsToText(words: Segment["words"]): string {
	return (
		words
			?.map((word) => word.word)
			.join(" ")
			.trim() ?? ""
	);
}

function joinSegmentText(first: Segment, second: Segment): string {
	return [first.text.trim(), second.text.trim()].filter(Boolean).join("\n");
}

function splitWordTimingStatus(
	segment: Segment,
	words: Segment["words"]
): Segment["wordTimingStatus"] {
	if (segment.wordsDirty) {
		return "dirty";
	}
	return words && words.length > 0 ? (segment.wordTimingStatus ?? "provider") : "absent";
}

function mergedWordTimingStatus(
	first: Segment,
	second: Segment,
	words: Segment["words"]
): Segment["wordTimingStatus"] {
	if (first.wordsDirty || second.wordsDirty) {
		return "dirty";
	}
	if (!words || words.length === 0) {
		return "absent";
	}
	if (first.wordTimingStatus === "manual" || second.wordTimingStatus === "manual") {
		return "manual";
	}
	if (first.wordTimingStatus === "estimated" || second.wordTimingStatus === "estimated") {
		return "estimated";
	}
	return "provider";
}

export const useProjectStore = create<ProjectState>()(
	subscribeWithSelector(
		persist(
			(set, get) => ({
				addSegment: (currentTime, speakerId) => {
					const state = get();
					// Use provided speakerId or first speaker
					const targetSpeakerId = speakerId || state.speakers[0]?.id || "speaker_1";
					const defaultDuration = 3; // 3 seconds default

					const newSegment: Segment = {
						endTime: formatTime(currentTime + defaultDuration),
						id: generateId(),
						speakerId: targetSpeakerId,
						startTime: formatTime(currentTime),
						text: "",
					};

					const newSegments = sortSegmentsByStart([...state.segments, newSegment]);

					set({
						future: [],
						lastSavedAt: Date.now(),
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						segments: newSegments,
						selectedSegmentId: newSegment.id,
					});
				},
				audioUrl: null,
				canRedo: () => get().future.length > 0,

				canUndo: () => get().past.length > 0,

				// Cleanup
				cleanupAudioUrl: () => {
					const state = get();
					if (state.audioUrl) {
						URL.revokeObjectURL(state.audioUrl);
						set({ audioUrl: null });
					}
				},

				closeTimelineGaps: () => {
					const state = get();
					const newSegments = closeSilenceGaps(state.segments);
					if (newSegments === state.segments) {
						return;
					}

					set({
						future: [],
						lastSavedAt: Date.now(),
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						segments: sortSegmentsByStart(newSegments),
					});
				},

				deleteSegment: (id) => {
					const state = get();
					set({
						future: [],
						lastSavedAt: Date.now(),
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						segments: state.segments.filter((segment) => segment.id !== id),
						selectedSegmentId: state.selectedSegmentId === id ? null : state.selectedSegmentId,
					});
				},

				deleteSpeaker: (id) => {
					const state = get();
					set({
						future: [],
						lastSavedAt: Date.now(),
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						segments: state.segments.filter((segment) => segment.speakerId !== id),
						speakers: state.speakers.filter((speaker) => speaker.id !== id),
					});
				},
				file: null,
				future: [],
				isProcessing: false,
				lastSavedAt: null,
				loadingMessage: "",

				// Save status
				markSaved: () => set({ lastSavedAt: Date.now() }),

				mergeAdjacentSegment: (id, direction) => {
					const state = get();
					const orderedSegments = sortSegmentsByStart(state.segments);
					const segmentIndex = orderedSegments.findIndex((candidate) => candidate.id === id);
					if (segmentIndex === -1) {
						return;
					}

					const neighborIndex = direction === "previous" ? segmentIndex - 1 : segmentIndex + 1;
					const neighbor = orderedSegments[neighborIndex];
					const segment = orderedSegments[segmentIndex];
					if (!neighbor || neighbor.speakerId !== segment.speakerId) {
						return;
					}

					const first = neighborIndex < segmentIndex ? neighbor : segment;
					const second = neighborIndex < segmentIndex ? segment : neighbor;
					const mergedWords =
						first.words && second.words ? [...first.words, ...second.words] : undefined;
					const mergedSegment: Segment = {
						...first,
						endTime: second.endTime,
						text: joinSegmentText(first, second),
						...(mergedWords ? { words: mergedWords } : { words: undefined }),
						...(first.wordsDirty || second.wordsDirty ? { wordsDirty: true } : {}),
						wordTimingStatus: mergedWordTimingStatus(first, second, mergedWords),
					};

					const removeIds = new Set([first.id, second.id]);
					const newSegments = orderedSegments.flatMap((current) => {
						if (current.id === first.id) {
							return [mergedSegment];
						}
						if (removeIds.has(current.id)) {
							return [];
						}
						return [current];
					});

					set({
						future: [],
						lastSavedAt: Date.now(),
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						segments: newSegments,
						selectedSegmentId: mergedSegment.id,
					});
				},

				mergeSpeakers: (fromId, toId) => {
					const state = get();
					set({
						future: [],
						lastSavedAt: Date.now(),
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						segments: state.segments.map((segment) =>
							segment.speakerId === fromId ? { ...segment, speakerId: toId } : segment
						),
						speakers: state.speakers.filter((speaker) => speaker.id !== fromId),
					});
				},
				meta: initialMeta,
				past: [],

				redo: () => {
					const state = get();
					if (state.future.length === 0) {
						return;
					}

					const [next] = state.future;
					const newFuture = state.future.slice(1);
					if (!next) {
						return;
					}

					set({
						future: newFuture,
						lastSavedAt: Date.now(),
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						segments: next.segments,
						speakers: next.speakers,
					});
				},

				reorderSpeakers: (fromIndex, toIndex) => {
					const state = get();
					const newSpeakers = [...state.speakers];
					const [moved] = newSpeakers.splice(fromIndex, 1);
					newSpeakers.splice(toIndex, 0, moved);

					set({
						future: [],
						lastSavedAt: Date.now(),
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						speakers: newSpeakers,
					});
				},

				reset: () => {
					const state = get();
					if (state.audioUrl) {
						URL.revokeObjectURL(state.audioUrl);
					}
					set({
						audioUrl: null,
						file: null,
						future: [],
						isProcessing: false,
						loadingMessage: "",
						meta: initialMeta,
						past: [],
						segments: [],
						selectedSegmentId: null,
						speakers: DEFAULT_SPEAKERS,
						view: AppView.WELCOME,
					});
				},
				segments: [],
				selectedSegmentId: null,

				setAudioUrl: (url) => {
					const state = get();
					// Clean up previous URL to prevent memory leaks
					if (state.audioUrl) {
						URL.revokeObjectURL(state.audioUrl);
					}
					set({ audioUrl: url });
				},

				// File actions
				setFile: (file) => set({ file }),

				setMeta: (updates) =>
					set((state) => ({
						lastSavedAt: Date.now(),
						meta: { ...state.meta, ...updates },
					})),

				// Processing actions
				setProcessing: (isProcessing, message = "") =>
					set({ isProcessing, loadingMessage: message }),

				// Project data actions (with history)
				setProjectData: (segments, speakers) => {
					const state = get();
					set({
						future: [],
						lastSavedAt: Date.now(),
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						segments,
						speakers,
					});
				},

				// Selection
				setSelectedSegmentId: (id) => set({ selectedSegmentId: id }),

				// View actions
				setView: (view) => set({ view }),
				speakers: DEFAULT_SPEAKERS,

				splitSegment: (id, splitTime) => {
					const state = get();
					const orderedSegments = sortSegmentsByStart(state.segments);
					const segmentIndex = orderedSegments.findIndex((candidate) => candidate.id === id);
					if (segmentIndex === -1) {
						return;
					}

					const segment = orderedSegments[segmentIndex];
					const start = parseTime(segment.startTime);
					const end = parseTime(segment.endTime);
					if (end - start < 0.2) {
						return;
					}

					const requestedSplit =
						typeof splitTime === "number" && splitTime > start + 0.1 && splitTime < end - 0.1
							? splitTime
							: (start + end) / 2;
					const splitAt = Math.max(start + 0.1, Math.min(end - 0.1, requestedSplit));
					const ratio = (splitAt - start) / (end - start);
					const [leftWords, rightWords] = splitWordsAtTime(segment, splitAt);
					const [leftTextByRatio, rightTextByRatio] = splitTextAtRatio(segment.text, ratio);
					const leftText = wordsToText(leftWords) || leftTextByRatio;
					const rightText = wordsToText(rightWords) || rightTextByRatio;

					const leftSegment: Segment = {
						...segment,
						endTime: formatTime(splitAt),
						text: leftText,
						...(leftWords ? { words: leftWords } : { words: undefined }),
						...(segment.wordsDirty ? { wordsDirty: true } : {}),
						wordTimingStatus: splitWordTimingStatus(segment, leftWords),
					};
					const rightSegment: Segment = {
						...segment,
						id: generateId("segment"),
						startTime: formatTime(splitAt),
						text: rightText,
						...(rightWords ? { words: rightWords } : { words: undefined }),
						...(segment.wordsDirty ? { wordsDirty: true } : {}),
						wordTimingStatus: splitWordTimingStatus(segment, rightWords),
					};

					const newSegments = [
						...orderedSegments.slice(0, segmentIndex),
						leftSegment,
						rightSegment,
						...orderedSegments.slice(segmentIndex + 1),
					];

					set({
						future: [],
						lastSavedAt: Date.now(),
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						segments: newSegments,
						selectedSegmentId: rightSegment.id,
					});
				},

				// History actions
				undo: () => {
					const state = get();
					if (state.past.length === 0) {
						return;
					}

					const previous = state.past.at(-1);
					const newPast = state.past.slice(0, -1);
					if (!previous) {
						return;
					}

					set({
						future: [{ segments: state.segments, speakers: state.speakers }, ...state.future],
						lastSavedAt: Date.now(),
						past: newPast,
						segments: previous.segments,
						speakers: previous.speakers,
					});
				},

				updateSegment: (id, updates) => {
					const state = get();
					const newSegments = state.segments.map((segment) =>
						segment.id === id ? { ...segment, ...updates } : segment
					);

					set({
						future: [],
						lastSavedAt: Date.now(),
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						segments: newSegments,
					});
				},

				updateSegments: (updatesById) => {
					const state = get();
					const ids = new Set(Object.keys(updatesById));
					if (ids.size === 0) {
						return;
					}

					const newSegments = state.segments.map((segment) =>
						ids.has(segment.id) ? { ...segment, ...updatesById[segment.id] } : segment
					);

					set({
						future: [],
						lastSavedAt: Date.now(),
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						segments: newSegments,
					});
				},

				updateSpeaker: (id, updates) => {
					const state = get();
					const newSpeakers = state.speakers.map((s) => (s.id === id ? { ...s, ...updates } : s));

					set({
						future: [],
						lastSavedAt: Date.now(),
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						speakers: newSpeakers,
					});
				},
				// Initial state
				view: AppView.WELCOME,
			}),
			{
				name: "local-celeb-project",
				// Only persist the essential project data, not transient state
				partialize: (state) => ({
					lastSavedAt: state.lastSavedAt,
					meta: state.meta,
					segments: state.segments,
					speakers: state.speakers,
					view: state.view,
				}),
			}
		)
	)
);

// Selector hooks for better performance
export const useSegments = () => useProjectStore((state) => state.segments);
export const useSpeakers = () => useProjectStore((state) => state.speakers);
export const useSelectedSegment = () => {
	const selectedId = useProjectStore((state) => state.selectedSegmentId);
	const segments = useProjectStore((state) => state.segments);
	return segments.find((s) => s.id === selectedId) ?? null;
};

// Helper to create speakers from transcription result
export function createSpeakersFromSegments(segments: Segment[]): Speaker[] {
	const uniqueSpeakerIds = Array.from(new Set(segments.map((s) => s.speakerId)));
	return uniqueSpeakerIds.map((id, idx) => ({
		color: SPEAKER_COLORS[idx % SPEAKER_COLORS.length],
		id,
		name: `Speaker ${idx + 1}`,
	}));
}
