import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { closeSilenceGaps } from "@/lib/timeline-gaps";
import { formatTime, generateId, parseTime } from "@/lib/utils";
import {
	AppView,
	DEFAULT_SPEAKERS,
	type FileMetaData,
	type Segment,
	SPEAKER_COLORS,
	type Speaker,
} from "@/types";

interface HistoryEntry {
	segments: Segment[];
	speakers: Speaker[];
}

interface ProjectState {
	// View state
	view: AppView;
	setView: (view: AppView) => void;

	// File/Audio state
	file: File | null;
	audioUrl: string | null;
	meta: FileMetaData;
	setFile: (file: File | null) => void;
	setAudioUrl: (url: string | null) => void;
	setMeta: (meta: Partial<FileMetaData>) => void;

	// Processing state
	isProcessing: boolean;
	loadingMessage: string;
	setProcessing: (isProcessing: boolean, message?: string) => void;

	// Save status - timestamp of last successful persist to localStorage
	lastSavedAt: number | null;
	markSaved: () => void;

	// Project data
	segments: Segment[];
	speakers: Speaker[];

	// History for undo/redo
	past: HistoryEntry[];
	future: HistoryEntry[];

	// Selection
	selectedSegmentId: string | null;
	setSelectedSegmentId: (id: string | null) => void;

	// Actions
	setProjectData: (segments: Segment[], speakers: Speaker[]) => void;
	addSegment: (currentTime: number, speakerId?: string) => void;
	updateSegment: (id: string, updates: Partial<Segment>) => void;
	updateSegments: (updatesById: Record<string, Partial<Segment>>) => void;
	splitSegment: (id: string, splitTime?: number) => void;
	mergeAdjacentSegment: (id: string, direction: "previous" | "next") => void;
	deleteSegment: (id: string) => void;
	updateSpeaker: (id: string, updates: Partial<Speaker>) => void;
	deleteSpeaker: (id: string) => void;
	mergeSpeakers: (fromId: string, toId: string) => void;
	reorderSpeakers: (fromIndex: number, toIndex: number) => void;
	closeTimelineGaps: () => void;

	// History actions
	undo: () => void;
	redo: () => void;
	canUndo: () => boolean;
	canRedo: () => boolean;

	// Cleanup
	cleanupAudioUrl: () => void;
	reset: () => void;
}

const initialMeta: FileMetaData = {
	name: "Untitled Project",
	duration: 0,
	language: "English",
	date: "",
};

function sortSegmentsByStart(segments: Segment[]): Segment[] {
	return [...segments].sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));
}

function splitTextAtRatio(text: string, ratio: number): [string, string] {
	const trimmed = text.trim();
	if (!trimmed) return ["", ""];

	const target = Math.max(1, Math.min(trimmed.length - 1, Math.round(trimmed.length * ratio)));
	const leftBoundary = trimmed.lastIndexOf(" ", target);
	const rightBoundary = trimmed.indexOf(" ", target);
	const splitIndex =
		leftBoundary > 0 && target - leftBoundary <= Math.max(12, (rightBoundary - target || 0) + 8)
			? leftBoundary
			: rightBoundary > 0
				? rightBoundary
				: target;

	return [trimmed.slice(0, splitIndex).trim(), trimmed.slice(splitIndex).trim()];
}

function splitWordsAtTime(
	segment: Segment,
	splitTime: number
): [Segment["words"], Segment["words"]] {
	if (!segment.words || segment.words.length === 0) return [undefined, undefined];

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
	if (segment.wordsDirty) return "dirty";
	return words && words.length > 0 ? (segment.wordTimingStatus ?? "provider") : "absent";
}

function mergedWordTimingStatus(
	first: Segment,
	second: Segment,
	words: Segment["words"]
): Segment["wordTimingStatus"] {
	if (first.wordsDirty || second.wordsDirty) return "dirty";
	if (!words || words.length === 0) return "absent";
	if (first.wordTimingStatus === "manual" || second.wordTimingStatus === "manual") return "manual";
	if (first.wordTimingStatus === "estimated" || second.wordTimingStatus === "estimated") {
		return "estimated";
	}
	return "provider";
}

