import {
	ArrowRightLeft,
	Copy,
	Grid3X3,
	GripVertical,
	Magnet,
	MoreVertical,
	Palette,
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
import type {
	ChangeEvent,
	DragEvent,
	FocusEvent,
	KeyboardEvent,
	MouseEvent as ReactMouseEvent,
	RefObject,
	UIEvent,
} from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ZOOM } from "@/app/layout-constants";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { findSilenceGaps } from "@/domain/timeline/timeline-gaps";
import {
	getSegmentEdgeTimes,
	type SnapConfig,
	snapTime,
	snapToEdge,
	snapToGrid,
} from "@/domain/timeline/timeline-utils";
import { SPEAKER_COLORS } from "@/domain/transcript/constants";
import type { Segment, Speaker } from "@/domain/transcript/types";
import { cn, formatTime, parseTime } from "@/lib/utils";
import { PLAYBACK_SPEEDS, type PlaybackSpeed, usePlayerStore } from "@/stores/player-store";

interface TimelineProps {
	audioUrl?: string | null;
	currentTime: number;
	isPlaying: boolean;
	onAddSegment: (currentTime: number, speakerId?: string) => void;
	onCloseTimelineGaps: () => void;
	onDeleteSegment: (id: string) => void;
	onDeleteSpeaker: (id: string) => void;
	onMergeSpeakers: (fromId: string, toId: string) => void;
	onReorderSpeakers: (fromIndex: number, toIndex: number) => void;
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
	totalDuration: number;
	zoomLevel: number;
}

interface ContextMenuState {
	segmentId: string;
	x: number;
	y: number;
}

type DragMode = "left" | "right" | "move";
interface DragState {
	initialEndTime: number;
	initialStartTime: number;
	initialX: number;
	mode: DragMode;
	segmentId: string;
}

interface DragUpdateResult {
	guides: number[];
	updates: Partial<Segment> | null;
}

interface DragUpdateParams {
	deltaTime: number;
	dragState: DragState;
	gridSnap: boolean;
	performEdgeSnap: (time: number, excludeSegmentId: string) => { snapped: boolean; time: number };
	performSnap: (time: number, excludeSegmentId: string) => number;
	segment: Segment;
}

interface AutoScrollOptions {
	autoScrollRef: RefObject<number | null>;
	containerRef: RefObject<HTMLDivElement | null>;
	containerWidth: number;
	relativeX: number;
}

function buildWaveformPeaks(audioBuffer: AudioBuffer, peakCount = 1600): number[] {
	const peaks: number[] = [];
	const channelData = Array.from({ length: audioBuffer.numberOfChannels }, (_, index) =>
		audioBuffer.getChannelData(index)
	);
	const sampleCount = audioBuffer.length;
	const samplesPerPeak = Math.max(1, Math.floor(sampleCount / peakCount));

	for (let peakIndex = 0; peakIndex < peakCount; peakIndex += 1) {
		const start = peakIndex * samplesPerPeak;
		const end = Math.min(sampleCount, start + samplesPerPeak);
		let peak = 0;
		for (const channel of channelData) {
			for (let index = start; index < end; index += 1) {
				peak = Math.max(peak, Math.abs(channel[index] ?? 0));
			}
		}
		peaks.push(peak);
	}

	const maxPeak = Math.max(...peaks, 0.0001);
	return peaks.map((peak) => peak / maxPeak);
}

function waveformPath(peaks: number[]): string {
	if (peaks.length === 0) {
		return "";
	}
	return peaks
		.map((peak, index) => {
			const x = peaks.length === 1 ? 0 : (index / (peaks.length - 1)) * 1000;
			const halfHeight = Math.max(1, peak * 46);
			return `M${x.toFixed(2)} ${(50 - halfHeight).toFixed(2)}V${(50 + halfHeight).toFixed(2)}`;
		})
		.join(" ");
}

function resamplePeaks(peaks: number[], targetCount: number): number[] {
	if (peaks.length <= targetCount) {
		return peaks;
	}
	return Array.from({ length: targetCount }, (_, index) => {
		const start = Math.floor((index / targetCount) * peaks.length);
		const end = Math.max(start + 1, Math.floor(((index + 1) / targetCount) * peaks.length));
		return Math.max(...peaks.slice(start, end));
	});
}

function segmentWaveformPath(
	peaks: number[] | null,
	start: number,
	end: number,
	totalDuration: number
): string {
	if (!peaks || peaks.length === 0 || totalDuration <= 0 || end <= start) {
		return "";
	}
	const startIndex = Math.max(0, Math.floor((start / totalDuration) * peaks.length));
	const endIndex = Math.min(peaks.length, Math.ceil((end / totalDuration) * peaks.length));
	const slice = peaks.slice(startIndex, Math.max(startIndex + 1, endIndex));
	const targetCount = Math.max(12, Math.min(64, Math.ceil((end - start) * 8)));
	return waveformPath(resamplePeaks(slice, targetCount));
}

