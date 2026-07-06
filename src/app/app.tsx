import { Pause, Play } from "lucide-react";
import type { ChangeEvent, MouseEvent as ReactMouseEvent, SyntheticEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppSidebar } from "@/app/app-sidebar";
import { LAYOUT } from "@/app/layout-constants";
import { AppView, CleanupGranularity, TranscriptMode } from "@/app/view-state";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { importTranscriptText, type TranscriptImportResult } from "@/domain/transcript/import";
import type { Segment, Speaker, TranscriptSourceMeta } from "@/domain/transcript/types";
import { CleanupSegments } from "@/features/editor/cleanup-segments";
import { CleanupTurns } from "@/features/editor/cleanup-turns";
import { CleanupWords } from "@/features/editor/cleanup-words";
import { EditorToolbar } from "@/features/editor/editor-toolbar";
import { PropertiesPanel } from "@/features/editor/properties-panel";
import { ReviewEditor } from "@/features/editor/review-editor";
import { ReviewPanel } from "@/features/editor/review-panel";
import { ExportModal } from "@/features/export/export-modal";
import { FindReplace } from "@/features/find-replace/find-replace";
import { SettingsModal } from "@/features/settings/settings-modal";
import { Minimap } from "@/features/timeline/minimap";
import { Timeline } from "@/features/timeline/timeline";
import { WelcomeScreen } from "@/features/welcome/welcome-screen";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { pickMediaAndSubtitleFiles } from "@/lib/media-sidecar";
import { formatTime, parseTime } from "@/lib/utils";
import { type PlaybackSpeed, usePlayerStore } from "@/stores/player-store";
import { useProjectStore, useSelectedSegment } from "@/stores/project-store";

const MULTI_SPEAKER_SAMPLE_TRANSCRIPT = "/fixtures/passages-unit-8-multispeaker.scribe.jsonl";
const MULTI_SPEAKER_SAMPLE_AUDIO = "/fixtures/passages-unit-8-multispeaker.mp3";

function mediaElementFor(file: File): HTMLMediaElement {
	return file.type.startsWith("video/") ? document.createElement("video") : new Audio();
}

function readMediaDuration(url: string, file: File): Promise<number | null> {
	return new Promise((resolve) => {
		const media = mediaElementFor(file);
		let settled = false;

		const finish = (duration: number | null) => {
			if (settled) {
				return;
			}
			settled = true;
			resolve(duration);
		};

		media.preload = "metadata";
		media.onloadedmetadata = () => {
			finish(Number.isFinite(media.duration) ? media.duration : null);
		};
		media.onerror = () => finish(null);
		media.src = url;
		window.setTimeout(() => finish(null), 4000);
	});
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
	return (
		<div className="pointer-events-none fixed top-4 right-4 z-50 max-w-md">
			<div className="pointer-events-auto flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 shadow-lg">
				<div className="min-w-0 flex-1 text-sm">{message}</div>
				<button
					aria-label="Dismiss error"
					className="rounded p-0.5 text-red-700 transition hover:bg-red-100"
					onClick={onDismiss}
					type="button"
				>
					Close
				</button>
			</div>
		</div>
	);
}

interface AppKeyboardShortcutsOptions {
	currentTime: number;
	duration: number;
	isExportOpen: boolean;
	isFindOpen: boolean;
	isSettingsOpen: boolean;
	onCloseExport: () => void;
	onCloseFind: () => void;
	onCloseSettings: () => void;
	onOpenExport: () => void;
	onOpenFind: () => void;
	onOpenSettings: () => void;
	onRedo: () => void;
	onSeek: (time: number) => void;
	onTogglePlay: () => void;
	onUndo: () => void;
	view: AppView;
}

function useAppKeyboardShortcuts({
	currentTime,
	duration,
	isExportOpen,
	isFindOpen,
	isSettingsOpen,
	onCloseExport,
	onCloseFind,
	onCloseSettings,
	onOpenExport,
	onOpenFind,
	onOpenSettings,
	onRedo,
	onSeek,
	onTogglePlay,
	onUndo,
	view,
}: AppKeyboardShortcutsOptions) {
	const isEditorView = view === AppView.EDITOR;
	const handleEscape = useCallback(() => {
		if (isFindOpen) {
			onCloseFind();
			return;
		}
		if (isExportOpen) {
			onCloseExport();
			return;
		}
		if (isSettingsOpen) {
			onCloseSettings();
		}
	}, [isExportOpen, isFindOpen, isSettingsOpen, onCloseExport, onCloseFind, onCloseSettings]);

	const handleOpenExport = useCallback(() => {
		if (isEditorView) {
			onOpenExport();
		}
	}, [isEditorView, onOpenExport]);

	const handleOpenFind = useCallback(() => {
		if (isEditorView) {
			onOpenFind();
		}
	}, [isEditorView, onOpenFind]);

	const handleOpenSettings = useCallback(() => {
		if (isEditorView) {
			onOpenSettings();
		}
	}, [isEditorView, onOpenSettings]);

	useKeyboardShortcuts({
		currentTime,
		duration,
		onEscape: handleEscape,
		onOpenExport: handleOpenExport,
		onOpenFind: handleOpenFind,
		onOpenFindReplace: handleOpenFind,
		onOpenSettings: handleOpenSettings,
		onRedo,
		onSeek,
		onTogglePlay,
		onUndo,
	});
}

