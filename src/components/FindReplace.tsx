import {
	CaseSensitive,
	ChevronDown,
	ChevronRight,
	ChevronUp,
	Regex,
	Replace,
	ReplaceAll,
	WholeWord,
	X,
	ALargeSmall,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { parseTime } from "@/lib/playback-utils";
import { usePlayerStore } from "@/stores/player-store";
import type { Segment } from "@/types";

export interface SearchMatch {
	segmentId: string;
	startIndex: number;
	endIndex: number;
	text: string;
}

interface FindReplaceProps {
	isOpen: boolean;
	onClose: () => void;
	segments: Segment[];
	onUpdateSegment: (id: string, updates: Partial<Segment>) => void;
	onSelectSegment: (id: string | null) => void;
	onMatchesChange?: (matches: SearchMatch[], currentIndex: number, query: string) => void;
	initialQuery?: string;
}

export default function FindReplace({
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
			if (!searchQuery) return null;

			try {
				let pattern = searchQuery;

				if (!useRegex) {
					pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
			if (matches.length === 0) return;

			const wrappedIndex = ((index % matches.length) + matches.length) % matches.length;
			setCurrentMatchIndex(wrappedIndex);

			const match = matches[wrappedIndex];
			onSelectSegment(match.segmentId);

			// Scroll editor to segment
			scrollToSegment(match.segmentId);

			// Scroll timeline to segment's time
			const segment = segments.find((s) => s.id === match.segmentId);
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
			let match: RegExpExecArray | null;
			pattern.lastIndex = 0;

			while ((match = pattern.exec(segment.text)) !== null) {
				newMatches.push({
					segmentId: segment.id,
					startIndex: match.index,
					endIndex: match.index + match[0].length,
					text: match[0],
				});

				if (match[0].length === 0) {
					pattern.lastIndex++;
				}
			}
		}

		setMatches(newMatches);
		setCurrentMatchIndex(0);

		// Auto-scroll to first match while typing (not on initial open)
		// Use requestAnimationFrame to ensure DOM has updated and scroll callbacks are ready
		if (hasTypedRef.current && newMatches.length > 0) {
			requestAnimationFrame(() => {
				const match = newMatches[0];
				onSelectSegment(match.segmentId);
				scrollToSegment(match.segmentId);

				const segment = segments.find((s) => s.id === match.segmentId);
				if (segment) {
					const startSec = parseTime(segment.startTime);
					scrollToTime(startSec);
				}
			});
		}
	}, [query, segments, buildPattern, onSelectSegment, scrollToSegment, scrollToTime]);

	const goToNextMatch = () => goToMatch(currentMatchIndex + 1);
	const goToPrevMatch = () => goToMatch(currentMatchIndex - 1);

	// Apply preserve case transformation
	const applyPreserveCase = useCallback(
		(original: string, replacement: string): string => {
			if (!preserveCase) return replacement;

			// Check if original is all uppercase
			if (original === original.toUpperCase()) {
				return replacement.toUpperCase();
			}
			// Check if original is all lowercase
			if (original === original.toLowerCase()) {
				return replacement.toLowerCase();
			}
			// Check if original is title case (first char uppercase)
			if (original[0] === original[0].toUpperCase()) {
				return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
			}
			return replacement;
		},
		[preserveCase]
	);

	// Replace current match
	const replaceCurrent = useCallback(() => {
		if (matches.length === 0) return;

		const match = matches[currentMatchIndex];
		const segment = segments.find((s) => s.id === match.segmentId);
		if (!segment) return;

		const replacement = applyPreserveCase(match.text, replaceText);
		const newText =
			segment.text.substring(0, match.startIndex) +
			replacement +
			segment.text.substring(match.endIndex);

		onUpdateSegment(match.segmentId, { text: newText });
	}, [matches, currentMatchIndex, segments, replaceText, onUpdateSegment, applyPreserveCase]);

	// Replace all matches
	const replaceAllMatches = useCallback(() => {
		if (matches.length === 0 || !query) return;

		const pattern = buildPattern(query);
		if (!pattern) return;

		for (const segment of segments) {
			pattern.lastIndex = 0;
			const newText = segment.text.replace(pattern, (match) =>
				applyPreserveCase(match, replaceText)
			);
			if (newText !== segment.text) {
				onUpdateSegment(segment.id, { text: newText });
			}
		}
	}, [matches, query, buildPattern, segments, replaceText, onUpdateSegment, applyPreserveCase]);

	// Handle query input change
	const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		hasTypedRef.current = true;
		setQuery(e.target.value);
	};

	// Keyboard shortcuts
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			} else if (e.key === "Enter") {
				if (showReplace && (e.target as HTMLElement).closest("input") === replaceInputRef.current) {
					// In replace input: Enter = Replace, Cmd/Ctrl+Enter = Replace All
					e.preventDefault();
					if (e.metaKey || e.ctrlKey) {
						replaceAllMatches();
					} else {
						replaceCurrent();
						goToNextMatch();
					}
				} else {
					// In find input: Enter/Shift+Enter = navigate
					if (e.shiftKey) {
						goToPrevMatch();
					} else {
						goToNextMatch();
					}
				}
			} else if (e.key === "F3") {
				e.preventDefault();
				if (e.shiftKey) {
					goToPrevMatch();
				} else {
					goToNextMatch();
				}
			}
		},
		[onClose, showReplace, goToNextMatch, goToPrevMatch, replaceCurrent, replaceAllMatches]
	);

	if (!isOpen) return null;

	return (
		<div
			className="sticky top-2 right-4 ml-auto mr-4 z-50 bg-white border border-slate-200 rounded-lg shadow-lg w-fit"
			onKeyDown={handleKeyDown}
		>
			<div className="p-2 space-y-2">
				{/* Find Row */}
				<div className="flex items-center gap-1">
					{/* Expand/Collapse Chevron */}
					<button
						type="button"
						onClick={() => setShowReplace(!showReplace)}
						className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
						title={showReplace ? "Hide Replace" : "Show Replace"}
					>
						{showReplace ? (
							<ChevronDown className="w-4 h-4" />
						) : (
							<ChevronRight className="w-4 h-4" />
						)}
					</button>

					{/* Find Input with inline toggle buttons */}
					<div className="relative flex-1">
						<input
							ref={findInputRef}
							type="text"
							value={query}
							onChange={handleQueryChange}
							placeholder="Find"
							className={cn(
								"w-56 pl-2 pr-20 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500",
								regexError ? "border-red-400" : "border-slate-200"
							)}
						/>
						{/* Inline toggle buttons */}
						<div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
							<button
								type="button"
								onClick={() => setCaseSensitive(!caseSensitive)}
								className={cn(
									"p-0.5 rounded transition-colors",
									caseSensitive
										? "bg-blue-100 text-blue-600"
										: "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
								)}
								title="Match Case (Aa)"
							>
								<CaseSensitive className="w-4 h-4" />
							</button>
							<button
								type="button"
								onClick={() => setWholeWord(!wholeWord)}
								className={cn(
									"p-0.5 rounded transition-colors",
									wholeWord
										? "bg-blue-100 text-blue-600"
										: "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
								)}
								title="Match Whole Word (Ab)"
							>
								<WholeWord className="w-4 h-4" />
							</button>
							<button
								type="button"
								onClick={() => setUseRegex(!useRegex)}
								className={cn(
									"p-0.5 rounded transition-colors",
									useRegex
										? "bg-blue-100 text-blue-600"
										: "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
								)}
								title="Use Regular Expression (.*)"
							>
								<Regex className="w-4 h-4" />
							</button>
						</div>
						{regexError && (
							<div className="absolute top-full left-0 mt-1 text-xs text-red-500 bg-white p-1 rounded shadow-sm border border-red-200 z-10">
								{regexError}
							</div>
						)}
					</div>

					{/* Match count */}
					<span className="text-xs text-slate-500 min-w-[50px] text-center">
						{matches.length > 0
							? `${currentMatchIndex + 1}/${matches.length}`
							: query
								? "0/0"
								: ""}
					</span>

					{/* Navigation */}
					<button
						type="button"
						onClick={goToPrevMatch}
						disabled={matches.length === 0}
						className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-50"
						title="Previous match (Shift+Enter)"
					>
						<ChevronUp className="w-4 h-4" />
					</button>
					<button
						type="button"
						onClick={goToNextMatch}
						disabled={matches.length === 0}
						className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-50"
						title="Next match (Enter)"
					>
						<ChevronDown className="w-4 h-4" />
					</button>

					{/* Close */}
					<button
						type="button"
						onClick={onClose}
						className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
						title="Close (Escape)"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{/* Replace Row (expandable) */}
				{showReplace && (
					<div className="flex items-center gap-1 pl-6">
						{/* Replace Input with preserve case button inside */}
						<div className="relative flex-1">
							<input
								ref={replaceInputRef}
								type="text"
								value={replaceText}
								onChange={(e) => setReplaceText(e.target.value)}
								placeholder="Replace"
								className="w-56 pl-2 pr-8 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
							/>
							{/* Preserve case toggle - inside input */}
							<div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
								<button
									type="button"
									onClick={() => setPreserveCase(!preserveCase)}
									className={cn(
										"p-0.5 rounded transition-colors",
										preserveCase
											? "bg-blue-100 text-blue-600"
											: "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
									)}
									title="Preserve Case (AB)"
								>
									<ALargeSmall className="w-4 h-4" />
								</button>
							</div>
						</div>

						{/* Replace buttons - left justified under match count */}
						<div className="flex items-center gap-1 min-w-[50px]">
							<button
								type="button"
								onClick={() => {
									replaceCurrent();
									goToNextMatch();
								}}
								disabled={matches.length === 0}
								className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-50"
								title="Replace (Enter)"
							>
								<Replace className="w-4 h-4" />
							</button>
							<button
								type="button"
								onClick={replaceAllMatches}
								disabled={matches.length === 0}
								className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-50"
								title="Replace All (⌘+Enter)"
							>
								<ReplaceAll className="w-4 h-4" />
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
