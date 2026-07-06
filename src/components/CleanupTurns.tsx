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
import { useCallback, useMemo, useState } from "react";
import { parseTime } from "@/lib/playback-utils";
import { deriveTranscriptTurns, type TranscriptTurn } from "@/lib/transcript-turns";
import { cn } from "@/lib/utils";
import { estimateSegmentWordTiming } from "@/lib/word-alignment";
import type { Segment, Speaker } from "@/types";

interface CleanupTurnsProps {
	segments: Segment[];
	speakers: Speaker[];
	selectedSegmentId: string | null;
	currentTime: number;
	onSelectSegment: (id: string) => void;
	onUpdateSegments: (updatesById: Record<string, Partial<Segment>>) => void;
	onSeek: (time: number) => void;
}

function segmentLabel(segment: Segment, index: number): string {
	const text = segment.text.trim();
	return text ? `${index + 1}. ${text}` : `${index + 1}. Empty segment`;
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
			if (!segment) return;
			const start = parseTime(segment.startTime);
			onSelectSegment(segment.id);
			onSeek(start);
		},
		[onSeek, onSelectSegment, segmentsById]
	);

	const assignTurnSpeaker = useCallback(
		(turn: TranscriptTurn, speakerId: string) => {
			if (speakerId === turn.speakerId) return;
			const updates = Object.fromEntries(
				turn.segmentIds.map((segmentId) => [segmentId, { speakerId }])
			);
			onUpdateSegments(updates);
		},
		[onUpdateSegments]
	);

	const splitTurnFromSelectedSegment = useCallback(
		(turn: TranscriptTurn, speakerId: string) => {
			if (!selectedSegmentId || speakerId === turn.speakerId) return;

			const splitIndex = turn.segmentIds.indexOf(selectedSegmentId);
			if (splitIndex <= 0) return;

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
			<div className="flex min-h-full items-center justify-center py-24 text-sm text-slate-400">
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
						<section
							key={turn.id}
							className={cn(
								"rounded-lg border bg-white shadow-sm transition",
								isSelectedTurn && "border-blue-300 ring-2 ring-blue-100",
								!isSelectedTurn && "border-slate-200",
								isActive && !isSelectedTurn && "border-amber-300"
							)}
						>
							<div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
								<div className="flex min-w-0 items-start gap-3">
									<div
										className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
										style={{ backgroundColor: speaker?.color }}
									>
										{speaker?.name.charAt(0)}
									</div>
									<div className="min-w-0">
										<div className="flex flex-wrap items-center gap-2">
											<select
												value={turn.speakerId}
												onChange={(event) => assignTurnSpeaker(turn, event.target.value)}
												className="max-w-48 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
											>
												{speakers.map((option) => (
													<option key={option.id} value={option.id}>
														{option.name}
													</option>
												))}
											</select>
											{turn.wordsDirty && (
												<span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
													<AlertTriangle size={12} />
													alignment dirty
												</span>
											)}
										</div>
										<div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
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
										type="button"
										onClick={() => realignTurn(turn)}
										className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
										title="Estimate word timing for every segment in this turn"
									>
										<RotateCcw size={13} />
										Re-align
									</button>
									<button
										type="button"
										onClick={() => seekSegment(turn.segmentIds[0])}
										className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
									>
										<ChevronsLeft size={13} />
										First
									</button>
									<button
										type="button"
										onClick={() => seekSegment(turn.segmentIds.at(-1) ?? turn.segmentIds[0])}
										className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
									>
										<ChevronsRight size={13} />
										Last
									</button>
									<div className="relative">
										<select
											value={splitTargets[turn.id] ?? ""}
											disabled={!canSplit}
											onChange={(event) => {
												const speakerId = event.target.value;
												if (speakerId) {
													splitTurnFromSelectedSegment(turn, speakerId);
												}
											}}
											className={cn(
												"rounded-md border px-2.5 py-1.5 text-xs font-medium outline-none transition",
												canSplit
													? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
													: "border-slate-100 bg-slate-50 text-slate-300"
											)}
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
											size={13}
											className={cn(
												"pointer-events-none absolute right-2 top-1/2 -translate-y-1/2",
												canSplit ? "text-slate-400" : "text-slate-300"
											)}
										/>
									</div>
								</div>
							</div>

							<div className="px-4 py-3">
								<p className="mb-3 line-clamp-3 font-serif text-base leading-7 text-slate-800">
									{turn.text}
								</p>
								<div className="flex flex-wrap gap-2">
									{turnSegments.map((segment, index) => {
										const isSelectedSegment = selectedSegmentId === segment.id;
										return (
											<button
												key={segment.id}
												type="button"
												onClick={() => seekSegment(segment.id)}
												className={cn(
													"inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition",
													isSelectedSegment
														? "border-blue-300 bg-blue-50 text-blue-700"
														: "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
												)}
												title={segment.text}
											>
												<UserRound size={11} />
												<span className="max-w-64 truncate">{segmentLabel(segment, index)}</span>
											</button>
										);
									})}
								</div>
							</div>
						</section>
					);
				})}
			</div>
		</div>
	);
}

export default CleanupTurns;