interface WorkspaceResizeOptions {
	isResizingSidebar: boolean;
	isResizingTimeline: boolean;
	setIsResizingSidebar: (isResizing: boolean) => void;
	setIsResizingTimeline: (isResizing: boolean) => void;
	setRightSidebarWidth: (width: number) => void;
	setTimelineHeight: (height: number) => void;
}

function useWorkspaceResize({
	isResizingSidebar,
	isResizingTimeline,
	setIsResizingSidebar,
	setIsResizingTimeline,
	setRightSidebarWidth,
	setTimelineHeight,
}: WorkspaceResizeOptions) {
	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			if (isResizingTimeline) {
				const newHeight = window.innerHeight - e.clientY;
				setTimelineHeight(newHeight);
			}
			if (isResizingSidebar) {
				const newWidth = window.innerWidth - e.clientX;
				setRightSidebarWidth(newWidth);
			}
		};

		const handleMouseUp = () => {
			setIsResizingTimeline(false);
			setIsResizingSidebar(false);
			document.body.style.cursor = "default";
		};

		if (isResizingTimeline || isResizingSidebar) {
			window.addEventListener("mousemove", handleMouseMove);
			window.addEventListener("mouseup", handleMouseUp);
			document.body.style.cursor = isResizingTimeline ? "ns-resize" : "ew-resize";
		}

		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, [
		isResizingTimeline,
		isResizingSidebar,
		setTimelineHeight,
		setRightSidebarWidth,
		setIsResizingTimeline,
		setIsResizingSidebar,
	]);
}

interface CollapsedTimelineBarProps {
	currentTime: number;
	duration: number;
	isPlaying: boolean;
	onTogglePlay: () => void;
}

function CollapsedTimelineBar({
	currentTime,
	duration,
	isPlaying,
	onTogglePlay,
}: CollapsedTimelineBarProps) {
	const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
	return (
		<div className="flex h-12 shrink-0 items-center justify-center gap-4 border-slate-200 border-t bg-white px-4">
			<button
				aria-label={isPlaying ? "Pause playback" : "Play playback"}
				className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white transition-colors hover:bg-slate-800"
				onClick={onTogglePlay}
				type="button"
			>
				{isPlaying ? <Pause size={15} /> : <Play className="ml-0.5" size={15} />}
			</button>
			<div className="font-mono text-slate-500 text-xs">
				{formatTime(currentTime)} / {formatTime(duration)}
			</div>
			<div className="h-1.5 max-w-md flex-1 overflow-hidden rounded-full bg-slate-200">
				<div
					className="h-full rounded-full bg-slate-900 transition-all"
					style={{ width: `${progress}%` }}
				/>
			</div>
		</div>
	);
}

interface TimelineDockProps {
	audioUrl: string | null;
	currentTime: number;
	duration: number;
	isPlaying: boolean;
	onAddSegment: (currentTime: number, speakerId?: string) => void;
	onCloseTimelineGaps: () => void;
	onDeleteSegment: (id: string) => void;
	onDeleteSpeaker: (id: string) => void;
	onMergeSpeakers: (fromId: string, toId: string) => void;
	onReorderSpeakers: (fromIndex: number, toIndex: number) => void;
	onResizeMouseDown: (event: ReactMouseEvent<HTMLButtonElement>) => void;
	onSeek: (time: number) => void;
	onSelectSegment: (id: string) => void;
	onTogglePlay: () => void;
	onUpdateSegment: (id: string, updates: Partial<Segment>) => void;
	onUpdateSpeaker: (id: string, updates: Partial<Speaker>) => void;
	playbackSpeed: PlaybackSpeed;
	segments: Segment[];
	selectedSegmentId: string | null;
	setPlaybackSpeed: (speed: PlaybackSpeed) => void;
	setZoomLevel: (level: number) => void;
	speakers: Speaker[];
	timelineCollapsed: boolean;
	timelineHeight: number;
	zoomLevel: number;
}

