import { create } from "zustand";
import { LAYOUT, ZOOM } from "@/app/layout-constants";

export const PLAYBACK_SPEEDS = [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

// Callback types for cross-component coordination
type ScrollToTimeCallback = (timeSeconds: number) => void;
type ScrollToSegmentCallback = (segmentId: string) => void;
type SeekAudioCallback = (timeSeconds: number) => void;

// Source of seek for debugging/tracking
export type SeekSource = "audio" | "editor" | "timeline" | "keyboard" | "find";

interface PlayerState {
	autoFollowEnabled: boolean; // Whether timeline auto-scrolls during playback
	currentTime: number;
	duration: number;
	// Playback state
	isPlaying: boolean;
	isResizingSidebar: boolean;
	isResizingTimeline: boolean;
	playbackSpeed: PlaybackSpeed;
	registerScrollToSegment: (callback: ScrollToSegmentCallback) => void;

	// Scroll coordination actions
	registerScrollToTime: (callback: ScrollToTimeCallback) => void;
	registerSeekAudio: (callback: SeekAudioCallback) => void;

	// Reset
	resetPlayback: () => void;
	rightSidebarWidth: number;
	scrollToSegment: (segmentId: string) => void;
	scrollToSegmentCallback: ScrollToSegmentCallback | null;
	scrollToTime: (timeSeconds: number) => void;

	// Scroll coordination - callbacks registered by components
	scrollToTimeCallback: ScrollToTimeCallback | null;
	seekAudioCallback: SeekAudioCallback | null;

	// Unified seek action - single source of truth for seeking
	seekTo: (timeSeconds: number, source?: SeekSource) => void;
	setAutoFollow: (enabled: boolean) => void;
	setCurrentTime: (time: number) => void;
	setDuration: (duration: number) => void;

	// Playback actions
	setIsPlaying: (isPlaying: boolean) => void;
	setIsResizingSidebar: (isResizing: boolean) => void;
	setIsResizingTimeline: (isResizing: boolean) => void;
	setPlaybackSpeed: (speed: PlaybackSpeed) => void;
	setRightSidebarWidth: (width: number) => void;

	// Layout actions
	setTimelineHeight: (height: number) => void;
	setZoomLevel: (level: number) => void;

	// Layout state
	timelineHeight: number;
	togglePlay: () => void;
	zoomLevel: number;
}

export const usePlayerStore = create<PlayerState>()((set, get) => ({
	autoFollowEnabled: true,
	currentTime: 0,
	duration: 0,
	// Initial state
	isPlaying: false,
	isResizingSidebar: false,
	isResizingTimeline: false,
	playbackSpeed: 1.0,
	registerScrollToSegment: (callback) => set({ scrollToSegmentCallback: callback }),

	// Scroll coordination actions
	registerScrollToTime: (callback) => set({ scrollToTimeCallback: callback }),
	registerSeekAudio: (callback) => set({ seekAudioCallback: callback }),

	// Reset
	resetPlayback: () =>
		set({
			currentTime: 0,
			duration: 0,
			isPlaying: false,
		}),
	rightSidebarWidth: LAYOUT.DEFAULT_RIGHT_SIDEBAR_WIDTH,

	scrollToSegment: (segmentId) => {
		const callback = get().scrollToSegmentCallback;
		if (callback) {
			callback(segmentId);
		}
	},
	scrollToSegmentCallback: null,

	scrollToTime: (timeSeconds) => {
		const callback = get().scrollToTimeCallback;
		if (callback) {
			callback(timeSeconds);
		}
	},
	scrollToTimeCallback: null,
	seekAudioCallback: null,

	// Unified seek - updates store AND syncs audio element
	seekTo: (timeSeconds, _source) => {
		set({ currentTime: timeSeconds });
		const callback = get().seekAudioCallback;
		if (callback) {
			callback(timeSeconds);
		}
	},

	setAutoFollow: (enabled) => set({ autoFollowEnabled: enabled }),

	setCurrentTime: (time) => set({ currentTime: time }),

	setDuration: (duration) => set({ duration }),

	// Playback actions
	setIsPlaying: (isPlaying) => set({ isPlaying }),

	setIsResizingSidebar: (isResizing) => set({ isResizingSidebar: isResizing }),

	setIsResizingTimeline: (isResizing) => set({ isResizingTimeline: isResizing }),

	setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

	setRightSidebarWidth: (width) => {
		if (width < LAYOUT.RIGHT_SIDEBAR_SNAP_THRESHOLD) {
			set({ rightSidebarWidth: 0 }); // Snap close
		} else {
			const clampedWidth = Math.max(
				LAYOUT.MIN_RIGHT_SIDEBAR_WIDTH,
				Math.min(width, LAYOUT.MAX_RIGHT_SIDEBAR_WIDTH)
			);
			set({ rightSidebarWidth: clampedWidth });
		}
	},

	// Layout actions
	setTimelineHeight: (height) => {
		if (height <= 0) {
			set({ timelineHeight: 0 });
			return;
		}

		const clampedHeight = Math.max(
			LAYOUT.MIN_TIMELINE_HEIGHT,
			Math.min(height, window.innerHeight - LAYOUT.MAX_TIMELINE_HEIGHT_OFFSET)
		);
		set({ timelineHeight: clampedHeight });
	},

	setZoomLevel: (level) => set({ zoomLevel: Math.max(ZOOM.MIN, Math.min(ZOOM.MAX, level)) }),
	timelineHeight: LAYOUT.DEFAULT_TIMELINE_HEIGHT,

	togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
	zoomLevel: ZOOM.DEFAULT,
}));
