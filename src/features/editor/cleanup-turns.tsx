import {
	AlertTriangle,
	ChevronsLeft,
	ChevronsRight,
	Clock,
	Layers3,
	RotateCcw,
	Scissors,
	UserRound,
} from "lucide-react";
import type { ChangeEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { parseTime } from "@/domain/playback/playback-utils";
import { deriveTranscriptTurns, type TranscriptTurn } from "@/domain/transcript/turns";
import type { Segment, Speaker } from "@/domain/transcript/types";
import { estimateSegmentWordTiming } from "@/domain/transcript/word-alignment";
import { cn } from "@/lib/utils";

interface CleanupTurnsProps {
	currentTime: number;
	onSeek: (time: number) => void;
	onSelectSegment: (id: string) => void;
	onUpdateSegments: (updatesById: Record<string, Partial<Segment>>) => void;
	segments: Segment[];
	selectedSegmentId: string | null;
	speakers: Speaker[];
}

function segmentLabel(segment: Segment, index: number): string {
	const text = segment.text.trim();
	return text ? `${index + 1}. ${text}` : `${index + 1}. Empty segment`;
}

interface TurnSegmentChipProps {
	index: number;
	isSelected: boolean;
	onSeekSegment: (segmentId: string) => void;
	segment: Segment;
}

function TurnSegmentChip({ segment, index, isSelected, onSeekSegment }: TurnSegmentChipProps) {
	const handleClick = useCallback(() => {
		onSeekSegment(segment.id);
	}, [onSeekSegment, segment.id]);

	return (
		<button
			className={cn(
				"inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition",
				isSelected
					? "border-blue-300 bg-blue-50 text-blue-700"
					: "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
			)}
			onClick={handleClick}
			title={segment.text}
			type="button"
		>
			<UserRound size={11} />
			<span className="max-w-64 truncate">{segmentLabel(segment, index)}</span>
		</button>
	);
}

interface TurnCardProps {
	canSplit: boolean;
	isActive: boolean;
	isSelectedTurn: boolean;
	onAssignTurnSpeaker: (turn: TranscriptTurn, speakerId: string) => void;
	onRealignTurn: (turn: TranscriptTurn) => void;
	onSeekSegment: (segmentId: string) => void;
	onSplitTurnFromSelectedSegment: (turn: TranscriptTurn, speakerId: string) => void;
	selectedSegmentId: string | null;
	speaker?: Speaker;
	speakers: Speaker[];
	splitValue: string;
	turn: TranscriptTurn;
	turnSegments: Segment[];
}

function TurnCard({
	turn,
	speaker,
	speakers,
	turnSegments,
	selectedSegmentId,
	isSelectedTurn,
	isActive,
	canSplit,
	splitValue,
	onAssignTurnSpeaker,
	onRealignTurn,
	onSeekSegment,
	onSplitTurnFromSelectedSegment,
}: TurnCardProps) {
	const handleSpeakerChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			onAssignTurnSpeaker(turn, event.target.value);
		},
		[onAssignTurnSpeaker, turn]
	);
	const handleRealignClick = useCallback(() => {
		onRealignTurn(turn);
	}, [onRealignTurn, turn]);
	const handleSeekFirst = useCallback(() => {
		const [firstSegmentId] = turn.segmentIds;
		if (firstSegmentId) {
			onSeekSegment(firstSegmentId);
		}
	}, [onSeekSegment, turn.segmentIds]);
	const handleSeekLast = useCallback(() => {
		const [firstSegmentId] = turn.segmentIds;
		const lastSegmentId = turn.segmentIds.at(-1) ?? firstSegmentId;
		if (lastSegmentId) {
			onSeekSegment(lastSegmentId);
		}
	}, [onSeekSegment, turn.segmentIds]);
	const handleSplitChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			const speakerId = event.target.value;
			if (speakerId) {
				onSplitTurnFromSelectedSegment(turn, speakerId);
			}
		},
		[onSplitTurnFromSelectedSegment, turn]
	);

	return (
		<section
			className={cn(
				"rounded-lg border bg-white shadow-sm transition",
				isSelectedTurn && "border-blue-300 ring-2 ring-blue-100",
				!isSelectedTurn && "border-slate-200",
				isActive && !isSelectedTurn && "border-amber-300"
			)}
		>
			<div className="flex flex-wrap items-start justify-between gap-3 border-slate-100 border-b px-4 py-3">
				<div className="flex min-w-0 items-start gap-3">
					<div
						className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-white text-xs shadow-sm"
						style={{ backgroundColor: speaker?.color }}
					>
						{speaker ? speaker.name.charAt(0) : "?"}
					</div>
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<select
								className="max-w-48 rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-800 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
								onChange={handleSpeakerChange}
								value={turn.speakerId}
							>
								{speakers.map((option) => (
									<option key={option.id} value={option.id}>
										{option.name}
									</option>
								))}
							</select>
							{turn.wordsDirty ? (
								<span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 font-medium text-amber-700 text-xs">
									<AlertTriangle size={12} />
									alignment dirty
								</span>
							) : null}
						</div>
						<div className="mt-1 flex flex-wrap items-center gap-3 text-slate-400 text-xs">
							<span className="inline-flex items-center gap-1 font-mono">
								<Clock size={12} />
								{turn.startTime} - {turn.endTime}
							</span>
							<span className="inline-flex items-center gap-1">
								<Layers3 size={12} />
								{turn.segmentIds.length} segment{turn.segmentIds.length === 1 ? "" : "s"}
							</span>
						</div>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<button
						className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 font-medium text-slate-600 text-xs transition hover:bg-slate-50"
						onClick={handleRealignClick}
						title="Estimate word timing for every segment in this turn"
						type="button"
					>
						<RotateCcw size={13} />
						Re-align
					</button>
					<button
						className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 font-medium text-slate-600 text-xs transition hover:bg-slate-50"
						onClick={handleSeekFirst}
						type="button"
					>
						<ChevronsLeft size={13} />
						First
					</button>
					<button
						className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 font-medium text-slate-600 text-xs transition hover:bg-slate-50"
						onClick={handleSeekLast}
						type="button"
					>
						<ChevronsRight size={13} />
						Last
					</button>
					<div className="relative">
						<select
							className={cn(
								"rounded-md border px-2.5 py-1.5 font-medium text-xs outline-none transition",
								canSplit
									? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
									: "border-slate-100 bg-slate-50 text-slate-300"
							)}
							disabled={!canSplit}
							onChange={handleSplitChange}
							value={splitValue}
						>
							<option value="">Split selected to...</option>
							{speakers
								.filter((option) => option.id !== turn.speakerId)
								.map((option) => (
									<option key={option.id} value={option.id}>
										{option.name}
									</option>
								))}
						</select>
						<Scissors
							className={cn(
								"pointer-events-none absolute top-1/2 right-2 -translate-y-1/2",
								canSplit ? "text-slate-400" : "text-slate-300"
							)}
							size={13}
						/>
					</div>
				</div>
			</div>

			<div className="px-4 py-3">
				<p className="mb-3 line-clamp-3 font-serif text-base text-slate-800 leading-7">
					{turn.text}
				</p>
				<div className="flex flex-wrap gap-2">
					{turnSegments.map((segment, index) => (
						<TurnSegmentChip
							index={index}
							isSelected={selectedSegmentId === segment.id}
							key={segment.id}
							onSeekSegment={onSeekSegment}
							segment={segment}
						/>
					))}
				</div>
			</div>
		</section>
	);
}

