import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	CleanupSegments,
	CleanupTurns,
	CleanupWords,
	CommandPalette,
	ExportModal,
	FindReplace,
	Minimap,
	PropertiesPanel,
	ReviewEditor,
	ReviewPanel,
	SettingsModal,
	Sidebar,
	Timeline,
} from "@/components";
import EditorToolbar from "@/components/EditorToolbar";
import WelcomeScreen from "@/components/WelcomeScreen";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { pickMediaAndSubtitleFiles } from "@/lib/media-sidecar";
import { importTranscriptText, type TranscriptImportResult } from "@/lib/transcript-import";
import { formatTime, parseTime } from "@/lib/utils";
import { fileToBase64, transcribeAudio } from "@/services/api";
import { usePlayerStore } from "@/stores/player-store";
import {
	createSpeakersFromSegments,
	useProjectStore,
	useSelectedSegment,
} from "@/stores/project-store";
import {
	AppView,
	CleanupGranularity,
	LAYOUT,
	TranscriptMode,
	type TranscriptSourceMeta,
} from "@/types";

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
			if (settled) return;
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

export default function App() {
	const audioRef = useRef<HTMLAudioElement>(null);
	const editorScrollRef = useRef<HTMLDivElement>(null);
	const editorProgrammaticScrollRef = useRef(false);

	// Modal states
	const [isExportOpen, setIsExportOpen] = useState(false);
	const [isFindOpen, setIsFindOpen] = useState(false);
	const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const [mode, setMode] = useState(TranscriptMode.REVIEW);
	const [showReviewTimestamps, setShowReviewTimestamps] = useState(false);
	const [cleanupGranularity, setCleanupGranularity] = useState(CleanupGranularity.SEGMENTS);

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
	const sidebarCollapsed = usePlayerStore((s) => s.sidebarCollapsed);
	const toggleSidebar = usePlayerStore((s) => s.toggleSidebar);
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
				name: result.meta.name ?? fallbackName,
				duration: resolvedDuration,
				language: result.meta.language ?? "",
				date: result.meta.date ?? "",
				...(source ? { source } : {}),
			});
			setMode(TranscriptMode.REVIEW);
			setView(AppView.EDITOR);

			if (result.warnings.length > 0) {
				console.info("Transcript import warnings:", result.warnings);
			}
		},
		[setCurrentTime, setDuration, setMeta, setProjectData, setView]
	);

	// Process transcription
	const processTranscription = useCallback(
		async (file: File) => {
			setProcessing(true, "Converting audio...");

			try {
				const base64 = await fileToBase64(file);

				setProcessing(true, "Uploading to server...");
				await new Promise((r) => setTimeout(r, 500));

				setProcessing(true, "Transcribing & Diarizing...");
				const result = await transcribeAudio(base64, file.type);

				const newSpeakers = createSpeakersFromSegments(result.segments);
				setProjectData(result.segments, newSpeakers);
				setMeta({ language: "English (Detected)" });
				setView(AppView.EDITOR);
			} catch (error) {
				console.error(error);
				alert("Failed to transcribe. Please make sure the server is running.");
			} finally {
				setProcessing(false);
			}
		},
		[setProcessing, setProjectData, setMeta, setView]
	);

	// File upload handler
	const handleFileUpload = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const selectedFiles = Array.from(e.target.files ?? []);
			const { mediaFile, subtitleFile } = pickMediaAndSubtitleFiles(selectedFiles);
			if (!mediaFile) return;

			const url = URL.createObjectURL(mediaFile);
			setAudioUrl(url);

			const durationPromise = readMediaDuration(url, mediaFile).then((mediaDuration) => {
				if (mediaDuration !== null) {
					setDuration(mediaDuration);
					setMeta({ duration: mediaDuration, name: mediaFile.name });
				}
				return mediaDuration;
			});

			if (subtitleFile) {
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
					alert(error instanceof Error ? error.message : "Failed to import subtitle sidecar.");
				} finally {
					setProcessing(false);
					e.target.value = "";
				}
				return;
			}

			void durationPromise;
			await processTranscription(mediaFile);
			e.target.value = "";
		},
		[applyTranscriptImport, processTranscription, setAudioUrl, setDuration, setMeta, setProcessing]
	);

	const handleTranscriptUpload = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const selectedFile = e.target.files?.[0];
			if (!selectedFile) return;

			setProcessing(true, "Importing transcript...");

			try {
				const text = await selectedFile.text();
				const result = importTranscriptText(text, selectedFile.name);

				setAudioUrl(null);
				applyTranscriptImport(result, selectedFile.name);
			} catch (error) {
				console.error("Failed to import transcript:", error);
				alert(error instanceof Error ? error.message : "Failed to import transcript.");
			} finally {
				setProcessing(false);
				e.target.value = "";
			}
		},
		[applyTranscriptImport, setAudioUrl, setProcessing]
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
			setProjectData(data.segments, [{ id: "speaker_1", name: "Scar", color: "#059669" }]);
			setDuration(data.meta.duration);
			setMeta(data.meta);
			setView(AppView.EDITOR);
		} catch (error) {
			console.error("Failed to load sample:", error);
			alert("Failed to load sample data");
		} finally {
			setProcessing(false);
		}
	}, [setProjectData, setDuration, setMeta, setView, setProcessing, setAudioUrl]);

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
		} catch (error) {
			console.error("Failed to load multi-speaker sample:", error);
			alert("Failed to load multi-speaker sample data");
		} finally {
			setProcessing(false);
		}
	}, [applyTranscriptImport, setAudioUrl, setProcessing]);

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
		if (!isPlaying) return;

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

	// Keyboard shortcuts
	useKeyboardShortcuts({
		onTogglePlay: togglePlay,
		onSeek: handleSeek,
		currentTime,
		duration,
		onUndo: undo,
		onRedo: redo,
		onOpenFind: () => {
			if (view === AppView.EDITOR) {
				// Get selected text to pre-populate find field
				const selection = window.getSelection()?.toString().trim() ?? "";
				setInitialFindQuery(selection);
				setIsFindOpen(true);
			}
		},
		onOpenFindReplace: () => {
			if (view === AppView.EDITOR) {
				// Get selected text to pre-populate find field
				const selection = window.getSelection()?.toString().trim() ?? "";
				setInitialFindQuery(selection);
				setIsFindOpen(true);
			}
		},
		onOpenCommandPalette: () => {
			if (view === AppView.EDITOR) {
				setIsCommandPaletteOpen(true);
			}
		},
		onOpenExport: () => view === AppView.EDITOR && setIsExportOpen(true),
		onEscape: () => {
			if (isCommandPaletteOpen) {
				setIsCommandPaletteOpen(false);
			} else if (isFindOpen) {
				setIsFindOpen(false);
			} else if (isExportOpen) {
				setIsExportOpen(false);
			} else if (isSettingsOpen) {
				setIsSettingsOpen(false);
			}
		},
		onOpenSettings: () => view === AppView.EDITOR && setIsSettingsOpen(true),
	});

	// Resize handlers
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

	// Main layout with sidebar visible on all views
	return (
		<div className="h-screen bg-white flex overflow-hidden text-slate-900 font-sans">
			{/* Left Sidebar - Always visible */}
			<Sidebar
				collapsed={sidebarCollapsed}
				onToggle={toggleSidebar}
				currentView={view}
				onNavigate={setView}
			/>

			{/* Main Content Area */}
			{view === AppView.WELCOME ? (
				<div className="flex-1 flex items-center justify-center bg-white">
					<WelcomeScreen
						isProcessing={isProcessing}
						loadingMessage={loadingMessage}
						onFileUpload={handleFileUpload}
						onTranscriptUpload={handleTranscriptUpload}
						onLoadSample={handleLoadSample}
						onLoadMultiSpeakerSample={handleLoadMultiSpeakerSample}
					/>
				</div>
			) : (
				<div className="flex-1 flex flex-col min-w-0 bg-white">
					{/* Toolbar */}
					<EditorToolbar
						mode={mode}
						canUndo={canUndo}
						canRedo={canRedo}
						lastSavedAt={lastSavedAt}
						timelineCollapsed={timelineCollapsed}
						rightPanelCollapsed={rightPanelCollapsed}
						onModeChange={setMode}
						onUndo={undo}
						onRedo={redo}
						onFind={() => {
							const selection = window.getSelection()?.toString().trim() ?? "";
							setInitialFindQuery(selection);
							setIsFindOpen(true);
						}}
						onToggleTimeline={toggleTimelinePanel}
						onToggleRightPanel={toggleRightPanel}
						onSettings={() => setIsSettingsOpen(true)}
						onExport={() => setIsExportOpen(true)}
					/>

					{/* Center Workspace */}
					<div className="flex-1 flex overflow-hidden">
						{/* Middle Column: Editor + Timeline */}
						<div className="flex-1 flex flex-col min-w-0">
							{/* Scrollable Transcript Editor with Minimap */}
							<div className="flex-1 flex overflow-hidden">
								{/* Main Editor Scroll Area */}
								<div
									ref={editorScrollRef}
									id="transcript-scroll-region"
									className="flex-1 overflow-y-auto bg-white relative"
									onScroll={handleEditorScroll}
								>
									{/* Find & Replace Panel */}
									<FindReplace
										isOpen={isFindOpen}
										onClose={() => setIsFindOpen(false)}
										segments={segments}
										onUpdateSegment={updateSegment}
										onSelectSegment={setSelectedSegmentId}
										onMatchesChange={handleMatchesChange}
										initialQuery={initialFindQuery}
									/>

									{mode === TranscriptMode.REVIEW ? (
										<ReviewEditor
											segments={segments}
											speakers={speakers}
											selectedSegmentId={selectedSegmentId}
											onSelectSegment={setSelectedSegmentId}
											onUpdateSegments={updateSegments}
											currentTime={currentTime}
											searchMatches={searchMatches}
											currentMatchIndex={currentMatchIndex}
											showTimestamps={showReviewTimestamps}
											onSeek={handleSeek}
											onProgrammaticScroll={handleProgrammaticScroll}
											scrollContainerRef={editorScrollRef}
										/>
									) : (
										<div className="min-h-full">
											{cleanupGranularity === CleanupGranularity.TURNS && (
												<CleanupTurns
													segments={segments}
													speakers={speakers}
													selectedSegmentId={selectedSegmentId}
													currentTime={currentTime}
													onSelectSegment={setSelectedSegmentId}
													onUpdateSegments={updateSegments}
													onSeek={handleSeek}
												/>
											)}

											{cleanupGranularity === CleanupGranularity.SEGMENTS && (
												<CleanupSegments
													segments={segments}
													speakers={speakers}
													selectedSegmentId={selectedSegmentId}
													currentTime={currentTime}
													searchMatches={searchMatches}
													currentMatchIndex={currentMatchIndex}
													onSelectSegment={setSelectedSegmentId}
													onUpdateSegment={updateSegment}
													onSplitSegment={splitSegment}
													onMergeAdjacentSegment={mergeAdjacentSegment}
													onSeek={handleSeek}
													onProgrammaticScroll={handleProgrammaticScroll}
													scrollContainerRef={editorScrollRef}
												/>
											)}

											{cleanupGranularity === CleanupGranularity.WORDS && (
												<CleanupWords
													segments={segments}
													speakers={speakers}
													selectedSegmentId={selectedSegmentId}
													currentTime={currentTime}
													onSelectSegment={setSelectedSegmentId}
													onUpdateSegment={updateSegment}
													onSeek={handleSeek}
												/>
											)}
										</div>
									)}
								</div>

								{/* Minimap */}
								<Minimap
									segments={segments}
									speakers={speakers}
									containerRef={editorScrollRef}
									searchMatches={searchMatches}
									currentMatchIndex={currentMatchIndex}
								/>
							</div>

							{timelineCollapsed ? (
								<div className="h-12 shrink-0 border-t border-slate-200 bg-white flex items-center justify-center gap-4 px-4">
									<button
										type="button"
										onClick={togglePlay}
										className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white transition-colors hover:bg-slate-800"
										aria-label={isPlaying ? "Pause playback" : "Play playback"}
									>
										{isPlaying ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
									</button>
									<div className="text-xs font-mono text-slate-500">
										{formatTime(currentTime)} / {formatTime(duration)}
									</div>
									<div className="h-1.5 max-w-md flex-1 overflow-hidden rounded-full bg-slate-200">
										<div
											className="h-full rounded-full bg-slate-900 transition-all"
											style={{
												width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%`,
											}}
										/>
									</div>
								</div>
							) : (
								<>
									{/* Resizable Divider */}
									<button
										type="button"
										aria-label="Resize timeline"
										className="relative z-20 h-1 cursor-ns-resize border-0 bg-slate-100 p-0 transition-colors hover:bg-blue-400"
										onMouseDown={(e) => {
											e.preventDefault();
											setIsResizingTimeline(true);
										}}
									>
										<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-1 bg-slate-300 rounded-full opacity-0 hover:opacity-100 transition-opacity" />
									</button>

									{/* Bottom Timeline Panel */}
									<div
										style={{ height: `${timelineHeight}px` }}
										className="border-t border-slate-200 bg-white shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.05)] z-10"
									>
										<Timeline
											segments={segments}
											speakers={speakers}
											audioUrl={audioUrl}
											selectedSegmentId={selectedSegmentId}
											onSelectSegment={setSelectedSegmentId}
											isPlaying={isPlaying}
											onTogglePlay={togglePlay}
											currentTime={currentTime}
											totalDuration={duration}
											onSeek={handleSeek}
											zoomLevel={zoomLevel}
											setZoomLevel={setZoomLevel}
											playbackSpeed={playbackSpeed}
											setPlaybackSpeed={setPlaybackSpeed}
											onAddSegment={addSegment}
											onUpdateSegment={updateSegment}
											onDeleteSegment={deleteSegment}
											onUpdateSpeaker={updateSpeaker}
											onDeleteSpeaker={deleteSpeaker}
											onMergeSpeakers={mergeSpeakers}
											onReorderSpeakers={reorderSpeakers}
											onCloseTimelineGaps={closeTimelineGaps}
										/>
									</div>
								</>
							)}
						</div>

						{/* Resizable Divider for Right Sidebar */}
						<button
							type="button"
							aria-label="Resize properties panel"
							className="relative z-20 flex w-1 cursor-ew-resize flex-col justify-center border-0 bg-slate-100 p-0 transition-colors hover:bg-blue-400"
							onMouseDown={(e) => {
								e.preventDefault();
								setIsResizingSidebar(true);
							}}
						>
							<div className="h-12 w-1 bg-slate-300 rounded-full opacity-0 hover:opacity-100 transition-opacity" />
						</button>

						{/* Right Sidebar: Properties */}
						{rightSidebarWidth > 0 && (
							<div style={{ width: `${rightSidebarWidth}px` }} className="flex-shrink-0">
								{mode === TranscriptMode.REVIEW ? (
									<ReviewPanel
										meta={meta}
										segments={segments}
										speakers={speakers}
										onUpdateMeta={setMeta}
										onOpenExport={() => setIsExportOpen(true)}
									/>
								) : (
									<PropertiesPanel
										meta={meta}
										selectedSegment={selectedSegment}
										segments={segments}
										speakers={speakers}
										currentTime={currentTime}
										onUpdateSegment={updateSegment}
										onDeleteSegment={deleteSegment}
										onUpdateMeta={setMeta}
										onSeek={seekTo}
										editorGranularity={cleanupGranularity}
										onEditorGranularityChange={setCleanupGranularity}
									/>
								)}
							</div>
						)}
					</div>
				</div>
			)}

			{/* Hidden Audio Element */}
			{audioUrl && (
				<audio
					ref={audioRef}
					src={audioUrl}
					onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
					onEnded={() => setIsPlaying(false)}
					onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
				/>
			)}

			{/* Export Modal */}
			<ExportModal
				isOpen={isExportOpen}
				onClose={() => setIsExportOpen(false)}
				segments={segments}
				speakers={speakers}
				meta={meta}
				audioUrl={audioUrl}
			/>

			{/* Command Palette */}
			<CommandPalette
				isOpen={isCommandPaletteOpen}
				onClose={() => setIsCommandPaletteOpen(false)}
				isPlaying={isPlaying}
				canUndo={canUndo}
				canRedo={canRedo}
				onTogglePlay={togglePlay}
				onUndo={undo}
				onRedo={redo}
				onOpenFind={() => {
					const selection = window.getSelection()?.toString().trim() ?? "";
					setInitialFindQuery(selection);
					setIsCommandPaletteOpen(false);
					setIsFindOpen(true);
				}}
				onOpenFindReplace={() => {
					const selection = window.getSelection()?.toString().trim() ?? "";
					setInitialFindQuery(selection);
					setIsCommandPaletteOpen(false);
					setIsFindOpen(true);
				}}
				onOpenExport={() => {
					setIsCommandPaletteOpen(false);
					setIsExportOpen(true);
				}}
				onOpenSettings={() => {
					setIsCommandPaletteOpen(false);
					setIsSettingsOpen(true);
				}}
			/>

			{/* Settings Modal */}
			<SettingsModal
				isOpen={isSettingsOpen}
				mode={mode}
				showReviewTimestamps={showReviewTimestamps}
				timelineCollapsed={timelineCollapsed}
				rightPanelCollapsed={rightPanelCollapsed}
				playbackSpeed={playbackSpeed}
				onClose={() => setIsSettingsOpen(false)}
				onModeChange={setMode}
				onShowReviewTimestampsChange={setShowReviewTimestamps}
				onToggleTimeline={toggleTimelinePanel}
				onToggleRightPanel={toggleRightPanel}
				onPlaybackSpeedChange={setPlaybackSpeed}
			/>
		</div>
	);
}