function formatGapDuration(seconds: number): string {
	if (seconds >= 60) {
		return formatTime(seconds);
	}
	return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}s`;
}

function cancelTimelineAutoScroll(autoScrollRef: RefObject<number | null>) {
	if (autoScrollRef.current) {
		cancelAnimationFrame(autoScrollRef.current);
		autoScrollRef.current = null;
	}
}

function scheduleTimelineAutoScroll({
	autoScrollRef,
	containerRef,
	containerWidth,
	relativeX,
}: AutoScrollOptions) {
	const autoScrollZone = 80;
	const autoScrollSpeed = 8;

	cancelTimelineAutoScroll(autoScrollRef);

	let scrollAmount = 0;
	if (relativeX < autoScrollZone) {
		scrollAmount = -autoScrollSpeed * (1 - relativeX / autoScrollZone);
	} else if (relativeX > containerWidth - autoScrollZone) {
		scrollAmount = autoScrollSpeed * (1 - (containerWidth - relativeX) / autoScrollZone);
	}

	if (scrollAmount === 0) {
		return;
	}

	const doScroll = () => {
		if (containerRef.current) {
			containerRef.current.scrollLeft += scrollAmount;
			autoScrollRef.current = requestAnimationFrame(doScroll);
		}
	};
	autoScrollRef.current = requestAnimationFrame(doScroll);
}

function getDragCursor(mode: DragMode): string {
	if (mode === "left") {
		return "w-resize";
	}
	if (mode === "right") {
		return "e-resize";
	}
	return "grabbing";
}

function getLeftEdgeDragUpdate({
	dragState,
	performEdgeSnap,
	performSnap,
	segment,
	deltaTime,
}: DragUpdateParams): DragUpdateResult {
	const minDuration = 0.5;
	const rawStart = Math.max(0, dragState.initialStartTime + deltaTime);
	const newStart = performSnap(rawStart, segment.id);

	if (newStart >= dragState.initialEndTime - minDuration) {
		return { guides: [], updates: null };
	}

	const edgeResult = performEdgeSnap(rawStart, segment.id);
	return {
		guides: edgeResult.snapped ? [edgeResult.time] : [],
		updates: { startTime: formatTime(newStart) },
	};
}

function getRightEdgeDragUpdate({
	dragState,
	performEdgeSnap,
	performSnap,
	segment,
	deltaTime,
}: DragUpdateParams): DragUpdateResult {
	const minDuration = 0.5;
	const rawEnd = Math.max(
		dragState.initialStartTime + minDuration,
		dragState.initialEndTime + deltaTime
	);
	const newEnd = performSnap(rawEnd, segment.id);
	const edgeResult = performEdgeSnap(rawEnd, segment.id);

	return {
		guides: edgeResult.snapped ? [edgeResult.time] : [],
		updates: { endTime: formatTime(newEnd) },
	};
}

function getMoveDragUpdate({
	dragState,
	gridSnap,
	performEdgeSnap,
	segment,
	deltaTime,
}: DragUpdateParams): DragUpdateResult {
	const segmentDuration = dragState.initialEndTime - dragState.initialStartTime;
	const rawStart = Math.max(0, dragState.initialStartTime + deltaTime);
	const rawEnd = rawStart + segmentDuration;
	const startSnap = performEdgeSnap(rawStart, segment.id);
	const endSnap = performEdgeSnap(rawEnd, segment.id);
	let newStart = snapToGrid(rawStart, 0.5, gridSnap);
	const guides: number[] = [];

	if (startSnap.snapped) {
		newStart = startSnap.time;
		guides.push(startSnap.time);
	} else if (endSnap.snapped) {
		newStart = endSnap.time - segmentDuration;
		guides.push(endSnap.time);
	}

	return {
		guides,
		updates: {
			endTime: formatTime(Math.max(0, newStart) + segmentDuration),
			startTime: formatTime(Math.max(0, newStart)),
		},
	};
}

function getSegmentDragUpdate(params: DragUpdateParams): DragUpdateResult {
	if (params.dragState.mode === "left") {
		return getLeftEdgeDragUpdate(params);
	}
	if (params.dragState.mode === "right") {
		return getRightEdgeDragUpdate(params);
	}
	return getMoveDragUpdate(params);
}

interface SpeakerMergeTargetButtonProps {
	onCloseMenu: () => void;
	onMergeSpeakers: (fromId: string, toId: string) => void;
	sourceSpeakerId: string;
	target: Speaker;
}

function SpeakerMergeTargetButton({
	onCloseMenu,
	onMergeSpeakers,
	sourceSpeakerId,
	target,
}: SpeakerMergeTargetButtonProps) {
	const handleClick = useCallback(() => {
		onMergeSpeakers(sourceSpeakerId, target.id);
		onCloseMenu();
	}, [onCloseMenu, onMergeSpeakers, sourceSpeakerId, target.id]);

	return (
		<button
			className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 text-sm hover:bg-blue-50 hover:text-blue-600"
			onClick={handleClick}
			type="button"
		>
			<span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: target.color }} />
			<span className="min-w-0 truncate">{target.name}</span>
		</button>
	);
}

interface SpeakerRowProps {
	activeMenuSpeakerId: string | null;
	draggedSpeakerIndex: number | null;
	editingSpeakerId: string | null;
	index: number;
	onCycleSpeakerColor: (speaker: Speaker) => void;
	onDeleteSpeaker: (id: string) => void;
	onDragOver: (event: DragEvent) => void;
	onDragStart: (event: DragEvent, index: number) => void;
	onDrop: (event: DragEvent, index: number) => void;
	onMergeSpeakers: (fromId: string, toId: string) => void;
	onSetActiveMenuSpeakerId: (id: string | null) => void;
	onSetEditingSpeakerId: (id: string | null) => void;
	onUpdateSpeaker: (id: string, updates: Partial<Speaker>) => void;
	segmentCount: number;
	speaker: Speaker;
	speakers: Speaker[];
}

function SpeakerRow({
	activeMenuSpeakerId,
	draggedSpeakerIndex,
	editingSpeakerId,
	index,
	onCycleSpeakerColor,
	onDeleteSpeaker,
	onDragOver,
	onDrop,
	onDragStart,
	onMergeSpeakers,
	onSetActiveMenuSpeakerId,
	onSetEditingSpeakerId,
	onUpdateSpeaker,
	segmentCount,
	speaker,
	speakers,
}: SpeakerRowProps) {
	const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
	const isEditing = editingSpeakerId === speaker.id;
	const isMenuOpen = activeMenuSpeakerId === speaker.id;
	const otherSpeakers = speakers.filter((target) => target.id !== speaker.id);

	useEffect(() => {
		if (!isMenuOpen) {
			setIsConfirmingDelete(false);
		}
	}, [isMenuOpen]);

	const closeMenu = useCallback(() => {
		onSetActiveMenuSpeakerId(null);
	}, [onSetActiveMenuSpeakerId]);

	const focusInput = useCallback((element: HTMLInputElement | null) => {
		element?.focus();
	}, []);

	const handleDragStart = useCallback(
		(event: DragEvent) => {
			onDragStart(event, index);
		},
		[index, onDragStart]
	);

	const handleDrop = useCallback(
		(event: DragEvent) => {
			onDrop(event, index);
		},
		[index, onDrop]
	);

	const handleColorClick = useCallback(
		(event: ReactMouseEvent<HTMLButtonElement>) => {
			event.stopPropagation();
			onCycleSpeakerColor(speaker);
		},
		[onCycleSpeakerColor, speaker]
	);

	const handleNameBlur = useCallback(
		(event: FocusEvent<HTMLInputElement>) => {
			if (event.target.value.trim()) {
				onUpdateSpeaker(speaker.id, { name: event.target.value });
			}
			onSetEditingSpeakerId(null);
		},
		[onSetEditingSpeakerId, onUpdateSpeaker, speaker.id]
	);

	const handleNameKeyDown = useCallback(
		(event: KeyboardEvent<HTMLInputElement>) => {
			if (event.key === "Enter") {
				if (event.currentTarget.value.trim()) {
					onUpdateSpeaker(speaker.id, {
						name: event.currentTarget.value,
					});
				}
				onSetEditingSpeakerId(null);
			}
			if (event.key === "Escape") {
				onSetEditingSpeakerId(null);
			}
		},
		[onSetEditingSpeakerId, onUpdateSpeaker, speaker.id]
	);

	const handleEditClick = useCallback(() => {
		onSetEditingSpeakerId(speaker.id);
	}, [onSetEditingSpeakerId, speaker.id]);

	const handleMenuClick = useCallback(
		(event: ReactMouseEvent<HTMLButtonElement>) => {
			event.stopPropagation();
			onSetActiveMenuSpeakerId(isMenuOpen ? null : speaker.id);
		},
		[isMenuOpen, onSetActiveMenuSpeakerId, speaker.id]
	);

	const stopMenuClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
		event.stopPropagation();
	}, []);

	const stopMenuKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
		event.stopPropagation();
	}, []);

	const handleRenameMenuClick = useCallback(() => {
		onSetEditingSpeakerId(speaker.id);
		closeMenu();
	}, [closeMenu, onSetEditingSpeakerId, speaker.id]);

	const handleDeleteClick = useCallback(() => {
		if (!isConfirmingDelete) {
			setIsConfirmingDelete(true);
			return;
		}
		onDeleteSpeaker(speaker.id);
		closeMenu();
	}, [closeMenu, isConfirmingDelete, onDeleteSpeaker, speaker.id]);

	return (
		// biome-ignore lint/a11y/noNoninteractiveElementInteractions: This row is a native drag/drop target for speaker reordering.
		<li
			aria-grabbed={draggedSpeakerIndex === index}
			className={cn(
				"group relative flex h-24 items-center gap-2 border-slate-200 border-b pr-4 pl-2 transition-colors hover:bg-slate-50",
				draggedSpeakerIndex === index && "bg-slate-100 opacity-50"
			)}
			draggable
			onDragOver={onDragOver}
			onDragStart={handleDragStart}
			onDrop={handleDrop}
		>
			<div className="cursor-grab p-1 text-slate-300 hover:text-slate-500 active:cursor-grabbing">
				<GripVertical size={14} />
			</div>

			<div className="relative">
				<div
					className="flex h-8 w-8 items-center justify-center rounded-full font-bold text-white text-xs shadow-sm"
					style={{ backgroundColor: speaker.color }}
				>
					{speaker.name.charAt(0)}
				</div>
				<button
					aria-label={`Change ${speaker.name} color`}
					className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-white text-slate-500 opacity-0 shadow-sm transition-opacity hover:text-slate-900 group-hover:opacity-100"
					onClick={handleColorClick}
					title="Change color"
					type="button"
				>
					<Palette size={11} />
				</button>
			</div>

			<div className="min-w-0 flex-1">
				{isEditing ? (
					<input
						className="w-full rounded border border-blue-300 px-1 py-0.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
						defaultValue={speaker.name}
						onBlur={handleNameBlur}
						onKeyDown={handleNameKeyDown}
						ref={focusInput}
						type="text"
					/>
				) : (
					<button
						className="w-full cursor-text truncate text-left font-medium text-slate-700 text-sm hover:text-blue-600"
						onClick={handleEditClick}
						title="Click to rename"
						type="button"
					>
						{speaker.name}
					</button>
				)}
				<div className="mt-0.5 text-[10px] text-slate-400">{segmentCount} segments</div>
			</div>

			<div className="relative">
				<button
					className="rounded p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-200 hover:text-slate-600 group-hover:opacity-100"
					onClick={handleMenuClick}
					type="button"
				>
					<MoreVertical size={14} />
				</button>

				{isMenuOpen ? (
					<div
						className="absolute top-8 right-0 z-50 w-48 rounded-lg border border-slate-100 bg-white py-1 shadow-xl"
						onClick={stopMenuClick}
						onKeyDown={stopMenuKeyDown}
						role="menu"
					>
						<button
							className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-slate-700 text-sm hover:bg-slate-50"
							onClick={handleRenameMenuClick}
							type="button"
						>
							<Pencil className="text-slate-400" size={14} /> Rename
						</button>
						<div className="group/move relative">
							<button
								className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-slate-700 text-sm hover:bg-slate-50"
								type="button"
							>
								<ArrowRightLeft className="text-slate-400" size={14} />
								<span className="flex-1">Move segments to</span>
								<span className="text-slate-300">›</span>
							</button>
							<div className="invisible absolute top-0 left-full ml-1 max-h-56 w-52 overflow-y-auto rounded-lg border border-slate-100 bg-white py-1 opacity-0 shadow-xl transition group-focus-within/move:visible group-focus-within/move:opacity-100 group-hover/move:visible group-hover/move:opacity-100">
								{otherSpeakers.length > 0 ? (
									otherSpeakers.map((target) => (
										<SpeakerMergeTargetButton
											key={target.id}
											onCloseMenu={closeMenu}
											onMergeSpeakers={onMergeSpeakers}
											sourceSpeakerId={speaker.id}
											target={target}
										/>
									))
								) : (
									<div className="px-3 py-2 text-slate-400 text-xs italic">No other speakers</div>
								)}
							</div>
						</div>
						<div className="my-1 h-px bg-slate-100" />
						<button
							className={cn(
								"flex w-full items-center gap-2 px-4 py-2.5 text-left text-red-600 text-sm hover:bg-red-50",
								isConfirmingDelete && "bg-red-50 font-medium"
							)}
							onClick={handleDeleteClick}
							type="button"
						>
							<Trash2 size={14} /> {isConfirmingDelete ? "Confirm delete" : "Delete"}
						</button>
					</div>
				) : null}
			</div>
		</li>
	);
}

interface TimelineSegmentBlockProps {
	currentTime: number;
	fallbackBars: { height: number; id: string }[];
	isDragging: boolean;
	isSelected: boolean;
	onContextMenu: (event: ReactMouseEvent, segmentId: string) => void;
	onDragStart: (
		event: ReactMouseEvent,
		segmentId: string,
		mode: DragMode,
		segment: Segment
	) => void;
	onSeek: (time: number) => void;
	onSegmentClick: (segmentId: string) => void;
	segment: Segment;
	speaker: Speaker;
	totalDuration: number;
	waveformPeaks: number[] | null;
	zoomLevel: number;
}

function TimelineSegmentBlock({
	currentTime,
	fallbackBars,
	isDragging,
	isSelected,
	onContextMenu,
	onDragStart,
	onSeek,
	onSegmentClick,
	segment,
	speaker,
	totalDuration,
	waveformPeaks,
	zoomLevel,
}: TimelineSegmentBlockProps) {
	const start = parseTime(segment.startTime);
	const end = parseTime(segment.endTime);
	const duration = Math.max(0.5, end - start);
	const isActive = start <= currentTime && end > currentTime;
	const thumbnailPath = segmentWaveformPath(waveformPeaks, start, end, totalDuration);
	const showTextPreview = duration * zoomLevel > 40;

	const handleBodyClick = useCallback(
		(event: ReactMouseEvent<HTMLButtonElement>) => {
			event.stopPropagation();
			onSegmentClick(segment.id);

			if (event.detail === 0) {
				onSeek(start);
				return;
			}

			const rect = event.currentTarget.getBoundingClientRect();
			const clickX = event.clientX - rect.left;
			const proportionalTime = start + (clickX / rect.width) * duration;
			onSeek(Math.max(start, Math.min(end, proportionalTime)));
		},
		[duration, end, onSeek, onSegmentClick, segment.id, start]
	);

	const handleContextMenu = useCallback(
		(event: ReactMouseEvent) => {
			onContextMenu(event, segment.id);
		},
		[onContextMenu, segment.id]
	);

	const handleMoveMouseDown = useCallback(
		(event: ReactMouseEvent) => {
			onDragStart(event, segment.id, "move", segment);
		},
		[onDragStart, segment]
	);

	const handleLeftMouseDown = useCallback(
		(event: ReactMouseEvent) => {
			onDragStart(event, segment.id, "left", segment);
		},
		[onDragStart, segment]
	);

	const handleRightMouseDown = useCallback(
		(event: ReactMouseEvent) => {
			onDragStart(event, segment.id, "right", segment);
		},
		[onDragStart, segment]
	);

	return (
		<div
			className={cn(
				"absolute top-4 bottom-4 flex flex-col justify-center overflow-hidden rounded-lg border-2 transition-all",
				isSelected &&
					"z-20 shadow-[0_0_12px_rgba(59,130,246,0.5)] ring-2 ring-blue-500 ring-offset-2",
				!isSelected && "border-opacity-60 hover:shadow-md hover:brightness-95",
				isActive && !isSelected && "ring-2 ring-amber-400 ring-offset-1",
				isDragging && "z-30 opacity-80 shadow-2xl"
			)}
			data-segment
			style={{
				backgroundColor: isSelected ? `${speaker.color}50` : `${speaker.color}25`,
				borderColor: isSelected ? speaker.color : `${speaker.color}90`,
				left: `${start * zoomLevel}px`,
				width: `${duration * zoomLevel}px`,
			}}
			title={segment.text}
		>
			<button
				aria-label={`Move ${segment.text}`}
				className="absolute inset-0 right-3 left-3 z-10 cursor-grab border-0 bg-transparent p-0 active:cursor-grabbing"
				onClick={handleBodyClick}
				onContextMenu={handleContextMenu}
				onMouseDown={handleMoveMouseDown}
				type="button"
			/>

			{thumbnailPath ? (
				<div className="pointer-events-none absolute inset-0 flex items-center px-3 opacity-35">
					<svg
						aria-hidden="true"
						className="h-14 w-full"
						preserveAspectRatio="none"
						viewBox="0 0 1000 100"
					>
						<path
							d={thumbnailPath}
							fill="none"
							stroke={speaker.color}
							strokeWidth="1.5"
							vectorEffect="non-scaling-stroke"
						/>
					</svg>
				</div>
			) : (
				<div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-px px-3 opacity-20">
					{fallbackBars.map((bar) => (
						<div
							className="w-full rounded-full bg-current"
							key={bar.id}
							style={{
								color: speaker.color,
								height: `${bar.height}%`,
							}}
						/>
					))}
				</div>
			)}

			{showTextPreview ? (
				<div className="pointer-events-none relative select-none truncate px-3 font-medium text-[10px] text-slate-600">
					{segment.text}
				</div>
			) : null}

			<button
				aria-label={`Trim start of ${segment.text}`}
				className="absolute top-0 bottom-0 left-0 z-20 flex w-3 cursor-w-resize items-center justify-center border-0 bg-transparent p-0 transition-colors hover:bg-black/20"
				onMouseDown={handleLeftMouseDown}
				type="button"
			>
				<div className="h-6 w-0.5 rounded-full bg-black/20" />
			</button>

			<button
				aria-label={`Trim end of ${segment.text}`}
				className="absolute top-0 right-0 bottom-0 z-20 flex w-3 cursor-e-resize items-center justify-center border-0 bg-transparent p-0 transition-colors hover:bg-black/20"
				onMouseDown={handleRightMouseDown}
				type="button"
			>
				<div className="h-6 w-0.5 rounded-full bg-black/20" />
			</button>
		</div>
	);
}

interface SegmentContextSpeakerButtonProps {
	onAssignSpeaker: (speakerId: string) => void;
	speaker: Speaker;
}

function SegmentContextSpeakerButton({
	onAssignSpeaker,
	speaker,
}: SegmentContextSpeakerButtonProps) {
	const handleClick = useCallback(() => {
		onAssignSpeaker(speaker.id);
	}, [onAssignSpeaker, speaker.id]);

	return (
		<button
			className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 text-sm hover:bg-slate-50"
			onClick={handleClick}
			type="button"
		>
			<div className="h-3 w-3 rounded-full" style={{ backgroundColor: speaker.color }} />
			{speaker.name}
		</button>
	);
}

interface SegmentContextMenuProps {
	assignSpeakerMenuOpen: boolean;
	contextMenu: ContextMenuState;
	onAddSegment: (currentTime: number, speakerId?: string) => void;
	onClose: () => void;
	onDeleteSegment: (id: string) => void;
	onSetAssignSpeakerMenuOpen: (open: boolean) => void;
	onUpdateSegment: (id: string, updates: Partial<Segment>) => void;
	segments: Segment[];
	speakers: Speaker[];
}

function SegmentContextMenu({
	assignSpeakerMenuOpen,
	contextMenu,
	onAddSegment,
	onClose,
	onDeleteSegment,
	onSetAssignSpeakerMenuOpen,
	onUpdateSegment,
	segments,
	speakers,
}: SegmentContextMenuProps) {
	const segment = useMemo(
		() => segments.find((candidate) => candidate.id === contextMenu.segmentId) ?? null,
		[contextMenu.segmentId, segments]
	);

	const stopMenuClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
		event.stopPropagation();
	}, []);

	const stopMenuKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
		event.stopPropagation();
	}, []);

	const handleAssignSpeaker = useCallback(
		(speakerId: string) => {
			onUpdateSegment(contextMenu.segmentId, { speakerId });
			onSetAssignSpeakerMenuOpen(false);
			onClose();
		},
		[contextMenu.segmentId, onClose, onSetAssignSpeakerMenuOpen, onUpdateSegment]
	);

	const openAssignSpeakerMenu = useCallback(() => {
		onSetAssignSpeakerMenuOpen(true);
	}, [onSetAssignSpeakerMenuOpen]);

	const closeAssignSpeakerMenu = useCallback(() => {
		onSetAssignSpeakerMenuOpen(false);
	}, [onSetAssignSpeakerMenuOpen]);

	const handleSplitAtCenter = useCallback(() => {
		if (segment) {
			const start = parseTime(segment.startTime);
			const end = parseTime(segment.endTime);
			const mid = (start + end) / 2;
			onUpdateSegment(contextMenu.segmentId, { endTime: formatTime(mid) });
			onAddSegment(mid, segment.speakerId);
		}
		onClose();
	}, [contextMenu.segmentId, onAddSegment, onClose, onUpdateSegment, segment]);

	const handleCopyText = useCallback(() => {
		if (segment) {
			navigator.clipboard
				.writeText(segment.text)
				.catch((error: unknown) => console.info("Unable to copy segment text:", error));
		}
		onClose();
	}, [onClose, segment]);

	const handleDeleteSegment = useCallback(() => {
		onDeleteSegment(contextMenu.segmentId);
		onClose();
	}, [contextMenu.segmentId, onClose, onDeleteSegment]);

	return (
		<div
			className="fixed z-50 min-w-[180px] rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
			onClick={stopMenuClick}
			onKeyDown={stopMenuKeyDown}
			role="menu"
			style={{ left: contextMenu.x, top: contextMenu.y }}
		>
			{assignSpeakerMenuOpen ? (
				<>
					<div className="border-slate-100 border-b px-3 py-2 font-semibold text-slate-500 text-xs">
						Assign to speaker
					</div>
					<div className="max-h-48 overflow-y-auto">
						{speakers.map((speaker) => (
							<SegmentContextSpeakerButton
								key={speaker.id}
								onAssignSpeaker={handleAssignSpeaker}
								speaker={speaker}
							/>
						))}
					</div>
					<button
						className="w-full border-slate-100 border-t px-3 py-2 text-left text-slate-500 text-xs hover:bg-slate-100"
						onClick={closeAssignSpeakerMenu}
						type="button"
					>
						← Back
					</button>
				</>
			) : (
				<>
					<button
						className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 text-sm hover:bg-slate-50"
						onClick={openAssignSpeakerMenu}
						type="button"
					>
						<UserRound className="text-slate-400" size={14} />
						Assign speaker
					</button>
					<button
						className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 text-sm hover:bg-slate-50"
						onClick={handleSplitAtCenter}
						type="button"
					>
						<Scissors className="text-slate-400" size={14} />
						Split at center
					</button>
					<button
						className="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 text-sm hover:bg-slate-50"
						onClick={handleCopyText}
						type="button"
					>
						<Copy className="text-slate-400" size={14} />
						Copy text
					</button>
					<div className="my-1 h-px bg-slate-100" />
					<button
						className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 text-sm hover:bg-red-50"
						onClick={handleDeleteSegment}
						type="button"
					>
						<Trash2 size={14} />
						Delete segment
					</button>
				</>
			)}
		</div>
	);
}

export function Timeline({
	segments,
	speakers,
	audioUrl,
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
	onCloseTimelineGaps,
}: TimelineProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const rulerRef = useRef<HTMLDivElement>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
	const [activeMenuSpeakerId, setActiveMenuSpeakerId] = useState<string | null>(null);
	const [draggedSpeakerIndex, setDraggedSpeakerIndex] = useState<number | null>(null);
	const [dragState, setDragState] = useState<DragState | null>(null);
	const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
	const [assignSpeakerMenuOpen, setAssignSpeakerMenuOpen] = useState(false);
	const [waveformPeaks, setWaveformPeaks] = useState<number[] | null>(null);

	// Grid snapping
	const [gridSnap, setGridSnap] = useState(true);
	const gridSnapInterval = 0.5; // Snap to 0.5 second intervals

	// Drag line guides (snap to other segment edges)
	const [dragLineSnap, setDragLineSnap] = useState(true);
	const [snapGuides, setSnapGuides] = useState<number[]>([]); // Times where guides should show
	const edgeThreshold = 0.2; // Snap within 0.2 seconds of other edges
	const timelineWidth = Math.max(100, totalDuration * zoomLevel + 500);
	const silenceGaps = useMemo(() => findSilenceGaps(segments), [segments]);
	const closeableGapCount = silenceGaps.filter((gap) => gap.closeAmount > 0).length;
	const totalGapDuration = silenceGaps.reduce((sum, gap) => sum + gap.duration, 0);
	const trackHeight = Math.max(96, speakers.length * 96);
	const waveformSvgPath = useMemo(
		() => (waveformPeaks ? waveformPath(waveformPeaks) : ""),
		[waveformPeaks]
	);

	// Cross-component scroll coordination
	const registerScrollToTime = usePlayerStore((s) => s.registerScrollToTime);
	const scrollToSegment = usePlayerStore((s) => s.scrollToSegment);
	const autoFollowEnabled = usePlayerStore((s) => s.autoFollowEnabled);
	const setAutoFollow = usePlayerStore((s) => s.setAutoFollow);

	// Track if we're doing programmatic scroll (to distinguish from user scroll)
	const isProgrammaticScrollRef = useRef(false);

	useEffect(() => {
		let cancelled = false;

		if (!audioUrl) {
			setWaveformPeaks(null);
			return;
		}

		const loadWaveform = async () => {
			try {
				const response = await fetch(audioUrl);
				const arrayBuffer = await response.arrayBuffer();
				const contextCtor =
					window.AudioContext ??
					(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
				if (!contextCtor) {
					throw new Error("AudioContext is not available.");
				}
				const audioContext = new contextCtor();
				const decoded = await audioContext.decodeAudioData(arrayBuffer);
				await audioContext.close();
				if (!cancelled) {
					setWaveformPeaks(buildWaveformPeaks(decoded));
				}
			} catch (error) {
				console.info("Unable to decode waveform:", error);
				if (!cancelled) {
					setWaveformPeaks(null);
				}
			}
		};

		loadWaveform();

		return () => {
			cancelled = true;
		};
	}, [audioUrl]);

	// Register scroll-to-time callback
	useEffect(() => {
		const scrollToTime = (timeSeconds: number) => {
			const container = scrollContainerRef.current;
			if (!container) {
				return;
			}

			const pixelsPerSecond = zoomLevel;
			const targetX = timeSeconds * pixelsPerSecond - container.clientWidth / 2;

			container.scrollTo({
				behavior: "smooth",
				left: Math.max(0, targetX),
			});
		};
		registerScrollToTime(scrollToTime);
	}, [registerScrollToTime, zoomLevel]);

	// Auto-scroll during playback to keep playhead visible (respects autoFollow setting)
	useEffect(() => {
		if (!(isPlaying && autoFollowEnabled)) {
			return;
		}

		const container = scrollContainerRef.current;
		if (!container) {
			return;
		}

		const pixelsPerSecond = zoomLevel;
		const playheadX = currentTime * pixelsPerSecond;
		const { scrollLeft, clientWidth: viewWidth } = container;
		const margin = 100; // Keep playhead this many pixels from edges

		// Check if playhead is near the right edge
		if (playheadX > scrollLeft + viewWidth - margin) {
			// Mark as programmatic scroll
			isProgrammaticScrollRef.current = true;
			container.scrollTo({
				behavior: "smooth",
				left: playheadX - viewWidth + margin * 2,
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
				behavior: "smooth",
				left: Math.max(0, playheadX - margin),
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
				behavior: "smooth",
				left: Math.max(0, playheadX - viewWidth / 2),
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

	const cycleSpeakerColor = useCallback(
		(speaker: Speaker) => {
			const currentIndex = SPEAKER_COLORS.findIndex(
				(color) => color.toLowerCase() === speaker.color.toLowerCase()
			);
			const nextColor =
				SPEAKER_COLORS[(currentIndex + 1) % SPEAKER_COLORS.length] ?? SPEAKER_COLORS[0];
			onUpdateSpeaker(speaker.id, { color: nextColor });
		},
		[onUpdateSpeaker]
	);

	const autoScrollRef = useRef<number | null>(null);

	// Playhead dragging and hover preview
	const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
	const [hoverTime, setHoverTime] = useState<number | null>(null);

	// Generate stable waveform heights per segment (memoized to prevent re-renders)
	const waveformHeights = useMemo(() => {
		const heights: Record<string, { id: string; height: number }[]> = {};
		for (const seg of segments) {
			// Use segment ID as seed for consistent heights
			const seed = seg.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
			heights[seg.id] = Array.from({ length: 10 }, (_, i) => {
				const pseudoRandom = Math.sin(seed * (i + 1) * 9999) * 0.5 + 0.5;
				return { height: 30 + pseudoRandom * 40, id: `${seg.id}-wave-${i}` };
			});
		}
		return heights;
	}, [segments]);

	// Sync ruler horizontal scroll with timeline
	const handleTimelineScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
		if (rulerRef.current) {
			rulerRef.current.scrollLeft = e.currentTarget.scrollLeft;
		}
	}, []);

	// Build snap config from current state
	const snapConfig: SnapConfig = useMemo(
		() => ({
			edgeEnabled: dragLineSnap,
			edgeThreshold,
			gridEnabled: gridSnap,
			gridInterval: gridSnapInterval,
		}),
		[dragLineSnap, gridSnap]
	);

	// Get snap targets for a segment (all other segment edges)
	const getSnapTargets = useCallback(
		(excludeSegmentId: string): number[] =>
			getSegmentEdgeTimes(segments, excludeSegmentId, parseTime),
		[segments]
	);

	// Wrapper for edge snapping with current config
	const performEdgeSnap = useCallback(
		(time: number, excludeSegmentId: string) => {
			const targets = getSnapTargets(excludeSegmentId);
			return snapToEdge(time, targets, edgeThreshold, dragLineSnap);
		},
		[dragLineSnap, getSnapTargets]
	);

	// Wrapper for combined snapping with current config
	const performSnap = useCallback(
		(time: number, excludeSegmentId: string): number => {
			const targets = getSnapTargets(excludeSegmentId);
			return snapTime(time, targets, snapConfig).time;
		},
		[getSnapTargets, snapConfig]
	);

	// Auto-scroll timeline when playing
	useEffect(() => {
		if (isPlaying && containerRef.current) {
			const scrollPos = currentTime * zoomLevel - containerRef.current.clientWidth / 2;
			containerRef.current.scrollTo({ behavior: "auto", left: Math.max(0, scrollPos) });
		}
	}, [currentTime, isPlaying, zoomLevel]);

	// Handle playhead dragging
	useEffect(() => {
		if (!isDraggingPlayhead) {
			return;
		}

		const handleMouseMove = (e: globalThis.MouseEvent) => {
			if (!containerRef.current) {
				return;
			}
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
	const handleTimelineMouseDown = useCallback(
		(e: ReactMouseEvent<HTMLDivElement>) => {
			if (!containerRef.current) {
				return;
			}
			// Don't interfere with segment interactions
			if ((e.target as HTMLElement).closest("[data-segment]")) {
				return;
			}

			const rect = containerRef.current.getBoundingClientRect();
			const x = e.clientX - rect.left + containerRef.current.scrollLeft;
			const time = Math.max(0, Math.min(totalDuration, x / zoomLevel));
			onSeek(time);
			setIsDraggingPlayhead(true);
			setHoverTime(null); // Hide hover indicator while dragging
		},
		[onSeek, totalDuration, zoomLevel]
	);

	// Track hover position for preview indicator
	const handleTimelineMouseMove = useCallback(
		(e: ReactMouseEvent<HTMLDivElement>) => {
			if (isDraggingPlayhead || !containerRef.current) {
				return;
			}
			const rect = containerRef.current.getBoundingClientRect();
			const x = e.clientX - rect.left + containerRef.current.scrollLeft;
			const time = Math.max(0, Math.min(totalDuration, x / zoomLevel));
			setHoverTime(time);
		},
		[isDraggingPlayhead, totalDuration, zoomLevel]
	);

	const handleTimelineMouseLeave = useCallback(() => {
		if (!isDraggingPlayhead) {
			setHoverTime(null);
		}
	}, [isDraggingPlayhead]);

	// Ruler mouse handlers (uses timeline's scroll position for calculation)
	const handleRulerMouseDown = useCallback(
		(e: ReactMouseEvent<HTMLDivElement>) => {
			if (!containerRef.current) {
				return;
			}
			const rect = e.currentTarget.getBoundingClientRect();
			const x = e.clientX - rect.left + containerRef.current.scrollLeft;
			const time = Math.max(0, Math.min(totalDuration, x / zoomLevel));
			onSeek(time);
			setIsDraggingPlayhead(true);
			setHoverTime(null);
		},
		[onSeek, totalDuration, zoomLevel]
	);

	const handleRulerMouseMove = useCallback(
		(e: ReactMouseEvent<HTMLDivElement>) => {
			if (isDraggingPlayhead || !containerRef.current) {
				return;
			}
			const rect = e.currentTarget.getBoundingClientRect();
			const x = e.clientX - rect.left + containerRef.current.scrollLeft;
			const time = Math.max(0, Math.min(totalDuration, x / zoomLevel));
			setHoverTime(time);
		},
		[isDraggingPlayhead, totalDuration, zoomLevel]
	);

	const handleRulerMouseLeave = useCallback(() => {
		if (!isDraggingPlayhead) {
			setHoverTime(null);
		}
	}, [isDraggingPlayhead]);

	const handleRangeChange = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			setZoomLevel(Number(e.target.value));
		},
		[setZoomLevel]
	);

	const handleSpeakerDragStart = useCallback((e: DragEvent, index: number) => {
		setDraggedSpeakerIndex(index);
		e.dataTransfer.effectAllowed = "move";
	}, []);

	const handleDragOver = useCallback((e: DragEvent) => {
		e.preventDefault();
	}, []);

	const handleDrop = useCallback(
		(e: DragEvent, index: number) => {
			e.preventDefault();
			if (draggedSpeakerIndex !== null && draggedSpeakerIndex !== index) {
				onReorderSpeakers(draggedSpeakerIndex, index);
			}
			setDraggedSpeakerIndex(null);
		},
		[draggedSpeakerIndex, onReorderSpeakers]
	);

	// Generate ruler markers
	const rulerMarkers: number[] = [];
	let step = 10;
	if (zoomLevel > 50) {
		step = 1;
	} else if (zoomLevel > 20) {
		step = 5;
	}
	for (let i = 0; i <= totalDuration; i += step) {
		rulerMarkers.push(i);
	}
	const gridLineTimes = Array.from(
		{ length: Math.ceil(totalDuration / gridSnapInterval) + 1 },
		(_, i) => i * gridSnapInterval
	);

	// Close menus on click outside
	useEffect(() => {
		const closeMenu = () => {
			setActiveMenuSpeakerId(null);
			setContextMenu(null);
			setAssignSpeakerMenuOpen(false);
		};
		if (activeMenuSpeakerId || contextMenu) {
			window.addEventListener("click", closeMenu);
		}
		return () => window.removeEventListener("click", closeMenu);
	}, [activeMenuSpeakerId, contextMenu]);

	// Handle right-click on segment
	const handleContextMenu = useCallback((e: ReactMouseEvent, segmentId: string) => {
		e.preventDefault();
		e.stopPropagation();
		setContextMenu({
			segmentId,
			x: e.clientX,
			y: e.clientY,
		});
		setAssignSpeakerMenuOpen(false);
	}, []);

	// Handle segment dragging (edges and full move)
	useEffect(() => {
		if (!dragState) {
			return;
		}

		const handleMouseMove = (e: globalThis.MouseEvent) => {
			if (!(containerRef.current && dragState)) {
				return;
			}

			const rect = containerRef.current.getBoundingClientRect();
			const { scrollLeft } = containerRef.current;
			const mouseX = e.clientX - rect.left + scrollLeft;
			const deltaX = mouseX - dragState.initialX;
			const deltaTime = deltaX / zoomLevel;

			const relativeX = e.clientX - rect.left;
			const containerWidth = rect.width;

			scheduleTimelineAutoScroll({
				autoScrollRef,
				containerRef,
				containerWidth,
				relativeX,
			});

			const segment = segments.find((s) => s.id === dragState.segmentId);
			if (!segment) {
				return;
			}

			const { guides, updates } = getSegmentDragUpdate({
				deltaTime,
				dragState,
				gridSnap,
				performEdgeSnap,
				performSnap,
				segment,
			});

			if (updates) {
				onUpdateSegment(segment.id, updates);
			}
			setSnapGuides(guides);
		};

		const handleMouseUp = () => {
			setDragState(null);
			setSnapGuides([]); // Clear guides when done dragging
			document.body.style.cursor = "default";
			// Cancel any auto-scroll animation
			cancelTimelineAutoScroll(autoScrollRef);
		};

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);

		document.body.style.cursor = getDragCursor(dragState.mode);

		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, [dragState, segments, zoomLevel, onUpdateSegment, gridSnap, performEdgeSnap, performSnap]);

	const handleSegmentDragStart = useCallback(
		(e: ReactMouseEvent, segmentId: string, mode: DragMode, segment: Segment) => {
			e.stopPropagation();
			if (!containerRef.current) {
				return;
			}

			const rect = containerRef.current.getBoundingClientRect();
			const { scrollLeft } = containerRef.current;
			const mouseX = e.clientX - rect.left + scrollLeft;

			setDragState({
				initialEndTime: parseTime(segment.endTime),
				initialStartTime: parseTime(segment.startTime),
				initialX: mouseX,
				mode,
				segmentId,
			});
		},
		[]
	);

	const toggleGridSnap = useCallback(() => {
		setGridSnap((current) => !current);
	}, []);

	const toggleDragLineSnap = useCallback(() => {
		setDragLineSnap((current) => !current);
	}, []);

	const handlePlaybackSpeedChange = useCallback(
		(value: string | null) => {
			if (!value) {
				return;
			}
			setPlaybackSpeed(Number(value) as PlaybackSpeed);
		},
		[setPlaybackSpeed]
	);

	const handleAddSegmentAtCurrentTime = useCallback(() => {
		onAddSegment(currentTime);
	}, [currentTime, onAddSegment]);

	const handleTrackKeyDown = useCallback(
		(e: KeyboardEvent<HTMLDivElement>) => {
			if (e.key === " ") {
				e.preventDefault();
				onTogglePlay();
			}
		},
		[onTogglePlay]
	);

	const closeContextMenu = useCallback(() => {
		setContextMenu(null);
	}, []);

	return (
		<div className="flex h-full select-none flex-col bg-white">
			{/* Timeline Controls Toolbar */}
			<div className="z-20 flex h-12 shrink-0 items-center justify-between gap-4 border-slate-200 border-b bg-white px-4">
				{/* Left: Snap Controls */}
				<div className="flex shrink-0 items-center gap-2">
					{/* Grid Snap Toggle */}
					<button
						className={cn(
							"flex items-center gap-1.5 rounded p-1.5 font-medium text-xs transition-colors",
							gridSnap
								? "bg-blue-100 text-blue-700 hover:bg-blue-200"
								: "text-slate-500 hover:bg-slate-100"
						)}
						onClick={toggleGridSnap}
						title={`Grid snap: ${gridSnap ? "ON" : "OFF"} (${gridSnapInterval}s intervals)`}
						type="button"
					>
						<Grid3X3 size={14} />
						<span className="hidden sm:inline">Grid</span>
					</button>

					{/* Edge Snap Toggle */}
					<button
						className={cn(
							"flex items-center gap-1.5 rounded p-1.5 font-medium text-xs transition-colors",
							dragLineSnap
								? "bg-purple-100 text-purple-700 hover:bg-purple-200"
								: "text-slate-500 hover:bg-slate-100"
						)}
						onClick={toggleDragLineSnap}
						title={`Edge snap: ${dragLineSnap ? "ON" : "OFF"} - Snap to other segment edges`}
						type="button"
					>
						<Magnet size={14} />
						<span className="hidden sm:inline">Edges</span>
					</button>

					{isPlaying && !autoFollowEnabled && (
						<button
							className="flex items-center gap-1.5 rounded bg-red-100 p-1.5 font-medium text-red-700 text-xs transition-colors hover:bg-red-200"
							onClick={snapToPlayhead}
							title="Resume following the playhead"
							type="button"
						>
							<Target size={14} />
							<span className="hidden sm:inline">Resume follow</span>
						</button>
					)}

					<button
						className={cn(
							"inline-flex items-center gap-1.5 rounded px-2 py-1 font-medium text-xs transition-colors",
							closeableGapCount > 0
								? "bg-slate-900 text-white hover:bg-slate-800"
								: "cursor-not-allowed bg-slate-100 text-slate-400"
						)}
						disabled={closeableGapCount === 0}
						onClick={onCloseTimelineGaps}
						title={
							closeableGapCount > 0
								? `Shift transcript segment timings earlier across ${closeableGapCount} silence gap${closeableGapCount === 1 ? "" : "s"}. The media file is unchanged.`
								: "No transcript silence gaps of 0.5s or longer."
						}
						type="button"
					>
						<Scissors size={13} />
						<span className="hidden md:inline">Close gaps</span>
					</button>

					<span
						className="hidden rounded bg-slate-50 px-2 py-1 font-medium text-slate-500 text-xs lg:inline-flex"
						title="Detected transcript gaps where no segment occupies the timeline."
					>
						{silenceGaps.length === 0
							? "0 gaps"
							: `${silenceGaps.length} gaps / ${formatGapDuration(totalGapDuration)}`}
					</span>
				</div>

				{/* Center: Playback Controls */}
				<div className="flex shrink-0 items-center gap-3">
					<Select onValueChange={handlePlaybackSpeedChange} value={playbackSpeed.toString()}>
						<SelectTrigger className="h-7 w-[70px] border-slate-200 text-xs">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{PLAYBACK_SPEEDS.map((speed) => (
								<SelectItem className="text-xs" key={speed} value={speed.toString()}>
									{speed}x
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<button
						className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white shadow-md transition-all hover:scale-105 hover:bg-slate-800"
						onClick={onTogglePlay}
						type="button"
					>
						{isPlaying ? (
							<Pause fill="currentColor" size={14} />
						) : (
							<Play className="ml-0.5" fill="currentColor" size={14} />
						)}
					</button>
					<button
						className="whitespace-nowrap font-medium text-blue-600 text-xs hover:text-blue-700 hover:underline"
						onClick={handleAddSegmentAtCurrentTime}
						type="button"
					>
						Add segment
					</button>
				</div>

				{/* Right: Zoom and Search */}
				<div className="flex shrink-0 items-center gap-3">
					<div className="group flex items-center gap-2">
						<ZoomOut className="text-slate-400" size={14} />
						<input
							className="h-1 w-20 cursor-pointer appearance-none rounded-lg bg-slate-200 transition-all [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 hover:[&::-webkit-slider-thumb]:scale-110"
							max={ZOOM.MAX}
							min={ZOOM.MIN}
							onChange={handleRangeChange}
							type="range"
							value={zoomLevel}
						/>
						<ZoomIn className="text-slate-400" size={14} />
					</div>
					<button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" type="button">
						<Search size={16} />
					</button>
				</div>
			</div>

			{/* Tracks Area */}
			<div className="flex flex-1 flex-col overflow-hidden">
				{/* Fixed Headers Row */}
				<div className="flex h-8 shrink-0 border-slate-200 border-b">
					{/* Speakers Header */}
					<div className="z-10 flex w-64 shrink-0 items-center border-slate-200 border-r bg-slate-50 px-4 font-semibold text-slate-500 text-xs">
						<div className="flex-1">Speakers</div>
						<Plus className="cursor-pointer hover:text-blue-600" size={14} />
					</div>
					{/* Ruler Header */}
					<div
						aria-label="Timeline ruler"
						aria-valuemax={totalDuration}
						aria-valuemin={0}
						aria-valuenow={currentTime}
						className="relative flex-1 cursor-crosshair overflow-x-hidden bg-slate-50"
						onMouseDown={handleRulerMouseDown}
						onMouseLeave={handleRulerMouseLeave}
						onMouseMove={handleRulerMouseMove}
						ref={rulerRef}
						role="slider"
						tabIndex={0}
					>
						<div className="relative h-full" style={{ width: `${timelineWidth}px` }}>
							{rulerMarkers.map((time) => (
								<div
									className="pointer-events-none absolute top-0 bottom-0 flex select-none items-end border-slate-300 border-l pb-1 pl-1 font-mono text-[10px] text-slate-400"
									key={time}
									style={{ left: `${time * zoomLevel}px` }}
								>
									{formatTime(time)}
								</div>
							))}

							{/* Hover Preview Indicator in Ruler */}
							{hoverTime !== null && !isDraggingPlayhead && (
								<div
									className="pointer-events-none absolute top-0 bottom-0"
									style={{ transform: `translateX(${hoverTime * zoomLevel}px)` }}
								>
									<div className="-ml-[5px] h-0 w-0 border-t-[6px] border-t-red-300 border-r-[5px] border-r-transparent border-l-[5px] border-l-transparent" />
									<div className="-mt-[6px] h-full w-px bg-red-300" />
								</div>
							)}

							{/* Playhead Indicator in Ruler */}
							<div
								className="pointer-events-none absolute top-0 bottom-0"
								style={{ transform: `translateX(${currentTime * zoomLevel}px)` }}
							>
								<div className="-ml-[5px] h-0 w-0 border-t-[6px] border-t-red-500 border-r-[5px] border-r-transparent border-l-[5px] border-l-transparent" />
								<div className="-mt-[6px] h-full w-px bg-red-500" />
							</div>
						</div>
					</div>
				</div>

				{/* Scrollable Content Area */}
				<div
					className="flex flex-1 overflow-y-auto"
					onScroll={handleUserScroll}
					ref={scrollContainerRef}
				>
					{/* Speakers Column */}
					<ul className="z-10 w-64 shrink-0 border-slate-200 border-r bg-white shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
						{speakers.map((speaker, index) => (
							<SpeakerRow
								activeMenuSpeakerId={activeMenuSpeakerId}
								draggedSpeakerIndex={draggedSpeakerIndex}
								editingSpeakerId={editingSpeakerId}
								index={index}
								key={speaker.id}
								onCycleSpeakerColor={cycleSpeakerColor}
								onDeleteSpeaker={onDeleteSpeaker}
								onDragOver={handleDragOver}
								onDragStart={handleSpeakerDragStart}
								onDrop={handleDrop}
								onMergeSpeakers={onMergeSpeakers}
								onSetActiveMenuSpeakerId={setActiveMenuSpeakerId}
								onSetEditingSpeakerId={setEditingSpeakerId}
								onUpdateSpeaker={onUpdateSpeaker}
								segmentCount={segments.filter((segment) => segment.speakerId === speaker.id).length}
								speaker={speaker}
								speakers={speakers}
							/>
						))}
					</ul>

					{/* Timeline Tracks Column */}
					<div
						aria-label="Timeline tracks"
						aria-valuemax={totalDuration}
						aria-valuemin={0}
						aria-valuenow={currentTime}
						className="relative flex-1 cursor-crosshair overflow-x-auto overflow-y-hidden bg-slate-50/50"
						onKeyDown={handleTrackKeyDown}
						onMouseDown={handleTimelineMouseDown}
						onMouseLeave={handleTimelineMouseLeave}
						onMouseMove={handleTimelineMouseMove}
						onScroll={handleTimelineScroll}
						ref={containerRef}
						role="slider"
						style={{ minHeight: `${trackHeight}px` }}
						tabIndex={0}
					>
						<div
							className="relative"
							style={{
								height: `${trackHeight}px`,
								width: `${Math.max(100, totalDuration * zoomLevel + 500)}px`,
							}}
						>
							{/* Grid Lines (visual guides for snap intervals) */}
							{gridSnap && zoomLevel > 20 && (
								<div className="pointer-events-none absolute top-0 right-0 bottom-0 left-0">
									{gridLineTimes.map((time) => {
										const isMainLine = time % 1 === 0; // Full second marks
										return (
											<div
												className={cn(
													"absolute top-0 bottom-0 w-px",
													isMainLine ? "bg-slate-300" : "bg-slate-200"
												)}
												key={`grid-${time}`}
												style={{ left: `${time * zoomLevel}px` }}
											/>
										);
									})}
								</div>
							)}

							{waveformSvgPath && totalDuration > 0 && (
								<div
									aria-hidden="true"
									className="pointer-events-none absolute top-0 bottom-0 left-0 z-0 opacity-45"
									style={{ width: `${Math.max(1, totalDuration * zoomLevel)}px` }}
								>
									<svg
										aria-hidden="true"
										className="h-full w-full text-slate-400"
										preserveAspectRatio="none"
										viewBox="0 0 1000 100"
									>
										<path
											d={waveformSvgPath}
											fill="none"
											stroke="currentColor"
											strokeWidth="1"
											vectorEffect="non-scaling-stroke"
										/>
									</svg>
								</div>
							)}

							{silenceGaps.map((gap) => {
								const width = Math.max(1, gap.duration * zoomLevel);
								return (
									<div
										className="pointer-events-none absolute top-0 bottom-0 border-slate-300/70 border-x bg-white/55"
										key={gap.id}
										style={{
											left: `${gap.start * zoomLevel}px`,
											width: `${width}px`,
										}}
										title={`${formatGapDuration(gap.duration)} silence gap`}
									>
										{width > 46 && (
											<div className="sticky top-1 ml-1 inline-flex rounded bg-white/90 px-1.5 py-0.5 font-medium text-[10px] text-slate-500 shadow-sm">
												{formatGapDuration(gap.duration)}
											</div>
										)}
									</div>
								);
							})}

							{/* Hover Preview Indicator (ghost playhead) */}
							{hoverTime !== null && !isDraggingPlayhead && (
								<div
									className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-red-300"
									style={{
										transform: `translateX(${hoverTime * zoomLevel}px)`,
									}}
								>
									<div className="-mt-[1px] -ml-[3px] h-2 w-2 rounded-full bg-red-300" />
									<div className="absolute top-1 left-2 whitespace-nowrap rounded bg-slate-800/80 px-1 py-0.5 font-mono text-[9px] text-white">
										{formatTime(hoverTime)}
									</div>
								</div>
							)}

							{/* Playhead */}
							<div
								className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-red-500"
								style={{
									transform: `translateX(${currentTime * zoomLevel}px)`,
								}}
							>
								{/* Playhead handle */}
								<div className="-mt-[1px] -ml-[5px] h-3 w-3 rounded-full bg-red-500 shadow-md" />
							</div>

							{/* Snap Guide Lines */}
							{snapGuides.map((guideTime) => (
								<div
									className="pointer-events-none absolute top-0 bottom-0 z-25 w-px bg-purple-500"
									key={`guide-${guideTime}`}
									style={{
										transform: `translateX(${guideTime * zoomLevel}px)`,
									}}
								>
									<div className="absolute top-0 left-1/2 -translate-x-1/2 rounded-b bg-purple-500 px-1.5 py-0.5 font-mono text-[9px] text-white">
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
											className="group/track relative h-24 border-slate-200 border-b transition-colors hover:bg-slate-100/30"
											key={speaker.id}
										>
											{speakerSegments.map((segment) => (
												<TimelineSegmentBlock
													currentTime={currentTime}
													fallbackBars={waveformHeights[segment.id] ?? []}
													isDragging={dragState?.segmentId === segment.id}
													isSelected={selectedSegmentId === segment.id}
													key={segment.id}
													onContextMenu={handleContextMenu}
													onDragStart={handleSegmentDragStart}
													onSeek={onSeek}
													onSegmentClick={handleSegmentClick}
													segment={segment}
													speaker={speaker}
													totalDuration={totalDuration}
													waveformPeaks={waveformPeaks}
													zoomLevel={zoomLevel}
												/>
											))}
										</div>
									);
								})}
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Segment Context Menu */}
			{contextMenu ? (
				<SegmentContextMenu
					assignSpeakerMenuOpen={assignSpeakerMenuOpen}
					contextMenu={contextMenu}
					onAddSegment={onAddSegment}
					onClose={closeContextMenu}
					onDeleteSegment={onDeleteSegment}
					onSetAssignSpeakerMenuOpen={setAssignSpeakerMenuOpen}
					onUpdateSegment={onUpdateSegment}
					segments={segments}
					speakers={speakers}
				/>
			) : null}
		</div>
	);
}
