import { AlertTriangle, Clock, Layers3 } from "lucide-react";
import type { ChangeEvent, KeyboardEvent, MouseEvent, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseTime } from "@/domain/playback/playback-utils";
import {
	deriveTranscriptTurns,
	getSegmentIdAtTurnChar,
	splitTurnTextAcrossSegments,
	type TranscriptTurn,
} from "@/domain/transcript/turns";
import type { Segment, Speaker } from "@/domain/transcript/types";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/player-store";

interface SearchMatch {
	endIndex: number;
	segmentId: string;
	startIndex: number;
}

interface ReviewEditorProps {
	currentMatchIndex?: number;
	currentTime: number;
	onProgrammaticScroll?: () => void;
	onSeek?: (time: number) => void;
	onSelectSegment: (id: string) => void;
	onUpdateSegments: (updatesById: Record<string, Partial<Segment>>) => void;
	scrollContainerRef?: RefObject<HTMLDivElement | null>;
	searchMatches?: SearchMatch[];
	segments: Segment[];
	selectedSegmentId: string | null;
	showTimestamps?: boolean;
	speakers: Speaker[];
}

interface ReviewTurnCardProps {
	adjustHeight: (id: string) => void;
	draftText: string;
	hasCurrentMatch: boolean;
	isActive: boolean;
	isSelected: boolean;
	onCommitTurnDraft: (turn: TranscriptTurn) => void;
	onDraftChange: (turnId: string, text: string) => void;
	onTurnClick: (turn: TranscriptTurn, charIndex?: number) => void;
	showTimestamps: boolean;
	speaker?: Speaker;
	textareaRefs: RefObject<Record<string, HTMLTextAreaElement | null>>;
	turn: TranscriptTurn;
	turnMatchCount: number;
	turnRefs: RefObject<Record<string, HTMLDivElement | null>>;
}

function ReviewTurnCard({
	turn,
	speaker,
	draftText,
	isActive,
	isSelected,
	hasCurrentMatch,
	turnMatchCount,
	showTimestamps,
	turnRefs,
	textareaRefs,
	adjustHeight,
	onTurnClick,
	onDraftChange,
	onCommitTurnDraft,
}: ReviewTurnCardProps) {
	const setTurnRef = useCallback(
		(element: HTMLDivElement | null) => {
			turnRefs.current[turn.id] = element;
		},
		[turn.id, turnRefs]
	);
	const setTextareaRef = useCallback(
		(element: HTMLTextAreaElement | null) => {
			textareaRefs.current[turn.id] = element;
		},
		[textareaRefs, turn.id]
	);
	const handleHeaderClick = useCallback(() => {
		onTurnClick(turn);
	}, [onTurnClick, turn]);
	const handleBlur = useCallback(() => {
		onCommitTurnDraft(turn);
	}, [onCommitTurnDraft, turn]);
	const handleChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			onDraftChange(turn.id, event.target.value);
			adjustHeight(turn.id);
		},
		[adjustHeight, onDraftChange, turn.id]
	);
	const handleTextareaClick = useCallback(
		(event: MouseEvent<HTMLTextAreaElement>) => {
			onTurnClick(turn, event.currentTarget.selectionStart);
		},
		[onTurnClick, turn]
	);
	const handleKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
		if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
			event.currentTarget.blur();
		}
	}, []);

	return (
		<div
			className={cn(
				"group border-l-4 px-6 py-5 transition-colors",
				isSelected && "border-l-blue-500 bg-blue-50/70",
				!isSelected && "border-l-transparent hover:border-l-slate-300 hover:bg-slate-50",
				isActive && !isSelected && "border-l-amber-400 bg-amber-50/50",
				hasCurrentMatch && "ring-2 ring-orange-200"
			)}
			ref={setTurnRef}
		>
			<div className="mb-3 flex items-start justify-between gap-4">
				<button
					className="-ml-1 flex min-w-0 items-center gap-3 rounded-lg p-1 text-left transition-colors hover:bg-slate-200/60"
					onClick={handleHeaderClick}
					type="button"
				>
					<div
						className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-white text-xs shadow-sm"
						style={{ backgroundColor: speaker?.color }}
					>
						{speaker ? speaker.name.charAt(0) : "?"}
					</div>
					<div className="min-w-0">
						<div className="truncate font-semibold text-slate-800 text-sm">
							{speaker?.name ?? turn.speakerId}
						</div>
						<div className="mt-0.5 flex flex-wrap items-center gap-2 text-slate-400 text-xs">
							{showTimestamps || isSelected || isActive ? (
								<span className="inline-flex items-center gap-1 font-mono">
									<Clock size={12} />
									{turn.startTime} - {turn.endTime}
								</span>
							) : null}
							<span className="inline-flex items-center gap-1">
								<Layers3 size={12} />
								{turn.segmentIds.length} segment{turn.segmentIds.length === 1 ? "" : "s"}
							</span>
							{turn.wordsDirty ? (
								<span className="inline-flex items-center gap-1 text-amber-600">
									<AlertTriangle size={12} />
									alignment dirty
								</span>
							) : null}
						</div>
					</div>
				</button>
				{turnMatchCount > 0 ? (
					<div
						className={cn(
							"rounded-full px-2 py-1 font-medium text-xs",
							hasCurrentMatch ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"
						)}
					>
						{turnMatchCount} match{turnMatchCount === 1 ? "" : "es"}
					</div>
				) : null}
			</div>

			<textarea
				className="relative z-10 block w-full resize-none overflow-hidden border-none bg-transparent p-0 font-serif text-lg text-slate-800 leading-8 outline-none focus:ring-0"
				onBlur={handleBlur}
				onChange={handleChange}
				onClick={handleTextareaClick}
				onKeyDown={handleKeyDown}
				ref={setTextareaRef}
				rows={1}
				spellCheck={false}
				value={draftText}
			/>
		</div>
	);
}

