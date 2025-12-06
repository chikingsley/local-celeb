import { create } from "zustand";
import { LAYOUT, ZOOM } from "@/types";

export const PLAYBACK_SPEEDS = [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

// Callback types for cross-component coordination
type ScrollToTimeCallback = (timeSeconds: number) => void;
type ScrollToSegmentCallback = (segmentId: string) => void;
type SeekAudioCallback = (timeSeconds: number) => void;

// Source of seek for debugging/tracking
export type SeekSource = "audio" | "editor" | "timeline" | "keyboard" | "find";

interface PlayerState {
	// Playback state
	isPlaying: boolean;
	currentTime: number;
	duration: number;
	zoomLevel: number;
	playbackSpeed: PlaybackSpeed;
	autoFollowEnabled: boolean; // Whether timeline auto-scrolls during playback

	// Layout state
	sidebarCollapsed: boolean;
	timelineHeight: number;
	rightSidebarWidth: number;
	isResizingTimeline: boolean;
	isResizingSidebar: boolean;

	// Scroll coordination - callbacks registered by components
	scrollToTimeCallback: ScrollToTimeCallback | null;
	scrollToSegmentCallback: ScrollToSegmentCallback | null;
	seekAudioCallback: SeekAudioCallback | null;

	// Playback actions
	setIsPlaying: (isPlaying: boolean) => void;
	togglePlay: () => void;
	setCurrentTime: (time: number) => void;
	setDuration: (duration: number) => void;
	setZoomLevel: (level: number) => void;
	setPlaybackSpeed: (speed: PlaybackSpeed) => void;
	setAutoFollow: (enabled: boolean) => void;

	// Layout actions
	setSidebarCollapsed: (collapsed: boolean) => void;
	toggleSidebar: () => void;
	setTimelineHeight: (height: number) => void;
	setRightSidebarWidth: (width: number) => void;
	setIsResizingTimeline: (isResizing: boolean) => void;
	setIsResizingSidebar: (isResizing: boolean) => void;

	// Scroll coordination actions
	registerScrollToTime: (callback: ScrollToTimeCallback) => void;
	registerScrollToSegment: (callback: ScrollToSegmentCallback) => void;
	registerSeekAudio: (callback: SeekAudioCallback) => void;
	scrollToTime: (timeSeconds: number) => void;
	scrollToSegment: (segmentId: string) => void;

	// Unified seek action - single source of truth for seeking
	seekTo: (timeSeconds: number, source?: SeekSource) => void;

	// Reset
	resetPlayback: () => void;
}

export const usePlayerStore = create<PlayerState>()((set, get) => ({
	// Initial state
	isPlaying: false,
	currentTime: 0,
	duration: 0,
	zoomLevel: ZOOM.DEFAULT,
	playbackSpeed: 1.0,
	autoFollowEnabled: true,
	sidebarCollapsed: false,
	timelineHeight: LAYOUT.DEFAULT_TIMELINE_HEIGHT,
	rightSidebarWidth: LAYOUT.DEFAULT_RIGHT_SIDEBAR_WIDTH,
	isResizingTimeline: false,
	isResizingSidebar: false,
	scrollToTimeCallback: null,
	scrollToSegmentCallback: null,
	seekAudioCallback: null,

	// Playback actions
	setIsPlaying: (isPlaying) => set({ isPlaying }),

	togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

	setCurrentTime: (time) => set({ currentTime: time }),

	setDuration: (duration) => set({ duration }),

	setZoomLevel: (level) => set({ zoomLevel: Math.max(ZOOM.MIN, Math.min(ZOOM.MAX, level)) }),

	setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

	setAutoFollow: (enabled) => set({ autoFollowEnabled: enabled }),

	// Layout actions
	setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

	toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

	setTimelineHeight: (height) => {
		const clampedHeight = Math.max(
			LAYOUT.MIN_TIMELINE_HEIGHT,
			Math.min(height, window.innerHeight - LAYOUT.MAX_TIMELINE_HEIGHT_OFFSET)
		);
		set({ timelineHeight: clampedHeight });
	},

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

	setIsResizingTimeline: (isResizing) => set({ isResizingTimeline: isResizing }),

	setIsResizingSidebar: (isResizing) => set({ isResizingSidebar: isResizing }),

	// Scroll coordination actions
	registerScrollToTime: (callback) => set({ scrollToTimeCallback: callback }),
	registerScrollToSegment: (callback) => set({ scrollToSegmentCallback: callback }),
	registerSeekAudio: (callback) => set({ seekAudioCallback: callback }),

	scrollToTime: (timeSeconds) => {
		const callback = get().scrollToTimeCallback;
		if (callback) callback(timeSeconds);
	},

	scrollToSegment: (segmentId) => {
		const callback = get().scrollToSegmentCallback;
		if (callback) callback(segmentId);
	},

	// Unified seek - updates store AND syncs audio element
	seekTo: (timeSeconds, _source) => {
		set({ currentTime: timeSeconds });
		const callback = get().seekAudioCallback;
		if (callback) callback(timeSeconds);
	},

	// Reset
	resetPlayback: () =>
		set({
			isPlaying: false,
			currentTime: 0,
			duration: 0,
		}),
}));
