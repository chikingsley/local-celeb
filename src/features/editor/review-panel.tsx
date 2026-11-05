import {
	Clipboard,
	Download,
	FileText,
	NotebookText,
	Sparkles,
	Subtitles,
	Tags,
} from "lucide-react";
import type { ChangeEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import {
	downloadExport,
	exportToReviewText,
	exportToSrt,
	exportToTurnJson,
} from "@/domain/transcript/export";
import { deriveTranscriptTurns } from "@/domain/transcript/turns";
import type { FileMetaData, Segment, Speaker, WordTimingStatus } from "@/domain/transcript/types";
import { getWordTimingStatus } from "@/domain/transcript/word-alignment";
import { ProposalQueue } from "@/features/assist/proposal-queue";
import type { ProposalReviewController } from "@/features/assist/use-proposal-review";
import { formatTime, parseTime } from "@/lib/utils";

interface ReviewPanelProps {
	meta: FileMetaData;
	onOpenExport: () => void;
	onUpdateMeta: (updates: Partial<FileMetaData>) => void;
	proposalReview: ProposalReviewController;
	segments: Segment[];
	speakers: Speaker[];
}

const FILENAME_EXTENSION_PATTERN = /\.[^.]+$/u;
const WORD_SEPARATOR_PATTERN = /\s+/u;

function countWords(text: string): number {
	return text.trim().split(WORD_SEPARATOR_PATTERN).filter(Boolean).length;
}

function baseName(name: string): string {
	return name.replace(FILENAME_EXTENSION_PATTERN, "") || "transcript";
}

export function ReviewPanel({
	meta,
	segments,
	speakers,
	onUpdateMeta,
	onOpenExport,
	proposalReview,
}: ReviewPanelProps) {
	const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
	const turns = useMemo(() => deriveTranscriptTurns(segments), [segments]);
	const duration =
		meta.duration || Math.max(0, ...segments.map((segment) => parseTime(segment.endTime)));
	const wordCount = useMemo(
		() => segments.reduce((sum, segment) => sum + countWords(segment.text), 0),
		[segments]
	);
	const timedWordCount = useMemo(
		() => segments.reduce((sum, segment) => sum + (segment.words?.length ?? 0), 0),
		[segments]
	);
	const dirtySegmentCount = useMemo(
		() => segments.filter((segment) => getWordTimingStatus(segment) === "dirty").length,
		[segments]
	);
	const { source } = meta;
	const wordTimingStats = useMemo(() => {
		const stats: Record<WordTimingStatus, number> = {
			absent: 0,
			dirty: 0,
			estimated: 0,
			manual: 0,
			provider: 0,
		};
		for (const segment of segments) {
			stats[getWordTimingStatus(segment)] += 1;
		}
		return stats;
	}, [segments]);
	const speakerCount = useMemo(
		() => new Set(segments.map((segment) => segment.speakerId)).size,
		[segments]
	);
	const sourceRows = useMemo(() => {
		if (!source) {
			return [];
		}
		const {
			audioPath,
			format,
			languageCode,
			languageProbability,
			model,
			modelId,
			modelKey,
			provider,
			recordCount,
			timestampsIncluded,
			timestampsRequested,
			timingSource,
		} = source;
		const language =
			languageCode && languageProbability !== undefined
				? `${languageCode} ${(languageProbability * 100).toFixed(1)}%`
				: languageCode;
		const timing =
			timingSource || timestampsRequested !== undefined
				? [
						timingSource,
						timestampsRequested === true ? "timestamps requested" : undefined,
						timestampsIncluded === true ? "included" : undefined,
					]
						.filter(Boolean)
						.join(" / ")
				: undefined;
		return [
			["Format", format],
			["Provider", provider],
			["Model", model ?? modelKey ?? modelId],
			["Language", language],
			["Timing", timing],
			["Records", recordCount?.toString()],
			["Audio path", audioPath],
		].filter((row): row is [string, string] => Boolean(row[1]));
	}, [source]);

	const filename = baseName(meta.name);

	const handleNameChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onUpdateMeta({ name: event.target.value });
		},
		[onUpdateMeta]
	);
	const handleLanguageChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onUpdateMeta({ language: event.target.value });
		},
		[onUpdateMeta]
	);
	const handleDateChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onUpdateMeta({ date: event.target.value });
		},
		[onUpdateMeta]
	);
	const handleSummaryChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			onUpdateMeta({ summary: event.target.value });
		},
		[onUpdateMeta]
	);
	const handleNotesChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			onUpdateMeta({ notes: event.target.value });
		},
		[onUpdateMeta]
	);

	const handleCopyTranscript = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(exportToReviewText(segments, speakers));
			setCopyStatus("copied");
			window.setTimeout(() => setCopyStatus("idle"), 1500);
		} catch {
			setCopyStatus("failed");
			window.setTimeout(() => setCopyStatus("idle"), 1500);
		}
	}, [segments, speakers]);

	const handleExportReviewText = useCallback(() => {
		downloadExport(
			exportToReviewText(segments, speakers, { includeTimestamps: true }),
			filename,
			"txt"
		);
	}, [filename, segments, speakers]);

	const handleExportSubtitles = useCallback(() => {
		downloadExport(exportToSrt(segments, speakers), filename, "srt");
	}, [filename, segments, speakers]);

	const handleExportTurns = useCallback(() => {
		downloadExport(exportToTurnJson(segments, speakers, meta), `${filename}.turns`, "json");
	}, [filename, meta, segments, speakers]);

	return (
		<aside className="flex h-full w-full flex-col overflow-hidden border-l border-slate-200 bg-slate-50">
			<div className="border-b border-slate-200 bg-white px-4 py-4">
				<div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
					<FileText size={14} />
					Review
				</div>
				<label className="block space-y-1.5">
					<span className="text-xs font-medium text-slate-500">Name</span>
					<input
						className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-900 transition outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
						onChange={handleNameChange}
						type="text"
						value={meta.name}
					/>
				</label>
				<div className="mt-3 grid grid-cols-2 gap-3">
					<label className="space-y-1.5">
						<span className="text-xs font-medium text-slate-500">Language</span>
						<input
							className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 transition outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
							onChange={handleLanguageChange}
							type="text"
							value={meta.language}
						/>
					</label>
					<label className="space-y-1.5">
						<span className="text-xs font-medium text-slate-500">Date</span>
						<input
							className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 transition outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
							onChange={handleDateChange}
							type="text"
							value={meta.date}
						/>
					</label>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto">
				<section className="border-b border-slate-200 bg-white px-4 py-4">
					<div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
						<Tags size={14} />
						Stats
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div>
							<div className="text-lg font-semibold text-slate-900">{turns.length}</div>
							<div className="text-xs text-slate-500">Turns</div>
						</div>
						<div>
							<div className="text-lg font-semibold text-slate-900">{segments.length}</div>
							<div className="text-xs text-slate-500">Segments</div>
						</div>
						<div>
							<div className="text-lg font-semibold text-slate-900">{speakerCount}</div>
							<div className="text-xs text-slate-500">Speakers</div>
						</div>
						<div>
							<div className="font-mono text-lg font-semibold text-slate-900">
								{formatTime(duration)}
							</div>
							<div className="text-xs text-slate-500">Duration</div>
						</div>
						<div>
							<div className="text-lg font-semibold text-slate-900">{wordCount}</div>
							<div className="text-xs text-slate-500">Words</div>
						</div>
						<div>
							<div className="text-lg font-semibold text-slate-900">{timedWordCount}</div>
							<div className="text-xs text-slate-500">Timed words</div>
						</div>
					</div>
					{dirtySegmentCount > 0 && (
						<div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
							{dirtySegmentCount} segment{dirtySegmentCount === 1 ? "" : "s"} need alignment review
						</div>
					)}
					{wordTimingStats.absent > 0 && (
						<div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
							{wordTimingStats.absent} segment{wordTimingStats.absent === 1 ? "" : "s"} have no word
							timing
						</div>
					)}
					{wordTimingStats.estimated > 0 && (
						<div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
							{wordTimingStats.estimated} segment
							{wordTimingStats.estimated === 1 ? "" : "s"} use estimated word timing
						</div>
					)}
				</section>

				{sourceRows.length > 0 && (
					<section className="border-b border-slate-200 bg-white px-4 py-4">
						<div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
							<Tags size={14} />
							Source
						</div>
						<div className="space-y-2">
							{sourceRows.map(([label, value]) => (
								<div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2 text-xs" key={label}>
									<div className="text-slate-500">{label}</div>
									<div className="truncate font-medium text-slate-700" title={value}>
										{value}
									</div>
								</div>
							))}
						</div>
					</section>
				)}

				<section className="border-b border-slate-200 bg-white px-4 py-4">
					<div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
						<Download size={14} />
						Actions
					</div>
					<div className="grid gap-2">
						<button
							className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
							onClick={handleCopyTranscript}
							type="button"
						>
							<span className="flex items-center gap-2">
								<Clipboard size={15} />
								Copy transcript
							</span>
							{copyStatus !== "idle" && (
								<span className="text-xs text-slate-400">
									{copyStatus === "copied" ? "Copied" : "Failed"}
								</span>
							)}
						</button>
						<button
							className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
							onClick={handleExportReviewText}
							type="button"
						>
							<FileText size={15} />
							Export transcript
						</button>
						<button
							className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
							onClick={handleExportSubtitles}
							type="button"
						>
							<Subtitles size={15} />
							Export subtitles
						</button>
						<button
							className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
							onClick={handleExportTurns}
							type="button"
						>
							<Download size={15} />
							Export turns JSON
						</button>
						<button
							className="rounded-md bg-slate-900 px-3 py-2 text-left text-sm font-medium text-white transition hover:bg-slate-800"
							onClick={onOpenExport}
							type="button"
						>
							All export formats
						</button>
					</div>
				</section>

				<section className="border-b border-slate-200 bg-white px-4 py-4">
					<div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
						<Sparkles size={14} />
						Summary
					</div>
					<textarea
						className="min-h-24 w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-800 transition outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
						onChange={handleSummaryChange}
						value={meta.summary ?? ""}
					/>
				</section>

				<section className="border-b border-slate-200 bg-white px-4 py-4">
					<div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
						<NotebookText size={14} />
						Notes
					</div>
					<textarea
						className="min-h-28 w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-800 transition outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
						onChange={handleNotesChange}
						value={meta.notes ?? ""}
					/>
				</section>

				<ProposalQueue controller={proposalReview} />
			</div>
		</aside>
	);
}
