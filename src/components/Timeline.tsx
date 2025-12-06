import {
	ArrowRightLeft,
	Copy,
	Grid3X3,
	GripVertical,
	Magnet,
	MoreVertical,
	MoveHorizontal,
	Pause,
	Pencil,
	Play,
	Plus,
	Scissors,
	Search,
	Target,
	Trash2,
	UserRound,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	getSegmentEdgeTimes,
	type SnapConfig,
	snapTime,
	snapToEdge,
	snapToGrid,
} from "@/lib/timeline-utils";
import { cn, formatTime, parseTime } from "@/lib/utils";
import { PLAYBACK_SPEEDS, type PlaybackSpeed, usePlayerStore } from "@/stores/player-store";
import type { Segment, Speaker } from "@/types";
import { ZOOM } from "@/types";

interface TimelineProps {
	segments: Segment[];
	speakers: Speaker[];
	selectedSegmentId: string | null;
	onSelectSegment: (id: string) => void;
	isPlaying: boolean;
	onTogglePlay: () => void;
	currentTime: number;
	totalDuration: number;
	onSeek: (time: number) => void;
	zoomLevel: number;
	setZoomLevel: (level: number) => void;
	playbackSpeed: PlaybackSpeed;
	setPlaybackSpeed: (speed: PlaybackSpeed) => void;
	onAddSegment: (currentTime: number, speakerId?: string) => void;
	onUpdateSegment: (id: string, updates: Partial<Segment>) => void;
	onDeleteSegment: (id: string) => void;
	onUpdateSpeaker: (id: string, updates: Partial<Speaker>) => void;
	onDeleteSpeaker: (id: string) => void;
	onMergeSpeakers: (fromId: string, toId: string) => void;
	onReorderSpeakers: (fromIndex: number, toIndex: number) => void;
}

interface ContextMenuState {
	segmentId: string;
	x: number;
	y: number;
}

type DragMode = "left" | "right" | "move";
interface DragState {
	segmentId: string;
	mode: DragMode;
	initialX: number;
	initialStartTime: number;
	initialEndTime: number;
}