export function ReviewEditor({
	segments,
	speakers,
	selectedSegmentId,
	onSelectSegment,
	onUpdateSegments,
	currentTime,
	searchMatches = [],
	currentMatchIndex = 0,
	showTimestamps = false,
	onSeek,
	onProgrammaticScroll,
	scrollContainerRef,
}: ReviewEditorProps) {
	const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
	const turnRefs = useRef<Record<string, HTMLDivElement | null>>({});
	const [drafts, setDrafts] = useState<Record<string, string>>({});

	const turns = useMemo(() => deriveTranscriptTurns(segments), [segments]);
	const isPlaying = usePlayerStore((s) => s.isPlaying);
	const autoFollowEnabled = usePlayerStore((s) => s.autoFollowEnabled);
	const scrollToTime = usePlayerStore((s) => s.scrollToTime);
	const setAutoFollow = usePlayerStore((s) => s.setAutoFollow);

	const selectedTurnId = useMemo(() => {
		if (!selectedSegmentId) {
			return null;
		}
		return turns.find((turn) => turn.segmentIds.includes(selectedSegmentId))?.id ?? null;
	}, [selectedSegmentId, turns]);

	const activeTurn = useMemo(
		() =>
			turns.find((turn) => {
				const start = parseTime(turn.startTime);
				const end = parseTime(turn.endTime);
				return start <= currentTime && end > currentTime;
			}) ?? null,
		[turns, currentTime]
	);

	const lastScrolledTurnRef = useRef<string | null>(null);

	const adjustHeight = useCallback((id: string) => {
		const el = textareaRefs.current[id];
		if (!el) {
			return;
		}
		el.style.height = "auto";
		el.style.height = `${el.scrollHeight}px`;
	}, []);

	useEffect(() => {
		for (const turn of turns) {
			adjustHeight(turn.id);
		}
	}, [turns, adjustHeight]);

	useEffect(() => {
		setDrafts((currentDrafts) => {
			const nextDrafts: Record<string, string> = {};
			for (const turn of turns) {
				if (currentDrafts[turn.id] !== undefined) {
					nextDrafts[turn.id] = currentDrafts[turn.id];
				}
			}
			return nextDrafts;
		});
	}, [turns]);

	useEffect(() => {
		if (!(isPlaying && autoFollowEnabled && activeTurn)) {
			return;
		}
		if (activeTurn.id === lastScrolledTurnRef.current) {
			return;
		}

		const el = turnRefs.current[activeTurn.id];
		const container = scrollContainerRef?.current;
		if (!(el && container)) {
			return;
		}

		const containerRect = container.getBoundingClientRect();
		const elRect = el.getBoundingClientRect();
		const isAbove = elRect.top < containerRect.top + 50;
		const isBelow = elRect.bottom > containerRect.bottom - 50;

		if (isAbove || isBelow) {
			onProgrammaticScroll?.();
			el.scrollIntoView({ behavior: "smooth", block: "center" });
		}
		lastScrolledTurnRef.current = activeTurn.id;
	}, [activeTurn, autoFollowEnabled, isPlaying, onProgrammaticScroll, scrollContainerRef]);

	const getSpeaker = useCallback(
		(id: string) => speakers.find((speaker) => speaker.id === id) ?? speakers[0],
		[speakers]
	);

	const getTurnSegments = useCallback(
		(turn: TranscriptTurn) =>
			turn.segmentIds
				.map((segmentId) => segments.find((segment) => segment.id === segmentId))
				.filter((segment): segment is Segment => segment !== undefined),
		[segments]
	);

	const commitTurnDraft = useCallback(
		(turn: TranscriptTurn) => {
			const draft = drafts[turn.id];
			if (draft === undefined || draft === turn.text) {
				return;
			}

			const turnSegments = getTurnSegments(turn);
			const splitText = splitTurnTextAcrossSegments(draft, turnSegments);
			const updatesById: Record<string, Partial<Segment>> = {};

			for (const segment of turnSegments) {
				const nextText = splitText.get(segment.id) ?? "";
				if (nextText !== segment.text) {
					updatesById[segment.id] = {
						text: nextText,
						wordsDirty: true,
						wordTimingStatus: "dirty",
					};
				}
			}

			if (Object.keys(updatesById).length > 0) {
				onUpdateSegments(updatesById);
			}

			setDrafts((currentDrafts) => {
				const { [turn.id]: _removed, ...nextDrafts } = currentDrafts;
				return nextDrafts;
			});
		},
		[drafts, getTurnSegments, onUpdateSegments]
	);

	const handleDraftChange = useCallback((turnId: string, text: string) => {
		setDrafts((currentDrafts) => ({ ...currentDrafts, [turnId]: text }));
	}, []);

	const handleTurnClick = useCallback(
		(turn: TranscriptTurn, charIndex = 0) => {
			const segmentId = getSegmentIdAtTurnChar(turn, charIndex) ?? turn.segmentIds[0];
			const range =
				turn.segmentRanges.find((segmentRange) => segmentRange.segmentId === segmentId) ??
				turn.segmentRanges[0];
			if (!(segmentId && range)) {
				return;
			}

			const start = parseTime(range.startTime);
			onSelectSegment(segmentId);
			onSeek?.(start);
			scrollToTime(start);
			setAutoFollow(true);
		},
		[onSeek, onSelectSegment, scrollToTime, setAutoFollow]
	);

	if (turns.length === 0) {
		return (
			<div className="min-h-full py-24 text-center text-slate-400 text-sm">
				No transcript loaded.
			</div>
		);
	}

	return (
		<div className="min-h-full pb-32">
			<div className="mx-auto flex max-w-4xl flex-col gap-0 py-8">
				{turns.map((turn) => {
					const speaker = getSpeaker(turn.speakerId);
					const draft = drafts[turn.id];
					const textValue = draft ?? turn.text;
					const isActive = activeTurn?.id === turn.id;
					const isSelected = selectedTurnId === turn.id;
					const turnMatchCount = searchMatches.filter((match) =>
						turn.segmentIds.includes(match.segmentId)
					).length;
					const hasCurrentMatch =
						currentMatchIndex >= 0 &&
						searchMatches[currentMatchIndex] !== undefined &&
						turn.segmentIds.includes(searchMatches[currentMatchIndex].segmentId);

					return (
						<ReviewTurnCard
							adjustHeight={adjustHeight}
							draftText={textValue}
							hasCurrentMatch={hasCurrentMatch}
							isActive={isActive}
							isSelected={isSelected}
							key={turn.id}
							onCommitTurnDraft={commitTurnDraft}
							onDraftChange={handleDraftChange}
							onTurnClick={handleTurnClick}
							showTimestamps={showTimestamps}
							speaker={speaker}
							textareaRefs={textareaRefs}
							turn={turn}
							turnMatchCount={turnMatchCount}
							turnRefs={turnRefs}
						/>
					);
				})}

				<div className="flex h-32 items-center justify-center text-slate-300 italic">
					End of transcription
				</div>
			</div>
		</div>
	);
}
