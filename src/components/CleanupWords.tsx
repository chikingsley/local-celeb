import { AlertTriangle, RotateCcw, Type } from "lucide-react";
import { useCallback, useMemo } from "react";
import { cn, parseTime } from "@/lib/utils";
import {
	estimateSegmentWordTiming,
	getDisplayWords,
	getWordTimingDisplay,
	getWordTimingStatus,
} from "@/lib/word-alignment";
import type { Segment, Speaker } from "@/types";

interface CleanupWordsProps {
	segments: Segment[];
	speakers: Speaker[];
	selectedSegmentId: string | null;
	currentTime: number;
	onSelectSegment: (id: string) => void;
	onUpdateSegment: (id: string, updates: Partial<Segment>) => void;
	onSeek: (time: number) => void;
}

export function CleanupWords({
	segments,
	speakers,
	selectedSegmentId,
	currentTime,
	onSelectSegment,
	onUpdateSegment,
	onSeek,
}: CleanupWordsProps) {
	const selectedSegment = useMemo(
		() => segments.find((segment) => segment.id === selectedSegmentId) ?? segments[0] ?? null,
		[segments, selectedSegmentId]
	);
	const words = useMemo(
		() => (selectedSegment ? getDisplayWords(selectedSegment) : []),
		[selectedSegment]
	);
	const speaker = selectedSegment
		? speakers.find((candidate) => candidate.id === selectedSegment.speakerId)
		: null;
	const wordTimingStatus = selectedSegment ? getWordTimingStatus(selectedSegment) : "absent";
	const wordTimingDisplay = getWordTimingDisplay(wordTimingStatus);

	const handleSelectSegment = useCallback(
		(segmentId: string) => {
			const segment = segments.find((candidate) => candidate.id === segmentId);
			if (!segment) return;
			onSelectSegment(segment.id);
			onSeek(parseTime(segment.startTime));
		},
		[onSeek, onSelectSegment, segments]
	);

	const handleWordUpdate = useCallback(
		(wordIndex: number, field: "start" | "end", value: string) => {
			if (!selectedSegment) return;

			const seconds = Number(value);
			if (!Number.isFinite(seconds) || seconds < 0) return;

			const nextWords = getDisplayWords(selectedSegment).map((word) => ({ ...word }));
			if (!nextWords[wordIndex]) return;

			nextWords[wordIndex] = {
				...nextWords[wordIndex],
				[field]: seconds,
				interpolated: false,
			};

			if (field === "end" && nextWords[wordIndex + 1]) {
				nextWords[wordIndex + 1] = {
					...nextWords[wordIndex + 1],
					start: seconds,
					interpolated: false,
				};
			}
			if (field === "start" && nextWords[wordIndex - 1]) {
				nextWords[wordIndex - 1] = {
					...nextWords[wordIndex - 1],
					end: seconds,
					interpolated: false,
				};
			}

			onUpdateSegment(selectedSegment.id, {
				words: nextWords,
				wordsDirty: false,
				wordTimingStatus: "manual",
			});
		},
		[onUpdateSegment, selectedSegment]
	);

	const handleRealignSegment = useCallback(() => {
		if (!selectedSegment) return;
		const nextWords = estimateSegmentWordTiming(selectedSegment);
		if (nextWords.length === 0) return;
		onUpdateSegment(selectedSegment.id, {
			words: nextWords,
			wordsDirty: false,
			wordTimingStatus: "estimated",
		});
	}, [onUpdateSegment, selectedSegment]);

	if (!selectedSegment) {
		return (
			<div className="flex min-h-full items-center justify-center py-24 text-sm text-slate-400">
				No transcript loaded.
			</div>
		);
	}

	return (
		<div className="min-h-full pb-32">
			<div className="mx-auto max-w-5xl px-8 py-8">
				<section className="rounded-lg border border-slate-200 bg-white shadow-sm">
					<div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-4">
						<div className="min-w-0">
							<div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
								<Type size={14} />
								Words
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<select
									value={selectedSegment.id}
									onChange={(event) => handleSelectSegment(event.target.value)}
									className="max-w-xl rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
								>
									{segments.map((segment, index) => (
										<option key={segment.id} value={segment.id}>
											{index + 1}. {segment.startTime} {segment.text}
										</option>
									))}
								</select>
								<span
									className={cn(
										"inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
										wordTimingDisplay.tone === "emerald" && "bg-emerald-50 text-emerald-700",
										wordTimingDisplay.tone === "blue" && "bg-blue-50 text-blue-700",
										wordTimingDisplay.tone === "amber" && "bg-amber-50 text-amber-700",
										wordTimingDisplay.tone === "slate" && "bg-slate-100 text-slate-500"
									)}
									title={wordTimingDisplay.description}
								>
									{wordTimingStatus === "dirty" && <AlertTriangle size={12} />}
									{wordTimingDisplay.label}
								</span>
							</div>
							<div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
								<span>{speaker?.name ?? selectedSegment.speakerId}</span>
								<span className="font-mono">
									{selectedSegment.startTime} - {selectedSegment.endTime}
								</span>
								<span>{words.length} words</span>
							</div>
						</div>
						<button
							type="button"
							disabled={words.length === 0}
							onClick={handleRealignSegment}
							title="Estimate word timing from the current segment text and duration"
							className={cn(
								"inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition",
								words.length === 0
									? "border-slate-200 bg-slate-50 text-slate-400"
									: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
							)}
						>
							<RotateCcw size={14} />
							Re-align
						</button>
					</div>

					<div className="divide-y divide-slate-100">
						{words.map((word, index) => {
							const isCurrent = currentTime >= word.start && currentTime < word.end;
							return (
								<div
									key={`${selectedSegment.id}-${word.word}-${word.start}-${word.end}`}
									className={cn(
										"grid grid-cols-[minmax(0,1fr)_7rem_7rem] items-center gap-3 px-4 py-2.5 transition",
										isCurrent && "bg-blue-50"
									)}
								>
									<button
										type="button"
										onClick={() => onSeek(word.start)}
										className={cn(
											"truncate text-left text-sm font-medium",
											isCurrent
												? "text-blue-700"
												: word.interpolated
													? "text-amber-600"
													: "text-slate-700"
										)}
									>
										{word.word}
									</button>
									<label className="flex items-center gap-1">
										<span className="sr-only">Start time for {word.word}</span>
										<input
											type="number"
											step="0.01"
											value={word.start.toFixed(2)}
											onChange={(event) => handleWordUpdate(index, "start", event.target.value)}
											className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-mono outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
										/>
									</label>
									<label className="flex items-center gap-1">
										<span className="sr-only">End time for {word.word}</span>
										<input
											type="number"
											step="0.01"
											value={word.end.toFixed(2)}
											onChange={(event) => handleWordUpdate(index, "end", event.target.value)}
											className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-mono outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
										/>
									</label>
								</div>
							);
						})}
					</div>
				</section>
			</div>
		</div>
	);
}

export default CleanupWords;