export function CleanupTurns({
	segments,
	speakers,
	selectedSegmentId,
	currentTime,
	onSelectSegment,
	onUpdateSegments,
	onSeek,
}: CleanupTurnsProps) {
	const [splitTargets, setSplitTargets] = useState<Record<string, string>>({});
	const turns = useMemo(() => deriveTranscriptTurns(segments), [segments]);
	const segmentsById = useMemo(
		() => new Map(segments.map((segment) => [segment.id, segment])),
		[segments]
	);

	const getSpeaker = useCallback(
		(id: string) => speakers.find((speaker) => speaker.id === id) ?? speakers[0],
		[speakers]
	);

	const seekSegment = useCallback(
		(segmentId: string) => {
			const segment = segmentsById.get(segmentId);
			if (!segment) {
				return;
			}
			const start = parseTime(segment.startTime);
			onSelectSegment(segment.id);
			onSeek(start);
		},
		[onSeek, onSelectSegment, segmentsById]
	);

	const assignTurnSpeaker = useCallback(
		(turn: TranscriptTurn, speakerId: string) => {
			if (speakerId === turn.speakerId) {
				return;
			}
			const updates = Object.fromEntries(
				turn.segmentIds.map((segmentId) => [segmentId, { speakerId }])
			);
			onUpdateSegments(updates);
		},
		[onUpdateSegments]
	);

	const splitTurnFromSelectedSegment = useCallback(
		(turn: TranscriptTurn, speakerId: string) => {
			if (!selectedSegmentId || speakerId === turn.speakerId) {
				return;
			}

			const splitIndex = turn.segmentIds.indexOf(selectedSegmentId);
			if (splitIndex <= 0) {
				return;
			}

			const updates = Object.fromEntries(
				turn.segmentIds.slice(splitIndex).map((segmentId) => [segmentId, { speakerId }])
			);
			onUpdateSegments(updates);
			setSplitTargets((current) => ({ ...current, [turn.id]: "" }));
		},
		[onUpdateSegments, selectedSegmentId]
	);

	const realignTurn = useCallback(
		(turn: TranscriptTurn) => {
			const updates = Object.fromEntries(
				turn.segmentIds
					.map((segmentId) => segmentsById.get(segmentId))
					.filter((segment): segment is Segment => segment !== undefined)
					.map((segment) => {
						const words = estimateSegmentWordTiming(segment);
						return [
							segment.id,
							{
								words: words.length > 0 ? words : undefined,
								wordsDirty: false,
								wordTimingStatus: words.length > 0 ? "estimated" : "absent",
							} satisfies Partial<Segment>,
						];
					})
			);
			onUpdateSegments(updates);
		},
		[onUpdateSegments, segmentsById]
	);

	if (turns.length === 0) {
		return (
			<div className="flex min-h-full items-center justify-center py-24 text-slate-400 text-sm">
				No transcript loaded.
			</div>
		);
	}

	return (
		<div className="min-h-full pb-32">
			<div className="mx-auto flex max-w-5xl flex-col gap-3 px-8 py-8">
				{turns.map((turn) => {
					const speaker = getSpeaker(turn.speakerId);
					const selectedIndex = selectedSegmentId ? turn.segmentIds.indexOf(selectedSegmentId) : -1;
					const isSelectedTurn = selectedIndex >= 0;
					const isActive =
						parseTime(turn.startTime) <= currentTime && parseTime(turn.endTime) > currentTime;
					const turnSegments = turn.segmentIds
						.map((segmentId) => segmentsById.get(segmentId))
						.filter((segment): segment is Segment => segment !== undefined);
					const canSplit = selectedIndex > 0;

					return (
						<TurnCard
							canSplit={canSplit}
							isActive={isActive}
							isSelectedTurn={isSelectedTurn}
							key={turn.id}
							onAssignTurnSpeaker={assignTurnSpeaker}
							onRealignTurn={realignTurn}
							onSeekSegment={seekSegment}
							onSplitTurnFromSelectedSegment={splitTurnFromSelectedSegment}
							selectedSegmentId={selectedSegmentId}
							speaker={speaker}
							speakers={speakers}
							splitValue={splitTargets[turn.id] ?? ""}
							turn={turn}
							turnSegments={turnSegments}
						/>
					);
				})}
			</div>
		</div>
	);
}
