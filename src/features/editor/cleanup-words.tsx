import { AlertTriangle, RotateCcw, Type } from "lucide-react";
import type { ChangeEvent } from "react";
import { useCallback, useMemo } from "react";
import type { Segment, Speaker, WordTimestamp } from "@/domain/transcript/types";
import {
	estimateSegmentWordTiming,
	getDisplayWords,
	getWordTimingDisplay,
	getWordTimingStatus,
} from "@/domain/transcript/word-alignment";
import { cn, parseTime } from "@/lib/utils";

interface CleanupWordsProps {
	currentTime: number;
	onSeek: (time: number) => void;
	onSelectSegment: (id: string) => void;
	onUpdateSegment: (id: string, updates: Partial<Segment>) => void;
	segments: Segment[];
	selectedSegmentId: string | null;
	speakers: Speaker[];
}

interface WordTimingRowProps {
	index: number;
	isCurrent: boolean;
	onSeek: (time: number) => void;
	onWordUpdate: (wordIndex: number, field: "start" | "end", value: string) => void;
	word: WordTimestamp;
}

function WordTimingRow({ word, index, isCurrent, onSeek, onWordUpdate }: WordTimingRowProps) {
	const handleSeek = useCallback(() => {
		onSeek(word.start);
	}, [onSeek, word.start]);
	const handleStartChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onWordUpdate(index, "start", event.target.value);
		},
		[index, onWordUpdate]
	);
	const handleEndChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onWordUpdate(index, "end", event.target.value);
		},
		[index, onWordUpdate]
	);
	let wordClassName = "text-slate-700";
	if (isCurrent) {
		wordClassName = "text-blue-700";
	} else if (word.interpolated) {
		wordClassName = "text-amber-600";
	}

	return (
		<div
			className={cn(
				"grid grid-cols-[minmax(0,1fr)_7rem_7rem] items-center gap-3 px-4 py-2.5 transition",
				isCurrent && "bg-blue-50"
			)}
		>
			<button
				className={cn("truncate text-left font-medium text-sm", wordClassName)}
				onClick={handleSeek}
				type="button"
			>
				{word.word}
			</button>
			<label className="flex items-center gap-1">
				<span className="sr-only">Start time for {word.word}</span>
				<input
					className="w-full rounded border border-slate-200 px-2 py-1 font-mono text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					onChange={handleStartChange}
					step="0.01"
					type="number"
					value={word.start.toFixed(2)}
				/>
			</label>
			<label className="flex items-center gap-1">
				<span className="sr-only">End time for {word.word}</span>
				<input
					className="w-full rounded border border-slate-200 px-2 py-1 font-mono text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					onChange={handleEndChange}
					step="0.01"
					type="number"
					value={word.end.toFixed(2)}
				/>
			</label>
		</div>
	);
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
			if (!segment) {
				return;
			}
			onSelectSegment(segment.id);
			onSeek(parseTime(segment.startTime));
		},
		[onSeek, onSelectSegment, segments]
	);
	const handleSegmentSelectChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			handleSelectSegment(event.target.value);
		},
		[handleSelectSegment]
	);

	const handleWordUpdate = useCallback(
		(wordIndex: number, field: "start" | "end", value: string) => {
			if (!selectedSegment) {
				return;
			}

			const seconds = Number(value);
			if (!Number.isFinite(seconds) || seconds < 0) {
				return;
			}

			const nextWords = getDisplayWords(selectedSegment).map((word) => ({ ...word }));
			if (!nextWords[wordIndex]) {
				return;
			}

			nextWords[wordIndex] = {
				...nextWords[wordIndex],
				[field]: seconds,
				interpolated: false,
			};

			if (field === "end" && nextWords[wordIndex + 1]) {
				nextWords[wordIndex + 1] = {
					...nextWords[wordIndex + 1],
					interpolated: false,
					start: seconds,
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
		if (!selectedSegment) {
			return;
		}
		const nextWords = estimateSegmentWordTiming(selectedSegment);
		if (nextWords.length === 0) {
			return;
		}
		onUpdateSegment(selectedSegment.id, {
			words: nextWords,
			wordsDirty: false,
			wordTimingStatus: "estimated",
		});
	}, [onUpdateSegment, selectedSegment]);

	if (!selectedSegment) {
		return (
			<div className="flex min-h-full items-center justify-center py-24 text-slate-400 text-sm">
				No transcript loaded.
			</div>
		);
	}

	return (
		<div className="min-h-full pb-32">
			<div className="mx-auto max-w-5xl px-8 py-8">
				<section className="rounded-lg border border-slate-200 bg-white shadow-sm">
					<div className="flex flex-wrap items-start justify-between gap-3 border-slate-100 border-b px-4 py-4">
						<div className="min-w-0">
							<div className="mb-2 flex items-center gap-2 font-semibold text-slate-500 text-xs uppercase tracking-wider">
								<Type size={14} />
								Words
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<select
									className="max-w-xl rounded-md border border-slate-200 bg-white px-2.5 py-2 font-medium text-slate-800 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
									onChange={handleSegmentSelectChange}
									value={selectedSegment.id}
								>
									{segments.map((segment, index) => (
										<option key={segment.id} value={segment.id}>
											{index + 1}. {segment.startTime} {segment.text}
										</option>
									))}
								</select>
								<span
									className={cn(
										"inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium text-xs",
										wordTimingDisplay.tone === "emerald" && "bg-emerald-50 text-emerald-700",
										wordTimingDisplay.tone === "blue" && "bg-blue-50 text-blue-700",
										wordTimingDisplay.tone === "amber" && "bg-amber-50 text-amber-700",
										wordTimingDisplay.tone === "slate" && "bg-slate-100 text-slate-500"
									)}
									title={wordTimingDisplay.description}
								>
									{wordTimingStatus === "dirty" ? <AlertTriangle size={12} /> : null}
									{wordTimingDisplay.label}
								</span>
							</div>
							<div className="mt-2 flex flex-wrap items-center gap-3 text-slate-400 text-xs">
								<span>{speaker?.name ?? selectedSegment.speakerId}</span>
								<span className="font-mono">
									{selectedSegment.startTime} - {selectedSegment.endTime}
								</span>
								<span>{words.length} words</span>
							</div>
						</div>
						<button
							className={cn(
								"inline-flex items-center gap-2 rounded-md border px-3 py-2 font-medium text-sm transition",
								words.length === 0
									? "border-slate-200 bg-slate-50 text-slate-400"
									: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
							)}
							disabled={words.length === 0}
							onClick={handleRealignSegment}
							title="Estimate word timing from the current segment text and duration"
							type="button"
						>
							<RotateCcw size={14} />
							Re-align
						</button>
					</div>

					<div className="divide-y divide-slate-100">
						{words.map((word, index) => (
							<WordTimingRow
								index={index}
								isCurrent={currentTime >= word.start && currentTime < word.end}
								key={`${selectedSegment.id}-${word.word}-${word.start}-${word.end}`}
								onSeek={onSeek}
								onWordUpdate={handleWordUpdate}
								word={word}
							/>
						))}
					</div>
				</section>
			</div>
		</div>
	);
}
