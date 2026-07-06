import { Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseTime } from "@/lib/playback-utils";
import { cn } from "@/lib/utils";
import { buildWordIndex, findWordAtCharPositionFast, findWordAtTimeFast } from "@/lib/word-index";
import { usePlayerStore } from "@/stores/player-store";
import type { Segment, Speaker } from "@/types";

interface SearchMatch {
	segmentId: string;
	startIndex: number;
	endIndex: number;
}

interface EditorProps {
	segments: Segment[];
	speakers: Speaker[];
	selectedSegmentId: string | null;
	onSelectSegment: (id: string) => void;
	onUpdateSegment: (id: string, updates: Partial<Segment>) => void;
	currentTime: number;
	searchMatches?: SearchMatch[];
	currentMatchIndex?: number;
	onSeek?: (time: number) => void;
	onProgrammaticScroll?: () => void; // Called before programmatic scroll to let parent know
	scrollContainerRef?: React.RefObject<HTMLDivElement | null>; // The scrollable container for auto-scroll
}

interface HighlightRange {
	start: number;
	end: number;
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
			start: match.startIndex,
			end: match.endIndex,
			type: isCurrentMatch ? "search-current" : "search",
		});
	}

	// Add playback word highlight
	if (playbackWordRange) {
		highlights.push({
			start: playbackWordRange.start,
			end: playbackWordRange.end,
			type: "playback",
		});
	}

	if (highlights.length === 0) {
		return <span className="whitespace-pre-wrap text-transparent">{text}</span>;
	}

	// Sort by start index
	highlights.sort((a, b) => a.start - b.start);

	const parts: React.ReactNode[] = [];
	let lastIndex = 0;

	for (const hl of highlights) {
		// Add text before highlight (transparent)
		if (hl.start > lastIndex) {
			parts.push(
				<span
					key={`text-${lastIndex}-${hl.start}`}
					className="whitespace-pre-wrap text-transparent"
				>
					{text.substring(lastIndex, hl.start)}
				</span>
			);
		}

		// Skip if overlapping with previous
		if (hl.start < lastIndex) continue;

		// Add highlighted text
		const bgClass =
			hl.type === "playback"
				? "bg-blue-200 underline decoration-blue-500 decoration-2"
				: hl.type === "search-current"
					? "bg-orange-300"
					: "bg-yellow-200";

		parts.push(
			<mark
				key={`hl-${hl.start}-${hl.end}-${hl.type}`}
				className={cn("rounded-sm text-transparent", bgClass)}
			>
				{text.substring(hl.start, hl.end)}
			</mark>
		);

		lastIndex = hl.end;
	}

	// Add remaining text (transparent)
	if (lastIndex < text.length) {
		parts.push(
			<span key="text-end" className="whitespace-pre-wrap text-transparent">
				{text.substring(lastIndex)}
			</span>
		);
	}

	return <>{parts}</>;
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
				segmentId: word.segmentId,
				start: word.charStart,
				end: word.charEnd,
			};
		}
		return null;
	}, [wordIndex, currentTime]);

	// Track the last scrolled-to segment to avoid redundant scrolls
	const lastScrolledSegmentRef = useRef<string | null>(null);

	// Auto-scroll Editor to keep active segment visible during playback
	useEffect(() => {
		if (!isPlaying || !autoFollowEnabled || !currentPlaybackWord) return;

		const activeSegmentId = currentPlaybackWord.segmentId;

		// Only scroll if we've moved to a different segment
		if (activeSegmentId === lastScrolledSegmentRef.current) return;

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

	const getSpeaker = (id: string) => speakers.find((s) => s.id === id) ?? speakers[0];

	// Get matches for a specific segment
	const getSegmentMatches = useCallback(
		(segmentId: string) => {
			return searchMatches.filter((m) => m.segmentId === segmentId);
		},
		[searchMatches]
	);

	// Handle word-level click - seek to the clicked word's timestamp
	const handleTextareaClick = useCallback(
		(segment: Segment, e: React.MouseEvent<HTMLTextAreaElement>) => {
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
		<div className="flex flex-col gap-0 pb-32 min-h-full" ref={containerRef}>
			{segments.map((segment) => {
				const currentSpeaker = getSpeaker(segment.speakerId);
				const startSec = parseTime(segment.startTime);
				const endSec = parseTime(segment.endTime);
				const isActive = startSec <= currentTime && endSec > currentTime;
				const isSelected = selectedSegmentId === segment.id;
				const segmentMatches = getSegmentMatches(segment.id);
				const hasHighlights =
					segmentMatches.length > 0 || currentPlaybackWord?.segmentId === segment.id;

				return (
					<div
						key={segment.id}
						ref={(el) => {
							segmentRefs.current[segment.id] = el;
							if (isActive) {
								(activeRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
							}
						}}
						className={cn(
							"group relative flex gap-6 p-6 transition-all duration-200 border-l-4 border-l-transparent",
							isSelected && "bg-blue-50 border-l-blue-500 shadow-sm",
							!isSelected && "hover:bg-slate-50 hover:border-l-slate-300",
							isActive && !isSelected && "bg-amber-50/50 border-l-amber-400",
							isActive && isSelected && "bg-blue-50 border-l-blue-500 ring-2 ring-blue-200"
						)}
					>
						{/* Left Column: Speaker Info */}
						<div className="w-40 flex-shrink-0 flex flex-col gap-2 pt-1 relative">
							<button
								type="button"
								className="flex items-center gap-3 p-1 -ml-1 rounded-lg hover:bg-slate-200/50 transition-colors w-fit"
								onClick={(e) => {
									e.stopPropagation();
									setActiveSpeakerDropdown(
										activeSpeakerDropdown === segment.id ? null : segment.id
									);
								}}
							>
								<div
									className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm flex-shrink-0"
									style={{ backgroundColor: currentSpeaker?.color }}
								>
									{currentSpeaker?.name.charAt(0)}
								</div>
								<span
									className="text-sm font-semibold text-slate-700 truncate max-w-[90px]"
									title={currentSpeaker?.name}
								>
									{currentSpeaker?.name}
								</span>
							</button>

							{/* Speaker Dropdown Popover */}
							{activeSpeakerDropdown === segment.id && (
								<div
									role="menu"
									className="absolute top-10 left-0 z-50 w-56 bg-white rounded-lg shadow-xl border border-slate-100 overflow-hidden"
									onClick={(e) => e.stopPropagation()}
									onKeyDown={(e) => e.stopPropagation()}
								>
									<div className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-100">
										Assign Speaker
									</div>
									<div className="max-h-64 overflow-y-auto">
										{speakers.map((s) => (
											<button
												key={s.id}
												type="button"
												className="w-full text-left px-4 py-2.5 hover:bg-blue-50 flex items-center justify-between group/item"
												onClick={() => {
													onUpdateSegment(segment.id, { speakerId: s.id });
													setActiveSpeakerDropdown(null);
												}}
											>
												<div className="flex items-center gap-3">
													<div
														className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
														style={{ backgroundColor: s.color }}
													>
														{s.name.charAt(0)}
													</div>
													<span
														className={cn(
															"text-sm",
															s.id === currentSpeaker?.id
																? "font-semibold text-blue-700"
																: "text-slate-700"
														)}
													>
														{s.name}
													</span>
												</div>
												{s.id === currentSpeaker?.id && (
													<Check size={14} className="text-blue-600" />
												)}
											</button>
										))}
									</div>
								</div>
							)}

							<div className="pl-11 text-xs font-mono text-slate-400">{segment.startTime}</div>
						</div>

						{/* Right Column: Text Content */}
						<div className="flex-grow relative overflow-hidden">
							{/* Highlight Layer - positioned behind textarea */}
							{hasHighlights && (
								<div
									className="absolute inset-0 text-lg leading-relaxed font-serif pointer-events-none text-transparent select-none"
									aria-hidden="true"
								>
									<HighlightedText
										text={segment.text}
										matches={segmentMatches}
										currentMatchIndex={currentMatchIndex}
										allMatches={searchMatches}
										segmentId={segment.id}
										playbackWordRange={
											currentPlaybackWord?.segmentId === segment.id
												? { start: currentPlaybackWord.start, end: currentPlaybackWord.end }
												: null
										}
									/>
								</div>
							)}
							<textarea
								ref={(el) => {
									textareaRefs.current[segment.id] = el;
								}}
								value={segment.text}
								onChange={(e) => {
									// Mark wordsDirty when text changes (timestamps need re-alignment)
									onUpdateSegment(segment.id, {
										text: e.target.value,
										wordsDirty: true,
										wordTimingStatus: "dirty",
									});
									adjustHeight(segment.id);
								}}
								onClick={(e) => handleTextareaClick(segment, e)}
								className="w-full resize-none outline-none border-none text-lg leading-relaxed focus:ring-0 p-0 placeholder-slate-300 font-serif relative z-10 overflow-hidden break-words text-slate-800 bg-transparent caret-slate-800"
								placeholder="Type here..."
								rows={1}
								spellCheck={false}
							/>
						</div>
					</div>
				);
			})}

			<div className="h-32 flex items-center justify-center text-slate-300 italic">
				End of transcription
			</div>
		</div>
	);
}

export default Editor;
