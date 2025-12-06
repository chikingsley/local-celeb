import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { formatTime, generateId } from "@/lib/utils";
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
	deleteSegment: (id: string) => void;
	updateSpeaker: (id: string, updates: Partial<Speaker>) => void;
	deleteSpeaker: (id: string) => void;
	mergeSpeakers: (fromId: string, toId: string) => void;
	reorderSpeakers: (fromIndex: number, toIndex: number) => void;

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

					// Insert segment in time order
					const newSegments = [...state.segments, newSegment].sort((a, b) => {
						const aStart = a.startTime
							.split(":")
							.reduce((acc, t, i) => acc + Number(t) * (i === 0 ? 60 : 1), 0);
						const bStart = b.startTime
							.split(":")
							.reduce((acc, t, i) => acc + Number(t) * (i === 0 ? 60 : 1), 0);
						return aStart - bStart;
					});

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
