import {
	ALargeSmall,
	CaseSensitive,
	ChevronDown,
	ChevronRight,
	ChevronUp,
	Regex,
	Replace,
	ReplaceAll,
	WholeWord,
	X,
} from "lucide-react";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { parseTime } from "@/domain/playback/playback-utils";
import type { Segment } from "@/domain/transcript/types";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/player-store";

export interface SearchMatch {
	endIndex: number;
	segmentId: string;
	startIndex: number;
	text: string;
}

interface FindReplaceProps {
	initialQuery?: string;
	isOpen: boolean;
	onClose: () => void;
	onMatchesChange?: (matches: SearchMatch[], currentIndex: number, query: string) => void;
	onSelectSegment: (id: string | null) => void;
	onUpdateSegment: (id: string, updates: Partial<Segment>) => void;
	segments: Segment[];
}

const REGEX_SPECIAL_CHARS_PATTERN = /[.*+?^${}()|[\]\\]/g;

export function FindReplace({
	isOpen,
	onClose,
	segments,
	onUpdateSegment,
	onSelectSegment,
	onMatchesChange,
	initialQuery,
}: FindReplaceProps) {
	const [query, setQuery] = useState("");
	const [replaceText, setReplaceText] = useState("");
	const [caseSensitive, setCaseSensitive] = useState(false);
	const [wholeWord, setWholeWord] = useState(false);
	const [useRegex, setUseRegex] = useState(false);
	const [preserveCase, setPreserveCase] = useState(false);
	const [matches, setMatches] = useState<SearchMatch[]>([]);
	const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
	const [regexError, setRegexError] = useState<string | null>(null);
	const [showReplace, setShowReplace] = useState(false);

	// Track if user has started typing (to enable auto-scroll)
	const hasTypedRef = useRef(false);
	const findInputRef = useRef<HTMLInputElement>(null);
	const replaceInputRef = useRef<HTMLInputElement>(null);

	// Get scroll functions from store
	const scrollToTime = usePlayerStore((s) => s.scrollToTime);
	const scrollToSegment = usePlayerStore((s) => s.scrollToSegment);

	// Reset state when dialog opens
	useEffect(() => {
		if (isOpen) {
			hasTypedRef.current = false;
			if (initialQuery) {
				setQuery(initialQuery);
				hasTypedRef.current = true; // Treat initial query as typed
			}
		}
	}, [isOpen, initialQuery]);

	// Focus find input when opened
	useEffect(() => {
		if (isOpen && findInputRef.current) {
			findInputRef.current.focus();
			findInputRef.current.select();
		}
	}, [isOpen]);

	// Notify parent when matches change
	useEffect(() => {
		onMatchesChange?.(matches, currentMatchIndex, query);
	}, [matches, currentMatchIndex, query, onMatchesChange]);

	// Clear matches when closed
	useEffect(() => {
		if (!isOpen) {
			onMatchesChange?.([], 0, "");
		}
	}, [isOpen, onMatchesChange]);

	// Build search pattern
	const buildPattern = useCallback(
		(searchQuery: string): RegExp | null => {
			if (!searchQuery) {
				return null;
			}

			try {
				let pattern = searchQuery;

				if (!useRegex) {
					pattern = pattern.replace(REGEX_SPECIAL_CHARS_PATTERN, "\\$&");
				}

				if (wholeWord) {
					pattern = `\\b${pattern}\\b`;
				}

				const flags = caseSensitive ? "g" : "gi";
				const regex = new RegExp(pattern, flags);
				setRegexError(null);
				return regex;
			} catch (e) {
				setRegexError(e instanceof Error ? e.message : "Invalid regex");
				return null;
			}
		},
		[caseSensitive, wholeWord, useRegex]
	);

	// Navigate to match - scrolls both editor and timeline
	const goToMatch = useCallback(
		(index: number) => {
			if (matches.length === 0) {
				return;
			}

			const wrappedIndex = ((index % matches.length) + matches.length) % matches.length;
			setCurrentMatchIndex(wrappedIndex);

			const match = matches[wrappedIndex];
			if (!match) {
				return;
			}
			const { segmentId } = match;
			onSelectSegment(segmentId);

			// Scroll editor to segment
			scrollToSegment(segmentId);

			// Scroll timeline to segment's time
			const segment = segments.find((candidate) => candidate.id === segmentId);
			if (segment) {
				const startSec = parseTime(segment.startTime);
				scrollToTime(startSec);
			}
		},
		[matches, segments, onSelectSegment, scrollToSegment, scrollToTime]
	);

	// Find all matches
	useEffect(() => {
		if (!query) {
			setMatches([]);
			setCurrentMatchIndex(0);
			return;
		}

		const pattern = buildPattern(query);
		if (!pattern) {
			setMatches([]);
			return;
		}

		const newMatches: SearchMatch[] = [];

		for (const segment of segments) {
			pattern.lastIndex = 0;
			for (const match of segment.text.matchAll(pattern)) {
				const [matchedText] = match;
				const matchIndex = match.index ?? 0;
				newMatches.push({
					endIndex: matchIndex + matchedText.length,
					segmentId: segment.id,
					startIndex: matchIndex,
					text: matchedText,
				});
			}
		}

		setMatches(newMatches);
		setCurrentMatchIndex(0);

		// Auto-scroll to first match while typing (not on initial open)
		// Use requestAnimationFrame to ensure DOM has updated and scroll callbacks are ready
		if (hasTypedRef.current && newMatches.length > 0) {
			requestAnimationFrame(() => {
				const [match] = newMatches;
				if (!match) {
					return;
				}
				const { segmentId } = match;
				onSelectSegment(segmentId);
				scrollToSegment(segmentId);

				const segment = segments.find((candidate) => candidate.id === segmentId);
				if (segment) {
					const startSec = parseTime(segment.startTime);
					scrollToTime(startSec);
				}
			});
		}
	}, [query, segments, buildPattern, onSelectSegment, scrollToSegment, scrollToTime]);

	const goToNextMatch = useCallback(
		() => goToMatch(currentMatchIndex + 1),
		[goToMatch, currentMatchIndex]
	);
	const goToPrevMatch = useCallback(
		() => goToMatch(currentMatchIndex - 1),
		[goToMatch, currentMatchIndex]
	);

	// Apply preserve case transformation
	const applyPreserveCase = useCallback(
		(original: string, replacement: string): string => {
			if (!preserveCase) {
				return replacement;
			}

			// Check if original is all uppercase
			if (original === original.toUpperCase()) {
				return replacement.toUpperCase();
			}
			// Check if original is all lowercase
			if (original === original.toLowerCase()) {
				return replacement.toLowerCase();
			}
			// Check if original is title case (first char uppercase)
			const [firstChar] = original;
			if (firstChar && firstChar === firstChar.toUpperCase()) {
				return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
			}
			return replacement;
		},
		[preserveCase]
	);

	// Replace current match
	const replaceCurrent = useCallback(() => {
		if (matches.length === 0) {
			return;
		}

		const match = matches[currentMatchIndex];
		if (!match) {
			return;
		}
		const segment = segments.find((candidate) => candidate.id === match.segmentId);
		if (!segment) {
			return;
		}

		const replacement = applyPreserveCase(match.text, replaceText);
		const newText =
			segment.text.slice(0, match.startIndex) + replacement + segment.text.slice(match.endIndex);

		onUpdateSegment(match.segmentId, {
			text: newText,
			wordsDirty: true,
			wordTimingStatus: "dirty",
		});
	}, [matches, currentMatchIndex, segments, replaceText, onUpdateSegment, applyPreserveCase]);

	// Replace all matches
	const replaceAllMatches = useCallback(() => {
		if (matches.length === 0 || !query) {
			return;
		}

		const pattern = buildPattern(query);
		if (!pattern) {
			return;
		}

		for (const segment of segments) {
			pattern.lastIndex = 0;
			const newText = segment.text.replace(pattern, (match) =>
				applyPreserveCase(match, replaceText)
			);
			if (newText !== segment.text) {
				onUpdateSegment(segment.id, {
					text: newText,
					wordsDirty: true,
					wordTimingStatus: "dirty",
				});
			}
		}
	}, [matches, query, buildPattern, segments, replaceText, onUpdateSegment, applyPreserveCase]);

	// Handle query input change
	const handleQueryChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
		hasTypedRef.current = true;
		setQuery(e.target.value);
	}, []);

	const handleReplaceTextChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setReplaceText(event.target.value);
	}, []);

	const toggleShowReplace = useCallback(() => {
		setShowReplace((current) => !current);
	}, []);

	const toggleCaseSensitive = useCallback(() => {
		setCaseSensitive((current) => !current);
	}, []);

	const toggleWholeWord = useCallback(() => {
		setWholeWord((current) => !current);
	}, []);

	const toggleUseRegex = useCallback(() => {
		setUseRegex((current) => !current);
	}, []);

	const togglePreserveCase = useCallback(() => {
		setPreserveCase((current) => !current);
	}, []);

	const replaceCurrentAndGoNext = useCallback(() => {
		replaceCurrent();
		goToNextMatch();
	}, [goToNextMatch, replaceCurrent]);

	const isReplaceInputTarget = useCallback(
		(target: EventTarget | null) =>
			showReplace &&
			target instanceof HTMLElement &&
			target.closest("input") === replaceInputRef.current,
		[showReplace]
	);

	const handleEnterKey = useCallback(
		(event: KeyboardEvent) => {
			if (isReplaceInputTarget(event.target)) {
				event.preventDefault();
				if (event.metaKey || event.ctrlKey) {
					replaceAllMatches();
				} else {
					replaceCurrentAndGoNext();
				}
				return;
			}
			if (event.shiftKey) {
				goToPrevMatch();
				return;
			}
			goToNextMatch();
		},
		[goToNextMatch, goToPrevMatch, isReplaceInputTarget, replaceAllMatches, replaceCurrentAndGoNext]
	);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose();
			} else if (event.key === "Enter") {
				handleEnterKey(event);
			} else if (event.key === "F3") {
				event.preventDefault();
				if (event.shiftKey) {
					goToPrevMatch();
				} else {
					goToNextMatch();
				}
			}
		},
		[handleEnterKey, onClose, goToNextMatch, goToPrevMatch]
	);

	useEffect(() => {
		if (!isOpen) {
			return;
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown, isOpen]);

	let matchCountLabel = "";
	if (matches.length > 0) {
		matchCountLabel = `${currentMatchIndex + 1}/${matches.length}`;
	} else if (query) {
		matchCountLabel = "0/0";
	}

	if (!isOpen) {
		return null;
	}

	return (
		<div
			aria-label="Find and replace"
			className="sticky top-2 right-4 z-50 mr-4 ml-auto w-fit rounded-lg border border-slate-200 bg-white shadow-lg"
			role="dialog"
			tabIndex={-1}
		>
			<div className="space-y-2 p-2">
				{/* Find Row */}
				<div className="flex items-center gap-1">
					{/* Expand/Collapse Chevron */}
					<button
						className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
						onClick={toggleShowReplace}
						title={showReplace ? "Hide Replace" : "Show Replace"}
						type="button"
					>
						{showReplace ? (
							<ChevronDown className="h-4 w-4" />
						) : (
							<ChevronRight className="h-4 w-4" />
						)}
					</button>

					{/* Find Input with inline toggle buttons */}
					<div className="relative flex-1">
						<input
							className={cn(
								"w-56 rounded border py-1 pr-20 pl-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500",
								regexError ? "border-red-400" : "border-slate-200"
							)}
							onChange={handleQueryChange}
							placeholder="Find"
							ref={findInputRef}
							type="text"
							value={query}
						/>
						{/* Inline toggle buttons */}
						<div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5">
							<button
								className={cn(
									"rounded p-0.5 transition-colors",
									caseSensitive
										? "bg-blue-100 text-blue-600"
										: "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
								)}
								onClick={toggleCaseSensitive}
								title="Match Case (Aa)"
								type="button"
							>
								<CaseSensitive className="h-4 w-4" />
							</button>
							<button
								className={cn(
									"rounded p-0.5 transition-colors",
									wholeWord
										? "bg-blue-100 text-blue-600"
										: "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
								)}
								onClick={toggleWholeWord}
								title="Match Whole Word (Ab)"
								type="button"
							>
								<WholeWord className="h-4 w-4" />
							</button>
							<button
								className={cn(
									"rounded p-0.5 transition-colors",
									useRegex
										? "bg-blue-100 text-blue-600"
										: "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
								)}
								onClick={toggleUseRegex}
								title="Use Regular Expression (.*)"
								type="button"
							>
								<Regex className="h-4 w-4" />
							</button>
						</div>
						{regexError ? (
							<div className="absolute top-full left-0 z-10 mt-1 rounded border border-red-200 bg-white p-1 text-red-500 text-xs shadow-sm">
								{regexError}
							</div>
						) : null}
					</div>

					{/* Match count */}
					<span className="min-w-[50px] text-center text-slate-500 text-xs">{matchCountLabel}</span>

					{/* Navigation */}
					<button
						className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
						disabled={matches.length === 0}
						onClick={goToPrevMatch}
						title="Previous match (Shift+Enter)"
						type="button"
					>
						<ChevronUp className="h-4 w-4" />
					</button>
					<button
						className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
						disabled={matches.length === 0}
						onClick={goToNextMatch}
						title="Next match (Enter)"
						type="button"
					>
						<ChevronDown className="h-4 w-4" />
					</button>

					{/* Close */}
					<button
						className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
						onClick={onClose}
						title="Close (Escape)"
						type="button"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				{/* Replace Row (expandable) */}
				{showReplace ? (
					<div className="flex items-center gap-1 pl-6">
						{/* Replace Input with preserve case button inside */}
						<div className="relative flex-1">
							<input
								className="w-56 rounded border border-slate-200 py-1 pr-8 pl-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
								onChange={handleReplaceTextChange}
								placeholder="Replace"
								ref={replaceInputRef}
								type="text"
								value={replaceText}
							/>
							{/* Preserve case toggle - inside input */}
							<div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center">
								<button
									className={cn(
										"rounded p-0.5 transition-colors",
										preserveCase
											? "bg-blue-100 text-blue-600"
											: "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
									)}
									onClick={togglePreserveCase}
									title="Preserve Case (AB)"
									type="button"
								>
									<ALargeSmall className="h-4 w-4" />
								</button>
							</div>
						</div>

						{/* Replace buttons - left justified under match count */}
						<div className="flex min-w-[50px] items-center gap-1">
							<button
								className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
								disabled={matches.length === 0}
								onClick={replaceCurrentAndGoNext}
								title="Replace (Enter)"
								type="button"
							>
								<Replace className="h-4 w-4" />
							</button>
							<button
								className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
								disabled={matches.length === 0}
								onClick={replaceAllMatches}
								title="Replace All (⌘+Enter)"
								type="button"
							>
								<ReplaceAll className="h-4 w-4" />
							</button>
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}
