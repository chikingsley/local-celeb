import { Check } from "lucide-react";
import type { ChangeEvent, KeyboardEvent, MouseEvent, ReactNode, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseTime } from "@/domain/playback/playback-utils";
import type { Segment, Speaker } from "@/domain/transcript/types";
import {
	buildWordIndex,
	findWordAtCharPositionFast,
	findWordAtTimeFast,
} from "@/domain/transcript/word-index";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/player-store";

interface SearchMatch {
	endIndex: number;
	segmentId: string;
	startIndex: number;
}

interface EditorProps {
	currentMatchIndex?: number;
	currentTime: number;
	onProgrammaticScroll?: () => void; // Called before programmatic scroll to let parent know
	onSeek?: (time: number) => void;
	onSelectSegment: (id: string) => void;
	onUpdateSegment: (id: string, updates: Partial<Segment>) => void;
	scrollContainerRef?: RefObject<HTMLDivElement | null>; // The scrollable container for auto-scroll
	searchMatches?: SearchMatch[];
	segments: Segment[];
	selectedSegmentId: string | null;
	speakers: Speaker[];
}

interface HighlightRange {
	end: number;
	start: number;
	type: "search" | "search-current" | "playback";
}

/**
 * Renders text with highlighted search matches and playback word
 * All text is transparent - only the highlight backgrounds are visible
 * This layer sits behind a transparent-background textarea
 */
function HighlightedText({
	text,
	matches,
	currentMatchIndex,
	allMatches,
	segmentId,
	playbackWordRange,
}: {
	text: string;
	matches: { startIndex: number; endIndex: number }[];
	currentMatchIndex: number;
	allMatches: SearchMatch[];
	segmentId: string;
	playbackWordRange?: { start: number; end: number } | null;
}) {
	// Combine all highlights into a single sorted list
	const highlights: HighlightRange[] = [];

	// Add search matches
	for (const match of matches) {
		const globalMatchIdx = allMatches.findIndex(
			(m) =>
				m.segmentId === segmentId &&
				m.startIndex === match.startIndex &&
				m.endIndex === match.endIndex
		);
		const isCurrentMatch = globalMatchIdx === currentMatchIndex;
		highlights.push({
			end: match.endIndex,
			start: match.startIndex,
			type: isCurrentMatch ? "search-current" : "search",
		});
	}

	// Add playback word highlight
	if (playbackWordRange) {
		highlights.push({
			end: playbackWordRange.end,
			start: playbackWordRange.start,
			type: "playback",
		});
	}

	if (highlights.length === 0) {
		return <span className="whitespace-pre-wrap text-transparent">{text}</span>;
	}

	// Sort by start index
	highlights.sort((a, b) => a.start - b.start);

	const parts: ReactNode[] = [];
	let lastIndex = 0;

	for (const hl of highlights) {
		// Add text before highlight (transparent)
		if (hl.start > lastIndex) {
			parts.push(
				<span
					className="whitespace-pre-wrap text-transparent"
					key={`text-${lastIndex}-${hl.start}`}
				>
					{text.slice(lastIndex, hl.start)}
				</span>
			);
		}

		// Skip if overlapping with previous
		if (hl.start < lastIndex) {
			continue;
		}

		// Add highlighted text
		let bgClass = "bg-yellow-200";
		if (hl.type === "playback") {
			bgClass = "bg-blue-200 underline decoration-blue-500 decoration-2";
		} else if (hl.type === "search-current") {
			bgClass = "bg-orange-300";
		}

		parts.push(
			<mark
				className={cn("rounded-sm text-transparent", bgClass)}
				key={`hl-${hl.start}-${hl.end}-${hl.type}`}
			>
				{text.slice(hl.start, hl.end)}
			</mark>
		);

		lastIndex = hl.end;
	}

	// Add remaining text (transparent)
	if (lastIndex < text.length) {
		parts.push(
			<span className="whitespace-pre-wrap text-transparent" key="text-end">
				{text.slice(lastIndex)}
			</span>
		);
	}

	return <>{parts}</>;
}

interface SpeakerOptionButtonProps {
	isCurrent: boolean;
	onAssignSpeaker: (speakerId: string) => void;
	speaker: Speaker;
}