function TimelineDock({
	audioUrl,
	currentTime,
	duration,
	isPlaying,
	onAddSegment,
	onCloseTimelineGaps,
	onDeleteSegment,
	onDeleteSpeaker,
	onMergeSpeakers,
	onReorderSpeakers,
	onResizeMouseDown,
	onSeek,
	onSelectSegment,
	onTogglePlay,
	onUpdateSegment,
	onUpdateSpeaker,
	playbackSpeed,
	segments,
	selectedSegmentId,
	setPlaybackSpeed,
	setZoomLevel,
	speakers,
	timelineCollapsed,
	timelineHeight,
	zoomLevel,
}: TimelineDockProps) {
	if (timelineCollapsed) {
		return (
			<CollapsedTimelineBar
				currentTime={currentTime}
				duration={duration}
				isPlaying={isPlaying}
				onTogglePlay={onTogglePlay}
			/>
		);
	}

	return (
		<>
			<button
				aria-label="Resize timeline"
				className="relative z-20 h-1 cursor-ns-resize border-0 bg-slate-100 p-0 transition-colors hover:bg-blue-400"
				onMouseDown={onResizeMouseDown}
				type="button"
			>
				<div className="absolute top-1/2 left-1/2 h-1 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-300 opacity-0 transition-opacity hover:opacity-100" />
			</button>

			<div
				className="z-10 border-slate-200 border-t bg-white shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.05)]"
				style={{ height: `${timelineHeight}px` }}
			>
				<Timeline
					audioUrl={audioUrl}
					currentTime={currentTime}
					isPlaying={isPlaying}
					onAddSegment={onAddSegment}
					onCloseTimelineGaps={onCloseTimelineGaps}
					onDeleteSegment={onDeleteSegment}
					onDeleteSpeaker={onDeleteSpeaker}
					onMergeSpeakers={onMergeSpeakers}
					onReorderSpeakers={onReorderSpeakers}
					onSeek={onSeek}
					onSelectSegment={onSelectSegment}
					onTogglePlay={onTogglePlay}
					onUpdateSegment={onUpdateSegment}
					onUpdateSpeaker={onUpdateSpeaker}
					playbackSpeed={playbackSpeed}
					segments={segments}
					selectedSegmentId={selectedSegmentId}
					setPlaybackSpeed={setPlaybackSpeed}
					setZoomLevel={setZoomLevel}
					speakers={speakers}
					totalDuration={duration}
					zoomLevel={zoomLevel}
				/>
			</div>
		</>
	);
}