export function Timeline({
	segments,
	speakers,
	selectedSegmentId,
	onSelectSegment,
	isPlaying,
	onTogglePlay,
	currentTime,
	totalDuration,
	onSeek,
	zoomLevel,
	setZoomLevel,
	playbackSpeed,
	setPlaybackSpeed,
	onAddSegment,
	onUpdateSegment,
	onDeleteSegment,
	onUpdateSpeaker,
	onDeleteSpeaker,
	onMergeSpeakers,
	onReorderSpeakers,
}: TimelineProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const rulerRef = useRef<HTMLDivElement>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
	const [activeMenuSpeakerId, setActiveMenuSpeakerId] = useState<string | null>(null);
	const [mergeTargetMode, setMergeTargetMode] = useState<string | null>(null);
	const [draggedSpeakerIndex, setDraggedSpeakerIndex] = useState<number | null>(null);
	const [dragState, setDragState] = useState<DragState | null>(null);
	const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
	const [assignSpeakerMenuOpen, setAssignSpeakerMenuOpen] = useState(false);

	// Grid snapping
	const [gridSnap, setGridSnap] = useState(true);
	const gridSnapInterval = 0.5; // Snap to 0.5 second intervals

	// Drag line guides (snap to other segment edges)
	const [dragLineSnap, setDragLineSnap] = useState(true);
	const [snapGuides, setSnapGuides] = useState<number[]>([]); // Times where guides should show
	const edgeThreshold = 0.2; // Snap within 0.2 seconds of other edges

	// Cross-component scroll coordination
	const registerScrollToTime = usePlayerStore((s) => s.registerScrollToTime);
	const scrollToSegment = usePlayerStore((s) => s.scrollToSegment);
	const autoFollowEnabled = usePlayerStore((s) => s.autoFollowEnabled);
	const setAutoFollow = usePlayerStore((s) => s.setAutoFollow);

	// Track if we're doing programmatic scroll (to distinguish from user scroll)
	const isProgrammaticScrollRef = useRef(false);

	// Register scroll-to-time callback
	useEffect(() => {
		const scrollToTime = (timeSeconds: number) => {
			const container = scrollContainerRef.current;
			if (!container) return;

			const pixelsPerSecond = zoomLevel;
			const targetX = timeSeconds * pixelsPerSecond - container.clientWidth / 2;

			container.scrollTo({
				left: Math.max(0, targetX),
				behavior: "smooth",
			});
		};
		registerScrollToTime(scrollToTime);
	}, [registerScrollToTime, zoomLevel]);

	// Auto-scroll during playback to keep playhead visible (respects autoFollow setting)
	useEffect(() => {
		if (!isPlaying || !autoFollowEnabled) return;

		const container = scrollContainerRef.current;
		if (!container) return;

		const pixelsPerSecond = zoomLevel;
		const playheadX = currentTime * pixelsPerSecond;
		const scrollLeft = container.scrollLeft;
		const viewWidth = container.clientWidth;
		const margin = 100; // Keep playhead this many pixels from edges

		// Check if playhead is near the right edge
		if (playheadX > scrollLeft + viewWidth - margin) {
			// Mark as programmatic scroll
			isProgrammaticScrollRef.current = true;
			container.scrollTo({
				left: playheadX - viewWidth + margin * 2,
				behavior: "smooth",
			});
			// Reset after scroll completes
			setTimeout(() => {
				isProgrammaticScrollRef.current = false;
			}, 300);
		}
		// Check if playhead is near the left edge (e.g., after seeking backwards)
		else if (playheadX < scrollLeft + margin) {
			isProgrammaticScrollRef.current = true;
			container.scrollTo({
				left: Math.max(0, playheadX - margin),
				behavior: "smooth",
			});
			setTimeout(() => {
				isProgrammaticScrollRef.current = false;
			}, 300);
		}
	}, [isPlaying, currentTime, zoomLevel, autoFollowEnabled]);

	// Detect user scroll and disable auto-follow during playback
	const handleUserScroll = useCallback(() => {
		if (isPlaying && !isProgrammaticScrollRef.current) {
			// User scrolled manually during playback - disable auto-follow
			setAutoFollow(false);
		}
	}, [isPlaying, setAutoFollow]);

	// Re-engage auto-follow and snap to playhead
	const snapToPlayhead = useCallback(() => {
		setAutoFollow(true);
		const container = scrollContainerRef.current;
		if (container) {
			const playheadX = currentTime * zoomLevel;
			const viewWidth = container.clientWidth;
			isProgrammaticScrollRef.current = true;
			container.scrollTo({
				left: Math.max(0, playheadX - viewWidth / 2),
				behavior: "smooth",
			});
			setTimeout(() => {
				isProgrammaticScrollRef.current = false;
			}, 300);
		}
	}, [currentTime, zoomLevel, setAutoFollow]);

	// Handle segment click - scroll editor to this segment
	const handleSegmentClick = useCallback(
		(segmentId: string) => {
			onSelectSegment(segmentId);
			scrollToSegment(segmentId);
		},
		[onSelectSegment, scrollToSegment]
	);

	// Auto-scroll during drag
	const [autoScroll, setAutoScroll] = useState(true);
	const autoScrollZone = 80; // Pixels from edge to trigger scroll
	const autoScrollSpeed = 8; // Pixels per frame
	const autoScrollRef = useRef<number | null>(null);

	// Playhead dragging and hover preview
	const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
	const [hoverTime, setHoverTime] = useState<number | null>(null);

	// Generate stable waveform heights per segment (memoized to prevent re-renders)
	const waveformHeights = useMemo(() => {
		const heights: Record<string, number[]> = {};
		for (const seg of segments) {
			// Use segment ID as seed for consistent heights
			const seed = seg.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
			heights[seg.id] = Array.from({ length: 10 }, (_, i) => {
				const pseudoRandom = Math.sin(seed * (i + 1) * 9999) * 0.5 + 0.5;
				return 30 + pseudoRandom * 40;
			});
		}
		return heights;
	}, [segments]);

	// Sync ruler horizontal scroll with timeline
	const handleTimelineScroll = (e: React.UIEvent<HTMLDivElement>) => {
		if (rulerRef.current) {
			rulerRef.current.scrollLeft = e.currentTarget.scrollLeft;
		}
	};

	// Build snap config from current state
	const snapConfig: SnapConfig = {
		gridEnabled: gridSnap,
		gridInterval: gridSnapInterval,
		edgeEnabled: dragLineSnap,
		edgeThreshold: edgeThreshold,
	};

	// Get snap targets for a segment (all other segment edges)
	const getSnapTargets = (excludeSegmentId: string): number[] => {
		return getSegmentEdgeTimes(segments, excludeSegmentId, parseTime);
	};

	// Wrapper for edge snapping with current config
	const performEdgeSnap = (time: number, excludeSegmentId: string) => {
		const targets = getSnapTargets(excludeSegmentId);
		return snapToEdge(time, targets, edgeThreshold, dragLineSnap);
	};

	// Wrapper for combined snapping with current config
	const performSnap = (time: number, excludeSegmentId: string): number => {
		const targets = getSnapTargets(excludeSegmentId);
		return snapTime(time, targets, snapConfig).time;
	};

	// Auto-scroll timeline when playing
	useEffect(() => {
		if (isPlaying && containerRef.current) {
			const scrollPos = currentTime * zoomLevel - containerRef.current.clientWidth / 2;
			containerRef.current.scrollTo({ left: Math.max(0, scrollPos), behavior: "auto" });
		}
	}, [currentTime, isPlaying, zoomLevel]);

	// Handle playhead dragging
	useEffect(() => {
		if (!isDraggingPlayhead) return;

		const handleMouseMove = (e: MouseEvent) => {
			if (!containerRef.current) return;
			const rect = containerRef.current.getBoundingClientRect();
			const x = e.clientX - rect.left + containerRef.current.scrollLeft;
			const time = Math.max(0, Math.min(totalDuration, x / zoomLevel));
			onSeek(time);
		};

		const handleMouseUp = () => {
			setIsDraggingPlayhead(false);
			document.body.style.cursor = "default";
		};

		document.body.style.cursor = "grabbing";
		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);

		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, [isDraggingPlayhead, zoomLevel, totalDuration, onSeek]);

	// Click on timeline to seek and start dragging
	const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		if (!containerRef.current) return;
		// Don't interfere with segment interactions
		if ((e.target as HTMLElement).closest("[data-segment]")) return;

		const rect = containerRef.current.getBoundingClientRect();
		const x = e.clientX - rect.left + containerRef.current.scrollLeft;
		const time = Math.max(0, Math.min(totalDuration, x / zoomLevel));
		onSeek(time);
		setIsDraggingPlayhead(true);
		setHoverTime(null); // Hide hover indicator while dragging
	};

	// Track hover position for preview indicator
	const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
		if (isDraggingPlayhead || !containerRef.current) return;
		const rect = containerRef.current.getBoundingClientRect();
		const x = e.clientX - rect.left + containerRef.current.scrollLeft;
		const time = Math.max(0, Math.min(totalDuration, x / zoomLevel));
		setHoverTime(time);
	};

	const handleTimelineMouseLeave = () => {
		if (!isDraggingPlayhead) {
			setHoverTime(null);
		}
	};

	// Ruler mouse handlers (uses timeline's scroll position for calculation)
	const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		if (!containerRef.current) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left + containerRef.current.scrollLeft;
		const time = Math.max(0, Math.min(totalDuration, x / zoomLevel));
		onSeek(time);
		setIsDraggingPlayhead(true);
		setHoverTime(null);
	};

	const handleRulerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
		if (isDraggingPlayhead || !containerRef.current) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left + containerRef.current.scrollLeft;
		const time = Math.max(0, Math.min(totalDuration, x / zoomLevel));
		setHoverTime(time);
	};

	const handleRulerMouseLeave = () => {
		if (!isDraggingPlayhead) {
			setHoverTime(null);
		}
	};

	const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setZoomLevel(Number(e.target.value));
	};

	const handleSpeakerDragStart = (e: React.DragEvent, index: number) => {
		setDraggedSpeakerIndex(index);
		e.dataTransfer.effectAllowed = "move";
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
	};

	const handleDrop = (e: React.DragEvent, index: number) => {
		e.preventDefault();
		if (draggedSpeakerIndex !== null && draggedSpeakerIndex !== index) {
			onReorderSpeakers(draggedSpeakerIndex, index);
		}
		setDraggedSpeakerIndex(null);
	};

	// Generate ruler markers
	const rulerMarkers: number[] = [];
	const step = zoomLevel > 50 ? 1 : zoomLevel > 20 ? 5 : 10;
	for (let i = 0; i <= totalDuration; i += step) {
		rulerMarkers.push(i);
	}

	// Close menus on click outside
	useEffect(() => {
		const closeMenu = () => {
			setActiveMenuSpeakerId(null);
			setMergeTargetMode(null);
			setContextMenu(null);
			setAssignSpeakerMenuOpen(false);
		};
		if (activeMenuSpeakerId || mergeTargetMode || contextMenu) {
			window.addEventListener("click", closeMenu);
		}
		return () => window.removeEventListener("click", closeMenu);
	}, [activeMenuSpeakerId, mergeTargetMode, contextMenu]);

	// Handle right-click on segment
	const handleContextMenu = (e: React.MouseEvent, segmentId: string) => {
		e.preventDefault();
		e.stopPropagation();
		setContextMenu({
			segmentId,
			x: e.clientX,
			y: e.clientY,
		});
		setAssignSpeakerMenuOpen(false);
	};

	// Handle segment dragging (edges and full move)
	useEffect(() => {
		if (!dragState) return;

		const handleMouseMove = (e: MouseEvent) => {
			if (!containerRef.current || !dragState) return;

			const rect = containerRef.current.getBoundingClientRect();
			const scrollLeft = containerRef.current.scrollLeft;
			const mouseX = e.clientX - rect.left + scrollLeft;
			const deltaX = mouseX - dragState.initialX;
			const deltaTime = deltaX / zoomLevel;

			// Auto-scroll when near edges
			if (autoScroll) {
				const relativeX = e.clientX - rect.left;
				const containerWidth = rect.width;

				// Cancel any existing scroll animation
				if (autoScrollRef.current) {
					cancelAnimationFrame(autoScrollRef.current);
					autoScrollRef.current = null;
				}

				// Check if near left or right edge
				if (relativeX < autoScrollZone) {
					// Scroll left
					const scrollAmount = -autoScrollSpeed * (1 - relativeX / autoScrollZone);
					const doScroll = () => {
						if (containerRef.current && dragState) {
							containerRef.current.scrollLeft += scrollAmount;
							autoScrollRef.current = requestAnimationFrame(doScroll);
						}
					};
					autoScrollRef.current = requestAnimationFrame(doScroll);
				} else if (relativeX > containerWidth - autoScrollZone) {
					// Scroll right
					const scrollAmount =
						autoScrollSpeed * (1 - (containerWidth - relativeX) / autoScrollZone);
					const doScroll = () => {
						if (containerRef.current && dragState) {
							containerRef.current.scrollLeft += scrollAmount;
							autoScrollRef.current = requestAnimationFrame(doScroll);
						}
					};
					autoScrollRef.current = requestAnimationFrame(doScroll);
				}
			}

			const segment = segments.find((s) => s.id === dragState.segmentId);
			if (!segment) return;

			const minDuration = 0.5; // Minimum 0.5 second duration
			const segmentDuration = dragState.initialEndTime - dragState.initialStartTime;

			const activeGuides: number[] = [];

			if (dragState.mode === "left") {
				// Dragging left edge - adjust start time
				const rawStart = Math.max(0, dragState.initialStartTime + deltaTime);
				const newStart = performSnap(rawStart, segment.id);
				if (newStart < dragState.initialEndTime - minDuration) {
					onUpdateSegment(segment.id, { startTime: formatTime(newStart) });
					// Show guide if snapped to edge
					const edgeResult = performEdgeSnap(rawStart, segment.id);
					if (edgeResult.snapped) activeGuides.push(edgeResult.time);
				}
			} else if (dragState.mode === "right") {
				// Dragging right edge - adjust end time
				const rawEnd = Math.max(
					dragState.initialStartTime + minDuration,
					dragState.initialEndTime + deltaTime
				);
				const newEnd = performSnap(rawEnd, segment.id);
				onUpdateSegment(segment.id, { endTime: formatTime(newEnd) });
				// Show guide if snapped to edge
				const edgeResult = performEdgeSnap(rawEnd, segment.id);
				if (edgeResult.snapped) activeGuides.push(edgeResult.time);
			} else if (dragState.mode === "move") {
				// Dragging entire segment - move both start and end
				const rawStart = Math.max(0, dragState.initialStartTime + deltaTime);
				const rawEnd = rawStart + segmentDuration;

				// Check both edges for snapping
				const startSnap = performEdgeSnap(rawStart, segment.id);
				const endSnap = performEdgeSnap(rawEnd, segment.id);

				let newStart: number;
				let newEnd: number;

				if (startSnap.snapped) {
					newStart = startSnap.time;
					newEnd = newStart + segmentDuration;
					activeGuides.push(startSnap.time);
				} else if (endSnap.snapped) {
					newEnd = endSnap.time;
					newStart = newEnd - segmentDuration;
					activeGuides.push(endSnap.time);
				} else {
					newStart = snapToGrid(rawStart, gridSnapInterval, gridSnap);
					newEnd = newStart + segmentDuration;
				}

				onUpdateSegment(segment.id, {
					startTime: formatTime(Math.max(0, newStart)),
					endTime: formatTime(Math.max(0, newStart) + segmentDuration),
				});
			}

			setSnapGuides(activeGuides);
		};

		const handleMouseUp = () => {
			setDragState(null);
			setSnapGuides([]); // Clear guides when done dragging
			document.body.style.cursor = "default";
			// Cancel any auto-scroll animation
			if (autoScrollRef.current) {
				cancelAnimationFrame(autoScrollRef.current);
				autoScrollRef.current = null;
			}
		};

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);

		// Set appropriate cursor based on drag mode
		if (dragState.mode === "left") {
			document.body.style.cursor = "w-resize";
		} else if (dragState.mode === "right") {
			document.body.style.cursor = "e-resize";
		} else {
			document.body.style.cursor = "grabbing";
		}

		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, [
		dragState,
		segments,
		zoomLevel,
		onUpdateSegment,
		gridSnap,
		autoScroll,
		performEdgeSnap,
		performSnap,
	]);

	const handleSegmentDragStart = (
		e: React.MouseEvent,
		segmentId: string,
		mode: DragMode,
		segment: Segment
	) => {
		e.stopPropagation();
		if (!containerRef.current) return;

		const rect = containerRef.current.getBoundingClientRect();
		const scrollLeft = containerRef.current.scrollLeft;
		const mouseX = e.clientX - rect.left + scrollLeft;

		setDragState({
			segmentId,
			mode,
			initialX: mouseX,
			initialStartTime: parseTime(segment.startTime),
			initialEndTime: parseTime(segment.endTime),
		});
	};

	return (
		<div className="flex flex-col h-full bg-white select-none">
			{/* Timeline Controls Toolbar */}
			<div className="h-12 border-b border-slate-200 flex items-center justify-between px-4 bg-white shrink-0 z-20 gap-4">
				{/* Left: Snap Controls */}
				<div className="flex items-center gap-2 shrink-0">
					{/* Grid Snap Toggle */}
					<button
						type="button"
						onClick={() => setGridSnap(!gridSnap)}
						className={cn(
							"p-1.5 rounded flex items-center gap-1.5 text-xs font-medium transition-colors",
							gridSnap
								? "bg-blue-100 text-blue-700 hover:bg-blue-200"
								: "text-slate-500 hover:bg-slate-100"
						)}
						title={`Grid snap: ${gridSnap ? "ON" : "OFF"} (${gridSnapInterval}s intervals)`}
					>
						<Grid3X3 size={14} />
						<span className="hidden sm:inline">Grid</span>
					</button>

					{/* Edge Snap Toggle */}
					<button
						type="button"
						onClick={() => setDragLineSnap(!dragLineSnap)}
						className={cn(
							"p-1.5 rounded flex items-center gap-1.5 text-xs font-medium transition-colors",
							dragLineSnap
								? "bg-purple-100 text-purple-700 hover:bg-purple-200"
								: "text-slate-500 hover:bg-slate-100"
						)}
						title={`Edge snap: ${dragLineSnap ? "ON" : "OFF"} - Snap to other segment edges`}
					>
						<Magnet size={14} />
						<span className="hidden sm:inline">Edges</span>
					</button>

					{/* Auto-scroll Toggle */}
					<button
						type="button"
						onClick={() => setAutoScroll(!autoScroll)}
						className={cn(
							"p-1.5 rounded flex items-center gap-1.5 text-xs font-medium transition-colors",
							autoScroll
								? "bg-green-100 text-green-700 hover:bg-green-200"
								: "text-slate-500 hover:bg-slate-100"
						)}
						title={`Auto-scroll: ${autoScroll ? "ON" : "OFF"} - Scroll when dragging near edges`}
					>
						<MoveHorizontal size={14} />
						<span className="hidden sm:inline">Scroll</span>
					</button>

					{/* Auto-follow Indicator - always visible, state changes with playback */}
					<button
						type="button"
						onClick={isPlaying ? snapToPlayhead : undefined}
						disabled={!isPlaying}
						className={cn(
							"p-1.5 rounded flex items-center gap-1.5 text-xs font-medium transition-colors",
							!isPlaying
								? "bg-slate-100 text-slate-400 cursor-not-allowed"
								: autoFollowEnabled
									? "bg-green-100 text-green-700 hover:bg-green-200"
									: "bg-red-100 text-red-700 hover:bg-red-200"
						)}
						title={
							!isPlaying
								? "Auto-follow (inactive when paused)"
								: autoFollowEnabled
									? "Auto-following playhead"
									: "Click to snap back to playhead"
						}
					>
						<Target size={14} />
						<span className="hidden sm:inline">
							{!isPlaying ? "Follow" : autoFollowEnabled ? "Following" : "Follow"}
						</span>
					</button>
				</div>

				{/* Center: Playback Controls */}
				<div className="flex items-center gap-3 shrink-0">
					<Select
						value={playbackSpeed.toString()}
						onValueChange={(value) => setPlaybackSpeed(Number(value) as PlaybackSpeed)}
					>
						<SelectTrigger className="w-[70px] h-7 text-xs border-slate-200">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{PLAYBACK_SPEEDS.map((speed) => (
								<SelectItem key={speed} value={speed.toString()} className="text-xs">
									{speed}x
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<button
						type="button"
						onClick={onTogglePlay}
						className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center hover:bg-slate-800 hover:scale-105 transition-all shadow-md"
					>
						{isPlaying ? (
							<Pause size={14} fill="currentColor" />
						) : (
							<Play size={14} fill="currentColor" className="ml-0.5" />
						)}
					</button>
					<button
						type="button"
						className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap"
						onClick={() => onAddSegment(currentTime)}
					>
						Add segment
					</button>
				</div>

				{/* Right: Zoom and Search */}
				<div className="flex items-center gap-3 shrink-0">
					<div className="flex items-center gap-2 group">
						<ZoomOut size={14} className="text-slate-400" />
						<input
							type="range"
							min={ZOOM.MIN}
							max={ZOOM.MAX}
							value={zoomLevel}
							onChange={handleRangeChange}
							className="w-20 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-110 transition-all"
						/>
						<ZoomIn size={14} className="text-slate-400" />
					</div>
					<button type="button" className="p-1.5 hover:bg-slate-100 rounded text-slate-500">
						<Search size={16} />
					</button>
				</div>
			</div>

			{/* Tracks Area */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{/* Fixed Headers Row */}
				<div className="flex shrink-0 h-8 border-b border-slate-200">
					{/* Speakers Header */}
					<div className="w-64 shrink-0 bg-slate-50 border-r border-slate-200 flex items-center px-4 text-xs font-semibold text-slate-500 z-10">
						<div className="flex-1">Speakers</div>
						<Plus size={14} className="cursor-pointer hover:text-blue-600" />
					</div>
					{/* Ruler Header */}
					<div
						ref={rulerRef}
						className="flex-1 bg-slate-50 overflow-x-hidden relative cursor-crosshair"
						onMouseDown={handleRulerMouseDown}
						onMouseMove={handleRulerMouseMove}
						onMouseLeave={handleRulerMouseLeave}
					>
						<div
							style={{ width: `${Math.max(100, totalDuration * zoomLevel + 500)}px` }}
							className="h-full relative"
						>
							{rulerMarkers.map((time) => (
								<div
									key={time}
									className="absolute top-0 bottom-0 border-l border-slate-300 flex items-end pb-1 pl-1 text-[10px] text-slate-400 font-mono select-none pointer-events-none"
									style={{ left: `${time * zoomLevel}px` }}
								>
									{formatTime(time)}
								</div>
							))}

							{/* Hover Preview Indicator in Ruler */}
							{hoverTime !== null && !isDraggingPlayhead && (
								<div
									className="absolute top-0 bottom-0 pointer-events-none"
									style={{ transform: `translateX(${hoverTime * zoomLevel}px)` }}
								>
									<div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-red-300 -ml-[5px]" />
									<div className="w-px h-full bg-red-300 -mt-[6px]" />
								</div>
							)}

							{/* Playhead Indicator in Ruler */}
							<div
								className="absolute top-0 bottom-0 pointer-events-none"
								style={{ transform: `translateX(${currentTime * zoomLevel}px)` }}
							>
								<div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-red-500 -ml-[5px]" />
								<div className="w-px h-full bg-red-500 -mt-[6px]" />
							</div>
						</div>
					</div>
				</div>

				{/* Scrollable Content Area */}
				<div
					ref={scrollContainerRef}
					className="flex-1 flex overflow-y-auto"
					onScroll={handleUserScroll}
				>
					{/* Speakers Column */}
					<div className="w-64 shrink-0 bg-white border-r border-slate-200 z-10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
						{speakers.map((speaker, index) => (
							<div
								key={speaker.id}
								className={cn(
									"h-24 border-b border-slate-200 flex items-center pl-2 pr-4 gap-2 group hover:bg-slate-50 transition-colors relative",
									draggedSpeakerIndex === index && "opacity-50 bg-slate-100"
								)}
								draggable
								onDragStart={(e) => handleSpeakerDragStart(e, index)}
								onDragOver={handleDragOver}
								onDrop={(e) => handleDrop(e, index)}
							>
								<div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 p-1">
									<GripVertical size={14} />
								</div>

								<div className="relative">
									<div
										className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
										style={{ backgroundColor: speaker.color }}
									>
										{speaker.name.charAt(0)}
									</div>
								</div>

								<div className="min-w-0 flex-1">
									{editingSpeakerId === speaker.id ? (
										<input
											type="text"
											ref={(el) => el?.focus()}
											defaultValue={speaker.name}
											onBlur={(e) => {
												if (e.target.value.trim()) {
													onUpdateSpeaker(speaker.id, { name: e.target.value });
												}
												setEditingSpeakerId(null);
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													if (e.currentTarget.value.trim()) {
														onUpdateSpeaker(speaker.id, {
															name: e.currentTarget.value,
														});
													}
													setEditingSpeakerId(null);
												}
												if (e.key === "Escape") {
													setEditingSpeakerId(null);
												}
											}}
											className="w-full text-sm px-1 py-0.5 border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
										/>
									) : (
										<button
											type="button"
											className="text-sm font-medium text-slate-700 truncate cursor-text hover:text-blue-600 text-left w-full"
											onClick={() => setEditingSpeakerId(speaker.id)}
											title="Click to rename"
										>
											{speaker.name}
										</button>
									)}
									<div className="text-[10px] text-slate-400 mt-0.5">
										{segments.filter((s) => s.speakerId === speaker.id).length} segments
									</div>
								</div>

								{/* Settings Menu Button */}
								<div className="relative">
									<button
										type="button"
										className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
										onClick={(e) => {
											e.stopPropagation();
											setActiveMenuSpeakerId(
												activeMenuSpeakerId === speaker.id ? null : speaker.id
											);
											setMergeTargetMode(null);
										}}
									>
										<MoreVertical size={14} />
									</button>

									{/* Dropdown Menu */}
									{activeMenuSpeakerId === speaker.id && (
										<div
											className="absolute right-0 top-8 w-48 bg-white rounded-lg shadow-xl border border-slate-100 z-50 overflow-hidden"
											onClick={(e) => e.stopPropagation()}
											onKeyDown={(e) => e.stopPropagation()}
										>
											{mergeTargetMode === speaker.id ? (
												<div className="bg-slate-50">
													<div className="px-3 py-2 text-xs font-semibold text-slate-500 border-b border-slate-100">
														Move segments to...
													</div>
													<div className="max-h-40 overflow-y-auto">
														{speakers
															.filter((s) => s.id !== speaker.id)
															.map((target) => (
																<button
																	key={target.id}
																	type="button"
																	className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
																	onClick={() => {
																		onMergeSpeakers(speaker.id, target.id);
																		setActiveMenuSpeakerId(null);
																		setMergeTargetMode(null);
																	}}
																>
																	<div
																		className="w-2 h-2 rounded-full"
																		style={{ background: target.color }}
																	/>
																	{target.name}
																</button>
															))}
														{speakers.length <= 1 && (
															<div className="px-4 py-2 text-xs text-slate-400 italic">
																No other speakers
															</div>
														)}
													</div>
													<button
														type="button"
														className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 border-t border-slate-100"
														onClick={() => setMergeTargetMode(null)}
													>
														&larr; Back
													</button>
												</div>
											) : (
												<>
													<button
														type="button"
														className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
														onClick={() => {
															setEditingSpeakerId(speaker.id);
															setActiveMenuSpeakerId(null);
														}}
													>
														<Pencil size={14} className="text-slate-400" /> Rename
													</button>
													<button
														type="button"
														className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
														onClick={() => setMergeTargetMode(speaker.id)}
													>
														<ArrowRightLeft size={14} className="text-slate-400" /> Move segments to
													</button>
													<div className="h-px bg-slate-100 my-1" />
													<button
														type="button"
														className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
														onClick={() => {
															if (
																window.confirm(`Delete ${speaker.name} and all their segments?`)
															) {
																onDeleteSpeaker(speaker.id);
															}
														}}
													>
														<Trash2 size={14} /> Delete
													</button>
												</>
											)}
										</div>
									)}
								</div>
							</div>
						))}
					</div>

					{/* Timeline Tracks Column */}
					<div
						ref={containerRef}
						className="flex-1 overflow-x-auto overflow-y-hidden relative bg-slate-50/50 cursor-crosshair"
						onScroll={handleTimelineScroll}
						onMouseDown={handleTimelineMouseDown}
						onMouseMove={handleTimelineMouseMove}
						onMouseLeave={handleTimelineMouseLeave}
						onKeyDown={(e) => {
							if (e.key === " ") {
								e.preventDefault();
								onTogglePlay();
							}
						}}
					>
						<div
							style={{ width: `${Math.max(100, totalDuration * zoomLevel + 500)}px` }}
							className="h-full relative"
						>
							{/* Grid Lines (visual guides for snap intervals) */}
							{gridSnap && zoomLevel > 30 && (
								<div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none">
									{Array.from({ length: Math.ceil(totalDuration / gridSnapInterval) + 1 }).map(
										(_, i) => {
											const time = i * gridSnapInterval;
											const isMainLine = time % 1 === 0; // Full second marks
											return (
												<div
													key={`grid-${i}`}
													className={cn(
														"absolute top-0 bottom-0 w-px",
														isMainLine ? "bg-slate-200" : "bg-slate-100"
													)}
													style={{ left: `${time * zoomLevel}px` }}
												/>
											);
										}
									)}
								</div>
							)}

							{/* Hover Preview Indicator (ghost playhead) */}
							{hoverTime !== null && !isDraggingPlayhead && (
								<div
									className="absolute top-0 bottom-0 w-px bg-red-300 z-20 pointer-events-none"
									style={{
										transform: `translateX(${hoverTime * zoomLevel}px)`,
									}}
								>
									<div className="w-2 h-2 bg-red-300 rounded-full -ml-[3px] -mt-[1px]" />
									<div className="absolute top-1 left-2 px-1 py-0.5 bg-slate-800/80 text-white text-[9px] font-mono rounded whitespace-nowrap">
										{formatTime(hoverTime)}
									</div>
								</div>
							)}

							{/* Playhead */}
							<div
								className="absolute top-0 bottom-0 w-px bg-red-500 z-30 pointer-events-none"
								style={{
									transform: `translateX(${currentTime * zoomLevel}px)`,
								}}
							>
								{/* Playhead handle */}
								<div className="w-3 h-3 bg-red-500 rounded-full -ml-[5px] -mt-[1px] shadow-md" />
							</div>

							{/* Snap Guide Lines */}
							{snapGuides.map((guideTime) => (
								<div
									key={`guide-${guideTime}`}
									className="absolute top-0 bottom-0 w-px bg-purple-500 z-25 pointer-events-none"
									style={{
										transform: `translateX(${guideTime * zoomLevel}px)`,
									}}
								>
									<div className="absolute top-0 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-purple-500 text-white text-[9px] font-mono rounded-b">
										{formatTime(guideTime)}
									</div>
								</div>
							))}

							{/* Segments */}
							<div className="pt-0">
								{speakers.map((speaker) => {
									const speakerSegments = segments.filter((s) => s.speakerId === speaker.id);
									return (
										<div
											key={speaker.id}
											className="h-24 border-b border-slate-200 relative group/track hover:bg-slate-100/30 transition-colors"
										>
											{speakerSegments.map((seg) => {
												const start = parseTime(seg.startTime);
												const end = parseTime(seg.endTime);
												const duration = Math.max(0.5, end - start);
												const isSelected = selectedSegmentId === seg.id;
												const isActive = start <= currentTime && end > currentTime;

												const isDragging = dragState?.segmentId === seg.id;

												return (
													<div
														key={seg.id}
														data-segment
														className={cn(
															"absolute top-4 bottom-4 rounded-lg border-2 overflow-hidden flex flex-col justify-center transition-all",
															isSelected &&
																"ring-2 ring-offset-2 ring-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.5)] z-20",
															!isSelected &&
																"hover:shadow-md hover:brightness-95 border-opacity-60",
															isActive && !isSelected && "ring-2 ring-amber-400 ring-offset-1",
															isDragging && "opacity-80 shadow-2xl z-30"
														)}
														style={{
															left: `${start * zoomLevel}px`,
															width: `${duration * zoomLevel}px`,
															backgroundColor: isSelected
																? `${speaker.color}50`
																: `${speaker.color}25`,
															borderColor: isSelected ? speaker.color : `${speaker.color}90`,
														}}
														title={seg.text}
														onClick={(e) => {
															e.stopPropagation();
															handleSegmentClick(seg.id);
															// Calculate proportional time based on click position within segment
															const rect = e.currentTarget.getBoundingClientRect();
															const clickX = e.clientX - rect.left;
															const segWidth = rect.width;
															const proportionalTime = start + (clickX / segWidth) * duration;
															onSeek(Math.max(start, Math.min(end, proportionalTime)));
														}}
														onContextMenu={(e) => handleContextMenu(e, seg.id)}
														onKeyDown={(e) => {
															if (e.key === "Enter" || e.key === " ") {
																e.stopPropagation();
																onSeek(start);
															}
														}}
													>
														{/* Draggable body (center area) */}
														<div
															className="absolute inset-0 left-3 right-3 cursor-grab active:cursor-grabbing"
															onMouseDown={(e) => handleSegmentDragStart(e, seg.id, "move", seg)}
														/>

														{/* Waveform fake visualization inside segment */}
														<div className="absolute inset-0 opacity-20 flex items-center justify-center gap-px px-3 pointer-events-none">
															{(waveformHeights[seg.id] || []).map((h, i) => (
																<div
																	key={`wave-${seg.id}-${i}`}
																	className="w-full bg-current rounded-full"
																	style={{
																		height: `${h}%`,
																		color: speaker.color,
																	}}
																/>
															))}
														</div>

														{/* Tiny Text Preview if wide enough */}
														{duration * zoomLevel > 40 && (
															<div className="relative text-[10px] font-medium truncate text-slate-600 select-none px-3 pointer-events-none">
																{seg.text}
															</div>
														)}

														{/* Left drag handle */}
														<div
															className="absolute left-0 top-0 bottom-0 w-3 cursor-w-resize hover:bg-black/20 transition-colors flex items-center justify-center"
															onMouseDown={(e) => handleSegmentDragStart(e, seg.id, "left", seg)}
														>
															<div className="w-0.5 h-6 bg-black/20 rounded-full" />
														</div>

														{/* Right drag handle */}
														<div
															className="absolute right-0 top-0 bottom-0 w-3 cursor-e-resize hover:bg-black/20 transition-colors flex items-center justify-center"
															onMouseDown={(e) => handleSegmentDragStart(e, seg.id, "right", seg)}
														>
															<div className="w-0.5 h-6 bg-black/20 rounded-full" />
														</div>
													</div>
												);
											})}
										</div>
									);
								})}
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Segment Context Menu */}
			{contextMenu && (
				<div
					className="fixed bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50 min-w-[180px]"
					style={{ top: contextMenu.y, left: contextMenu.x }}
					onClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => e.stopPropagation()}
				>
					{assignSpeakerMenuOpen ? (
						<>
							<div className="px-3 py-2 text-xs font-semibold text-slate-500 border-b border-slate-100">
								Assign to speaker
							</div>
							<div className="max-h-48 overflow-y-auto">
								{speakers.map((speaker) => (
									<button
										key={speaker.id}
										type="button"
										className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
										onClick={() => {
											onUpdateSegment(contextMenu.segmentId, { speakerId: speaker.id });
											setContextMenu(null);
											setAssignSpeakerMenuOpen(false);
										}}
									>
										<div
											className="w-3 h-3 rounded-full"
											style={{ backgroundColor: speaker.color }}
										/>
										{speaker.name}
									</button>
								))}
							</div>
							<button
								type="button"
								className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 border-t border-slate-100"
								onClick={() => setAssignSpeakerMenuOpen(false)}
							>
								← Back
							</button>
						</>
					) : (
						<>
							<button
								type="button"
								className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
								onClick={() => setAssignSpeakerMenuOpen(true)}
							>
								<UserRound size={14} className="text-slate-400" />
								Assign speaker
							</button>
							<button
								type="button"
								className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
								onClick={() => {
									const seg = segments.find((s) => s.id === contextMenu.segmentId);
									if (seg) {
										const start = parseTime(seg.startTime);
										const end = parseTime(seg.endTime);
										const mid = (start + end) / 2;
										// Create two segments from the split
										onUpdateSegment(contextMenu.segmentId, { endTime: formatTime(mid) });
										onAddSegment(mid, seg.speakerId);
									}
									setContextMenu(null);
								}}
							>
								<Scissors size={14} className="text-slate-400" />
								Split at center
							</button>
							<button
								type="button"
								className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
								onClick={() => {
									const seg = segments.find((s) => s.id === contextMenu.segmentId);
									if (seg) {
										navigator.clipboard.writeText(seg.text);
									}
									setContextMenu(null);
								}}
							>
								<Copy size={14} className="text-slate-400" />
								Copy text
							</button>
							<div className="h-px bg-slate-100 my-1" />
							<button
								type="button"
								className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
								onClick={() => {
									onDeleteSegment(contextMenu.segmentId);
									setContextMenu(null);
								}}
							>
								<Trash2 size={14} />
								Delete segment
							</button>
						</>
					)}
				</div>
			)}
		</div>
	);
}

export default Timeline;