function SpeakerOptionButton({ speaker, isCurrent, onAssignSpeaker }: SpeakerOptionButtonProps) {
	const handleClick = useCallback(() => {
		onAssignSpeaker(speaker.id);
	}, [onAssignSpeaker, speaker.id]);

	return (
		<button
			className="group/item flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-blue-50"
			onClick={handleClick}
			type="button"
		>
			<div className="flex items-center gap-3">
				<div
					className="flex h-6 w-6 items-center justify-center rounded-full font-bold text-[10px] text-white"
					style={{ backgroundColor: speaker.color }}
				>
					{speaker.name.charAt(0)}
				</div>
				<span
					className={cn("text-sm", isCurrent ? "font-semibold text-blue-700" : "text-slate-700")}
				>
					{speaker.name}
				</span>
			</div>
			{isCurrent ? <Check className="text-blue-600" size={14} /> : null}
		</button>
	);
}

interface SegmentEditorRowProps {
	activeRef: RefObject<HTMLDivElement | null>;
	activeSpeakerDropdown: string | null;
	adjustHeight: (id: string) => void;
	currentMatchIndex: number;
	currentPlaybackWord: { segmentId: string; start: number; end: number } | null;
	currentSpeaker?: Speaker;
	isActive: boolean;
	isSelected: boolean;
	onTextareaClick: (segment: Segment, event: MouseEvent<HTMLTextAreaElement>) => void;
	onUpdateSegment: (id: string, updates: Partial<Segment>) => void;
	searchMatches: SearchMatch[];
	segment: Segment;
	segmentMatches: { startIndex: number; endIndex: number }[];
	segmentRefs: RefObject<Record<string, HTMLDivElement | null>>;
	setActiveSpeakerDropdown: (id: string | null) => void;
	speakers: Speaker[];
	textareaRefs: RefObject<Record<string, HTMLTextAreaElement | null>>;
}

function SegmentEditorRow({
	segment,
	currentSpeaker,
	speakers,
	isActive,
	isSelected,
	segmentMatches,
	searchMatches,
	currentMatchIndex,
	currentPlaybackWord,
	activeSpeakerDropdown,
	segmentRefs,
	textareaRefs,
	activeRef,
	adjustHeight,
	setActiveSpeakerDropdown,
	onUpdateSegment,
	onTextareaClick,
}: SegmentEditorRowProps) {
	const hasHighlights = segmentMatches.length > 0 || currentPlaybackWord?.segmentId === segment.id;
	const isSpeakerDropdownOpen = activeSpeakerDropdown === segment.id;
	const setSegmentRef = useCallback(
		(element: HTMLDivElement | null) => {
			segmentRefs.current[segment.id] = element;
			if (isActive) {
				activeRef.current = element;
			}
		},
		[activeRef, isActive, segment.id, segmentRefs]
	);
	const setTextareaRef = useCallback(
		(element: HTMLTextAreaElement | null) => {
			textareaRefs.current[segment.id] = element;
		},
		[segment.id, textareaRefs]
	);
	const handleSpeakerButtonClick = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			event.stopPropagation();
			setActiveSpeakerDropdown(isSpeakerDropdownOpen ? null : segment.id);
		},
		[isSpeakerDropdownOpen, segment.id, setActiveSpeakerDropdown]
	);
	const handleDropdownClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
		event.stopPropagation();
	}, []);
	const handleDropdownKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
		event.stopPropagation();
	}, []);
	const handleAssignSpeaker = useCallback(
		(speakerId: string) => {
			onUpdateSegment(segment.id, { speakerId });
			setActiveSpeakerDropdown(null);
		},
		[onUpdateSegment, segment.id, setActiveSpeakerDropdown]
	);
	const handleTextChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			onUpdateSegment(segment.id, {
				text: event.target.value,
				wordsDirty: true,
				wordTimingStatus: "dirty",
			});
			adjustHeight(segment.id);
		},
		[adjustHeight, onUpdateSegment, segment.id]
	);
	const handleTextareaClick = useCallback(
		(event: MouseEvent<HTMLTextAreaElement>) => {
			onTextareaClick(segment, event);
		},
		[onTextareaClick, segment]
	);

	return (
		<div
			className={cn(
				"group relative flex gap-6 border-l-4 border-l-transparent p-6 transition-all duration-200",
				isSelected && "border-l-blue-500 bg-blue-50 shadow-sm",
				!isSelected && "hover:border-l-slate-300 hover:bg-slate-50",
				isActive && !isSelected && "border-l-amber-400 bg-amber-50/50",
				isActive && isSelected && "border-l-blue-500 bg-blue-50 ring-2 ring-blue-200"
			)}
			ref={setSegmentRef}
		>
			<div className="relative flex w-40 flex-shrink-0 flex-col gap-2 pt-1">
				<button
					className="-ml-1 flex w-fit items-center gap-3 rounded-lg p-1 transition-colors hover:bg-slate-200/50"
					onClick={handleSpeakerButtonClick}
					type="button"
				>
					<div
						className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-bold text-white text-xs shadow-sm"
						style={{ backgroundColor: currentSpeaker?.color }}
					>
						{currentSpeaker ? currentSpeaker.name.charAt(0) : "?"}
					</div>
					<span
						className="max-w-[90px] truncate font-semibold text-slate-700 text-sm"
						title={currentSpeaker?.name}
					>
						{currentSpeaker?.name ?? segment.speakerId}
					</span>
				</button>

				{isSpeakerDropdownOpen ? (
					<div
						className="absolute top-10 left-0 z-50 w-56 overflow-hidden rounded-lg border border-slate-100 bg-white shadow-xl"
						onClick={handleDropdownClick}
						onKeyDown={handleDropdownKeyDown}
						role="menu"
					>
						<div className="border-slate-100 border-b bg-slate-50 px-3 py-2 font-semibold text-slate-500 text-xs">
							Assign Speaker
						</div>
						<div className="max-h-64 overflow-y-auto">
							{speakers.map((speaker) => (
								<SpeakerOptionButton
									isCurrent={speaker.id === currentSpeaker?.id}
									key={speaker.id}
									onAssignSpeaker={handleAssignSpeaker}
									speaker={speaker}
								/>
							))}
						</div>
					</div>
				) : null}

				<div className="pl-11 font-mono text-slate-400 text-xs">{segment.startTime}</div>
			</div>

			<div className="relative flex-grow overflow-hidden">
				{hasHighlights ? (
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 select-none font-serif text-lg text-transparent leading-relaxed"
					>
						<HighlightedText
							allMatches={searchMatches}
							currentMatchIndex={currentMatchIndex}
							matches={segmentMatches}
							playbackWordRange={
								currentPlaybackWord?.segmentId === segment.id
									? { end: currentPlaybackWord.end, start: currentPlaybackWord.start }
									: null
							}
							segmentId={segment.id}
							text={segment.text}
						/>
					</div>
				) : null}
				<textarea
					className="relative z-10 w-full resize-none overflow-hidden break-words border-none bg-transparent p-0 font-serif text-lg text-slate-800 leading-relaxed placeholder-slate-300 caret-slate-800 outline-none focus:ring-0"
					onChange={handleTextChange}
					onClick={handleTextareaClick}
					placeholder="Type here..."
					ref={setTextareaRef}
					rows={1}
					spellCheck={false}
					value={segment.text}
				/>
			</div>
		</div>
	);
}