export function App() {
	const audioRef = useRef<HTMLAudioElement>(null);
	const editorScrollRef = useRef<HTMLDivElement>(null);
	const editorProgrammaticScrollRef = useRef(false);

	// Modal states
	const [isExportOpen, setIsExportOpen] = useState(false);
	const [isFindOpen, setIsFindOpen] = useState(false);
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const [mode, setMode] = useState<TranscriptMode>(TranscriptMode.REVIEW);
	const [showReviewTimestamps, setShowReviewTimestamps] = useState(false);
	const [cleanupGranularity, setCleanupGranularity] = useState<CleanupGranularity>(
		CleanupGranularity.SEGMENTS
	);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [activeSample, setActiveSample] = useState<string | null>(() => {
		try {
			return localStorage.getItem("local-celeb-active-sample");
		} catch {
			return null;
		}
	});

	useEffect(() => {
		try {
			if (activeSample) {
				localStorage.setItem("local-celeb-active-sample", activeSample);
			} else {
				localStorage.removeItem("local-celeb-active-sample");
			}
		} catch {
			// localStorage may be unavailable; selection persistence is best-effort
		}
	}, [activeSample]);

	// Search state
	const [searchMatches, setSearchMatches] = useState<
		{ segmentId: string; startIndex: number; endIndex: number }[]
	>([]);
	const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
	const [initialFindQuery, setInitialFindQuery] = useState("");

	// Handle search matches change from FindReplace
	const handleMatchesChange = useCallback(
		(
			matches: { segmentId: string; startIndex: number; endIndex: number }[],
			currentIndex: number
		) => {
			setSearchMatches(matches);
			setCurrentMatchIndex(currentIndex);
		},
		[]
	);

	// Project store
	const view = useProjectStore((s) => s.view);
	const setView = useProjectStore((s) => s.setView);
	const audioUrl = useProjectStore((s) => s.audioUrl);
	const setAudioUrl = useProjectStore((s) => s.setAudioUrl);
	const meta = useProjectStore((s) => s.meta);
	const setMeta = useProjectStore((s) => s.setMeta);
	const isProcessing = useProjectStore((s) => s.isProcessing);
	const loadingMessage = useProjectStore((s) => s.loadingMessage);
	const setProcessing = useProjectStore((s) => s.setProcessing);
	const segments = useProjectStore((s) => s.segments);
	const speakers = useProjectStore((s) => s.speakers);
	const setProjectData = useProjectStore((s) => s.setProjectData);
	const addSegment = useProjectStore((s) => s.addSegment);
	const updateSegment = useProjectStore((s) => s.updateSegment);
	const updateSegments = useProjectStore((s) => s.updateSegments);
	const splitSegment = useProjectStore((s) => s.splitSegment);
	const mergeAdjacentSegment = useProjectStore((s) => s.mergeAdjacentSegment);
	const deleteSegment = useProjectStore((s) => s.deleteSegment);
	const updateSpeaker = useProjectStore((s) => s.updateSpeaker);
	const deleteSpeaker = useProjectStore((s) => s.deleteSpeaker);
	const mergeSpeakers = useProjectStore((s) => s.mergeSpeakers);
	const reorderSpeakers = useProjectStore((s) => s.reorderSpeakers);
	const closeTimelineGaps = useProjectStore((s) => s.closeTimelineGaps);
	const selectedSegmentId = useProjectStore((s) => s.selectedSegmentId);
	const setSelectedSegmentId = useProjectStore((s) => s.setSelectedSegmentId);
	const undo = useProjectStore((s) => s.undo);
	const redo = useProjectStore((s) => s.redo);
	const canUndo = useProjectStore((s) => s.canUndo());
	const canRedo = useProjectStore((s) => s.canRedo());
	const lastSavedAt = useProjectStore((s) => s.lastSavedAt);

	const selectedSegment = useSelectedSegment();

	const showError = useCallback((message: string) => {
		setErrorMessage(message);
	}, []);

	const dismissError = useCallback(() => {
		setErrorMessage(null);
	}, []);

	const openExport = useCallback(() => {
		setIsExportOpen(true);
	}, []);

	const closeExport = useCallback(() => {
		setIsExportOpen(false);
	}, []);

	const openSettings = useCallback(() => {
		setIsSettingsOpen(true);
	}, []);

	const closeSettings = useCallback(() => {
		setIsSettingsOpen(false);
	}, []);

	const closeFind = useCallback(() => {
		setIsFindOpen(false);
	}, []);

	const openFind = useCallback(() => {
		const selection = window.getSelection()?.toString().trim() ?? "";
		setInitialFindQuery(selection);
		setIsFindOpen(true);
	}, []);

	// Player store
	const isPlaying = usePlayerStore((s) => s.isPlaying);
	const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
	const currentTime = usePlayerStore((s) => s.currentTime);
	const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
	const duration = usePlayerStore((s) => s.duration);
	const setDuration = usePlayerStore((s) => s.setDuration);
	const zoomLevel = usePlayerStore((s) => s.zoomLevel);
	const setZoomLevel = usePlayerStore((s) => s.setZoomLevel);
	const playbackSpeed = usePlayerStore((s) => s.playbackSpeed);
	const setPlaybackSpeed = usePlayerStore((s) => s.setPlaybackSpeed);
	const registerSeekAudio = usePlayerStore((s) => s.registerSeekAudio);
	const seekTo = usePlayerStore((s) => s.seekTo);
	const setAutoFollow = usePlayerStore((s) => s.setAutoFollow);
	const timelineHeight = usePlayerStore((s) => s.timelineHeight);
	const setTimelineHeight = usePlayerStore((s) => s.setTimelineHeight);
	const rightSidebarWidth = usePlayerStore((s) => s.rightSidebarWidth);
	const setRightSidebarWidth = usePlayerStore((s) => s.setRightSidebarWidth);
	const isResizingTimeline = usePlayerStore((s) => s.isResizingTimeline);
	const setIsResizingTimeline = usePlayerStore((s) => s.setIsResizingTimeline);
	const isResizingSidebar = usePlayerStore((s) => s.isResizingSidebar);
	const setIsResizingSidebar = usePlayerStore((s) => s.setIsResizingSidebar);
	const timelineCollapsed = timelineHeight <= 0;
	const rightPanelCollapsed = rightSidebarWidth <= 0;

	const applyTranscriptImport = useCallback(
		(
			result: TranscriptImportResult,
			fallbackName: string,
			options: { duration?: number | null; source?: Partial<TranscriptSourceMeta> } = {}
		) => {
			const durationFromImport =
				result.meta.duration ??
				Math.max(0, ...result.segments.map((segment) => parseTime(segment.endTime)));
			const resolvedDuration = options.duration ?? durationFromImport;
			const source =
				result.meta.source || options.source
					? {
							...result.meta.source,
							...options.source,
						}
					: undefined;

			setCurrentTime(0);
			setDuration(resolvedDuration);
			setProjectData(result.segments, result.speakers);
			setMeta({
				...result.meta,
				date: result.meta.date ?? "",
				duration: resolvedDuration,
				language: result.meta.language ?? "",
				name: result.meta.name ?? fallbackName,
				...(source ? { source } : {}),
			});
			setMode(TranscriptMode.REVIEW);
			setView(AppView.EDITOR);
			setTimelineHeight(LAYOUT.DEFAULT_TIMELINE_HEIGHT);

			if (result.warnings.length > 0) {
				console.info("Transcript import warnings:", result.warnings);
			}
		},
		[setCurrentTime, setDuration, setMeta, setProjectData, setTimelineHeight, setView]
	);

	// File upload handler
	const handleFileUpload = useCallback(
		async (e: ChangeEvent<HTMLInputElement>) => {
			const selectedFiles = Array.from(e.target.files ?? []);
			const { mediaFile, subtitleFile } = pickMediaAndSubtitleFiles(selectedFiles);
			if (!mediaFile) {
				return;
			}

			if (!subtitleFile) {
				showError("Choose an audio/video file together with an SRT or VTT sidecar transcript.");
				e.target.value = "";
				return;
			}

			const url = URL.createObjectURL(mediaFile);
			setAudioUrl(url);
			setActiveSample(null);

			const durationPromise = readMediaDuration(url, mediaFile).then((mediaDuration) => {
				if (mediaDuration !== null) {
					setDuration(mediaDuration);
					setMeta({ duration: mediaDuration, name: mediaFile.name });
				}
				return mediaDuration;
			});

			setProcessing(true, "Importing subtitles...");
			try {
				const text = await subtitleFile.text();
				const result = importTranscriptText(text, subtitleFile.name);
				const mediaDuration = await durationPromise;
				applyTranscriptImport(result, mediaFile.name, {
					duration: mediaDuration,
					source: {
						filename: subtitleFile.name,
						mediaFilename: mediaFile.name,
						sourceKind: "sidecar-subtitle",
					},
				});
			} catch (error) {
				setAudioUrl(null);
				console.error("Failed to import subtitle sidecar:", error);
				showError(error instanceof Error ? error.message : "Failed to import subtitle sidecar.");
			} finally {
				setProcessing(false);
				e.target.value = "";
			}
		},
		[applyTranscriptImport, setAudioUrl, setDuration, setMeta, setProcessing, showError]
	);

	const handleTranscriptUpload = useCallback(
		async (e: ChangeEvent<HTMLInputElement>) => {
			const selectedFile = e.target.files?.[0];
			if (!selectedFile) {
				return;
			}

			setProcessing(true, "Importing transcript...");

			try {
				const text = await selectedFile.text();
				const result = importTranscriptText(text, selectedFile.name);

				setAudioUrl(null);
				setActiveSample(null);
				applyTranscriptImport(result, selectedFile.name);
			} catch (error) {
				console.error("Failed to import transcript:", error);
				showError(error instanceof Error ? error.message : "Failed to import transcript.");
			} finally {
				setProcessing(false);
				e.target.value = "";
			}
		},
		[applyTranscriptImport, setAudioUrl, setProcessing, showError]
	);

	// Load sample data
	const handleLoadSample = useCallback(async () => {
		setProcessing(true, "Loading sample...");

		try {
			// Load sample transcript
			const response = await fetch("/sample-transcript.json");
			const data = await response.json();

			// Set audio URL
			setAudioUrl("/sample.mp3");

			// Set project data
			setProjectData(data.segments, [{ color: "#059669", id: "speaker_1", name: "Scar" }]);
			setDuration(data.meta.duration);
			setMeta(data.meta);
			setView(AppView.EDITOR);
			setTimelineHeight(LAYOUT.DEFAULT_TIMELINE_HEIGHT);
			setActiveSample("scar");
		} catch (error) {
			console.error("Failed to load sample:", error);
			showError("Failed to load sample data");
		} finally {
			setProcessing(false);
		}
	}, [
		setProjectData,
		setDuration,
		setMeta,
		setView,
		setTimelineHeight,
		setProcessing,
		setAudioUrl,
		showError,
	]);

	const handleLoadMultiSpeakerSample = useCallback(async () => {
		setProcessing(true, "Loading multi-speaker sample...");

		try {
			const response = await fetch(MULTI_SPEAKER_SAMPLE_TRANSCRIPT);
			if (!response.ok) {
				throw new Error(`Failed to load fixture: ${response.status}`);
			}

			const transcriptText = await response.text();
			const result = importTranscriptText(
				transcriptText,
				"passages-unit-8-multispeaker.scribe.jsonl"
			);

			setAudioUrl(MULTI_SPEAKER_SAMPLE_AUDIO);
			applyTranscriptImport(result, "Passages Unit 8 multi-speaker", {
				source: { mediaFilename: "passages-unit-8-multispeaker.mp3" },
			});
			setMode(TranscriptMode.CLEANUP);
			setActiveSample("speaker");
		} catch (error) {
			console.error("Failed to load multi-speaker sample:", error);
			showError("Failed to load multi-speaker sample data");
		} finally {
			setProcessing(false);
		}
	}, [applyTranscriptImport, setAudioUrl, setProcessing, showError]);

	// Toggle play
	const togglePlay = useCallback(() => {
		if (audioRef.current) {
			if (isPlaying) {
				audioRef.current.pause();
			} else {
				audioRef.current.play();
			}
		}
		setIsPlaying(!isPlaying);
	}, [isPlaying, setIsPlaying]);

	const toggleTimelinePanel = useCallback(() => {
		setTimelineHeight(timelineCollapsed ? LAYOUT.DEFAULT_TIMELINE_HEIGHT : 0);
	}, [setTimelineHeight, timelineCollapsed]);

	const toggleRightPanel = useCallback(() => {
		setRightSidebarWidth(rightPanelCollapsed ? LAYOUT.DEFAULT_RIGHT_SIDEBAR_WIDTH : 0);
	}, [rightPanelCollapsed, setRightSidebarWidth]);

	const handleTimelineResizeMouseDown = useCallback(
		(event: ReactMouseEvent<HTMLButtonElement>) => {
			event.preventDefault();
			setIsResizingTimeline(true);
		},
		[setIsResizingTimeline]
	);

	const handleSidebarResizeMouseDown = useCallback(
		(event: ReactMouseEvent<HTMLButtonElement>) => {
			event.preventDefault();
			setIsResizingSidebar(true);
		},
		[setIsResizingSidebar]
	);

	const handleAudioEnded = useCallback(() => {
		setIsPlaying(false);
	}, [setIsPlaying]);

	const handleAudioLoadedMetadata = useCallback(
		(event: SyntheticEvent<HTMLAudioElement>) => {
			setDuration(event.currentTarget.duration);
		},
		[setDuration]
	);

	const handleAudioTimeUpdate = useCallback(
		(event: SyntheticEvent<HTMLAudioElement>) => {
			setCurrentTime(event.currentTarget.currentTime);
		},
		[setCurrentTime]
	);

	// Register audio seek callback for unified seeking
	useEffect(() => {
		registerSeekAudio((time: number) => {
			if (audioRef.current) {
				audioRef.current.currentTime = time;
			}
		});
	}, [registerSeekAudio]);

	// Sync playback speed with audio element
	useEffect(() => {
		if (audioRef.current) {
			audioRef.current.playbackRate = playbackSpeed;
		}
	}, [playbackSpeed]);

	// Simulated playback when no audio file
	useEffect(() => {
		let interval: ReturnType<typeof setInterval>;
		if (isPlaying && !audioUrl) {
			interval = setInterval(() => {
				setCurrentTime(currentTime + 0.1 * playbackSpeed);
				if (currentTime >= duration) {
					setIsPlaying(false);
					setCurrentTime(0);
				}
			}, 100);
		}
		return () => clearInterval(interval);
	}, [isPlaying, audioUrl, duration, currentTime, playbackSpeed, setCurrentTime, setIsPlaying]);

	// Auto-select segment during playback (for Properties Panel auto-follow)
	useEffect(() => {
		if (!isPlaying) {
			return;
		}

		// Find the segment containing currentTime
		const currentSegment = segments.find((seg) => {
			const start = parseTime(seg.startTime);
			const end = parseTime(seg.endTime);
			return currentTime >= start && currentTime < end;
		});

		// Update selection if we found a segment and it's different
		if (currentSegment && currentSegment.id !== selectedSegmentId) {
			setSelectedSegmentId(currentSegment.id);
		}
	}, [isPlaying, currentTime, segments, selectedSegmentId, setSelectedSegmentId]);

	// Seek handler - uses unified seekTo action
	const handleSeek = useCallback(
		(time: number) => {
			seekTo(time, "keyboard");
		},
		[seekTo]
	);

	// Handle user scroll in editor - disable auto-follow during playback
	const handleEditorScroll = useCallback(() => {
		if (isPlaying && !editorProgrammaticScrollRef.current) {
			setAutoFollow(false);
		}
	}, [isPlaying, setAutoFollow]);

	// Mark scroll as programmatic (called by Editor before auto-scrolling)
	const handleProgrammaticScroll = useCallback(() => {
		editorProgrammaticScrollRef.current = true;
		// Clear the flag after scroll animation completes
		setTimeout(() => {
			editorProgrammaticScrollRef.current = false;
		}, 500);
	}, []);

	useAppKeyboardShortcuts({
		currentTime,
		duration,
		isExportOpen,
		isFindOpen,
		isSettingsOpen,
		onCloseExport: closeExport,
		onCloseFind: closeFind,
		onCloseSettings: closeSettings,
		onOpenExport: openExport,
		onOpenFind: openFind,
		onOpenSettings: openSettings,
		onRedo: redo,
		onSeek: handleSeek,
		onTogglePlay: togglePlay,
		onUndo: undo,
		view,
	});

	useWorkspaceResize({
		isResizingSidebar,
		isResizingTimeline,
		setIsResizingSidebar,
		setIsResizingTimeline,
		setRightSidebarWidth,
		setTimelineHeight,
	});

	return (
		<SidebarProvider className="h-svh overflow-hidden">
			<AppSidebar
				activeSample={activeSample}
				meta={meta}
				onLoadMultiSpeakerSample={handleLoadMultiSpeakerSample}
				onLoadSample={handleLoadSample}
				onNavigate={setView}
				onOpenExport={openExport}
				onOpenSettings={openSettings}
				segmentCount={segments.length}
			/>
			<SidebarInset className="min-w-0 overflow-hidden bg-white font-sans text-slate-900">
				{view === AppView.WELCOME ? (
					<div className="flex flex-1 items-center justify-center bg-white">
						<WelcomeScreen
							isProcessing={isProcessing}
							loadingMessage={loadingMessage}
							onFileUpload={handleFileUpload}
							onLoadMultiSpeakerSample={handleLoadMultiSpeakerSample}
							onLoadSample={handleLoadSample}
							onTranscriptUpload={handleTranscriptUpload}
						/>
					</div>
				) : (
					<div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
						{/* Toolbar */}
						<EditorToolbar
							canRedo={canRedo}
							canUndo={canUndo}
							lastSavedAt={lastSavedAt}
							mode={mode}
							onExport={openExport}
							onFind={openFind}
							onModeChange={setMode}
							onRedo={redo}
							onSettings={openSettings}
							onToggleRightPanel={toggleRightPanel}
							onToggleTimeline={toggleTimelinePanel}
							onUndo={undo}
							rightPanelCollapsed={rightPanelCollapsed}
							timelineCollapsed={timelineCollapsed}
						/>

						{/* Center Workspace */}
						<div className="flex flex-1 overflow-hidden">
							{/* Middle Column: Editor + Timeline */}
							<div className="flex min-w-0 flex-1 flex-col">
								{/* Scrollable Transcript Editor with Minimap */}
								<div className="flex flex-1 overflow-hidden">
									{/* Main Editor Scroll Area */}
									<div
										className="relative flex-1 overflow-y-auto bg-white"
										id="transcript-scroll-region"
										onScroll={handleEditorScroll}
										ref={editorScrollRef}
									>
										{/* Find & Replace Panel */}
										<FindReplace
											initialQuery={initialFindQuery}
											isOpen={isFindOpen}
											onClose={closeFind}
											onMatchesChange={handleMatchesChange}
											onSelectSegment={setSelectedSegmentId}
											onUpdateSegment={updateSegment}
											segments={segments}
										/>

										{mode === TranscriptMode.REVIEW ? (
											<ReviewEditor
												currentMatchIndex={currentMatchIndex}
												currentTime={currentTime}
												onProgrammaticScroll={handleProgrammaticScroll}
												onSeek={handleSeek}
												onSelectSegment={setSelectedSegmentId}
												onUpdateSegments={updateSegments}
												scrollContainerRef={editorScrollRef}
												searchMatches={searchMatches}
												segments={segments}
												selectedSegmentId={selectedSegmentId}
												showTimestamps={showReviewTimestamps}
												speakers={speakers}
											/>
										) : (
											<div className="min-h-full">
												{cleanupGranularity === CleanupGranularity.TURNS && (
													<CleanupTurns
														currentTime={currentTime}
														onSeek={handleSeek}
														onSelectSegment={setSelectedSegmentId}
														onUpdateSegments={updateSegments}
														segments={segments}
														selectedSegmentId={selectedSegmentId}
														speakers={speakers}
													/>
												)}

												{cleanupGranularity === CleanupGranularity.SEGMENTS && (
													<CleanupSegments
														currentMatchIndex={currentMatchIndex}
														currentTime={currentTime}
														onMergeAdjacentSegment={mergeAdjacentSegment}
														onProgrammaticScroll={handleProgrammaticScroll}
														onSeek={handleSeek}
														onSelectSegment={setSelectedSegmentId}
														onSplitSegment={splitSegment}
														onUpdateSegment={updateSegment}
														scrollContainerRef={editorScrollRef}
														searchMatches={searchMatches}
														segments={segments}
														selectedSegmentId={selectedSegmentId}
														speakers={speakers}
													/>
												)}

												{cleanupGranularity === CleanupGranularity.WORDS && (
													<CleanupWords
														currentTime={currentTime}
														onSeek={handleSeek}
														onSelectSegment={setSelectedSegmentId}
														onUpdateSegment={updateSegment}
														segments={segments}
														selectedSegmentId={selectedSegmentId}
														speakers={speakers}
													/>
												)}
											</div>
										)}
									</div>

									{/* Minimap */}
									<Minimap
										containerRef={editorScrollRef}
										currentMatchIndex={currentMatchIndex}
										searchMatches={searchMatches}
										segments={segments}
										speakers={speakers}
									/>
								</div>

								<TimelineDock
									audioUrl={audioUrl}
									currentTime={currentTime}
									duration={duration}
									isPlaying={isPlaying}
									onAddSegment={addSegment}
									onCloseTimelineGaps={closeTimelineGaps}
									onDeleteSegment={deleteSegment}
									onDeleteSpeaker={deleteSpeaker}
									onMergeSpeakers={mergeSpeakers}
									onReorderSpeakers={reorderSpeakers}
									onResizeMouseDown={handleTimelineResizeMouseDown}
									onSeek={handleSeek}
									onSelectSegment={setSelectedSegmentId}
									onTogglePlay={togglePlay}
									onUpdateSegment={updateSegment}
									onUpdateSpeaker={updateSpeaker}
									playbackSpeed={playbackSpeed}
									segments={segments}
									selectedSegmentId={selectedSegmentId}
									setPlaybackSpeed={setPlaybackSpeed}
									setZoomLevel={setZoomLevel}
									speakers={speakers}
									timelineCollapsed={timelineCollapsed}
									timelineHeight={timelineHeight}
									zoomLevel={zoomLevel}
								/>
							</div>

							{/* Resizable Divider for Right Sidebar */}
							<button
								aria-label="Resize properties panel"
								className="relative z-20 flex w-1 cursor-ew-resize flex-col justify-center border-0 bg-slate-100 p-0 transition-colors hover:bg-blue-400"
								onMouseDown={handleSidebarResizeMouseDown}
								type="button"
							>
								<div className="h-12 w-1 rounded-full bg-slate-300 opacity-0 transition-opacity hover:opacity-100" />
							</button>

							{/* Right Sidebar: Properties */}
							{rightSidebarWidth > 0 && (
								<div className="flex-shrink-0" style={{ width: `${rightSidebarWidth}px` }}>
									{mode === TranscriptMode.REVIEW ? (
										<ReviewPanel
											meta={meta}
											onOpenExport={openExport}
											onUpdateMeta={setMeta}
											segments={segments}
											speakers={speakers}
										/>
									) : (
										<PropertiesPanel
											currentTime={currentTime}
											editorGranularity={cleanupGranularity}
											meta={meta}
											onDeleteSegment={deleteSegment}
											onEditorGranularityChange={setCleanupGranularity}
											onSeek={seekTo}
											onUpdateMeta={setMeta}
											onUpdateSegment={updateSegment}
											segments={segments}
											selectedSegment={selectedSegment}
											speakers={speakers}
										/>
									)}
								</div>
							)}
						</div>
					</div>
				)}

				{/* Hidden Audio Element */}
				{errorMessage ? <ErrorBanner message={errorMessage} onDismiss={dismissError} /> : null}

				{audioUrl ? (
					<audio
						onEnded={handleAudioEnded}
						onLoadedMetadata={handleAudioLoadedMetadata}
						onTimeUpdate={handleAudioTimeUpdate}
						ref={audioRef}
						src={audioUrl}
					/>
				) : null}

				{/* Export Modal */}
				<ExportModal
					audioUrl={audioUrl}
					isOpen={isExportOpen}
					meta={meta}
					onClose={closeExport}
					segments={segments}
					speakers={speakers}
				/>

				{/* Settings Modal */}
				<SettingsModal
					isOpen={isSettingsOpen}
					mode={mode}
					onClose={closeSettings}
					onModeChange={setMode}
					onPlaybackSpeedChange={setPlaybackSpeed}
					onShowReviewTimestampsChange={setShowReviewTimestamps}
					onToggleRightPanel={toggleRightPanel}
					onToggleTimeline={toggleTimelinePanel}
					playbackSpeed={playbackSpeed}
					rightPanelCollapsed={rightPanelCollapsed}
					showReviewTimestamps={showReviewTimestamps}
					timelineCollapsed={timelineCollapsed}
				/>
			</SidebarInset>
		</SidebarProvider>
	);
}