export const useProjectStore = create<ProjectState>()(
	subscribeWithSelector(
		persist(
			(set, get) => ({
				// Initial state
				view: AppView.WELCOME,
				file: null,
				audioUrl: null,
				meta: initialMeta,
				isProcessing: false,
				loadingMessage: "",
				lastSavedAt: null,
				segments: [],
				speakers: DEFAULT_SPEAKERS,
				past: [],
				future: [],
				selectedSegmentId: null,

				// View actions
				setView: (view) => set({ view }),

				// Save status
				markSaved: () => set({ lastSavedAt: Date.now() }),

				// File actions
				setFile: (file) => set({ file }),

				setAudioUrl: (url) => {
					const state = get();
					// Clean up previous URL to prevent memory leaks
					if (state.audioUrl) {
						URL.revokeObjectURL(state.audioUrl);
					}
					set({ audioUrl: url });
				},

				setMeta: (updates) =>
					set((state) => ({
						meta: { ...state.meta, ...updates },
						lastSavedAt: Date.now(),
					})),

				// Processing actions
				setProcessing: (isProcessing, message = "") =>
					set({ isProcessing, loadingMessage: message }),

				// Selection
				setSelectedSegmentId: (id) => set({ selectedSegmentId: id }),

				// Project data actions (with history)
				setProjectData: (segments, speakers) => {
					const state = get();
					set({
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						future: [],
						segments,
						speakers,
						lastSavedAt: Date.now(),
					});
				},

				addSegment: (currentTime, speakerId) => {
					const state = get();
					// Use provided speakerId or first speaker
					const targetSpeakerId = speakerId || state.speakers[0]?.id || "speaker_1";
					const defaultDuration = 3; // 3 seconds default

					const newSegment: Segment = {
						id: generateId(),
						speakerId: targetSpeakerId,
						startTime: formatTime(currentTime),
						endTime: formatTime(currentTime + defaultDuration),
						text: "",
					};

					const newSegments = sortSegmentsByStart([...state.segments, newSegment]);

					set({
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						future: [],
						segments: newSegments,
						selectedSegmentId: newSegment.id,
						lastSavedAt: Date.now(),
					});
				},

				updateSegment: (id, updates) => {
					const state = get();
					const newSegments = state.segments.map((s) => (s.id === id ? { ...s, ...updates } : s));

					set({
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						future: [],
						segments: newSegments,
						lastSavedAt: Date.now(),
					});
				},

				updateSegments: (updatesById) => {
					const state = get();
					const ids = new Set(Object.keys(updatesById));
					if (ids.size === 0) return;

					const newSegments = state.segments.map((segment) =>
						ids.has(segment.id) ? { ...segment, ...updatesById[segment.id] } : segment
					);

					set({
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						future: [],
						segments: newSegments,
						lastSavedAt: Date.now(),
					});
				},

				splitSegment: (id, splitTime) => {
					const state = get();
					const segments = sortSegmentsByStart(state.segments);
					const segmentIndex = segments.findIndex((segment) => segment.id === id);
					if (segmentIndex === -1) return;

					const segment = segments[segmentIndex];
					const start = parseTime(segment.startTime);
					const end = parseTime(segment.endTime);
					if (end - start < 0.2) return;

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
						...segments.slice(0, segmentIndex),
						leftSegment,
						rightSegment,
						...segments.slice(segmentIndex + 1),
					];

					set({
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						future: [],
						segments: newSegments,
						selectedSegmentId: rightSegment.id,
						lastSavedAt: Date.now(),
					});
				},

				mergeAdjacentSegment: (id, direction) => {
					const state = get();
					const segments = sortSegmentsByStart(state.segments);
					const segmentIndex = segments.findIndex((segment) => segment.id === id);
					if (segmentIndex === -1) return;

					const neighborIndex = direction === "previous" ? segmentIndex - 1 : segmentIndex + 1;
					const neighbor = segments[neighborIndex];
					const segment = segments[segmentIndex];
					if (!neighbor || neighbor.speakerId !== segment.speakerId) return;

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
					const newSegments = segments.flatMap((current) => {
						if (current.id === first.id) return [mergedSegment];
						if (removeIds.has(current.id)) return [];
						return [current];
					});

					set({
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						future: [],
						segments: newSegments,
						selectedSegmentId: mergedSegment.id,
						lastSavedAt: Date.now(),
					});
				},

				deleteSegment: (id) => {
					const state = get();
					set({
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						future: [],
						segments: state.segments.filter((s) => s.id !== id),
						selectedSegmentId: state.selectedSegmentId === id ? null : state.selectedSegmentId,
						lastSavedAt: Date.now(),
					});
				},

				updateSpeaker: (id, updates) => {
					const state = get();
					const newSpeakers = state.speakers.map((s) => (s.id === id ? { ...s, ...updates } : s));

					set({
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						future: [],
						speakers: newSpeakers,
						lastSavedAt: Date.now(),
					});
				},

				deleteSpeaker: (id) => {
					const state = get();
					set({
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						future: [],
						speakers: state.speakers.filter((s) => s.id !== id),
						segments: state.segments.filter((s) => s.speakerId !== id),
						lastSavedAt: Date.now(),
					});
				},

				mergeSpeakers: (fromId, toId) => {
					const state = get();
					set({
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						future: [],
						segments: state.segments.map((s) =>
							s.speakerId === fromId ? { ...s, speakerId: toId } : s
						),
						speakers: state.speakers.filter((s) => s.id !== fromId),
						lastSavedAt: Date.now(),
					});
				},

				reorderSpeakers: (fromIndex, toIndex) => {
					const state = get();
					const newSpeakers = [...state.speakers];
					const [moved] = newSpeakers.splice(fromIndex, 1);
					newSpeakers.splice(toIndex, 0, moved);

					set({
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						future: [],
						speakers: newSpeakers,
						lastSavedAt: Date.now(),
					});
				},

				closeTimelineGaps: () => {
					const state = get();
					const newSegments = closeSilenceGaps(state.segments);
					if (newSegments === state.segments) return;

					set({
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						future: [],
						segments: sortSegmentsByStart(newSegments),
						lastSavedAt: Date.now(),
					});
				},

				// History actions
				undo: () => {
					const state = get();
					if (state.past.length === 0) return;

					const previous = state.past[state.past.length - 1];
					const newPast = state.past.slice(0, -1);

					set({
						past: newPast,
						future: [{ segments: state.segments, speakers: state.speakers }, ...state.future],
						segments: previous.segments,
						speakers: previous.speakers,
						lastSavedAt: Date.now(),
					});
				},

				redo: () => {
					const state = get();
					if (state.future.length === 0) return;

					const next = state.future[0];
					const newFuture = state.future.slice(1);

					set({
						past: [...state.past, { segments: state.segments, speakers: state.speakers }],
						future: newFuture,
						segments: next.segments,
						speakers: next.speakers,
						lastSavedAt: Date.now(),
					});
				},

				canUndo: () => get().past.length > 0,
				canRedo: () => get().future.length > 0,

				// Cleanup
				cleanupAudioUrl: () => {
					const state = get();
					if (state.audioUrl) {
						URL.revokeObjectURL(state.audioUrl);
						set({ audioUrl: null });
					}
				},

				reset: () => {
					const state = get();
					if (state.audioUrl) {
						URL.revokeObjectURL(state.audioUrl);
					}
					set({
						view: AppView.WELCOME,
						file: null,
						audioUrl: null,
						meta: initialMeta,
						isProcessing: false,
						loadingMessage: "",
						segments: [],
						speakers: DEFAULT_SPEAKERS,
						past: [],
						future: [],
						selectedSegmentId: null,
					});
				},
			}),
			{
				name: "local-celeb-project",
				// Only persist the essential project data, not transient state
				partialize: (state) => ({
					view: state.view,
					segments: state.segments,
					speakers: state.speakers,
					meta: state.meta,
					lastSavedAt: state.lastSavedAt,
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
		id,
		name: `Speaker ${idx + 1}`,
		color: SPEAKER_COLORS[idx % SPEAKER_COLORS.length],
	}));
}