export function Editor({
	segments,
	speakers,
	selectedSegmentId,
	onSelectSegment,
	onUpdateSegment,
	currentTime,
	searchMatches = [],
	currentMatchIndex = 0,
	onSeek,
	onProgrammaticScroll,
	scrollContainerRef,
}: EditorProps) {
	const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
	const segmentRefs = useRef<Record<string, HTMLDivElement | null>>({});
	const containerRef = useRef<HTMLDivElement>(null);
	const activeRef = useRef<HTMLDivElement>(null);

	// State for speaker selector popover
	const [activeSpeakerDropdown, setActiveSpeakerDropdown] = useState<string | null>(null);

	// Get state and scroll functions from store
	const scrollToTime = usePlayerStore((s) => s.scrollToTime);
	const registerScrollToSegment = usePlayerStore((s) => s.registerScrollToSegment);
	const isPlaying = usePlayerStore((s) => s.isPlaying);
	const autoFollowEnabled = usePlayerStore((s) => s.autoFollowEnabled);
	const setAutoFollow = usePlayerStore((s) => s.setAutoFollow);

	// Build word index from segments (with interpolation for 100% coverage)
	const wordIndex = useMemo(() => buildWordIndex(segments), [segments]);

	// Register scroll-to-segment callback
	useEffect(() => {
		const scrollToSegment = (segmentId: string) => {
			const el = segmentRefs.current[segmentId];
			if (el) {
				el.scrollIntoView({ behavior: "smooth", block: "center" });
			}
		};
		registerScrollToSegment(scrollToSegment);
	}, [registerScrollToSegment]);

	// Calculate current playback word for highlighting - O(log n) with word index
	const currentPlaybackWord = useMemo((): {
		segmentId: string;
		start: number;
		end: number;
	} | null => {
		const word = findWordAtTimeFast(wordIndex, currentTime);
		if (word) {
			return {
				end: word.charEnd,
				segmentId: word.segmentId,
				start: word.charStart,
			};
		}
		return null;
	}, [wordIndex, currentTime]);

	// Track the last scrolled-to segment to avoid redundant scrolls
	const lastScrolledSegmentRef = useRef<string | null>(null);

	// Auto-scroll Editor to keep active segment visible during playback
	useEffect(() => {
		if (!(isPlaying && autoFollowEnabled && currentPlaybackWord)) {
			return;
		}

		const activeSegmentId = currentPlaybackWord.segmentId;

		// Only scroll if we've moved to a different segment
		if (activeSegmentId === lastScrolledSegmentRef.current) {
			return;
		}

		const el = segmentRefs.current[activeSegmentId];
		if (el) {
			// Check if element is already visible in the scroll container
			const container = scrollContainerRef?.current;
			if (container) {
				const containerRect = container.getBoundingClientRect();
				const elRect = el.getBoundingClientRect();

				// If element is outside the visible area, scroll to it
				const isAbove = elRect.top < containerRect.top + 50;
				const isBelow = elRect.bottom > containerRect.bottom - 50;

				if (isAbove || isBelow) {
					// Notify parent this is a programmatic scroll
					onProgrammaticScroll?.();
					el.scrollIntoView({ behavior: "smooth", block: "center" });
				}
			}

			lastScrolledSegmentRef.current = activeSegmentId;
		}
	}, [isPlaying, autoFollowEnabled, currentPlaybackWord, onProgrammaticScroll, scrollContainerRef]);

	const adjustHeight = useCallback((id: string) => {
		const el = textareaRefs.current[id];
		if (el) {
			el.style.height = "auto";
			el.style.height = `${el.scrollHeight}px`;
		}
	}, []);

	useEffect(() => {
		for (const seg of segments) {
			adjustHeight(seg.id);
		}
	}, [segments, adjustHeight]);

	// Click outside to close dropdown
	useEffect(() => {
		const handleClickOutside = () => setActiveSpeakerDropdown(null);
		if (activeSpeakerDropdown) {
			window.addEventListener("click", handleClickOutside);
		}
		return () => window.removeEventListener("click", handleClickOutside);
	}, [activeSpeakerDropdown]);

	const getSpeaker = useCallback(
		(id: string) => speakers.find((speaker) => speaker.id === id) ?? speakers[0],
		[speakers]
	);

	// Get matches for a specific segment
	const getSegmentMatches = useCallback(
		(segmentId: string) => searchMatches.filter((m) => m.segmentId === segmentId),
		[searchMatches]
	);

	// Handle word-level click - seek to the clicked word's timestamp
	const handleTextareaClick = useCallback(
		(segment: Segment, e: MouseEvent<HTMLTextAreaElement>) => {
			onSelectSegment(segment.id);
			const textarea = e.currentTarget;
			// Get cursor position at click
			const cursorPos = textarea.selectionStart;

			// Use word index for fast lookup (includes interpolated words)
			const word = findWordAtCharPositionFast(wordIndex, segment.id, cursorPos);
			if (word) {
				// Seek to word's start time
				onSeek?.(word.start);
				scrollToTime(word.start);
				// Re-enable auto-follow
				setAutoFollow(true);
				return;
			}

			// Fallback: seek to segment start
			const startSec = parseTime(segment.startTime);
			onSeek?.(startSec);
			scrollToTime(startSec);
			// Re-enable auto-follow
			setAutoFollow(true);
		},
		[wordIndex, onSelectSegment, onSeek, scrollToTime, setAutoFollow]
	);

	return (
		<div className="flex min-h-full flex-col gap-0 pb-32" ref={containerRef}>
			{segments.map((segment) => {
				const currentSpeaker = getSpeaker(segment.speakerId);
				const startSec = parseTime(segment.startTime);
				const endSec = parseTime(segment.endTime);
				const isActive = startSec <= currentTime && endSec > currentTime;
				const isSelected = selectedSegmentId === segment.id;
				const segmentMatches = getSegmentMatches(segment.id);

				return (
					<SegmentEditorRow
						activeRef={activeRef}
						activeSpeakerDropdown={activeSpeakerDropdown}
						adjustHeight={adjustHeight}
						currentMatchIndex={currentMatchIndex}
						currentPlaybackWord={currentPlaybackWord}
						currentSpeaker={currentSpeaker}
						isActive={isActive}
						isSelected={isSelected}
						key={segment.id}
						onTextareaClick={handleTextareaClick}
						onUpdateSegment={onUpdateSegment}
						searchMatches={searchMatches}
						segment={segment}
						segmentMatches={segmentMatches}
						segmentRefs={segmentRefs}
						setActiveSpeakerDropdown={setActiveSpeakerDropdown}
						speakers={speakers}
						textareaRefs={textareaRefs}
					/>
				);
			})}

			<div className="flex h-32 items-center justify-center text-slate-300 italic">
				End of transcription
			</div>
		</div>
	);
}
